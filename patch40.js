const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', 'utf8');

const startIdx = c.indexOf("const sendMessageToMember = (spaceId: string, memberId: string, text: string, from: 'creator' | 'partner') => {");
const endStr = "  const approveExtension = (spaceId: string, memberId: string) => {";
const endIdx = c.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newFuncs = "  const sendConversationMessage = (spaceId: string, conversationId: string, senderId: string, text: string) => {\\n" +
    "    saveSpaceUpdate(spaceId, space => {\\n" +
    "      const convos = space.conversations || [];\\n" +
    "      let convo = convos.find(c => c.id === conversationId);\\n" +
    "      if (!convo) {\\n" +
    "        const participants = conversationId === 'group' ? ['group'] : conversationId.split('_');\\n" +
    "        convo = { id: conversationId, type: conversationId === 'group' ? 'group' : 'p2p', participants, messages: [] };\\n" +
    "        convos.push(convo);\\n" +
    "      }\\n" +
    "      const newMsg = { id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2,5), senderId, text: text.trim(), createdAt: new Date().toISOString(), readBy: [senderId] };\\n" +
    "      const updatedConvos = [...convos.filter(c => c.id !== conversationId), { ...convo, messages: [...convo.messages, newMsg] }];\\n" +
    "      return { ...space, conversations: updatedConvos };\\n" +
    "    });\\n" +
    "  };\\n\\n" +
    "  const markConversationRead = (spaceId: string, conversationId: string, readerId: string) => {\\n" +
    "    saveSpaceUpdate(spaceId, space => {\\n" +
    "      const convos = space.conversations || [];\\n" +
    "      const updatedConvos = convos.map(c => {\\n" +
    "        if (c.id !== conversationId) return c;\\n" +
    "        return { ...c, messages: c.messages.map(msg => { if (!msg.readBy.includes(readerId)) { return { ...msg, readBy: [...msg.readBy, readerId] }; } return msg; }) };\\n" +
    "      });\\n" +
    "      return { ...space, conversations: updatedConvos };\\n" +
    "    });\\n" +
    "  };\\n\\n";
  c = c.substring(0, startIdx) + newFuncs.replace(/\\n/g, '\n') + c.substring(endIdx);
  
  c = c.replace('sendMessageToMember,', 'sendConversationMessage,\n        markConversationRead,');
  c = c.replace('markMessageRead,', '');
  
  fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', c, 'utf8');
}
