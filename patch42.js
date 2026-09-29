const fs = require('fs');
let lines = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('טבלת מאזנים'));
if (idx !== -1) {
  let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');
  c = c.replace(
    "<h4 style={{ margin: 0, fontSize: '1.1rem' }}>{activePartnersCount > 0 ? 'טבלת מאזנים' : 'התפלגות הוצאות'}</h4>",
    "<h4 style={{ margin: 0, fontSize: '1.1rem' }}>{activePartnersCount > 0 ? 'טבלת מאזנים' : 'התפלגות הוצאות'}</h4>\n          <div style={{ display: 'flex', gap: '0.5rem' }}>\n            <button onClick={() => setExpandedPartnerId('group')} style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\"><path d=\"M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z\"/></svg> צ'אט קבוצתי</button>\n          </div>"
  );
  fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', c, 'utf8');
}
