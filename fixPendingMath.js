const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const oldUpdateMemberStatus = `  const updateMemberStatus = (spaceId: string, userId: string, status: 'active' | 'pending' | 'disputed', message?: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m => m.userId === userId ? { ...m, status, disputeMessage: message || m.disputeMessage } : m)
    }));
  };`;

const newUpdateMemberStatus = `  const updateMemberStatus = (spaceId: string, userId: string, status: 'active' | 'pending' | 'disputed', message?: string) => {
    saveSpaceUpdate(spaceId, space => ({
      ...space,
      members: (space.members || []).map(m => m.userId === userId ? { ...m, status, disputeMessage: message || m.disputeMessage } : m)
    }));
    
    if (status === 'active') {
      setTimeout(() => {
        autoBalanceShares(spaceId, 'system_approval');
      }, 500);
    }
  };`;

c = c.replace(oldUpdateMemberStatus, newUpdateMemberStatus);

const oldMigrate = `  const migrateGuestToRealUser = (spaceId: string, shadowToken: string, realUid: string, realName: string) => {
    saveSpaceUpdate(spaceId, space => {
      // Replace member token with real ID and set to active
      const updatedMembers = (space.members || []).map(m => 
        m.userId === shadowToken ? { ...m, userId: realUid, name: realName, status: 'active' as const, disputeMessage: '' } : m
      );`;

const newMigrate = `  const migrateGuestToRealUser = (spaceId: string, shadowToken: string, realUid: string, realName: string) => {
    saveSpaceUpdate(spaceId, space => {
      // Replace member token with real ID and set to active
      const updatedMembers = (space.members || []).map(m => 
        m.userId === shadowToken ? { ...m, userId: realUid, name: realName, status: 'active' as const, disputeMessage: '' } : m
      );
      
      setTimeout(() => {
        autoBalanceShares(spaceId, 'system_migrate');
      }, 500);`;

c = c.replace(oldMigrate, newMigrate);

const oldCalc = `  const activeMembers = members.filter(m => m.isActive !== false);`;
const newCalc = `  const activeMembers = members.filter(m => m.isActive !== false && m.status !== 'pending');`;

c = c.replace(oldCalc, newCalc);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Fixed pending math');
