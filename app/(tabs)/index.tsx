import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import type { Report, RecyclingPoint, WasteBin } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const UZ_LAT = 41.0;
const UZ_LNG = 63.0;
const YANDEX_KEY = process.env.EXPO_PUBLIC_YANDEX_MAPS_KEY ?? "";

// If Yandex key is missing, show error instead of crashing
if (!YANDEX_KEY && __DEV__) {
  console.error("❌ YANDEX MAPS KEY IS MISSING! Set EXPO_PUBLIC_YANDEX_MAPS_KEY in eas.json env.");
}

const LAYERS = [
  { id: "reports", label: "Muammolar", color: "#EF4444", icon: "⚠️" },
  { id: "paper", label: "Qog'oz", color: "#1D4ED8", icon: "📄" },
  { id: "plastic", label: "Plastik", color: "#7C3AED", icon: "♻️" },
  { id: "mixed", label: "Aralash", color: "#16A34A", icon: "🔄" },
  { id: "glass", label: "Shisha", color: "#D97706", icon: "🍶" },
  { id: "hazardous", label: "Zararli", color: "#374151", icon: "☣️" },
  { id: "bins", label: "Qutilari", color: "#0891B2", icon: "🗑️" },
];

// Safe escaping for JSON strings
function esc(s: string): string {
  if (!s) return "";
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/'/g, "\\'");
}

