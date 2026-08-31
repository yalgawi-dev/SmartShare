const fs = require("fs");
let content = fs.readFileSync("src/components/widgets/FinanceWidget.tsx", "utf-8");

const tabsStart = content.indexOf("{/* TABS */}");
const tabsEnd = content.indexOf("<div style={{ padding: '1.5rem' }}>", tabsStart);

if (tabsStart !== -1 && tabsEnd !== -1) {
  const newTabs = `
      {/* TABS - Apple/Vercel Style Segmented Control */}
      <div style={{ padding: '0 1.5rem', marginTop: '1rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <button 
            onClick={() => setActiveTab('summary')}
            style={{ 
              flex: 1, 
              padding: '0.6rem 1rem', 
              background: activeTab === 'summary' ? 'var(--bg-card)' : 'transparent', 
              border: 'none', 
              borderRadius: '8px',
              color: activeTab === 'summary' ? 'var(--text-primary)' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'summary' ? 'bold' : 'normal', 
              cursor: 'pointer', 
              fontSize: '0.95rem',
              boxShadow: activeTab === 'summary' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            📊 סיכום ומאזן
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            style={{ 
              flex: 1, 
              padding: '0.6rem 1rem', 
              background: activeTab === 'transactions' ? 'var(--bg-card)' : 'transparent', 
              border: 'none', 
              borderRadius: '8px',
              color: activeTab === 'transactions' ? 'var(--text-primary)' : 'var(--text-secondary)', 
              fontWeight: activeTab === 'transactions' ? 'bold' : 'normal', 
              cursor: 'pointer', 
              fontSize: '0.95rem',
              boxShadow: activeTab === 'transactions' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            🧾 פירוט הוצאות
          </button>
        </div>
      </div>

      `;
  content = content.substring(0, tabsStart) + newTabs + content.substring(tabsEnd);
  fs.writeFileSync("src/components/widgets/FinanceWidget.tsx", content, "utf-8");
  console.log("Updated Finance Tabs");
} else {
  console.log("Tabs bounds not found");
}
