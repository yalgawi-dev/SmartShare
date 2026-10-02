const fs = require('fs');
let txt = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');
const regex = /let myUnreadCount = 0;([\s\S]*?)const targetId = b\.isCreator \? \(space\.creatorId \|\| space\.createdBy\) : b\.userId;([\s\S]*?)const p2pConvoId = \[user\?\.id, targetId\]\.filter\(Boolean\)\.sort\(\)\.join\('_'\);([\s\S]*?)const convo = space\.conversations\?\.find\(\(c: any\) => c\.id === p2pConvoId\);([\s\S]*?)if \(convo\) \{([\s\S]*?)myUnreadCount = convo\.messages\?\.filter\(\(msg: any\) => !msg\.readBy\?\.includes\(user\?\.id\)\)\?\.length \|\| 0;/;
const match = txt.match(regex);
if (match) {
  const replaceStr = `if (!space.features?.includes('chat')) return null;\n                                  let myUnreadCount = 0;\n                                  const targetId = b.isCreator ? (space.creatorId || space.createdBy) : b.userId;\n                                  const p2pConvoId = [myId, targetId].filter(Boolean).sort().join('_');\n                                  const convo = space.conversations?.find((c: any) => c.id === p2pConvoId);\n                                  if (convo) {\n                                    myUnreadCount = convo.messages?.filter((msg: any) => msg.senderId !== user?.id && msg.senderId !== myId && !msg.readBy?.includes(user?.id))?.length || 0;`;
  txt = txt.replace(match[0], replaceStr);
  fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', txt);
  console.log('Replaced');
} else {
  console.log('Not found');
}
