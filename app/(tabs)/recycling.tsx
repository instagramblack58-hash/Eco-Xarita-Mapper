import { sh } from "@/constants/shadow";
import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import type { RecyclingPoint, WasteBin, RecyclingType } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

type FilterType = RecyclingType | "bins" | "all";

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  paper: { label: "Qog'oz", color: "#1565C0", bg: "#E3F2FD", icon: "file-document-outline" },
  plastic: { label: "Plastik", color: "#7B1FA2", bg: "#F3E5F5", icon: "bottle-soda-outline" },
  mixed: { label: "Aralash", color: "#2E7D32", bg: "#E8F5E9", icon: "recycle" },
  glass: { label: "Shisha", color: "#D97706", bg: "#FEF3C7", icon: "bottle-wine-outline" },
  hazardous: { label: "Zararli", color: "#374151", bg: "#F3F4F6", icon: "biohazard" },
  bins: { label: "Axlat qutilari", color: "#0891B2", bg: "#CFFAFE", icon: "trash-can-outline" },
};

const BIN_TYPE_LABELS: Record<string, string> = {
  plastic: "Plastik quti",
  paper: "Qog'oz quti",
  glass: "Shisha quti",
  general: "Umumiy axlat",
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function openDirections(lat: number, lng: number, name: string) {
  const url = Platform.select({
    ios: `maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name)}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`,
    default: `https://maps.google.com/?q=${lat},${lng}`,
  });
  if (url) Linking.openURL(url).catch(() => Alert.alert("Xato", "Xarita ilovasi topilmadi"));
}

type ListItem =
  | { kind: "recycling"; data: RecyclingPoint; dist?: number }
  | { kind: "bin"; data: WasteBin; dist?: number };

function ItemCard({ item }: { item: ListItem }) {
  const typeKey = item.kind === "recycling" ? item.data.type : "bins";
  const cfg = TYPE_CONFIG[typeKey] ?? TYPE_CONFIG.mixed;
  const name = item.data.name;
  const address = item.data.address;
  const label =
    item.kind === "recycling"
      ? cfg.label
      : BIN_TYPE_LABELS[(item.data as WasteBin).bin_type] ?? "Axlat qutisi";

  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
        <MaterialCommunityIcons name={cfg.icon as any} size={26} color={cfg.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]}>{label}</Text>
          </View>
        </View>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={12} color={C.textSecondary} />
          <Text style={styles.addressText} numberOfLines={1}>{address}</Text>
        </View>
        {item.dist !== undefined && (
          <Text style={styles.distText}>{formatDist(item.dist)} uzoqda</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.dirBtn}
        onPress={() => openDirections(item.data.lat, item.data.lng, name)}
      >
        <Ionicons name="navigate" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all", label: "Barchasi" },
  { id: "paper", label: "Qog'oz" },
  { id: "plastic", label: "Plastik" },
  { id: "mixed", label: "Aralash" },
  { id: "glass", label: "Shisha" },
  { id: "hazardous", label: "Zararli" },
  { id: "bins", label: "Qutilari" },
];

export default function RecyclingScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);

  const { data: points = [], isLoading } = useQuery<RecyclingPoint[]>({
    queryKey: ["/api/recycling"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recycling_points").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bins = [] } = useQuery<WasteBin[]>({
    queryKey: ["/api/waste_bins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("waste_bins").select("*");
      if (error) return [];
      return data ?? [];
    },
  });

  const getUserLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Ruxsat yo'q", "Joylashuv uchun ruxsat berilmadi");
        setLocLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      Alert.alert("Xato", "Joylashuv aniqlanmadi");
    }
    setLocLoading(false);
  };

  const allItems = useMemo<ListItem[]>(() => {
    const recyclingItems: ListItem[] = points.map((p) => ({
      kind: "recycling",
      data: p,
      dist: userLoc ? haversineKm(userLoc.lat, userLoc.lng, p.lat, p.lng) : undefined,
    }));
    const binItems: ListItem[] = bins.map((b) => ({
      kind: "bin",
      data: b,
      dist: userLoc ? haversineKm(userLoc.lat, userLoc.lng, b.lat, b.lng) : undefined,
    }));
    let merged: ListItem[] = [...recyclingItems, ...binItems];

    if (filter !== "all") {
      merged = merged.filter((item) => {
        if (filter === "bins") return item.kind === "bin";
        return item.kind === "recycling" && item.data.type === filter;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      merged = merged.filter(
        (item) =>
          item.data.name.toLowerCase().includes(q) ||
          item.data.address.toLowerCase().includes(q)
      );
    }

    if (userLoc) {
      merged.sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));
    }

    return merged;
  }, [points, bins, filter, search, userLoc]);

  const counts = useMemo(() => {
    return {
      paper: points.filter((p) => p.type === "paper").length,
      plastic: points.filter((p) => p.type === "plastic").length,
      mixed: points.filter((p) => p.type === "mixed").length,
      glass: points.filter((p) => p.type === "glass").length,
      hazardous: points.filter((p) => p.type === "hazardous").length,
      bins: bins.length,
    };
  }, [points, bins]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Qayta ishlash</Text>
            <Text style={styles.headerSub}>{allItems.length} ta punkt</Text>
          </View>
          <TouchableOpacity style={styles.locBtn} onPress={getUserLocation} disabled={locLoading}>
            {locLoading ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <Ionicons name={userLoc ? "locate" : "locate-outline"} size={20} color={userLoc ? C.primary : C.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={C.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nom yoki manzil bo'yicha qidiring..."
            placeholderTextColor={C.border}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={C.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats mini row */}
      <FlatList
        horizontal
        data={[
          { key: "paper", num: counts.paper, color: "#1565C0", bg: "#E3F2FD", label: "Qog'oz" },
          { key: "plastic", num: counts.plastic, color: "#7B1FA2", bg: "#F3E5F5", label: "Plastik" },
          { key: "mixed", num: counts.mixed, color: "#2E7D32", bg: "#E8F5E9", label: "Aralash" },
          { key: "glass", num: counts.glass, color: "#D97706", bg: "#FEF3C7", label: "Shisha" },
          { key: "hazardous", num: counts.hazardous, color: "#374151", bg: "#F3F4F6", label: "Zararli" },
          { key: "bins", num: counts.bins, color: "#0891B2", bg: "#CFFAFE", label: "Qutilari" },
        ]}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={[styles.statChip, { backgroundColor: item.bg }]}>
            <Text style={[styles.statNum, { color: item.color }]}>{item.num}</Text>
            <Text style={[styles.statLabel, { color: item.color }]}>{item.label}</Text>
          </View>
        )}
        contentContainerStyle={styles.statRow}
        showsHorizontalScrollIndicator={false}
      />

      {/* Filter tabs */}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterTab, filter === item.id && styles.filterTabActive]}
            onPress={() => setFilter(item.id)}
          >
            <Text style={[styles.filterTabText, filter === item.id && styles.filterTabTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.filterRow}
        showsHorizontalScrollIndicator={false}
      />

      <FlatList
        data={allItems}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        renderItem={({ item }) => <ItemCard item={item} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="recycle" size={48} color={C.border} />
            <Text style={styles.emptyTitle}>Natija topilmadi</Text>
            <Text style={styles.emptySub}>Qidiruv yoki filterni o'zgartiring</Text>
          </View>
        }
        scrollEnabled={!!allItems.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loadingContainer: { alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: C.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: C.text },
  headerSub: { fontFamily: "Nunito_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  locBtn: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: C.text,
  },
  statRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  statChip: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 72,
  },
  statNum: { fontFamily: "Nunito_800ExtraBold", fontSize: 18 },
  statLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 11, marginTop: 2 },
  filterRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  filterTabActive: { backgroundColor: C.primary },
  filterTabText: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.textSecondary },
  filterTabTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    ...sh.sm,
  },
  iconBox: {
    width: 50, height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 3 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardName: { fontFamily: "Nunito_700Bold", fontSize: 14, color: C.text, flex: 1, marginRight: 6 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontFamily: "Nunito_600SemiBold", fontSize: 11 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  addressText: { fontFamily: "Nunito_400Regular", fontSize: 12, color: C.textSecondary, flex: 1 },
  distText: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: C.primary },
  dirBtn: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontFamily: "Nunito_700Bold", fontSize: 18, color: C.text },
  emptySub: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary },
});
