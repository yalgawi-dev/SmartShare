const fs = require('fs');
const file = 'src/app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = '  return (\n    <div className={styles.container}>';
const newStr = `
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('action=login')) {
      setShowAuthModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className={styles.container}>`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, newStr);
  fs.writeFileSync(file, content, 'utf8');
  console.log("Patched page.tsx auto login properly");
} else {
  console.log("Could not find targetStr");
}
