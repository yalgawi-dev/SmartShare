const fs = require('fs');

const path = 'src/components/widgets/FinanceWidget.tsx';
let content = fs.readFileSync(path, 'utf-8');

// 1. Add customShare state
const stateTarget = `const [isRetroactive, setIsRetroactive] = useState(true);`;
const stateReplacement = `const [isRetroactive, setIsRetroactive] = useState(true);\n  const [customShare, setCustomShare] = useState('');`;

if (content.includes(stateTarget)) {
  content = content.replace(stateTarget, stateReplacement);
}

// 2. Update handleCreateInvite to append retro and share
const linkTarget = `    url.pathname = '/space/' + space.id;
    url.searchParams.set('invite', shadowToken);
    const link = url.toString();`;

const linkReplacement = `    url.pathname = '/space/' + space.id;
    url.searchParams.set('invite', shadowToken);
    url.searchParams.set('retro', isRetroactive ? 'true' : 'false');
    if (customShare && !isNaN(Number(customShare))) {
      url.searchParams.set('share', customShare);
    }
    const link = url.toString();`;

if (content.includes(linkTarget)) {
  content = content.replace(linkTarget, linkReplacement);
}

// 3. Add Custom Share input to the UI
const uiTarget = `{space.invoices && space.invoices.length > 0 && (
              <>
                <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem' }}>
                  איך תרצה לחשב את ההוצאות של השותף החדש?
                </p>`;

const uiReplacement = `<p style={{ margin: 0, color: '#475569', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
              אחוז השתתפות מותאם אישית (אופציונלי):
            </p>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                min="1" max="100"
                placeholder="למשל 10%" 
                value={customShare}
                onChange={e => setCustomShare(e.target.value)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
              />
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>אם תשאיר ריק, האחוזים יתאזנו שווה בשווה.</span>
            </div>

            {space.invoices && space.invoices.length > 0 && (
              <>
                <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem' }}>
                  איך תרצה לחשב את ההוצאות של השותף החדש?
                </p>`;

if (content.includes(uiTarget)) {
  content = content.replace(uiTarget, uiReplacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log("FinanceWidget updated with customShare");
} else {
  console.log("Failed to match UI target in FinanceWidget");
}
