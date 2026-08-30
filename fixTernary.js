const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

// I'll replace the exact bad block with a very clean one
const badStr = `{hasPartners && (
<React.Fragment>
<div 
          onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}
          style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
          title="למעבר מהיר לעמוד ההוצאות"
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ממתינות לאישורי</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#f59e0b' }}>{activeInvoices.filter((i: any) => i.status === 'pending').length}</h3>
        </div>
        <div 
          onClick={() => setShowSettlementBreakdown(true)}
          style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
          title="פירוט של התחשבנות היתרות בין כל השותפים במרחב"
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {myBalance > 0 ? 'שותפים חייבים לי בסך הכול:' : myBalance < 0 ? 'אני חייב/ת להעביר בסך הכול:' : 'החשבון שלי מאוזן מול כולם'}
          </p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: myBalance >= 0 ? '#10b981' : '#ef4444' }} dir="ltr">
            {Math.abs(myBalance).toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
          </h3>
        </div>
        </React.Fragment>
)}`;

const goodStr = `{hasPartners ? (
        <React.Fragment>
        <div 
          onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}
          style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
          title="למעבר מהיר לעמוד ההוצאות"
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ממתינות לאישורי</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#f59e0b' }}>{activeInvoices.filter((i: any) => i.status === 'pending').length}</h3>
        </div>
        <div 
          onClick={() => setShowSettlementBreakdown(true)}
          style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
          title="פירוט של התחשבנות היתרות בין כל השותפים במרחב"
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {myBalance > 0 ? 'שותפים חייבים לי בסך הכול:' : myBalance < 0 ? 'אני חייב/ת להעביר בסך הכול:' : 'החשבון שלי מאוזן מול כולם'}
          </p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: myBalance >= 0 ? '#10b981' : '#ef4444' }} dir="ltr">
            {Math.abs(myBalance).toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
          </h3>
        </div>
        </React.Fragment>
) : null}`;

// Fallback regex approach if literal fails
const regexFix = content.replace(/\{hasPartners && \(\s*<React\.Fragment>([\s\S]*?)<\/React\.Fragment>\s*\)\}/, "{hasPartners ? <React.Fragment>$1</React.Fragment> : null}");

fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", regexFix, "utf-8");
console.log("Fixed fragment with ternary.");
