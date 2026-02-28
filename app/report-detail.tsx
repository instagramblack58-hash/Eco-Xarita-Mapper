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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Report } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function ReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: report, isLoading } = useQuery<Report>({
    queryKey: ["/api/reports", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        router.push("/auth");
        return;
      }
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

  const date = new Date(report.created_at).toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Muammo tafsiloti</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 },
        ]}
      >
        {/* Photo */}
        {report.photo_url ? (
          <Image source={{ uri: report.photo_url }} style={styles.photo} />
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="image-outline" size={48} color={C.border} />
            <Text style={styles.noPhotoText}>Rasm yo'q</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Confirmation badge */}
          <View style={styles.confirmRow}>
            <View style={styles.confirmBadge}>
              <Ionicons name="checkmark-circle" size={18} color={C.primary} />
              <Text style={styles.confirmNum}>{report.confirmations_count}</Text>
              <Text style={styles.confirmLabel}>ta tasdiqlash</Text>
            </View>
            <Text style={styles.dateText}>{date}</Text>
          </View>

          {/* Description */}
          <Text style={styles.sectionTitle}>Muammo tavsifi</Text>
          <Text style={styles.description}>{report.description}</Text>

          {/* Location */}
          <Text style={styles.sectionTitle}>Joylashuv</Text>
          <View style={styles.locationBox}>
            <Ionicons name="location" size={16} color={C.primary} />
            <Text style={styles.locationText}>
              {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
            </Text>
          </View>

          {/* Confirm button */}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 17,
    color: C.text,
  },
  scroll: { flexGrow: 1 },
  photo: { width: "100%", height: 240 },
  noPhoto: {
    width: "100%",
    height: 160,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  noPhotoText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: C.textSecondary,
  },
  content: { padding: 20, gap: 16 },
  confirmRow: {
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
  confirmNum: {
    fontFamily: "Nunito_700Bold",
    fontSize: 14,
    color: C.primary,
  },
  confirmLabel: {
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    color: C.primary,
  },
  dateText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    color: C.textSecondary,
  },
  sectionTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 15,
    color: C.text,
  },
  description: {
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    color: C.text,
    lineHeight: 24,
  },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 10,
  },
  locationText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    color: C.text,
  },
  confirmBtn: {
    backgroundColor: C.primary,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    color: "#fff",
  },
});
