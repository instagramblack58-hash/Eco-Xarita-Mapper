import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import type { Report, RecyclingPoint, WasteBin } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const UZ_LAT = 41.0;
const UZ_LNG = 63.0;
const YANDEX_KEY = process.env.EXPO_PUBLIC_YANDEX_MAPS_KEY ?? "";

const LAYERS = [
  { id: "reports", label: "Muammolar", color: "#DC2626" },
  { id: "paper", label: "Qog'oz", color: "#1565C0" },
  { id: "plastic", label: "Plastik", color: "#7B1FA2" },
  { id: "mixed", label: "Aralash", color: "#2E7D32" },
  { id: "glass", label: "Shisha", color: "#D97706" },
  { id: "hazardous", label: "Zararli", color: "#374151" },
  { id: "bins", label: "Axlat qutilari", color: "#0891B2" },
];

function safeJSON(data: any[]): string {
  return JSON.stringify(
    data.map((item) => ({
      ...item,
      description: (item.description ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"'),
      name: (item.name ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"'),
      address: (item.address ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"'),
      photo_url: item.photo_url ?? "",
    }))
  );
}

function buildMapHtml(
  reports: Report[],
  recycling: RecyclingPoint[],
  bins: WasteBin[],
  activeLayers: Set<string>,
  userLat: number | null,
  userLng: number | null
): string {
  const filteredReports = activeLayers.has("reports") ? reports : [];
  const filteredRecycling = recycling.filter((r) => activeLayers.has(r.type));
  const filteredBins = activeLayers.has("bins") ? bins : [];

  const reportsJson = safeJSON(filteredReports);
  const recyclingJson = safeJSON(filteredRecycling);
  const binsJson = safeJSON(filteredBins);
  const userLatStr = userLat != null ? String(userLat) : "null";
  const userLngStr = userLng != null ? String(userLng) : "null";

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #map { width: 100%; height: 100%; }
.popup {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #fff; border-radius: 20px 20px 0 0;
  padding: 0 0 12px 0; box-shadow: 0 -4px 24px rgba(0,0,0,0.18);
  display: none; z-index: 1000; max-height: 65%;
  font-family: -apple-system, 'Helvetica Neue', sans-serif;
  transform: translateY(100%);
  transition: transform 0.3s ease;
}
.popup.visible { display: block; transform: translateY(0); }
.popup-handle { width: 40px; height: 4px; background: #E5E7EB; border-radius: 2px; margin: 12px auto; }
.popup-scroll { max-height: calc(65vh - 60px); overflow-y: auto; padding: 0 16px 8px; }
.popup h3 { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 6px; }
.popup p { font-size: 13px; color: #555; margin-bottom: 8px; line-height: 1.5; }
.popup img { width: 100%; height: 150px; object-fit: cover; border-radius: 12px; margin-bottom: 10px; }
.popup-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.badge { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
.btn-row { display: flex; gap: 8px; padding: 8px 16px 0; }
.btn { border: none; border-radius: 12px; padding: 12px 16px; font-size: 14px; font-weight: 600; cursor: pointer; flex: 1; }
.btn-primary { background: #2E7D32; color: #fff; }
.btn-close { background: #F3F4F6; color: #374151; }
.dist { font-size: 11px; color: #6B7280; }
</style>
</head>
<body>
<div id="map"></div>
<div class="popup" id="popup">
  <div class="popup-handle"></div>
  <div class="popup-scroll">
    <div id="popup-content"></div>
  </div>
  <div class="btn-row">
    <button class="btn btn-close" onclick="closePopup()">Yopish</button>
    <button class="btn btn-primary" id="popup-action-btn"></button>
  </div>
</div>

<script src="https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_KEY}&lang=uz_UZ"></script>
<script>
window.onerror = function(msg, url, line) {
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: msg + ' @' + line }));
  return true;
};

var reports = ${reportsJson};
var recycling = ${recyclingJson};
var bins = ${binsJson};
var userLat = ${userLatStr};
var userLng = ${userLngStr};

var ISSUE_LABELS = {
  illegal_dumping: 'Noqonuniy axlat',
  tree_cutting: 'Daraxt kesish',
  water_pollution: 'Suv ifloslanishi',
  air_pollution: 'Havo ifloslanishi',
  other: 'Boshqa muammo'
};

var TYPE_COLORS = {
  paper: '#1565C0',
  plastic: '#7B1FA2',
  mixed: '#2E7D32',
  glass: '#D97706',
  hazardous: '#374151'
};

var TYPE_LABELS = {
  paper: 'Qog\u02bcoz',
  plastic: 'Plastik',
  mixed: 'Aralash',
  glass: 'Shisha',
  hazardous: 'Zararli chiqindi'
};

var BIN_LABELS = {
  plastic: 'Plastik quti',
  paper: 'Qog\u02bcoz quti',
  glass: 'Shisha quti',
  general: 'Umumiy axlat'
};

function haversine(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  var dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  if (dist < 1) return (dist * 1000).toFixed(0) + ' m';
  return dist.toFixed(1) + ' km';
}

ymaps.ready(function() {
  try {
    var map = new ymaps.Map('map', {
      center: [${UZ_LAT}, ${UZ_LNG}],
      zoom: 6,
      controls: ['zoomControl'],
    });

    map.events.add('click', closePopup);

    var clusterer = new ymaps.Clusterer({
      preset: 'islands#invertedGreenClusterIcons',
      groupByCoordinates: false,
      clusterDisableClickZoom: false,
    });

    var allPlacemarks = [];

    reports.forEach(function(r) {
      var pm = new ymaps.Placemark([r.lat, r.lng], { hintContent: ISSUE_LABELS[r.issue_type] || r.description }, {
        preset: 'islands#redIcon',
        iconColor: '#DC2626'
      });
      pm.events.add('click', function(e) { e.stopPropagation(); showReportPopup(r); });
      allPlacemarks.push(pm);
    });

    recycling.forEach(function(rp) {
      var color = TYPE_COLORS[rp.type] || '#2E7D32';
      var pm = new ymaps.Placemark([rp.lat, rp.lng], { hintContent: rp.name }, {
        preset: 'islands#circleIcon',
        iconColor: color
      });
      pm.events.add('click', function(e) { e.stopPropagation(); showRecyclingPopup(rp); });
      allPlacemarks.push(pm);
    });

    bins.forEach(function(b) {
      var pm = new ymaps.Placemark([b.lat, b.lng], { hintContent: b.name }, {
        preset: 'islands#blueCircleDotIcon',
        iconColor: '#0891B2'
      });
      pm.events.add('click', function(e) { e.stopPropagation(); showBinPopup(b); });
      allPlacemarks.push(pm);
    });

    clusterer.add(allPlacemarks);
    map.geoObjects.add(clusterer);

    if (userLat !== null && userLng !== null) {
      var userMark = new ymaps.Placemark([userLat, userLng], { hintContent: 'Siz shu yerdasiz' }, {
        preset: 'islands#blueCircleIcon',
        iconColor: '#3B82F6',
      });
      map.geoObjects.add(userMark);
    }

    window.ymapInstance = map;
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  } catch(e) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.toString() }));
  }
});

window.centerOnUser = function() {
  if (userLat !== null && userLng !== null && window.ymapInstance) {
    window.ymapInstance.setCenter([userLat, userLng], 14, { duration: 400 });
  }
};

function showReportPopup(r) {
  var distStr = (userLat !== null && userLng !== null) ? haversine(userLat, userLng, r.lat, r.lng) : null;
  var issueLabel = ISSUE_LABELS[r.issue_type] || 'Muammo';
  var content = '';
  if (r.photo_url) content += '<img src="' + r.photo_url + '" onerror="this.style.display=\'none\'" />';
  content += '<div class="popup-row">';
  content += '<span class="badge" style="background:#FEE2E2;color:#DC2626">' + issueLabel + '</span>';
  if (distStr) content += '<span class="dist">' + distStr + ' uzoqda</span>';
  content += '</div>';
  content += '<p style="font-size:11px;color:#9CA3AF;margin-bottom:6px">' + (r.created_at ? new Date(r.created_at).toLocaleDateString('uz-UZ') : '') + '</p>';
  if (r.description && r.description !== issueLabel) content += '<p>' + r.description + '</p>';
  content += '<div class="popup-row"><span class="badge" style="background:#E8F5E9;color:#2E7D32">\u2713 ' + (r.confirmations_count || 0) + ' tasdiqlandi</span></div>';
  document.getElementById('popup-content').innerHTML = content;
  document.getElementById('popup-action-btn').textContent = 'Batafsil';
  document.getElementById('popup-action-btn').onclick = function() {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'open_report', id: r.id }));
  };
  document.getElementById('popup').classList.add('visible');
}

