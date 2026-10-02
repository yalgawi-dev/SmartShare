const fs = require('fs');
let txt = fs.readFileSync('src/components/widgets/NotificationCenterWidget.tsx', 'utf8');

// Replace routing
const searchClick = `                  if (n.type === 'chat') {
                     if (n.id === 'chat-group') query = '?chat=group';
                     else query = '?chat=' + n.id.replace('chat-', '');
                  }`;
const replaceClick = `                  if (n.type === 'chat') {
                     if (n.id === 'chat-group') query = '#chat-group-btn';
                     else query = '?tab=partners#partner-row-' + n.id.replace('chat-', '');
                  }`;
txt = txt.replace(searchClick, replaceClick);

// Replace name
const searchName = `text: 'יש לך ' + unreadChatMessages.length + ' הודעות חדשות מאת ' + (isCreator ? member.name : 'מנהל המרחב') + '.',`;
const replaceName = `text: 'יש לך ' + unreadChatMessages.length + ' הודעות חדשות מאת ' + (isCreator ? member.name : (space.createdBy || 'מנהל המרחב')) + '.',`;
txt = txt.replace(searchName, replaceName);

fs.writeFileSync('src/components/widgets/NotificationCenterWidget.tsx', txt);
console.log('Replaced');
