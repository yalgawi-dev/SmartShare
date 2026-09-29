const fs = require('fs');
const file = 'src/components/widgets/Partners/WelcomeGate.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace handleStart logic
content = content.replace(/const handleStart = async \(\) => \{[\s\S]*?setShowGate\(false\);\n  \};/, \const handleStart = async () => {
    if (!user) return; // Should never happen with AuthWall
    
    setIsLoading(true);
    const finalName = isEditingName ? guestName : ((user.realName !== 'אורח' && user.realName) ? user.realName : guestName);
    
    const params = new URLSearchParams(window.location.search);
    const isRetroParam = params.get('isRetroactive') === 'true';
    const shareParam = params.get('share');
    const planParam = params.get('plan');
    
    let sharesPlan: { creator: number; partners?: Record<string, number> } | undefined;
    if (planParam) {
      try {
        sharesPlan = JSON.parse(decodeURIComponent(planParam));
      } catch (e) {
        try {
          sharesPlan = JSON.parse(planParam);
        } catch (e2) {}
      }
    }
    
    finalizeGuestJoin(
      spaceId, 
      finalName, 
      isRetroParam, 
      user.id, // REAL USER ID
      currentMember?.sharePercentage !== undefined ? currentMember.sharePercentage : (shareParam ? Number(shareParam) : undefined),
      sharesPlan
    );

    // No local storage token saving needed anymore for guest tokens, just dispatch for firestore
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartshare_new_key', { 
        detail: { spaceId, role: 'partner', token: user.id } 
      }));
    }

    if (finalName && (user.realName === 'אורח' || !user.realName)) {
      try {
        updateProfile({ realName: finalName });
      } catch (e) {}
    }

    setIsLoading(false);
    setShowGate(false);
  };\);
fs.writeFileSync(file, content, 'utf8');
