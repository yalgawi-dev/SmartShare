const fs = require('fs');

const content = `/**
 * Partner Engine Utils
 * Handles all logic related to partners, shares, and expirations.
 * This keeps the Partner logic decoupled from Finance and other widgets.
 */

export const isPartnerExpired = (joinedAt: string | undefined | null, expHours: number = 1): boolean => {
  if (!joinedAt) return false;
  const expiresMs = new Date(joinedAt).getTime() + (expHours * 3600000);
  return expiresMs - Date.now() <= 0;
};

export const getRemainingTimeText = (joinedAt: string | undefined | null, expHours: number = 1): string => {
  if (!joinedAt) return '';
  const expiresMs = new Date(joinedAt).getTime() + (expHours * 3600000);
  const diffMs = expiresMs - Date.now();
  
  if (diffMs <= 0) return 'פג תוקף';
  
  const minutesLeft = Math.floor(diffMs / 60000);
  if (minutesLeft < 60) return \`נותרו \${minutesLeft} דק'\`;
  
  const hoursLeft = Math.floor(minutesLeft / 60);
  const minsRound = minutesLeft % 60;
  return \`נותרו \${hoursLeft} ש' \${minsRound > 0 ? "ו-" + minsRound + " דק'" : ""}\`;
};
`;

fs.writeFileSync('src/utils/partnerUtils.ts', content, 'utf8');
console.log('Rewrote partnerUtils.ts perfectly');
