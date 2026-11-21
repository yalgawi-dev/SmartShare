import { NextResponse } from 'next/server';

export const maxDuration = 30;

/**
 * Pure serverless AI Assistant route (zero firebase-admin dependency so it never
 * crashes on Vercel cold start). Verifies Firebase ID token via Google Identity
 * Toolkit REST API and queries Gemini Flash-Lite with the user's live data.
 */
export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing', reason: 'gemini_key_missing' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized', reason: 'no_auth_token' }, { status: 401 });
    }

    // Lightweight cryptographic verification of Firebase ID Token via Identity Toolkit REST
    const firebaseWebKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    let verifiedDisplayName = '';
    if (firebaseWebKey) {
      try {
        const verifyRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseWebKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token })
          }
        );
        if (!verifyRes.ok) {
          return NextResponse.json({ error: 'Invalid token', reason: 'invalid_token' }, { status: 401 });
        }
        const verifyData = await verifyRes.json();
        verifiedDisplayName = verifyData?.users?.[0]?.displayName || '';
      } catch {
        return NextResponse.json({ error: 'Token verification failed', reason: 'verify_failed' }, { status: 401 });
      }
    }

    const { query, context, liveData } = await request.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing query', reason: 'missing_query' }, { status: 400 });
    }

    const effectiveUserName = liveData?.userName || verifiedDisplayName || 'משתמש';

    const appMapSummary = `SmartShare (v3.5.233):
- מרחבים ומדפים: כל פרויקט הוא מרחב הכולל מדפים, תיקיות, מסמכים, התחשבנויות ושותפים.
- פרטיות והרשאות: ברירת המחדל היא 🌐 פתוח לכולם. פריט 🔒 מוגבל גלוי רק ליוצר ולמורשים, אך הרשאה ישירה לתת-תיקייה גוברת על חסימת תיקיית-אב.
- שיתוף ונמענים: שיתוף קובץ בודד, תיקייה בלבד, עץ מלא (כולל תתי-תיקיות), או שיתוף כל הקיר עם מעקב צפיות וזמן שהייה לכל נמען וחסימה בקליק.
- סל מחזור: פריטים שנמחקו נשמרים ל-12 שעות לשחזור מהיר.
- התחשבנויות: חישוב מאזן נטו בין שותפים, אישור חשבוניות, העברות ודוחות.
- סורק מסמכים: סריקה ודחיסה ל-WebP + העלאת PDF מרובי עמודים.`;

    const systemPrompt = `אתה הסוכן החכם והארכיטקט של אפליקציית SmartShare.
שם המשתמש המחובר שמדבר איתך כרגע: ${effectiveUserName}.
מיקום נוכחי באפליקציה: ${JSON.stringify(context || {})}.

חוקים מחייבים:
1. ענה בעברית ברורה, קצרה, ישירה ונעימה.
2. הסתמך אך ורק על נתוני האמת שסופקו לך למטה. לעולם אל תמציא סכומים, שמות שותפים או תיקיות שלא מופיעים בנתונים.
3. בנתוני היתרה (netBalance): ערך חיובי (+) אומר שמגיע לשותף כסף מהקבוצה/אחרים; ערך שלילי (-) אומר שהשותף חייב כסף לקבוצה/אחרים. הסבר זאת בצורה פשוטה וברורה בשקלים (₪).
4. בנתוני הכספת והמדפים (vault): visibility: 'open_all' (🌐 פתוח לכולם) אומר שכל חברי המרחב יכולים לראות אותו. visibility: 'restricted' (🔒 מוגבל) אומר שרק יוצר המרחב (creatorName) והשותפים הרשומים ב-allowedPartnerNames יכולים לראות אותו. הרשאה ישירה לתת-תיקייה גוברת על חסימה בתיקיית-אב.
5. אם המשתמש שואל "מי אני?" ענה לו בשמו (${effectiveUserName}), ציין כמה מרחבים יש לו ואיפה הוא נמצא כרגע.

מפת היכולות של האפליקציה:
${appMapSummary}

הנתונים החיים של המשתמש המחובר (מרחבים, שותפים, מאזנים, חשבוניות והרשאות כספת):
${JSON.stringify(liveData || {})}`;

    const models = ['gemini-flash-lite-latest', 'gemini-2.0-flash-lite'];
    let geminiData: any = null;
    let lastStatus = 0;

    for (const model of models) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nשאלת המשתמש: ${query}` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
        })
      });

      if (geminiRes.ok) {
        geminiData = await geminiRes.json();
        break;
      }
      lastStatus = geminiRes.status;
      const errTxt = await geminiRes.text();
      console.warn(`Gemini (${model}) error:`, lastStatus, errTxt.slice(0, 200));
    }

    if (!geminiData) {
      return NextResponse.json({ error: 'AI unavailable', reason: `gemini_${lastStatus}` }, { status: 502 });
    }

    const answer = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!answer) {
      return NextResponse.json({ error: 'Empty AI response', reason: 'gemini_empty' }, { status: 502 });
    }

    return NextResponse.json({
      answer,
      source: 'cloud_llm',
      confidence: 'high',
      tokensUsed: geminiData?.usageMetadata?.totalTokenCount
    });
  } catch (err: any) {
    console.error('Assistant chat route error:', err);
    return NextResponse.json(
      { error: 'Internal error', reason: (err?.message || 'err').slice(0, 45) },
      { status: 500 }
    );
  }
}
