import React, { useState } from 'react';
import { Space, SpaceDocument, ShelfEvent } from '@/app/context/SpacesContext';
import { useAuth } from '@/app/context/AuthContext';

interface ShelfTimelineProps {
  space: Space;
  activeShelfId: string;
  shelfDocs: SpaceDocument[];
  onAddEvent: (event: Omit<ShelfEvent, 'id' | 'createdAt' | 'createdBy' | 'comments'>) => void;
  onUpdateEvent: (eventId: string, updates: Partial<ShelfEvent>) => void;
  onRemoveEvent: (eventId: string) => void;
  onAddComment: (eventId: string, text: string) => void;
  onRemoveComment: (eventId: string, commentId: string) => void;
}

export default function ShelfTimeline({ space, activeShelfId, shelfDocs, onAddEvent, onUpdateEvent, onRemoveEvent, onAddComment, onRemoveComment }: ShelfTimelineProps) {
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
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

  const events = (space.shelfEvents || [])
    .filter(e => e.shelfId === activeShelfId)
    .sort((a, b) => sortOrder === 'desc' ? new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime() : new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

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

  const handleToggleTask = (eventId: string, taskId: string, isCompleted: boolean) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const updatedTasks = (event.tasks || []).map(t => t.id === taskId ? { ...t, isCompleted } : t);
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

  const handleOpenScanner = () => {
    window.dispatchEvent(new CustomEvent('smartshare:open_scanner'));
  };

  return (
    <div style={{ padding: '0 0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} style={{ background: 'transparent', border: '1px solid #cbd5e1', color: '#475569', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>{sortOrder === 'desc' ? '⬇️ מהחדש לישן' : '⬆️ מהישן לחדש'}</span>
        </button>
        <button onClick={() => setShowAddModal(true)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '24px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
          <span>+</span> הוסף תחנה
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

          {events.map(event => {
            const eventDocs = shelfDocs.filter(d => event.documentIds?.includes(d.id));
            
            return (
              <div key={event.id} style={{ position: 'relative', zIndex: 1, paddingRight: '3rem' }}>
                <div style={{ position: 'absolute', right: '11px', top: '16px', width: '20px', height: '20px', background: '#3b82f6', borderRadius: '50%', border: '4px solid #f8fafc' }}></div>
                
                <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>{event.title}</h3>
                    <div style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      {new Date(event.eventDate).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                  
                  {event.description && (
                    <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.6', margin: '0.5rem 0', whiteSpace: 'pre-wrap' }}>
                      {event.description}
                    </p>
                  )}

                  {/* TASKS */}
                  <div style={{ marginTop: '1rem', background: '#fffbeb', borderRadius: '12px', padding: '1rem', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>📋</span> יומן משימות לביצוע:
                    </div>
                    {event.tasks && event.tasks.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {event.tasks.map(task => (
                          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input 
                              type="checkbox" 
                              checked={task.isCompleted} 
                              onChange={(e) => handleToggleTask(event.id, task.id, e.target.checked)}
                              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                            />
                            <span style={{ fontSize: '0.9rem', color: task.isCompleted ? '#94a3b8' : '#334155', textDecoration: task.isCompleted ? 'line-through' : 'none' }}>
                              {task.text}
                            </span>
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
                        style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #fcd34d', outline: 'none', fontSize: '0.8rem', boxSizing: 'border-box' }}
                      />
                      <button onClick={() => handleAddTaskInline(event.id)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', padding: '0 0.75rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>הוסף</button>
                    </div>
                  </div>

                  {eventDocs.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 'bold' }}>מסמכים מצורפים:</div>
                      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                        {eventDocs.map(doc => (
                          <div 
                            key={doc.id} 
                            onClick={() => window.open(doc.url, '_blank')}
                            style={{ flexShrink: 0, width: '85px', height: '120px', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? `url(${doc.thumbnailUrl || doc.url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: '1px solid #cbd5e1' }}
                            title={doc.title}
                          >
                            {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* COMMENTS - WHATSAPP STYLE */}
                  <div style={{ marginTop: '1rem', background: '#e5ddd5', borderRadius: '12px', padding: '0.75rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '12px', width: 'fit-content', margin: '0 auto 0.5rem auto' }}>
                      כל השותפים במדף רואים את הטוקבקים
                    </div>
                    {event.comments && event.comments.length > 0 && (() => {
                       const isExpanded = expandedChats[event.id];
                       const visibleComments = isExpanded ? event.comments : event.comments.slice(-2);
                       return (
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                           {!isExpanded && event.comments.length > 2 && (
                             <button 
                               onClick={() => setExpandedChats(prev => ({ ...prev, [event.id]: true }))}
                               style={{ background: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '12px', padding: '4px', fontSize: '0.75rem', color: '#3b82f6', cursor: 'pointer', marginBottom: '0.5rem' }}
                             >
                               הצג עוד {event.comments.length - 2} הודעות קודמות...
                             </button>
                           )}
                           {isExpanded && event.comments.length > 2 && (
                             <button 
                               onClick={() => setExpandedChats(prev => ({ ...prev, [event.id]: false }))}
                               style={{ background: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '12px', padding: '4px', fontSize: '0.75rem', color: '#64748b', cursor: 'pointer', marginBottom: '0.5rem' }}
                             >
                               הסתר הודעות ישנות
                             </button>
                           )}
                           {visibleComments.map(comment => {
                             const isMe = comment.userId === user?.id;
                             return (
                               <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                 <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '2px', padding: '0 4px' }}>
                                   {getUserName(comment.userId)}
                                 </div>
                                 <div style={{ 
                                   background: isMe ? '#dcf8c6' : '#ffffff', 
                                   padding: '6px 10px', 
                                   borderRadius: '12px', 
                                   borderTopRightRadius: isMe ? '12px' : '4px',
                                   borderTopLeftRadius: isMe ? '4px' : '12px',
                                   fontSize: '0.85rem', 
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
                       );
                    })()}
                    
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
                      <input 
                        type="text" 
                        placeholder="הוסף הודעה..." 
                        value={commentInputs[event.id] || ''}
                        onChange={(e) => setCommentInputs(prev => ({ ...prev, [event.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handlePostComment(event.id)}
                        style={{ flex: 1, padding: '0.5rem 1rem', borderRadius: '24px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', background: '#fff', boxSizing: 'border-box', minWidth: 0 }}
                      />
                      <button 
                        onClick={() => handlePostComment(event.id)}
                        disabled={!commentInputs[event.id]?.trim()}
                        style={{ background: commentInputs[event.id]?.trim() ? '#25d366' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '50%', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: commentInputs[event.id]?.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s', flexShrink: 0 }}
                      >
                        <span style={{ transform: 'rotate(-45deg)', marginLeft: '2px', marginBottom: '2px' }}>➤</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD EVENT MODAL */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderRadius: '24px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem' }}>תחנה חדשה בציר הזמן</h2>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>שיוך מסמכים</label>
                  <button onClick={handleOpenScanner} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '16px', color: '#3b82f6', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '1rem' }}>📷</span> סרוק מסמך חדש
                  </button>
                </div>
                {shelfDocs.length > 0 ? (
                  <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {shelfDocs.map(doc => {
                      const isSelected = selectedDocIds.includes(doc.id);
                      return (
                        <div 
                          key={doc.id} 
                          onClick={() => setSelectedDocIds(prev => isSelected ? prev.filter(id => id !== doc.id) : [...prev, doc.id])}
                          style={{ flexShrink: 0, width: '85px', height: '120px', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? `url(${doc.thumbnailUrl || doc.url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: isSelected ? '3px solid #10b981' : '1px solid #cbd5e1', opacity: isSelected ? 1 : 0.6 }}
                          title={doc.title}
                        >
                          {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                          {isSelected && <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#10b981', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>✓</div>}
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

    </div>
  );
}
