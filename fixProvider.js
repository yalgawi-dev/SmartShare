const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

c = c.replace(
  "<SpacesContext.Provider value={{ spaces, addSpace, deleteSpace, restoreSpace",
  "<SpacesContext.Provider value={{ spaces, getRoleForSpace, addSpace, deleteSpace, restoreSpace"
);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Added getRoleForSpace to provider');
