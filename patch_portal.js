const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/AppShareModal.tsx', 'utf8');
content = content.replace(
  '    </div>\n  );\n}', 
  '    </div>,\n    document.body\n  );\n}'
).replace(
  '    </div>\r\n  );\r\n}', 
  '    </div>,\n    document.body\n  );\n}'
);
fs.writeFileSync('src/components/widgets/AppShareModal.tsx', content);
