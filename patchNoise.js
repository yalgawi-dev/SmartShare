const fs = require('fs');
let c = fs.readFileSync('src/utils/opencvFilters.ts', 'utf-8');

c = c.replace(
    'let S = planes.get(1);\n        S.convertTo(S, -1, 1.25, 0);',
    'let S = planes.get(1);\n        cv.medianBlur(S, S, 3); // Kills chroma noise (rainbow dots)\n        S.convertTo(S, -1, 1.25, 0);'
);

c = c.replace(
    '// Thicken the text mask slightly so the text doesn\'t look thin and "blinding"',
    '// Remove 1-pixel salt-and-pepper noise from the mask before thickening\n        cv.medianBlur(mask, mask, 3);\n\n        // Thicken the text mask slightly so the text doesn\'t look thin and "blinding"'
);

fs.writeFileSync('src/utils/opencvFilters.ts', c);
console.log('Patched opencvFilters.ts to remove chroma noise');
