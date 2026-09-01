const fs = require('fs');
const filePath = 'src/components/widgets/PartnersWidget.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

const nameCellRegex = /<td style={{ padding: '0\.5rem', fontWeight: 'bold' }}>\s*\{m\.name\}\s*\{m\.isActive === false && ' \(הוסר\)'\}\s*\{m\.userId === user\?\.id && ' \(את\/ה\)'\}\s*<\/td>/;

const newNameCell = `<td style={{ padding: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold' }}>
                        {m.name} 
                        {m.isActive === false && ' (הוסר)'}
                        {m.userId === user?.id && ' (את/ה)'}
                      </div>
                      {m.status === 'pending' && (
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.2rem', fontWeight: 'bold' }}>
                          ⏳ ממתין לאישור השותף
                        </div>
                      )}
                      {m.status === 'disputed' && (
                        <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.2rem', background: '#fef2f2', padding: '0.4rem', borderRadius: '4px' }}>
                          <strong>יש השגה:</strong> {m.disputeMessage}
                        </div>
                      )}
                    </td>`;

if (content.match(nameCellRegex)) {
  content = content.replace(nameCellRegex, newNameCell);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('PartnersWidget updated with status badges');
} else {
  console.log('Could not match name cell regex in PartnersWidget');
}
