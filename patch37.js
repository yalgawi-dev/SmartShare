const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', 'utf8');

// Add interfaces
if (!c.includes('export interface SpaceConversation')) {
  c = c.replace(
    'export interface SpaceMember {',
    'export interface SpaceMessage {\\n  id: string;\\n  senderId: string;\\n  text: string;\\n  createdAt: string;\\n  readBy: string[];\\n}\\n\\nexport interface SpaceConversation {\\n  id: string;\\n  type: "group" | "p2p";\\n  participants: string[];\\n  messages: SpaceMessage[];\\n}\\n\\nexport interface SpaceMember {'
  );
}

// Add conversations array to Space
if (!c.includes('conversations?: SpaceConversation[]')) {
  c = c.replace(
    'mediaItems?: MediaItem[];',
    'mediaItems?: MediaItem[];\\n  conversations?: SpaceConversation[];'
  );
}

// Add function signatures to SpacesContextType
c = c.replace('sendMessageToMember?: any;', 'sendConversationMessage?: any;\\n  markConversationRead?: any;');
c = c.replace('markMessageRead?: any;', ''); // remove legacy

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/context/SpacesContext.tsx', c, 'utf8');
