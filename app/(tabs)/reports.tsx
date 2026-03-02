import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
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
  illegal_dumping: { label: "Noqonuniy axlat", color: "#DC2626", bg: "#FEE2E2", icon: "trash-outline" },
  tree_cutting: { label: "Daraxt kesish", color: "#16A34A", bg: "#DCFCE7", icon: "leaf-outline" },
  water_pollution: { label: "Suv ifloslanishi", color: "#2563EB", bg: "#DBEAFE", icon: "water-outline" },
  air_pollution: { label: "Havo ifloslanishi", color: "#7C3AED", bg: "#EDE9FE", icon: "cloud-outline" },
  other: { label: "Boshqa muammo", color: "#D97706", bg: "#FEF3C7", icon: "alert-circle-outline" },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "Hozir";
  if (diff < 3600) return `${Math.floor(diff / 60)} daqiqa oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  return `${Math.floor(diff / 86400)} kun oldin`;
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
          <Ionicons name={cfg.icon as any} size={36} color={cfg.color} />
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.cardTime}>{timeAgo(report.created_at)}</Text>
        </View>
        {!!report.description && report.description !== cfg.label && (
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
            <Text style={styles.locationText}>
              {report.lat.toFixed(3)}, {report.lng.toFixed(3)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ["/api/reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["/api/reports"] });
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Muammolar</Text>
        <Text style={styles.headerSub}>{reports.length} ta xabar</Text>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReportCard report={item} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={52} color={C.border} />
            <Text style={styles.emptyTitle}>Muammolar yo'q</Text>
            <Text style={styles.emptySub}>Birinchi bo'lib xabar bering!</Text>
          </View>
        }
        scrollEnabled={!!reports.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  headerTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: C.text },
  headerSub: { fontFamily: "Nunito_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: { width: "100%", height: 160 },
  cardImagePlaceholder: {
    width: "100%",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: 14, gap: 8 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontFamily: "Nunito_600SemiBold", fontSize: 11 },
  cardTime: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  cardDesc: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
  },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  confirmChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F5E9",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  confirmCount: { fontFamily: "Nunito_700Bold", fontSize: 12, color: C.primary },
  confirmLabel: { fontFamily: "Nunito_400Regular", fontSize: 12, color: C.primary },
  locationChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontFamily: "Nunito_700Bold", fontSize: 18, color: C.text },
  emptySub: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary },
});
