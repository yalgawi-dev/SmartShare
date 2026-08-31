const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

// 1. Add handleInvite inside FinanceWidget
const runOcrIndex = content.indexOf("const runOcrPipeline = async");
const handleInviteCode = `
  const handleInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'הזמנה למרחב שותפות ב-MySpace',
          text: 'היי! צירפתי אותך עכשיו למרחב שותפות באפליקציה שלנו.',
          url: window.location.href,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      alert('שיתוף לא נתמך בדפדפן זה. העתק את כתובת הדף.');
    }
  };

`;
content = content.substring(0, runOcrIndex) + handleInviteCode + content.substring(runOcrIndex);

// 2. Add the button in the header
const linkIndex = content.indexOf("<Link href={`/space/${space.id}/reports`}");
const inviteBtn = `
                {space.features?.includes('partners') && (
                  <button 
                    onClick={handleInvite}
                    style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  >
                    <span>👥</span>
                    הזמן שותפים
                  </button>
                )}
`;
content = content.substring(0, linkIndex) + inviteBtn + content.substring(linkIndex);

fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
console.log("Updated FinanceWidget");
