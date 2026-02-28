import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 84 : insets.bottom + 84 + 16;

  const { data: myReports = [] } = useQuery({
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

  const handleSignOut = () => {
    Alert.alert("Chiqish", "Hisobdan chiqmoqchimisiz?", [
      { text: "Bekor qilish", style: "cancel" },
      {
        text: "Chiqish",
        style: "destructive",
        onPress: () => signOut(),
      },
    ]);
  };

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topPad, paddingBottom: bottomPad }]}>
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
      </View>

      {/* Avatar + email */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user.email ?? "U")[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.emailText}>{user.email}</Text>
        <Text style={styles.memberText}>Eco-Xarita a'zosi</Text>
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
          <Text style={styles.statNum}>
            {myReports.reduce((a, r: any) => a + (r.confirmations_count ?? 0), 0)}
          </Text>
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

        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleSignOut}
        >
          <View style={[styles.menuIcon, { backgroundColor: "#FEE2E2" }]}>
            <Ionicons name="log-out-outline" size={20} color={C.danger} />
          </View>
          <Text style={[styles.menuLabel, { color: C.danger }]}>Chiqish</Text>
          <Ionicons name="chevron-forward" size={16} color={C.danger} />
        </TouchableOpacity>
      </View>
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
    paddingVertical: 28,
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
  },
  memberText: {
    fontFamily: "Nunito_400Regular",
    fontSize: 13,
    color: C.textSecondary,
    marginTop: 4,
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
});
