import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase, SavedLocation } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

const LEVELS = [
  { min: 0, title: "Eko-boshlovchi", color: "#9CA3AF" },
  { min: 100, title: "Eko-faol", color: "#10B981" },
  { min: 500, title: "Tabiat himoyachisi", color: "#3B82F6" },
  { min: 1000, title: "Yashil elchi", color: "#8B5CF6" },
  { min: 5000, title: "Eko-qahramon", color: "#F59E0B" },
];

function getLevel(score: number): { title: string; color: string; next: number } {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (score >= LEVELS[i].min) {
      const nextLevel = LEVELS[i + 1]?.min ?? score;
      return { title: LEVELS[i].title, color: LEVELS[i].color, next: nextLevel };
    }
  }
  return { title: LEVELS[0].title, color: LEVELS[0].color, next: LEVELS[1].min };
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [loadingSignOut, setLoadingSignOut] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: myReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["/api/my-reports", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: savedLocations = [] } = useQuery<SavedLocation[]>({
    queryKey: ["/api/saved-locations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("saved_locations")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const totalConfirmations = useMemo(
    () => myReports.reduce((a, r: any) => a + (r.confirmations_count ?? 0), 0),
    [myReports]
  );

  const levelInfo = profile ? getLevel(profile.eco_score) : null;

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

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topPad, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>
        <View style={styles.authPrompt}>
          <View style={styles.authIconBox}>
            <Ionicons name="person-circle-outline" size={80} color={C.border} />
          </View>
          <Text style={styles.authTitle}>Xush kelibsiz!</Text>
          <Text style={styles.authSub}>
            Muammolarni tasdiqlash va xabar berish uchun tizimga kiring
          </Text>
          <TouchableOpacity
            style={styles.authBtn}
            onPress={() => router.push("/auth")}
            activeOpacity={0.85}
          >
            <Text style={styles.authBtnText}>Kirish / Ro'yxatdan o'tish</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
        <TouchableOpacity onPress={refreshProfile} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Avatar + email + level */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user.email ?? "U")[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.emailText}>{user.email}</Text>
        {profile && levelInfo && (
          <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + "20" }]}>
            <Text style={[styles.levelText, { color: levelInfo.color }]}>
              {levelInfo.title} • {profile.eco_score} ball
            </Text>
          </View>
        )}
        {profile && (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((profile.eco_score % 100) / 100) * 100}%`,
                  backgroundColor: levelInfo?.color || C.primary,
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="alert-outline" size={22} color={C.accent} />
          <Text style={styles.statNum}>{myReports.length}</Text>
          <Text style={styles.statLabel}>Xabarlar</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={22} color={C.primary} />
          <Text style={styles.statNum}>{totalConfirmations}</Text>
          <Text style={styles.statLabel}>Tasdiqlar</Text>
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.menu}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push("/report-modal")}
        >
          <View style={[styles.menuIcon, { backgroundColor: "#E8F5E9" }]}>
            <Ionicons name="add-circle-outline" size={20} color={C.primary} />
          </View>
          <Text style={styles.menuLabel}>Yangi muammo xabari</Text>
          <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert("Tez orada", "Saqlangan joylar tez orada qo'shiladi")}>
          <View style={[styles.menuIcon, { backgroundColor: "#EFF6FF" }]}>
            <Ionicons name="bookmark-outline" size={20} color="#3B82F6" />
          </View>
          <Text style={styles.menuLabel}>Saqlangan joylar ({savedLocations.length})</Text>
          <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleSignOut}
          disabled={loadingSignOut}
        >
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

      {/* My reports mini list */}
      {myReports.length > 0 && (
        <View style={styles.recentBlock}>
          <Text style={styles.recentTitle}>So'nggi xabarlaringiz</Text>
          <FlatList
            data={myReports.slice(0, 3)}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.recentItem}
                onPress={() => router.push({ pathname: "/report-detail", params: { id: item.id } })}
              >
                <View style={styles.recentIcon}>
                  <Ionicons name="document-text-outline" size={18} color={C.primary} />
                </View>
                <View style={styles.recentContent}>
                  <Text style={styles.recentDesc} numberOfLines={1}>
                    {item.description || "Muammo xabari"}
                  </Text>
                  <Text style={styles.recentMeta}>
                    {item.confirmations_count} tasdiq • {new Date(item.created_at).toLocaleDateString("uz-UZ")}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            scrollEnabled={false}
          />
        </View>
      )}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 26,
    color: C.text,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  authPrompt: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  authIconBox: { marginBottom: 8 },
  authTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 24,
    color: C.text,
  },
  authSub: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  authBtn: {
    marginTop: 8,
    backgroundColor: C.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  authBtnText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 15,
    color: "#fff",
  },
  profileCard: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: C.surface,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 30,
    color: "#fff",
  },
  emailText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    color: C.text,
    marginBottom: 6,
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  levelText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
  },
  progressBar: {
    width: 200,
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statNum: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 24,
    color: C.text,
  },
  statLabel: {
    fontFamily: "Nunito_400Regular",
    fontSize: 12,
    color: C.textSecondary,
  },
  menu: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 15,
    color: C.text,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 64,
  },
  recentBlock: {
    marginHorizontal: 16,
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  recentTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 15,
    color: C.text,
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  recentContent: { flex: 1 },
  recentDesc: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.text },
  recentMeta: { fontFamily: "Nunito_400Regular", fontSize: 11, color: C.textSecondary, marginTop: 2 },
});