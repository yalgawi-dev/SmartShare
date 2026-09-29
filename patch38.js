const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', 'utf8');

const startIdx = c.indexOf("const sendMessageToMember = (spaceId: string, memberId: string, text: string, from: 'creator' | 'partner') => {");
const endStr = "  const approveExtension = (spaceId: string, memberId: string) => {";
const endIdx = c.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newFuncs = \const sendConversationMessage = (spaceId: string, conversationId: string, senderId: string, text: string) => {
    saveSpaceUpdate(spaceId, space => {
      const convos = space.conversations || [];
      let convo = convos.find(c => c.id === conversationId);
      if (!convo) {
        const participants = conversationId === 'group' ? ['group'] : conversationId.split('_');
        convo = { id: conversationId, type: conversationId === 'group' ? 'group' : 'p2p', participants, messages: [] };
        convos.push(convo);
      }
      
      const newMsg = {
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2,5),
        senderId,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        readBy: [senderId]
      };
      
      const updatedConvos = [...convos.filter(c => c.id !== conversationId), { ...convo, messages: [...convo.messages, newMsg] }];
      
      return { ...space, conversations: updatedConvos };
    });
  };

  const markConversationRead = (spaceId: string, conversationId: string, readerId: string) => {
    saveSpaceUpdate(spaceId, space => {
      const convos = space.conversations || [];
      const updatedConvos = convos.map(c => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          messages: c.messages.map(msg => {
            if (!msg.readBy.includes(readerId)) {
              return { ...msg, readBy: [...msg.readBy, readerId] };
            }
            return msg;
          })
        };
      });
      return { ...space, conversations: updatedConvos };
    });
  };

\;
  
  c = c.substring(0, startIdx) + newFuncs + c.substring(endIdx);
  fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', c, 'utf8');
} else {
  console.log("Indices not found");
}
