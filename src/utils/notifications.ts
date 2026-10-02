import { messaging } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const requestNotificationPermission = async (userId: string) => {
  try {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return false;
    }
    console.log('[FCM] requestNotificationPermission called for userId:', userId);
    const permission = await Notification.requestPermission();
    console.log('[FCM] Notification.permission:', permission);
    if (permission === 'granted') {
      const msg = await messaging();
      if (!msg) { console.error('[FCM] messaging() returned null'); return false; }
      
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BLuKqBHM0BJVmFNMaKiPjdI3eGyjwQ0vzi-kMLS1UeyS6428AzvUk3P63UD3wMN1gTG0HUwLVS3MsWOsaiI622M';
      if (!vapidKey) {
        console.error('[FCM] VAPID key not found');
        return false;
      }

      const currentToken = await getToken(msg, { vapidKey });
      console.log('[FCM] getToken result:', currentToken ? currentToken.substring(0, 20) + '...' : 'NULL');
      
      if (currentToken) {
        // Save the token to Firestore
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(currentToken)
        });
        console.log('[FCM] Token saved to Firestore for userId:', userId);
        return true;
      } else {
        console.log('[FCM] No registration token available. Check VAPID key and SW registration.');
        return false;
      }
    } else {
      console.log('[FCM] Notification permission not granted.');
      return false;
    }
  } catch (error) {
    console.error('An error occurred while retrieving token. ', error);
    return false;
  }
};


export const triggerPushNotification = async (userIds: string[], title: string, body: string, data?: any) => {
  if (!userIds || userIds.length === 0) return;
  try {
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, title, body, data })
    });
  } catch (err) {
    console.error('Error triggering push notification', err);
  }
};

export const setupForegroundFCM = async () => {
  try {
    if (!('Notification' in window)) return;
    const msg = await messaging();
    if (!msg) return;
    onMessage(msg, (payload) => {
      if (Notification.permission === 'granted' && payload.notification) {
        new Notification(payload.notification.title || 'התראה', {
          body: payload.notification.body,
          icon: '/icon-192x192.png',
          tag: payload.data?.tag || undefined
        });
      }
    });
  } catch (err) {
    console.error('Foreground FCM setup failed', err);
  }
};
