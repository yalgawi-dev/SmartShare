const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

const oldProcessBatch = `    processBatch: (urls: string[]) => {
      if (!addInboxItems) return;
      const newItems = urls.map(url => ({
        imageUrl: url,
        status: 'processing' as const,
        uploadedBy: user?.realName || 'משתמש',
      }));
      addInboxItems(space.id, newItems);
      setActiveTab('inbox');
      setToastMsg('החשבוניות נשלחו לעיבוד רקע בהצלחה!');
      setTimeout(() => setToastMsg(null), 3500);
    },`;

const newProcessBatch = `    processBatch: (urls: string[]) => {
      if (!urls || urls.length === 0) return;
      if (urls.length > 1) {
        setBatchQueue(urls.slice(1));
        setToastMsg(\`מעבד חשבונית 1 מתוך \${urls.length}...\`);
        setTimeout(() => setToastMsg(null), 3500);
      }
      runOcrPipeline(urls[0]);
    },`;

content = content.replace(oldProcessBatch, newProcessBatch);

// Now, handle adding the next item when a form closes:
const handleCloseFormOld = `  const handleCloseForm = () => {
    if(setIsAddingExpense) setIsAddingExpense(false);
    setScannedImage(null);
    setSelectedCategory('כללי'); // Reset to default so next time 'הזנה' opens the correct modal
    
    setOcrData({});
    setOcrDebugMessage(null);
    setOcrElapsedTime(0);
  };`;

const handleCloseFormNew = `  const handleCloseForm = () => {
    if(setIsAddingExpense) setIsAddingExpense(false);
    setScannedImage(null);
    setSelectedCategory('כללי'); // Reset to default so next time 'הזנה' opens the correct modal
    
    setOcrData({});
    setOcrDebugMessage(null);
    setOcrElapsedTime(0);
    
    // Process next item in batch queue if any
    if (batchQueue.length > 0) {
      const nextUrl = batchQueue[0];
      setBatchQueue(prev => prev.slice(1));
      setTimeout(() => {
        runOcrPipeline(nextUrl);
      }, 400); // slight delay to allow closing animation
    }
  };`;

content = content.replace(handleCloseFormOld, handleCloseFormNew);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content);
