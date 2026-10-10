const fs = require('fs');
let tx = fs.readFileSync('src/app/page.tsx', 'utf8');

if (!tx.includes('logoMenuOpenId, setLogoMenuOpenId')) {
    tx = tx.replace('const [expandedSpaceId, setExpandedSpaceId] = useState<string | null>(null);', 
                    'const [expandedSpaceId, setExpandedSpaceId] = useState<string | null>(null);\n  const [logoMenuOpenId, setLogoMenuOpenId] = useState<string | null>(null);');
}

const compressor = `const resizeAndCompressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 256;
        let { width, height } = img;
        if (width > height) { if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } }
        else { if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};`;

if (!tx.includes('resizeAndCompressImage')) {
    tx = tx.replace('export default function Dashboard() {', compressor + '\n\nexport default function Dashboard() {');
}

fs.writeFileSync('src/app/page.tsx', tx);
console.log('Fixed states');
