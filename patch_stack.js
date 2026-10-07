const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');

const oldBlockStart = `{ocrData?._duplicateWarning && (`;
const oldBlockEnd = `</div>
              )}
            </div>
          )}`;

const oldBlock = content.substring(content.indexOf(oldBlockStart), content.indexOf(oldBlockEnd) + oldBlockEnd.length);

const newBlock = `{ocrData?._duplicateWarning && (
            <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <strong>חשד לכפילות מול מסמך קיים!</strong> {ocrData._duplicateWarning}
                </div>
              </div>
              
              {ocrData._duplicateInvoice && (ocrData._duplicateInvoice.attachmentUrl || ocrData._duplicateInvoice.imageUrl) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                  
                  {/* CURRENT SCANNED INVOICE */}
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '1.1rem', color: '#b91c1c' }}>הסריקה החדשה (עכשיו)</p>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#666' }}>
                      {ocrData.date || 'לא זוהה תאריך'} • ₪{ocrData.amount || 'לא זוהה סכום'}
                    </p>
                    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                      {(() => {
                        const url = scannedImage;
                        if (!url) return <div style={{height: '250px'}}/>;
                        if (url.includes('.pdf') || url.startsWith('data:application/pdf')) {
                          return <PdfThumbnail base64Uri={url} onClick={() => window.open(url, '_blank')} style={{ width: '100%', maxHeight: '350px', border: '1px solid #eee', borderRadius: '8px', cursor: 'pointer', objectFit: 'contain' }} />
                        }
                        return <img src={url} onClick={() => setPreviewImage(url)} style={{ width: '100%', maxHeight: '350px', border: '1px solid #eee', borderRadius: '8px', cursor: 'zoom-in', objectFit: 'contain' }} />
                      })()}
                      <div style={{ position: 'absolute', bottom: '0.5rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', pointerEvents: 'none' }}>לחץ להגדלה</div>
                    </div>
                  </div>

                  <hr style={{ width: '100%', border: 'none', borderTop: '2px dashed #fca5a5', margin: '0' }} />
                  
                  {/* EXISTING INVOICE */}
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '1.1rem', color: '#b91c1c' }}>רשומה קיימת במערכת</p>
                    <p style={{ margin: '0 0 0.2rem 0', fontSize: '0.9rem', color: '#666' }}>
                      {ocrData._duplicateInvoice.date} • ₪{ocrData._duplicateInvoice.amount}
                    </p>
                    <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.8rem', color: '#888' }}>
                      הועלתה למערכת ב: {ocrData._duplicateInvoice.createdAt ? new Date(ocrData._duplicateInvoice.createdAt).toLocaleDateString('he-IL') : 'לא ידוע'}
                    </p>
                    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                      {(() => {
                        const url = ocrData._duplicateInvoice.attachmentUrl || ocrData._duplicateInvoice.imageUrl;
                        if (url.includes('.pdf') || url.startsWith('data:application/pdf')) {
                          return <PdfThumbnail base64Uri={url} onClick={() => window.open(url, '_blank')} style={{ width: '100%', maxHeight: '350px', border: '1px solid #eee', borderRadius: '8px', cursor: 'pointer', objectFit: 'contain' }} />
                        }
                        return <img src={url} onClick={() => setPreviewImage(url)} style={{ width: '100%', maxHeight: '350px', border: '1px solid #eee', borderRadius: '8px', cursor: 'zoom-in', objectFit: 'contain' }} />
                      })()}
                      <div style={{ position: 'absolute', bottom: '0.5rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', pointerEvents: 'none' }}>לחץ להגדלה</div>
                    </div>
                  </div>
                  
                </div>
              )}
            </div>
          )}`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', content);
