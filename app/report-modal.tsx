import { sh } from "@/constants/shadow";
import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, incrementEcoScore } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { IssueType } from "@/lib/supabase";
import Colors from "@/constants/colors";
import { fetch } from "expo/fetch";

const C = Colors.light;

const ISSUE_TYPES: { value: IssueType; label: string; icon: string; color: string; bg: string }[] = [
  { value: "illegal_dumping", label: "Noqonuniy axlat tashlash", icon: "trash-outline", color: "#DC2626", bg: "#FEE2E2" },
  { value: "tree_cutting", label: "Daraxt kesish", icon: "leaf-outline", color: "#16A34A", bg: "#DCFCE7" },
  { value: "water_pollution", label: "Suv ifloslanishi", icon: "water-outline", color: "#2563EB", bg: "#DBEAFE" },
  { value: "air_pollution", label: "Havo ifloslanishi", icon: "cloud-outline", color: "#7C3AED", bg: "#EDE9FE" },
  { value: "other", label: "Boshqa muammo", icon: "alert-circle-outline", color: "#D97706", bg: "#FEF3C7" },
];

export default function ReportModal() {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState(1);
  const [issueType, setIssueType] = useState<IssueType>("illegal_dumping");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [locLoading, setLocLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);
    } catch {
      Alert.alert("Xato", "Geolokatsiya olishda xatolik yuz berdi");
    }
    setLocLoading(false);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Ruxsat yo'q", "Galereya uchun ruxsat berilmadi");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Ruxsat yo'q", "Kamera uchun ruxsat berilmadi");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const fileName = `report_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { data, error } = await supabase.storage
        .from("report-photos")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });
      if (error) return null;
      const { data: urlData } = supabase.storage.from("report-photos").getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("Kirish kerak", "Xabar berish uchun tizimga kiring", [
        { text: "Kirish", onPress: () => router.push("/auth") },
        { text: "Bekor qilish", style: "cancel" },
      ]);
      return;
    }
    if (lat === 0 && lng === 0) {
      Alert.alert("Xato", "Joylashuv aniqlanmadi. Qayta urinib ko'ring.");
      return;
    }

    setSaving(true);
    let photoUrl: string | null = null;
    if (photo) {
      photoUrl = await uploadPhoto(photo);
    }

    const { error } = await supabase.from("reports").insert({
      lat,
      lng,
      description: description.trim() || ISSUE_TYPES.find(t => t.value === issueType)?.label || "Muammo",
      photo_url: photoUrl,
      user_id: user.id,
      confirmations_count: 0,
      issue_type: issueType,
    });

    setSaving(false);

    if (error) {
      Alert.alert("Xato", error.message);
    } else {
      await incrementEcoScore(user.id, 10);
      await qc.invalidateQueries({ queryKey: ["/api/reports"] });
      await qc.invalidateQueries({ queryKey: ["reports"] });
      await qc.invalidateQueries({ queryKey: ["/api/my-reports", user.id] });
      refreshProfile();
      Alert.alert("Muvaffaqiyatli! 🌱", "Muammo xabari yuborildi. +10 eko-ball!\nRahmat!", [
        {
          text: "Ulashish",
          onPress: async () => {
            try {
              await Share.share({
                message: `Eco-Xarita: ${ISSUE_TYPES.find(t => t.value === issueType)?.label || "Muammo"} — joylashuv: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                title: "Eco-Xarita muammo xabari",
              });
            } catch {}
            router.back();
          },
        },
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  };

  const selectedType = ISSUE_TYPES.find(t => t.value === issueType)!;

  return (
    <View style={styles.container}>
      <View style={[styles.handleBar, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 8 }]}>
        <View style={styles.handle} />
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => {
              if (step > 1) setStep(step - 1);
              else router.back();
            }}
            style={styles.backBtn}
          >
            <Ionicons name={step > 1 ? "arrow-back" : "close"} size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Muammo xabari</Text>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>{step}/3</Text>
          </View>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` as any }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Muammo turini tanlang</Text>
            <Text style={styles.stepSub}>Qaysi turdagi ekologik muammoni xohlaysiz xabar qiling?</Text>
            <View style={styles.issueList}>
              {ISSUE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.issueItem,
                    issueType === type.value && { borderColor: type.color, borderWidth: 2 },
                  ]}
                  onPress={() => setIssueType(type.value)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.issueIcon, { backgroundColor: type.bg }]}>
                    <Ionicons name={type.icon as any} size={24} color={type.color} />
                  </View>
                  <Text style={styles.issueLabel}>{type.label}</Text>
                  {issueType === type.value && (
                    <Ionicons name="checkmark-circle" size={22} color={type.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => setStep(2)}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Keyingisi</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Rasm va tavsif</Text>
            <Text style={styles.stepSub}>Muammo haqida qisqacha tushuntiring va rasm qo'shing (ixtiyoriy)</Text>

            <View style={[styles.issueChip, { backgroundColor: selectedType.bg }]}>
              <Ionicons name={selectedType.icon as any} size={16} color={selectedType.color} />
              <Text style={[styles.issueChipText, { color: selectedType.color }]}>{selectedType.label}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Rasm (ixtiyoriy)</Text>
              {photo ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photo }} style={styles.photo} />
                  <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}>
                    <Ionicons name="close-circle" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoRow}>
                  <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={26} color={C.primary} />
                    <Text style={styles.photoBtnText}>Kamera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                    <Ionicons name="image-outline" size={26} color={C.primary} />
                    <Text style={styles.photoBtnText}>Galereya</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tavsif (ixtiyoriy)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Muammo haqida batafsil yozing..."
                placeholderTextColor={C.border}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => setStep(3)}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Keyingisi</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Joylashuvni tasdiqlang</Text>
            <Text style={styles.stepSub}>GPS orqali aniqlangan joylashuv</Text>

            <View style={[styles.issueChip, { backgroundColor: selectedType.bg }]}>
              <Ionicons name={selectedType.icon as any} size={16} color={selectedType.color} />
              <Text style={[styles.issueChipText, { color: selectedType.color }]}>{selectedType.label}</Text>
            </View>

            {photo && (
              <View style={styles.photoPreviewSmall}>
                <Image source={{ uri: photo }} style={styles.photoSmall} />
                <Text style={styles.photoLabel}>Rasm tanlandi</Text>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Joylashuv</Text>
              <View style={styles.locationBox}>
                <Ionicons name="location" size={20} color={C.primary} />
                {locLoading ? (
                  <ActivityIndicator size="small" color={C.primary} style={{ marginLeft: 8 }} />
                ) : lat && lng ? (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationText}>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>
                    <Text style={styles.locationSub}>GPS orqali aniqlandi</Text>
                  </View>
                ) : (
                  <Text style={styles.locationEmpty}>Joylashuv aniqlanmadi</Text>
                )}
                <TouchableOpacity onPress={getLocation} style={styles.refreshBtn}>
                  <Ionicons name="refresh" size={18} color={C.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitText}>Yuborish</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  handleBar: {
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    paddingBottom: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontFamily: "Nunito_700Bold",
    fontSize: 17,
    color: C.text,
  },
  stepIndicator: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  stepText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 12,
    color: C.primary,
  },
  progressBar: {
    height: 3,
    backgroundColor: C.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  scroll: { flexGrow: 1 },
  stepContent: { padding: 20, gap: 16 },
  stepTitle: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 22,
    color: C.text,
  },
  stepSub: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 20,
  },
  issueList: { gap: 10 },
  issueItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  issueIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  issueLabel: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 15,
    color: C.text,
    flex: 1,
  },
  issueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  issueChipText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
  },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 12,
    color: C.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  photoRow: { flexDirection: "row", gap: 12 },
  photoBtn: {
    flex: 1,
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F9FAFB",
  },
  photoBtnText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    color: C.primary,
  },
  photoPreview: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  photo: { width: "100%", height: 200, borderRadius: 12 },
  removePhoto: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  photoPreviewSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 10,
  },
  photoSmall: { width: 56, height: 56, borderRadius: 8 },
  photoLabel: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    color: C.text,
  },
  textArea: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 14,
    fontFamily: "Nunito_400Regular",
    fontSize: 15,
    color: C.text,
    minHeight: 100,
  },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  locationText: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 14,
    color: C.text,
  },
  locationSub: {
    fontFamily: "Nunito_400Regular",
    fontSize: 11,
    color: C.textSecondary,
  },
  locationEmpty: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    flex: 1,
  },
  refreshBtn: { padding: 4 },
  nextBtn: {
    backgroundColor: C.primary,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    ...sh.green,
  },
  nextBtnText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  submitBtn: {
    backgroundColor: C.primary,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    ...sh.green,
  },
  submitText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    color: "#fff",
  },
});
