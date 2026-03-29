import { Platform } from "react-native";

const ws = (box: string) =>
  Platform.OS === "web" ? ({ boxShadow: box } as any) : {};

export const sh = {
  sm: Platform.select({
    web: { boxShadow: "0px 1px 4px rgba(0,0,0,0.10)" } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
  }),
  md: Platform.select({
    web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.12)" } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.10,
      shadowRadius: 8,
      elevation: 3,
    },
  }),
  lg: Platform.select({
    web: { boxShadow: "0px 4px 16px rgba(0,0,0,0.14)" } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.13,
      shadowRadius: 12,
      elevation: 5,
    },
  }),
  xl: Platform.select({
    web: { boxShadow: "0px 6px 24px rgba(0,0,0,0.16)" } as any,
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
  }),
  green: Platform.select({
    web: { boxShadow: "0px 4px 12px rgba(46,125,50,0.35)" } as any,
    default: {
      shadowColor: "#2E7D32",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.30,
      shadowRadius: 8,
      elevation: 5,
    },
  }),
  greenXl: Platform.select({
    web: { boxShadow: "0px 6px 20px rgba(46,125,50,0.40)" } as any,
    default: {
      shadowColor: "#2E7D32",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
  }),
};
