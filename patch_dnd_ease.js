const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/SortableTray.tsx', 'utf8');

const target = `    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),`;
const replacement = `    // Reduced delay and increased tolerance to make DND easier to trigger on mobile
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 10 } }),`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/widgets/SortableTray.tsx', code);
console.log('Replaced TouchSensor settings');
