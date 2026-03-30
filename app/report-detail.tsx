import { sh } from "@/constants/shadow";
import React, { useState, useRef } from "react";
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
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, confirmReport, incrementEcoScore, getComments, addComment } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Report, IssueType, ReportComment } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const ISSUE_CONFIG: Record<IssueType, { label: string; color: string; bg: string; icon: string }> = {
  illegal_dumping: { label: "Noqonuniy axlat tashlash", color: "#DC2626", bg: "#FEE2E2", icon: "trash-outline" },
  tree_cutting:    { label: "Daraxt kesish",             color: "#16A34A", bg: "#DCFCE7", icon: "leaf-outline" },
  water_pollution: { label: "Suv ifloslanishi",           color: "#2563EB", bg: "#DBEAFE", icon: "water-outline" },
  air_pollution:   { label: "Havo ifloslanishi",          color: "#7C3AED", bg: "#EDE9FE", icon: "cloud-outline" },
  other:           { label: "Boshqa muammo",              color: "#D97706", bg: "#FEF3C7", icon: "alert-circle-outline" },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Hozir";
  if (diff < 3600) return `${Math.floor(diff / 60)} daq oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} kun oldin`;
  return new Date(dateStr).toLocaleDateString("uz-UZ");
}

export default function ReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const { data: report, isLoading } = useQuery<Report>({
    queryKey: ["/api/reports", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: comments = [], refetch: refetchComments } = useQuery<ReportComment[]>({
    queryKey: ["/api/comments", id],
    queryFn: () => getComments(id),
    enabled: !!id,
    staleTime: 15_000,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!user) { router.push("/auth"); return; }
      await confirmReport(id, user.id);
      await incrementEcoScore(user.id, 1);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/reports"] });
      qc.invalidateQueries({ queryKey: ["/api/reports", id] });
      Alert.alert("Muvaffaqiyatli", "Hisobot tasdiqlandi! +1 ball");
    },
    onError: (err: any) => {
      Alert.alert("Xato", err.message ?? "Allaqachon tasdiqlangan bo'lishi mumkin");
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Tizimga kiring");
      const authorName = profile?.full_name ?? user.email?.split("@")[0] ?? "Foydalanuvchi";
      const { error } = await addComment(id, user.id, commentText, authorName);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setCommentText("");
      refetchComments();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    },
    onError: (err: any) => {
      Alert.alert("Xato", err.message);
    },
  });

  const handleSendComment = () => {
    if (!user) {
      Alert.alert("Kirish kerak", "Izoh qoldirish uchun tizimga kiring", [
        { text: "Kirish", onPress: () => router.push("/auth") },
        { text: "Bekor qilish", style: "cancel" },
      ]);
      return;
    }
    if (!commentText.trim()) return;
    commentMutation.mutate();
  };

  const handleShare = async () => {
    try {
      const issLabel = report
        ? (ISSUE_CONFIG[(report.issue_type ?? "other") as IssueType]?.label ?? "Muammo")
        : "Muammo";
      await Share.share({
        message: report
          ? `Eco-Xarita: ${report.description || issLabel} — joylashuv: ${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`
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
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

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
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
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
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 80 }]}
      >
        {report.photo_url ? (
          <Image source={{ uri: report.photo_url }} style={styles.photo} />
        ) : (
          <View style={[styles.noPhoto, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={56} color={cfg.color} />
          </View>
        )}

        <View style={styles.content}>
          <View style={[styles.issueBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
            <Text style={[styles.issueLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.confirmBadge}>
              <Ionicons name="checkmark-circle" size={16} color={C.primary} />
              <Text style={styles.confirmNum}>{report.confirmations_count}</Text>
              <Text style={styles.confirmMeta}> ta tasdiqlash</Text>
            </View>
            <Text style={styles.dateText}>{date}</Text>
          </View>

          {!!report.description && (
            <>
              <Text style={styles.sectionTitle}>Muammo tavsifi</Text>
              <Text style={styles.description}>{report.description}</Text>
            </>
          )}

          <Text style={styles.sectionTitle}>Joylashuv</Text>
          <TouchableOpacity style={styles.locationBox} onPress={openMaps} activeOpacity={0.8}>
            <Ionicons name="location" size={18} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationCoords}>{report.lat.toFixed(5)}, {report.lng.toFixed(5)}</Text>
              <Text style={styles.locationHint}>Xaritada ko'rish uchun bosing</Text>
            </View>
            <Ionicons name="navigate-outline" size={16} color={C.primary} />
          </TouchableOpacity>

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
                <Text style={styles.confirmBtnText}>Tasdiqlash (+1 ball)</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Comments section */}
          <Text style={styles.sectionTitle}>
            💬 Izohlar {comments.length > 0 ? `(${comments.length})` : ""}
          </Text>

          {comments.length === 0 ? (
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubble-outline" size={28} color={C.border} />
              <Text style={styles.emptyCommentsText}>Hali izoh yo'q. Birinchi bo'ling!</Text>
            </View>
          ) : (
            <View style={styles.commentList}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentItem}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {(c.author_name ?? "F").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>
                        {c.author_name ?? "Foydalanuvchi"}
                      </Text>
                      <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Comment input */}
      <View style={[styles.commentInputBar, { paddingBottom: bottomPad > 0 ? bottomPad : 12 }]}>
        <TextInput
          style={styles.commentInput}
          placeholder={user ? "Izoh yozing..." : "Izoh qoldirish uchun kiring"}
          placeholderTextColor={C.border}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSendComment}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!commentText.trim() || commentMutation.isPending) && { opacity: 0.4 },
          ]}
          onPress={handleSendComment}
          disabled={!commentText.trim() || commentMutation.isPending}
        >
          {commentMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { fontFamily: "Nunito_600SemiBold", fontSize: 16, color: C.textSecondary },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Nunito_700Bold", fontSize: 17, color: C.text },
  shareBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  scroll: { flexGrow: 1 },
  photo: { width: "100%", height: 260 },
  noPhoto: { width: "100%", height: 160, alignItems: "center", justifyContent: "center" },

  content: { padding: 20, gap: 14 },
  issueBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  issueLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  confirmBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#E8F5E9", paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20,
  },
  confirmNum: { fontFamily: "Nunito_700Bold", fontSize: 14, color: C.primary },
  confirmMeta: { fontFamily: "Nunito_400Regular", fontSize: 13, color: C.primary },
  dateText: { fontFamily: "Nunito_400Regular", fontSize: 13, color: C.textSecondary },
  sectionTitle: { fontFamily: "Nunito_700Bold", fontSize: 15, color: C.text },
  description: { fontFamily: "Nunito_400Regular", fontSize: 15, color: C.text, lineHeight: 24 },
  locationBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F9FAFB", padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
  },
  locationCoords: { fontFamily: "Nunito_600SemiBold", fontSize: 14, color: C.text },
  locationHint: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
  confirmBtn: {
    backgroundColor: C.primary, height: 52, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    ...sh.green,
  },
  confirmBtnText: { fontFamily: "Nunito_700Bold", fontSize: 16, color: "#fff" },

  emptyComments: {
    alignItems: "center", paddingVertical: 24, gap: 8,
    backgroundColor: "#F9FAFB", borderRadius: 12,
  },
  emptyCommentsText: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary },

  commentList: { gap: 12 },
  commentItem: { flexDirection: "row", gap: 10 },
  commentAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  commentAvatarText: { fontFamily: "Nunito_700Bold", fontSize: 14, color: "#fff" },
  commentBody: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 10, gap: 4 },
  commentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  commentAuthor: { fontFamily: "Nunito_700Bold", fontSize: 12, color: C.text },
  commentTime: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  commentText: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.text, lineHeight: 20 },

  commentInputBar: {
    flexDirection: "row", alignItems: "flex-end",
    gap: 8, paddingHorizontal: 14, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  commentInput: {
    flex: 1, minHeight: 44, maxHeight: 100,
    backgroundColor: "#F3F4F6", borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: "Nunito_400Regular", fontSize: 14, color: C.text,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
    ...sh.green,
  },
});
