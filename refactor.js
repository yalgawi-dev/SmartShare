const fs = require('fs');
let txt = fs.readFileSync('src/components/widgets/Partners/PartnerControlPanel.tsx', 'utf8').split('\n');

// 1. Add import for ChatEngineUI
txt.splice(2, 0, "import ChatEngineUI from '../Chat/ChatEngineUI';");

// 2. Remove getChatDateLabel helper (lines 57-71 approx)
const getChatIdx = txt.findIndex(l => l.includes('const getChatDateLabel ='));
if (getChatIdx !== -1) {
  let endIdx = getChatIdx;
  while (!txt[endIdx].startsWith('};') && endIdx < txt.length) {
    endIdx++;
  }
  txt.splice(getChatIdx, endIdx - getChatIdx + 1);
}

// 3. Re-read because indexes changed
let content = txt.join('\n');

// Remove messages raw logic
content = content.replace(/\s*\/\/ Legacy\s*const messagesRaw = member\?.messages[\s\S]*?}, \[messagesArray\.length\]\);\n/m, '');

// Remove the Chat Messages Area mapping and input area
const chatMessagesAreaTarget = `
          {messagesArray.map((m: any, idx: number) => {
            if (!m) return null;
            const currentMessageDate = new Date(m.createdAt).toDateString();
            let showDateBadge = false;
            if (idx === 0) {
               showDateBadge = true;
            } else {
               let prevM = messagesArray[idx - 1];
               const prevMessageDate = prevM ? new Date(prevM.createdAt).toDateString() : null;
               if (currentMessageDate !== prevMessageDate) showDateBadge = true;
            }
            const dateLabel = showDateBadge ? getChatDateLabel(m.createdAt) : "";
            const isMyMsg = m.senderId === user?.id || (m.from && m.from === viewMode);
            
            // Hide system messages from the person who triggered them
            if (isMyMsg && m.text && m.text.startsWith('[הודעת מערכת]:')) {
              return null;
            }

            const timeStr = formatTimeSafe(m.createdAt);
            let senderName = isMyMsg ? 'אני' : 'שותף';
            if (!isMyMsg) {
              if (m.senderId === space.creatorId || m.from === 'creator') {
                senderName = space.createdBy || 'מנהל המרחב';
              } else {
                const senderMember = space.members?.find((sm: any) => sm.userId === m.senderId);
                if (senderMember) senderName = senderMember.name;
              }
            }

            return (
              <React.Fragment key={m.id || idx}>
                {showDateBadge && (
                  <div style={{ alignSelf: 'center', background: 'rgba(0,0,0,0.05)', color: '#64748b', fontSize: '0.75rem', padding: '0.2rem 0.8rem', borderRadius: '12px', margin: '0.5rem 0', fontWeight: 'bold' }}>
                    {dateLabel}
                  </div>
                )}
                <div style={{
                  alignSelf: isMyMsg ? 'flex-start' : 'flex-end',
                  background: isMyMsg ? 'var(--primary)' : 'white',
                  color: isMyMsg ? 'white' : 'var(--text-primary)',
                  padding: '0.6rem 1rem',
                  borderRadius: isMyMsg ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  maxWidth: '85%',
                  boxShadow: isMyMsg ? '0 4px 12px rgba(79,70,229,0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
                  border: isMyMsg ? 'none' : '1px solid var(--border-light)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem'
                }}>
                  {!isMyMsg && isGroup && (
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>{senderName}</span>
                  )}
                  <span style={{ fontSize: '0.95rem', lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', alignSelf: 'flex-end', marginTop: '0.1rem', opacity: 0.8 }}>
                    <span style={{ fontSize: '0.65rem' }}>{timeStr}</span>
                    {isMyMsg && (
                      <span style={{ fontSize: '0.7rem' }}>
                        {((m.readBy && m.readBy.length > 0) || m.readAt) ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        )}
        {/* Input Area */}
        {true && (
        <div style={{ background: '#f0f2f5', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="הקלד הודעה..."
            rows={1}
            style={{
              flex: 1,
              padding: '0.6rem 1rem',
              borderRadius: '24px',
              border: 'none',
              background: '#ffffff',
              fontSize: '0.95rem',
              outline: 'none',
              resize: 'none',
              maxHeight: '100px',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            style={{
              background: messageText.trim() ? 'var(--primary)' : '#cbd5e1',
              color: 'white',
              border: 'none',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: messageText.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: messageText.trim() ? '0 4px 10px rgba(79,70,229,0.3)' : 'none'
            }}
          >
            <span style={{ transform: 'rotate(-45deg) translateX(2px)', fontSize: '1.2rem' }}>➤</span>
          </button>
        </div>
        )}
`;

const replaceWith = `
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
`;

content = content.replace(chatMessagesAreaTarget, replaceWith);

fs.writeFileSync('src/components/widgets/Partners/PartnerControlPanel.tsx', content);
console.log('Done refactoring partner control panel');
