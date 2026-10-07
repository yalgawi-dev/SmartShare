const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');

const oldWarningStart = `{ocrData?._duplicateWarning && (`;
const oldWarningEnd = `</button>
                )}
              </div>
            </div>
          )}`;

const oldWarningBlock = content.substring(content.indexOf(oldWarningStart), content.indexOf(oldWarningEnd) + oldWarningEnd.length);

const newWarningBlock = `{ocrData?._duplicateWarning && (
            <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                <div>
                  <strong>חשד לכפילות מול מסמך קיים!</strong> {ocrData._duplicateWarning}
                </div>
              </div>
              
              {ocrData._duplicateInvoice && (ocrData._duplicateInvoice.attachmentUrl || ocrData._duplicateInvoice.imageUrl) && (
                <div style={{ display: 'flex', gap: '0.5rem', background: 'white', padding: '0.5rem', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                  
                  {/* EXISTING INVOICE */}
                  <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px dashed #fca5a5', paddingLeft: '0.5rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '0.8rem', color: '#b91c1c' }}>רשומה קיימת במערכת</p>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#666' }}>
                      {ocrData._duplicateInvoice.date} • ₪{ocrData._duplicateInvoice.amount}
                    </p>
                    {(() => {
                      const url = ocrData._duplicateInvoice.attachmentUrl || ocrData._duplicateInvoice.imageUrl;
                      if (url.includes('.pdf') || url.startsWith('data:application/pdf')) {
                        return <PdfThumbnail base64Uri={url} onClick={() => window.open(url, '_blank')} style={{ maxWidth: '100%', maxHeight: '150px', border: '1px solid #eee', borderRadius: '8px', cursor: 'pointer' }} />
                      }
                      return <img src={url} onClick={() => setPreviewImage(url)} style={{ maxWidth: '100%', maxHeight: '150px', border: '1px solid #eee', borderRadius: '8px', cursor: 'zoom-in', objectFit: 'contain' }} />
                    })()}
                  </div>

                  {/* CURRENT SCANNED INVOICE */}
                  <div style={{ flex: 1, textAlign: 'center', paddingRight: '0.5rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', fontSize: '0.8rem', color: '#b91c1c' }}>הסריקה החדשה (עכשיו)</p>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#666' }}>
                      {ocrData.date || 'לא זוהה תאריך'} • ₪{ocrData.amount || 'לא זוהה סכום'}
                    </p>
                    {(() => {
                      const url = scannedImage;
                      if (!url) return <div style={{height: '150px'}}/>;
                      if (url.includes('.pdf') || url.startsWith('data:application/pdf')) {
                        return <PdfThumbnail base64Uri={url} onClick={() => window.open(url, '_blank')} style={{ maxWidth: '100%', maxHeight: '150px', border: '1px solid #eee', borderRadius: '8px', cursor: 'pointer' }} />
                      }
                      return <img src={url} onClick={() => setPreviewImage(url)} style={{ maxWidth: '100%', maxHeight: '150px', border: '1px solid #eee', borderRadius: '8px', cursor: 'zoom-in', objectFit: 'contain' }} />
                    })()}
                  </div>
                  
                </div>
              )}
            </div>
          )}`;

content = content.replace(oldWarningBlock, newWarningBlock);
fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', content);
