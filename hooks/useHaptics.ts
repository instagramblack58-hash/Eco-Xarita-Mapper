import { Platform } from "react-native";

type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

async function runHaptic(type: HapticType) {
  if (Platform.OS === "web") return;
  try {
    const Haptics = await import("expo-haptics");
    switch (type) {
      case "light":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case "medium":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case "heavy":
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case "success":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case "warning":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case "error":
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case "selection":
        await Haptics.selectionAsync();
        break;
    }
  } catch {}
}

export function useHaptics() {
  return {
    light: () => runHaptic("light"),
    medium: () => runHaptic("medium"),
    heavy: () => runHaptic("heavy"),
    success: () => runHaptic("success"),
    warning: () => runHaptic("warning"),
    error: () => runHaptic("error"),
    selection: () => runHaptic("selection"),
  };
}
