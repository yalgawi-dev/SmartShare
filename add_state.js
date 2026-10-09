const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('const [activeTab'));
if(idx > -1) {
    lines.splice(idx+1, 0, "  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');");
    fs.writeFileSync('src/components/widgets/Vault/DocumentsWidget.tsx', lines.join('\n'));
    console.log("State added");
}