function safeJSON(data: any[]): string {
  return JSON.stringify(
    data.map((item) => ({
      ...item,
      description: esc(item.description ?? ""),
      name: esc(item.name ?? ""),
      address: esc(item.address ?? ""),
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
  // If no API key, return error HTML
  if (!YANDEX_KEY) {
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:sans-serif;padding:20px;text-align:center;background:#f8f9fa;color:#333}</style></head><body><h2>⚠️ Xarita yuklanmadi</h2><p>Yandex API kaliti topilmadi. Iltimos, administratorga murojaat qiling.</p></body></html>`;
  }

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
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body,#map{width:100%;height:100%;font-family:-apple-system,'SF Pro Display','Helvetica Neue',sans-serif;}

/* Bottom Sheet Popup */
.popup{
  position:fixed;bottom:0;left:0;right:0;
  background:#fff;
  border-radius:24px 24px 0 0;
  box-shadow:0 -8px 40px rgba(0,0,0,0.18);
  z-index:2000;
  transform:translateY(100%);
  transition:transform 0.35s cubic-bezier(0.32,0.72,0,1);
  max-height:72%;
  overflow:hidden;
}
.popup.open{transform:translateY(0);}
.drag-handle{
  width:36px;height:4px;
  background:#D1D5DB;
  border-radius:2px;
  margin:12px auto 0;
}
.popup-scroll{
  overflow-y:auto;
  padding:12px 18px 4px;
  max-height:calc(72vh - 140px);
}
.popup-img{
  width:100%;height:160px;
  object-fit:cover;
  border-radius:16px;
  margin-bottom:12px;
}
.badge-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
.badge{
  display:inline-flex;align-items:center;gap:4px;
  padding:4px 12px;border-radius:20px;
  font-size:12px;font-weight:600;
}
.popup-title{font-size:17px;font-weight:700;color:#111;margin-bottom:5px;line-height:1.3;}
.popup-sub{font-size:13px;color:#6B7280;margin-bottom:8px;line-height:1.5;}
.popup-addr{display:flex;align-items:flex-start;gap:5px;font-size:12px;color:#9CA3AF;margin-bottom:4px;}
.confirm-row{
  display:flex;align-items:center;gap:6px;
  background:#F0FDF4;
  border-radius:12px;
  padding:8px 12px;
  margin-bottom:4px;
}
.confirm-icon{font-size:16px;}
.confirm-text{font-size:13px;color:#16A34A;font-weight:600;}

/* Action buttons */
.btn-row{
  display:flex;gap:10px;
  padding:12px 18px 18px;
}
.btn{
  flex:1;border:none;border-radius:14px;
  padding:14px 16px;
  font-size:15px;font-weight:700;
  cursor:pointer;
  transition:opacity 0.2s;
}
.btn:active{opacity:0.8;}
.btn-primary{background:linear-gradient(135deg,#2E7D32,#4CAF50);color:#fff;}
.btn-secondary{background:#F3F4F6;color:#374151;}

/* Overlay scrim */
.scrim{
  position:fixed;inset:0;
  background:rgba(0,0,0,0.3);
  z-index:1999;
  display:none;
  backdrop-filter:blur(2px);
}
.scrim.show{display:block;}
</style>
</head>
<body>
<div id="map"></div>
<div class="scrim" id="scrim" onclick="closePopup()"></div>
<div class="popup" id="popup">
  <div class="drag-handle"></div>
  <div class="popup-scroll" id="popup-content"></div>
  <div class="btn-row">
    <button class="btn btn-secondary" id="btn-close" onclick="closePopup()">Yopish</button>
    <button class="btn btn-primary" id="btn-action"></button>
  </div>
</div>

<script src="https://api-maps.yandex.ru/2.1/?apikey=${YANDEX_KEY}&lang=uz_UZ"></script>
<script>
window.onerror=function(msg,url,line){
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:msg+' @'+line}));
  return true;
};

var reports=${reportsJson};
var recycling=${recyclingJson};
var bins=${binsJson};
var userLat=${userLatStr};
var userLng=${userLngStr};

var ISSUE_META={
  illegal_dumping:{label:'Noqonuniy axlat',color:'#EF4444',bg:'#FEE2E2'},
  tree_cutting:{label:'Daraxt kesish',color:'#16A34A',bg:'#DCFCE7'},
  water_pollution:{label:'Suv ifloslanishi',color:'#2563EB',bg:'#DBEAFE'},
  air_pollution:{label:'Havo ifloslanishi',color:'#7C3AED',bg:'#EDE9FE'},
  other:{label:'Boshqa muammo',color:'#D97706',bg:'#FEF3C7'}
};

var RECYCLING_META={
  paper:{label:"Qog'oz",color:'#1D4ED8',bg:'#DBEAFE'},
  plastic:{label:'Plastik',color:'#7C3AED',bg:'#EDE9FE'},
  mixed:{label:'Aralash',color:'#16A34A',bg:'#DCFCE7'},
  glass:{label:'Shisha',color:'#D97706',bg:'#FEF3C7'},
  hazardous:{label:'Zararli chiqindi',color:'#374151',bg:'#F3F4F6'}
};

var BIN_META={
  plastic:{label:'Plastik quti'},
  paper:{label:"Qog'oz quti"},
  glass:{label:'Shisha quti'},
  general:{label:'Umumiy axlat'}
};

function haversine(lat1,lng1,lat2,lng2){
  var R=6371;
  var dLat=(lat2-lat1)*Math.PI/180;
  var dLng=(lng2-lng1)*Math.PI/180;
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
  var d=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return d<1?Math.round(d*1000)+' m':d.toFixed(1)+' km';
}

function fmtDate(s){
  if(!s)return '';
  var d=new Date(s);
  return d.toLocaleDateString('uz-UZ',{day:'2-digit',month:'long',year:'numeric'});
}

function showPopup(html,actionLabel,actionFn){
  document.getElementById('popup-content').innerHTML=html;
  var btn=document.getElementById('btn-action');
  btn.textContent=actionLabel;
  btn.onclick=actionFn;
  document.getElementById('popup').classList.add('open');
  document.getElementById('scrim').classList.add('show');
}

function closePopup(){
  document.getElementById('popup').classList.remove('open');
  document.getElementById('scrim').classList.remove('show');
}

function showReportPopup(r){
  var m=ISSUE_META[r.issue_type]||ISSUE_META.other;
  var dist=(userLat!==null&&userLng!==null)?haversine(userLat,userLng,r.lat,r.lng):null;
  var html='';
  if(r.photo_url)html+='<img class="popup-img" src="'+r.photo_url+'" onerror="this.style.display=\'none\'" loading="lazy"/>';
  html+='<div class="badge-row">';
  html+='<span class="badge" style="background:'+m.bg+';color:'+m.color+'">'+m.label+'</span>';
  if(dist)html+='<span class="badge" style="background:#F3F4F6;color:#6B7280">📍 '+dist+' uzoqda</span>';
  html+='</div>';
  html+='<p class="popup-title">'+(r.description||m.label)+'</p>';
  html+='<p class="popup-sub">'+fmtDate(r.created_at)+'</p>';
  html+='<div class="confirm-row"><span class="confirm-icon">✅</span><span class="confirm-text">'+(r.confirmations_count||0)+' kishi tasdiqladi</span></div>';
  showPopup(html,"Batafsil ko'rish",function(){
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'open_report',id:r.id}));
  });
}

function showRecyclingPopup(rp){
  var m=RECYCLING_META[rp.type]||RECYCLING_META.mixed;
  var dist=(userLat!==null&&userLng!==null)?haversine(userLat,userLng,rp.lat,rp.lng):null;
  var html='<div class="badge-row">';
  html+='<span class="badge" style="background:'+m.bg+';color:'+m.color+'">'+m.label+'</span>';
  if(dist)html+='<span class="badge" style="background:#F3F4F6;color:#6B7280">📍 '+dist+' uzoqda</span>';
  html+='</div>';
  html+='<p class="popup-title">'+rp.name+'</p>';
  html+='<div class="popup-addr">📌 <span>'+rp.address+'</span></div>';
  showPopup(html,"Yo'nalish",function(){
    closePopup();
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'directions',lat:rp.lat,lng:rp.lng,name:rp.name}));
  });
}

function showBinPopup(b){
  var meta=BIN_META[b.bin_type]||{label:'Axlat qutisi'};
  var dist=(userLat!==null&&userLng!==null)?haversine(userLat,userLng,b.lat,b.lng):null;
  var html='<div class="badge-row">';
  html+='<span class="badge" style="background:#CFFAFE;color:#0891B2">🗑️ '+meta.label+'</span>';
  if(dist)html+='<span class="badge" style="background:#F3F4F6;color:#6B7280">📍 '+dist+' uzoqda</span>';
  html+='</div>';
  html+='<p class="popup-title">'+b.name+'</p>';
  html+='<div class="popup-addr">📌 <span>'+b.address+'</span></div>';
  showPopup(html,"Yo'nalish",function(){
    closePopup();
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'directions',lat:b.lat,lng:b.lng,name:b.name}));
  });
}

