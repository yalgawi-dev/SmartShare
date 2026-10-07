import re

with open('src/components/widgets/Vault/ShelfTimeline.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add states
content = content.replace(
    "const [showDocSelector, setShowDocSelector] = useState<{ eventId: string, taskId?: string } | null>(null);",
    "const [showDocSelector, setShowDocSelector] = useState<{ eventId: string, taskId?: string } | null>(null);\n  const [activeChatEventId, setActiveChatEventId] = useState<string | null>(null);\n  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});"
)

# 2. Add completedAt to handleToggleTask
content = re.sub(
    r"const updatedTasks = \(event\.tasks \|\| \[\]\)\.map\(t => t\.id === taskId \? \{ \.\.\.t, isCompleted \} : t\);",
    "const updatedTasks = (event.tasks || []).map(t => t.id === taskId ? { ...t, isCompleted, completedAt: isCompleted ? new Date().toISOString() : undefined } : t);",
    content
)

# 3. Events map rendering for Year Marker
events_map_pattern = r"\{events\.map\(event => \{\n\s*const eventDocs = shelfDocs\.filter\(d => event\.documentIds\?\.includes\(d\.id\)\);\n\s*return \(\n\s*<div key=\{event\.id\} style=\{\{ position: 'relative', zIndex: 1, paddingRight: '3rem' \}\}>"
events_map_repl = """{events.map((event, idx) => {
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
                <div style={{ position: 'relative', zIndex: 1, paddingRight: '3rem' }}>"""
content = re.sub(events_map_pattern, events_map_repl, content)


event_end_pattern = r"                  </div>\n                </div>\n              </div>\n            \);\n          \}\)\}"
event_end_repl = "                  </div>\n                </div>\n              </div>\n              </React.Fragment>\n            );\n          })}"
content = re.sub(event_end_pattern, event_end_repl, content)


# 4. Tasks Accordion
tasks_pattern = r"\{/\* TASKS \*/\}.*?\{/\* COMMENTS - WHATSAPP STYLE \*/\}"
tasks_repl = """{/* TASKS ACCORDION */}
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

                  {eventDocs.length > 0 && (
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
                            style={{ flexShrink: 0, width: '100px', height: '140px', background: '#e2e8f0', borderRadius: '12px', backgroundImage: (doc.thumbnailUrl || !doc.url.includes('.pdf')) ? `url(${doc.thumbnailUrl || doc.url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer', position: 'relative', border: '1px solid #cbd5e1' }}
                            title={doc.title}
                          >
                            {(!doc.thumbnailUrl && doc.url.includes('.pdf')) && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem' }}>📄</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {eventDocs.length === 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                      <button onClick={() => setShowDocSelector({ eventId: event.id })} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.85rem' }}>
                        <span style={{fontSize: '1rem'}}>+</span> הוסף מסמך לתחנה
                      </button>
                    </div>
                  )}

                  {/* CHAT TRIGGER */}"""
content = re.sub(tasks_pattern, tasks_repl, content, flags=re.DOTALL)


# 5. Replace inline comments with just a button
comments_pattern = r"\{/\* COMMENTS - WHATSAPP STYLE \*/\}.*?</div>\n                  </div>\n                </div>\n              </div>\n              </React.Fragment>\n            \);\n          \}\)\}"
comments_repl = """{/* CHAT TRIGGER */}
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
          })}"""
content = re.sub(comments_pattern, comments_repl, content, flags=re.DOTALL)


# 6. Add Chat Modal before showAddModal
chat_modal_str = """
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
"""
content = content.replace("{showAddModal && (", chat_modal_str + "\n      {showAddModal && (")


with open('src/components/widgets/Vault/ShelfTimeline.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
