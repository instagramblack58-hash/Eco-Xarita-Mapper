import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

const C = Colors.light;

export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <Stack.Screen options={{ title: "Topilmadi", headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="map-search-outline" size={52} color={C.primary} />
        </View>
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>Sahifa topilmadi</Text>
        <Text style={styles.sub}>
          Siz qidirgan sahifa mavjud emas yoki o'chirib tashlangan bo'lishi mumkin.
        </Text>
        <Link href="/" asChild>
          <TouchableOpacity style={styles.btn} activeOpacity={0.85}>
            <Ionicons name="home-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>Bosh sahifaga qaytish</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "#F9FAFB",
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  code: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 56,
    color: C.primary,
    lineHeight: 60,
  },
  title: {
    fontFamily: "Nunito_700Bold",
    fontSize: 22,
    color: C.text,
    marginTop: 8,
    marginBottom: 10,
    textAlign: "center",
  },
  sub: {
    fontFamily: "Nunito_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  btnText: {
    fontFamily: "Nunito_700Bold",
    fontSize: 15,
    color: "#fff",
  },
});
