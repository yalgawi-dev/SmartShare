const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', 'utf8');

const searchStr =                 onClick={() => {
                  onClose();
                  router.push('/space/' + n.spaceId);
                }};

const replaceStr =                 onClick={() => {
                  onClose();
                  const targetTab = n.type === 'invoice' ? '?tab=inbox' : '?tab=partners';
                  router.push('/space/' + n.spaceId + targetTab);
                }};

c = c.replace(searchStr, replaceStr);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', c, 'utf8');
