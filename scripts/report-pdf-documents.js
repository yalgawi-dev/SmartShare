/**
 * READ-ONLY report: finds documents still stored as raw PDF (vault documents,
 * their pages/thumbnails, and finance attachments) and prints counts + sizes.
 * Does NOT modify or delete anything.
 *
 * Usage:  node scripts/report-pdf-documents.js
 * Requires FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 * and NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
}

const isPdfUrl = (u) => typeof u === 'string' && /\.pdf(\?|$)/i.test(decodeURIComponent(u.split('?')[0]) + '?');
const fmt = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';

async function main() {
  loadEnv();
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const { getStorage } = require('firebase-admin/storage');

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  const db = getFirestore();
  const bucket = getStorage().bucket();

  const found = [];
  const spaces = await db.collection('spaces').get();
  for (const s of spaces.docs) {
    const d = s.data();
    const title = d.title || s.id;
    (d.documents || []).forEach((doc) => {
      const urls = [doc.url, doc.thumbnailUrl, ...(doc.pages || [])].filter(isPdfUrl);
      urls.forEach((u) => found.push({ space: title, kind: 'vault', title: doc.title, url: u }));
    });
    (d.invoices || []).forEach((inv) => {
      if (isPdfUrl(inv.attachmentUrl)) found.push({ space: title, kind: 'finance', title: inv.supplier || 'חשבונית', url: inv.attachmentUrl });
    });
  }

  let total = 0;
  for (const f of found) {
    try {
      const m = f.url.match(/\/o\/([^?]+)/);
      if (m) {
        const [meta] = await bucket.file(decodeURIComponent(m[1])).getMetadata();
        f.size = Number(meta.size) || 0;
        total += f.size;
      }
    } catch { f.size = null; }
  }

  console.log(`\nנמצאו ${found.length} קבצי PDF גולמיים ב-${spaces.size} מרחבים. נפח כולל: ${fmt(total)}\n`);
  found.forEach((f, i) =>
    console.log(`${i + 1}. [${f.kind}] ${f.space} › ${f.title} — ${f.size == null ? 'גודל לא ידוע' : fmt(f.size)}`));
}

main().catch((e) => { console.error('Report failed:', e.message); process.exit(1); });
