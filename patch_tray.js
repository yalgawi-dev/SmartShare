const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/SortableTray.tsx', 'utf8');

content = content.replace(
  "  onItemClick: (item: TrayItem) => void;\n}",
  "  onItemClick: (item: TrayItem) => void;\n  onItemDelete?: (item: TrayItem) => void;\n}"
);

content = content.replace(
  "export default function SortableTray({ items, onReorder, onItemClick }: SortableTrayProps) {",
  "export default function SortableTray({ items, onReorder, onItemClick, onItemDelete }: SortableTrayProps) {"
);

content = content.replace(
  "              onClick={() => onItemClick(item)}\n            />",
  "              onClick={() => onItemClick(item)}\n              onDelete={onItemDelete ? (e) => onItemDelete(item) : undefined}\n            />"
);

fs.writeFileSync('src/components/widgets/SortableTray.tsx', content);
