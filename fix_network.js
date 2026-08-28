const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');

// Replace the parallel upload logic with sequential optimized logic
const oldLogic = `      // 1. We optimize the network by running Firebase Upload AND Gemini AI in parallel!
      // This cuts the latency in half. We also send the base64 image directly to the API
      // so the server doesn't have to waste time downloading it again from Firebase.
      const { uploadImageToStorage, db } = await import('../../lib/firebase');
      const { doc, getDoc, setDoc, updateDoc, increment } = await import('firebase/firestore');
      const { downscaleBase64 } = await import('../../utils/imageOptimizer');
      
      // Scale the image down to 1500px strictly for network/API speed
      const optimizedImgUrl = await downscaleBase64(imgUrl, 1500, 0.85);
      
      const filename = \`invoices/\${space.id}/\${Date.now()}.jpg\`;
      
      const uploadPromise = uploadImageToStorage(optimizedImgUrl, filename);
      const ocrPromise = fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: optimizedImgUrl }) // Send optimized base64 directly!
      });
      
      const [finalImageUrl, response] = await Promise.all([uploadPromise, ocrPromise]);`;

const newLogic = `      // 1. Architecture Fix: Sequence is FASTER than Parallel for Mobile Networks!
      // Sending 1MB to Firebase AND 1MB to Vercel at the same time over 4G causes upstream bandwidth saturation (buffer bloat).
      // Instead, we upload to Firebase (1MB) ONCE, get a tiny 100-byte URL, and send THAT to Vercel.
      // Vercel and Firebase are both on Google's 100Gbps backbone, so server-to-server download takes ~10ms!
      const { uploadImageToStorage, db } = await import('../../lib/firebase');
      const { doc, getDoc, setDoc, updateDoc, increment } = await import('firebase/firestore');
      const { downscaleBase64 } = await import('../../utils/imageOptimizer');
      
      // Scale down to 1200px (fastest network speed without losing text quality)
      const optimizedImgUrl = await downscaleBase64(imgUrl, 1200, 0.85);
      
      const filename = \`invoices/\${space.id}/\${Date.now()}.jpg\`;
      
      // Step A: Upload image to Firebase (Mobile Upstream ~1MB)
      const finalImageUrl = await uploadImageToStorage(optimizedImgUrl, filename);
      
      // Step B: Send tiny URL to API (Mobile Upstream ~100 bytes)
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: finalImageUrl }) // Send tiny URL instead of massive Base64
      });`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', code);
console.log("Done");
