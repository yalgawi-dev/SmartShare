const fs = require('fs');

let content = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

if (!content.includes('expandedEvents')) {
  content = content.replace(
    'const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});',
    'const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});\n  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});'
  );
}

const lines = content.split(/\r?\n/);

const startIdx = lines.findIndex(l => l.includes('{events.map((event, idx) => {'));
let endIdx = -1;
for (let i = startIdx + 1; i < lines.length; i++) {
  if (lines[i].includes('</React.Fragment>')) {
    // we need to skip lines[i+1] and lines[i+2] which are ');' and '})}'
    endIdx = i + 2;
    break;
  }
}

if (startIdx === -1 || endIdx === -1) {
  console.log('Error finding block!');
  process.exit(1);
}

const newEventsRenderLines = `{events.map((event, idx) => {
            const eventDocs = shelfDocs.filter(d => event.documentIds?.includes(d.id));
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
                <div style={{ position: 'relative', zIndex: 1, paddingRight: '3rem' }}>
                  <div style={{ position: 'absolute', right: '12px', top: '24px', width: '18px', height: '18px', background: '#3b82f6', borderRadius: '50%', border: '4px solid #eff6ff', boxShadow: '0 0 0 1px #cbd5e1' }}></div>
                  
                  <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
                    <div 
                      onClick={() => setExpandedEvents(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', marginBottom: isExpanded ? '0.5rem' : '0' }}
                    >
                      <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', flex: 1 }}>{event.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {new Date(event.eventDate).toLocaleDateString('he-IL')}
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                    
                    {!isExpanded && (
                       <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', alignItems: 'center' }}>
                         {totalTasks > 0 && (
                           <button onClick={(e) => { e.stopPropagation(); setExpandedEvents(prev => ({ ...prev, [event.id]: true })); setExpandedTasks(prev => ({ ...prev, [event.id]: true })); }} style={{ background: 'transparent', border: 'none', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', padding: 0 }}>
                             📋 {openTasks > 0 ? \`(\${openTasks} פתוחות)\` : '(כולן הושלמו)'}
                           </button>
                         )}
                         {(event.comments || []).length > 0 && (
                           <button onClick={(e) => { e.stopPropagation(); setActiveChatEventId(event.id); }} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', padding: 0 }}>
                             💬 {(event.comments || []).length}
                           </button>
                         )}
                         {eventDocs.length > 0 && (
                           <div style={{ color: '#64748b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                             📄 {eventDocs.length}
                           </div>
                         )}
                         <button onClick={(e) => { e.stopPropagation(); setShowDocSelector({ eventId: event.id }); }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer', padding: 0, marginLeft: 'auto' }} title="הוסף מסמך">
                           📎
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
                              <span>📋</span> יומן משימות לביצוע {totalTasks > 0 ? (openTasks > 0 ? \`(\${openTasks} פתוחות)\` : '(כולן הושלמו)') : ''}
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
                                          if (doc) window.open(doc.url, '_blank');
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
                          {eventDocs.map(doc => (
                            <div 
                              key={doc.id} 
                              onClick={() => window.open(doc.url, '_blank')}
                              style={{ flexShrink: 0, width: '60px', height: '80px', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? \`url(\${doc.thumbnailUrl || doc.url})\` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: '1px solid #cbd5e1' }}
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
          })}`.split('\n');

lines.splice(startIdx, endIdx - startIdx + 1, ...newEventsRenderLines);

content = lines.join('\n');

// Add DocSelector Modal if not exists
if (!content.includes('בחר מסמך לשיוך')) {
  const docSelectorModal = `
      {/* DOC SELECTOR MODAL */}
      {showDocSelector && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '1.5rem', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>בחר מסמך לשיוך</h2>
              <button onClick={() => setShowDocSelector(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', paddingBottom: '1rem' }}>
              {shelfDocs.length > 0 ? shelfDocs.map(doc => (
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
                        handleSaveEvent(event.id, event.title, event.eventDate, event.description, [...(event.documentIds || []), doc.id], event.tasks || []);
                      }
                    }
                    setShowDocSelector(null);
                  }}
                  style={{ width: '100%', aspectRatio: '1/1.4', background: '#e2e8f0', borderRadius: '8px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? \`url(\${doc.thumbnailUrl || doc.url})\` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: '1px solid #cbd5e1' }}
                  title={doc.title}
                >
                  {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                </div>
              )) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  המחסן ריק.<br />אנא הוסף מסמכים למדף קודם (באמצעות כפתור המצלמה הכחול).
                </div>
              )}
            </div>
          </div>
        </div>
      )}
`;
  content = content.replace('{showAddModal && (', docSelectorModal + '\n      {showAddModal && (');
}

// In handleToggleTask, accept docId argument
const oldHandleToggleTask = `const handleToggleTask = async (eventId: string, taskId: string, isCompleted: boolean) => {`;
const newHandleToggleTask = `const handleToggleTask = async (eventId: string, taskId: string, isCompleted?: boolean, docId?: string) => {`;
if (content.includes(oldHandleToggleTask)) {
  content = content.replace(oldHandleToggleTask, newHandleToggleTask);
  
  const oldUpdatedTasks = `const updatedTasks = (event.tasks || []).map(t => t.id === taskId ? { ...t, isCompleted, completedAt: isCompleted ? new Date().toISOString() : undefined } : t);`;
  const newUpdatedTasks = `const updatedTasks = (event.tasks || []).map(t => t.id === taskId ? { ...t, ...(isCompleted !== undefined && { isCompleted, completedAt: isCompleted ? new Date().toISOString() : undefined }), ...(docId && { documentId: docId }) } : t);`;
  content = content.replace(oldUpdatedTasks, newUpdatedTasks);
}

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', content);

