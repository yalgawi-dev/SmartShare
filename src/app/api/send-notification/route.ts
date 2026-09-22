import { NextResponse } from 'next/server';
import { adminMessaging, adminDb } from '../../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const { title, body, userId, userIds, data } = await request.json();

    const targetUsers = userIds || (userId ? [userId] : []);

    if (targetUsers.length === 0 || !title || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let allMessages: any[] = [];
    let tokenMap = new Map<string, { userId: string, token: string }>(); // to track failed tokens per user

    // Fetch all users in parallel
    const userDocs = await Promise.all(
      targetUsers.map((uid: string) => adminDb.collection('users').doc(uid).get())
    );

    userDocs.forEach(userDoc => {
      if (userDoc.exists) {
        const userData = userDoc.data();
        const fcmTokens = userData?.fcmTokens || [];
        fcmTokens.forEach((token: string) => {
          tokenMap.set(token, { userId: userDoc.id, token });
          allMessages.push({
            token,
            notification: { title, body },
            data: data || {},
            webpush: {
              fcmOptions: {
                link: (data && data.url) ? data.url : '/'
              }
            }
          });
        });
      }
    });

    if (allMessages.length === 0) {
      return NextResponse.json({ success: true, message: 'Users have no registered devices' });
    }

    // FCM sendEach accepts max 500 messages
    const response = await adminMessaging.sendEach(allMessages);

    // Group failed tokens by userId
    const failedTokensByUser = new Map<string, string[]>();
    
    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success) {
        const failedToken = allMessages[idx].token;
        const uid = tokenMap.get(failedToken)?.userId;
        if (uid) {
          if (!failedTokensByUser.has(uid)) failedTokensByUser.set(uid, []);
          failedTokensByUser.get(uid)!.push(failedToken);
        }
      }
    });

    // Cleanup failed tokens in parallel
    const cleanupPromises = Array.from(failedTokensByUser.entries()).map(([uid, tokens]) => {
      return adminDb.collection('users').doc(uid).update({
        fcmTokens: FieldValue.arrayRemove(...tokens)
      });
    });

    await Promise.all(cleanupPromises);

    return NextResponse.json({ success: true, sent: response.successCount, failed: response.failureCount });

  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
