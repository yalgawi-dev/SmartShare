const fs = require('fs');

let content = fs.readFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', 'utf8');

const startStr = '{events.map(event => {';
const endStr = '          })}';

const startIndex = content.indexOf(startStr);
const endIndex = content.lastIndexOf(endStr) + endStr.length;

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find blocks');
  process.exit(1);
}

const eventsRender = `          {events.map((event, idx) => {
            const eventDocs = shelfDocs.filter(d => event.documentIds?.includes(d.id));
            const year = event.eventDate.substring(0, 4);
            const prevYear = idx > 0 ? events[idx - 1].eventDate.substring(0, 4) : null;
            const showYearMarker = year !== prevYear;
            const completedTasks = (event.tasks || []).filter(t => t.isCompleted).length;
            const totalTasks = (event.tasks || []).length;
            
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

                    {/* TASKS ACCORDION */}
                    <div style={{ marginTop: '1rem', background: '#fffbeb', borderRadius: '12px', padding: '1rem', border: '1px solid #fde68a' }}>
                      <div 
                        onClick={() => setExpandedTasks(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                        style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span>📋</span> יומן משימות לביצוע ({completedTasks}/{totalTasks} הושלמו)
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
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981', marginTop: '2px' }}
                                  />
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: '0.9rem', color: task.isCompleted ? '#94a3b8' : '#334155', textDecoration: task.isCompleted ? 'line-through' : 'none' }}>
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
                                    }} style={{ background: '#e0f2fe', color: '#0284c7', border: 'none', borderRadius: '12px', padding: '2px 8px', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                      📄 מצורף
                                    </button>
                                  ) : (
                                    <button onClick={() => setShowDocSelector({ eventId: event.id, taskId: task.id })} style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }} title="צרף מסמך למשימה">
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
                              style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #fcd34d', outline: 'none', fontSize: '0.8rem', boxSizing: 'border-box' }}
                            />
                            <button onClick={() => handleAddTaskInline(event.id)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', padding: '0 0.75rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>הוסף</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {eventDocs.length > 0 ? (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                          <span>מסמכים מצורפים:</span>
                          <button onClick={() => setShowDocSelector({ eventId: event.id })} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <span style={{fontSize: '1rem'}}>+</span> הוסף מסמך לתחנה
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                          {eventDocs.map(doc => (
                            <div 
                              key={doc.id} 
                              onClick={() => window.open(doc.url, '_blank')}
                              style={{ flexShrink: 0, width: '100px', height: '140px', background: '#e2e8f0', borderRadius: '12px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? \`url(\${doc.thumbnailUrl || doc.url})\` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: '1px solid #cbd5e1' }}
                              title={doc.title}
                            >
                              {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                        <button onClick={() => setShowDocSelector({ eventId: event.id })} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.85rem' }}>
                          <span style={{fontSize: '1rem'}}>+</span> הוסף מסמך לתחנה
                        </button>
                      </div>
                    )}

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

                  </div>
                </div>
              </React.Fragment>
            );
          })}`;

content = content.substring(0, startIndex) + eventsRender + content.substring(endIndex);

fs.writeFileSync('src/components/widgets/Vault/ShelfTimeline.tsx', content);
