import { useEffect, useRef } from "react";
import { Platform } from "react-native";

export function NotificationHandler() {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (Platform.OS === "web") return;

    const setup = async () => {
      try {
        const Notifications = await import("expo-notifications");

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== "granted") {
          await Notifications.requestPermissionsAsync();
        }

        notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
        responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});
      } catch (e) {
        console.log("Notification setup skipped:", e);
      }
    };

    setup();

    return () => {
      notificationListener.current?.remove?.();
      responseListener.current?.remove?.();
    };
  }, []);

  return null;
}
