import QRCode from 'qrcode';

/**
 * Calculate CRC16-CCITT (polynomial 0x1021, init 0xFFFF)
 */
function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    crc ^= code << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  const hex = crc.toString(16).toUpperCase();
  return hex.padStart(4, '0');
}

/**
 * Format EMVCo Tag-Length-Value (TLV)
 */
function formatTLV(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

/**
 * Format PromptPay Target ID (Mobile or Citizen ID)
 */
function formatPromptPayTarget(target: string): { subTag: string; formatted: string } {
  const cleaned = target.replace(/[^0-9]/g, '');

  if (cleaned.length === 13) {
    // National ID / Tax ID
    return { subTag: '02', formatted: cleaned };
  } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
    // Thai Mobile: replace leading 0 with 0066 (e.g. 0812345678 -> 0066812345678)
    return { subTag: '01', formatted: `0066${cleaned.slice(1)}` };
  } else if (cleaned.length === 9) {
    return { subTag: '01', formatted: `0066${cleaned}` };
  } else if (cleaned.length === 15) {
    // e-Wallet ID
    return { subTag: '03', formatted: cleaned };
  }

  // Fallback as mobile with 0066
  const mobileWithoutZero = cleaned.replace(/^0+/, '');
  return { subTag: '01', formatted: `0066${mobileWithoutZero}` };
}

/**
 * Generate EMVCo QR Code Payload for PromptPay
 * @param target Mobile number (08XXXXXXXX) or National ID (13 digits)
 * @param amount Optional payment amount in THB
 */
export function generatePromptPayPayload(target: string, amount?: number): string {
  const { subTag, formatted } = formatPromptPayTarget(target);

  // 1. Tag 29: Merchant Account Information
  // AID: A0000067700111
  const aidTLV = formatTLV('00', 'A0000067700111');
  const targetTLV = formatTLV(subTag, formatted);
  const merchantAccountInfo = formatTLV('29', `${aidTLV}${targetTLV}`);

  // 2. Base EMV tags
  const payloadFormat = formatTLV('00', '01');
  const pointOfInitiation = formatTLV('01', amount && amount > 0 ? '12' : '11');
  const transactionCurrency = formatTLV('53', '764'); // 764 = THB
  const countryCode = formatTLV('58', 'TH');

  let raw = `${payloadFormat}${pointOfInitiation}${merchantAccountInfo}${transactionCurrency}`;

  // 3. Amount Tag 54 (if provided)
  if (amount && amount > 0) {
    const formattedAmount = amount.toFixed(2);
    raw += formatTLV('54', formattedAmount);
  }

  raw += countryCode;

  // 4. Tag 63: CRC16 checksum
  raw += '6304';
  const checksum = crc16(raw);
  return `${raw}${checksum}`;
}

/**
 * Render PromptPay payload as a Data URL image (PNG)
 */
export async function generatePromptPayQRDataUrl(target: string, amount?: number): Promise<string> {
  const payload = generatePromptPayPayload(target, amount);
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}