ymaps.ready(function(){
  try{
    var map=new ymaps.Map('map',{
      center:[${UZ_LAT},${UZ_LNG}],
      zoom:6,
      controls:['zoomControl'],
    },{suppressMapOpenBlock:true});

    map.events.add('click',function(){
      // just close popup if open? Already handled by scrim.
    });

    var clusterer=new ymaps.Clusterer({
      preset:'islands#invertedGreenClusterIcons',
      groupByCoordinates:false,
      clusterDisableClickZoom:false,
    });

    var all=[];

    reports.forEach(function(r){
      var m=ISSUE_META[r.issue_type]||ISSUE_META.other;
      var pm=new ymaps.Placemark([r.lat,r.lng],{hintContent:m.label},{
        preset:'islands#redIcon',
        iconColor:m.color
      });
      pm.events.add('click',function(e){e.stopPropagation();showReportPopup(r);});
      all.push(pm);
    });

    recycling.forEach(function(rp){
      var m=RECYCLING_META[rp.type]||RECYCLING_META.mixed;
      var pm=new ymaps.Placemark([rp.lat,rp.lng],{hintContent:rp.name},{
        preset:'islands#circleIcon',
        iconColor:m.color
      });
      pm.events.add('click',function(e){e.stopPropagation();showRecyclingPopup(rp);});
      all.push(pm);
    });

    bins.forEach(function(b){
      var pm=new ymaps.Placemark([b.lat,b.lng],{hintContent:b.name},{
        preset:'islands#blueCircleDotIcon',
        iconColor:'#0891B2'
      });
      pm.events.add('click',function(e){e.stopPropagation();showBinPopup(b);});
      all.push(pm);
    });

    clusterer.add(all);
    map.geoObjects.add(clusterer);

    if(userLat!==null&&userLng!==null){
      var userMark=new ymaps.Placemark([userLat,userLng],{hintContent:'Siz shu yerdasiz'},{
        preset:'islands#blueCircleIcon',
        iconColor:'#3B82F6',
      });
      map.geoObjects.add(userMark);
    }

    window.ymapInstance=map;
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready',
      totalMarkers:all.length,
      reports:reports.length,
      recycling:recycling.length,
      bins:bins.length
    }));
  }catch(e){
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:e.toString()}));
  }
});

