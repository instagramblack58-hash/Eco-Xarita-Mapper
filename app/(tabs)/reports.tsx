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
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Report } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

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
  const { user } = useAuth();
  const qc = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        router.push("/auth");
        return;
      }
      const { error } = await supabase.rpc("confirm_report", { report_id: report.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
    },
    onError: (err: any) => {
      Alert.alert("Xato", err.message ?? "Tasdiqlab bo'lmadi");
    },
  });

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.92}
      onPress={() => router.push({ pathname: "/report-detail", params: { id: report.id } })}
    >
      {report.photo_url ? (
        <Image source={{ uri: report.photo_url }} style={styles.cardImage} />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Ionicons name="image-outline" size={32} color={C.border} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardDesc} numberOfLines={2}>{report.description}</Text>
        <Text style={styles.cardTime}>{timeAgo(report.created_at)}</Text>
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={(e) => {
              e.stopPropagation();
              confirmMutation.mutate();
            }}
            disabled={confirmMutation.isPending}
          >
            <Ionicons name="checkmark-circle" size={16} color={C.primary} />
            <Text style={styles.confirmCount}>{report.confirmations_count}</Text>
            <Text style={styles.confirmLabel}>tasdiqlash</Text>
          </TouchableOpacity>
          <View style={styles.locationChip}>
            <Ionicons name="location-outline" size={13} color={C.textSecondary} />
            <Text style={styles.locationText}>
              {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={C.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="alert-outline" size={48} color={C.border} />
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
  headerTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 26,
    color: C.text,
  },
  headerSub: {
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 2,
  },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
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
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: 14 },
  cardDesc: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  cardTime: {
    fontFamily: "Nunito_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    marginBottom: 10,
  },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F5E9",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  confirmCount: {
    fontFamily: "Nunito_700Bold",
    fontSize: 13,
    color: C.primary,
  },
  confirmLabel: {
    fontFamily: "Nunito_400Regular",
    fontSize: 12,
    color: C.primary,
  },
  locationChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 11,
    color: C.textSecondary,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 18,
    color: C.text,
  },
  emptySub: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: C.textSecondary,
  },
});
