const fs = require('fs');
const file = 'src/app/layout.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('import PhoneVerificationModal from "../components/widgets/Auth/PhoneVerificationModal";', '');
content = content.replace('<PhoneVerificationModal />', '');
fs.writeFileSync(file, content, 'utf8');
