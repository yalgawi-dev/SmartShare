const fs = require('fs');
const file = 'src/app/settings/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('deleteMyAccount')) {
  content = content.replace('const { user, updateProfile, logout } = useAuth();', 'const { user, updateProfile, logout, deleteMyAccount } = useAuth();');
  
  const deleteBtn = `
      <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
        <h3 style={{ color: '#ef4444', marginBottom: '1rem' }}>אזור מסוכן (Danger Zone)</h3>
        <button 
          onClick={async () => {
            if (confirm('האם אתה בטוח שברצונך למחוק את החשבון הנוכחי לצמיתות? הפעולה לא ניתנת לביטול! (אם זהו חשבון כפול ריק, זו הפעולה הנכונה לשחרור מספר הטלפון)')) {
              try {
                await deleteMyAccount();
                alert('החשבון נמחק בהצלחה.');
                window.location.href = '/';
              } catch (e) {
                alert('שגיאה במחיקת חשבון: ' + e.message);
              }
            }
          }}
          style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '0.75rem 2rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
          onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
        >
          מחק את החשבון שלי לצמיתות
        </button>
      </div>
    </div>
  );
}`;

  content = content.replace(/    <\/div>\s*?\);\s*?\}/g, deleteBtn);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Settings updated");
} else {
  console.log("Already updated");
}
