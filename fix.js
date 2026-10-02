const fs = require('fs');
let txt = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');

const search = "triggerPushNotification(otherUserIds, title, body, { url: '/space/' + spaceId });";
const replace = "triggerPushNotification(otherUserIds, title, body, { url: '/space/' + spaceId, tag: 'chat-' + spaceId + '-' + conversationId });";

txt = txt.replace(search, replace);
fs.writeFileSync('src/app/context/SpacesContext.tsx', txt);
console.log('Replaced trigger payload');
