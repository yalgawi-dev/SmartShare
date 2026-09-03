const fs = require('fs');
let c = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');

c = c.replace(
  `return 'none';\n  };\n  const [spacesBase, setSpacesBase] = useState<Omit<Space, 'mediaItems'>[]>([]);\n  const [mediaItemsBySpace, setMediaItemsBySpace] = useState<Record<string, MediaItem[]>>({});\n  const [isLoaded, setIsLoaded] = useState(false);\n  const mediaUnsubscribes = useRef<Record<string, () => void>>({});\n  useEffect(() => {`,
  `return 'none';\n  };\n  useEffect(() => {`
);

fs.writeFileSync('src/app/context/SpacesContext.tsx', c);
console.log('Removed duplicate variables from SpacesContext');
