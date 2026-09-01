const fs = require('fs');

const path = 'src/components/widgets/FinanceWidget.tsx';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const replacement = `{space.invoices && space.invoices.length > 0 && (
              <>
                <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem' }}>
                  איך תרצה לחשב את ההוצאות של השותף החדש?
                </p>
                    
                <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
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
            )}`.split('\n');

const start = lines.findIndex(l => l.includes('איך תרצה לחשב את ההוצאות')) - 1;
const end = lines.findIndex((l, i) => i > start && l.includes('</label>')) + 1; // including </div>

lines.splice(start, end - start + 1, ...replacement);

fs.writeFileSync(path, lines.join('\n'), 'utf-8');
console.log('Fixed FinanceWidget by splice');