function showRecyclingPopup(rp) {
  var color = TYPE_COLORS[rp.type] || '#2E7D32';
  var label = TYPE_LABELS[rp.type] || 'Qayta ishlash';
  var distStr = (userLat !== null && userLng !== null) ? haversine(userLat, userLng, rp.lat, rp.lng) : null;
  var content = '<div class="popup-row"><span class="badge" style="background:' + color + '22;color:' + color + '">' + label + '</span>';
  if (distStr) content += '<span class="dist">' + distStr + ' uzoqda</span>';
  content += '</div>';
  content += '<h3>' + rp.name + '</h3>';
  content += '<p>\uD83D\uDCCD ' + rp.address + '</p>';
  document.getElementById('popup-content').innerHTML = content;
  document.getElementById('popup-action-btn').textContent = 'Yo\u02bcnalish';
  document.getElementById('popup-action-btn').onclick = function() {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'directions', lat: rp.lat, lng: rp.lng, name: rp.name }));
  };
  document.getElementById('popup').classList.add('visible');
}

function showBinPopup(b) {
  var label = BIN_LABELS[b.bin_type] || 'Axlat qutisi';
  var distStr = (userLat !== null && userLng !== null) ? haversine(userLat, userLng, b.lat, b.lng) : null;
  var content = '<div class="popup-row"><span class="badge" style="background:#CFFAFE;color:#0891B2">' + label + '</span>';
  if (distStr) content += '<span class="dist">' + distStr + ' uzoqda</span>';
  content += '</div>';
  content += '<h3>' + b.name + '</h3>';
  content += '<p>\uD83D\uDCCD ' + b.address + '</p>';
  document.getElementById('popup-content').innerHTML = content;
  document.getElementById('popup-action-btn').textContent = 'Yo\u02bcnalish';
  document.getElementById('popup-action-btn').onclick = function() {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'directions', lat: b.lat, lng: b.lng, name: b.name }));
  };
  document.getElementById('popup').classList.add('visible');
}

