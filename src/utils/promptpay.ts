import QRCode from 'qrcode';

/**
 * Clean and format PromptPay target ID (mobile phone, citizen ID, or e-Wallet)
 */
export function cleanPromptPayTarget(target: string): string {
  if (!target) return '';
  return target.replace(/[^0-9]/g, '');
}

/**
 * Validate PromptPay target format
 */
export function validatePromptPayTarget(target: string): {
  valid: boolean;
  type: 'mobile' | 'national_id' | 'ewallet' | 'invalid';
  message: string;
} {
  const cleaned = cleanPromptPayTarget(target);
  if (!cleaned) {
    return {
      valid: false,
      type: 'invalid',
      message: 'กรุณาระบุเบอร์พร้อมเพย์ (เบอร์โทร 10 หลัก หรือเลขบัตร ปชช. 13 หลัก)',
    };
  }

  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return { valid: true, type: 'mobile', message: 'เบอร์โทรศัพท์มือถือ (10 หลัก)' };
  }
  if (cleaned.length === 9) {
    return { valid: true, type: 'mobile', message: 'เบอร์โทรศัพท์ (9 หลัก)' };
  }
  if (cleaned.length === 13) {
    return { valid: true, type: 'national_id', message: 'เลขประจำตัวประชาชน / ผู้เสียภาษี (13 หลัก)' };
  }
  if (cleaned.length === 15) {
    return { valid: true, type: 'ewallet', message: 'e-Wallet ID (15 หลัก)' };
  }

  return {
    valid: false,
    type: 'invalid',
    message: `ความยาวไม่ถูกต้อง (${cleaned.length} หลัก) - พร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตร ปชช. 13 หลัก`,
  };
}

/**
 * Format PromptPay target for human-friendly display
 */
export function formatPromptPayDisplay(target: string): string {
  const cleaned = cleanPromptPayTarget(target);
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 13) {
    return `${cleaned.slice(0, 1)}-${cleaned.slice(1, 5)}-${cleaned.slice(5, 10)}-${cleaned.slice(10, 12)}-${cleaned.slice(12)}`;
  }
  if (cleaned.length === 15) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
  }
  return target;
}

/**
 * Helper: Format EMVCo Tag (ID + 2-digit length + value)
 */
function emvTag(id: string, value: string): string {
  const lenStr = ('00' + value.length).slice(-2);
  return `${id}${lenStr}${value}`;
}

/**
 * Calculate CRC16-CCITT (poly 0x1021, init 0xFFFF)
 * Strict requirement for EMVCo & Bank of Thailand (BOT) standard
 */
export function calculateCrc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
}

/**
 * Generate 100% standard EMVCo PromptPay QR Code payload
 * Strictly follows Bank of Thailand (BOT) PromptPay EMVCo Standard:
 *
 * Tag 00: Payload Format Indicator (01)
 * Tag 01: Point of Initiation Method (11: Static, 12: Dynamic)
 * Tag 29: Merchant Account Information (PromptPay AID + Target)
 *   Subtag 00: AID "A000000677010111"
 *   Subtag 01 (Mobile): 13 digits "0066" + 9 digits
 *   Subtag 02 (National ID / Tax ID): 13 digits
 *   Subtag 03 (e-Wallet): 15 digits
 * Tag 53: Transaction Currency ("764" for THB) - MANDATORY BEFORE 54 & 58!
 * Tag 54: Transaction Amount (e.g. "150.00") - Included when amount > 0
 * Tag 58: Country Code ("TH")
 * Tag 63: CRC16 Checksum (4 chars hex uppercase)
 */
export function generatePromptPayPayload(target: string, amount?: number): string {
  const cleaned = cleanPromptPayTarget(target);
  if (!cleaned) return '';

  let subTag = '01';
  let formattedTarget = cleaned;

  if (cleaned.length >= 15) {
    // e-Wallet
    subTag = '03';
    formattedTarget = cleaned;
  } else if (cleaned.length === 13) {
    // National ID / Tax ID
    subTag = '02';
    formattedTarget = cleaned;
  } else {
    // Mobile phone (e.g. 0891234567 -> 0066891234567)
    subTag = '01';
    const noLeadingZero = cleaned.replace(/^0/, '');
    formattedTarget = ('0000000000000' + '66' + noLeadingZero).slice(-13);
  }

  // Tag 29: Merchant Account Info PromptPay
  const aid = emvTag('00', 'A000000677010111');
  const targetTag = emvTag(subTag, formattedTarget);
  const tag29 = emvTag('29', aid + targetTag);

  const hasAmount = typeof amount === 'number' && !isNaN(amount) && amount > 0;

  // Build tags in exact BOT / EMVCo ascending order
  let payload = '';
  // 00: Format indicator
  payload += emvTag('00', '01');
  // 01: POI (12 for dynamic with fixed amount, 11 for static)
  payload += emvTag('01', hasAmount ? '12' : '11');
  // 29: Merchant info
  payload += tag29;
  // 53: Currency (764 = THB)
  payload += emvTag('53', '764');
  // 54: Amount (formatted to 2 decimal places)
  if (hasAmount) {
    payload += emvTag('54', amount.toFixed(2));
  }
  // 58: Country Code
  payload += emvTag('58', 'TH');

  // 63: CRC16 Checksum over payload + "6304"
  const dataToCrc = payload + '6304';
  const checksum = calculateCrc16(dataToCrc);

  return `${dataToCrc}${checksum}`;
}

/**
 * Render PromptPay payload as a Data URL image (PNG)
 * Uses high contrast and optimal density for bank app scanner cameras
 */
export async function generatePromptPayQRDataUrl(
  target: string,
  amount?: number
): Promise<string> {
  const cleaned = cleanPromptPayTarget(target);
  if (!cleaned) {
    throw new Error('ไม่พบข้อมูลเบอร์พร้อมเพย์หรือเลขบัตรประชาชน');
  }

  const payload = generatePromptPayPayload(cleaned, amount);
  if (!payload) {
    throw new Error('ไม่สามารถสร้าง PromptPay QR Code ได้ กรุณาตรวจสอบเบอร์พร้อมเพย์');
  }

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#002855', // Standard PromptPay deep navy blue
      light: '#ffffff',
    },
  });
}
