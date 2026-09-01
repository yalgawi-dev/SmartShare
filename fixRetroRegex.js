const fs = require('fs');

const financePath = 'src/components/widgets/FinanceWidget.tsx';
let financeContent = fs.readFileSync(financePath, 'utf-8');

const regex = /<p style=\{\{ fontSize: '0\.9rem', color: '#64748b', margin: '0 0 1rem 0' \}\}>[\s\S]*?<\/label>\s*<\/div>/;

const replacement = `{space.invoices && space.invoices.length > 0 && (
              <>
                <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                  איך תרצה לחשב את ההוצאות של השותף החדש?
                </p>
                    
                <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isRetroactive} 
                      onChange={e => setIsRetroactive(e.target.checked)}
                      style={{ width: '22px', height: '22px', marginTop: '2px', accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '1.05rem' }}>חיוב רטרואקטיבי</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.4rem', lineHeight: '1.4' }}>
                        {isRetroactive ? 
                          'מומלץ: השותף ישתתף בכל ההוצאות שהיו בפרויקט מתחילתו.' : 
                          'מעכשיו והלאה: השותף פטור מתשלום על כל מה שהיה עד כה, ויחויב רק על הוצאות עתידיות.'}
                      </div>
                    </div>
                  </label>
                </div>
              </>
            )}`;

if (financeContent.match(regex)) {
  financeContent = financeContent.replace(regex, replacement);
  fs.writeFileSync(financePath, financeContent, 'utf-8');
  console.log("Fixed FinanceWidget with regex");
} else {
  console.log("Failed to match regex");
}
