const fs = require('fs');
const file = 'src/components/widgets/FinanceWidget.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = "  const runOcrPipeline = async (imgUrl: string, allPages?: string[]) => {";

const replaceStr =   const runOcrPipeline = async (imgUrl: string, allPages?: string[]) => {
    setIsScanning(false);
    if(setIsAddingExpense) setIsAddingExpense(true);
    setIsAnalyzing(true);
    setOcrData({});
    setOcrElapsedTime(0);

    let finalImgUrl = imgUrl;

    // MERGE PAGES IF MULTIPLE
    if (allPages && allPages.length > 1) {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const loadedImages = await Promise.all(allPages.map(url => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        }));

        // Calculate dimensions
        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0);

        canvas.width = maxWidth;
        canvas.height = totalHeight;

        let currentY = 0;
        loadedImages.forEach((img, i) => {
          // Draw image
          ctx.drawImage(img, 0, currentY, img.width, img.height);
          
          // Draw page number badge
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(10, currentY + 10, 100, 40);
          ctx.fillStyle = '#FFD700';
          ctx.font = '24px Arial';
          ctx.fillText('עמוד ' + (i+1), 20, currentY + 38);

          currentY += img.height;
        });

        finalImgUrl = canvas.toDataURL('image/jpeg', 0.85);
      } catch (err) {
        console.error('Failed to merge pages', err);
      }
    }

    // Now proceed with finalImgUrl
    const urlToUpload = finalImgUrl;
;

content = content.replace("  const runOcrPipeline = async (imgUrl: string, allPages?: string[]) => {\r\n      setIsScanning(false);\r\n      if(setIsAddingExpense) setIsAddingExpense(true); // Open the form immediately\r\n      setIsAnalyzing(true);\r\n      setOcrData({}); // Clear old data\r\n      setOcrElapsedTime(0);", replaceStr);

// We also need to replace the imgUrl usage with finalImgUrl everywhere inside the function
// But actually urlToUpload is better.
