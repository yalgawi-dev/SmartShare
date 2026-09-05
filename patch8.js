const fs = require('fs');
const file = 'src/app/context/AuthContext.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = \if (!activeUser.isBlocked) {\;

const mergeLogic = \
          // Fundamental Fix: Merge local cache keys into Firebase so they never get lost
          if (typeof window !== 'undefined') {
            try {
              const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
              const currentKeys = activeUser.spaceKeys || {};
              let keysUpdated = false;
              
              Object.keys(localKeys).forEach(spaceId => {
                if (!currentKeys[spaceId]) {
                  currentKeys[spaceId] = localKeys[spaceId];
                  keysUpdated = true;
                }
              });
              
              if (keysUpdated) {
                activeUser.spaceKeys = currentKeys;
                await updateDoc(userRef, { spaceKeys: currentKeys });
              }
            } catch(e) {
              console.error('Failed to merge local keys', e);
            }
          }

          if (!activeUser.isBlocked) {\;

content = content.replace(targetStr, mergeLogic);
fs.writeFileSync(file, content, 'utf8');
