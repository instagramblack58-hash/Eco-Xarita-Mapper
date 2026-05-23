import { sh } from "@/constants/shadow";
import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Colors from "@/constants/colors";
import { useHaptics } from "@/hooks/useHaptics";

const C = Colors.light;

type ShopItem = {
  id: string;
  name_uz: string;
  description_uz: string;
  price_balls: number;
  category: string;
  emoji: string;
  is_active: boolean;
};

type Purchase = {
  id: string;
  balls_spent: number;
  created_at: string;
  shop_items: { name_uz: string; emoji: string } | null;
};

const CATEGORIES = [
  { id: "all",       label: "Barchasi",    emoji: "🛍️" },
  { id: "transport", label: "Transport",   emoji: "🚌" },
  { id: "oziq-ovqat",label: "Oziq-ovqat", emoji: "🍃" },
  { id: "korik",     label: "Ko'rik",      emoji: "🌳" },
  { id: "mahsulot",  label: "Mahsulot",   emoji: "♻️" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const haptics = useHaptics();

  const [category, setCategory] = useState("all");
  const [tab, setTab] = useState<"shop" | "history">("shop");
  const [selected, setSelected] = useState<ShopItem | null>(null);
  const [buying, setBuying] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + 84 + (Platform.OS === "web" ? 34 : 0);

  const { data: items = [], isLoading: loadingItems, refetch: refetchItems } = useQuery<ShopItem[]>({
    queryKey: ["/shop/items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_items")
        .select("*")
        .eq("is_active", true)
        .order("price_balls", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    retry: 1,
  });

  const { data: purchases = [], isLoading: loadingPurchases, refetch: refetchPurchases } = useQuery<Purchase[]>({
    queryKey: ["/shop/purchases", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("purchases")
        .select("id, balls_spent, created_at, shop_items(name_uz, emoji)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
    retry: 1,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchItems(), refetchPurchases(), refreshProfile()]);
    setRefreshing(false);
  }, [refetchItems, refetchPurchases, refreshProfile]);

  const filtered = category === "all" ? items : items.filter(i => i.category === category);
  const balance = profile?.eco_score ?? 0;

  async function handleBuy() {
    if (!user || !selected) return;
    setBuying(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc("purchase_item", {
        p_item_id: selected.id,
        p_user_id: user.id,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; item_name?: string; balls_spent?: number };
      if (!result.success) {
        setErrorMsg(result.error ?? "Xato yuz berdi");
        haptics.error();
      } else {
        setSelected(null);
        setSuccessMsg(`"${result.item_name}" muvaffaqiyatli sotib olindi! -${result.balls_spent} 🌿`);
        haptics.success();
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["/shop/purchases"] }),
          refreshProfile(),
        ]);
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (e: any) {
      setErrorMsg(e.message ?? "Xato yuz berdi");
      haptics.error();
    } finally {
      setBuying(false);
    }
  }

  const topContent = (
    <>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceLeft}>
          <Text style={styles.balanceLabel}>Balansingiz</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceEmoji}>🌿</Text>
            <Text style={styles.balanceNum}>{balance.toLocaleString()}</Text>
            <Text style={styles.balanceSuffix}> ball</Text>
          </View>
        </View>
        <View style={styles.balanceRight}>
          <Text style={styles.balanceHint}>Qayta ishlash va{"\n"}hisobot berish orqali{"\n"}ball yig'ing!</Text>
        </View>
      </View>

      {/* Success banner */}
      {successMsg && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.successText}>{successMsg}</Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "shop" && styles.tabBtnActive]}
          onPress={() => setTab("shop")}
        >
          <Text style={[styles.tabBtnText, tab === "shop" && styles.tabBtnTextActive]}>Do'kon</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.tabBtnText, tab === "history" && styles.tabBtnTextActive]}>
            Xaridlar tarixi {purchases.length > 0 ? `(${purchases.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  if (!user) {
    return (
      <View style={[styles.root, { paddingTop: topPad, paddingBottom: botPad }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Eko-Do'kon</Text>
        </View>
        <ScrollView contentContainerStyle={styles.guestWrap} showsVerticalScrollIndicator={false}>
          <Text style={styles.guestEmoji}>🛍️</Text>
          <Text style={styles.guestTitle}>Do'konga kirish uchun ro'yxatdan o'ting</Text>
          <Text style={styles.guestSub}>
            Qayta ishlash va muammo xabarlari uchun ball yig'ib,{"\n"}foydali mahsulotlar va imtiyozlar oling
          </Text>
          <View style={styles.benefitList}>
            {[
              { e: "🚌", t: "Transport biletlari" },
              { e: "🌱", t: "Daraxt ko'chatlari" },
              { e: "♻️", t: "Eko-mahsulotlar" },
              { e: "🌳", t: "Ko'rik joylari kirish" },
            ].map(b => (
              <View key={b.t} style={styles.benefitRow}>
                <Text style={styles.benefitEmoji}>{b.e}</Text>
                <Text style={styles.benefitText}>{b.t}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/auth")}>
            <Text style={styles.loginBtnText}>Kirish / Ro'yxatdan o'tish</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Eko-Do'kon</Text>
      </View>

      {tab === "shop" ? (
        <FlatList
          key="shop"
          data={filtered}
          keyExtractor={i => i.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ paddingBottom: botPad, paddingHorizontal: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          ListHeaderComponent={
            <>
              {topContent}
              {/* Category filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, category === cat.id && styles.catChipActive]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Text style={styles.catEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.catText, category === cat.id && styles.catTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {loadingItems && (
                <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />
              )}
              {!loadingItems && filtered.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🛒</Text>
                  <Text style={styles.emptyText}>Bu toifada mahsulotlar yo'q</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => {
            const canAfford = balance >= item.price_balls;
            return (
              <TouchableOpacity
                style={[styles.itemCard, !canAfford && styles.itemCardDim]}
                onPress={() => {
                  haptics.light();
                  setSelected(item);
                  setErrorMsg(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <Text style={styles.itemName}>{item.name_uz}</Text>
                <View style={[styles.priceBadge, !canAfford && styles.priceBadgeDim]}>
                  <Text style={[styles.priceText, !canAfford && styles.priceTextDim]}>
                    🌿 {item.price_balls}
                  </Text>
                </View>
                <View style={[styles.buyBtn, !canAfford && styles.buyBtnDim]}>
                  <Text style={[styles.buyBtnText, !canAfford && styles.buyBtnTextDim]}>
                    {canAfford ? "Sotib olish" : "Yetarli emas"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          key="history"
          data={purchases}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: botPad, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          ListHeaderComponent={
            <>
              {topContent}
              {loadingPurchases && <ActivityIndicator color={C.primary} style={{ marginTop: 32 }} />}
              {!loadingPurchases && purchases.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>📋</Text>
                  <Text style={styles.emptyText}>Hali xarid qilmadingiz</Text>
                  <TouchableOpacity onPress={() => setTab("shop")}>
                    <Text style={styles.emptyLink}>Do'konga o'tish →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.purchaseRow}>
              <Text style={styles.purchaseEmoji}>{item.shop_items?.emoji ?? "🎁"}</Text>
              <View style={styles.purchaseInfo}>
                <Text style={styles.purchaseName}>{item.shop_items?.name_uz ?? "Noma'lum"}</Text>
                <Text style={styles.purchaseDate}>{formatDate(item.created_at)}</Text>
              </View>
              <View style={styles.purchaseBalls}>
                <Text style={styles.purchaseBallsText}>-{item.balls_spent} 🌿</Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Purchase confirmation modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelected(null)} />
        {selected && (
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalEmoji}>{selected.emoji}</Text>
            <Text style={styles.modalTitle}>{selected.name_uz}</Text>
            {selected.description_uz ? (
              <Text style={styles.modalDesc}>{selected.description_uz}</Text>
            ) : null}

            <View style={styles.modalInfoBox}>
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Narxi</Text>
                <Text style={styles.modalInfoValue}>🌿 {selected.price_balls} ball</Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Balansingiz</Text>
                <Text style={styles.modalInfoValue}>🌿 {balance} ball</Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>Keyin qoladi</Text>
                <Text style={[styles.modalInfoValue, balance - selected.price_balls < 0 && styles.redText]}>
                  🌿 {balance - selected.price_balls} ball
                </Text>
              </View>
            </View>

            {errorMsg && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={C.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, (balance < selected.price_balls || buying) && styles.confirmBtnDim]}
              onPress={handleBuy}
              disabled={balance < selected.price_balls || buying}
            >
              {buying ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>
                  {balance < selected.price_balls ? "Balansingiz yetarli emas" : "Tasdiqlash"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setSelected(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Bekor qilish</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    paddingTop: 12,
  },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: C.text },

  // Balance card
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: C.primary,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...sh.green,
  },
  balanceLeft: { gap: 4 },
  balanceLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: "rgba(255,255,255,0.8)" },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  balanceEmoji: { fontSize: 22 },
  balanceNum: { fontFamily: "Nunito_800ExtraBold", fontSize: 36, color: "#fff" },
  balanceSuffix: { fontFamily: "Nunito_600SemiBold", fontSize: 16, color: "rgba(255,255,255,0.85)" },
  balanceRight: {},
  balanceHint: { fontFamily: "Nunito_400Regular", fontSize: 12, color: "rgba(255,255,255,0.75)", textAlign: "right", lineHeight: 18 },

  // Success banner
  successBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: C.success,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  successText: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: "#fff", flex: 1 },

  // Tabs
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: C.border,
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: C.surface, ...sh.sm },
  tabBtnText: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.textSecondary },
  tabBtnTextActive: { color: C.primary },

  // Category filter
  catScroll: { marginBottom: 16 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  catChipActive: { backgroundColor: "#E8F5E9", borderColor: C.primary },
  catEmoji: { fontSize: 14 },
  catText: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.textSecondary },
  catTextActive: { color: C.primary },

  // Grid
  gridRow: { gap: 12, justifyContent: "space-between" },
  itemCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
    ...sh.sm,
  },
  itemCardDim: { opacity: 0.6 },
  itemEmoji: { fontSize: 40 },
  itemName: { fontFamily: "Nunito_700Bold", fontSize: 13, color: C.text, textAlign: "center" },
  priceBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  priceBadgeDim: { backgroundColor: "#F3F4F6" },
  priceText: { fontFamily: "Nunito_700Bold", fontSize: 12, color: C.primary },
  priceTextDim: { color: C.textSecondary },
  buyBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    width: "100%",
    alignItems: "center",
  },
  buyBtnDim: { backgroundColor: "#E5E7EB" },
  buyBtnText: { fontFamily: "Nunito_700Bold", fontSize: 12, color: "#fff" },
  buyBtnTextDim: { color: C.textSecondary },

  // Empty state
  empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontFamily: "Nunito_600SemiBold", fontSize: 15, color: C.textSecondary, textAlign: "center" },
  emptyLink: { fontFamily: "Nunito_700Bold", fontSize: 14, color: C.primary },

  // Purchase history
  purchaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    borderRadius: 14,
    ...sh.sm,
  },
  purchaseEmoji: { fontSize: 28 },
  purchaseInfo: { flex: 1, gap: 2 },
  purchaseName: { fontFamily: "Nunito_700Bold", fontSize: 14, color: C.text },
  purchaseDate: { fontFamily: "Nunito_400Regular", fontSize: 12, color: C.textSecondary },
  purchaseBalls: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  purchaseBallsText: { fontFamily: "Nunito_700Bold", fontSize: 12, color: "#B45309" },
  separator: { height: 8 },

  // Guest
  guestWrap: { alignItems: "center", paddingHorizontal: 24, paddingTop: 32 },
  guestEmoji: { fontSize: 64, marginBottom: 16 },
  guestTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 22, color: C.text, textAlign: "center", marginBottom: 10 },
  guestSub: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  benefitList: { gap: 10, width: "100%", marginBottom: 32 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitEmoji: { fontSize: 22, width: 30, textAlign: "center" },
  benefitText: { fontFamily: "Nunito_600SemiBold", fontSize: 15, color: C.text },
  loginBtn: {
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    ...sh.green,
  },
  loginBtnText: { fontFamily: "Nunito_700Bold", fontSize: 16, color: "#fff" },

  // Modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  modalSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, marginBottom: 8 },
  modalEmoji: { fontSize: 56 },
  modalTitle: { fontFamily: "Nunito_800ExtraBold", fontSize: 22, color: C.text, textAlign: "center" },
  modalDesc: { fontFamily: "Nunito_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20 },
  modalInfoBox: {
    width: "100%",
    backgroundColor: C.background,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 4,
  },
  modalInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, paddingHorizontal: 16 },
  modalInfoLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 14, color: C.textSecondary },
  modalInfoValue: { fontFamily: "Nunito_700Bold", fontSize: 15, color: C.text },
  modalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginHorizontal: 16 },
  redText: { color: C.danger },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: "100%",
  },
  errorText: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.danger, flex: 1 },
  confirmBtn: {
    backgroundColor: C.primary,
    borderRadius: 16,
    paddingVertical: 16,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
    ...sh.green,
  },
  confirmBtnDim: { backgroundColor: "#9CA3AF", ...sh.sm },
  confirmBtnText: { fontFamily: "Nunito_700Bold", fontSize: 16, color: "#fff" },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { fontFamily: "Nunito_600SemiBold", fontSize: 14, color: C.textSecondary },
});
