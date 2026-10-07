const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/SortableTrayItem.tsx', 'utf8');

const toReplace = `{onDelete && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'rgba(239, 68, 68, 0.9)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 20,
              fontSize: '12px',
              padding: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            ✕
          </button>
        )}`;

content = content.replace(toReplace, "");
fs.writeFileSync('src/components/widgets/SortableTrayItem.tsx', content);
