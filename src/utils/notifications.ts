import { messaging } from '../lib/firebase';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const requestNotificationPermission = async (userId: string) => {
  try {
    if (!('Notification' in window)) {
      console.log('This browser does not support desktop notification');
      return false;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const msg = await messaging();
      if (!msg) return false;
      
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'BLuKqBHM0BJVmFNMaKiPjdI3eGyjwQ0vzi-kMLS1UeyS6428AzvUk3P63UD3wMN1gTG0HUwLVS3MsWOsaiI622M';
      if (!vapidKey) {
        console.error('VAPID key not found');
        return false;
      }

      const currentToken = await getToken(msg, { vapidKey });
      
      if (currentToken) {
        // Save the token to Firestore
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(currentToken)
        });
        return true;
      } else {
        console.log('No registration token available.');
        return false;
      }
    } else {
      console.log('Notification permission not granted.');
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
