const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

// Remove the old header up to Tabs
const startHeaderIdx = content.indexOf("{/* Header and Controls */}");
const endHeaderIdx = content.indexOf("{/* TABS */}");

if (startHeaderIdx !== -1 && endHeaderIdx !== -1) {
  const newHeader = `
      {/* Header and Controls */}
      <div style={{ padding: '1.5rem', paddingBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'var(--primary-light, rgba(59, 130, 246, 0.1))', color: 'var(--primary)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
              💳
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)', fontWeight: '800', letterSpacing: '-0.02em' }}>
                חשבוניות והתחשבנויות
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>
                {activePartnersCount > 0 ? 'ניהול משותף עם שותפים למרחב' : 'ניהול הוצאות אישיות'}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {space.features?.includes('partners') && (
              <button 
                onClick={handleInvite}
                style={{ 
                  background: 'var(--bg-main)', 
                  color: 'var(--primary)', 
                  border: '1px solid var(--border-light)', 
                  padding: '0.4rem 1rem', 
                  borderRadius: 'var(--radius-full)', 
                  fontWeight: '600', 
                  cursor: 'pointer', 
                  fontSize: '0.85rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.4rem', 
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s'
                }}
              >
                <span>👥</span>
                הזמן שותפים
              </button>
            )}
            {onRemove && (
              <button 
                onClick={onRemove}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)', padding: '0.5rem' }}
                title="הסרת תצוגת הכלי"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      `;
  
  content = content.substring(0, startHeaderIdx) + newHeader + content.substring(endHeaderIdx);
  fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
  console.log("Updated FinanceWidget Header");
} else {
  console.log("Header bounds not found!");
}
