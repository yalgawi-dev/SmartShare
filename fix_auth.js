const fs = require('fs');
let content = fs.readFileSync('src/app/context/AuthContext.tsx', 'utf8');
content = content.replace(
    'const { signInWithPopup } = await import(\\'firebase/auth\\');',
    'const { signInWithRedirect } = await import(\\'firebase/auth\\');'
);
content = content.replace(
    'await signInWithPopup(auth, googleProvider);',
    'await signInWithRedirect(auth, googleProvider);'
);
fs.writeFileSync('src/app/context/AuthContext.tsx', content, 'utf8');
