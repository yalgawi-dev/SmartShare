const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8');

const stateInjection = `
  const { addGuestPartner } = useSpaces() as any;
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [isRetroactive, setIsRetroactive] = useState(true);
  const [generatedLink, setGeneratedLink] = useState('');

  const handleCreateInvite = () => {
    if (!inviteName.trim()) return alert('הכנס שם שותף');
    const shadowToken = 'guest_' + Math.random().toString(36).substr(2, 9);
    addGuestPartner(space.id, inviteName, isRetroactive, shadowToken);
    
    const url = new URL(window.location.href);
    url.pathname = '/space/' + space.id;
    url.searchParams.set('invite', shadowToken);
    setGeneratedLink(url.toString());
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    alert('הקישור הועתק! שלח אותו לשותף.');
    setShowInviteModal(false);
    setGeneratedLink('');
    setInviteName('');
  };

  const handleInviteClick = () => {
    setShowInviteModal(true);
  };
`;

content = content.replace(/const { addInvoice, updateInvoice, updateSpaceSettings } = useSpaces\(\);/, 'const { addInvoice, updateInvoice, updateSpaceSettings } = useSpaces();\n' + stateInjection);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content, 'utf-8');
console.log('FinanceWidget successfully updated state hooks');
