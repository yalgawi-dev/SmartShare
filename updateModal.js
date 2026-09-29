const fs = require('fs');
const file = 'C:/yehuda/project/app/SmartShare/src/components/widgets/Partners/PartnersInviteModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add useAuth
content = content.replace(
  \"import { useSpaces } from '../../../app/context/SpacesContext';\",
  \"import { useSpaces } from '../../../app/context/SpacesContext';\\nimport { useAuth } from '../../../app/context/AuthContext';\"
);

// Add isInviting state & useAuth hook
content = content.replace(
  \"  const { createPendingInvite } = useSpaces();\",
  \"  const { createPendingInvite } = useSpaces();\\n  const { findUserById } = useAuth();\\n  const [isInviting, setIsInviting] = useState(false);\"
);

// Rewrite handleContactSelect
const oldHandleContactSelectRegex = /const handleContactSelect = async \\(contact: SelectedContact\\) => \\{[\\s\\S]*?\\n  \\};/m;
const newHandleContactSelect = \const handleContactSelect = async (contact: SelectedContact) => {
    setIsInviting(true);
    const data = await handleGenerateLink(contact.name, contact.userId);
    if (!data) {
      setIsInviting(false);
      return;
    }
    
    if (contact.isSystemPartner && contact.userId) {
      let realPhone = '';
      if (findUserById) {
        try {
          const userDoc = await findUserById(contact.userId);
          if (userDoc && userDoc.phone) {
            realPhone = userDoc.phone;
          }
        } catch(e) {}
      }
      
      // Intentional UX delay to feel like a real network request
      setTimeout(() => {
        setSuccessData({
          name: contact.name,
          phone: realPhone,
          text: data.shareText
        });
        setIsInviting(false);
      }, 800);
    } else {
      setIsInviting(false);
      const whatsappUrl = \\\https://wa.me/\\\?text=\\\\\\;
      window.open(whatsappUrl, '_blank');
      onClose();
    }
  };\;

content = content.replace(oldHandleContactSelectRegex, newHandleContactSelect);

// Handle Success UI whatsapp button
const oldWhatsAppButtonRegex = /<button onClick=\\{.*?whatsappUrl.*?\\}[\\s\\S]*?<\\/button>/m;
const newWhatsAppButton = \{successData.phone && (
              <button onClick={() => {
                const whatsappUrl = \\\https://wa.me/\\\?text=\\\\\\;
                window.open(whatsappUrl, '_blank');
                onClose();
              }} style={{ flex: 1, padding: '0.75rem', background: '#25D366', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                תזכורת בווטסאפ
              </button>
            )}\;

content = content.replace(oldWhatsAppButtonRegex, newWhatsAppButton);

// Handle isInviting UI
const oldHeaderRegex = /\\{\\/\\* Header \\*\\/\\}/;
const newHeaderAndLoading = \{isInviting ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ width: '40px', height: '40px', border: '4px solid #f1f5f9', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <style>{\\\@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }\\\}</style>
            <h3 style={{ margin: 0, color: '#1e293b' }}>שולח הזמנה פנימית...</h3>
          </div>
        ) : (
          <div style={{ width: '100%' }}>
          {/* Header */}\;

// But wait, <div style={{width:'100%'}}> was already added where <> used to be!
// Let's replace:
// <div style={{ width: '100%' }}>
// {\\/\\* Header \\*\\/}

content = content.replace(/<div style=\\{\\{ width: '100%' \\}\\}>\\s*\\{\\/\\* Header \\*\\/\\}/m, newHeaderAndLoading);

// And we need an extra closing div at the end since we added a ternary isInviting ? () : () inside the fragment area!
// Or rather, the wrapper  <div style={{ width: '100%' }}> is now the else of isInviting.
// Wait, isInviting ? (...) : (<div style={{ width: '100%' }}> means the existing </div> that closed the 100% div will still close it, BUT now we need an extra )}!
const endDivRegex = /<\\/div>\\s*<\\/div>\\s*\\)\}\\s*<\\/div>\\s*<\\/div>,\\s*document\\.body\\s*\\);\\s*\\}/m;
const endDivNew = \</div>
        </div>
        )}
        )}
      </div>
    </div>,
    document.body
  );
}\;
content = content.replace(endDivRegex, endDivNew);

fs.writeFileSync(file, content);
