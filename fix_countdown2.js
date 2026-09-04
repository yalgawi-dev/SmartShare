const fs = require("fs");
const file = "src/components/widgets/Partners/SharesEditorModal.tsx";
let text = fs.readFileSync(file, "utf8");

const newBlock = `{isPending && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: isExpired ? '#ef4444' : '#f59e0b', fontWeight: isExpired ? 'bold' : 'normal' }}>
                      {isExpired ? '? פג תוקף' : '? ממתין'}
                    </span>
                    {!isExpired && m.joinedAt && (
                      <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
                        {getRemainingTimeText(m.joinedAt, space.settings?.pendingExpirationHours || 1)}
                      </span>
                    )}
                  </div>
                )}`;

text = text.replace(/\{isPending && \([\s\S]*?<\/div>\s*\)\}/, newBlock);
fs.writeFileSync(file, text, "utf8");

