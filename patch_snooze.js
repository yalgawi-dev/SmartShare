const fs = require('fs');

let tx = fs.readFileSync('src/components/widgets/Finance/PendingInvoicesBanner.tsx', 'utf8');

const importReplacement = `import { useState, useEffect } from 'react';
import { useAuth } from '../../../app/context/AuthContext';`;

tx = tx.replace(`import { useAuth } from '../../../app/context/AuthContext';`, importReplacement);

const renderCheck = `  const { getTokenForSpace, getRoleForSpace } = useSpaces();
  const [isSnoozed, setIsSnoozed] = useState(false);

  useEffect(() => {
    const snoozeTime = localStorage.getItem('pendingInvoicesSnooze_' + space?.id);
    if (snoozeTime) {
      if (Date.now() < parseInt(snoozeTime, 10)) {
        setIsSnoozed(true);
      } else {
        localStorage.removeItem('pendingInvoicesSnooze_' + space?.id);
      }
    }
  }, [space?.id]);

  if (!user || !user.id || !space?.invoices || isSnoozed) return null;`;

tx = tx.replace(`  const { getTokenForSpace, getRoleForSpace } = useSpaces();\n  \n  if (!user || !user.id || !space?.invoices) return null;`, renderCheck);

const returnReplacement = `return (
    <div style={{ flexShrink: 0, minWidth: '100%', scrollSnapAlign: 'center', boxSizing: 'border-box' }}>
    <div style={{
      background: bgColor,
      border: \`1px solid \${borderColor}\`,
      borderRadius: '16px',
      padding: '1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: \`0 4px 15px \${hasRecentNudge ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.15)'}\`,
      animation: hasRecentNudge ? 'urgentPulse 1.5s infinite' : 'pulseGlow 2.5s infinite',
      position: 'relative'
    }}>
      <div onClick={onScrollToFinance} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', flex: 1 }}>
        <div style={{
          background: iconBg, color: 'white',
          width: '50px', height: '50px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', fontWeight: 'bold',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}>
          {pendingCount}
        </div>
        <div>
          <h3 style={{ margin: 0, color: titleColor, fontSize: '1.15rem', fontWeight: 800 }}>{titleText}</h3>
          <p style={{ margin: '0.25rem 0 0', color: descColor, fontSize: '0.9rem', lineHeight: 1.4 }}>
            יש לך {pendingCount} {pendingCount === 1 ? 'פעולה שממתינה' : 'פעולות שממתינות'} לאישור בפירוט ההוצאות.
          </p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginRight: '1rem' }}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const twelveHours = Date.now() + 12 * 60 * 60 * 1000;
            localStorage.setItem('pendingInvoicesSnooze_' + space.id, twelveHours.toString());
            setIsSnoozed(true);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: descColor,
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: '0.4rem',
            borderRadius: '8px',
            textDecoration: 'underline',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
        >
          ⏰ הזכר לי מאוחר יותר
        </button>
      </div>
      <div style={{ fontSize: '2rem', animation: 'bounceX 1.5s infinite', marginRight: '1rem', cursor: 'pointer' }} onClick={onScrollToFinance}>
        👈
      </div>
    </div>
    </div>
  );`;

const oldReturnMatch = tx.match(/return\s*\(\s*<div.*?<\/div>\s*<\/div>\s*\);/s);
if (oldReturnMatch) {
  tx = tx.replace(oldReturnMatch[0], returnReplacement);
} else {
  console.error("Could not find return statement in PendingInvoicesBanner");
}

fs.writeFileSync('src/components/widgets/Finance/PendingInvoicesBanner.tsx', tx);
console.log("Patched PendingInvoicesBanner with Snooze");
