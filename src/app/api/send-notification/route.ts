import { NextResponse } from 'next/server';
import { adminMessaging, adminDb } from '../../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const PROD_ORIGIN = 'https://smart-share-tvwn-delta.vercel.app';

function toAbsoluteHttpsUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return `${PROD_ORIGIN}/`;
  const trimmed = url.trim();
  if (trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return `${PROD_ORIGIN}${trimmed}`;
  return `${PROD_ORIGIN}/${trimmed}`;
}

export async function POST(request: Request) {
  try {
    const { title, body, userId, userIds, data } = await request.json();

    const targetUsers = userIds || (userId ? [userId] : []);

    if (targetUsers.length === 0 || !title || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const iconUrl = toAbsoluteHttpsUrl(data?.icon || '/myspace_logo.png');
    const targetLink = toAbsoluteHttpsUrl(data?.url || '/');

    // FCM data payload requires all values to be strings
    const stringData: Record<string, string> = {};
    if (data && typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null) {
          stringData[k] = String(v);
        }
      }
    }
    stringData.url = targetLink;

    const allMessages: any[] = [];
    const tokenMap = new Map<string, { userId: string; token: string }>();

    const userDocs = await Promise.all(
      targetUsers.map((uid: string) => adminDb.collection('users').doc(uid).get())
    );

    userDocs.forEach((userDoc) => {
      if (userDoc.exists) {
        const userData = userDoc.data();
        const rawTokens: string[] = userData?.fcmTokens || [];
        const uniqueTokens = Array.from(
          new Set(rawTokens.filter((t) => typeof t === 'string' && t.trim().length > 0))
        );

        uniqueTokens.forEach((token: string) => {
          if (!tokenMap.has(token)) {
            tokenMap.set(token, { userId: userDoc.id, token });
            allMessages.push({
              token,
              notification: {
                title: String(title),
                body: String(body),
                // FCM v1 REQUIRES absolute https:// URL (relative '/myspace_logo.png' causes invalid-argument!)
                imageUrl: iconUrl,
              },
              data: stringData,
              webpush: {
                headers: {
                  Urgency: 'high',
                },
                fcmOptions: {
                  link: targetLink,
                },
                notification: {
                  title: String(title),
                  body: String(body),
                  icon: iconUrl,
                  badge: iconUrl,
                  ...(stringData.tag ? { tag: stringData.tag, renotify: true } : {}),
                },
              },
            });
          }
        });
      }
    });

    if (allMessages.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'Users have no registered devices' });
    }

    const response = await adminMessaging.sendEach(allMessages);

    const failedTokensByUser = new Map<string, string[]>();
    const errorCodes: string[] = [];

    response.responses.forEach((resp: any, idx: number) => {
      if (!resp.success) {
        const errCode = resp.error?.code || 'unknown';
        errorCodes.push(errCode);
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          const failedToken = allMessages[idx].token;
          const uid = tokenMap.get(failedToken)?.userId;
          if (uid) {
            if (!failedTokensByUser.has(uid)) failedTokensByUser.set(uid, []);
            failedTokensByUser.get(uid)!.push(failedToken);
          }
        } else {
          console.error('FCM Send Error:', errCode, resp.error?.message);
        }
      }
    });

    const cleanupPromises = Array.from(failedTokensByUser.entries()).map(([uid, tokens]) =>
      adminDb.collection('users').doc(uid).update({
        fcmTokens: FieldValue.arrayRemove(...tokens),
      })
    );
    await Promise.all(cleanupPromises);

    return NextResponse.json({
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      ...(errorCodes.length > 0 ? { errorCodes: Array.from(new Set(errorCodes)) } : {}),
    });
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
