import messaging, {
  FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";

export interface NotificationData {
  publicationId?: string;
  keyword?: string;
}

type NotificationHandler = (data: NotificationData) => void;

let onNotificationTapHandler: NotificationHandler | null = null;

export function setOnNotificationTap(handler: NotificationHandler): void {
  onNotificationTapHandler = handler;
}

export function setupForegroundNotificationHandler(): () => void {
  return messaging().onMessage(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      // In a real app, show an in-app notification banner here
      // For now, log the notification data
      console.log("Foreground notification received:", remoteMessage.notification);
    },
  );
}

export function setupBackgroundNotificationHandler(): void {
  messaging().setBackgroundMessageHandler(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log("Background notification received:", remoteMessage.data);
    },
  );
}

export async function checkInitialNotification(): Promise<NotificationData | null> {
  const remoteMessage = await messaging().getInitialNotification();
  if (!remoteMessage?.data) return null;

  return {
    publicationId: remoteMessage.data.publicationId as string | undefined,
    keyword: remoteMessage.data.keyword as string | undefined,
  };
}

export function setupNotificationOpenedHandler(): () => void {
  return messaging().onNotificationOpenedApp(
    (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      if (remoteMessage.data && onNotificationTapHandler) {
        onNotificationTapHandler({
          publicationId: remoteMessage.data.publicationId as string | undefined,
          keyword: remoteMessage.data.keyword as string | undefined,
        });
      }
    },
  );
}
