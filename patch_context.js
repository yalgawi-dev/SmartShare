const fs = require('fs');
let tx = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf8');

if (!tx.includes('logoUrl?: string;')) {
    tx = tx.replace('coverImage?: string;', 'coverImage?: string;\n  logoUrl?: string;');
}

if (!tx.includes('updateSpaceLogo:')) {
    tx = tx.replace('updateSpaceCover: (spaceId: string, newCoverUrl: string) => void;', 'updateSpaceCover: (spaceId: string, newCoverUrl: string) => void;\n  updateSpaceLogo: (spaceId: string, newLogoUrl: string) => void;');
    
    const impl = `  const updateSpaceLogo = (spaceId: string, newLogoUrl: string) => {
    saveSpaceUpdate(spaceId, space => ({ ...space, logoUrl: newLogoUrl, updatedAt: '\u05e2\u05d5\u05d3\u05db\u05df \u05e2\u05db\u05e9\u05d9\u05d5' }));
  };`;
  
    tx = tx.replace('const updateSpaceCover = (spaceId: string, newCoverUrl: string) => {', impl + '\n\n  const updateSpaceCover = (spaceId: string, newCoverUrl: string) => {');
    
    tx = tx.replace('updateSpaceCover, updateSpaceIcon', 'updateSpaceCover, updateSpaceLogo, updateSpaceIcon');
}

fs.writeFileSync('src/app/context/SpacesContext.tsx', tx);
console.log('Context patched');
