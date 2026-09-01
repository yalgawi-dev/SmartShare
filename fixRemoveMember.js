const fs = require('fs');

const path = 'src/app/context/SpacesContext.tsx';
let content = fs.readFileSync(path, 'utf-8');

// 1. Fix removeMember to ALWAYS soft delete so they don't disappear from settings.
const removeTarget = `      const hasInvoices = space.invoices?.some(i => i.payerId === userId);
      let newMembers;
      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      if (hasInvoices) {
        // Soft delete
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false } : m) || [];
        details = \`הוסר השותף \${memberToRemove.name} אך נשאר כלא-פעיל (מכיוון שיש לו היסטוריית תשלומים). המתמטיקה תתאזן אוטומטית.\`;
      } else {
        // Hard delete
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = \`הוסר השותף \${memberToRemove.name} לצמיתות.\`;
      }`;

const removeReplacement = `      let actionType: 'MEMBER_REMOVED' | 'MEMBER_LEFT' = 'MEMBER_REMOVED';
      let details = '';

      // ALWAYS Soft delete initially to preserve them in the Settings list and maintain history
      const newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false, canUpload: false, canEdit: false, canDelete: false, sharePercentage: undefined } : m) || [];
      details = \`הוסר השותף \${memberToRemove.name} וסומן כלא-פעיל.\`;
      
      // Auto-balance: Clear MY share percentage as well so it falls back to equal division
      const newSettings = { ...space.settings, mySharePercentage: undefined };`;

// wait, I also need to replace the return statement to include `newSettings`
// The original return looks like:
// `return { ...space, members: newMembers, auditLogs: ... }`

// Let's just use Regex to find the whole removeMember body
const removeBodyRegex = /const removeMember = \(spaceId: string, userId: string, performedBy: string\) => \{\s*saveSpaceUpdate\(spaceId, space => \{\s*const memberToRemove = space\.members\?\.find\(m => m\.userId === userId\);\s*if \(\!memberToRemove\) return space;\s*const hasInvoices = space\.invoices\?\.some\(i => i\.payerId === userId\);\s*let newMembers;\s*let actionType: 'MEMBER_REMOVED' \| 'MEMBER_LEFT' = 'MEMBER_REMOVED';\s*let details = '';\s*if \(hasInvoices\) \{\s*\/\/ Soft delete\s*newMembers = space\.members\?\.map\(m => m\.userId === userId \? \{ \.\.\.m, isActive: false \} : m\) \|\| \[\];\s*details = `[^`]*`;\s*\} else \{\s*\/\/ Hard delete\s*newMembers = space\.members\?\.filter\(m => m\.userId !== userId\) \|\| \[\];\s*details = `[^`]*`;\s*\}\s*const newLog = \{\s*id: Date\.now\(\)\.toString\(\),\s*timestamp: new Date\(\)\.toISOString\(\),\s*actionType,\s*performedBy,\s*details\s*\};\s*return \{ \.\.\.space, members: newMembers, auditLogs: \[...\(space\.auditLogs \|\| \[\]\), newLog\] \};\s*\}\);\s*\};/m;

const removeBodyReplacement = `const removeMember = (spaceId: string, userId: string, performedBy: string, forceHardDelete: boolean = false) => {
    saveSpaceUpdate(spaceId, space => {
      const memberToRemove = space.members?.find(m => m.userId === userId);
      if (!memberToRemove) return space;

      let newMembers;
      let details = '';
      
      if (forceHardDelete) {
        newMembers = space.members?.filter(m => m.userId !== userId) || [];
        details = \`השותף \${memberToRemove.name} נמחק לצמיתות.\`;
      } else {
        // Soft delete
        newMembers = space.members?.map(m => m.userId === userId ? { ...m, isActive: false, canUpload: false, canEdit: false, canDelete: false, sharePercentage: undefined } : m) || [];
        details = \`השותף \${memberToRemove.name} סומן כלא-פעיל.\`;
      }

      const newLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        actionType: 'MEMBER_REMOVED',
        performedBy,
        details
      };
      
      // Auto-Balance: Clear creator's explicit percentage to prevent black holes when participants change
      const newSettings = { ...space.settings, mySharePercentage: undefined };

      return { ...space, settings: newSettings, members: newMembers, auditLogs: [...(space.auditLogs || []), newLog] as any };
    });
  };`;

if (content.match(removeBodyRegex)) {
  content = content.replace(removeBodyRegex, removeBodyReplacement);
} else {
  console.log("Could not find removeMember regex");
}

// 2. Also fix the SpaceContext interface to include forceHardDelete
const interfaceRegex = /removeMember: \(spaceId: string, userId: string, performedBy: string\) => void;/;
content = content.replace(interfaceRegex, `removeMember: (spaceId: string, userId: string, performedBy: string, forceHardDelete?: boolean) => void;`);

fs.writeFileSync(path, content, 'utf-8');
console.log('Fixed removeMember in SpacesContext');
