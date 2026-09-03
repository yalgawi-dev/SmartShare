const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const targetStr = `              // We just do it locally for this render. To do it in DB properly:
              setTimeout(() => {
                const { doc, updateDoc } = require('firebase/firestore');
                updateDoc(doc.ref, { members: cleanMembers }).catch(console.error);
              }, 1000);`;

const replacementStr = `              // We just do it locally for this render. To do it in DB properly:
              setTimeout(() => {
                updateDoc(doc.ref, { members: cleanMembers }).catch(console.error);
              }, 1000);`;

c = c.replace(targetStr, replacementStr);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Fixed cleanup firebase require');
