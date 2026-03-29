import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

// Notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function NotificationHandler() {
  const { user } = useAuth();
  // 'any' ishlatamiz – Subscription tipi eskirgan, ammo ishlaydi
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    const registerForPush = async () => {
      // TypeScript xatolarini @ts-ignore bilan chetlab o'tish
      // @ts-ignore – argumentlar soni haqidagi xatolikni bartaraf qilish
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        // @ts-ignore
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.log("Push notification permission not granted");
        return;
      }

      // @ts-ignore – getExpoPushTokenAsync versiyaga qarab argument talab qilishi mumkin
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log("Expo push token:", token);

      if (user) {
        try {
          await supabase.from("push_tokens").upsert({
            user_id: user.id,
            token,
            platform: Platform.OS,
          });
        } catch (error) {
          console.error("Error saving push token:", error);
        }
      }
    };

    registerForPush();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received:", notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data && typeof data === "object" && "reportId" in data) {
        const reportId = String(data.reportId);
        // Navigatsiya uchun router.push ishlating
        console.log("Navigate to report", reportId);
        // router.push(`/report-detail?id=${reportId}`);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  return null;
}