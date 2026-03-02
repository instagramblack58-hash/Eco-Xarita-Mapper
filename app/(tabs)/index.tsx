import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Report, RecyclingPoint } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const TASHKENT_LAT = 41.2995;
const TASHKENT_LNG = 69.2401;
const YANDEX_KEY = process.env.EXPO_PUBLIC_YANDEX_MAPS_KEY ?? "";

// JSON uchun xavfsiz qilish (apostrof va qo‘shtirnoqlarni escape qilish)
function safeStringify(data: any[]): string {
  const escaped = data.map(item => ({
    ...item,
    description: item.description?.replace(/'/g, "\\'").replace(/"/g, '\\"') || '',
    name: item.name?.replace(/'/g, "\\'").replace(/"/g, '\\"') || '',
    address: item.address?.replace(/'/g, "\\'").replace(/"/g, '\\"') || '',
    photo_url: item.photo_url || '',
  }));
  return JSON.stringify(escaped);
}

// Soddalashtirilgan HTML (faqat xarita) – diagnostika uchun
function simpleMapHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>body,html,#map{width:100%;height:100%;margin:0;padding:0;overflow:hidden;}</style>
  <script src="https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_KEY}&lang=uz_UZ"></script>
</head>
<body>
  <div id="map"></div>
  <script>
    window.onerror = function(msg, url, line) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: msg + ' at ' + url + ':' + line
      }));
    };
    ymaps.ready(() => {
      try {
        const map = new ymaps.Map('map', {
          center: [${TASHKENT_LAT}, ${TASHKENT_LNG}],
          zoom: 12
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: 'Xarita yaratildi'
        }));
      } catch (e) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          message: e.toString()
        }));
      }
    });
  </script>
