const fs = require('fs');
let file = 'src/components/widgets/Auth/AuthWall.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("import { Shield, Smartphone, ArrowRight, Loader2 } from 'lucide-react';", "");
content = content.replace("<Shield className=\\"w-8 h-8 text-white\\" />", "<span className=\\"text-3xl\\">??</span>");
content = content.replace("<Smartphone className=\\"h-5 w-5 text-slate-400\\" />", "<span className=\\"text-lg\\">??</span>");
content = content.replace("<ArrowRight className=\\"w-5 h-5 mr-2\\" />", "<span className=\\"mr-2\\">?</span>");
content = content.replace("<Loader2 className=\\"w-10 h-10 text-indigo-600 animate-spin\\" />", "<span className=\\"text-4xl animate-spin inline-block\\">?</span>");
content = content.replace("<Loader2 className=\\"w-5 h-5 animate-spin\\" />", "<span className=\\"text-xl animate-spin inline-block\\">?</span>");

fs.writeFileSync(file, content, 'utf8');

file = 'src/app/AuthGuard.tsx';
content = fs.readFileSync(file, 'utf8');
content = content.replace("import { Loader2 } from 'lucide-react';", "");
content = content.replace("<Loader2 className=\\"w-10 h-10 text-indigo-600 animate-spin\\" />", "<div className=\\"w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin\\"></div>");
fs.writeFileSync(file, content, 'utf8');
