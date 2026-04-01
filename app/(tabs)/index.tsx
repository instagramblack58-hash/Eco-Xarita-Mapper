  import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
  import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    Linking,
  } from "react-native";
  import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
  import { useSafeAreaInsets } from "react-native-safe-area-context";
  import { router } from "expo-router";
  import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
  import { useQuery, useQueryClient } from "@tanstack/react-query";
  import * as Location from "expo-location";
  import { supabase } from "@/lib/supabase";
  import type { Report, RecyclingPoint, WasteBin } from "@/lib/supabase";
  import Colors from "@/constants/colors";
  import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

  const C = Colors.light;

  // Map layers configuration
  const LAYERS = [
    { id: "reports", label: "Muammolar", color: "#EF4444" },
    { id: "paper", label: "Qog'oz", color: "#1D4ED8" },
    { id: "plastic", label: "Plastik", color: "#7C3AED" },
    { id: "mixed", label: "Aralash", color: "#16A34A" },
    { id: "glass", label: "Shisha", color: "#D97706" },
    { id: "hazardous", label: "Zararli", color: "#374151" },
    { id: "bins", label: "Qutilari", color: "#0891B2" },
  ];

  const getMarkerColor = (id: string): string => {
    const layer = LAYERS.find(l => l.id === id);
    return layer ? layer.color : "#000";
  };

  // Haversine distance (km)
  const haversineDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDistance = (dist: number): string => {
    if (dist < 1) return `${Math.round(dist * 1000)} m`;
    return `${dist.toFixed(1)} km`;
  };

  export default function MapScreen() {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const qc = useQueryClient();

    const [showLayerPanel, setShowLayerPanel] = useState(false);
    const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(LAYERS.map(l => l.id)));
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [selectedItem, setSelectedItem] = useState<{ type: "report" | "recycling" | "bin"; data: any; distance?: number } | null>(null);

    const topPad = Platform.OS === "web" ? 67 : insets.top + 8;
    const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16;

    // Data fetching
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

    // Get user location
    useEffect(() => {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              },
              1000
            );
          }
        }
      })();
    }, []);

    // Real-time updates for new reports
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

    const toggleLayer = (id: string) => {
      setActiveLayers(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const centerOnUser = () => {
      if (userLocation) {
        mapRef.current?.animateToRegion(
          {
            ...userLocation,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          1000
        );
      }
    };

    const refreshMap = useCallback(() => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["recycling"] });
      qc.invalidateQueries({ queryKey: ["waste_bins"] });
    }, [qc]);

    const todayReports = useMemo(() => {
      const today = new Date().toDateString();
      return reports.filter(r => new Date(r.created_at).toDateString() === today).length;
    }, [reports]);

    const openDirections = (lat: number, lng: number, name: string) => {
      const url = Platform.select({
        ios: `maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name)}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`,
        default: `https://maps.google.com/?q=${lat},${lng}`,
      });
      if (url) Linking.openURL(url);
    };

    const handleMarkerPress = (type: "report" | "recycling" | "bin", data: any) => {
      let distance = undefined;
      if (userLocation) {
        distance = haversineDistance(userLocation.latitude, userLocation.longitude, data.lat, data.lng);
      }
      setSelectedItem({ type, data, distance });
      bottomSheetRef.current?.expand();
    };

    const closeBottomSheet = () => {
      bottomSheetRef.current?.close();
      setSelectedItem(null);
    };

    // Helper to get issue label
    const getIssueLabel = (type: string | null) => {
      const labels: Record<string, string> = {
        illegal_dumping: "Noqonuniy axlat",
        tree_cutting: "Daraxt kesish",
        water_pollution: "Suv ifloslanishi",
        air_pollution: "Havo ifloslanishi",
        other: "Boshqa muammo",
      };
      return type ? labels[type] || "Muammo" : "Muammo";
    };

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "long", year: "numeric" });
    };

    // Filter visible markers
    const visibleReports = activeLayers.has("reports") ? reports : [];
    const visibleRecycling = recyclingPoints.filter(r => activeLayers.has(r.type));
    const visibleBins = activeLayers.has("bins") ? wasteBins : [];

    return (
      <View style={styles.container}>
        {reportsLoading && !mapReady && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={styles.loadingText}>Xarita yuklanmoqda...</Text>
          </View>
        )}

        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          initialRegion={{
            latitude: 41.2995,
            longitude: 69.2401,
            latitudeDelta: 12,
            longitudeDelta: 12,
          }}
          onMapReady={() => setMapReady(true)}
        >
          {/* Reports */}
          {visibleReports.map(report => (
            <Marker
              key={`report-${report.id}`}
              coordinate={{ latitude: report.lat, longitude: report.lng }}
              pinColor={getMarkerColor("reports")}
              onPress={() => handleMarkerPress("report", report)}
            />
          ))}

          {/* Recycling points */}
          {visibleRecycling.map(point => (
            <Marker
              key={`recycle-${point.id}`}
              coordinate={{ latitude: point.lat, longitude: point.lng }}
              pinColor={getMarkerColor(point.type)}
              onPress={() => handleMarkerPress("recycling", point)}
            />
          ))}

          {/* Waste bins */}
          {visibleBins.map(bin => (
            <Marker
              key={`bin-${bin.id}`}
              coordinate={{ latitude: bin.lat, longitude: bin.lng }}
              pinColor={getMarkerColor("bins")}
              onPress={() => handleMarkerPress("bin", bin)}
            />
          ))}
        </MapView>

        {/* Header */}
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
                onPress={() => setShowLayerPanel(v => !v)}
              >
                <Ionicons name="layers" size={20} color={showLayerPanel ? "#fff" : C.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Today's reports pill */}
        {mapReady && todayReports > 0 && !showLayerPanel && (
          <View style={[styles.statsPill, { top: topPad + 64 }]}>
            <Ionicons name="alert-circle" size={13} color="#EF4444" />
            <Text style={styles.statsPillText}>Bugun {todayReports} yangi muammo</Text>
          </View>
        )}

        {/* Layer panel */}
        {showLayerPanel && (
          <View style={[styles.layerPanel, { top: topPad + 60 }]}>
            <Text style={styles.layerPanelTitle}>Xarita qatlamlari</Text>
            <View style={styles.layerGrid}>
              {LAYERS.map(layer => {
                const active = activeLayers.has(layer.id);
                return (
                  <TouchableOpacity
                    key={layer.id}
                    style={[styles.layerChip, active ? { backgroundColor: layer.color } : styles.layerChipInactive]}
                    onPress={() => toggleLayer(layer.id)}
                  >
                    <View style={[styles.layerDot, { backgroundColor: active ? "#fff" : layer.color }]} />
                    <Text style={[styles.layerChipText, active && { color: "#fff" }]}>{layer.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Right controls */}
        <View style={[styles.rightControls, { bottom: bottomPad + 64 }]}>
          {userLocation && (
            <TouchableOpacity style={styles.floatBtn} onPress={centerOnUser}>
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

        {/* Bottom Sheet Popup */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={["40%", "60%"]}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: "#fff" }}
          handleIndicatorStyle={{ backgroundColor: "#D1D5DB" }}
          onClose={() => setSelectedItem(null)}
        >
          <BottomSheetView style={styles.bottomSheetContent}>
            {selectedItem && (
              <>
                {/* Badge row */}
                <View style={styles.popupBadgeRow}>
                  {selectedItem.type === "report" && (
                    <View style={[styles.badge, { backgroundColor: "#FEE2E2" }]}>
                      <Text style={[styles.badgeText, { color: "#DC2626" }]}>
                        {getIssueLabel(selectedItem.data.issue_type)}
                      </Text>
                    </View>
                  )}
                  {selectedItem.type === "recycling" && (
                    <View style={[styles.badge, { backgroundColor: selectedItem.data.type === "paper" ? "#DBEAFE" : selectedItem.data.type === "plastic" ? "#EDE9FE" : "#DCFCE7" }]}>
                      <Text style={[styles.badgeText, { color: getMarkerColor(selectedItem.data.type) }]}>
                        {selectedItem.data.type === "paper" ? "Qog'oz" : selectedItem.data.type === "plastic" ? "Plastik" : "Aralash"}
                      </Text>
                    </View>
                  )}
                  {selectedItem.type === "bin" && (
                    <View style={[styles.badge, { backgroundColor: "#CFFAFE" }]}>
                      <Text style={[styles.badgeText, { color: "#0891B2" }]}>
                        {selectedItem.data.bin_type === "plastic" ? "Plastik quti" : selectedItem.data.bin_type === "paper" ? "Qog'oz quti" : selectedItem.data.bin_type === "glass" ? "Shisha quti" : "Umumiy axlat"}
                      </Text>
                    </View>
                  )}
                  {selectedItem.distance !== undefined && (
                    <View style={[styles.badge, { backgroundColor: "#F3F4F6" }]}>
                      <Text style={[styles.badgeText, { color: "#6B7280" }]}>📍 {formatDistance(selectedItem.distance)} uzoqda</Text>
                    </View>
                  )}
                </View>

                {/* Title and details */}
                {selectedItem.type === "report" && (
                  <>
                    <Text style={styles.popupTitle}>
                      {selectedItem.data.description || getIssueLabel(selectedItem.data.issue_type)}
                    </Text>
                    <Text style={styles.popupSub}>{formatDate(selectedItem.data.created_at)}</Text>
                    <View style={styles.confirmRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                      <Text style={styles.confirmText}>{selectedItem.data.confirmations_count} kishi tasdiqladi</Text>
                    </View>
                  </>
                )}
                {selectedItem.type === "recycling" && (
                  <>
                    <Text style={styles.popupTitle}>{selectedItem.data.name}</Text>
                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.popupAddr}>{selectedItem.data.address}</Text>
                    </View>
                  </>
                )}
                {selectedItem.type === "bin" && (
                  <>
                    <Text style={styles.popupTitle}>{selectedItem.data.name}</Text>
                    <View style={styles.addressRow}>
                      <Ionicons name="location-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.popupAddr}>{selectedItem.data.address}</Text>
                    </View>
                  </>
                )}

                {/* Action buttons */}
                <View style={styles.popupButtons}>
                  <TouchableOpacity style={styles.closeButton} onPress={closeBottomSheet}>
                    <Text style={styles.closeButtonText}>Yopish</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.directionsButton}
                    onPress={() => {
                      closeBottomSheet();
                      openDirections(selectedItem.data.lat, selectedItem.data.lng, selectedItem.data.name || "");
                    }}
                  >
                    <Text style={styles.directionsButtonText}>Yo'nalish</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </BottomSheetView>
        </BottomSheet>
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
    bottomSheetContent: {
      padding: 16,
      gap: 12,
    },
    popupBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    badgeText: {
      fontFamily: "Nunito_600SemiBold",
      fontSize: 12,
    },
    popupTitle: {
      fontFamily: "Nunito_700Bold",
      fontSize: 17,
      color: "#111",
    },
    popupSub: {
      fontFamily: "Nunito_400Regular",
      fontSize: 13,
      color: "#6B7280",
    },
    addressRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 4,
    },
    popupAddr: {
      fontFamily: "Nunito_400Regular",
      fontSize: 12,
      color: "#9CA3AF",
      flex: 1,
    },
    confirmRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "#F0FDF4",
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 12,
      alignSelf: "flex-start",
    },
    confirmText: {
      fontFamily: "Nunito_600SemiBold",
      fontSize: 13,
      color: "#16A34A",
    },
    popupButtons: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    closeButton: {
      flex: 1,
      backgroundColor: "#F3F4F6",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    closeButtonText: {
      fontFamily: "Nunito_600SemiBold",
      fontSize: 14,
      color: "#374151",
    },
    directionsButton: {
      flex: 1,
      backgroundColor: C.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    directionsButtonText: {
      fontFamily: "Nunito_600SemiBold",
      fontSize: 14,
      color: "#fff",
    },
  });