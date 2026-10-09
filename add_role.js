const fs = require('fs');
let code = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');

const updateRoleFunc = `
  const updateMemberRole = (spaceId: string, userId: string, role: 'admin' | 'partner') => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m => m.userId === userId ? { ...m, role } : m)
    }));
  };
`;

if (!code.includes('updateMemberRole')) {
  // Add to Context Interface
  code = code.replace(
    'updateMemberStatus: (spaceId: string, userId: string, status: \'active\' | \'pending\' | \'disputed\', message?: string) => void;',
    'updateMemberStatus: (spaceId: string, userId: string, status: \'active\' | \'pending\' | \'disputed\', message?: string) => void;\n  updateMemberRole: (spaceId: string, userId: string, role: \'admin\' | \'partner\') => void;'
  );

  // Add the function
  code = code.replace(
    'const updateMemberStatus = (spaceId: string, userId: string, status: \'active\' | \'pending\' | \'disputed\', message?: string) => {',
    updateRoleFunc + '\n  const updateMemberStatus = (spaceId: string, userId: string, status: \'active\' | \'pending\' | \'disputed\', message?: string) => {'
  );

  // Add to provider export
  code = code.replace(
    'updateMemberStatus, refreshMemberInvite',
    'updateMemberStatus, updateMemberRole, refreshMemberInvite'
  );

  fs.writeFileSync('src/app/context/SpacesContext.tsx', code);
  console.log("Added updateMemberRole to SpacesContext!");
} else {
  console.log("updateMemberRole already exists.");
}
