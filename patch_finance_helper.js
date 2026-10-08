const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8').split('\n');

// 1. Find state section and add viewMode
const stateIdx = lines.findIndex(l => l.includes("const [searchQuery, setSearchQuery]"));
lines.splice(stateIdx + 1, 0, "  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');");

// 2. We need to extract the expanded content into a render function.
// Let's find exactly where it starts and ends.
const expStart = lines.findIndex(l => l.includes('expandedInvoiceId === inv.id && ('));
const expEnd = lines.findIndex((l, i) => i > expStart && l.includes('            </div>') && lines[i+1]?.includes('          ))}'));
// Wait, the end is the matching `)}` for `expandedInvoiceId === inv.id && (`
// Looking at the console output above, the end is:
//                   </div>
//                 </div>
//               )}
//             </div>
//           ))}
const actualExpEnd = lines.findIndex((l, i) => i > expStart && l.trim() === ')}' && lines[i+1]?.trim() === '</div>' && lines[i+2]?.trim() === '))}');

if (expStart !== -1 && actualExpEnd !== -1) {
  // Extract the expanded JSX (without the `{expandedInvoiceId === inv.id && (` wrapper)
  const expandedJSXLines = lines.slice(expStart + 1, actualExpEnd); 
  
  // Insert the helper function definition right before the return statement.
  const returnIdx = lines.findIndex(l => l.trim() === 'return (');
  
  const helperCode = `
  const renderExpandedDetails = (inv: any) => {
    return (
${expandedJSXLines.join('\n')}
    );
  };
`;
  lines.splice(returnIdx, 0, helperCode);
  
  // Now we need to replace the extracted lines in the map with a call to the helper.
  // We need to re-find the map because we just mutated the array!
  const newExpStart = lines.findIndex((l, i) => i > returnIdx + 10 && l.includes('expandedInvoiceId === inv.id && ('));
  const newActualExpEnd = lines.findIndex((l, i) => i > newExpStart && l.trim() === ')}' && lines[i+1]?.trim() === '</div>' && lines[i+2]?.trim() === '))}');
  
  lines.splice(newExpStart + 1, newActualExpEnd - (newExpStart + 1), "                renderExpandedDetails(inv)");
}

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', lines.join('\n'));
