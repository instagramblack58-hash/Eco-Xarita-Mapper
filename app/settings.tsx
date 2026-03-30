import { sh } from "@/constants/shadow";
import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

const C = Colors.light;
const APP_VERSION = "1.0.0";

function SettingRow({
  icon,
  iconColor = C.primary,
  iconBg = "#E8F5E9",
  label,
  sublabel,
  onPress,
  arrow = true,
  danger = false,
}: {
  icon: string;
  iconColor?: string;
  iconBg?: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  arrow?: boolean;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, danger && { color: C.danger }]}>{label}</Text>
        {sublabel && <Text style={styles.rowSublabel}>{sublabel}</Text>}
      </View>
      {arrow && onPress && (
        <Ionicons name="chevron-forward" size={16} color={C.textSecondary} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sozlamalar</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* App banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <MaterialCommunityIcons name="leaf" size={38} color="#fff" />
          </View>
          <Text style={styles.bannerName}>Eco-Xarita</Text>
          <Text style={styles.bannerVersion}>Versiya {APP_VERSION}</Text>
          <Text style={styles.bannerDesc}>
            O'zbekistonda ekologik muammolarni xabarlash va qayta ishlash nuqtalarini topish uchun ilova
          </Text>
        </View>

        {/* How to use */}
        <Text style={styles.sectionHeader}>QANDAY FOYDALANISH</Text>
        <View style={styles.card}>
          <View style={styles.guideRow}>
            <View style={[styles.guideNum, { backgroundColor: "#E8F5E9" }]}>
              <Text style={[styles.guideNumText, { color: C.primary }]}>1</Text>
            </View>
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>Muammo aniqlang</Text>
              <Text style={styles.guideSub}>
                Atrofingizda noqonuniy axlat, suv ifloslanishi yoki boshqa muammolarni aniqlang
              </Text>
            </View>
          </View>
          <View style={styles.guideDivider} />
          <View style={styles.guideRow}>
            <View style={[styles.guideNum, { backgroundColor: "#DBEAFE" }]}>
              <Text style={[styles.guideNumText, { color: "#2563EB" }]}>2</Text>
            </View>
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>Xabar bering</Text>
              <Text style={styles.guideSub}>
                "+" tugmasini bosib, muammo turini tanlang, rasm va tavsif qo'shing
              </Text>
            </View>
          </View>
          <View style={styles.guideDivider} />
          <View style={styles.guideRow}>
            <View style={[styles.guideNum, { backgroundColor: "#E8F5E9" }]}>
              <Text style={[styles.guideNumText, { color: C.primary }]}>3</Text>
            </View>
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>Eko-ball to'plang</Text>
              <Text style={styles.guideSub}>
                Xabarlar yuborish va tasdiqlash uchun eko-ball to'plab, reytingda ko'tarilasiz
              </Text>
            </View>
          </View>
          <View style={styles.guideDivider} />
          <View style={styles.guideRow}>
            <View style={[styles.guideNum, { backgroundColor: "#FEF3C7" }]}>
              <Text style={[styles.guideNumText, { color: "#D97706" }]}>4</Text>
            </View>
            <View style={styles.guideContent}>
              <Text style={styles.guideTitle}>Qayta ishlash nuqtalarini toping</Text>
              <Text style={styles.guideSub}>
                "Qayta ishlash" bo'limida yaqin atrofingizdagi nuqtalarni toping
              </Text>
            </View>
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionHeader}>ILOVA HAQIDA</Text>
        <View style={styles.card}>
          <SettingRow
            icon="leaf-outline"
            label="Missiya"
            sublabel="O'zbekiston ekologiyasini yaxshilash"
            arrow={false}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="people-outline"
            iconBg="#EDE9FE"
            iconColor="#7C3AED"
            label="Jamiyat"
            sublabel="Faol foydalanuvchilar ekologiyani himoya qiladi"
            arrow={false}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="trophy-outline"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            label="Eko-ball tizimi"
            sublabel="Xabar uchun 10 ball, tasdiqlash uchun 1 ball"
            arrow={false}
          />
        </View>

        {/* Links */}
        <Text style={styles.sectionHeader}>HAVOLALAR</Text>
        <View style={styles.card}>
          <SettingRow
            icon="mail-outline"
            iconBg="#DBEAFE"
            iconColor="#2563EB"
            label="Fikr-mulohaza yuborish"
            sublabel="Xatolik yoki taklif bo'lsa yozing"
            onPress={() =>
              Linking.openURL("mailto:support@eco-xarita.uz?subject=Eco-Xarita%20Fikr").catch(() =>
                Alert.alert("Xato", "Email ilovasi topilmadi")
              )
            }
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="shield-checkmark-outline"
            iconBg="#F0FDF4"
            iconColor={C.primary}
            label="Maxfiylik siyosati"
            onPress={() =>
              Linking.openURL("https://eco-xarita.uz/privacy").catch(() => {})
            }
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="document-text-outline"
            iconBg="#F3F4F6"
            iconColor={C.text}
            label="Foydalanish shartlari"
            onPress={() =>
              Linking.openURL("https://eco-xarita.uz/terms").catch(() => {})
            }
          />
        </View>

        {/* App info */}
        <View style={styles.footer}>
          <MaterialCommunityIcons name="leaf" size={18} color={C.primary} />
          <Text style={styles.footerText}>Eco-Xarita © 2026</Text>
        </View>
        <Text style={styles.footerSub}>O'zbekiston ekologiyasi uchun birga kurashaylik</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
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
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },

  banner: {
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 8,
    gap: 8,
    ...sh.sm,
  },
  bannerIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    ...sh.greenXl,
    marginBottom: 4,
  },
  bannerName: { fontFamily: "Nunito_800ExtraBold", fontSize: 22, color: C.text },
  bannerVersion: { fontFamily: "Nunito_400Regular", fontSize: 13, color: C.textSecondary },
  bannerDesc: {
    fontFamily: "Nunito_400Regular", fontSize: 14,
    color: C.textSecondary, textAlign: "center", lineHeight: 21, marginTop: 4,
  },

  sectionHeader: {
    fontFamily: "Nunito_700Bold",
    fontSize: 11,
    color: C.textSecondary,
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 4,
  },

  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: "hidden",
    ...sh.sm,
    marginBottom: 4,
  },

  guideRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
  },
  guideNum: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },
  guideNumText: { fontFamily: "Nunito_800ExtraBold", fontSize: 14 },
  guideContent: { flex: 1, gap: 3 },
  guideTitle: { fontFamily: "Nunito_700Bold", fontSize: 14, color: C.text },
  guideSub: { fontFamily: "Nunito_400Regular", fontSize: 13, color: C.textSecondary, lineHeight: 19 },
  guideDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginHorizontal: 14 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 15, color: C.text },
  rowSublabel: { fontFamily: "Nunito_400Regular", fontSize: 12, color: C.textSecondary },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 62 },

  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 20,
  },
  footerText: { fontFamily: "Nunito_700Bold", fontSize: 13, color: C.text },
  footerSub: {
    fontFamily: "Nunito_400Regular", fontSize: 12, color: C.textSecondary,
    textAlign: "center", marginTop: 4, marginBottom: 8,
  },
});
