const fs = require('fs');
let content = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

const regex = /export interface SpaceMember \{\s*userId: string;/;
content = content.replace(regex, `export interface SpaceMember {\n  status?: 'active' | 'pending' | 'disputed';\n  disputeMessage?: string;\n  userId: string;`);

// And invoice excludedMembers
const invoiceRegex = /export interface Invoice \{\s*id: string;/;
content = content.replace(invoiceRegex, `export interface Invoice {\n  excludedMembers?: string[];\n  id: string;`);

fs.writeFileSync('src/app/context/SpacesContext.tsx', content, 'utf-8');
console.log('Fixed SpaceMember and Invoice types');
