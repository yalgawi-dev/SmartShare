const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/SortableTrayItem.tsx', 'utf8');

// The original file still has attributes and listeners on the outer div:
// Wait, looking at the cat output:
//   return (
//    <div 
//      ref={setNodeRef} 
//      style={style}
//    >
// Ah! The attributes were successfully removed from the outer div by the first replace!
// BUT the drag handle wasn't added because the second replace failed.

// Let's just add the drag handle right before the closing </div> of the inner div.

const innerDivEnd = `        </div>
      </div>
    </div>
  );
}`;

const handleToAdd = `
        {/* Drag Grip Handle */}
        <div 
          {...attributes}
          {...listeners}
          style={{ 
            position: 'absolute', 
            top: 0, 
            right: 0, 
            width: '24px', 
            height: '24px', 
            background: 'rgba(0,0,0,0.4)', 
            borderBottomLeftRadius: '8px',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'grab', 
            touchAction: 'none' 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ color: 'white', fontSize: '14px', transform: 'rotate(90deg)' }}>:::</span>
        </div>
        </div>
      </div>
    </div>
  );
}`;

if (code.includes(innerDivEnd)) {
    code = code.replace(innerDivEnd, handleToAdd);
    fs.writeFileSync('src/components/widgets/SortableTrayItem.tsx', code);
    console.log('Drag handle successfully added!');
} else {
    console.log('Could not find innerDivEnd');
}
