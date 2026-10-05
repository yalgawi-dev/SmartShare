const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/SortableTrayItem.tsx', 'utf8');

code = code.replace(
`    opacity: isDragging ? 0.7 : 1,
    transform: isDragging ? 'scale(1.1)' : 'none', // Pop out effect to indicate drag started
    flexShrink: 0,`,
`    opacity: isDragging ? 0.8 : 1,
    flexShrink: 0,`
);

code = code.replace(
`          transform: status === 'active' ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 0.2s, box-shadow 0.2s',`,
`          transform: isDragging ? 'scale(1.1)' : (status === 'active' ? 'scale(1.02)' : 'scale(1)'),
          transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s',`
);

fs.writeFileSync('src/components/widgets/SortableTrayItem.tsx', code);
console.log('Fixed DND transform');
