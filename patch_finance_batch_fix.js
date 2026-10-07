const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

content = content.replace(
  "    processScan: (url: string, allPages?: string[]) => {\r\n      runOcrPipeline(url, allPages);\r\n    },",
  "    processScan: (url: string, allPages?: string[]) => {\n      runOcrPipeline(url, allPages);\n    },\n    processBatch: (urls: string[]) => {\n      if (!addInboxItems) return;\n      const newItems = urls.map(url => ({\n        imageUrl: url,\n        status: 'processing',\n        uploadedBy: user?.name || 'משתמש',\n      }));\n      addInboxItems(space.id, newItems);\n      setActiveTab('inbox');\n      setToastMsg('החשבוניות נשלחו לעיבוד רקע בהצלחה!');\n    },"
).replace(
  "    processScan: (url: string, allPages?: string[]) => {\n      runOcrPipeline(url, allPages);\n    },",
  "    processScan: (url: string, allPages?: string[]) => {\n      runOcrPipeline(url, allPages);\n    },\n    processBatch: (urls: string[]) => {\n      if (!addInboxItems) return;\n      const newItems = urls.map(url => ({\n        imageUrl: url,\n        status: 'processing',\n        uploadedBy: user?.name || 'משתמש',\n      }));\n      addInboxItems(space.id, newItems);\n      setActiveTab('inbox');\n      setToastMsg('החשבוניות נשלחו לעיבוד רקע בהצלחה!');\n    },"
);

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', content);
