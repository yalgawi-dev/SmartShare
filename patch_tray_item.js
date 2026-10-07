const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/SortableTrayItem.tsx', 'utf8');

content = content.replace(
  "isEdited?: boolean;\n}",
  "isEdited?: boolean;\n  onDelete?: (e: React.MouseEvent) => void;\n}"
);

content = content.replace(
  "export function SortableTrayItem({ id, index, status, url, onClick, isEdited }: SortableTrayItemProps) {",
  "export function SortableTrayItem({ id, index, status, url, onClick, isEdited, onDelete }: SortableTrayItemProps) {"
);

content = content.replace(
  "        {/* Page Number Badge */}",
  "        {onDelete && (\n          <button \n            onClick={(e) => {\n              e.stopPropagation();\n              onDelete(e);\n            }}\n            style={{\n              position: 'absolute',\n              top: '4px',\n              right: '4px',\n              background: 'rgba(239, 68, 68, 0.9)',\n              color: 'white',\n              border: 'none',\n              borderRadius: '50%',\n              width: '20px',\n              height: '20px',\n              display: 'flex',\n              alignItems: 'center',\n              justifyContent: 'center',\n              cursor: 'pointer',\n              zIndex: 20,\n              fontSize: '12px',\n              padding: 0,\n              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'\n            }}\n          >\n            ✕\n          </button>\n        )}\n\n        {/* Page Number Badge */}"
);

fs.writeFileSync('src/components/widgets/SortableTrayItem.tsx', content);
