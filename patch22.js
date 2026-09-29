const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', 'utf8');

if (!c.includes("import { useRouter }")) {
  c = c.replace(
    "import { universalSearch } from '../../utils/searchEngine';",
    "import { universalSearch } from '../../utils/searchEngine';\nimport { useRouter } from 'next/navigation';"
  );
}

c = c.replace(
  "const { user, updateProfile } = useAuth();",
  "const { user, updateProfile } = useAuth();\n  const router = useRouter();"
);

// We need to add an onClick to the notification card.
// We have: <div key={n.id} style={{ ... }} >
const searchStr =             processedNotifications.map(n => (
              <div 
                key={n.id} 
                style={{ 
                  background: n.actionable ? '#eff6ff' : 'var(--bg-card)', 
                  border: n.actionable ? '1px solid #bfdbfe' : '1px solid var(--border-light)',
                  borderRight: n.priority === 'high' ? '4px solid #ef4444' : n.priority === 'medium' ? '4px solid #f59e0b' : '4px solid #3b82f6',
                  borderRadius: '12px', 
                  padding: '1rem',
                  position: 'relative'
                }}
              >;

const replaceStr =             processedNotifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => {
                  onClose();
                  router.push('/space/' + n.spaceId);
                }}
                style={{ 
                  background: n.actionable ? '#eff6ff' : 'var(--bg-card)', 
                  border: n.actionable ? '1px solid #bfdbfe' : '1px solid var(--border-light)',
                  borderRight: n.priority === 'high' ? '4px solid #ef4444' : n.priority === 'medium' ? '4px solid #f59e0b' : '4px solid #3b82f6',
                  borderRadius: '12px', 
                  padding: '1rem',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >;

c = c.replace(searchStr, replaceStr);

fs.writeFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/NotificationCenterWidget.tsx', c, 'utf8');
