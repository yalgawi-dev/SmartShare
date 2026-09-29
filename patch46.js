const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Partners/PartnerControlPanel.tsx', 'utf8');

const regex = /  const messagesRaw = member\?\.messages \|\| \[\];[\s\S]*?  \}, \[messagesRaw\.length, mounted\]\);/g;

const repl =   const isGroup = member.userId === 'group';
  const conversationId = isGroup ? 'group' : (viewMode === 'peer' ? [user?.id, member.userId].sort().join('_') : (viewMode === 'creator' ? member.userId : user?.id));

  // Legacy
  const messagesRaw = member?.messages || [];
  let legacyMessages = (Array.isArray(messagesRaw) ? [...messagesRaw] : Object.values(messagesRaw)).map((msg: any) => ({
    id: msg.id,
    senderId: msg.from === 'creator' ? (space.creatorId || space.createdBy) : member.userId,
    text: msg.text,
    createdAt: msg.createdAt || new Date().toISOString(),
    readBy: msg.readAt ? [msg.from === 'creator' ? member.userId : (space.creatorId || space.createdBy)] : []
  }));
  if (isGroup || viewMode === 'peer') legacyMessages = [];

  // Mesh
  const convo = space.conversations?.find((c: any) => c.id === conversationId);
  const meshMessages = convo?.messages || [];
  
  const messagesArray = [...legacyMessages, ...meshMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Auto-mark messages as read when opening the panel
  useEffect(() => {
    if (!mounted || !user?.id) return;
    
    // Mark Mesh
    if (typeof markConversationRead === 'function' && meshMessages.length > 0) {
      const unread = meshMessages.filter((m: any) => !(m.readBy || []).includes(user.id));
      if (unread.length > 0) {
        markConversationRead(space.id, conversationId, user.id);
      }
    }
  }, [messagesArray.length, mounted]);;

c = c.replace(regex, repl);
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Partners/PartnerControlPanel.tsx', c, 'utf8');
