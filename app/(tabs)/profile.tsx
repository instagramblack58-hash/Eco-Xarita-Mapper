import { sh } from "@/constants/shadow";
import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const LEVELS = [
  { min: 0,    max: 99,   title: "Eko-boshlovchi",     color: "#9CA3AF", icon: "🌱" },
  { min: 100,  max: 499,  title: "Eko-faol",            color: "#10B981", icon: "🌿" },
  { min: 500,  max: 999,  title: "Tabiat himoyachisi",  color: "#3B82F6", icon: "🌊" },
  { min: 1000, max: 4999, title: "Yashil elchi",        color: "#8B5CF6", icon: "🦋" },
  { min: 5000, max: Infinity, title: "Eko-qahramon",   color: "#F59E0B", icon: "🏆" },
];

type Achievement = { id: string; icon: string; title: string; desc: string; unlocked: boolean };

function getLevel(score: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (score >= LEVELS[i].min) {
      const next = LEVELS[i + 1];
      const progress = next
        ? Math.min(1, (score - LEVELS[i].min) / (next.min - LEVELS[i].min))
        : 1;
      return { ...LEVELS[i], progress, nextMin: next?.min ?? score, nextTitle: next?.title };
    }
  }
  return { ...LEVELS[0], progress: 0, nextMin: LEVELS[1].min, nextTitle: LEVELS[1].title };
}

