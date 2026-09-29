const fs = require('fs');
const file = 'src/app/api/ocr/route.ts';
let content = fs.readFileSync(file, 'utf8');

const replacement = 
    // ── CLASSIFY MODE ────────────────────────────────────────────────────────
    if (mode === 'classify') {
      const classifyPrompt = \Look at this document image. Classify what type of document it is.
Return ONLY a valid JSON object with exactly these fields:
{
  "type": "INVOICE" | "RECEIPT" | "BILL" | "CONTRACT" | "WARRANTY" | "ID_DOC" | "OTHER",
  "confidence": <number 0-100>,
  "reason": "<one short sentence in Hebrew>"
}
Rules:
- INVOICE: חשבונית מס (clearly has VAT number, line items, monetary amounts)
- RECEIPT: קבלה (proof of payment)
- BILL: חשבון תשלום (utility bill, phone bill, etc.)
- CONTRACT: חוזה, הסכם, הצעת מחיר (agreement with text, possibly signatures)
- WARRANTY: תעודת אחריות, אחריות יצרן
- ID_DOC: תעודת זהות, דרכון, רישיון נהיגה
- OTHER: anything else that is NOT a financial document
Be strict about INVOICE/RECEIPT/BILL — require visible monetary amounts and invoice structure.\;

      const classifyRes = await fetch(
        \https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=\\,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: classifyPrompt },
              { inlineData: { mimeType, data: base64Data } }
            ]}],
            generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
          })
        }
      );

      if (classifyRes.ok) {
        const classifyData = await classifyRes.json();
        const rawText = classifyData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\\{[\\s\\S]*\\}/);
        if (jsonMatch) {
          try {
            return NextResponse.json({ classifyResult: JSON.parse(jsonMatch[0]) });
          } catch { /* fall through */ }
        }
      }
      return NextResponse.json({ classifyResult: null });
    }

    const prompt = \`;

content = content.replace('    const prompt = ', replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Patched');
