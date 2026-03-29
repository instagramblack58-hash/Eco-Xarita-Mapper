import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import type { Report, IssueType } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const ISSUE_CONFIG: Record<IssueType, { label: string; color: string; bg: string; icon: string }> = {
  illegal_dumping: { label: "Noqonuniy axlat", color: "#EF4444", bg: "#FEE2E2", icon: "trash-outline" },
  tree_cutting: { label: "Daraxt kesish", color: "#16A34A", bg: "#DCFCE7", icon: "leaf-outline" },
  water_pollution: { label: "Suv ifloslanishi", color: "#2563EB", bg: "#DBEAFE", icon: "water-outline" },
  air_pollution: { label: "Havo ifloslanishi", color: "#7C3AED", bg: "#EDE9FE", icon: "cloud-outline" },
  other: { label: "Boshqa muammo", color: "#D97706", bg: "#FEF3C7", icon: "alert-circle-outline" },
};

const SORT_OPTIONS = [
  { id: "newest", label: "Yangi" },
  { id: "oldest", label: "Eski" },
  { id: "confirmed", label: "Tasdiqlangan" },
];

type SortId = "newest" | "oldest" | "confirmed";

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Hozir";
  if (diff < 3600) return `${Math.floor(diff / 60)} daq oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} kun oldin`;
  return new Date(dateStr).toLocaleDateString("uz-UZ");
}

function ReportCard({ report }: { report: Report }) {
  const issueKey = (report.issue_type ?? "other") as IssueType;
  const cfg = ISSUE_CONFIG[issueKey] ?? ISSUE_CONFIG.other;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.92}
      onPress={() => router.push({ pathname: "/report-detail", params: { id: report.id } })}
    >
      {report.photo_url ? (
        <Image source={{ uri: report.photo_url }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImagePlaceholder, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={34} color={cfg.color} />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.cardTime}>{timeAgo(report.created_at)}</Text>
        </View>
        {!!report.description && (
          <Text style={styles.cardDesc} numberOfLines={2}>{report.description}</Text>
        )}
        <View style={styles.cardFooter}>
          <View style={styles.confirmChip}>
            <Ionicons name="checkmark-circle" size={14} color={C.primary} />
            <Text style={styles.confirmCount}>{report.confirmations_count}</Text>
            <Text style={styles.confirmLabel}>tasdiqlash</Text>
          </View>
          <View style={styles.locationChip}>
            <Ionicons name="location-outline" size={12} color={C.textSecondary} />
            <Text style={styles.locationText}>{report.lat.toFixed(3)}, {report.lng.toFixed(3)}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.border} style={styles.chevron} />
    </TouchableOpacity>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortId>("newest");
  const [refreshing, setRefreshing] = useState(false);

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ["/api/reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["/api/reports"] });
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    let list = [...reports];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.description ?? "").toLowerCase().includes(q) ||
          (r.issue_type ?? "").toLowerCase().includes(q)
      );
    }
    if (sort === "oldest") list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sort === "confirmed") list.sort((a, b) => b.confirmations_count - a.confirmations_count);
    else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list;
  }, [reports, search, sort]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return reports.filter((r) => new Date(r.created_at).toDateString() === today).length;
  }, [reports]);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Muammolar</Text>
            <Text style={styles.headerSub}>{filtered.length} ta xabar{todayCount > 0 ? ` • bugun ${todayCount} ta yangi` : ""}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/report-modal")}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={C.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Muammo yoki manzil qidiring..."
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

        {/* Sort options */}
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.sortBtn, sort === opt.id && styles.sortBtnActive]}
              onPress={() => setSort(opt.id as SortId)}
            >
              <Text style={[styles.sortText, sort === opt.id && styles.sortTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReportCard report={item} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={56} color={C.border} />
              <Text style={styles.emptyTitle}>
                {search ? "Natija topilmadi" : "Hali muammolar yo'q"}
              </Text>
              <Text style={styles.emptySub}>
                {search ? "Qidiruv so'rovini o'zgartiring" : "Birinchi muammoni xabarlang!"}
              </Text>
              {!search && (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push("/report-modal")}
                >
                  <Text style={styles.emptyBtnText}>Muammo xabari yuborish</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: C.text },
  headerSub: { fontFamily: "Nunito_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  addBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Nunito_400Regular",
    fontSize: 14, color: C.text,
  },
  sortRow: { flexDirection: "row", gap: 8 },
  sortBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: "#F3F4F6",
  },
  sortBtnActive: { backgroundColor: C.primary },
  sortText: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.textSecondary },
  sortTextActive: { color: "#fff" },
  list: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: { width: 80, height: 80, resizeMode: "cover" },
  cardImagePlaceholder: {
    width: 80, height: 80,
    alignItems: "center", justifyContent: "center",
  },
  cardBody: { flex: 1, padding: 12, gap: 5 },
  badgeRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontFamily: "Nunito_600SemiBold", fontSize: 11 },
  cardTime: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  cardDesc: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.text, lineHeight: 18 },
  cardFooter: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
  },
  confirmChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
  },
  confirmCount: { fontFamily: "Nunito_700Bold", fontSize: 12, color: C.primary },
  confirmLabel: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  locationChip: { flexDirection: "row", alignItems: "center", gap: 2 },
  locationText: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  chevron: { marginRight: 10 },
  empty: {
    alignItems: "center", paddingTop: 80, gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontFamily: "Nunito_700Bold", fontSize: 18, color: C.text, textAlign: "center" },
  emptySub: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center" },
  emptyBtn: {
    marginTop: 8, backgroundColor: C.primary,
    paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyBtnText: { fontFamily: "Nunito_700Bold", fontSize: 14, color: "#fff" },
});
