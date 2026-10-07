const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

content = content.replace(
  "processScan: (url: string, allPages?: string[]) => {\n      runOcrPipeline(url, allPages);\n    },",
  "processScan: (url: string, allPages?: string[]) => {\n      runOcrPipeline(url, allPages);\n    },\n    processBatch: (urls: string[]) => {\n      if (!addInboxItems) return;\n      const newItems = urls.map(url => ({\n        id: 'inbox_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),\n        imageUrl: url,\n        status: 'processing',\n        timestamp: Date.now()\n      }));\n      addInboxItems(space.id, newItems);\n      setActiveTab('inbox');\n      setToastMsg('החשבוניות נשלחו לעיבוד רקע בהצלחה!');\n    },"
);

// Add addInboxItems to useSpaces destructuring
content = content.replace(
  "const { addInvoice, updateInvoice, updateSpaceSettings, updateSharesBulk, getRoleForSpace, getTokenForSpace, removeInboxItem } = useSpaces();",
  "const { addInvoice, updateInvoice, updateSpaceSettings, updateSharesBulk, getRoleForSpace, getTokenForSpace, removeInboxItem, addInboxItems } = useSpaces();"
);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content);
