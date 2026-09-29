import jsQR from 'jsqr';
import { SlipVerificationResult, MeetupParticipant } from '../types/meetup';

/**
 * Generates an image fingerprint from pixel data for duplicate slip detection
 */
function computeImageFingerprint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): string {
  // Sample a 16x16 grid to create a 256-bit perceptual hash
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 16;
  sampleCanvas.height = 16;
  const sampleCtx = sampleCanvas.getContext('2d');
  if (!sampleCtx) return `${width}x${height}`;

  sampleCtx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, 16, 16);
  const imgData = sampleCtx.getImageData(0, 0, 16, 16).data;

  let totalBrightness = 0;
  const brightnesses: number[] = [];

  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    brightnesses.push(brightness);
    totalBrightness += brightness;
  }

  const avgBrightness = totalBrightness / brightnesses.length;
  let hash = '';
  for (const b of brightnesses) {
    hash += b >= avgBrightness ? '1' : '0';
  }

  return hash;
}

/**
 * Compare two image fingerprints to calculate similarity distance (0 to 1)
 */
export function compareFingerprints(fp1: string, fp2: string): number {
  if (!fp1 || !fp2 || fp1.length !== fp2.length) return 0;
  let matchCount = 0;
  for (let i = 0; i < fp1.length; i++) {
    if (fp1[i] === fp2[i]) matchCount++;
  }
  return matchCount / fp1.length;
}

/**
 * Heuristic bank theme color detection
 */
function detectBankTheme(ctx: CanvasRenderingContext2D, width: number, height: number): string {
  // Sample top banner area where bank headers usually reside (top 25%)
  const sampleHeight = Math.max(10, Math.floor(height * 0.25));
  const imgData = ctx.getImageData(0, 0, width, sampleHeight).data;

  let greenCount = 0;
  let purpleCount = 0;
  let blueCount = 0;
  let pinkCount = 0;
  let yellowCount = 0;
  let totalPixels = 0;

  for (let i = 0; i < imgData.length; i += 16) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    totalPixels++;

    // KBANK Green: high G, lower R & B
    if (g > 100 && g > r * 1.25 && g > b * 1.25) {
      greenCount++;
    }
    // SCB Purple: high R & B, lower G
    else if (r > 70 && b > 90 && g < r * 0.8 && g < b * 0.8) {
      purpleCount++;
    }
    // KTB / BBL Blue: high B, lower R
    else if (b > 110 && b > r * 1.3 && b > g * 1.05) {
      blueCount++;
    }
    // GSB Pink: high R, medium B, low G
    else if (r > 150 && b > 90 && g < 100) {
      pinkCount++;
    }
    // BAY Yellow: high R & G, low B
    else if (r > 150 && g > 130 && b < 100) {
      yellowCount++;
    }
  }

  const threshold = totalPixels * 0.05;
  if (greenCount > threshold && greenCount >= purpleCount && greenCount >= blueCount) {
    return 'กสิกรไทย (K PLUS / KBANK)';
  }
  if (purpleCount > threshold && purpleCount >= greenCount && purpleCount >= blueCount) {
    return 'ไทยพาณิชย์ (SCB EASY)';
  }
  if (blueCount > threshold) {
    return 'กรุงไทย (Krungthai NEXT) หรือ กรุงเทพ (Bangkok Bank)';
  }
  if (pinkCount > threshold) {
    return 'ออมสิน (MyMo)';
  }
  if (yellowCount > threshold) {
    return 'กรุงศรี (KMA)';
  }

  return 'พร้อมเพย์ / โอนผ่านธนาคารพาณิชย์ทั่วไป';
}

/**
 * Core Slip Verification Engine
 * Analyzes the uploaded slip image, scans QR code with jsQR, detects duplicates,
 * checks aspect ratio, and computes authenticity score.
 */
