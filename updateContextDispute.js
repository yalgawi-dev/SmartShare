const fs = require('fs');
let content = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

// 1. Update SpaceMember interface
const interfaceTarget = "export interface SpaceMember {";
const interfaceReplacement = `export interface SpaceMember {
  status?: 'active' | 'pending' | 'disputed';
  disputeMessage?: string;`;
if (content.includes(interfaceTarget) && !content.includes("status?: 'active'")) {
  content = content.replace(interfaceTarget, interfaceReplacement);
}

// 2. Update finalizeGuestJoin to set status to 'pending'
const finalizeTarget = "role: 'partner' as const,";
const finalizeReplacement = `role: 'partner' as const,
        status: 'pending',`;
if (content.includes(finalizeTarget) && !content.includes("status: 'pending'")) {
  content = content.replace(finalizeTarget, finalizeReplacement);
}

// 3. Add updateMemberStatus method
const contextTypeTarget = "updateMemberPermissions: (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => void;";
const contextTypeReplacement = `updateMemberPermissions: (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => void;
  updateMemberStatus: (spaceId: string, userId: string, status: 'active' | 'pending' | 'disputed', message?: string) => void;
  migrateGuestToRealUser: (spaceId: string, shadowToken: string, realUid: string, realName: string) => void;`;
if (content.includes(contextTypeTarget) && !content.includes("updateMemberStatus:")) {
  content = content.replace(contextTypeTarget, contextTypeReplacement);
}

// 4. Implement updateMemberStatus and migrateGuestToRealUser
const implTarget = "const updateMemberPermissions = (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => {";
const implReplacement = `const updateMemberStatus = (spaceId: string, userId: string, status: 'active' | 'pending' | 'disputed', message?: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m => m.userId === userId ? { ...m, status, disputeMessage: message || m.disputeMessage } : m)
    }));
  };

  const migrateGuestToRealUser = (spaceId: string, shadowToken: string, realUid: string, realName: string) => {
    saveSpaceUpdate(spaceId, space => {
      // Replace member token with real ID and set to active
      const updatedMembers = (space.members || []).map(m => 
        m.userId === shadowToken ? { ...m, userId: realUid, name: realName, status: 'active' as const, disputeMessage: '' } : m
      );
      
      // Update any invoices that had the shadow token in excludedMembers
      const updatedInvoices = (space.invoices || []).map(inv => ({
        ...inv,
        excludedMembers: (inv.excludedMembers || []).map(id => id === shadowToken ? realUid : id)
      }));
      
      return { ...space, members: updatedMembers as any, invoices: updatedInvoices };
    });
  };

  const updateMemberPermissions = (spaceId: string, userId: string, permissions: Partial<SpaceMember>) => {`;
if (content.includes(implTarget) && !content.includes("const updateMemberStatus")) {
  content = content.replace(implTarget, implReplacement);
}

// 5. Provide them in context
const providerTarget = "updateMemberPermissions,";
const providerReplacement = `updateMemberPermissions,
        updateMemberStatus,
        migrateGuestToRealUser,`;
if (content.includes(providerTarget) && !content.includes("updateMemberStatus,")) {
  content = content.replace(providerTarget, providerReplacement);
}

fs.writeFileSync('src/app/context/SpacesContext.tsx', content, 'utf-8');
console.log('SpacesContext updated for Dispute Flow');
