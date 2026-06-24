import React from "react";
import { Pressable, ViewStyle, StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

interface PressableScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  disabled?: boolean;
  activeScale?: number;
  testID?: string;
}

export function PressableScale({
  onPress,
  onLongPress,
  style,
  children,
  disabled = false,
  activeScale = 0.97,
  testID,
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(activeScale, { damping: 18, stiffness: 350 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 250 });
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={style}
      testID={testID}
    >
      <Animated.View style={animStyle}>{children}</Animated.View>
    </Pressable>
  );
}
