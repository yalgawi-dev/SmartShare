const fs = require('fs');
let code = fs.readFileSync('src/utils/opencvFilters.ts', 'utf8');

const startMarker = `// --- B&W Enhancement (Sauvola Adaptive Thresholding for Thermal Receipts) ---`;
const endMarker = `// --- Photo Mode (Professional Photo Enhancement) ---`;

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) throw new Error("Markers not found");

const before = code.substring(0, startIndex);
const after = code.substring(endIndex);

const newMiddle = `
        // --- MINIATURIZED AUTO-DETECT & MASKS ---
        // We run the Auto-Detect logic on a highly downscaled thumbnail (20% size) to save 1.5 seconds!
        let smallDst = new cv.Mat();
        cv.resize(dst, smallDst, new cv.Size(0, 0), 0.2, 0.2, cv.INTER_AREA);
        
        let smallGray = new cv.Mat();
        cv.cvtColor(smallDst, smallGray, cv.COLOR_RGBA2GRAY, 0);
        
        // 1. Fast Thumbnail B&W (For Auto-Detect Black Ratio & Text Collisions)
        let bgKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(Math.max(3, Math.round(getK(21)*0.2))|1, Math.max(3, Math.round(getK(21)*0.2))|1));
        let bgSmallest = new cv.Mat();
        cv.morphologyEx(smallGray, bgSmallest, cv.MORPH_CLOSE, bgKernelSmall);
        cv.GaussianBlur(bgSmallest, bgSmallest, new cv.Size(3, 3), 0, 0);
        bgKernelSmall.delete();
        
        let flatGraySmall = new cv.Mat();
        cv.divide(smallGray, bgSmallest, flatGraySmall, 255, -1);
        bgSmallest.delete();
        
        let smallBw = new cv.Mat();
        cv.adaptiveThreshold(flatGraySmall, smallBw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, Math.max(3, Math.round(getK(61)*0.2))|1, 15);
        flatGraySmall.delete();
        
        let darkMaskSmall = new cv.Mat();
        cv.threshold(smallGray, darkMaskSmall, 50, 255, cv.THRESH_BINARY_INV);
        
        // 2. Fast Thumbnail HSV
        let totalSmallPixels = smallBw.rows * smallBw.cols;
        let hsvCheck = new cv.Mat();
        let rgbCheck = new cv.Mat();
        cv.cvtColor(smallDst, rgbCheck, cv.COLOR_RGBA2RGB);
        cv.cvtColor(rgbCheck, hsvCheck, cv.COLOR_RGB2HSV);
        let hsvPlanesCheck = new cv.MatVector();
        cv.split(hsvCheck, hsvPlanesCheck);
        let sCheck = hsvPlanesCheck.get(1);
        let vCheck = hsvPlanesCheck.get(2);
        
        let colorMask = new cv.Mat();
        cv.threshold(sCheck, colorMask, 20, 255, cv.THRESH_BINARY);
        let notPaperMask = new cv.Mat();
        cv.threshold(vCheck, notPaperMask, 250, 255, cv.THRESH_BINARY_INV); 
        
        let targetMask = new cv.Mat();
        cv.bitwise_and(colorMask, notPaperMask, targetMask);
        
        let openedMask = new cv.Mat();
        let openKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.morphologyEx(targetMask, openedMask, cv.MORPH_OPEN, openKernelSmall);
        let colorfulPixels = cv.countNonZero(openedMask);
        let colorfulRatio = colorfulPixels / totalSmallPixels;
        openKernelSmall.delete();
        
        let brightMask = new cv.Mat();
        cv.threshold(vCheck, brightMask, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
        let nonColorMask = new cv.Mat();
        cv.threshold(sCheck, nonColorMask, 40, 255, cv.THRESH_BINARY_INV);
        let paperMask = new cv.Mat();
        cv.bitwise_and(brightMask, nonColorMask, paperMask);
        let paperPixels = cv.countNonZero(paperMask);
        let paperRatio = paperPixels / totalSmallPixels;
        
        let whitePixels = cv.countNonZero(smallBw);
        let blackPixels = totalSmallPixels - whitePixels;
        let blackRatio = blackPixels / totalSmallPixels;
        
        let smallMask = new cv.Mat();
        openedMask.copyTo(smallMask);
        
        t_hsv = performance.now() - mark; mark = performance.now();
        
        // --- CONVEX HULL CLUSTERING (On Thumbnail!) ---
        let cleanKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.morphologyEx(smallMask, smallMask, cv.MORPH_OPEN, cleanKernelSmall);
        let groupKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
        cv.morphologyEx(smallMask, smallMask, cv.MORPH_CLOSE, groupKernelSmall);
        
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(smallMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        let hullMask = new cv.Mat.zeros(smallMask.rows, smallMask.cols, cv.CV_8UC1);
        let smallTextMask = new cv.Mat();
        cv.bitwise_not(smallBw, smallTextMask); 
        
        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let area = cv.contourArea(cnt);
            if (area > 2) { 
                let contourMask = new cv.Mat.zeros(smallMask.rows, smallMask.cols, cv.CV_8UC1);
                let cntVector = new cv.MatVector();
                cntVector.push_back(cnt);
                cv.drawContours(contourMask, cntVector, 0, new cv.Scalar(255), -1);
                
                let rect = cv.boundingRect(cnt);
                let boxMask = new cv.Mat.zeros(smallMask.rows, smallMask.cols, cv.CV_8UC1);
                let point1 = new cv.Point(rect.x, rect.y);
                let point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);
                cv.rectangle(boxMask, point1, point2, new cv.Scalar(255), -1);
                
                let diffMask = new cv.Mat();
                cv.bitwise_xor(boxMask, contourMask, diffMask);
                
                let collisionMask = new cv.Mat();
                cv.bitwise_and(diffMask, smallTextMask, collisionMask);
                let textPixels = cv.countNonZero(collisionMask);
                let diffPixels = cv.countNonZero(diffMask);
                
                let textDensity = diffPixels > 0 ? (textPixels / diffPixels) : 0;
                if (textDensity > 0.03) {
                    cv.bitwise_or(hullMask, contourMask, hullMask);
                } else {
                    cv.bitwise_or(hullMask, boxMask, hullMask);
                }
                
                contourMask.delete(); boxMask.delete(); diffMask.delete(); collisionMask.delete(); cntVector.delete();
            }
            cnt.delete();
        }
        smallTextMask.delete();
        
        let dilateKernelSmall = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.dilate(hullMask, hullMask, dilateKernelSmall, new cv.Point(-1, -1), 1);
        cv.GaussianBlur(hullMask, hullMask, new cv.Size(5, 5), 0, 0);
        
        let hybridMask = new cv.Mat();
        cv.resize(hullMask, hybridMask, new cv.Size(dst.cols, dst.rows), 0, 0, cv.INTER_LINEAR);
        
        hullMask.delete(); contours.delete(); hierarchy.delete(); groupKernelSmall.delete(); smallMask.delete(); cleanKernelSmall.delete(); dilateKernelSmall.delete();
        vCheck.delete(); colorMask.delete(); notPaperMask.delete(); targetMask.delete(); openedMask.delete(); 
        hsvCheck.delete(); rgbCheck.delete(); hsvPlanesCheck.delete(); sCheck.delete();
        brightMask.delete(); nonColorMask.delete(); paperMask.delete();
        smallBw.delete(); smallGray.delete(); smallDst.delete(); darkMaskSmall.delete();
        
        t_hull = performance.now() - mark; mark = performance.now();

        // --- LAZY EVALUATION RESOLUTION ---
        let detectedType = 'text_color';
        let aspectRatio = Math.max(dst.cols / dst.rows, dst.rows / dst.cols);
        
        if (colorfulRatio > 0.15 || blackRatio > 0.40) {
            detectedType = 'photo';
        } else if (colorfulRatio > 0.03) {
            if (paperRatio > 0.05) {
                detectedType = 'mixed';
            } else {
                detectedType = 'photo';
            }
        } else if (colorfulRatio <= 0.005 && aspectRatio > 1.7) {
            detectedType = 'text_bw';
        } else {
            detectedType = 'text_color';
        }

        let activeProfile = forcedProfile;
        if (activeProfile === 'auto' || activeProfile === 'text' || activeProfile === 'photo' || activeProfile === 'mixed') {
          if (detectedType === 'photo') {
            activeProfile = 'pure_color';
          } else if (detectedType === 'mixed') {
            activeProfile = 'hybrid';
          } else if (detectedType === 'text_bw') {
            activeProfile = 'bw';
          } else {
            activeProfile = 'smart_plus';
          }
        }

        // --- LAZY B&W ENGINE ---
        let bwRgba = new cv.Mat();
        let bw = new cv.Mat();
        let gray = new cv.Mat();
        let darkMask = new cv.Mat();
        let blackMat = new cv.Mat();
        
        if (activeProfile === 'bw' || activeProfile === 'hybrid') {
            cv.cvtColor(dst, gray, cv.COLOR_RGBA2GRAY, 0);
            let small = new cv.Mat();
            cv.resize(gray, small, new cv.Size(0, 0), 0.1, 0.1, cv.INTER_AREA);
            
            let bgSmall = new cv.Mat();
            let bgKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(getK(21), getK(21)));
            cv.morphologyEx(small, bgSmall, cv.MORPH_CLOSE, bgKernel);
            cv.GaussianBlur(bgSmall, bgSmall, new cv.Size(getK(5), getK(5)), 0, 0);
            bgKernel.delete();
            small.delete();
            
            let bg = new cv.Mat();
            cv.resize(bgSmall, bg, new cv.Size(gray.cols, gray.rows), 0, 0, cv.INTER_CUBIC);
            bgSmall.delete();
            
            let flatGray = new cv.Mat();
            cv.divide(gray, bg, flatGray, 255, -1);
            bg.delete();
            
            let blurred = new cv.Mat();
            cv.GaussianBlur(flatGray, blurred, new cv.Size(0, 0), 2);
            let sharpened = new cv.Mat();
            cv.addWeighted(flatGray, 2.0, blurred, -1.0, 0, sharpened);
            blurred.delete(); flatGray.delete();
            
            cv.adaptiveThreshold(sharpened, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, getK(61), 15);
            sharpened.delete();
            
            let noiseKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
            cv.morphologyEx(bw, bw, cv.MORPH_CLOSE, noiseKernel);
            noiseKernel.delete();
            
            cv.threshold(gray, darkMask, 50, 255, cv.THRESH_BINARY_INV);
            
            blackMat.create(bw.rows, bw.cols, bw.type());
            blackMat.setTo(new cv.Scalar(0));
            blackMat.copyTo(bw, darkMask);
            
            cv.cvtColor(bw, bwRgba, cv.COLOR_GRAY2RGBA, 0);
        }
        t_bw = performance.now() - mark; mark = performance.now();

        `;

code = code.replace(/const MAX_PROCESSING_WIDTH = 1400;/g, 'const MAX_PROCESSING_WIDTH = 1200;');

fs.writeFileSync('src/utils/opencvFilters.ts', before + newMiddle + after);
console.log("Done");
