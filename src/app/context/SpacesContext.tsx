'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AVAILABLE_FEATURES } from '../data/features';

export type FeatureId = string;

export interface Space {
  id: string;
  title: string;
  description: string;
  icon: string;
  updatedAt: string;
  features: FeatureId[];
}

interface SpacesContextType {
  spaces: Space[];
  addSpace: (space: Omit<Space, 'id' | 'updatedAt'>) => void;
  toggleFeature: (spaceId: string, featureId: FeatureId) => void;
}

const initialSpaces: Space[] = [
  {
    id: '1',
    title: 'בניית הבית בכפר',
    description: 'ניהול הוצאות, קבלנים, העלאת חשבוניות ותוכניות אדריכליות במקום אחד.',
    icon: '🏠',
    updatedAt: 'לפני 2 דקות',
    features: ['finance', 'cashbox', 'vault', 'camera', 'partners', 'suppliers'],
  },
  {
    id: '2',
    title: 'התיק הרפואי של סבא',
    description: 'ריכוז מסמכים רפואיים, מרשמים לתרופות, והערות טיפול בין בני המשפחה.',
    icon: '⚕️',
    updatedAt: 'אתמול',
    features: ['vault', 'partners', 'suppliers', 'camera'],
  },
  {
    id: '3',
    title: 'חופשה משפחתית ביוון',
    description: 'גלריית תמונות משותפת מהטיול והתחשבנות אוטומטית על הוצאות הרכב והמלון.',
    icon: '✈️',
    updatedAt: 'לפני שבוע',
    features: ['gallery', 'camera', 'finance', 'cashbox', 'partners'],
  }
];

const SpacesContext = createContext<SpacesContextType | undefined>(undefined);

export function SpacesProvider({ children }: { children: ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>(initialSpaces);

  const addSpace = (spaceData: Omit<Space, 'id' | 'updatedAt'>) => {
    const newSpace: Space = {
      ...spaceData,
      id: Date.now().toString(),
      updatedAt: 'ממש עכשיו',
    };
    setSpaces(prev => [newSpace, ...prev]);
  };

  const toggleFeature = (spaceId: string, featureId: FeatureId) => {
    setSpaces(prev => prev.map(space => {
      if (space.id === spaceId) {
        const hasFeature = space.features.includes(featureId);
        return {
          ...space,
          features: hasFeature 
            ? space.features.filter(f => f !== featureId) 
            : [...space.features, featureId],
          updatedAt: 'ממש עכשיו'
        };
      }
      return space;
    }));
  };

  return (
    <SpacesContext.Provider value={{ spaces, addSpace, toggleFeature }}>
      {children}
    </SpacesContext.Provider>
  );
}

export function useSpaces() {
  const context = useContext(SpacesContext);
  if (context === undefined) {
    throw new Error('useSpaces must be used within a SpacesProvider');
  }
  return context;
}