function closePopup() {
  document.getElementById('popup').classList.remove('visible');
}
</script>
</body>
</html>`;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(LAYERS.map((l) => l.id)));
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const { data: reports = [], isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recyclingPoints = [] } = useQuery<RecyclingPoint[]>({
    queryKey: ["recycling"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recycling_points").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: wasteBins = [] } = useQuery<WasteBin[]>({
    queryKey: ["waste_bins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("waste_bins").select("*");
      if (error) return [];
      return data ?? [];
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLat(loc.coords.latitude);
        setUserLng(loc.coords.longitude);
      } catch {}
    })();
  }, []);

  const mapHtml = useMemo(
    () => buildMapHtml(reports, recyclingPoints, wasteBins, activeLayers, userLat, userLng),
    [reports, recyclingPoints, wasteBins, activeLayers, userLat, userLng]
  );

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "open_report") {
        router.push({ pathname: "/report-detail", params: { id: msg.id } });
      } else if (msg.type === "directions") {
        const url = Platform.select({
          ios: `maps://maps.apple.com/?daddr=${msg.lat},${msg.lng}&q=${encodeURIComponent(msg.name ?? "")}`,
          android: `geo:${msg.lat},${msg.lng}?q=${msg.lat},${msg.lng}(${encodeURIComponent(msg.name ?? "")})`,
          default: `https://maps.google.com/?q=${msg.lat},${msg.lng}`,
        });
        if (url) Linking.openURL(url).catch(() => {});
      } else if (msg.type === "ready") {
        setMapReady(true);
      } else if (msg.type === "error") {
        console.warn("Map error:", msg.message);
      }
    } catch {}
  }, []);

  const toggleLayer = (id: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const centerOnUser = () => {
    if (userLat && userLng) {
      webviewRef.current?.injectJavaScript("window.centerOnUser && window.centerOnUser(); true;");
    }
  };

  const visibleLayers = LAYERS.filter((l) => activeLayers.has(l.id));

  return (
    <View style={styles.container}>
      {reportsLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Xarita yuklanmoqda...</Text>
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ html: mapHtml }}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsInlineMediaPlayback
        originWhitelist={["*"]}
        allowUniversalAccessFromFileURLs
        allowFileAccess
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="leaf" size={22} color={C.primary} />
            <Text style={styles.appName}>Eco-Xarita</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerBtn, showLayerPanel && styles.headerBtnActive]}
            onPress={() => setShowLayerPanel(!showLayerPanel)}
          >
            <Ionicons name="layers" size={20} color={showLayerPanel ? "#fff" : C.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Layer Filter Panel */}
      {showLayerPanel && (
        <View style={[styles.layerPanel, { top: Platform.OS === "web" ? 67 + 56 + 12 : insets.top + 64 }]}>
          <Text style={styles.layerPanelTitle}>Qatlamlarni tanlang</Text>
          <View style={styles.layerGrid}>
            {LAYERS.map((layer) => (
              <TouchableOpacity
                key={layer.id}
                style={[
                  styles.layerChip,
                  activeLayers.has(layer.id) && { backgroundColor: layer.color },
                ]}
                onPress={() => toggleLayer(layer.id)}
              >
                <View
                  style={[
                    styles.layerDot,
                    { backgroundColor: activeLayers.has(layer.id) ? "#fff" : layer.color },
                  ]}
                />
                <Text
                  style={[
                    styles.layerChipText,
                    activeLayers.has(layer.id) && { color: "#fff" },
                  ]}
                >
                  {layer.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Legend */}
      {!showLayerPanel && visibleLayers.length > 0 && (
        <View style={styles.legend}>
          {visibleLayers.map((l) => (
            <View key={l.id} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Right controls */}
      <View style={[styles.rightControls, { bottom: Platform.OS === "web" ? 34 + 84 + 72 : insets.bottom + 84 + 72 }]}>
        {userLat && userLng && (
          <TouchableOpacity style={styles.controlBtn} onPress={centerOnUser}>
            <Ionicons name="locate" size={20} color={C.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* FAB */}
      <View style={[styles.fab, { bottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16 }]}>
        <TouchableOpacity
          style={styles.fabBtn}
          onPress={() => router.push("/report-modal")}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: C.background,
    zIndex: 999,
  },
  loadingText: { fontFamily: "Nunito_600SemiBold", fontSize: 15, color: C.textSecondary },
  header: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  appName: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: C.text },
  headerBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnActive: { backgroundColor: C.primary },
  layerPanel: {
    position: "absolute",
    left: 16, right: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 99,
  },
  layerPanelTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  layerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  layerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  layerDot: { width: 8, height: 8, borderRadius: 4 },
  layerChipText: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: C.text },
  legend: {
    position: "absolute",
    bottom: 200,
    left: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    padding: 10,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 50,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: "Nunito_600SemiBold", fontSize: 11, color: C.text },
  rightControls: {
    position: "absolute",
    right: 16,
    zIndex: 200,
    gap: 8,
  },
  controlBtn: {
    width: 44, height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fab: { position: "absolute", right: 16, zIndex: 200 },
  fabBtn: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
