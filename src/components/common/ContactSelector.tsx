'use client';

import React, { useState } from 'react';
import { useAuth } from '../../app/context/AuthContext';

export interface SelectedContact {
  name: string;
  phone: string;
  userId?: string;
}

export interface ContactSelectorProps {
  onSelect: (contact: SelectedContact) => void;
  title?: string;
}

export default function ContactSelector({ onSelect, title = 'בחר איש קשר' }: ContactSelectorProps) {
  const { user, findUserByPhone } = useAuth();
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const contacts = user?.contacts || [];

  const handleSelectExisting = async (contact: any) => {
    setIsSearching(true);
    try {
      const foundUser = contact.phone ? await findUserByPhone(contact.phone) : null;
      onSelect({
        name: contact.name,
        phone: contact.phone || '',
        userId: foundUser ? foundUser.id : undefined
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPhone.replace(/\D/g, '').length < 9) {
      alert('אנא הזן שם ומספר טלפון תקינים');
      return;
    }
    
    setIsSearching(true);
    try {
      const foundUser = await findUserByPhone(newPhone);
      onSelect({
        name: newName.trim(),
        phone: newPhone.trim(),
        userId: foundUser ? foundUser.id : undefined
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleNativeContactPicker = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const properties = ['name', 'tel'];
        const opts = { multiple: false };
        // @ts-ignore
        const deviceContacts = await navigator.contacts.select(properties, opts);
        if (deviceContacts && deviceContacts.length > 0) {
          const selected = deviceContacts[0];
          const name = selected.name?.[0] || '';
          const phone = selected.tel?.[0] || '';
          if (phone) {
            setNewName(name);
            setNewPhone(phone);
            setMode('new');
          }
        }
      } catch (ex) {
        console.error('Failed to pick contact', ex);
      }
    } else {
      alert('התקן שלך אינו תומך בבחירת אנשי קשר מובנית בבקשה הזן באופן ידני.');
    }
  };

  if (isSearching) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>🔎</div>
        <div>בודק אם המספר קיים במערכת...</div>
      </div>
    );
  }

  const supportsPicker = 'contacts' in navigator && 'ContactsManager' in window;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', boxSizing: 'border-box' }}>
      <h3 style={{ margin: '0', fontSize: '1.2rem', color: '#0f172a' }}>{title}</h3>
      
      {mode === 'list' && (
        <>
          { supportsPicker && (
            <button
              onClick={handleNativeContactPicker}
              style={{ padding: '1rem', background: '#f8fafc', color: 'var(--primary)', border: '2px solid #e2e8f0', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <span>📇</span>
              בחר מאנשי הקשר שלי
            </button>
          )}
          
          {contacts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto', boxSizing: 'border-box' }}>
              {contacts.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => handleSelectExisting(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#white', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', textAlign: 'right', transition: 'background 0.2s', boxSizing: 'border-box' }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {c.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{c.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', direction: 'ltr', textAlign: 'right' }}>{c.phone || 'ללא מספר'}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              אין לך עדיין אנשי קשר שמורים 
            </div>
          )}
          
          <button
            onClick={() => setMode('new')}
            style={{ padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <span>➕</span>
            הזן מספר חדש
          </button>
        </>
      )}

      {mode === 'new' && (
        <form onSubmit={bonus => handleAddNew(bonus)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', boxSizing: 'border-box' }}>
          <input
            type="text"
            placeholder="שם השותף"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1rem', boxSizing: 'border-box' }}
            required
          />
          <input
            type="tel"
            placeholder="מספר טלפון (לדוגמה 050-1234567)"
            value={newPhone}
            onChange={e => setNewPhone(e.target.value)}
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1rem', direction: 'ltr', boxSizing: 'border-box' }}
            required
          />
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setMode('list')}
              style={{ flex: 1, padding: '1rem', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              חזור לרשימה
            </button>
            <button
              type="submit"
              style={{ flex: 2, padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              המשך
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
