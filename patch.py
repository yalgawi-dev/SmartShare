import os
import io

file_path = 'src/components/widgets/Partners/SharesEditorModal.tsx'
with io.open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace expHours state definition
content = content.replace(
    'const [expHours, setExpHours] = useState(space.settings?.pendingExpirationHours || 1);',
    'const [expHours, setExpHours] = useState((space.settings?.pendingExpirationHours || 1).toString());'
)

# Replace the value assignment
content = content.replace(
    'value={expHours.toString()} onChange={e => setExpHours(Number(e.target.value))}',
    'value={expHours} onChange={e => setExpHours(e.target.value)}'
)

# Replace useEffect dependency and save logic
old_save_logic = '''        if (updateSpaceSettings) {
          updateSpaceSettings(space.id, { pendingExpirationHours: expHours });
        }'''

new_save_logic = '''        if (updateSpaceSettings) {
          const parsedHours = parseFloat(expHours);
          if (!isNaN(parsedHours) && parsedHours > 0) {
            updateSpaceSettings(space.id, { pendingExpirationHours: parsedHours });
          }
        }'''
content = content.replace(old_save_logic, new_save_logic)

with io.open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated SharesEditorModal.tsx successfully.")
