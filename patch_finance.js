const fs = require('fs');
const file = 'src/components/widgets/FinanceWidget.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /if \(allPages && allPages\.length > 1 && !imgUrl\.startsWith\('data:application\/pdf'\)\) \{[\s\S]*?processingUrl = canvas\.toDataURL\('image\/jpeg', 0\.85\);\r?\n\s*\}\r?\n\s*\} catch \(e\) \{/m;

const replacement = `if (allPages && allPages.length > 1 && !imgUrl.startsWith('data:application/pdf')) {
          try {
            processingUrl = await mergeImagesCleanly(allPages);
          } catch (e) {`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('patched FinanceWidget');
