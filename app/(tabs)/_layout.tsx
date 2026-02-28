import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, useColorScheme } from "react-native";
import React from "react";
import Colors from "@/constants/colors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "map", selected: "map.fill" }} />
        <Label>Xarita</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reports">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet.circle.fill" }} />
        <Label>Muammolar</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recycling">
        <Icon sf={{ default: "arrow.3.trianglepath", selected: "arrow.3.trianglepath" }} />
        <Label>Qayta ishlash</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profil</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const C = Colors.light;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.tabIconDefault,
        headerShown: false,
        tabBarLabelStyle: {
          fontFamily: "Nunito_600SemiBold",
          fontSize: 11,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: isDark ? "#111" : "#fff",
          }),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: C.border,
          elevation: 0,
          height: 84,
          paddingBottom: 34,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={90}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Xarita",
          tabBarIcon: ({ color, size }) => {
            const { Ionicons } = require("@expo/vector-icons");
            return <Ionicons name="map" size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Muammolar",
          tabBarIcon: ({ color, size }) => {
            const { Ionicons } = require("@expo/vector-icons");
            return <Ionicons name="list" size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="recycling"
        options={{
          title: "Qayta ishlash",
          tabBarIcon: ({ color, size }) => {
            const { MaterialCommunityIcons } = require("@expo/vector-icons");
            return <MaterialCommunityIcons name="recycle" size={size} color={color} />;
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => {
            const { Ionicons } = require("@expo/vector-icons");
            return <Ionicons name="person" size={size} color={color} />;
          },
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
