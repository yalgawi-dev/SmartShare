const fs = require('fs');

const path = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Replace the incorrect closing tags
const target = `                  <span dir="ltr">₪{b.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                </div>
              ))}
            </div>`;
            
const replacement = `                  <span dir="ltr">₪{b.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                </div>
              );
              })}
            </div>`;

// Or more safely via regex:
const regex = /<span dir="ltr">₪\{b\.paid\.toLocaleString\(undefined, \{maximumFractionDigits: 0\}\)\}<\/span>\s*<\/div>\s*\)\)\}\s*<\/div>/m;
const newStr = `<span dir="ltr">₪{b.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                </div>
              );
              })}
            </div>`;

if (content.match(regex)) {
  content = content.replace(regex, newStr);
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Fixed syntax error in FinanceSummary');
} else {
  console.log('Could not find syntax error regex');
  // fallback search
  const idx = content.indexOf('))}');
  if (idx > -1) {
    console.log('Found fallback');
  }
}
