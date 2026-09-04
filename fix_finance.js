const fs = require('fs');
const filePath = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const s1 = `      {(b as any).status === 'pending' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
          {getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' ? (
            <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 'bold' }}>
              ❌ פג תוקף
            </span>
          ) : (
            <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              ⏳ ממתין ({(b as any).joinedAt ? getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) : 'שעון פועל'})
            </span>
          )}
          {(b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <button 
                onClick={() => removeMember(space.id, b.userId, user?.id || 'system')}
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                title="מחק הזמנה שפגה"
              >
                🗑️ הסר
              </button>
              <button 
                onClick={() => refreshMemberInvite(space.id, b.userId)}
                style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '4px', color: '#3b82f6', cursor: 'pointer', fontSize: '0.75rem', padding: '0.1rem 0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                title="שלח בקשה חוזרת וחדש את השעון"
              >
                🔄 חדש
              </button>
            </div>
          )}
        </div>
      )}`;
      
const r1 = `      {(b as any).status === 'pending' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            ⏳ ממתין
          </span>
        </div>
      )}`;

content = content.replace(s1, r1);

const s2 = `                {balances.map((b) => {
                  const isInactive = activePartnersCount === 0 && b.userId !== myId;`;

const r2 = `                {balances.map((b) => {
                  if (activePartnersCount === 0 && (b as any).status === 'pending' && b.paid === 0) return null;
                  const isInactive = activePartnersCount === 0 && b.userId !== myId;`;

content = content.replace(s2, r2);

const s3 = `                    <tr key={b.name} style={{ borderBottom: '1px solid var(--border-light)', background: (b as any).status === 'pending' && (b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' ? 'rgba(239, 68, 68, 0.05)' : b.userId === myId ? 'rgba(79, 70, 229, 0.05)' : 'transparent', opacity: isInactive ? 0.6 : 1 }}>`;

const r3 = `                    <tr key={b.name} style={{ borderBottom: '1px solid var(--border-light)', background: b.userId === myId ? 'rgba(79, 70, 229, 0.05)' : 'transparent', opacity: isInactive ? 0.6 : 1 }}>`;

content = content.replace(s3, r3);

content = content.replace("import { getRemainingTimeText, isPartnerExpired } from '../../../utils/partnerUtils';", "");

fs.writeFileSync(filePath, content, 'utf-8');