</body>
</html>`;
}

// To‘liq HTML (markerlar bilan) – xavfsiz JSON ishlatiladi
function buildMapHtml(reports: Report[], recycling: RecyclingPoint[]): string {
  const reportsJson = safeStringify(reports);
  const recyclingJson = safeStringify(recycling);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #map { width: 100%; height: 100%; }
.popup {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: #fff; border-radius: 16px 16px 0 0;
  padding: 16px; box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
  display: none; z-index: 1000; max-height: 60%;
  font-family: -apple-system, sans-serif;
}
.popup.visible { display: block; }
.popup-handle { width: 36px; height: 4px; background: #ddd; border-radius: 2px; margin: 0 auto 12px; }
.popup h3 { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; }
.popup p { font-size: 13px; color: #555; margin-bottom: 8px; }
.popup img { width: 100%; height: 140px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; }
.popup-row { display: flex; gap: 8px; align-items: center; }
.badge { background: #E8F5E9; color: #2E7D32; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 20px; }
.badge-blue { background: #E3F2FD; color: #1565C0; }
.btn { background: #2E7D32; color: #fff; border: none; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; flex: 1; }
.close-btn { background: #f0f0f0; color: #333; border: none; border-radius: 8px; padding: 10px 12px; font-size: 13px; cursor: pointer; }
</style>
</head>
<body>
<div id="map"></div>
<div class="popup" id="popup">
  <div class="popup-handle"></div>
  <div id="popup-content"></div>
  <div class="popup-row" style="margin-top:8px">
    <button class="close-btn" onclick="closePopup()">Yopish</button>
    <button class="btn" id="popup-action-btn"></button>
  </div>
</div>

<script src="https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_KEY}&lang=uz_UZ"></script>
<script>
// Xatolarni React Native ga yuborish
window.onerror = function(msg, url, line) {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'error',
    message: msg + ' at ' + line
  }));
  return true;
};

console.log = function(msg) {
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'log',
    message: msg
  }));
};

var reports = ${reportsJson};
var recycling = ${recyclingJson};
console.log('Reports:', reports.length, 'Recycling:', recycling.length);

ymaps.ready(function() {
  try {
    var map = new ymaps.Map("map", {
      center: [${TASHKENT_LAT}, ${TASHKENT_LNG}],
      zoom: 12,
      controls: ["zoomControl"],
    });

    map.events.add("click", closePopup);

    // Hisobot markerlari
    reports.forEach(function(r, index) {
      try {
        var placemark = new ymaps.Placemark(
          [r.lat, r.lng],
          { hintContent: r.description },
          { preset: "islands#redIcon", iconColor: "#DC2626" }
        );
        placemark.events.add("click", function(e) {
          e.stopPropagation();
          showReportPopup(r);
        });
        map.geoObjects.add(placemark);
      } catch (e) {
        console.log('Error adding report marker ' + index + ': ' + e.toString());
      }
    });

    // Qayta ishlash markerlari
    recycling.forEach(function(rp, index) {
      try {
        var color = rp.type === "paper" ? "#1565C0" : rp.type === "plastic" ? "#7B1FA2" : "#2E7D32";
        var placemark = new ymaps.Placemark(
          [rp.lat, rp.lng],
          { hintContent: rp.name },
          { preset: "islands#circleIcon", iconColor: color }
        );
        placemark.events.add("click", function(e) {
          e.stopPropagation();
          showRecyclingPopup(rp);
        });
        map.geoObjects.add(placemark);
      } catch (e) {
        console.log('Error adding recycling marker ' + index + ': ' + e.toString());
      }
    });

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.toString() }));
  }
});

function showReportPopup(r) {
  var content = "";
  if (r.photo_url) {
    content += '<img src="' + r.photo_url + '" onerror="this.style.display=\'none\'" />';
  }
  content += '<div class="popup-row" style="margin-bottom:8px">';
  content += '<span class="badge">' + (r.confirmations_count || 0) + ' tasdiqlandi</span>';
  content += '<span style="font-size:11px;color:#999;margin-left:auto">' + (r.created_at ? new Date(r.created_at).toLocaleDateString("uz-UZ") : '') + '</span>';
  content += '</div>';
  content += '<h3>Muammo xabari</h3><p>' + (r.description || '') + '</p>';
  document.getElementById("popup-content").innerHTML = content;
  document.getElementById("popup-action-btn").textContent = "Batafsil";
  document.getElementById("popup-action-btn").onclick = function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "open_report", id: r.id }));
  };
  document.getElementById("popup").classList.add("visible");
}

function showRecyclingPopup(rp) {
  var typeLabel = rp.type === "paper" ? "Qog'oz" : rp.type === "plastic" ? "Plastik" : "Aralash";
  var badgeClass = rp.type === "paper" ? "badge-blue" : "";
  var content = '<div class="popup-row" style="margin-bottom:8px">';
  content += '<span class="badge ' + badgeClass + '">' + typeLabel + '</span>';
  content += '</div>';
  content += '<h3>' + (rp.name || '') + '</h3>';
  content += '<p>' + (rp.address || '') + '</p>';
  document.getElementById("popup-content").innerHTML = content;
  document.getElementById("popup-action-btn").textContent = "Yo'nalish";
  document.getElementById("popup-action-btn").onclick = function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "directions", lat: rp.lat, lng: rp.lng }));
  };
  document.getElementById("popup").classList.add("visible");
}

function closePopup() {
  document.getElementById("popup").classList.remove("visible");
}
</script>
</body>
</html>`;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const [showLayers, setShowLayers] = useState(true);
  const [useSimpleHtml, setUseSimpleHtml] = useState(false);

  const { data: reports = [], isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recyclingPoints = [] } = useQuery<RecyclingPoint[]>({
    queryKey: ["recycling"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recycling_points")
        .select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Ma'lumotlar sonini konsolga chiqarish
  useEffect(() => {
    console.log(`Reports: ${reports.length}, Recycling: ${recyclingPoints.length}`);
  }, [reports, recyclingPoints]);

  const mapHtml = useMemo(() => {
    if (useSimpleHtml) {
      return simpleMapHtml();
    } else {
      return buildMapHtml(
        showLayers ? reports : [],
        showLayers ? recyclingPoints : []
      );
    }
  }, [reports, recyclingPoints, showLayers, useSimpleHtml]);

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      console.log("📩 WebView message:", msg);
      if (msg.type === "open_report") {
        router.push({
          pathname: "/report-detail",
          params: { id: msg.id },
        });
      } else if (msg.type === "directions") {
        const url = Platform.select({
          ios: `maps://maps.apple.com/?daddr=${msg.lat},${msg.lng}`,
          android: `geo:${msg.lat},${msg.lng}?q=${msg.lat},${msg.lng}`,
          default: `https://maps.google.com/?q=${msg.lat},${msg.lng}`,
        });
        if (url) Linking.openURL(url).catch(() => {});
      } else if (msg.type === "error") {
        console.error("❌ WebView JS xatosi:", msg.message);
        Alert.alert("Xarita xatosi", msg.message);
      } else if (msg.type === "log") {
        console.log("📝 WebView log:", msg.message);
      }
    } catch (e) {
      console.warn("Message parsing error", e);
    }
  }, []);

  const handleWebViewError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error("❌ WebView onError:", nativeEvent);
    Alert.alert("WebView xatosi", JSON.stringify(nativeEvent));
  }, []);

  return (
    <View style={styles.container}>
      {reportsLoading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.loadingText}>Xarita yuklanmoqda...</Text>
        </View>
      ) : (
        <WebView
          ref={webviewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          onMessage={handleMessage}
          onError={handleWebViewError}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowsInlineMediaPlayback
          originWhitelist={["*"]}
          allowUniversalAccessFromFileURLs
          allowFileAccess
          onLoad={() => console.log("✅ WebView yuklandi")}
        />
      )}

      {/* Debug tugmasi (faqat rivojlantirish vaqtida) */}
      {__DEV__ && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: insets.top + 50,
            right: 10,
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: 8,
            borderRadius: 8,
            zIndex: 1000,
          }}
          onPress={() => setUseSimpleHtml(!useSimpleHtml)}
        >
          <Text style={{ color: '#fff' }}>
            Simple HTML: {useSimpleHtml ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 8 }]}>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="leaf" size={22} color={C.primary} />
            <Text style={styles.appName}>Eco-Xarita</Text>
          </View>
          <TouchableOpacity
            style={styles.layerBtn}
            onPress={() => setShowLayers(!showLayers)}
          >
            <Ionicons
              name={showLayers ? "layers" : "layers-outline"}
              size={22}
              color={showLayers ? C.primary : C.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Legend */}
      {showLayers && !useSimpleHtml && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
            <Text style={styles.legendText}>Muammolar</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#1565C0" }]} />
            <Text style={styles.legendText}>Qog'oz</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#7B1FA2" }]} />
            <Text style={styles.legendText}>Plastik</Text>
          </View>
        </View>
      )}

      {/* Report button */}
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: C.background,
  },
  loadingText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 15,
    color: C.textSecondary,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  appName: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 18,
    color: C.text,
  },
  layerBtn: { padding: 4 },
  legend: {
    position: "absolute",
    bottom: 180,
    left: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    padding: 10,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 11,
    color: C.text,
  },
  fab: {
    position: "absolute",
    right: 16,
    zIndex: 200,
  },
  fabBtn: {
    width: 56,
    height: 56,
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