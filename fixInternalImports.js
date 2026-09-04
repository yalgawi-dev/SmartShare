const fs = require('fs');

const fixRelativePaths = (filePath) => {
  let c = fs.readFileSync(filePath, 'utf-8');
  // Add an extra '../' to context imports
  c = c.replace(/from '\.\.\/\.\.\/app\/context/g, "from '../../../app/context");
  // Fix partnerUtils import in PendingApprovalBanner
  c = c.replace(/from '\.\.\/\.\.\/utils\/partnerUtils'/g, "from '../../../utils/partnerUtils'");
  
  // WelcomeGate might also have some other relative imports
  c = c.replace(/from '\.\.\/GenericWidget'/g, "from '../../GenericWidget'");
  c = c.replace(/from '\.\.\/\.\.\/app\//g, "from '../../../app/");
  
  fs.writeFileSync(filePath, c);
};

fixRelativePaths('src/components/widgets/Partners/PendingApprovalBanner.tsx');
fixRelativePaths('src/components/widgets/Partners/WelcomeGate.tsx');

console.log('Fixed relative imports');
