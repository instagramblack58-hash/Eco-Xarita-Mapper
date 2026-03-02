import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Report, IssueType } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const ISSUE_CONFIG: Record<IssueType, { label: string; color: string; bg: string; icon: string }> = {
  illegal_dumping: { label: "Noqonuniy axlat tashlash", color: "#DC2626", bg: "#FEE2E2", icon: "trash-outline" },
  tree_cutting: { label: "Daraxt kesish", color: "#16A34A", bg: "#DCFCE7", icon: "leaf-outline" },
  water_pollution: { label: "Suv ifloslanishi", color: "#2563EB", bg: "#DBEAFE", icon: "water-outline" },
  air_pollution: { label: "Havo ifloslanishi", color: "#7C3AED", bg: "#EDE9FE", icon: "cloud-outline" },
  other: { label: "Boshqa muammo", color: "#D97706", bg: "#FEF3C7", icon: "alert-circle-outline" },
};

export default function ReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: report, isLoading } = useQuery<Report>({
    queryKey: ["/api/reports", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!user) { router.push("/auth"); return; }
      const { error } = await supabase.rpc("confirm_report", { report_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
      qc.invalidateQueries({ queryKey: ["/api/reports", id] });
    },
    onError: (err: any) => {
      Alert.alert("Xato", err.message);
    },
  });

  const handleShare = async () => {
    try {
      const issLabel = report
        ? (ISSUE_CONFIG[(report.issue_type ?? "other") as IssueType]?.label ?? "Muammo")
        : "Muammo";
      await Share.share({
        message: report
          ? `Eco-Xarita muammo: ${report.description || issLabel} — joylashuv: ${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`
          : "Eco-Xarita muammo xabari",
        title: "Eco-Xarita",
      });
    } catch {}
  };

  const openMaps = () => {
    if (!report) return;
    const url = Platform.select({
      ios: `maps://maps.apple.com/?daddr=${report.lat},${report.lng}`,
      android: `geo:${report.lat},${report.lng}?q=${report.lat},${report.lng}`,
      default: `https://maps.google.com/?q=${report.lat},${report.lng}`,
    });
    if (url) Linking.openURL(url).catch(() => {});
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.loading, { paddingTop: topPad }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.loading, { paddingTop: topPad }]}>
        <Text style={styles.errorText}>Muammo topilmadi</Text>
      </View>
    );
  }

  const issueKey = (report.issue_type ?? "other") as IssueType;
  const cfg = ISSUE_CONFIG[issueKey] ?? ISSUE_CONFIG.other;
  const date = new Date(report.created_at).toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Muammo tafsiloti</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 },
        ]}
      >
        {report.photo_url ? (
          <Image source={{ uri: report.photo_url }} style={styles.photo} />
        ) : (
          <View style={[styles.noPhoto, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={56} color={cfg.color} />
          </View>
        )}

        <View style={styles.content}>
          {/* Issue type badge */}
          <View style={[styles.issueBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
            <Text style={[styles.issueLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>

          {/* Meta row */}
          <View style={styles.metaRow}>
            <View style={styles.confirmBadge}>
              <Ionicons name="checkmark-circle" size={16} color={C.primary} />
              <Text style={styles.confirmNum}>{report.confirmations_count}</Text>
              <Text style={styles.confirmMeta}>ta tasdiqlash</Text>
            </View>
            <Text style={styles.dateText}>{date}</Text>
          </View>

          {/* Description */}
          {!!report.description && (
            <>
              <Text style={styles.sectionTitle}>Muammo tavsifi</Text>
              <Text style={styles.description}>{report.description}</Text>
            </>
          )}

          {/* Location */}
          <Text style={styles.sectionTitle}>Joylashuv</Text>
          <TouchableOpacity style={styles.locationBox} onPress={openMaps} activeOpacity={0.8}>
            <Ionicons name="location" size={18} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationCoords}>{report.lat.toFixed(5)}, {report.lng.toFixed(5)}</Text>
              <Text style={styles.locationHint}>Xaritada ko'rish uchun bosing</Text>
            </View>
            <Ionicons name="navigate-outline" size={16} color={C.primary} />
          </TouchableOpacity>

          {/* Actions */}
          <TouchableOpacity
            style={[styles.confirmBtn, confirmMutation.isPending && { opacity: 0.7 }]}
            onPress={() => {
              if (!user) {
                Alert.alert("Kirish kerak", "Tasdiqlash uchun tizimga kiring", [
                  { text: "Kirish", onPress: () => router.push("/auth") },
                  { text: "Bekor qilish", style: "cancel" },
                ]);
              } else {
                confirmMutation.mutate();
              }
            }}
            disabled={confirmMutation.isPending}
            activeOpacity={0.85}
          >
            {confirmMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.confirmBtnText}>Tasdiqlash</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Comments placeholder */}
          <View style={styles.commentsPlaceholder}>
            <Ionicons name="chatbubble-outline" size={20} color={C.textSecondary} />
            <Text style={styles.commentsText}>Izohlar tez orada qo'shiladi</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontFamily: "Nunito_600SemiBold", fontSize: 16, color: C.textSecondary },
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
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontFamily: "Nunito_700Bold", fontSize: 17, color: C.text },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  scroll: { flexGrow: 1 },
  photo: { width: "100%", height: 260 },
  noPhoto: {
    width: "100%", height: 160,
    alignItems: "center", justifyContent: "center",
  },
  content: { padding: 20, gap: 14 },
  issueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  issueLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 13 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confirmBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8F5E9",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  confirmNum: { fontFamily: "Nunito_700Bold", fontSize: 14, color: C.primary },
  confirmMeta: { fontFamily: "Nunito_400Regular", fontSize: 13, color: C.primary },
  dateText: { fontFamily: "Nunito_400Regular", fontSize: 13, color: C.textSecondary },
  sectionTitle: { fontFamily: "Nunito_700Bold", fontSize: 15, color: C.text },
  description: {
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    color: C.text,
    lineHeight: 24,
  },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  locationCoords: { fontFamily: "Nunito_600SemiBold", fontSize: 14, color: C.text },
  locationHint: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  confirmBtn: {
    backgroundColor: C.primary,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: { fontFamily: "Nunito_700Bold", fontSize: 16, color: "#fff" },
  commentsPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  commentsText: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary },
});
