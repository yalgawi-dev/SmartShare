const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/Finance/FinanceSummary.tsx", "utf-8");

const startCube = "onClick={() => setShowTotalBreakdown(true)}";
const idxStart = content.indexOf(startCube);
if(idxStart !== -1) {
    const realStartIdx = content.lastIndexOf("<div", idxStart);
    const endToken = "      <div style={{ marginBottom: '1.5rem' }}>";
    const realEndIdx = content.indexOf(endToken, idxStart);
    if(realEndIdx !== -1) {
        const replacement = `<div 
          onClick={() => setShowTotalBreakdown(true)}
          style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
          title="פירוט ההוצאות לפי קטגוריות"
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סה"כ הוצאות</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
        </div>
        
        {hasPartners && (
          <React.Fragment>
            <div 
              onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}
              style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
              title="למעבר מהיר לעמוד ההוצאות"
            >
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ממתינות לאישורי</p>
              <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#f59e0b' }}>{activeInvoices.filter((i: any) => i.status === 'pending').length}</h3>
            </div>
            <div 
              onClick={() => setShowSettlementBreakdown(true)}
              style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
              title="פירוט של התחשבנות היתרות בין כל השותפים במרחב"
            >
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {myBalance > 0 ? 'שותפים חייבים לי:' : myBalance < 0 ? 'אני חייב/ת להעביר:' : 'החשבון שלי מאוזן'}
              </p>
              <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: myBalance >= 0 ? '#10b981' : '#ef4444' }} dir="ltr">
                {Math.abs(myBalance).toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
              </h3>
            </div>
          </React.Fragment>
        )}
      </div>

`;
        content = content.substring(0, realStartIdx) + replacement + content.substring(realEndIdx);
        fs.writeFileSync("src/components/widgets/Finance/FinanceSummary.tsx", content, "utf-8");
        console.log("Rewrote nicely!");
    } else { console.log("realEndIdx not found"); }
} else { console.log("startCube not found"); }
