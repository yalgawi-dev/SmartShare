const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/app/space/[id]/page.tsx', 'utf8');

c = c.replace(
  "const [financeTab, setFinanceTab] = useState<'summary' | 'transactions' | 'inbox'>('summary');",
  "const [financeTab, setFinanceTab] = useState<'summary' | 'transactions' | 'inbox'>(() => { if (typeof window !== 'undefined') { const t = new URLSearchParams(window.location.search).get('tab'); if (t === 'inbox' || t === 'transactions') return t as any; } return 'summary'; });"
);

c = c.replace(
  "const [showPartnersModal, setShowPartnersModal] = useState(false);",
  "const [showPartnersModal, setShowPartnersModal] = useState(() => { if (typeof window !== 'undefined') { return new URLSearchParams(window.location.search).get('tab') === 'partners'; } return false; });"
);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/app/space/[id]/page.tsx', c, 'utf8');
