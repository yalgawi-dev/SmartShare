const fs = require('fs');
let txt = fs.readFileSync('src/components/widgets/Partners/PartnerControlPanel.tsx', 'utf8').split('\n');

let endIdx = txt.findIndex(l => l.includes('</>,'));
let block = `
          {/* ChatUI Rendered here */}
          {(space.features || []).includes('chat') ? (
            <ChatEngineUI space={space} conversationId={conversationId} member={member} viewMode={viewMode} isGroup={isGroup} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
              <div style={{ fontSize: '3rem', opacity: 0.5 }}>💬</div>
              <div style={{ textAlign: 'center' }}>
                מערכת הצ'אט מנותקת במרחב זה.<br/>
                ניתן להפעיל אותה בהגדרות התוספים.
              </div>
            </div>
          )}
        </div>
      </div>
`;

txt.splice(endIdx, 0, block);

fs.writeFileSync('src/components/widgets/Partners/PartnerControlPanel.tsx', txt.join('\n'));
console.log('Fixed syntax in PartnerControlPanel');
