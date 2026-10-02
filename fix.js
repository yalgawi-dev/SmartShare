const fs = require('fs');
let txt = fs.readFileSync('src/app/settings/page.tsx', 'utf8');

const searchBtn = `<button onClick={handleEnablePush} disabled={isPushEnabled} style={{ background: isPushEnabled ? '#86efac' : '#22c55e', color: isPushEnabled ? '#14532d' : 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: isPushEnabled ? 'default' : 'pointer' }}>`;
const replaceBtn = `<button onClick={handleEnablePush} style={{ background: isPushEnabled ? '#86efac' : '#22c55e', color: isPushEnabled ? '#14532d' : 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer' }}>`;

txt = txt.replace(searchBtn, replaceBtn);

const searchBtnText = `{isPushEnabled ? 'פעיל במכשיר זה ✔️' : ((user?.fcmTokens?.length || 0) > 0 ? 'הפעל גם בדפדפן זה' : 'הפעל עכשיו')}`;
const replaceBtnText = `{isPushEnabled ? 'פעיל ✔️ (לחץ לסנכרון מחדש)' : ((user?.fcmTokens?.length || 0) > 0 ? 'הפעל גם בדפדפן זה' : 'הפעל עכשיו')}`;

txt = txt.replace(searchBtnText, replaceBtnText);

fs.writeFileSync('src/app/settings/page.tsx', txt);
console.log('Fixed settings button');
