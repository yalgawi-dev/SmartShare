const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');

const regex = /let myUnreadCount = 0;\s*if \(isCreatorMe && !b\.isCreator\) \{\s*myUnreadCount = \(memberObj\?\.messages \|\| \[\]\)\.filter\(\(m: any\) => m\.from === 'partner' && !m\.readAt\)\.length;\s*\} else if \(!isCreatorMe && b\.isCreator\) \{\s*const myActualMember = space\.members\?\.find\(\(m: any\) => m\.userId === user\?\.id\);\s*myUnreadCount = \(myActualMember\?\.messages \|\| \[\]\)\.filter\(\(m: any\) => m\.from === 'creator' && !m\.readAt\)\.length;\s*\}/;

const replacement = "let myUnreadCount = 0;\n" +
"                                  const targetId = b.isCreator ? (space.creatorId || space.createdBy) : b.userId;\n" +
"                                  const p2pConvoId = [user?.id, targetId].filter(Boolean).sort().join('_');\n" +
"                                  const convo = space.conversations?.find((c: any) => c.id === p2pConvoId);\n" +
"                                  \n" +
"                                  if (convo) {\n" +
"                                    myUnreadCount = convo.messages?.filter((msg: any) => !msg.readBy?.includes(user?.id))?.length || 0;\n" +
"                                  } else {\n" +
"                                    if (isCreatorMe && !b.isCreator) {\n" +
"                                      myUnreadCount = (memberObj?.messages || []).filter((m: any) => m.from === 'partner' && !m.readAt).length;\n" +
"                                    } else if (!isCreatorMe && b.isCreator) {\n" +
"                                      const myActualMember = space.members?.find((m: any) => m.userId === user?.id);\n" +
"                                      myUnreadCount = (myActualMember?.messages || []).filter((m: any) => m.from === 'creator' && !m.readAt).length;\n" +
"                                    }\n" +
"                                  }";

if (regex.test(c)) {
    c = c.replace(regex, replacement);
    fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
    console.log('Successfully patched');
} else {
    console.log('Not found');
}
