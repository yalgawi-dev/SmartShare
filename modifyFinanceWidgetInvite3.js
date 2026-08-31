const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8');

// 1. Insert states at the top of the component
const stateInjection = `
  const { addGuestPartner } = useSpaces() as any;
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [isRetroactive, setIsRetroactive] = useState(true);
  const [generatedLink, setGeneratedLink] = useState('');

  const handleCreateInvite = () => {
    if (!inviteName.trim()) return alert('הכנס שם שותף');
    const shadowToken = 'guest_' + Math.random().toString(36).substr(2, 9);
    addGuestPartner(space.id, inviteName, isRetroactive, shadowToken);
    
    const url = new URL(window.location.href);
    url.pathname = '/space/' + space.id;
    url.searchParams.set('invite', shadowToken);
    setGeneratedLink(url.toString());
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    alert('הקישור הועתק! שלח אותו לשותף.');
    setShowInviteModal(false);
    setGeneratedLink('');
    setInviteName('');
  };

  const handleInviteClick = () => {
    setShowInviteModal(true);
  };
`;

const stateTarget = `const [selectedCategory, setSelectedCategory] = useState('?>?????T');\n  const { addInvoice, updateInvoice, updateSpaceSettings } = useSpaces();`;
if (content.includes(stateTarget)) {
  content = content.replace(stateTarget, stateTarget + '\n' + stateInjection);
} else {
  console.log("Could not find state target");
}

// 2. Remove old handleInvite
const startHandleInvite = content.indexOf('const handleInvite = async () => {');
if (startHandleInvite !== -1) {
  const endHandleInvite = content.indexOf('};', content.indexOf('alert(', startHandleInvite)) + 2; // Find end of the function roughly
  // The actual end is after the else block
  const oldFunction = content.slice(startHandleInvite, endHandleInvite);
  content = content.replace(oldFunction, '');
} else {
  console.log("Could not find handleInvite");
}

// 3. Change onClick={handleInvite} to onClick={handleInviteClick}
content = content.replace(/onClick=\{handleInvite\}/g, 'onClick={handleInviteClick}');

// 4. Inject Modal UI at the end
const modalUI = `
      {showInviteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1rem', color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>הוספת שותף חדש</h3>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            
            {!generatedLink ? (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>שם השותף:</label>
                  <input 
                    type="text" 
                    value={inviteName} 
                    onChange={e => setInviteName(e.target.value)}
                    placeholder="לדוגמא: יוסף"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
                
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={isRetroactive} 
                      onChange={e => setIsRetroactive(e.target.checked)}
                      style={{ width: '20px', height: '20px', marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#334155' }}>חיוב רטרואקטיבי</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                        {isRetroactive ? 
                          'השותף ישתתף בכל ההוצאות שהיו בפרויקט מתחילתו (מומלץ).' : 
                          'השותף ישתתף רק בהוצאות שיתווספו מרגע זה והלאה (פטור ממה שהיה עד כה).'}
                      </div>
                    </div>
                  </label>
                </div>

                <button 
                  onClick={handleCreateInvite}
                  style={{ background: 'var(--primary)', color: 'white', padding: '0.75rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem' }}
                >
                  צור קישור הזמנה אישי
                </button>
              </>
            ) : (
              <>
                <div style={{ background: '#ecfdf5', padding: '1rem', borderRadius: '8px', color: '#065f46', textAlign: 'center' }}>
                  <strong>השותף נוסף בהצלחה!</strong><br/><br/>
                  שלח לו את הקישור הבא כדי שיוכל להיכנס ולראות את החשבון שלו:
                </div>
                <input 
                  type="text" 
                  value={generatedLink} 
                  readOnly 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #10b981', boxSizing: 'border-box', background: '#f8fafc', direction: 'ltr', textAlign: 'left' }}
                />
                <button 
                  onClick={copyToClipboard}
                  style={{ background: '#10b981', color: 'white', padding: '0.75rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
                >
                  העתק קישור וסגור
                </button>
              </>
            )}
          </div>
        </div>
      )}`;

const closingTagIndex = content.lastIndexOf('</div>');
content = content.slice(0, closingTagIndex) + modalUI + '\n    ' + content.slice(closingTagIndex);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content, 'utf-8');
console.log('FinanceWidget successfully updated with robust logic');
