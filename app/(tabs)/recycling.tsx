import React from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import type { RecyclingPoint } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  paper: { label: "Qog'oz", color: "#1565C0", bg: "#E3F2FD", icon: "file-document-outline" },
  plastic: { label: "Plastik", color: "#7B1FA2", bg: "#F3E5F5", icon: "bottle-soda-outline" },
  mixed: { label: "Aralash", color: "#2E7D32", bg: "#E8F5E9", icon: "recycle" },
};

function RecyclingCard({ point }: { point: RecyclingPoint }) {
  const cfg = TYPE_CONFIG[point.type] ?? TYPE_CONFIG.mixed;
  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
        <MaterialCommunityIcons name={cfg.icon as any} size={28} color={cfg.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName}>{point.name}</Text>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={13} color={C.textSecondary} />
          <Text style={styles.addressText}>{point.address}</Text>
        </View>
      </View>
    </View>
  );
}

export default function RecyclingScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: points = [], isLoading } = useQuery<RecyclingPoint[]>({
    queryKey: ["/api/recycling"],
    queryFn: async () => {
      const { data, error } = await supabase.from("recycling_points").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const paper = points.filter((p) => p.type === "paper");
  const plastic = points.filter((p) => p.type === "plastic");
  const mixed = points.filter((p) => p.type === "mixed");

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
        <Text style={styles.headerTitle}>Qayta ishlash</Text>
        <Text style={styles.headerSub}>Yaqin atrofdagi punktlar</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: "#E3F2FD" }]}>
          <Text style={[styles.statNum, { color: "#1565C0" }]}>{paper.length}</Text>
          <Text style={[styles.statLabel, { color: "#1565C0" }]}>Qog'oz</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#F3E5F5" }]}>
          <Text style={[styles.statNum, { color: "#7B1FA2" }]}>{plastic.length}</Text>
          <Text style={[styles.statLabel, { color: "#7B1FA2" }]}>Plastik</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: "#E8F5E9" }]}>
          <Text style={[styles.statNum, { color: "#2E7D32" }]}>{mixed.length}</Text>
          <Text style={[styles.statLabel, { color: "#2E7D32" }]}>Aralash</Text>
        </View>
      </View>

      <FlatList
        data={points}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecyclingCard point={item} />}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="recycle" size={48} color={C.border} />
            <Text style={styles.emptyTitle}>Punktlar yo'q</Text>
            <Text style={styles.emptySub}>Tez orada qo'shiladi</Text>
          </View>
        }
        scrollEnabled={!!points.length}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loadingContainer: { alignItems: "center", justifyContent: "center" },
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
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statNum: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 24,
  },
  statLabel: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 12,
    marginTop: 2,
  },
  list: { paddingHorizontal: 16, gap: 10 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  cardName: {
    fontFamily: "Nunito_700Bold",
    fontSize: 15,
    color: C.text,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  badgeText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 11,
  },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  addressText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    flex: 1,
  },
  empty: { flex: 1, alignItems: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontFamily: "Nunito_700Bold", fontSize: 18, color: C.text },
  emptySub: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary },
});
