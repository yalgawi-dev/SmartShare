const fs = require('fs');
let txt = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');
const search = "  }, [activeChatId, space?.features]);";
const replace = `  }, [activeChatId, space?.features]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      setTimeout(() => {
        const id = window.location.hash.substring(1);
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const oldBg = el.style.backgroundColor;
          el.style.transition = 'background-color 0.5s ease';
          el.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
          setTimeout(() => el.style.backgroundColor = oldBg, 2500);
        }
      }, 500);
    }
  }, []);`;
txt = txt.replace(search, replace);
fs.writeFileSync('src/app/space/[id]/page.tsx', txt);
console.log('Replaced effect');
