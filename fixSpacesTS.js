const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

c = c.replace(/export function SpacesProvider\(\{\ children\ \}: \{\ children: ReactNode\ \}\) \{\n  const \{\ user\ \} = useAuth\(\);\n  \n  const getRoleForSpace/g,
  `export function SpacesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [spacesBase, setSpacesBase] = useState<Omit<Space, 'mediaItems'>[]>([]);
  const [mediaItemsBySpace, setMediaItemsBySpace] = useState<Record<string, MediaItem[]>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const mediaUnsubscribes = useRef<Record<string, () => void>>({});

  const getRoleForSpace`);

c = c.replace(/return 'none';\n  \};\n  const \{\ user\ \} = useAuth\(\);\n  const \[spacesBase, setSpacesBase\] = useState<Omit<Space, 'mediaItems'>\[\]>\(\[\]\);\n  const \[mediaItemsBySpace, setMediaItemsBySpace\] = useState<Record<string, MediaItem\[\]>>\(\{\}\);\n  const \[isLoaded, setIsLoaded\] = useState\(false\);\n  const mediaUnsubscribes = useRef<Record<string, \(\) => void>>\(\{\}\);/g,
  `return 'none';\n  };`);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Fixed redeclaration in SpacesContext');
