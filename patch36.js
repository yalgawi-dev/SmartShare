const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', 'utf8');

// Add interfaces
if (!c.includes('export interface SpaceConversation')) {
  c = c.replace(
    'export interface SpaceMember {',
    'export interface SpaceMessage {\n  id: string;\n  senderId: string;\n  text: string;\n  createdAt: string;\n  readBy: string[];\n}\n\nexport interface SpaceConversation {\n  id: string;\n  type: "group" | "p2p";\n  participants: string[];\n  messages: SpaceMessage[];\n}\n\nexport interface SpaceMember {'
  );
}

// Add conversations array to Space
if (!c.includes('conversations?: SpaceConversation[]')) {
  c = c.replace(
    'mediaItems?: MediaItem[];',
    'mediaItems?: MediaItem[];\n  conversations?: SpaceConversation[];'
  );
}

// Add function signatures to SpacesContextType
c = c.replace('sendMessageToMember?: any;', 'sendConversationMessage?: any;\n  markConversationRead?: any;');
c = c.replace('markMessageRead?: any;', ''); // remove legacy

// Replace implementations
const sendLegacyRegex = /const sendMessageToMember = [\s\S]*?return \{ \.\.\.m, messages: \[\.\.\.\(m\.messages \|\| \[\]\), newMsg\] \};\n        \}\)\n      \}\)\);\n    \};/g;

const sendNewFunc = const sendConversationMessage = (spaceId: string, conversationId: string, senderId: string, text: string) => {
    saveSpaceUpdate(spaceId, space => {
      const convos = space.conversations || [];
      let convo = convos.find(c => c.id === conversationId);
      if (!convo) {
        // Auto-create convo if not exists
        const participants = conversationId === 'group' ? ['group'] : conversationId.split('_');
        convo = { id: conversationId, type: conversationId === 'group' ? 'group' : 'p2p', participants, messages: [] };
        convos.push(convo);
      }
      
      const newMsg: SpaceMessage = {
        id: \msg-\-\\,
        senderId,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        readBy: [senderId]
      };
      
      const updatedConvos = convos.map(c => 
        c.id === conversationId ? { ...c, messages: [...c.messages, newMsg] } : c
      );
      
      return { ...space, conversations: updatedConvos };
    });
  };;
c = c.replace(sendLegacyRegex, sendNewFunc);

const readLegacyRegex = /const markMessageRead = [\s\S]*?\} : msg\n            \)\n          \};\n        \}\)\n      \}\)\);\n    \};/g;

const readNewFunc = const markConversationRead = (spaceId: string, conversationId: string, readerId: string) => {
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
  };;
c = c.replace(readLegacyRegex, readNewFunc);

c = c.replace('sendMessageToMember,', 'sendConversationMessage,\n        markConversationRead,');
c = c.replace('markMessageRead,', '');

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', c, 'utf8');
