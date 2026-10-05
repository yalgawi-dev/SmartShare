const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/SortableTray.tsx', 'utf8');

code = code.replace(
  `useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 10 } }),`,
  `useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 15 } }),`
);

fs.writeFileSync('src/components/widgets/SortableTray.tsx', code);
console.log('Increased DND delay');
