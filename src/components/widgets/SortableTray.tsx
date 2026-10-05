import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTrayItem } from './SortableTrayItem';

export interface TrayItem {
  id: string;
  type: 'scanned' | 'pending' | 'active';
  url: string;
  pageNum?: number;
  isEdited?: boolean;
}

interface SortableTrayProps {
  items: TrayItem[];
  onReorder: (newItems: TrayItem[]) => void;
  onItemClick: (item: TrayItem) => void;
}

export default function SortableTray({ items, onReorder, onItemClick }: SortableTrayProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    // Reduced delay and increased tolerance to make DND easier to trigger on mobile
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 10 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={horizontalListSortingStrategy}>
        <div style={{ display: 'flex', gap: '0.5rem', touchAction: 'pan-x' }}>
          {items.map((item, idx) => (
            <SortableTrayItem
              key={item.id}
              id={item.id}
              index={idx}
              status={item.type === 'scanned' ? 'cropped' : item.type}
              url={item.url}
              isEdited={item.isEdited}
              onClick={() => onItemClick(item)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
