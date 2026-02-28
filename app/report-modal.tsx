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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";
import { fetch } from "expo/fetch";
import { File } from "expo-file-system";

const C = Colors.light;

export default function ReportModal() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [lat, setLat] = useState(params.lat ? parseFloat(params.lat) : 0);
  const [lng, setLng] = useState(params.lng ? parseFloat(params.lng) : 0);
  const [locLoading, setLocLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params.lat || !params.lng) {
      getLocation();
    }
  }, []);

  const getLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Ruxsat yo'q", "Geolokatsiya uchun ruxsat berilmadi");
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
      const file = new File(uri, "image/jpeg");
      const formData = new FormData();
      formData.append("file", file as any);

      const { data, error } = await supabase.storage
        .from("report-photos")
        .upload(fileName, formData as any, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (error) {
        // Fallback: upload via fetch
        const response = await fetch(uri);
        const blob = await response.blob();
        const { data: d2, error: e2 } = await supabase.storage
          .from("report-photos")
          .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });
        if (e2) return null;
        const { data: urlData } = supabase.storage.from("report-photos").getPublicUrl(d2.path);
        return urlData.publicUrl;
      }

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
    if (!description.trim()) {
      Alert.alert("Xato", "Muammo tavsifini kiriting");
      return;
    }
    if (!lat || !lng) {
      Alert.alert("Xato", "Joylashuv aniqlanmadi");
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
      description: description.trim(),
      photo_url: photoUrl,
      user_id: user.id,
      confirmations_count: 0,
    });

    setSaving(false);

    if (error) {
      Alert.alert("Xato", error.message);
    } else {
      await qc.invalidateQueries({ queryKey: ["/api/reports"] });
      Alert.alert("Muvaffaqiyatli!", "Muammo xabari yuborildi", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Handle */}
      <View style={[styles.handleBar, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 8 }]}>
        <View style={styles.handle} />
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={22} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Muammo xabari</Text>
          <View style={{ width: 36 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rasm</Text>
          {photo ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity
                style={styles.removePhoto}
                onPress={() => setPhoto(null)}
              >
                <Ionicons name="close-circle" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={24} color={C.primary} />
                <Text style={styles.photoBtnText}>Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                <Ionicons name="image-outline" size={24} color={C.primary} />
                <Text style={styles.photoBtnText}>Galereya</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tavsif *</Text>
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

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Joylashuv</Text>
          <View style={styles.locationBox}>
            <Ionicons name="location" size={18} color={C.primary} />
            {locLoading ? (
              <ActivityIndicator size="small" color={C.primary} style={{ marginLeft: 8 }} />
            ) : lat && lng ? (
              <Text style={styles.locationText}>
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </Text>
            ) : (
              <Text style={styles.locationEmpty}>Joylashuv aniqlanmadi</Text>
            )}
            <TouchableOpacity onPress={getLocation} style={styles.refreshBtn}>
              <Ionicons name="refresh" size={16} color={C.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit */}
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
  scroll: { padding: 20, gap: 24 },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    color: C.text,
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
    flex: 1,
  },
  locationEmpty: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    flex: 1,
  },
  refreshBtn: { padding: 4 },
  submitBtn: {
    backgroundColor: C.primary,
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 16,
    color: "#fff",
  },
});
