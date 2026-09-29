const fs = require('fs');
const file = 'src/components/widgets/Finance/FinanceTransactions.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\{activePartnersCount > 0 && \(\s*<div style=\{\{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1\.5rem' \}\}>\s*<span style=\{\{ fontSize: '0\.9rem', color: 'var\(--text-secondary\)' \}\}>.*?<\/span>\s*<select\s*value=\{memberFilter\}\s*onChange=\{\(e\) => setMemberFilter\(e\.target\.value\)\}\s*style=\{\{ padding: '0\.4rem 0\.8rem', borderRadius: 'var\(--radius-md\)', border: '1px solid var\(--border-light\)', background: 'var\(--bg-main\)', fontSize: '0\.85rem' \}\}\s*>\s*<option value="all">.*?<\/option>\s*\{allUsers\.map\(u => \(\s*<option key=\{u\.id\} value=\{u\.id\}>\{u\.name\}<\/option>\s*\)\)\}\s*<\/select>\s*<\/div>\s*\)\}/;

console.log(regex.test(content));
