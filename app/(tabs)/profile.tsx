import { sh } from "@/constants/shadow";
import React, { useState, useMemo, useEffect, useRef } from "react";
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
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const LEVELS = [
  { min: 0,    max: 99,   title: "Eko-boshlovchi",    color: "#9CA3AF", icon: "🌱" },
  { min: 100,  max: 499,  title: "Eko-faol",           color: "#10B981", icon: "🌿" },
  { min: 500,  max: 999,  title: "Tabiat himoyachisi", color: "#3B82F6", icon: "🌊" },
  { min: 1000, max: 4999, title: "Yashil elchi",       color: "#8B5CF6", icon: "🦋" },
  { min: 5000, max: Infinity, title: "Eko-qahramon",  color: "#F59E0B", icon: "🏆" },
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
    { id: "first",      icon: "📝", title: "Birinchi qadam",   desc: "Birinchi muammo xabarini yubordi", unlocked: reportCount >= 1 },
    { id: "reporter5",  icon: "🔍", title: "Ishtirokchi",      desc: "5 ta muammo xabari yubordi",       unlocked: reportCount >= 5 },
    { id: "reporter20", icon: "📊", title: "Faol ishtirokchi", desc: "20 ta muammo xabari yubordi",      unlocked: reportCount >= 20 },
    { id: "confirm10",  icon: "✅", title: "Tasdiqlangan",     desc: "10 ta tasdiqlash oldi",            unlocked: totalConfirm >= 10 },
    { id: "confirm50",  icon: "🏅", title: "Ishonchli",        desc: "50 ta tasdiqlash oldi",            unlocked: totalConfirm >= 50 },
    { id: "eco100",     icon: "🌿", title: "Eko-faol",         desc: "100 ball to'pladi",                unlocked: score >= 100 },
    { id: "eco1000",    icon: "🏆", title: "Eko-qahramon",     desc: "1000 ball to'pladi",               unlocked: score >= 1000 },
  ];
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user, profile, signOut, refreshProfile, updateName } = useAuth();
  const [loadingSignOut, setLoadingSignOut] = useState(false);
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const prevScoreRef = useRef(0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const ecoScore = profile?.eco_score ?? 0;
  const levelInfo = getLevel(ecoScore);
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Foydalanuvchi";

  const progressAnim = useSharedValue(0);

  useEffect(() => {
    if (ecoScore === prevScoreRef.current && ecoScore === 0) return;
    const target = ecoScore;
    const start = prevScoreRef.current;
    if (target === start) return;
    const steps = 45;
    const stepTime = 22;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const t = step / steps;
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(start + (target - start) * eased));
      if (step >= steps) {
        setDisplayScore(target);
        prevScoreRef.current = target;
        clearInterval(timer);
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [ecoScore]);

  useEffect(() => {
    progressAnim.value = 0;
    progressAnim.value = withDelay(
      500,
      withTiming(levelInfo.progress, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );
  }, [levelInfo.progress]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, progressAnim.value * 100)}%` as any,
  }));

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    await qc.invalidateQueries({ queryKey: ["/api/my-reports", user?.id] });
    await qc.invalidateQueries({ queryKey: ["/api/verifications", user?.id] });
    await qc.invalidateQueries({ queryKey: ["/api/leaderboard"] });
    setRefreshing(false);
  };

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

  const { data: verificationCount = 0 } = useQuery({
    queryKey: ["/api/verifications", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("verification_audit")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (error) return 0;
      return count ?? 0;
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
          <TouchableOpacity style={styles.authBtn} onPress={() => router.push("/auth")} activeOpacity={0.85}>
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
        style={styles.container}
        contentContainerStyle={{ paddingBottom: bottomPad + 84 + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.primary]}
            tintColor="#fff"
          />
        }
      >
        {/* ─── Gradient Hero ─── */}
        <LinearGradient
          colors={["#1A5C1E", "#2E7D32", "#3D9142"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1.4 }}
          style={[styles.hero, { paddingTop: topPad + 14 }]}
        >
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>Profil</Text>
            <View style={styles.heroActions}>
              <TouchableOpacity onPress={refreshProfile} style={styles.heroIconBtn}>
                <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/settings")} style={styles.heroIconBtn}>
                <Ionicons name="settings-outline" size={18} color="rgba(255,255,255,0.85)" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroProfile}>
            <View style={[styles.heroAvatar, { backgroundColor: levelInfo.color + "45" }]}>
              <Text style={styles.heroAvatarEmoji}>{levelInfo.icon}</Text>
            </View>
            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>
                <TouchableOpacity onPress={openEditName} style={styles.heroEditBtn}>
                  <Ionicons name="pencil" size={13} color="rgba(255,255,255,0.75)" />
                </TouchableOpacity>
              </View>
              {profile?.full_name && user?.email && (
                <Text style={styles.heroEmail} numberOfLines={1}>{user.email}</Text>
              )}
              <View style={styles.heroLevelBadge}>
                <Text style={styles.heroLevelText}>{levelInfo.title}</Text>
              </View>
            </View>
            <View style={styles.heroScoreBox}>
              <Text style={styles.heroScoreNum}>{displayScore.toLocaleString()}</Text>
              <Text style={styles.heroScoreLabel}>ball</Text>
            </View>
          </View>

          {levelInfo.nextTitle && (
            <View style={styles.heroProgress}>
              <View style={styles.heroProgressTop}>
                <Text style={styles.heroProgressLabel}>Keyingi: {levelInfo.nextTitle}</Text>
                <Text style={styles.heroProgressNum}>{displayScore} / {levelInfo.nextMin}</Text>
              </View>
              <View style={styles.heroProgressTrack}>
                <Animated.View style={[styles.heroProgressFill, progressBarStyle]} />
              </View>
            </View>
          )}
        </LinearGradient>

        {/* ─── Stats ─── */}
        <View style={styles.statsRow}>
          {[
            { icon: "alert-circle", color: C.accent,    num: myReports.length,    label: "Xabarlar" },
            { icon: "shield-checkmark", color: "#7C3AED", num: verificationCount, label: "Tasdiqladi" },
            { icon: "checkmark-circle", color: C.primary, num: totalConfirmations, label: "Olingan" },
            { icon: "trophy",       color: "#F59E0B",    num: unlockedCount,       label: "Yutuqlar" },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Ionicons name={s.icon as any} size={20} color={s.color} />
              <Text style={styles.statNum} numberOfLines={1}>{s.num}</Text>
              <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ─── Achievements ─── */}
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

        {/* ─── Leaderboard ─── */}
        {leaderboard.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Reyting</Text>
            {leaderboard.map((entry: any, i: number) => {
              const isMe = entry.user_id === user.id;
              const medals = ["🥇", "🥈", "🥉"];
              const lvl = getLevel(entry.eco_score ?? 0);
              const name = entry.full_name || (isMe ? displayName : `Foydalanuvchi ${i + 1}`);
              return (
                <View
                  key={entry.user_id}
                  style={[
                    styles.leaderRow,
                    isMe && styles.leaderRowMe,
                    i < leaderboard.length - 1 && styles.leaderBorder,
                  ]}
                >
                  <Text style={styles.leaderRank}>{medals[i] ?? `#${i + 1}`}</Text>
                  <View style={[styles.leaderAvatar, { backgroundColor: lvl.color }]}>
                    <Text style={styles.leaderAvatarText}>{lvl.icon}</Text>
                  </View>
                  <Text style={[styles.leaderName, isMe && styles.leaderNameMe]} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.leaderScore, { color: lvl.color }]}>{entry.eco_score} ball</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ─── Recent Reports ─── */}
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

        {/* ─── About ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Dastur haqida</Text>
          {[
            { icon: "person-circle-outline", label: "Muallif", value: "Yursinaliyev Muhammadaziz" },
            { icon: "mail-outline",           label: "Aloqa",   value: "yursinaliyevm@gmail.com" },
            { icon: "leaf-outline",           label: "Versiya", value: "Eco-Xarita v1.0.0" },
          ].map((row, i, arr) => (
            <View key={row.label}>
              <View style={styles.aboutRow}>
                <Ionicons name={row.icon as any} size={18} color={i === 2 ? C.primary : C.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.aboutLabel}>{row.label}</Text>
                  <Text style={styles.aboutValue}>{row.value}</Text>
                </View>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* ─── Menu ─── */}
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
          {profile?.role === "admin" && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/admin")}>
                <View style={[styles.menuIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#D97706" />
                </View>
                <Text style={[styles.menuLabel, { color: "#D97706" }]}>Admin panel</Text>
                <Ionicons name="chevron-forward" size={16} color="#D97706" />
              </TouchableOpacity>
            </>
          )}
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

      {/* ─── Edit Name Modal ─── */}
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
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditNameVisible(false)}>
                <Text style={styles.modalCancelText}>Bekor</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveName} disabled={savingName}>
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
    paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, ...sh.green,
  },
  authBtnText: { fontFamily: "Nunito_700Bold", fontSize: 15, color: "#fff" },
  settingsLinkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingVertical: 8 },
  settingsLinkText: { fontFamily: "Nunito_600SemiBold", fontSize: 14, color: C.textSecondary },

  hero: { paddingHorizontal: 20, paddingBottom: 26 },
  heroHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  heroTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: "#fff" },
  heroActions: { flexDirection: "row", gap: 8 },
  heroIconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  heroProfile: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 },
  heroAvatar: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.35)",
  },
  heroAvatarEmoji: { fontSize: 32 },
  heroInfo: { flex: 1, gap: 5 },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  heroName: { fontFamily: "Nunito_700Bold", fontSize: 17, color: "#fff", flex: 1 },
  heroEditBtn: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  heroEmail: { fontFamily: "Nunito_400Regular", fontSize: 12, color: "rgba(255,255,255,0.68)" },
  heroLevelBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start",
  },
  heroLevelText: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: "#fff" },
  heroScoreBox: { alignItems: "center", gap: 1 },
  heroScoreNum: { fontFamily: "Nunito_800ExtraBold", fontSize: 32, color: "#fff" },
  heroScoreLabel: { fontFamily: "Nunito_400Regular", fontSize: 13, color: "rgba(255,255,255,0.72)" },
  heroProgress: { gap: 7 },
  heroProgressTop: { flexDirection: "row", justifyContent: "space-between" },
  heroProgressLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: "rgba(255,255,255,0.78)" },
  heroProgressNum: { fontFamily: "Nunito_600SemiBold", fontSize: 12, color: "rgba(255,255,255,0.78)" },
  heroProgressTrack: { height: 7, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 4, overflow: "hidden" },
  heroProgressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 4 },

  statsRow: { flexDirection: "row", paddingHorizontal: 14, gap: 6, marginTop: 14, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 14,
    alignItems: "center", paddingVertical: 12, gap: 3, ...sh.sm, minWidth: 0,
  },
  statNum: { fontFamily: "Nunito_800ExtraBold", fontSize: 20, color: C.text },
  statLabel: { fontFamily: "Nunito_400Regular", fontSize: 10, color: C.textSecondary, textAlign: "center" },

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
  achieveTitle: { fontFamily: "Nunito_600SemiBold", fontSize: 10, color: C.text, textAlign: "center", flexShrink: 1 },
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
  reportIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#E8F5E9", alignItems: "center", justifyContent: "center" },
  reportContent: { flex: 1 },
  reportDesc: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.text },
  reportMeta: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },

  aboutRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  aboutLabel: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary },
  aboutValue: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.text, marginTop: 1 },

  menuSection: {
    marginHorizontal: 14, marginBottom: 14,
    backgroundColor: C.surface, borderRadius: 16, ...sh.sm, overflow: "hidden",
  },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontFamily: "Nunito_600SemiBold", fontSize: 15, color: C.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 64 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", padding: 32,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", gap: 16, ...sh.xl },
  modalTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: C.text },
  modalInput: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 14,
    fontFamily: "Nunito_400Regular", fontSize: 15, color: C.text, backgroundColor: "#F9FAFB",
  },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1, height: 46, borderRadius: 12,
    backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
  modalCancelText: { fontFamily: "Nunito_600SemiBold", fontSize: 15, color: C.text },
  modalSaveBtn: {
    flex: 1, height: 46, borderRadius: 12,
    backgroundColor: C.primary, alignItems: "center", justifyContent: "center", ...sh.green,
  },
  modalSaveText: { fontFamily: "Nunito_700Bold", fontSize: 15, color: "#fff" },
});
