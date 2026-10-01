
import codecs

path1 = r'c:\yehuda\project\app\SmartShare\src\components\widgets\ScannerModal.tsx'
with codecs.open(path1, 'r', 'utf-8') as f: content1 = f.read()
target1 = 'הכנס את המסמך למסגרת\n               </div>'
target1_rn = target1.replace('\n', '\r\n')
replacement1 = 'הכנס את המסמך למסגרת\n                 <div style={{ fontSize: \'0.8rem\', color: \'#FFD700\', marginTop: \'0.25rem\' }}>\n                   💡 מומלץ לצלם על רקע כהה\n                 </div>\n               </div>'
if target1 in content1:
    content1 = content1.replace(target1, replacement1)
    with codecs.open(path1, 'w', 'utf-8') as f: f.write(content1)
    print('Scanner replaced!')
elif target1_rn in content1:
    content1 = content1.replace(target1_rn, replacement1.replace('\n', '\r\n'))
    with codecs.open(path1, 'w', 'utf-8') as f: f.write(content1)
    print('Scanner replaced rn!')
else: print('Scanner target not found!')

path2 = r'c:\yehuda\project\app\SmartShare\src\app\context\SpacesContext.tsx'
with codecs.open(path2, 'r', 'utf-8') as f: content2 = f.read()
target2 = '      const updatePresence = () => {\n        if (!db || !user?.id) return;\n        const userRef = doc(db, \'users\', user.id);'
target2_rn = target2.replace('\n', '\r\n')
replacement2 = '      const updatePresence = () => {\n        if (!db || !user?.id) return;\n        if (typeof document !== \'undefined\' && document.visibilityState !== \'visible\') return;\n        const userRef = doc(db, \'users\', user.id);'

if target2 in content2:
    content2 = content2.replace(target2, replacement2)
    with codecs.open(path2, 'w', 'utf-8') as f: f.write(content2)
    print('SpacesContext replaced!')
elif target2_rn in content2:
    content2 = content2.replace(target2_rn, replacement2.replace('\n', '\r\n'))
    with codecs.open(path2, 'w', 'utf-8') as f: f.write(content2)
    print('SpacesContext replaced rn!')
else: print('SpacesContext target not found!')