function getAchievements(reportCount: number, totalConfirm: number, score: number): Achievement[] {
  return [
    { id: "first",      icon: "📝", title: "Birinchi qadam",   desc: "Birinchi muammo xabarini yubordi",    unlocked: reportCount >= 1 },
    { id: "reporter5",  icon: "🔍", title: "Ishtirokchi",      desc: "5 ta muammo xabari yubordi",          unlocked: reportCount >= 5 },
    { id: "reporter20", icon: "📊", title: "Faol ishtirokchi", desc: "20 ta muammo xabari yubordi",         unlocked: reportCount >= 20 },
    { id: "confirm10",  icon: "✅", title: "Tasdiqlangan",     desc: "10 ta tasdiqlash oldi",               unlocked: totalConfirm >= 10 },
    { id: "confirm50",  icon: "🏅", title: "Ishonchli",        desc: "50 ta tasdiqlash oldi",               unlocked: totalConfirm >= 50 },
    { id: "eco100",     icon: "🌿", title: "Eko-faol",         desc: "100 ball to'pladi",                   unlocked: score >= 100 },
    { id: "eco1000",    icon: "🏆", title: "Eko-qahramon",     desc: "1000 ball to'pladi",                  unlocked: score >= 1000 },
  ];
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, refreshProfile, updateName } = useAuth();
  const [loadingSignOut, setLoadingSignOut] = useState(false);
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: myReports = [] } = useQuery({
    queryKey: ["/api/my-reports", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["/api/leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, eco_score, full_name")
        .order("eco_score", { ascending: false })
        .limit(5);
      if (error) return [];
      return data ?? [];
    },
    staleTime: 120_000,
  });

  const totalConfirmations = useMemo(
    () => myReports.reduce((a: number, r: any) => a + (r.confirmations_count ?? 0), 0),
    [myReports]
  );

  const ecoScore = profile?.eco_score ?? 0;
  const levelInfo = getLevel(ecoScore);
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Foydalanuvchi";
  const achievements = useMemo(
    () => getAchievements(myReports.length, totalConfirmations, ecoScore),
    [myReports.length, totalConfirmations, ecoScore]
  );
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const handleSignOut = () => {
    Alert.alert("Chiqish", "Hisobdan chiqmoqchimisiz?", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "Chiqish",
        style: "destructive",
        onPress: async () => {
          setLoadingSignOut(true);
          await signOut();
          setLoadingSignOut(false);
        },
      },
    ]);
  };

  const openEditName = () => {
    setNameInput(profile?.full_name ?? "");
    setEditNameVisible(true);
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      Alert.alert("Xato", "Ism bo'sh bo'lishi mumkin emas");
      return;
    }
    setSavingName(true);
    const { error } = await updateName(nameInput.trim());
    setSavingName(false);
    if (error) {
      Alert.alert("Xato", error);
    } else {
      setEditNameVisible(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>
        <View style={styles.authPrompt}>
          <View style={styles.authIconCircle}>
            <Ionicons name="person" size={44} color="#fff" />
          </View>
          <Text style={styles.authTitle}>Xush kelibsiz!</Text>
          <Text style={styles.authSub}>
            Muammolarni tasdiqlash, xabar berish va eko-ballar to'plash uchun tizimga kiring
          </Text>
          <TouchableOpacity
            style={styles.authBtn}
            onPress={() => router.push("/auth")}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={18} color="#fff" />
            <Text style={styles.authBtnText}>Kirish / Ro'yxatdan o'tish</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/settings")} style={styles.settingsLinkRow}>
            <Ionicons name="settings-outline" size={16} color={C.textSecondary} />
            <Text style={styles.settingsLinkText}>Sozlamalar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { paddingTop: topPad }]}
        contentContainerStyle={{ paddingBottom: bottomPad + 84 + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={refreshProfile} style={styles.iconBtn}>
              <Ionicons name="refresh" size={18} color={C.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/settings")} style={styles.iconBtn}>
              <Ionicons name="settings-outline" size={18} color={C.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: levelInfo.color }]}>
            <Text style={styles.avatarText}>{levelInfo.icon}</Text>
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
              <TouchableOpacity onPress={openEditName} style={styles.editNameBtn}>
                <Ionicons name="pencil" size={14} color={C.primary} />
              </TouchableOpacity>
            </View>
            {profile?.full_name && (
              <Text style={styles.emailText} numberOfLines={1}>{user.email}</Text>
            )}
            <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + "20" }]}>
              <Text style={[styles.levelText, { color: levelInfo.color }]}>{levelInfo.title}</Text>
            </View>
          </View>
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNum, { color: levelInfo.color }]}>{ecoScore}</Text>
            <Text style={styles.scoreLabel}>ball</Text>
          </View>
        </View>

        {/* Eco-score progress */}
        {profile && levelInfo.nextTitle && (
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Keyingi: {levelInfo.nextTitle}</Text>
              <Text style={styles.progressNum}>{ecoScore} / {levelInfo.nextMin}</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(levelInfo.progress * 100)}%` as any,
                    backgroundColor: levelInfo.color,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="alert-circle" size={22} color={C.accent} />
            <Text style={styles.statNum}>{myReports.length}</Text>
            <Text style={styles.statLabel}>Xabarlar</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={22} color={C.primary} />
            <Text style={styles.statNum}>{totalConfirmations}</Text>
            <Text style={styles.statLabel}>Tasdiqlar</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={22} color="#F59E0B" />
            <Text style={styles.statNum}>{unlockedCount}</Text>
            <Text style={styles.statLabel}>Yutuqlar</Text>
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏅 Yutuqlar</Text>
          <View style={styles.achievementsGrid}>
            {achievements.map((a) => (
              <View key={a.id} style={[styles.achieveCard, !a.unlocked && styles.achieveCardLocked]}>
                <Text style={styles.achieveIcon}>{a.unlocked ? a.icon : "🔒"}</Text>
                <Text style={[styles.achieveTitle, !a.unlocked && styles.achieveTitleLocked]}>{a.title}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Reyting</Text>
            <View>
              {leaderboard.map((entry: any, i: number) => {
                const isMe = entry.user_id === user.id;
                const medals = ["🥇", "🥈", "🥉"];
                const lvl = getLevel(entry.eco_score ?? 0);
                const name = entry.full_name || (isMe ? displayName : `Foydalanuvchi ${i + 1}`);
                return (
                  <View key={entry.user_id} style={[styles.leaderRow, isMe && styles.leaderRowMe, i < leaderboard.length - 1 && styles.leaderBorder]}>
                    <Text style={styles.leaderRank}>{medals[i] ?? `#${i + 1}`}</Text>
                    <View style={[styles.leaderAvatar, { backgroundColor: lvl.color }]}>
                      <Text style={styles.leaderAvatarText}>{lvl.icon}</Text>
                    </View>
                    <Text style={[styles.leaderName, isMe && styles.leaderNameMe]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.leaderScore, { color: lvl.color }]}>{entry.eco_score} ball</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent reports */}
        {myReports.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📋 Xabarlarim</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/reports")}>
                <Text style={styles.sectionAction}>Barchasi</Text>
              </TouchableOpacity>
            </View>
            {myReports.slice(0, 3).map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={styles.reportRow}
                onPress={() => router.push({ pathname: "/report-detail", params: { id: item.id } })}
                activeOpacity={0.85}
              >
                <View style={styles.reportIcon}>
                  <Ionicons name="document-text-outline" size={16} color={C.primary} />
                </View>
                <View style={styles.reportContent}>
                  <Text style={styles.reportDesc} numberOfLines={1}>
                    {item.description || "Muammo xabari"}
                  </Text>
                  <Text style={styles.reportMeta}>
                    {item.confirmations_count} tasdiq • {new Date(item.created_at).toLocaleDateString("uz-UZ")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.border} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/report-modal")}>
            <View style={[styles.menuIcon, { backgroundColor: "#E8F5E9" }]}>
              <Ionicons name="add-circle-outline" size={20} color={C.primary} />
            </View>
            <Text style={styles.menuLabel}>Yangi muammo xabari</Text>
            <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/settings")}>
            <View style={[styles.menuIcon, { backgroundColor: "#F3F4F6" }]}>
              <Ionicons name="settings-outline" size={20} color={C.text} />
            </View>
            <Text style={styles.menuLabel}>Sozlamalar</Text>
            <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut} disabled={loadingSignOut}>
            <View style={[styles.menuIcon, { backgroundColor: "#FEE2E2" }]}>
              {loadingSignOut ? (
                <ActivityIndicator size="small" color={C.danger} />
              ) : (
                <Ionicons name="log-out-outline" size={20} color={C.danger} />
              )}
            </View>
            <Text style={[styles.menuLabel, { color: C.danger }]}>Chiqish</Text>
            <Ionicons name="chevron-forward" size={16} color={C.danger} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={editNameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNameVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Ismni o'zgartirish</Text>
            <TextInput
              style={styles.modalInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Ism Familiya"
              placeholderTextColor={C.border}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditNameVisible(false)}
              >
                <Text style={styles.modalCancelText}>Bekor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Saqlash</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  headerTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: C.text },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },

  authPrompt: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  authIconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
    marginBottom: 8, ...sh.greenXl,
  },
  authTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: C.text },
  authSub: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 22 },
  authBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 8, backgroundColor: C.primary,
    paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14,
    ...sh.green,
  },
  authBtnText: { fontFamily: "Nunito_700Bold", fontSize: 15, color: "#fff" },
  settingsLinkRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 8, paddingVertical: 8,
  },
  settingsLinkText: { fontFamily: "Nunito_600SemiBold", fontSize: 14, color: C.textSecondary },

  profileCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.surface, padding: 16,
    marginHorizontal: 14, marginTop: 14, marginBottom: 4,
    borderRadius: 18, ...sh.md, gap: 12,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28 },
  profileInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameText: { fontFamily: "Nunito_700Bold", fontSize: 15, color: C.text, flex: 1 },
  editNameBtn: {
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center",
  },
  emailText: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  levelText: { fontFamily: "Nunito_600SemiBold", fontSize: 12 },
  scoreBox: { alignItems: "center" },
  scoreNum: { fontFamily: "Nunito_800ExtraBold", fontSize: 24 },
  scoreLabel: { fontFamily: "Nunito_400Regular", fontSize: 12, color: C.textSecondary },

  progressSection: {
    marginHorizontal: 14, marginBottom: 12,
    backgroundColor: C.surface, borderRadius: 14, padding: 12,
    ...sh.sm, gap: 6,
  },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: C.textSecondary },
  progressNum: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: C.textSecondary },
  progressBar: { height: 8, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },

  statsRow: { flexDirection: "row", paddingHorizontal: 14, gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 14,
    alignItems: "center", paddingVertical: 14, gap: 4, ...sh.sm,
  },
  statNum: { fontFamily: "Nunito_800ExtraBold", fontSize: 22, color: C.text },
  statLabel: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },

  section: {
    marginHorizontal: 14, marginBottom: 14,
    backgroundColor: C.surface, borderRadius: 16, padding: 14, ...sh.sm,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontFamily: "Nunito_700Bold", fontSize: 15, color: C.text, marginBottom: 10 },
  sectionAction: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.primary },

  achievementsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  achieveCard: {
    backgroundColor: "#F0FDF4", borderRadius: 12,
    alignItems: "center", padding: 10, gap: 4, minWidth: 80,
  },
  achieveCardLocked: { backgroundColor: "#F9FAFB", opacity: 0.5 },
  achieveIcon: { fontSize: 24 },
  achieveTitle: { fontFamily: "Nunito_600SemiBold", fontSize: 10, color: C.text, textAlign: "center" },
  achieveTitleLocked: { color: C.textSecondary },

  leaderRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  leaderRowMe: { backgroundColor: "#F0FDF4", marginHorizontal: -4, paddingHorizontal: 4, borderRadius: 10 },
  leaderBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  leaderRank: { fontSize: 20, width: 28, textAlign: "center" },
  leaderAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  leaderAvatarText: { fontSize: 16 },
  leaderName: { flex: 1, fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.text },
  leaderNameMe: { color: C.primary, fontFamily: "Nunito_700Bold" },
  leaderScore: { fontFamily: "Nunito_700Bold", fontSize: 13 },

  reportRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
  },
  reportIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  reportContent: { flex: 1 },
  reportDesc: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.text },
  reportMeta: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },

  menuSection: {
    marginHorizontal: 14, marginBottom: 14,
    backgroundColor: C.surface, borderRadius: 16, ...sh.sm, overflow: "hidden",
  },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontFamily: "Nunito_600SemiBold", fontSize: 15, color: C.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 64 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24,
    width: "100%", gap: 16, ...sh.xl,
  },
  modalTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: C.text },
  modalInput: {
    borderWidth: 1.5, borderColor: C.border,
    borderRadius: 12, padding: 14,
    fontFamily: "Nunito_400Regular", fontSize: 15, color: C.text,
    backgroundColor: "#F9FAFB",
  },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1, height: 46, borderRadius: 12,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  modalCancelText: { fontFamily: "Nunito_600SemiBold", fontSize: 15, color: C.text },
  modalSaveBtn: {
    flex: 1, height: 46, borderRadius: 12,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center",
    ...sh.green,
  },
  modalSaveText: { fontFamily: "Nunito_700Bold", fontSize: 15, color: "#fff" },
});
