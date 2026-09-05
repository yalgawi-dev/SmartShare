const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', 'utf8');

content = content.replace(
    'const [expHours, setExpHours] = useState(space.settings?.pendingExpirationHours || 1);',
    'const [expHours, setExpHours] = useState((space.settings?.pendingExpirationHours || 1).toString());'
);

content = content.replace(
    'value={expHours.toString()} onChange={e => setExpHours(Number(e.target.value))}',
    'value={expHours} onChange={e => setExpHours(e.target.value)}'
);

const old_save_logic =         if (updateSpaceSettings) {
          updateSpaceSettings(space.id, { pendingExpirationHours: expHours });
        };

const new_save_logic =         if (updateSpaceSettings) {
          const parsedHours = parseFloat(expHours);
          if (!isNaN(parsedHours) && parsedHours > 0) {
            updateSpaceSettings(space.id, { pendingExpirationHours: parsedHours });
          }
        };

content = content.replace(old_save_logic, new_save_logic);

fs.writeFileSync('src/components/widgets/Partners/SharesEditorModal.tsx', content, 'utf8');
console.log('Updated SharesEditorModal.tsx successfully.');
