import { NextResponse } from 'next/server';
import { adminMessaging, adminDb } from '../../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const { title, body, userId, data } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const fcmTokens = userData?.fcmTokens || [];

    if (fcmTokens.length === 0) {
      return NextResponse.json({ success: true, message: 'User has no registered devices' });
    }

    const messages = fcmTokens.map((token: string) => ({
      token,
      notification: { title, body },
      data: data || {}
    }));

    const response = await adminMessaging.sendEach(messages);

    const failedTokens: string[] = [];
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success) {
        failedTokens.push(fcmTokens[idx]);
      }
    });

    if (failedTokens.length > 0) {
      await adminDb.collection('users').doc(userId).update({
        fcmTokens: FieldValue.arrayRemove(...failedTokens)
      });
    }

    return NextResponse.json({ success: true, sent: response.successCount, failed: response.failureCount });

  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
