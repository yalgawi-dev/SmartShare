/**
 * Professional Multi-Word Contact Search & Hebrew Alphabetical Sorter (DRY Single Source of Truth).
 *
 * Capabilities:
 * - Word-order independent ("גולדה עלי" matches "עלי קבלן שלד גולדה 2026")
 * - Skipped-word tolerant ("עלי 2026" matches "עלי קבלן שלד גולדה 2026")
 * - Single-word or partial-letter match ("שלד" or "קבל")
 * - Phone digits match ignoring dashes/spaces ("05886" matches "058-867-2270")
 * - Professional relevance + Hebrew alphabetical sorting (localeCompare('he'))
 */

export interface SearchableContact {
  name?: string;
  phone?: string;
  email?: string;
  note?: string;
}

function normalizeText(raw?: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/["'׳״`\-_,./\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDigits(raw?: string): string {
  return String(raw || '').replace(/[^\d]/g, '');
}

export function matchesContactQuery(contact: SearchableContact, rawQuery: string): { matched: boolean; score: number } {
  const normQuery = normalizeText(rawQuery);
  const queryDigits = normalizeDigits(rawQuery);

  if (!normQuery && !queryDigits) {
    return { matched: true, score: 0 };
  }

  const normName = normalizeText(contact.name);
  const normPhone = normalizeDigits(contact.phone);
  const normEmail = normalizeText(contact.email);
  const normNote = normalizeText(contact.note);
  const combinedText = `${normName} ${normEmail} ${normNote}`.trim();
  const nameWords = normName.split(' ').filter(Boolean);

  // If the user typed digits only (phone search)
  if (queryDigits && normQuery.replace(/\d/g, '').trim() === '') {
    if (normPhone.includes(queryDigits)) {
      const starts = normPhone.startsWith(queryDigits) ? 100 : 70;
      return { matched: true, score: starts };
    }
    if (normName.includes(queryDigits)) {
      return { matched: true, score: 60 };
    }
    return { matched: false, score: 0 };
  }

  const tokens = normQuery.split(' ').filter(Boolean);
  if (tokens.length === 0) return { matched: true, score: 0 };

  // EVERY token must appear somewhere in name/email/note/phone (in ANY order!)
  let score = 0;
  for (const tok of tokens) {
    const tokDigits = normalizeDigits(tok);
    const inName = normName.includes(tok);
    const inOther = combinedText.includes(tok);
    const inPhone = tokDigits.length >= 2 && normPhone.includes(tokDigits);

    if (!inName && !inOther && !inPhone) {
      return { matched: false, score: 0 };
    }

    if (normName.startsWith(tok)) {
      score += 40; // Prefix of full name
    } else if (nameWords.some((w) => w.startsWith(tok))) {
      score += 30; // Prefix of any word in name
    } else if (inName) {
      score += 20; // Substring inside name
    } else if (inPhone) {
      score += 15;
    } else {
      score += 10;
    }
  }

  // Bonus if exact full string matches
  if (normName === normQuery) score += 100;
  else if (normName.startsWith(normQuery)) score += 50;

  return { matched: true, score };
}

export function filterAndSortContacts<T extends SearchableContact>(
  contacts: T[],
  rawQuery: string
): T[] {
  const query = String(rawQuery || '').trim();
  if (!query) {
    return [...contacts].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), 'he', { sensitivity: 'base' })
    );
  }

  const scored: Array<{ item: T; score: number }> = [];
  for (const item of contacts) {
    const res = matchesContactQuery(item, query);
    if (res.matched) {
      scored.push({ item, score: res.score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.item.name || '').localeCompare(String(b.item.name || ''), 'he', { sensitivity: 'base' });
  });

  return scored.map((s) => s.item);
}
