const fs = require('fs');
const lines = fs.readFileSync('src/components/widgets/FloatingActionBar.tsx', 'utf8').split(/\r?\n/);
const idx = lines.findIndex(l => l.includes('useEffect(() => setMounted(true), []);'));
lines.splice(idx + 1, 0, 
  '  const [isInShelf, setIsInShelf] = useState(false);',
  '  const [isVaultTab, setIsVaultTab] = useState(false);',
  '  useEffect(() => {',
  '    const handleOpen = () => setIsInShelf(true);',
  '    const handleClose = () => setIsInShelf(false);',
  '    const handleVaultOn = () => setIsVaultTab(true);',
  '    const handleVaultOff = () => setIsVaultTab(false);',
  '    window.addEventListener("smartshare:shelf_opened", handleOpen);',
  '    window.addEventListener("smartshare:shelf_closed", handleClose);',
  '    window.addEventListener("smartshare:vault_tab_active", handleVaultOn);',
  '    window.addEventListener("smartshare:vault_tab_inactive", handleVaultOff);',
  '    return () => {',
  '      window.removeEventListener("smartshare:shelf_opened", handleOpen);',
  '      window.removeEventListener("smartshare:shelf_closed", handleClose);',
  '      window.removeEventListener("smartshare:vault_tab_active", handleVaultOn);',
  '      window.removeEventListener("smartshare:vault_tab_inactive", handleVaultOff);',
  '    };',
  '  }, []);'
);
fs.writeFileSync('src/components/widgets/FloatingActionBar.tsx', lines.join('\n'));
