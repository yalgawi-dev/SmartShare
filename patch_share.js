const fs = require('fs');
const file = 'src/components/widgets/ScannerModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const newFunc = 
"  const handleShare = async () => {\n" +
"    const currentImg = imageCache[mode];\n" +
"    if (!currentImg) return;\n" +
"    \n" +
"    let shareImg = currentImg;\n" +
"    const allPageUrls = [...scannedPages.map(p => p.imageUrl), currentImg];\n" +
"\n" +
"    if (allPageUrls.length > 1) {\n" +
"      try {\n" +
"        const canvas = document.createElement('canvas');\n" +
"        const ctx = canvas.getContext('2d');\n" +
"        if (ctx) {\n" +
"          const loadedImages = await Promise.all(allPageUrls.map(url => {\n" +
"            return new Promise((resolve, reject) => {\n" +
"              const img = new Image();\n" +
"              img.onload = () => resolve(img);\n" +
"              img.onerror = reject;\n" +
"              img.src = url;\n" +
"            });\n" +
"          }));\n" +
"          const maxWidth = Math.max(...loadedImages.map(img => img.width));\n" +
"          const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0);\n" +
"          canvas.width = maxWidth;\n" +
"          canvas.height = totalHeight;\n" +
"          let currentY = 0;\n" +
"          loadedImages.forEach((img, i) => {\n" +
"            ctx.drawImage(img, 0, currentY, img.width, img.height);\n" +
"            ctx.fillStyle = 'rgba(0,0,0,0.7)';\n" +
"            ctx.fillRect(20, currentY + 20, 160, 60);\n" +
"            ctx.fillStyle = '#FFD700';\n" +
"            ctx.font = 'bold 36px Arial';\n" +
"            ctx.fillText('עמוד ' + (i+1), 40, currentY + 62);\n" +
"            currentY += img.height;\n" +
"          });\n" +
"          shareImg = canvas.toDataURL('image/jpeg', 0.85);\n" +
"        }\n" +
"      } catch (e) {\n" +
"        console.error('Merge for share failed', e);\n" +
"      }\n" +
"    }\n" +
"\n" +
"    try {\n" +
"      const res = await fetch(shareImg);\n" +
"      const blob = await res.blob();\n" +
"      const file = new File([blob], 'scanned-document.jpg', { type: blob.type || 'image/jpeg' });\n" +
"      if (navigator.canShare && navigator.canShare({ files: [file] })) {\n" +
"        await navigator.share({ files: [file], title: 'מסמך סרוק מ-SmartShare' });\n" +
"      } else {\n" +
"        alert('הדפדפן שלך אינו תומך בשיתוף קבצים.');\n" +
"      }\n" +
"    } catch (e) {\n" +
"      console.error('Share failed', e);\n" +
"    }\n" +
"  };";

content = content.replace(/  const handleShare = async \(\) => \{[\s\S]*?console\.error\('Share failed', e\);\r?\n    \}\r?\n  \};/, newFunc);
fs.writeFileSync(file, content, 'utf8');
