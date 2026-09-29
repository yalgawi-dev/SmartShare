const fs = require('fs');
let file = 'src/app/space/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('InstallAppHeaderButton')) {
  content = content.replace("import { uploadImageToStorage } from '@/lib/firebase';", "import { uploadImageToStorage } from '@/lib/firebase';\nimport InstallAppHeaderButton from '../../../components/InstallAppHeaderButton';");
  
  const oldDiv = \<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>\;
  
  const newDiv = \<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <InstallAppHeaderButton />
          <div style={{ position: 'relative' }}>\;
          
  content = content.replace(oldDiv, newDiv);
  fs.writeFileSync(file, content, 'utf8');
}
