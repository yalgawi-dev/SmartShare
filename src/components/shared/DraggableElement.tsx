'use client';

import React, { useState, useRef, useEffect } from 'react';

interface DraggableElementProps {
  id: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
  isEditMode: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, updates: Partial<{ x: number, y: number, rotation: number, scale: number, zIndex: number }>) => void;
  onClick?: () => void;
  children: React.ReactNode;
}

export default function DraggableElement({ 
  id, x, y, rotation, scale, zIndex, isEditMode, isSelected, onSelect, onChange, onClick, children 
}: DraggableElementProps) {
  
  const elementRef = useRef<HTMLDivElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, initialX: 0, initialY: 0 });
  
  const [isRotating, setIsRotating] = useState(false);
  const [rotateStart, setRotateStart] = useState({ angle: 0, initialRotation: 0 });

  // Handle Dragging
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isEditMode) return;
    e.stopPropagation();
    
    // Check if clicking on a control handle
    if ((e.target as HTMLElement).dataset.handle === 'rotate') return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      initialX: x,
      initialY: y
    });
    
    if (onSelect) onSelect(id);
    onChange(id, { zIndex: 100 }); // Bring to front while dragging
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      onChange(id, { x: dragStart.initialX + dx, y: dragStart.initialY + dy });
    }
    
    if (isRotating && elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const angleDeg = (angle * 180) / Math.PI;
      
      // Calculate delta from start
      const delta = angleDeg - rotateStart.angle;
      onChange(id, { rotation: rotateStart.initialRotation + delta });
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      onChange(id, { zIndex: 10 }); // Reset to normal zIndex after drag
      
      // If it barely moved, treat as a click
      if (Math.abs(e.clientX - dragStart.x) < 5 && Math.abs(e.clientY - dragStart.y) < 5) {
        if (onClick) onClick();
      }
    }
    if (isRotating) {
      setIsRotating(false);
    }
  };

  useEffect(() => {
    if (isDragging || isRotating) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    } else {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, isRotating, dragStart, rotateStart]);

  // Handle Rotation Start
  const handleRotateDown = (e: React.PointerEvent) => {
    if (!isEditMode) return;
    e.stopPropagation();
    
    if (elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      const angleDeg = (angle * 180) / Math.PI;
      
      setIsRotating(true);
      setRotateStart({ angle: angleDeg, initialRotation: rotation });
      if (onSelect) onSelect(id);
    }
  };

  return (
    <div
      ref={elementRef}
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `rotate(${rotation}deg) scale(${scale})`,
        zIndex: zIndex,
        cursor: isEditMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
        touchAction: 'none', // Prevent scrolling on touch devices while dragging
        userSelect: 'none', // Prevent text selection
        transformOrigin: 'center center',
      }}
    >
      {/* The main content */}
      <div style={{ position: 'relative' }}>
        {children}
        
        {/* Editor Overlay with Handles */}
        {isEditMode && (
          <div style={{
            position: 'absolute',
            inset: -15,
            border: isSelected ? '2px dashed var(--primary)' : '2px dashed rgba(0,0,0,0.1)',
            pointerEvents: 'none',
            borderRadius: '8px',
            transition: 'border-color 0.2s',
          }}>
            {/* Rotate Handle */}
            {isSelected && (
              <div
                data-handle="rotate"
                onPointerDown={handleRotateDown}
                style={{
                  position: 'absolute',
                  top: -30,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '32px',
                  height: '32px',
                  background: 'white',
                  border: '2px solid var(--primary)',
                  borderRadius: '50%',
                  cursor: 'crosshair',
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}
                title="סובב ידנית"
              >
                ↻
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
