import sys

file = "src/components/widgets/Partners/SharesEditorModal.tsx"
with open(file, "r", encoding="utf-8") as f:
    text = f.read()

import_line = "import { getRemainingTimeText } from '../../../utils/partnerUtils';\n"
if "getRemainingTimeText" not in text:
    text = text.replace("import { useSpaces }", import_line + "import { useSpaces }")

old_block = """                {isPending && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: isExpired ? '#ef4444' : '#f59e0b', fontWeight: isExpired ? 'bold' : 'normal' }}>
                      {isExpired ? '? פג תוקף' : '? ממתין לאישור'}
                    </span>
                     style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>??? הסר</button>
                        <button type="button" onClick={() => refreshMemberInvite(space.id, m.userId)} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: '4px', color: '#3b82f6', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>?? חדש</button>
                      </div>
                    )}
                  </div>
                )}"""

new_block = """                {isPending && (
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
                )}"""

text = text.replace(old_block, new_block)

with open(file, "w", encoding="utf-8") as f:
    f.write(text)

