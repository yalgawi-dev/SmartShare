const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', 'utf8');
c = c.replace(/..\/..\/..\/app\/context/g, '../../app/context');
fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', c, 'utf8');
