const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/NotificationCenterWidget.tsx', 'utf8');

const regex = /const isCreator = space\.creatorId === user\.id;/;
const replacement = "const mySpaceKey = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('smartshare_keys') || '{}')[space.id]) : null;\n" +
"        const isCreator = space.creatorId === user.id || user?.spaceKeys?.[space.id]?.role === 'creator' || mySpaceKey?.role === 'creator';\n" +
"        const partnerToken = user?.spaceKeys?.[space.id]?.token || mySpaceKey?.token;\n" +
"        const myActualId = isCreator ? (space.creatorId || space.createdBy || user.id) : (partnerToken || user.id);";

c = c.replace(regex, replacement);

const regex2 = /if \(\!isCreator && member\.userId !== user\?\.id\) return; \/\/ Partners only process their own row[\s\n\r]*const targetId = isCreator \? member\.userId : \(space\.creatorId \|\| space\.createdBy\);[\s\n\r]*const p2pConvoId = \[user\?\.id, targetId\]\.filter\(Boolean\)\.sort\(\)\.join\('_'\);[\s\n\r]*const convo = space\.conversations\?\.find\(\(c: any\) => c\.id === p2pConvoId\);[\s\n\r]*let unreadChatMessages = convo\?\.messages\?\.filter\(\(msg: any\) => !msg\.readBy\?\.includes\(user\.id\)\) \|\| \[\];/;

const replacement2 = "if (!isCreator && member.userId !== myActualId && member.userId !== user?.id) return; // Partners only process their own row\n" +
"              const targetId = isCreator ? member.userId : (space.creatorId || space.createdBy);\n" +
"              const p2pConvoId = [myActualId, targetId].filter(Boolean).sort().join('_');\n" +
"              const convo = space.conversations?.find((c: any) => c.id === p2pConvoId);\n" +
"              let unreadChatMessages = convo?.messages?.filter((msg: any) => msg.senderId !== user?.id && msg.senderId !== myActualId && !msg.readBy?.includes(user?.id)) || [];";

if (regex2.test(c)) {
    c = c.replace(regex2, replacement2);
    fs.writeFileSync('src/components/widgets/NotificationCenterWidget.tsx', c);
    console.log('Successfully patched NotificationCenterWidget.tsx');
} else {
    console.log('Not found regex2 in NotificationCenterWidget.tsx');
}
