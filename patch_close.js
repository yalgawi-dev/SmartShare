const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

const oldHandleClose = `  const handleCloseForm = () => {
    if(setIsAddingExpense) setIsAddingExpense(false);
    setScannedImage(null);
    setSelectedCategory('כללי'); // Reset to default so next time 'הזנה' opens the correct modal
    
    setOcrData({});
    setOcrDebugMessage(null);
    setOcrElapsedTime(0);
  };`;

const newHandleClose = `  const handleCloseForm = () => {
    if(setIsAddingExpense) setIsAddingExpense(false);
    setScannedImage(null);
    setSelectedCategory('כללי'); // Reset to default so next time 'הזנה' opens the correct modal
    
    setOcrData({});
    setOcrDebugMessage(null);
    setOcrElapsedTime(0);

    setBatchQueue(prev => {
      if (prev.length > 0) {
        const nextUrl = prev[0];
        setTimeout(() => {
          runOcrPipeline(nextUrl);
        }, 400); // slight delay to allow closing animation
        return prev.slice(1);
      }
      return prev;
    });
  };`;

content = content.replace(oldHandleClose, newHandleClose);
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content);
