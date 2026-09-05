const fs = require('fs');
const file = 'src/components/widgets/Partners/SharesEditorModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = \<input type="text" inputMode="decimal" value={partnerShares[m.userId] ?? ''} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\\d*\\.?\\d*$/.test(val)) setPartnerShares({ ...partnerShares, [m.userId]: val });
                }} onFocus={e => { const el = e.target; setTimeout(() => el.select(), 10); }}\;

const replacement = \<input type="text" inputMode="decimal" value={partnerShares[m.userId] ?? ''} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\\d*\\.?\\d*$/.test(val)) {
                    setPartnerShares({ ...partnerShares, [m.userId]: val });
                    let otherSum = 0;
                    Object.entries(partnerShares).forEach(([id, share]) => {
                      if (id !== m.userId) otherSum += Number(share);
                    });
                    const newPartnerVal = Number(val);
                    const remaining = Math.max(0, 100 - otherSum - newPartnerVal);
                    setMyShare(Number.isInteger(remaining) ? remaining.toString() : remaining.toFixed(1));
                  }
                }} onFocus={e => { const el = e.target; setTimeout(() => el.select(), 10); }}\;

content = content.replace(targetStr, replacement);
fs.writeFileSync(file, content, 'utf8');
