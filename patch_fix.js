const fs = require('fs');
let file = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('migrateGuestToRealUser: (spaceId: string, shadowToken: string, realUid: string, realName: string) => void;', '');

// Fix finalizeGuestJoin args that failed to replace
content = content.replace('const finalizeGuestJoin = (\\n    spaceId: string, \\n    name: string, \\n    isRetroactiveParam: boolean, \\n    shadowToken: string, \\n    customShareParam?: number,\\n    sharesPlanParam?: { creator: number; partners?: Record<string, number> }\\n  ) => {', 'const finalizeGuestJoin = (spaceId: string, name: string, isRetroactiveParam: boolean, userId: string, inviteToken?: string, customShareParam?: number, sharesPlanParam?: { creator: number; partners?: Record<string, number> }) => {');

// Wait, since I don't know the exact whitespace of finalizeGuestJoin, I will use regex
content = content.replace(/const finalizeGuestJoin = \([\s\S]*?shadowToken: string,[\s\S]*?sharesPlanParam\?: \{ creator: number; partners\?: Record<string, number> \}\n  \) => \{/, 'const finalizeGuestJoin = (spaceId: string, name: string, isRetroactiveParam: boolean, userId: string, inviteToken?: string, customShareParam?: number, sharesPlanParam?: { creator: number; partners?: Record<string, number> }) => {');

fs.writeFileSync(file, content, 'utf8');
