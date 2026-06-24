import React, { useEffect } from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 650 }),
        withTiming(1, { duration: 650 })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: "#E5E7EB" },
        animStyle,
        style,
      ]}
    />
  );
}

export function SkeletonReportCard() {
  return (
    <View style={sk.reportCard}>
      <View style={sk.reportThumb}>
        <Skeleton width={80} height={80} borderRadius={0} />
      </View>
      <View style={sk.reportBody}>
        <View style={sk.reportTopRow}>
          <Skeleton width="45%" height={11} />
          <Skeleton width="22%" height={11} />
        </View>
        <Skeleton width="92%" height={14} style={{ marginTop: 8 }} />
        <Skeleton width="55%" height={11} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

export function SkeletonShopCard() {
  return (
    <View style={sk.shopCard}>
      <Skeleton width={52} height={52} borderRadius={26} style={{ alignSelf: "center" }} />
      <Skeleton width="75%" height={13} style={{ alignSelf: "center", marginTop: 10 }} />
      <Skeleton width="50%" height={22} borderRadius={20} style={{ alignSelf: "center", marginTop: 8 }} />
      <Skeleton width="100%" height={34} borderRadius={10} style={{ marginTop: 10 }} />
    </View>
  );
}

export function SkeletonListItem() {
  return (
    <View style={sk.listItem}>
      <Skeleton width={52} height={52} borderRadius={14} />
      <View style={sk.listBody}>
        <Skeleton width="70%" height={14} />
        <View style={sk.listMetaRow}>
          <Skeleton width="30%" height={11} />
        </View>
        <Skeleton width="85%" height={11} style={{ marginTop: 5 }} />
        <Skeleton width="40%" height={11} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

export function SkeletonProfileStat() {
  return (
    <View style={sk.statCard}>
      <Skeleton width={20} height={20} borderRadius={10} />
      <Skeleton width="60%" height={18} style={{ marginTop: 4 }} />
      <Skeleton width="80%" height={10} style={{ marginTop: 3 }} />
    </View>
  );
}

const sk = StyleSheet.create({
  reportCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 0,
  },
  reportThumb: { width: 80, height: 80, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" },
  reportBody: { flex: 1, padding: 12, gap: 4, justifyContent: "center" },
  reportTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  shopCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },

  listItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    alignItems: "flex-start",
  },
  listBody: { flex: 1 },
  listMetaRow: { flexDirection: "row", gap: 8, marginTop: 6 },

  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 12,
    gap: 3,
  },
});