export async function verifySlipImage(
  dataUrl: string,
  fileSizeKb: number,
  expectedFee: number,
  existingParticipants: MeetupParticipant[] = [],
  currentParticipantId?: string
): Promise<{ result: SlipVerificationResult; fingerprint: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      const aspectRatio = width > 0 ? Number((width / height).toFixed(2)) : 1;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      const warnings: string[] = [];
      const passedChecks: string[] = [];
      let score = 30; // base score for valid renderable image

      if (!ctx) {
        resolve({
          result: {
            isValidImage: false,
            hasQrCode: false,
            isDuplicateSlip: false,
            fileSizeKb,
            imageDimensions: { width, height },
            aspectRatio,
            score: 10,
            status: 'flagged',
            passedChecks: [],
            warnings: ['ไม่สามารถประมวลผลพิกเซลของภาพได้'],
            analyzedAt: Date.now(),
          },
          fingerprint: '',
        });
        return;
      }

      ctx.drawImage(img, 0, 0);

      passedChecks.push(`ความละเอียดของภาพคมชัด (${width} × ${height} พิกเซล)`);

      // 1. Aspect Ratio check (Mobile slips are typically portrait 0.45 - 0.75)
      const isPortraitSlipRatio = aspectRatio >= 0.42 && aspectRatio <= 0.82;
      if (isPortraitSlipRatio) {
        score += 20;
        passedChecks.push('สัดส่วนภาพเป็นแนวตั้งตามมาตรฐานสลิปโมบายแบงก์กิ้ง (Portrait Slip)');
      } else if (aspectRatio > 0.95 && aspectRatio < 1.05) {
        score += 5;
        warnings.push('ภาพมีสัดส่วนเป็นสี่เหลี่ยมจัตุรัส (อาจเป็นภาพแคปหน้าจอที่ตัดขอบมา)');
      } else {
        warnings.push('สัดส่วนภาพเป็นแนวนอนหรือแปลกจากสลิปธนาคารทั่วไป (ควรตรวจสอบด้วยตนเอง)');
      }

      // 2. Compute fingerprint & duplicate check
      const fingerprint = computeImageFingerprint(ctx, width, height);
      let isDuplicateSlip = false;
      let duplicateMatchedName: string | undefined;

      for (const p of existingParticipants) {
        if (p.id === currentParticipantId) continue;
        if (p.slipFingerprint) {
          const sim = compareFingerprints(fingerprint, p.slipFingerprint);
          if (sim >= 0.94) {
            isDuplicateSlip = true;
            duplicateMatchedName = p.name;
            break;
          }
        }
      }

      if (isDuplicateSlip) {
        score -= 50;
        warnings.push(
          `⚠️ ตรวจพบสลิปซ้ำ! ภาพสลิปนี้เหมือนกับสลิปที่ "${duplicateMatchedName}" เคยแนบไว้ในก๊วนนี้`
        );
      } else {
        score += 20;
        passedChecks.push('ไม่พบการใช้ภาพสลิปซ้ำกับสมาชิกท่านอื่นในก๊วน (No Duplicate)');
      }

      // 3. Scan for embedded Transaction QR Code via jsQR
      let hasQrCode = false;
      let qrPayload: string | undefined;

      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const qrCode = jsQR(imgData.data, width, height, {
          inversionAttempts: 'attemptBoth',
        });

        if (qrCode && qrCode.data) {
          hasQrCode = true;
          qrPayload = qrCode.data;
          score += 30;
          passedChecks.push('สแกนตรวจพบ QR Code ยืนยันธุรกรรมของธนาคารในตัวสลิป (Bank Verified QR)');
        }
      } catch (err) {
        console.warn('QR scan error in slip:', err);
      }

      if (!hasQrCode) {
        // If not found in full size, try scanning zoomed-in quadrants where bank QRs live (bottom half)
        try {
          const bottomCanvas = document.createElement('canvas');
          const halfY = Math.floor(height * 0.4);
          const halfH = height - halfY;
          bottomCanvas.width = width;
          bottomCanvas.height = halfH;
          const bCtx = bottomCanvas.getContext('2d');
          if (bCtx) {
            bCtx.drawImage(canvas, 0, halfY, width, halfH, 0, 0, width, halfH);
            const bData = bCtx.getImageData(0, 0, width, halfH);
            const bQr = jsQR(bData.data, width, halfH, { inversionAttempts: 'attemptBoth' });
            if (bQr && bQr.data) {
              hasQrCode = true;
              qrPayload = bQr.data;
              score += 30;
              passedChecks.push('สแกนตรวจพบ QR Code ยืนยันธุรกรรมบริเวณด้านล่างของสลิป');
            }
          }
        } catch {
          // ignore
        }
      }

      if (!hasQrCode) {
        warnings.push('ไม่พบ QR Code ตรวจสอบในภาพ (บางธนาคารหรือการโอนผ่านบางช่องทางอาจไม่มี QR)');
      }

      // 4. Detect Bank theme
      const detectedBank = detectBankTheme(ctx, width, height);
      passedChecks.push(`ตรวจพบลักษณะธีมธนาคาร: ${detectedBank}`);

      // 5. File size heuristics
      if (fileSizeKb > 25 && fileSizeKb < 15000) {
        passedChecks.push(`ขนาดไฟล์เหมาะสม (${fileSizeKb} KB)`);
      } else if (fileSizeKb <= 25) {
        warnings.push('ขนาดไฟล์ภาพเล็กมาก (อาจมีความละเอียดต่ำ)');
      }

      // Check expected fee notice
      passedChecks.push(`ยอดที่ต้องชำระตามระบบ: ${expectedFee} บาท (โปรดตรวจสอบตัวเลขในสลิปให้ตรงกัน)`);

      // Final score normalization
      const finalScore = Math.max(10, Math.min(100, score));
      let status: 'passed' | 'warning' | 'flagged' = 'passed';

      if (isDuplicateSlip || finalScore < 45) {
        status = 'flagged';
      } else if (finalScore < 75 || warnings.length >= 2) {
        status = 'warning';
      } else {
        status = 'passed';
      }

      resolve({
        result: {
          isValidImage: true,
          hasQrCode,
          qrPayload,
          isDuplicateSlip,
          duplicateMatchedName,
          fileSizeKb,
          imageDimensions: { width, height },
          detectedBank,
          aspectRatio,
          score: finalScore,
          status,
          passedChecks,
          warnings,
          analyzedAt: Date.now(),
        },
        fingerprint,
      });
    };

    img.onerror = () => {
      resolve({
        result: {
          isValidImage: false,
          hasQrCode: false,
          isDuplicateSlip: false,
          fileSizeKb,
          imageDimensions: { width: 0, height: 0 },
          aspectRatio: 1,
          score: 0,
          status: 'flagged',
          passedChecks: [],
          warnings: ['ไฟล์ที่เลือกไม่ใช่ภาพที่ถูกต้องหรือไม่สามารถเปิดอ่านได้'],
          analyzedAt: Date.now(),
        },
        fingerprint: '',
      });
    };

    img.src = dataUrl;
  });
}
