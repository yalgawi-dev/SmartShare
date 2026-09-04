import re

file_path = 'src/components/widgets/Finance/FinanceSummary.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the pending expiration UI buttons entirely
pattern = r'\{\(b as any\)\.status === \'pending\' && \([\s\S]*?</div>\s*\)\}\s*</div>\s*</td>'
replacement = '''{(b as any).status === 'pending' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            ? ממתין
          </span>
        </div>
      )}
    </div>
  </td>'''
content = re.sub(pattern, replacement, content)

# 2. Hide pending members if partners engine is disabled and paid is 0
content = content.replace(
    '                {balances.map((b) => {\n                  const isInactive = activePartnersCount === 0 && b.userId !== myId;',
    '                {balances.map((b) => {\n                  if (activePartnersCount === 0 && getattr(b, \"status\", \"\") == \"pending\" and b.paid == 0) return null;\n                  const isInactive = activePartnersCount === 0 && b.userId !== myId;'.replace('getattr(b, \"status\", \"\") == \"pending\" and b.paid == 0', '(b as any).status === \\'pending\\' && b.paid === 0')
)

# 3. Simplify the tr background color
content = re.sub(
    r'<tr key=\{b\.name\} style=\{\{ borderBottom: \'1px solid var\(--border-light\)\', background: \(b as any\)\.status === \'pending\'.*?\? \'rgba\(239, 68, 68, 0\.05\)\' : b\.userId === myId \? \'rgba\(79, 70, 229, 0\.05\)\' : \'transparent\', opacity: isInactive \? 0\.6 : 1 \}\}>',
    '<tr key={b.name} style={{ borderBottom: \\'1px solid var(--border-light)\\', background: b.userId === myId ? \\'rgba(79, 70, 229, 0.05)\\' : \\'transparent\\', opacity: isInactive ? 0.6 : 1 }}>',
    content
)

# 4. Remove unused imports
content = content.replace(
    \"import { getRemainingTimeText, isPartnerExpired } from '../../../utils/partnerUtils';\",
    \"\"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
