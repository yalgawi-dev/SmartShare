import React, { useState, useEffect } from 'react';
import { Space, SpaceDocument, ShelfEvent } from '@/app/context/SpacesContext';
import { useAuth } from '@/app/context/AuthContext';
import ConfirmModal from '@/components/common/ConfirmModal';
import { shareDocument, downloadDocument, getDocumentPreviewUrl } from '@/utils/documentUtils';

interface ShelfTimelineProps {
  space: Space;
  activeShelfId: string;
  shelfDocs: SpaceDocument[];
  onAddEvent: (event: Omit<ShelfEvent, 'id' | 'createdAt' | 'createdBy' | 'comments'>) => void;
  onUpdateEvent: (eventId: string, updates: Partial<ShelfEvent>) => void;
  onRemoveEvent: (eventId: string, deleteDocIds?: string[]) => void;
  onAddComment: (eventId: string, text: string) => void;
  onRemoveComment: (eventId: string, commentId: string) => void;
  onUploadAndLink?: (eventId: string, url: string) => Promise<void>;
  onPreviewDocs?: (docs: SpaceDocument[], index: number) => void;
}

export default function ShelfTimeline({ space, activeShelfId, shelfDocs, onAddEvent, onUpdateEvent, onRemoveEvent, onAddComment, onRemoveComment, onUploadAndLink, onPreviewDocs }: ShelfTimelineProps) {
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [timelinePreview, setTimelinePreview] = useState<{ docs: SpaceDocument[], index: number } | null>(null);
  const [eventToDelete, setEventToDelete] = useState<{ id: string, title: string, docCount: number, docIds: string[] } | null>(null);
  const [deleteOption, setDeleteOption] = useState<'keep_docs' | 'delete_docs'>('keep_docs');
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [editEventTitle, setEditEventTitle] = useState('');
  const [editEventDesc, setEditEventDesc] = useState('');
  const [editEventDate, setEditEventDate] = useState('');
  const [editSelectedDocIds, setEditSelectedDocIds] = useState<string[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [newTasks, setNewTasks] = useState<{id: string, text: string, isCompleted: boolean}[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedChats, setExpandedChats] = useState<Record<string, boolean>>({});
  const [showDocSelector, setShowDocSelector] = useState<{ eventId: string, taskId?: string } | null>(null);
  const [activeChatEventId, setActiveChatEventId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);

  // Draft key per space and shelf
  const draftStorageKey = `smartshare_timeline_draft_${space.id}_${activeShelfId}`;

  // Auto-restore draft on mount or shelf change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.title || d.desc || (d.docIds && d.docIds.length > 0) || (d.tasks && d.tasks.length > 0)) {
          if (d.title) setNewEventTitle(d.title);
          if (d.desc) setNewEventDesc(d.desc);
          if (d.date) setNewEventDate(d.date);
          if (Array.isArray(d.docIds)) setSelectedDocIds(d.docIds);
          if (Array.isArray(d.tasks)) setNewTasks(d.tasks);
        }
      }
    } catch (e) {
      console.error('Failed to load timeline draft', e);
    }
  }, [draftStorageKey]);

  // Auto-save draft on changes when modal has content
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (newEventTitle || newEventDesc || selectedDocIds.length > 0 || newTasks.length > 0) {
        localStorage.setItem(draftStorageKey, JSON.stringify({
          title: newEventTitle,
          desc: newEventDesc,
          date: newEventDate,
          docIds: selectedDocIds,
          tasks: newTasks
        }));
      }
    } catch (e) {}
  }, [newEventTitle, newEventDesc, newEventDate, selectedDocIds, newTasks, draftStorageKey]);

  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(draftStorageKey);
      } catch (e) {}
    }
  };

  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && showDocSelector?.eventId && onUploadAndLink) {
      setIsUploadingLocal(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
         const url = ev.target?.result as string;
         try {
            await onUploadAndLink(showDocSelector.eventId, url);
         } catch(e) {}
         setIsUploadingLocal(false);
         setShowDocSelector(null); // Close modal on success!
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const handleAddStation = () => setShowAddModal(true);
    const handleDocSavedForNewStation = (e: any) => {
      const { docId } = e.detail || {};
      if (docId) {
        setSelectedDocIds(prev => prev.includes(docId) ? prev : [...prev, docId]);
      }
    };
    const handleDocSavedForEditStation = (e: any) => {
      const { docId } = e.detail || {};
      if (docId) {
        setEditSelectedDocIds(prev => prev.includes(docId) ? prev : [...prev, docId]);
      }
    };
    window.addEventListener('smartshare:add_station', handleAddStation);
    window.addEventListener('smartshare:doc_saved_for_new_station', handleDocSavedForNewStation);
    window.addEventListener('smartshare:doc_saved_for_edit_station', handleDocSavedForEditStation);
    return () => {
      window.removeEventListener('smartshare:add_station', handleAddStation);
      window.removeEventListener('smartshare:doc_saved_for_new_station', handleDocSavedForNewStation);
      window.removeEventListener('smartshare:doc_saved_for_edit_station', handleDocSavedForEditStation);
    };
  }, []);

  useEffect(() => {
    if (timelinePreview) {
      window.dispatchEvent(new CustomEvent('smartshare:preview_open'));
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:preview_closed'));
    }
  }, [timelinePreview]);

  const events = (space.shelfEvents || [])
    .filter(e => e.shelfId === activeShelfId)
    .sort((a, b) => sortOrder === 'desc' ? new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime() : new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  
  const handleSaveEdit = () => {
    if (!editEventId || !editEventTitle.trim()) return alert('יש להזין כותרת');
    onUpdateEvent(editEventId, {
      title: editEventTitle.trim(),
      description: editEventDesc.trim(),
      eventDate: editEventDate,
      documentIds: editSelectedDocIds
    });
    setEditEventId(null);
    setEditSelectedDocIds([]);
  };


  const handleAddEvent = () => {
    if (!newEventTitle.trim()) return alert('יש להזין כותרת לאירוע');
    onAddEvent({
      shelfId: activeShelfId,
      title: newEventTitle.trim(),
      description: newEventDesc.trim(),
      eventDate: newEventDate,
      documentIds: selectedDocIds,
      tasks: newTasks
    });
    clearDraft();
    setShowAddModal(false);
    setNewEventTitle('');
    setNewEventDesc('');
    setSelectedDocIds([]);
    setNewTasks([]);
  };

  const handlePostComment = (eventId: string) => {
    const text = commentInputs[eventId];
    if (!text || !text.trim()) return;
    onAddComment(eventId, text.trim());
    setCommentInputs(prev => ({ ...prev, [eventId]: '' }));
  };

  const handleToggleTask = (eventId: string, taskId: string, isCompleted?: boolean, docId?: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const updatedTasks = (event.tasks || []).map(t => t.id === taskId ? { ...t, ...(isCompleted !== undefined && { isCompleted, completedAt: isCompleted ? new Date().toISOString() : undefined }), ...(docId && { documentId: docId }) } : t);
    onUpdateEvent(eventId, { tasks: updatedTasks });
  };

  const handleAddTaskInline = (eventId: string) => {
    const text = taskInputs[eventId];
    if (!text || !text.trim()) return;
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const updatedTasks = [...(event.tasks || []), { id: Math.random().toString(36).substring(2), text: text.trim(), isCompleted: false }];
    onUpdateEvent(eventId, { tasks: updatedTasks });
    setTaskInputs(prev => ({ ...prev, [eventId]: '' }));
  };

  const getUserName = (uid: string) => {
    if (uid === user?.id) return 'אני';
    const member = space.members?.find(m => m.userId === uid);
    return member?.name || 'משתמש';
  };


  return (
    <>
      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleLocalUpload} />
      <div style={{padding: '0 0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>{sortOrder === 'desc' ? '⬇️ מהחדש לישן' : '⬆️ מהישן לחדש'}</span>
        </button>
        
      </div>

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📖</div>
          <h3>הסיפור מתחיל כאן</h3>
          <p>הוסף את התחנה הראשונה (פגישה, ביקור, אירוע) והתחל לבנות את תיק המסמכים הכרונולוגי.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', marginTop: '1rem' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: '20px', width: '2px', background: '#e2e8f0', zIndex: 0 }}></div>

{events.map((event, idx) => {
            const eventDocs = shelfDocs.filter(d => {
              const cleanId = String(d.id || '').trim();
              const cleanUrl = String(d.url || '').trim();
              return (event.documentIds || []).some(id => {
                const sId = String(id || '').trim();
                return sId === cleanId || (cleanUrl && sId === cleanUrl);
              });
            });
            const year = event.eventDate.substring(0, 4);
            const prevYear = idx > 0 ? events[idx - 1].eventDate.substring(0, 4) : null;
            const showYearMarker = year !== prevYear;
            const openTasks = (event.tasks || []).filter(t => !t.isCompleted).length;
            const completedTasks = (event.tasks || []).filter(t => t.isCompleted).length;
            const totalTasks = (event.tasks || []).length;
            const isExpanded = expandedEvents[event.id] || false;
            
            return (
              <React.Fragment key={event.id}>
                {showYearMarker && (
                  <div style={{ position: 'relative', zIndex: 2, paddingRight: '1rem', marginBottom: '-1rem', marginTop: idx === 0 ? '0' : '1rem' }}>
                    <span style={{ background: '#e2e8f0', color: '#475569', padding: '4px 12px', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.85rem' }}>{year}</span>
                  </div>
                )}
                <div id={`event-${event.id}`} style={{ position: 'relative', zIndex: 1, paddingRight: '3rem' }}>
                  <div style={{ position: 'absolute', right: '12px', top: '24px', width: '18px', height: '18px', background: '#3b82f6', borderRadius: '50%', border: '4px solid #eff6ff', boxShadow: '0 0 0 1px #cbd5e1' }}></div>
                  
                  <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                    <div 
                      onClick={() => setExpandedEvents(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', marginBottom: isExpanded ? '0.5rem' : '0' }}
                    >
                      <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', flex: 1 }}>{event.title}</h3>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          setEditEventId(event.id);
                          setEditEventTitle(event.title);
                          setEditEventDesc(event.description || '');
                          setEditEventDate(event.eventDate);
                          setEditSelectedDocIds(event.documentIds || []);
                        }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title="ערוך תחנה">✏️</button>

                        <button onClick={(e) => {
                          e.stopPropagation();
                          const evDocs = event.documentIds || [];
                          setDeleteOption('keep_docs');
                          setEventToDelete({ id: event.id, title: event.title, docCount: evDocs.length, docIds: evDocs });
                        }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#ef4444' }} title="מחק תחנה">🗑️</button>

                        <div style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {new Date(event.eventDate).toLocaleDateString('he-IL')}
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    
                    {!isExpanded && (
                       <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px dashed #f1f5f9' }}>
                         {/* Tasks Indicator */}
                         <button 
                           onClick={(e) => { e.stopPropagation(); setExpandedEvents(prev => ({ ...prev, [event.id]: true })); setExpandedTasks(prev => ({ ...prev, [event.id]: true })); }} 
                           style={{ background: totalTasks > 0 ? (openTasks === 0 ? '#ecfdf5' : '#fffbeb') : '#f8fafc', border: `1px solid ${totalTasks > 0 ? (openTasks === 0 ? '#a7f3d0' : '#fde68a') : '#e2e8f0'}`, borderRadius: '10px', padding: '3px 8px', color: totalTasks > 0 ? (openTasks === 0 ? '#059669' : '#b45309') : '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontWeight: 'bold' }}
                           title="משימות בתחנה זו"
                         >
                           <span>📋</span>
                           <span>{totalTasks > 0 ? `${totalTasks} משימות ${openTasks > 0 ? `(${openTasks} פתוחות)` : '✓'}` : '0 משימות'}</span>
                         </button>

                         {/* Attached Documents Indicator & Quick Preview Carousel */}
                         <div 
                           onClick={(e) => {
                             if (eventDocs.length > 0) {
                               e.stopPropagation();
                               if (onPreviewDocs) {
                                 onPreviewDocs(eventDocs, 0);
                               } else {
                                 setTimelinePreview({ docs: eventDocs, index: 0 });
                               }
                             }
                           }}
                           style={{ background: eventDocs.length > 0 ? '#eff6ff' : '#f8fafc', border: `1px solid ${eventDocs.length > 0 ? '#bfdbfe' : '#e2e8f0'}`, borderRadius: '10px', padding: '3px 8px', color: eventDocs.length > 0 ? '#2563eb' : '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: eventDocs.length > 0 ? 'pointer' : 'default', fontWeight: 'bold' }}
                           title={eventDocs.length > 0 ? 'לחץ לצפייה מהירה בקבצים המצורפים' : 'אין קבצים מצורפים'}
                         >
                           <span>📎</span>
                           <span>{eventDocs.length > 0 ? `${eventDocs.length} קבצים 🔍` : '0 קבצים'}</span>
                         </div>

                         {/* Talkbacks Indicator with V indicator */}
                         <button 
                           onClick={(e) => { e.stopPropagation(); setActiveChatEventId(event.id); }} 
                           style={{ background: (event.comments || []).length > 0 ? '#f0fdf4' : '#f8fafc', border: `1px solid ${(event.comments || []).length > 0 ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: '10px', padding: '3px 8px', color: (event.comments || []).length > 0 ? '#16a34a' : '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontWeight: 'bold' }}
                           title="טוקבקים / דיון בתחנה"
                         >
                           <span>💬</span>
                           <span>
                             {(event.comments || []).length > 0 ? `${(event.comments || []).length} טוקבקים ✓` : 'טוקבקים'}
                           </span>
                         </button>

                         {/* Quick Attach Doc Plus Button */}
                         <button 
                           onClick={(e) => { e.stopPropagation(); setShowDocSelector({ eventId: event.id }); }} 
                           style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '1rem', cursor: 'pointer', marginRight: 'auto', padding: 0 }} 
                           title="צרף מסמך לתחנה זו"
                         >
                           +
                         </button>
                       </div>
                    )}

                    {isExpanded && (
                      <>
                        {event.description && (
                          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.6', margin: '0.5rem 0', whiteSpace: 'pre-wrap' }}>
                            {event.description}
                          </p>
                        )}

                        {/* TASKS ACCORDION */}
                        <div style={{ marginTop: '1rem', background: '#fffbeb', borderRadius: '12px', padding: '1rem', border: '1px solid #fde68a' }}>
                          <div 
                            onClick={() => setExpandedTasks(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                            style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>📋</span> יומן משימות לביצוע {totalTasks > 0 ? (openTasks > 0 ? `(${openTasks} פתוחות)` : '(כולן הושלמו)') : ''}
                            </div>
                            <span>{expandedTasks[event.id] ? '▲' : '▼'}</span>
                          </div>
                          {expandedTasks[event.id] && (
                            <div style={{ marginTop: '0.75rem', borderTop: '1px solid #fef3c7', paddingTop: '0.75rem' }}>
                              {event.tasks && event.tasks.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                  {event.tasks.map(task => (
                                    <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap', background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={task.isCompleted} 
                                        onChange={(e) => handleToggleTask(event.id, task.id, e.target.checked)}
                                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981', marginTop: '2px', flexShrink: 0 }}
                                      />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: '0.9rem', color: task.isCompleted ? '#94a3b8' : '#334155', textDecoration: task.isCompleted ? 'line-through' : 'none', wordBreak: 'break-word', display: 'block' }}>
                                          {task.text}
                                        </span>
                                        {task.isCompleted && task.completedAt && (
                                          <div style={{ fontSize: '0.65rem', color: '#10b981', marginTop: '2px' }}>הושלם ב-{new Date(task.completedAt).toLocaleDateString('he-IL')}</div>
                                        )}
                                      </div>
                                      {task.documentId ? (
                                        <button onClick={() => {
                                          const doc = shelfDocs.find(d => d.id === task.documentId);
                                          if (doc) {
                                            if (onPreviewDocs) {
                                              onPreviewDocs([doc], 0);
                                            } else {
                                              setTimelinePreview({ docs: [doc], index: 0 });
                                            }
                                          }
                                        }} style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', borderRadius: '12px', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0 }}>
                                          📄 מצורף
                                        </button>
                                      ) : (
                                        <button onClick={() => setShowDocSelector({ eventId: event.id, taskId: task.id })} style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', flexShrink: 0 }} title="צרף מסמך למשימה">
                                          📎
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                  type="text" 
                                  placeholder="הוסף משימה חדשה..." 
                                  value={taskInputs[event.id] || ''}
                                  onChange={(e) => setTaskInputs(prev => ({ ...prev, [event.id]: e.target.value }))}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddTaskInline(event.id)}
                                  style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #fcd34d', outline: 'none', fontSize: '0.8rem', boxSizing: 'border-box', minWidth: 0 }}
                                />
                                <button onClick={() => handleAddTaskInline(event.id)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', padding: '0 0.75rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold', flexShrink: 0 }}>הוסף</button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* CHAT TRIGGER */}
                        <div style={{ marginTop: '1rem' }}>
                          <button 
                            onClick={() => setActiveChatEventId(event.id)}
                            style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.9rem', fontWeight: 'bold' }}>
                              <span>💬</span> דיון בטוקבקים ({(event.comments || []).length})
                            </div>
                            <div style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: 'bold' }}>פתח דיון ➔</div>
                          </button>
                        </div>

                        {/* DOCUMENTS */}
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '1rem', overflowX: 'auto' }}>
                          {eventDocs.map((doc, docIdx) => (
                            <div 
                              key={doc.id} 
                              onClick={() => {
                                if (onPreviewDocs) {
                                  onPreviewDocs(eventDocs, docIdx);
                                } else {
                                  setTimelinePreview({ docs: eventDocs, index: docIdx });
                                }
                              }}
                              style={{ flexShrink: 0, width: '60px', height: '80px', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? `url(${doc.thumbnailUrl || doc.url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: '1px solid #cbd5e1' }}
                              title={doc.title}
                            >
                              {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.2rem' }}>📄</span>}
                            </div>
                          ))}
                          <button onClick={() => setShowDocSelector({ eventId: event.id })} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', width: '60px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer', flexShrink: 0 }} title="הוסף מסמך לתחנה">
                            +
                          </button>
                        </div>

                      </>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* ADD EVENT MODAL */}
      
      {activeChatEventId && (() => {
        const activeEvent = events.find(e => e.id === activeChatEventId);
        if (!activeEvent) return null;
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#e5ddd5', zIndex: 100000, display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#075e54', color: 'white', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', zIndex: 10 }}>
              <button onClick={() => setActiveChatEventId(null)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>➔</button>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>דיון: {activeEvent.title}</h2>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>כל השותפים במדף רואים את הטוקבקים</div>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {activeEvent.comments && activeEvent.comments.map(comment => {
                const isMe = comment.userId === user?.id;
                return (
                  <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '2px', padding: '0 4px', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                      {getUserName(comment.userId)}
                    </div>
                    <div style={{ 
                      background: isMe ? '#dcf8c6' : '#ffffff', 
                      padding: '8px 12px', 
                      borderRadius: '12px', 
                      borderTopRightRadius: isMe ? '12px' : '4px',
                      borderTopLeftRadius: isMe ? '4px' : '12px',
                      fontSize: '0.95rem', 
                      color: '#334155',
                      maxWidth: '85%',
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      {comment.text}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: '#f0f0f0', padding: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="הוסף הודעה..." 
                value={commentInputs[activeEvent.id] || ''}
                onChange={(e) => setCommentInputs(prev => ({ ...prev, [activeEvent.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePostComment(activeEvent.id);
                  }
                }}
                style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '24px', border: 'none', outline: 'none', fontSize: '1rem', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', boxSizing: 'border-box' }}
              />
              <button 
                onClick={() => handlePostComment(activeEvent.id)}
                disabled={!commentInputs[activeEvent.id]?.trim()}
                style={{ background: commentInputs[activeEvent.id]?.trim() ? '#25d366' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: commentInputs[activeEvent.id]?.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
              >
                <span style={{ transform: 'rotate(-45deg)', marginLeft: '2px', marginBottom: '2px', fontSize: '1.2rem' }}>➤</span>
              </button>
            </div>
          </div>
        );
      })()}

      
      {/* DOC SELECTOR MODAL */}
      {showDocSelector && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '1.5rem', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>בחר מסמך לשיוך</h2>
              <button onClick={() => setShowDocSelector(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
               <button 
                  onClick={() => {
                    const eventId = showDocSelector.eventId;
                    setShowDocSelector(null);
                    window.dispatchEvent(new CustomEvent('smartshare:open_scanner_event', { detail: { eventId, mode: 'camera' } }));
                  }} 
                  style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none', padding: '0.65rem 0.75rem', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}>
                  <span style={{ fontSize: '1.1rem' }}>📸</span> סרוק במצלמה
               </button>
               <button 
                  onClick={() => {
                    const eventId = showDocSelector.eventId;
                    setShowDocSelector(null);
                    window.dispatchEvent(new CustomEvent('smartshare:open_scanner_event', { detail: { eventId, mode: 'upload' } }));
                  }} 
                  style={{ flex: 1, background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', padding: '0.65rem 0.75rem', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>📤</span> ייבא קובץ לעריכה
               </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', paddingBottom: '1rem' }}>
              {shelfDocs.length > 0 ? shelfDocs.map(doc => {
                  const event = events.find(e => e.id === showDocSelector?.eventId);
                  const isSelected = event ? event.documentIds?.includes(doc.id) : false;
                  return (

                <div 
                  key={doc.id}
                  onClick={() => {
                    if (showDocSelector.taskId) {
                      // Attach to task
                      handleToggleTask(showDocSelector.eventId, showDocSelector.taskId, undefined, doc.id);
                    } else {
                      // Attach to event
                      const event = events.find(e => e.id === showDocSelector.eventId);
                      if (event && !event.documentIds?.includes(doc.id)) {
                        onUpdateEvent(event.id, { documentIds: [...(event.documentIds || []), doc.id] });
                      }
                    }
                    setShowDocSelector(null);
                  }}
                  style={{ width: '100%', aspectRatio: '1/1.4', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? `url(${doc.thumbnailUrl || doc.url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: '1px solid #cbd5e1' }}
                  title={doc.title}
                >
                  {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                </div>
              );
              }) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  המחסן ריק. לחץ על הכפתור למעלה כדי להעלות מסמכים.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      
      {/* EDIT EVENT MODAL */}
      {editEventId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderRadius: '24px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>עריכת אירוע</h2>
              <button onClick={() => setEditEventId(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>כותרת האירוע / התחנה</label>
                <input type="text" value={editEventTitle} onChange={(e) => setEditEventTitle(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>תאריך האירוע</label>
                <input type="date" value={editEventDate} onChange={(e) => setEditEventDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>פירוט מה היה (אופציונלי)</label>
                <textarea value={editEventDesc} onChange={(e) => setEditEventDesc(e.target.value)} rows={4} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}></textarea>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>מסמכים משויכים ({editSelectedDocIds.length})</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button 
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('smartshare:open_scanner_event', { detail: { eventId: editEventId, mode: 'camera' } }))} 
                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '14px', color: '#2563eb', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <span>📸</span> צלם בסורק
                    </button>
                    <button 
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('smartshare:open_scanner_event', { detail: { eventId: editEventId, mode: 'upload' } }))} 
                      style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '14px', color: '#475569', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <span>📁</span> העלאת קבצים
                    </button>
                  </div>
                </div>
                {shelfDocs.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {shelfDocs.map(doc => {
                      const isSelected = editSelectedDocIds.includes(doc.id);
                      return (
                        <div 
                          key={doc.id} 
                          onClick={() => setEditSelectedDocIds(prev => isSelected ? prev.filter(id => id !== doc.id) : [...prev, doc.id])}
                          style={{ flexShrink: 0, width: '85px', height: '120px', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? `url(${doc.thumbnailUrl || doc.url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: isSelected ? '3px solid #10b981' : '1px solid #cbd5e1', opacity: isSelected ? 1 : 0.65, transition: 'all 0.2s ease' }}
                          title={doc.title}
                        >
                          {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                          
                          {/* Selection Badge */}
                          {isSelected && <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#10b981', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', zIndex: 2 }}>✓</div>}

                          {/* Quick Preview Eye Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onPreviewDocs) {
                                onPreviewDocs(shelfDocs, shelfDocs.findIndex(d => d.id === doc.id));
                              } else {
                                setTimelinePreview({ docs: shelfDocs, index: shelfDocs.findIndex(d => d.id === doc.id) });
                              }
                            }}
                            style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', color: 'white', border: 'none', borderRadius: '6px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', cursor: 'pointer', zIndex: 3 }}
                            title="הגדל והצג מסמך"
                          >
                            🔍
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    אין מסמכים במחסן.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  type="button"
                  onClick={() => {
                    const ev = events.find(e => e.id === editEventId);
                    const evDocs = ev?.documentIds || [];
                    setDeleteOption('keep_docs');
                    setEventToDelete({ id: editEventId, title: editEventTitle, docCount: evDocs.length, docIds: evDocs });
                  }}
                  style={{ flex: 1, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '0.9rem', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <span>🗑️</span> מחק תחנה
                </button>
                <button 
                  type="button"
                  onClick={handleSaveEdit} 
                  style={{ flex: 1.5, background: '#10b981', color: 'white', border: 'none', padding: '0.9rem', borderRadius: '12px', fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  שמור שינויים
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE DELETE STATION POPUP (WITH OPTION FOR ATTACHMENTS) */}
      {eventToDelete && (
        <div 
          onClick={() => setEventToDelete(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100007, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', direction: 'rtl' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', width: '100%', maxWidth: '440px', borderRadius: '24px', padding: '1.75rem', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                🗑️
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 'bold' }}>מחיקת תחנה מציר הזמן</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{eventToDelete.title}</p>
              </div>
            </div>

            <p style={{ fontSize: '0.95rem', color: '#334155', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
              האם אתה בטוח שברצונך למחוק תחנה זו? פעולה זו תסיר את התחנה וכל המשימות המשויכות אליה מציר הזמן.
            </p>

            {eventToDelete.docCount > 0 ? (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' }}>
                  לתחנה זו מקושרים {eventToDelete.docCount} מסמכים/נספחים. מה לעשות איתם?
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', background: deleteOption === 'keep_docs' ? '#eff6ff' : 'white', padding: '0.65rem 0.75rem', borderRadius: '10px', border: deleteOption === 'keep_docs' ? '1.5px solid #3b82f6' : '1px solid #cbd5e1' }}>
                  <input 
                    type="radio" 
                    name="delOpt" 
                    checked={deleteOption === 'keep_docs'} 
                    onChange={() => setDeleteOption('keep_docs')}
                    style={{ marginTop: '0.2rem', accentColor: '#3b82f6' }} 
                  />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#1e293b' }}>מחק תחנה בלבד (שמור מסמכים במחסן)</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>התחנה תימחק, אך המסמכים יישארו זמינים במחסן המסמכים.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', background: deleteOption === 'delete_docs' ? '#fef2f2' : 'white', padding: '0.65rem 0.75rem', borderRadius: '10px', border: deleteOption === 'delete_docs' ? '1.5px solid #ef4444' : '1px solid #cbd5e1' }}>
                  <input 
                    type="radio" 
                    name="delOpt" 
                    checked={deleteOption === 'delete_docs'} 
                    onChange={() => setDeleteOption('delete_docs')}
                    style={{ marginTop: '0.2rem', accentColor: '#ef4444' }} 
                  />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#dc2626' }}>מחק הכל (כולל {eventToDelete.docCount} נספחים ומסמכים)</div>
                    <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>התחנה וכל המסמכים המקושרים אליה יימחקו לצמיתות גם מהמחסן.</div>
                  </div>
                </label>
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                type="button"
                onClick={() => setEventToDelete(null)}
                style={{ flex: 1, padding: '0.85rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                ביטול
              </button>
              <button 
                type="button"
                onClick={() => {
                  const toDeleteDocIds = deleteOption === 'delete_docs' ? eventToDelete.docIds : [];
                  onRemoveEvent(eventToDelete.id, toDeleteDocIds);
                  setEditEventId(null);
                  setEventToDelete(null);
                }}
                style={{ flex: 1.3, padding: '0.85rem', borderRadius: '12px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
              >
                {deleteOption === 'delete_docs' ? 'מחק תחנה ונספחים' : 'מחק תחנה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (

        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderRadius: '24px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>תחנה חדשה בציר הזמן</h2>
                {(newEventTitle || newEventDesc || selectedDocIds.length > 0) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span> טיוטה נשמרת אוטומטית
                    </span>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (confirm('האם לאפס את הטיוטה?')) {
                          clearDraft();
                          setNewEventTitle('');
                          setNewEventDesc('');
                          setSelectedDocIds([]);
                          setNewTasks([]);
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      אפס טיוטה
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>כותרת האירוע / פגישה</label>
                <input type="text" value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="לדוגמא: פגישת ייעוץ אצל ד״ר כהן" style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>תאריך התחנה</label>
                <input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>סיכום הפגישה (אופציונלי)</label>
                <textarea value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} placeholder="מה הוחלט? על מה דיברתם?" rows={3} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}></textarea>
              </div>

              {/* TASKS IN ADD EVENT */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>יומן משימות לפגישה זו (אופציונלי)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {newTasks.map(task => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.85rem' }}>{task.text}</span>
                      <button onClick={() => setNewTasks(prev => prev.filter(t => t.id !== task.id))} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    placeholder="הוסף מטלה לביצוע..."
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTaskInput.trim()) {
                        setNewTasks(prev => [...prev, { id: Math.random().toString(36).substring(2), text: newTaskInput.trim(), isCompleted: false }]);
                        setNewTaskInput('');
                      }
                    }}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem' }}
                  />
                  <button 
                    onClick={() => {
                      if (newTaskInput.trim()) {
                        setNewTasks(prev => [...prev, { id: Math.random().toString(36).substring(2), text: newTaskInput.trim(), isCompleted: false }]);
                        setNewTaskInput('');
                      }
                    }}
                    style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0 0.75rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >הוסף</button>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>שיוך מסמכים</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button 
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('smartshare:open_scanner_event', { detail: { eventId: '__new_station__', mode: 'camera' } }))} 
                      style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 10px', borderRadius: '14px', color: '#2563eb', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <span>📸</span> צלם בסורק
                    </button>
                    <button 
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('smartshare:open_scanner_event', { detail: { eventId: '__new_station__', mode: 'upload' } }))} 
                      style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '14px', color: '#475569', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <span>📁</span> העלאת קבצים
                    </button>
                  </div>
                </div>
                {shelfDocs.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {shelfDocs.map(doc => {
                      const isSelected = selectedDocIds.includes(doc.id);
                      return (
                        <div 
                          key={doc.id} 
                          onClick={() => setSelectedDocIds(prev => isSelected ? prev.filter(id => id !== doc.id) : [...prev, doc.id])}
                          style={{ flexShrink: 0, width: '85px', height: '120px', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? `url(${doc.thumbnailUrl || doc.url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: isSelected ? '3px solid #10b981' : '1px solid #cbd5e1', opacity: isSelected ? 1 : 0.65, transition: 'all 0.2s ease' }}
                          title={doc.title}
                        >
                          {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                          
                          {/* Selection Badge */}
                          {isSelected && <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#10b981', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', zIndex: 2 }}>✓</div>}

                          {/* Quick Preview Eye Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onPreviewDocs) {
                                onPreviewDocs(shelfDocs, shelfDocs.findIndex(d => d.id === doc.id));
                              } else {
                                setTimelinePreview({ docs: shelfDocs, index: shelfDocs.findIndex(d => d.id === doc.id) });
                              }
                            }}
                            style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', color: 'white', border: 'none', borderRadius: '6px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', cursor: 'pointer', zIndex: 3 }}
                            title="הגדל והצג מסמך"
                          >
                            🔍
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                    אין מסמכים במחסן. לחץ על כפתור הסורק למעלה.
                  </div>
                )}
              </div>

              <button onClick={handleAddEvent} style={{ width: '100%', background: '#3b82f6', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                הוסף תחנה
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Timeline Internal Document Preview Modal */}
      {timelinePreview && (
        <div 
          onClick={() => setTimelinePreview(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 100005, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {timelinePreview.index > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); setTimelinePreview(prev => ({ ...prev!, index: prev!.index - 1 })); }} 
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', fontSize: '2rem', cursor: 'pointer', zIndex: 100006 }}
            >
              ‹
            </button>
          )}

          {((timelinePreview.docs[timelinePreview.index].url && timelinePreview.docs[timelinePreview.index].url.includes('.pdf')) || timelinePreview.docs[timelinePreview.index].type === 'pdf') ? (
            <div onClick={(e) => e.stopPropagation()} style={{ width: '90%', height: '85%', position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', background: '#1e293b' }}>
              <iframe 
                src={getDocumentPreviewUrl(timelinePreview.docs[timelinePreview.index].url)} 
                style={{ width: '100%', height: '100%', border: 'none' }} 
                title={timelinePreview.docs[timelinePreview.index].title || 'PDF Document'} 
              />
              <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '0.5rem', zIndex: 10, flexWrap: 'wrap' }}>
                <button 
                  onClick={() => window.open(timelinePreview.docs[timelinePreview.index].url, '_blank')} 
                  style={{ background: 'rgba(30, 41, 59, 0.85)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.4rem 0.8rem', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  title="פתח בלשונית נפרדת"
                >
                  <span>👁️ פתח נפרד</span>
                </button>
                <button 
                  onClick={() => downloadDocument(timelinePreview.docs[timelinePreview.index].url, timelinePreview.docs[timelinePreview.index].title)} 
                  style={{ background: 'rgba(30, 41, 59, 0.85)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.4rem 0.8rem', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  title="הורדת המסמך"
                >
                  <span>⬇️ הורדה</span>
                </button>
                <button 
                  onClick={() => shareDocument(timelinePreview.docs[timelinePreview.index].url, timelinePreview.docs[timelinePreview.index].title)} 
                  style={{ background: 'rgba(16, 185, 129, 0.9)', backdropFilter: 'blur(4px)', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}
                  title="שיתוף המסמך"
                >
                  <span>📤 שתף</span>
                </button>
              </div>
            </div>
          ) : (
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '92%', maxHeight: '88%', position: 'relative' }}>
              <img 
                src={timelinePreview.docs[timelinePreview.index].url} 
                style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
                alt="Preview" 
              />
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button 
                  onClick={() => downloadDocument(timelinePreview.docs[timelinePreview.index].url, timelinePreview.docs[timelinePreview.index].title)} 
                  style={{ background: 'rgba(30, 41, 59, 0.85)', backdropFilter: 'blur(4px)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <span>⬇️ הורדה</span>
                </button>
                <button 
                  onClick={() => shareDocument(timelinePreview.docs[timelinePreview.index].url, timelinePreview.docs[timelinePreview.index].title)} 
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1.2rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                >
                  <span>📤 שתף</span>
                </button>
              </div>
            </div>
          )}

          {timelinePreview.index < timelinePreview.docs.length - 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); setTimelinePreview(prev => ({ ...prev!, index: prev!.index + 1 })); }} 
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', fontSize: '2rem', cursor: 'pointer', zIndex: 100006 }}
            >
              ›
            </button>
          )}

          <button 
            onClick={() => setTimelinePreview(null)} 
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100006 }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
    </>
  );
}
