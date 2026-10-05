import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTrayItemProps {
  id: string;
  index: number;
  status: 'pending' | 'cropped' | 'active';
  url: string;
  onClick: () => void;
  isEdited?: boolean;
}

export function SortableTrayItem({ id, index, status, url, onClick, isEdited }: SortableTrayItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
    position: 'relative' as const,
    opacity: isDragging ? 0.8 : 1,
    flexShrink: 0,
  };

  let borderColor = '#ef4444'; // default red (unedited)
  if (status === 'cropped' || isEdited) borderColor = '#10b981'; // green (edited)

  return (
    <div 
      ref={setNodeRef} 
      style={style}
    >
      <div 
        onClick={(e) => {
          onClick();
        }}
        style={{
          width: '70px',
          height: '90px',
          border: `3px solid ${borderColor}`,
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative' as const,
          background: '#000',
          boxShadow: status === 'active' ? `0 0 0 3px #3b82f6` : 'none',
          transform: isDragging ? 'scale(1.1)' : (status === 'active' ? 'scale(1.02)' : 'scale(1)'),
          transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.2s',
          margin: status === 'active' ? '0 3px' : '0'
        }}
      >
        <img 
          src={url} 
          alt={`Page ${index + 1}`} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
        
        {/* Page Number Badge */}
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          background: status === 'active' ? '#3b82f6' : borderColor,
          color: 'white',
          fontWeight: 'bold',
          fontSize: '0.8rem',
          padding: '2px 6px',
          borderRadius: '4px',
          zIndex: 10,
          pointerEvents: 'none'
        }}>
          {index + 1}
        </div>
        
        {/* Status Icon */}
        <div style={{
          position: 'absolute',
          bottom: '4px',
          right: '4px',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          pointerEvents: 'none'
        }}>
          {status === 'cropped' && '✔️'}
          {status === 'active' && '👁️'}
          {status === 'pending' && '⏳'}
        </div>

        {/* Drag Grip Handle */}
        <div 
          {...attributes}
          {...listeners}
          style={{ 
            position: 'absolute', 
            top: 0, 
            right: 0, 
            width: '28px', 
            height: '28px', 
            background: 'rgba(0,0,0,0.5)', 
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
  );
}
