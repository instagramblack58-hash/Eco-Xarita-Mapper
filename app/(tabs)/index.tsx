import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Report } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const ISSUE_LABELS: Record<string, string> = {
  illegal_dumping: "Noqonuniy axlat",
  tree_cutting: "Daraxt kesish",
  water_pollution: "Suv ifloslanishi",
  air_pollution: "Havo ifloslanishi",
  other: "Boshqa muammo",
};

const ISSUE_COLORS: Record<string, { color: string; bg: string }> = {
  illegal_dumping: { color: "#DC2626", bg: "#FEE2E2" },
  tree_cutting:    { color: "#16A34A", bg: "#DCFCE7" },
  water_pollution: { color: "#2563EB", bg: "#DBEAFE" },
  air_pollution:   { color: "#7C3AED", bg: "#EDE9FE" },
  other:           { color: "#D97706", bg: "#FEF3C7" },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Hozir";
  if (diff < 3600) return `${Math.floor(diff / 60)} daq oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  return `${Math.floor(diff / 86400)} kun oldin`;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const topPad = 67;
  const bottomPad = 34 + 84;

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const todayReports = reports.filter(
    r => new Date(r.created_at).toDateString() === new Date().toDateString()
  ).length;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="leaf" size={22} color={C.primary} />
          <Text style={styles.appName}>Eco-Xarita</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/report-modal")}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Info banner */}
      <View style={styles.banner}>
        <Ionicons name="phone-portrait-outline" size={32} color={C.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Interaktiv xarita</Text>
          <Text style={styles.bannerSub}>
            To'liq xaritani ko'rish uchun Expo Go ilovasida oching
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.statNum}>{reports.length}</Text>
          <Text style={styles.statLabel}>Jami xabarlar</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="today" size={20} color={C.primary} />
          <Text style={styles.statNum}>{todayReports}</Text>
          <Text style={styles.statLabel}>Bugun</Text>
        </View>
      </View>

      {/* Recent reports */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>So'nggi muammolar</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/reports")}>
          <Text style={styles.sectionLink}>Barchasi</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <Text style={styles.loadingText}>Yuklanmoqda...</Text>
        ) : reports.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={C.border} />
            <Text style={styles.emptyTitle}>Hali muammolar yo'q</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/report-modal")}>
              <Text style={styles.emptyBtnText}>Birinchi muammoni xabarlang</Text>
            </TouchableOpacity>
          </View>
        ) : (
          reports.map(report => {
            const key = (report.issue_type ?? "other") as string;
            const cfg = ISSUE_COLORS[key] ?? ISSUE_COLORS.other;
            const label = ISSUE_LABELS[key] ?? "Muammo";
            return (
              <TouchableOpacity
                key={report.id}
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => router.push({ pathname: "/report-detail", params: { id: report.id } })}
              >
                <View style={[styles.cardDot, { backgroundColor: cfg.bg }]}>
                  <Ionicons name="alert-circle" size={20} color={cfg.color} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.badgeText, { color: cfg.color }]}>{label}</Text>
                    </View>
                    <Text style={styles.cardTime}>{timeAgo(report.created_at)}</Text>
                  </View>
                  {!!report.description && (
                    <Text style={styles.cardDesc} numberOfLines={2}>{report.description}</Text>
                  )}
                  <View style={styles.cardFooter}>
                    <Ionicons name="checkmark-circle" size={13} color={C.primary} />
                    <Text style={styles.cardConfirm}>{report.confirmations_count} tasdiq</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.border} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 84 + 20 }]}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  appName: { fontFamily: "Nunito_800ExtraBold", fontSize: 20, color: C.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    margin: 14,
    padding: 14,
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  bannerTitle: { fontFamily: "Nunito_700Bold", fontSize: 14, color: C.text },
  bannerSub: { fontFamily: "Nunito_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNum: { fontFamily: "Nunito_800ExtraBold", fontSize: 22, color: C.text },
  statLabel: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: { fontFamily: "Nunito_700Bold", fontSize: 16, color: C.text },
  sectionLink: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.primary },
  list: { paddingHorizontal: 14, gap: 10 },
  loadingText: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", marginTop: 40 },
  empty: { alignItems: "center", paddingTop: 36, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: "Nunito_700Bold", fontSize: 16, color: C.text },
  emptyBtn: { backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { fontFamily: "Nunito_700Bold", fontSize: 14, color: "#fff" },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardDot: {
    width: 44, height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 4 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontFamily: "Nunito_600SemiBold", fontSize: 11 },
  cardTime: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  cardDesc: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.text },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardConfirm: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  fab: {
    position: "absolute",
    right: 16,
    width: 56, height: 56, borderRadius: 28,
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
