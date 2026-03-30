import { sh } from "@/constants/shadow";
import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";

const C = Colors.light;

type Mode = "login" | "signup" | "forgot";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    const emailTrimmed = email.trim();

    if (mode === "forgot") {
      if (!emailTrimmed) {
        Alert.alert("Xato", "Email manzilini kiriting");
        return;
      }
      setLoading(true);
      const { error } = await resetPassword(emailTrimmed);
      setLoading(false);
      if (error) {
        Alert.alert("Xato", error);
      } else {
        Alert.alert(
          "Yuborildi!",
          "Parolni tiklash havolasi emailingizga yuborildi. Iltimos emailingizni tekshiring.",
          [{ text: "OK", onPress: () => setMode("login") }]
        );
      }
      return;
    }

    if (!emailTrimmed || !password.trim()) {
      Alert.alert("Xato", "Email va parolni kiriting");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Xato", "Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      return;
    }
    if (mode === "signup" && !fullName.trim()) {
      Alert.alert("Xato", "Ismingizni kiriting");
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { error } = await signIn(emailTrimmed, password);
      setLoading(false);
      if (error) {
        let msg = error;
        if (error.includes("Invalid login credentials")) msg = "Email yoki parol noto'g'ri";
        else if (error.includes("Email not confirmed")) msg = "Email tasdiqlang. Pochta qutingizni tekshiring.";
        Alert.alert("Xato", msg);
      } else {
        router.back();
      }
    } else {
      const { error } = await signUp(emailTrimmed, password, fullName.trim());
      setLoading(false);
      if (error) {
        let msg = error;
        if (error.includes("already registered")) msg = "Bu email allaqachon ro'yxatdan o'tgan";
        Alert.alert("Xato", msg);
      } else {
        Alert.alert(
          "Muvaffaqiyatli! 🎉",
          "Hisob yaratildi. Emailingizga tasdiqlash havolasi yuborildi.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={C.text} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoRow}>
          <MaterialCommunityIcons name="leaf" size={36} color={C.primary} />
          <Text style={styles.logoText}>Eco-Xarita</Text>
        </View>

        {mode === "forgot" ? (
          <>
            <Text style={styles.title}>Parolni tiklash</Text>
            <Text style={styles.subtitle}>
              Emailingizni kiriting, parol tiklash havolasini yuboramiz
            </Text>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={18} color={C.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="example@mail.com"
                    placeholderTextColor={C.border}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={handleSubmit}
                  />
                </View>
              </View>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Havola yuborish</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode("login")} style={styles.forgotLink}>
                <Ionicons name="arrow-back" size={16} color={C.primary} />
                <Text style={styles.forgotText}>Kirishga qaytish</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>
              {mode === "login" ? "Xush kelibsiz!" : "Hisob yarating"}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "login"
                ? "Hisobingizga kiring"
                : "Yangi hisob yarating va eko-faoliyatni boshlang"}
            </Text>

            {/* Toggle */}
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === "login" && styles.toggleActive]}
                onPress={() => setMode("login")}
              >
                <Text style={[styles.toggleText, mode === "login" && styles.toggleActiveText]}>
                  Kirish
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, mode === "signup" && styles.toggleActive]}
                onPress={() => setMode("signup")}
              >
                <Text style={[styles.toggleText, mode === "signup" && styles.toggleActiveText]}>
                  Ro'yxatdan o'tish
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {mode === "signup" && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Ismingiz</Text>
                  <View style={styles.inputBox}>
                    <Ionicons name="person-outline" size={18} color={C.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ism Familiya"
                      placeholderTextColor={C.border}
                      value={fullName}
                      onChangeText={setFullName}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={18} color={C.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    placeholder="example@mail.com"
                    placeholderTextColor={C.border}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Parol</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={18} color={C.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={C.border}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                    <Ionicons
                      name={showPass ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={C.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
                  </Text>
                )}
              </TouchableOpacity>

              {mode === "login" && (
                <TouchableOpacity onPress={() => setMode("forgot")} style={styles.forgotLink}>
                  <Text style={styles.forgotText}>Parolni unutdingizmi?</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  closeBtn: {
    alignSelf: "flex-end",
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
    marginBottom: 24,
  },
  logoRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24,
  },
  logoText: { fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: C.text },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 28, color: C.text, marginBottom: 6 },
  subtitle: { fontFamily: "Nunito_400Regular", fontSize: 15, color: C.textSecondary, marginBottom: 28, lineHeight: 22 },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12, padding: 3, marginBottom: 28,
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10,
  },
  toggleActive: { backgroundColor: "#fff", ...sh.sm },
  toggleText: { fontFamily: "Nunito_600SemiBold", fontSize: 14, color: C.textSecondary },
  toggleActiveText: { color: C.text },
  form: { gap: 20 },
  inputGroup: { gap: 6 },
  inputLabel: { fontFamily: "Nunito_600SemiBold", fontSize: 13, color: C.text },
  inputBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB", borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, height: 52,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontFamily: "Nunito_400Regular", fontSize: 15, color: C.text },
  eyeBtn: { padding: 4 },
  submitBtn: {
    backgroundColor: C.primary, height: 52, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginTop: 8,
    ...sh.green,
  },
  submitText: { fontFamily: "Nunito_700Bold", fontSize: 16, color: "#fff" },
  forgotLink: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 8,
  },
  forgotText: { fontFamily: "Nunito_600SemiBold", fontSize: 14, color: C.primary },
});
