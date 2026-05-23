import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationHandler } from "@/components/NotificationHandler";

SplashScreen.preventAutoHideAsync();

const KeyboardWrapper = Platform.OS === "web"
  ? ({ children }: { children: React.ReactNode }) => <View style={{ flex: 1 }}>{children}</View>
  : (() => {
      const { KeyboardProvider } = require("react-native-keyboard-controller");
      return ({ children }: { children: React.ReactNode }) => <KeyboardProvider>{children}</KeyboardProvider>;
    })();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="report-modal" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="report-detail" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}

async function loadFontsWeb() {
  try {
    const faces = [
      { name: "Nunito_400Regular",   src: require("../assets/fonts/Nunito_400Regular.ttf") },
      { name: "Nunito_600SemiBold",  src: require("../assets/fonts/Nunito_600SemiBold.ttf") },
      { name: "Nunito_700Bold",      src: require("../assets/fonts/Nunito_700Bold.ttf") },
      { name: "Nunito_800ExtraBold", src: require("../assets/fonts/Nunito_800ExtraBold.ttf") },
    ];
    await Promise.all(
      faces.map(async ({ name, src }) => {
        try {
          const url = typeof src === "string" ? src : src?.uri ?? src;
          const face = new (window as any).FontFace(name, `url(${url})`);
          const loaded = await face.load();
          (document as any).fonts.add(loaded);
        } catch (_) {}
      })
    );
  } catch (_) {}
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        if (Platform.OS === "web") {
          await loadFontsWeb();
        } else {
          await Font.loadAsync({
            Nunito_400Regular:   require("../assets/fonts/Nunito_400Regular.ttf"),
            Nunito_600SemiBold:  require("../assets/fonts/Nunito_600SemiBold.ttf"),
            Nunito_700Bold:      require("../assets/fonts/Nunito_700Bold.ttf"),
            Nunito_800ExtraBold: require("../assets/fonts/Nunito_800ExtraBold.ttf"),
          });
        }
      } catch (_) {
      } finally {
        setReady(true);
        SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationHandler />
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardWrapper>
              <RootLayoutNav />
            </KeyboardWrapper>
          </GestureHandlerRootView>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
