const fs = require('fs');
let content = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');

content = content.replace(
    'const newSettings = { ...space.settings, mySharePercentage: undefined };',
    'const newSettings = { ...space.settings, mySharePercentage: undefined, isCustomShare: false };'
);

fs.writeFileSync('src/app/context/SpacesContext.tsx', content, 'utf8');
console.log('Updated SpacesContext.tsx successfully.');
