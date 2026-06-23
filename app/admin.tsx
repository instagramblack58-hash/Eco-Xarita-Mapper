import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";
import type { Report, RecyclingType, RewardType, MachineStatus } from "@/lib/supabase";

const C = Colors.light;

type Tab = "reports" | "add_machine" | "add_point" | "users";

const ISSUE_LABELS: Record<string, string> = {
  illegal_dumping: "Noqonuniy axlat",
  tree_cutting: "Daraxt kesish",
  water_pollution: "Suv ifloslanishi",
  air_pollution: "Havo ifloslanishi",
  other: "Boshqa",
};

const RECYCLING_TYPES: { value: RecyclingType; label: string }[] = [
  { value: "paper", label: "Qog'oz" },
  { value: "plastic", label: "Plastik" },
  { value: "mixed", label: "Aralash" },
  { value: "glass", label: "Shisha" },
  { value: "hazardous", label: "Zararli" },
];

const REWARD_TYPES: { value: RewardType; label: string }[] = [
  { value: "cheque", label: "Chek" },
  { value: "bonus", label: "Bonus ball" },
  { value: "discount", label: "Chegirma" },
  { value: "money", label: "Naqd pul" },
];

const MACHINE_STATUSES: { value: MachineStatus; label: string }[] = [
  { value: "active", label: "Faol" },
  { value: "maintenance", label: "Ta'mirlash" },
  { value: "inactive", label: "Nofaol" },
];

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Hozir";
  if (diff < 3600) return `${Math.floor(diff / 60)} daq oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  return `${Math.floor(diff / 86400)} kun oldin`;
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad" | "email-address" | "phone-pad";
  multiline?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={C.border}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
      />
    </View>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.selectChip, value === opt.value && styles.selectChipActive]}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={[styles.selectChipText, value === opt.value && styles.selectChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function ReportsTab() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ["/admin/reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["/admin/reports"] });
    setRefreshing(false);
  };

  const handleDelete = (report: Report) => {
    Alert.alert(
      "Hisobotni o'chirish",
      "Bu hisobotni o'chirishni tasdiqlaysizmi?",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "O'chirish",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from("reports").delete().eq("id", report.id);
            if (error) {
              Alert.alert("Xato", error.message);
            } else {
              await qc.invalidateQueries({ queryKey: ["/admin/reports"] });
              await qc.invalidateQueries({ queryKey: ["/api/reports"] });
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={reports}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={48} color={C.border} />
          <Text style={styles.emptyText}>Hisobotlar yo'q</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{ISSUE_LABELS[item.issue_type ?? "other"] ?? "Boshqa"}</Text>
            </View>
            <Text style={styles.reportTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.reportDesc} numberOfLines={2}>
            {item.description || "Tavsif yo'q"}
          </Text>
          <View style={styles.reportMeta}>
            <Ionicons name="location-outline" size={12} color={C.textSecondary} />
            <Text style={styles.reportMetaText}>
              {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
            </Text>
            <Ionicons name="checkmark-circle-outline" size={12} color={C.textSecondary} style={{ marginLeft: 8 }} />
            <Text style={styles.reportMetaText}>{item.confirmations_count} tasdiq</Text>
          </View>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={14} color={C.danger} />
            <Text style={styles.deleteBtnText}>O'chirish</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

function AddMachineTab() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [operator, setOperator] = useState("");
  const [rewardType, setRewardType] = useState<RewardType>("bonus");
  const [rewardDesc, setRewardDesc] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<MachineStatus>("active");

  const reset = () => {
    setName(""); setAddress(""); setLat(""); setLng("");
    setOperator(""); setRewardDesc(""); setWorkingHours(""); setPhone("");
    setRewardType("bonus"); setStatus("active");
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim() || !lat || !lng) {
      Alert.alert("Xato", "Nom, manzil, kenglik va uzunlik majburiy maydonlar");
      return;
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      Alert.alert("Xato", "Koordinatalar raqam bo'lishi kerak");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("reverse_vending_machines").insert({
      name: name.trim(),
      address: address.trim(),
      lat: latNum,
      lng: lngNum,
      operator: operator.trim() || null,
      reward_type: rewardType,
      reward_description: rewardDesc.trim() || null,
      working_hours: workingHours.trim() || null,
      phone: phone.trim() || null,
      status,
      verification_count: 0,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Xato", error.message);
    } else {
      Alert.alert("Muvaffaqiyat", "Yangi avtomat qo'shildi!");
      await qc.invalidateQueries({ queryKey: ["machines"] });
      reset();
    }
  };

  return (
    <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.formTitle}>Yangi avtomat qo'shish</Text>
      <InputField label="Nomi *" value={name} onChangeText={setName} placeholder="Avtomat nomi" />
      <InputField label="Manzil *" value={address} onChangeText={setAddress} placeholder="To'liq manzil" />
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <InputField label="Kenglik *" value={lat} onChangeText={setLat} placeholder="41.2995" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <InputField label="Uzunlik *" value={lng} onChangeText={setLng} placeholder="69.2401" keyboardType="decimal-pad" />
        </View>
      </View>
      <InputField label="Operator" value={operator} onChangeText={setOperator} placeholder="Kompaniya nomi" />
      <SelectField label="Mukofot turi" value={rewardType} options={REWARD_TYPES} onSelect={setRewardType} />
      <InputField label="Mukofot tavsifi" value={rewardDesc} onChangeText={setRewardDesc} placeholder="Har 10 ta shisha uchun 500 so'm" multiline />
      <InputField label="Ish vaqti" value={workingHours} onChangeText={setWorkingHours} placeholder="08:00–20:00" />
      <InputField label="Telefon" value={phone} onChangeText={setPhone} placeholder="+998 90 000 00 00" keyboardType="phone-pad" />
      <SelectField label="Holati" value={status} options={MACHINE_STATUSES} onSelect={setStatus} />
      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Saqlash</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function AddPointTab() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [type, setType] = useState<RecyclingType>("mixed");

  const reset = () => {
    setName(""); setAddress(""); setLat(""); setLng(""); setType("mixed");
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim() || !lat || !lng) {
      Alert.alert("Xato", "Barcha majburiy maydonlarni to'ldiring");
      return;
    }
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      Alert.alert("Xato", "Koordinatalar raqam bo'lishi kerak");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("recycling_points").insert({
      name: name.trim(),
      address: address.trim(),
      lat: latNum,
      lng: lngNum,
      type,
      is_verified: true,
      verification_count: 0,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Xato", error.message);
    } else {
      Alert.alert("Muvaffaqiyat", "Yangi qayta ishlash nuqtasi qo'shildi!");
      await qc.invalidateQueries({ queryKey: ["recycling"] });
      reset();
    }
  };

  return (
    <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.formTitle}>Yangi qayta ishlash nuqtasi</Text>
      <InputField label="Nomi *" value={name} onChangeText={setName} placeholder="Qayta ishlash markazi" />
      <InputField label="Manzil *" value={address} onChangeText={setAddress} placeholder="To'liq manzil" />
      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <InputField label="Kenglik *" value={lat} onChangeText={setLat} placeholder="41.2995" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <InputField label="Uzunlik *" value={lng} onChangeText={setLng} placeholder="69.2401" keyboardType="decimal-pad" />
        </View>
      </View>
      <SelectField label="Turi" value={type} options={RECYCLING_TYPES} onSelect={setType} />
      <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Saqlash</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function UsersTab() {
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery<{ user_id: string; full_name: string | null; eco_score: number; role: string | null; created_at: string }[]>({
    queryKey: ["/admin/users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, eco_score, role, created_at")
        .order("eco_score", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["/admin/users"] });
    setRefreshing(false);
  };

  const handleSetAdmin = (userId: string, currentRole: string | null) => {
    const isAdmin = currentRole === "admin";
    Alert.alert(
      isAdmin ? "Admin huquqini olish" : "Admin qilish",
      isAdmin ? "Bu foydalanuvchidan admin huquqini olasizmi?" : "Bu foydalanuvchini admin qilasizmi?",
      [
        { text: "Bekor qilish", style: "cancel" },
        {
          text: "Tasdiqlash",
          onPress: async () => {
            await supabase
              .from("profiles")
              .update({ role: isAdmin ? "user" : "admin" })
              .eq("user_id", userId);
            await qc.invalidateQueries({ queryKey: ["/admin/users"] });
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.user_id}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} tintColor={C.primary} />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={C.border} />
          <Text style={styles.emptyText}>Foydalanuvchilar yo'q</Text>
        </View>
      }
      renderItem={({ item, index }) => {
        const initials = (item.full_name ?? "?").charAt(0).toUpperCase();
        const isAdmin = item.role === "admin";
        return (
          <View style={styles.userCard}>
            <View style={[styles.userAvatar, isAdmin && { backgroundColor: "#FEF3C7" }]}>
              <Text style={[styles.userInitial, isAdmin && { color: "#D97706" }]}>{initials}</Text>
            </View>
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName}>{item.full_name ?? "Anonim"}</Text>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </View>
              <Text style={styles.userScore}>#{index + 1} • {item.eco_score} ball</Text>
            </View>
            <TouchableOpacity style={styles.roleBtn} onPress={() => handleSetAdmin(item.user_id, item.role)}>
              <Ionicons
                name={isAdmin ? "shield-checkmark" : "shield-outline"}
                size={20}
                color={isAdmin ? "#D97706" : C.textSecondary}
              />
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("reports");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (profile?.role !== "admin") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Admin panel</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={64} color={C.border} />
          <Text style={styles.lockedTitle}>Kirish taqiqlangan</Text>
          <Text style={styles.lockedSub}>Bu sahifa faqat adminlar uchun</Text>
        </View>
      </View>
    );
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "reports", label: "Hisobotlar", icon: "document-text-outline" },
    { id: "add_machine", label: "Avtomat", icon: "hardware-chip-outline" },
    { id: "add_point", label: "Nuqta", icon: "location-outline" },
    { id: "users", label: "Foydalanuvchilar", icon: "people-outline" },
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Admin panel</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.id ? C.primary : C.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.content}>
        {activeTab === "reports" && <ReportsTab />}
        {activeTab === "add_machine" && <AddMachineTab />}
        {activeTab === "add_point" && <AddPointTab />}
        {activeTab === "users" && <UsersTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  navTitle: { fontSize: 17, fontFamily: "Nunito_700Bold", color: C.text },
  tabBar: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    gap: 2,
  },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: C.primary },
  tabLabel: { fontSize: 10, fontFamily: "Nunito_600SemiBold", color: C.textSecondary },
  tabLabelActive: { color: C.primary },
  content: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  lockedTitle: { fontSize: 20, fontFamily: "Nunito_700Bold", color: C.text, marginTop: 8 },
  lockedSub: { fontSize: 14, fontFamily: "Nunito_400Regular", color: C.textSecondary, textAlign: "center" },

  listContent: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: "center", gap: 8, paddingTop: 60 },
  emptyText: { fontSize: 15, fontFamily: "Nunito_600SemiBold", color: C.textSecondary },

  reportCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  reportHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  typeBadge: { backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontFamily: "Nunito_600SemiBold", color: "#EF4444" },
  reportTime: { fontSize: 11, fontFamily: "Nunito_400Regular", color: C.textSecondary },
  reportDesc: { fontSize: 13, fontFamily: "Nunito_400Regular", color: C.text, lineHeight: 18, marginBottom: 8 },
  reportMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 10 },
  reportMetaText: { fontSize: 11, fontFamily: "Nunito_400Regular", color: C.textSecondary },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#FEE2E2",
  },
  deleteBtnText: { fontSize: 12, fontFamily: "Nunito_600SemiBold", color: C.danger },

  formScroll: { flex: 1 },
  formContent: { padding: 16, paddingBottom: 40, gap: 4 },
  formTitle: { fontSize: 18, fontFamily: "Nunito_700Bold", color: C.text, marginBottom: 12 },
  row: { flexDirection: "row" },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 12, fontFamily: "Nunito_600SemiBold", color: C.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
    color: C.text,
  },
  inputMultiline: { height: 80, textAlignVertical: "top" },
  selectRow: { gap: 8, paddingVertical: 2 },
  selectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: C.border,
  },
  selectChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  selectChipText: { fontSize: 13, fontFamily: "Nunito_600SemiBold", color: C.textSecondary },
  selectChipTextActive: { color: "#fff" },
  saveBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontFamily: "Nunito_700Bold", color: "#fff" },

  userCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  userInitial: { fontSize: 18, fontFamily: "Nunito_700Bold", color: C.primary },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 14, fontFamily: "Nunito_700Bold", color: C.text },
  adminBadge: { backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  adminBadgeText: { fontSize: 10, fontFamily: "Nunito_600SemiBold", color: "#D97706" },
  userScore: { fontSize: 12, fontFamily: "Nunito_400Regular", color: C.textSecondary, marginTop: 2 },
  roleBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
