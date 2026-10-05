import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTrayItemProps {
  id: string;
  index: number;
  status: 'pending' | 'cropped' | 'active';
  url: string;
  onClick: () => void;
}

export function SortableTrayItem({ id, index, status, url, onClick }: SortableTrayItemProps) {
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
    cursor: 'grab',
    opacity: isDragging ? 0.8 : 1,
    flexShrink: 0
  };

  let borderColor = '#3b82f6'; // active (blue)
  if (status === 'cropped') borderColor = '#10b981'; // green
  if (status === 'pending') borderColor = '#ef4444'; // red

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
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
          boxShadow: status === 'active' ? `0 0 15px ${borderColor}` : 'none',
          transform: status === 'active' ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.2s, box-shadow 0.2s'
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
          background: borderColor,
          color: 'white',
          fontWeight: 'bold',
          fontSize: '0.8rem',
          padding: '2px 6px',
          borderRadius: '4px',
          zIndex: 10
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
          fontSize: '0.7rem'
        }}>
          {status === 'cropped' && '✅'}
          {status === 'active' && '👁️'}
          {status === 'pending' && '⏳'}
        </div>
      </div>
    </div>
  );
}