window.centerOnUser=function(){
  if(userLat!==null&&userLng!==null&&window.ymapInstance){
    window.ymapInstance.setCenter([userLat,userLng],14,{duration:600});
  }
};
</script>
</body>
</html>`;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const webviewRef = useRef<WebView>(null);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(LAYERS.map((l) => l.id)));
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapStats, setMapStats] = useState({ reports: 0, recycling: 0, bins: 0 });

  const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16;

  const { data: reports = [], isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: recyclingPoints = [] } = useQuery<RecyclingPoint[]>({
    queryKey: ["recycling"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recycling_points").select("*");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const { data: wasteBins = [] } = useQuery<WasteBin[]>({
    queryKey: ["waste_bins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("waste_bins").select("*");
      if (error) return [];
      return data ?? [];
    },
    staleTime: 300_000,
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

  useEffect(() => {
    if (Platform.OS !== "web") {
      const channel = supabase
        .channel("map-reports")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, () => {
          qc.invalidateQueries({ queryKey: ["reports"] });
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [qc]);

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
        setMapStats({ reports: msg.reports ?? 0, recycling: msg.recycling ?? 0, bins: msg.bins ?? 0 });
      } else if (msg.type === "error") {
        console.warn("Map error:", msg.message);
      }
    } catch {}
  }, []);

  const toggleLayer = useCallback((id: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const centerOnUser = useCallback(() => {
    if (userLat && userLng) {
      webviewRef.current?.injectJavaScript("window.centerOnUser && window.centerOnUser(); true;");
    }
  }, [userLat, userLng]);

  const refreshMap = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["reports"] });
    qc.invalidateQueries({ queryKey: ["recycling"] });
    qc.invalidateQueries({ queryKey: ["waste_bins"] });
  }, [qc]);

  const todayReports = useMemo(() => {
    const today = new Date().toDateString();
    return reports.filter((r) => new Date(r.created_at).toDateString() === today).length;
  }, [reports]);

  return (
    <View style={styles.container}>
      {reportsLoading && !mapReady && (
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
        scrollEnabled={false}
      />

      {/* Header bar */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="leaf" size={22} color={C.primary} />
            <Text style={styles.appName}>Eco-Xarita</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={refreshMap}>
              <Ionicons name="refresh" size={19} color={C.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, showLayerPanel && styles.iconBtnActive]}
              onPress={() => setShowLayerPanel((v) => !v)}
            >
              <Ionicons name="layers" size={20} color={showLayerPanel ? "#fff" : C.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Today's report stats pill */}
      {mapReady && todayReports > 0 && !showLayerPanel && (
        <View style={[styles.statsPill, { top: topPad + 64 }]}>
          <Ionicons name="alert-circle" size={13} color="#EF4444" />
          <Text style={styles.statsPillText}>Bugun {todayReports} yangi muammo</Text>
        </View>
      )}

      {/* Layer Filter Panel */}
      {showLayerPanel && (
        <View style={[styles.layerPanel, { top: topPad + 60 }]}>
          <Text style={styles.layerPanelTitle}>Xarita qatlamlari</Text>
          <View style={styles.layerGrid}>
            {LAYERS.map((layer) => {
              const active = activeLayers.has(layer.id);
              return (
                <TouchableOpacity
                  key={layer.id}
                  style={[styles.layerChip, active ? { backgroundColor: layer.color } : styles.layerChipInactive]}
                  onPress={() => toggleLayer(layer.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.layerDot, { backgroundColor: active ? "#fff" : layer.color }]} />
                  <Text style={[styles.layerChipText, active && { color: "#fff" }]}>{layer.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Right floating controls */}
      <View style={[styles.rightControls, { bottom: bottomPad + 64 }]}>
        {userLat !== null && userLng !== null && (
          <TouchableOpacity style={styles.floatBtn} onPress={centerOnUser} activeOpacity={0.85}>
            <Ionicons name="locate" size={20} color={C.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: bottomPad }]}
        onPress={() => router.push("/report-modal")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
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
    paddingHorizontal: 14,
    paddingBottom: 10,
    zIndex: 200,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  appName: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: C.text },
  headerActions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  iconBtnActive: { backgroundColor: C.primary },
  statsPill: {
    position: "absolute",
    alignSelf: "center",
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 150,
  },
  statsPillText: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: C.text },
  layerPanel: {
    position: "absolute",
    left: 14, right: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 150,
  },
  layerPanelTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    color: C.textSecondary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  layerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  layerChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20,
  },
  layerChipInactive: { backgroundColor: "#F3F4F6" },
  layerDot: { width: 8, height: 8, borderRadius: 4 },
  layerChipText: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: C.text },
  rightControls: {
    position: "absolute", right: 14,
    zIndex: 200, gap: 8,
  },
  floatBtn: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  fab: {
    position: "absolute", right: 16,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 200,
  },
});