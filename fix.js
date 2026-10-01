
const fs = require('fs');
const path1 = 'src/components/widgets/ScannerModal.tsx';
let content1 = fs.readFileSync(path1, 'utf8');
const target1 = 'הכנס את המסמך למסגרת\n               </div>';
const target1_rn = target1.replace(/\n/g, '\r\n');
const replacement1 = 'הכנס את המסמך למסגרת\n                 <div style={{ fontSize: \'0.8rem\', color: \'#FFD700\', marginTop: \'0.25rem\' }}>\n                   💡 מומלץ לצלם על רקע כהה\n                 </div>\n               </div>';

if (content1.includes(target1)) {
    fs.writeFileSync(path1, content1.replace(target1, replacement1), 'utf8');
    console.log('Scanner replaced!');
} else if (content1.includes(target1_rn)) {
    fs.writeFileSync(path1, content1.replace(target1_rn, replacement1.replace(/\n/g, '\r\n')), 'utf8');
    console.log('Scanner replaced rn!');
} else {
    console.log('Scanner target not found!');
}

const path2 = 'src/app/context/SpacesContext.tsx';
let content2 = fs.readFileSync(path2, 'utf8');
const target2 = '      const updatePresence = () => {\n        if (!db || !user?.id) return;\n        const userRef = doc(db, \'users\', user.id);';
const target2_rn = target2.replace(/\n/g, '\r\n');
const replacement2 = '      const updatePresence = () => {\n        if (!db || !user?.id) return;\n        if (typeof document !== \'undefined\' && document.visibilityState !== \'visible\') return;\n        const userRef = doc(db, \'users\', user.id);';

if (content2.includes(target2)) {
    fs.writeFileSync(path2, content2.replace(target2, replacement2), 'utf8');
    console.log('SpacesContext replaced!');
} else if (content2.includes(target2_rn)) {
    fs.writeFileSync(path2, content2.replace(target2_rn, replacement2.replace(/\n/g, '\r\n')), 'utf8');
    console.log('SpacesContext replaced rn!');
} else {
    console.log('SpacesContext target not found!');
}

