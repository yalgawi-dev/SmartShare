const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Partners/PartnerControlPanel.tsx', 'utf8');

// Replace {viewMode !== 'peer' && (
c = c.replace(/\{viewMode !== 'peer' && \(/g, "{true && (");

// Replace messages array logic to use conversations
const msgLogicRegex = /const messages = \[\];[\s\S]*?\/\/ In a real app[\s\S]*?\];/;
const newMsgLogic = 
    const isGroup = member.userId === 'group';
    const conversationId = isGroup ? 'group' : (viewMode === 'peer' ? [user?.id, member.userId].sort().join('_') : (viewMode === 'creator' ? member.userId : user?.id));
    
    // Load from space.conversations
    let meshMessages = [];
    if (space?.conversations) {
      const convo = space.conversations.find((c: any) => c.id === conversationId);
      if (convo) meshMessages = convo.messages || [];
    }

    // Load from legacy member.messages
    let legacyMessages = [];
    if (!isGroup && viewMode !== 'peer') {
      const m = space.members?.find((m: any) => m.userId === (viewMode === 'creator' ? member.userId : user?.id));
      if (m?.messages) {
        legacyMessages = m.messages.map((msg: any) => ({
          id: msg.id,
          senderId: msg.from === 'creator' ? (space.creatorId || space.createdBy) : m.userId,
          text: msg.text,
          createdAt: msg.createdAt,
          readBy: msg.readAt ? [msg.from === 'creator' ? m.userId : (space.creatorId || space.createdBy)] : []
        }));
      }
    }

    const messages = [...legacyMessages, ...meshMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    useEffect(() => {
      if (markConversationRead) {
        if (meshMessages.length > 0) {
          markConversationRead(space.id, conversationId, user?.id || 'me');
        }
      }
    }, [messages.length]);
;

c = c.replace("    const messages = []; // In a real app, this would be member.messages || []", newMsgLogic);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Partners/PartnerControlPanel.tsx', c, 'utf8');
