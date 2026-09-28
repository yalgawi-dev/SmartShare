const fs = require('fs');
const file = 'src/app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const useAuthMatch = 'const { user, isLoaded: isAuthLoaded, logout } = useAuth();\n  const [showAuthModal, setShowAuthModal] = useState(false);';
const effectCode = `\n  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('action=login')) {
      setShowAuthModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);`;

content = content.replace(useAuthMatch, useAuthMatch + effectCode);
fs.writeFileSync(file, content, 'utf8');
console.log("Patched page.tsx successfully");
