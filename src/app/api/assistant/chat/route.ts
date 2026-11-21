import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

export const maxDuration = 30;

interface VaultItemAccess {
  name: string;
  visibility: 'open_all' | 'restricted';
  allowedPartnerNames: string[];
}

interface SpaceSnapshot {
  id: string;
  title: string;
  role: 'creator' | 'member';
  creatorName: string;
  members: Array<{ name: string; share: number; netBalance: number }>;
  totalExpenses: number;
  invoicesCount: number;
  pendingCount: number;
  filesCount?: number;
  foldersCount?: number;
  vault?: {
    shelves: VaultItemAccess[];
    folders: VaultItemAccess[];
    documentsCount: number;
  };
}

function computeSpaceSnapshot(spaceId: string, data: any, uid: string): SpaceSnapshot {
  const membersRaw = Array.isArray(data.members)
    ? data.members.filter((m: any) => m?.userId && m.status !== 'removed')
    : [];

  const invoices = Array.isArray(data.invoices)
    ? data.invoices.filter((inv: any) => inv?.status !== 'deleted')
    : [];

  const memberMap = new Map<string, { name: string; share: number; paid: number; sent: number; received: number }>();

  const creatorId = data.creatorId || '';
  if (creatorId) {
    const creatorMember = membersRaw.find((m: any) => m.userId === creatorId);
    memberMap.set(creatorId, {
      name: creatorMember?.name || data.createdBy || 'יוצר המרחב',
      share: Number(creatorMember?.share ?? 0),
      paid: 0,
      sent: 0,
      received: 0
    });
  }

  for (const m of membersRaw) {
    if (!memberMap.has(m.userId)) {
      memberMap.set(m.userId, {
        name: m.name || 'שותף',
        share: Number(m.share ?? 0),
        paid: 0,
        sent: 0,
        received: 0
      });
    }
  }

  let totalExpenses = 0;
  let pendingCount = 0;

  for (const inv of invoices) {
    if (inv.status === 'pending' || inv.status === 'dispute') pendingCount++;
    if (inv.status === 'missing') continue;

    const amt = Number(inv.amount) || 0;
    if (inv.type === 'transfer') {
      const from = memberMap.get(inv.paidById);
      const to = memberMap.get(inv.toUserId);
      if (from) from.sent += amt;
      if (to) to.received += amt;
      continue;
    }

    totalExpenses += amt;
    if (inv.payerSplits && typeof inv.payerSplits === 'object') {
      for (const [splitUid, splitVal] of Object.entries(inv.payerSplits)) {
        const entry = memberMap.get(splitUid);
        if (entry) entry.paid += Number(splitVal) || 0;
      }
    } else if (inv.paidById && memberMap.has(inv.paidById)) {
      memberMap.get(inv.paidById)!.paid += amt;
    }
  }

  const totalShare = Array.from(memberMap.values()).reduce((s, m) => s + (m.share > 0 ? m.share : 0), 0);
  const count = Math.max(1, memberMap.size);

  const members = Array.from(memberMap.values()).map((m) => {
    const ratio = totalShare > 0 ? m.share / totalShare : 1 / count;
    const expected = totalExpenses * ratio;
    const netBalance = Math.round((m.paid - expected + m.sent - m.received) * 100) / 100;
    return { name: m.name, share: m.share, netBalance };
  });

  const mapAccess = (item: any, nameField: 'title' | 'name'): VaultItemAccess => {
    const rawAllowed = Array.isArray(item?.allowedPartners)
      ? item.allowedPartners.filter((pid: string) => pid && pid.trim() !== '' && pid !== creatorId)
      : [];
    return {
      name: item?.[nameField] || item?.title || item?.name || 'ללא שם',
      visibility: rawAllowed.length > 0 ? 'restricted' : 'open_all',
      allowedPartnerNames: rawAllowed.map((pid: string) => memberMap.get(pid)?.name || pid)
    };
  };

  const shelves = Array.isArray(data.shelves) ? data.shelves.map((s: any) => mapAccess(s, 'title')) : [];
  const folders = Array.isArray(data.documentFolders) ? data.documentFolders.slice(0, 40).map((f: any) => mapAccess(f, 'name')) : [];
  const documentsCount = Array.isArray(data.documents) ? data.documents.length : 0;

  return {
    id: spaceId,
    title: data.title || 'מרחב ללא שם',
    role: data.creatorId === uid ? 'creator' : 'member',
    creatorName: memberMap.get(creatorId)?.name || data.createdBy || 'יוצר המרחב',
    members,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    invoicesCount: invoices.length,
    pendingCount,
    vault: { shelves, folders, documentsCount }
  };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing', reason: 'gemini_key_missing' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized', reason: 'admin_not_init' }, { status: 500 });
    }

    let uid = '';
    let userName = '';
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      userName = decoded.name || '';
    } catch {
      return NextResponse.json({ error: 'Invalid token', reason: 'invalid_token' }, { status: 401 });
    }

    const { query, context } = await request.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    // Fetch only spaces belonging to this authenticated user
    const spacesSnap: SpaceSnapshot[] = [];
    let spacesLoadError = '';
    if (adminDb) {
      try {
        const allSpaces = await adminDb.collection('spaces').limit(60).get();
        for (const docSnap of allSpaces.docs) {
          const d = docSnap.data();
          const isCreator = d.creatorId === uid;
          const isMember = Array.isArray(d.members) && d.members.some((m: any) => m?.userId === uid && m.status !== 'removed');
          if (!isCreator && !isMember) continue;

          const snap = computeSpaceSnapshot(docSnap.id, d, uid);

          // If the user is currently inside this space, enrich with files/folders count
          if (context?.spaceId === docSnap.id) {
            try {
              const [filesRes, foldersRes] = await Promise.all([
                adminDb.collection('spaces').doc(docSnap.id).collection('files').count().get(),
                adminDb.collection('spaces').doc(docSnap.id).collection('folders').count().get()
              ]);
              snap.filesCount = filesRes.data().count;
              snap.foldersCount = foldersRes.data().count;
            } catch {
              // Optional enrichment
            }
          }
          spacesSnap.push(snap);
        }
      } catch (dbErr: any) {
        spacesLoadError = dbErr?.message || 'db_error';
        console.warn('Assistant spaces load warning:', spacesLoadError);
      }
    } else {
      spacesLoadError = 'adminDb_not_initialized';
    }

    const appMapSummary = `SmartShare (v3.5.232):
- מרחבים ומדפים: כל פרויקט הוא מרחב הכולל מדפים, תיקיות, מסמכים, התחשבנויות ושותפים.
- פרטיות והרשאות: ברירת המחדל היא 🌐 פתוח לכולם. פריט 🔒 מוגבל גלוי רק ליוצר ולמורשים, אך הרשאה ישירה לתת-תיקייה גוברת על חסימת תיקיית-אב.
- שיתוף ונמענים: שיתוף קובץ בודד, תיקייה בלבד, עץ מלא (כולל תתי-תיקיות), או שיתוף כל הקיר עם מעקב צפיות וזמן שהייה לכל נמען וחסימה בקליק.
- סל מחזור: פריטים שנמחקו נשמרים ל-12 שעות לשחזור מהיר.
- התחשבנויות: חישוב מאזן נטו בין שותפים, אישור חשבוניות, העברות ודוחות.
- סורק מסמכים: סריקה ודחיסה ל-WebP + העלאת PDF מרובי עמודים.`;

    const systemPrompt = `אתה הסוכן החכם והארכיטקט של אפליקציית SmartShare.
שם המשתמש המחובר: ${userName || 'משתמש'}.
מיקום נוכחי באפליקציה: ${JSON.stringify(context || {})}.

חוקים מחייבים:
1. ענה בעברית ברורה, קצרה ונעימה.
2. הסתמך אך ורק על נתוני האמת שסופקו לך למטה. לעולם אל תמציא סכומים, שמות שותפים או קבצים שלא מופיעים בנתונים.
3. בנתוני היתרה (netBalance): ערך חיובי (+) אומר שמגיע לשותף כסף מהקבוצה/אחרים; ערך שלילי (-) אומר שהשותף חייב כסף לקבוצה/אחרים. הסבר זאת בצורה פשוטה וברורה.
4. בנתוני הכספת והמדפים (vault): visibility: 'open_all' (🌐 פתוח לכולם) אומר שכל חברי המרחב יכולים לראות אותו. visibility: 'restricted' (🔒 מוגבל) אומר שרק יוצר המרחב (creatorName) והשותפים הרשומים ב-allowedPartnerNames יכולים לראות אותו. שים לב: הרשאה ישירה לתת-תיקייה גוברת על חסימה בתיקיית-אב.
5. אם חסר מידע או שותף לא נמצא, אמור זאת בבירור.

מפת היכולות של האפליקציה:
${appMapSummary}

הנתונים החיים של המשתמש המחובר (מרחבים, שותפים, מאזנים וחשבוניות):
${JSON.stringify(spacesSnap)}`;

    const models = ['gemini-flash-lite-latest', 'gemini-2.0-flash-lite'];
    let geminiData: any = null;
    let lastStatus = 0;
    let lastErr = '';

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
      lastErr = await geminiRes.text();
      console.warn(`Gemini (${model}) error:`, lastStatus, lastErr.slice(0, 200));
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
