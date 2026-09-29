import { MeetupSession, MeetupParticipant, MeetupTimeSlot } from '../types/meetup';

const MEETUP_STORAGE_KEY = 'smashqueue_meetup_session_v1';

export function generateTimeSlots(startHour: number, endHour: number): MeetupTimeSlot[] {
  const slots: MeetupTimeSlot[] = [];
  for (let h = startHour; h < endHour; h++) {
    const startStr = `${String(h).padStart(2, '0')}:00`;
    const endStr = `${String(h + 1).padStart(2, '0')}:00`;
    slots.push({
      id: `slot-${h}-${h + 1}`,
      label: `${startStr} - ${endStr}`,
      startHour: h,
      endHour: h + 1,
    });
  }
  return slots;
}

export const DEFAULT_MEETUP_SESSION: MeetupSession = {
  id: 'session-today',
  title: 'ก๊วนแบดมินตันประจำวัน (SmashQueue)',
  date: new Date().toISOString().split('T')[0],
  location: 'สนามแบดมินตัน วินเนอร์ อารีน่า คอร์ด 1-2',
  startHour: 18,
  endHour: 21,
  totalDurationHours: 3,
  maxParticipants: 12,
  courtHourlyRate: 200,
  courtCount: 2,
  totalCourtFee: 1200, // 200 * 2 courts * 3 hrs
  shuttlecockPricePerPiece: 50,
  shuttlecockEstimatedCount: 8,
  totalShuttlecockFee: 400, // 8 * 50
  splitMethod: 'per_hour',
  bankInfo: {
    bankName: 'กสิกรไทย (KBANK)',
    accountNumber: '095-2-88741-9',
    accountName: 'สมชาย จัดก๊วนแบดมินตัน',
    promptPayId: '0891234567',
    promptPayName: 'สมชาย แอดมินก๊วน',
  },
  contactInfo: {
    phone: '089-123-4567',
    lineId: '@badminton71',
    facebook: 'ก๊วนแบดมินตัน วินเนอร์ อารีน่า',
    organizerName: 'สมชาย (ผู้จัดก๊วน)',
    notes: 'ติดต่อด่วนหากมีเหตุจำเป็นเรื่องสลิป หรือโทรแจ้งหากมาสาย',
  },
  adminPin: '1234',
  status: 'open',
  notes: 'นำไม้แบดและรองเท้าแบดมินตันมาเอง ลูกแบด RSL Silver จัดเตรียมไว้ให้',
  participants: [
    {
      id: 'p-1',
      name: 'กานต์ + แบงค์',
      hoursPlayed: 3,
      selectedSlotIds: ['slot-18-19', 'slot-19-20', 'slot-20-21'],
      calculatedFee: 260,
      paymentStatus: 'confirmed',
      paymentMethod: 'promptpay',
      registeredAt: Date.now() - 3600000 * 4,
      paidAt: Date.now() - 3600000 * 3,
      addedToMatchQueue: true,
    },
    {
      id: 'p-2',
      name: 'พลอย',
      hoursPlayed: 2,
      selectedSlotIds: ['slot-19-20', 'slot-20-21'],
      calculatedFee: 175,
      paymentStatus: 'confirmed',
      paymentMethod: 'promptpay',
      registeredAt: Date.now() - 3600000 * 3,
      paidAt: Date.now() - 3600000 * 2,
      addedToMatchQueue: true,
    },
    {
      id: 'p-3',
      name: 'ต้นกล้า',
      hoursPlayed: 3,
      selectedSlotIds: ['slot-18-19', 'slot-19-20', 'slot-20-21'],
      calculatedFee: 260,
      paymentStatus: 'paid',
      paymentMethod: 'promptpay',
      registeredAt: Date.now() - 3600000 * 2,
      paidAt: Date.now() - 3600000 * 1,
      slipUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="580" viewBox="0 0 360 580">
  <defs>
    <linearGradient id="kbankHeader" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#056b3b"/>
      <stop offset="100%" stop-color="#0a8047"/>
    </linearGradient>
  </defs>
  <rect width="360" height="580" fill="#ffffff" rx="20"/>
  <rect width="360" height="135" fill="url(#kbankHeader)"/>
  <text x="180" y="45" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">K PLUS</text>
  <text x="180" y="75" font-family="sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">โอนเงินสำเร็จ</text>
  <text x="180" y="102" font-family="sans-serif" font-size="11" fill="#e0f2fe" text-anchor="middle">29 ก.ย. 2569 - 17:35 น.</text>

  <text x="40" y="175" font-family="sans-serif" font-size="11" fill="#888888">จาก</text>
  <text x="40" y="195" font-family="sans-serif" font-size="13" font-weight="bold" fill="#111111">นายต้นกล้า (ผู้เล่นก๊วน)</text>
  <text x="40" y="213" font-family="sans-serif" font-size="11" fill="#666666">กสิกรไทย xxx-x-x1482-x</text>

  <text x="40" y="255" font-family="sans-serif" font-size="11" fill="#888888">ไปยัง</text>
  <text x="40" y="275" font-family="sans-serif" font-size="13" font-weight="bold" fill="#111111">สมชาย จัดก๊วนแบดมินตัน</text>
  <text x="40" y="293" font-family="sans-serif" font-size="11" fill="#666666">พร้อมเพย์ 089-123-4567</text>

  <line x1="30" y1="325" x2="330" y2="325" stroke="#e5e7eb" stroke-width="1"/>

  <text x="40" y="365" font-family="sans-serif" font-size="12" fill="#555555">จำนวนเงิน</text>
  <text x="320" y="370" font-family="sans-serif" font-size="24" font-weight="bold" fill="#056b3b" text-anchor="end">260.00 บาท</text>

  <line x1="30" y1="405" x2="330" y2="405" stroke="#e5e7eb" stroke-width="1"/>

  <rect x="130" y="430" width="100" height="100" fill="#f8fafc" stroke="#e2e8f0" rx="10"/>
  <rect x="142" y="442" width="22" height="22" fill="#0f172a"/>
  <rect x="196" y="442" width="22" height="22" fill="#0f172a"/>
  <rect x="142" y="496" width="22" height="22" fill="#0f172a"/>
  <rect x="176" y="476" width="10" height="10" fill="#0f172a"/>
  <text x="180" y="550" font-family="sans-serif" font-size="9" fill="#94a3b8" text-anchor="middle">สแกนตรวจสอบสลิป (QR)</text>
</svg>
      `)}`,
      slipVerification: {
        isValidImage: true,
        hasQrCode: true,
        isDuplicateSlip: false,
        fileSizeKb: 142,
        imageDimensions: { width: 360, height: 580 },
        detectedBank: 'กสิกรไทย (K PLUS / KBANK)',
        aspectRatio: 0.62,
        score: 95,
        status: 'passed',
        passedChecks: [
          'ความละเอียดของภาพคมชัด (360 × 580 พิกเซล)',
          'สัดส่วนภาพเป็นแนวตั้งตามมาตรฐานสลิปโมบายแบงก์กิ้ง (Portrait Slip)',
          'ไม่พบการใช้ภาพสลิปซ้ำกับสมาชิกท่านอื่นในก๊วน (No Duplicate)',
          'สแกนตรวจพบ QR Code ยืนยันธุรกรรมของธนาคารในตัวสลิป (Bank Verified QR)',
          'ตรวจพบลักษณะธีมธนาคาร: กสิกรไทย (K PLUS / KBANK)',
          'ยอดที่ต้องชำระตามระบบ: 260 บาท (ตรงตามยอดโอน 260.00 บาท)',
        ],
        warnings: [],
        analyzedAt: Date.now() - 3600000,
      },
      slipFingerprint: '11110000111100001111000011110000',
      slipNote: 'โอนยอด 260 บาท 3 ชั่วโมง เรียบร้อยครับ จากกสิกร',
      slipUploadedAt: Date.now() - 3600000,
      addedToMatchQueue: false,
    },
    {
      id: 'p-4',
      name: 'เมย์',
      hoursPlayed: 2,
      selectedSlotIds: ['slot-18-19', 'slot-19-20'],
      calculatedFee: 175,
      paymentStatus: 'pending',
      paymentMethod: 'promptpay',
      registeredAt: Date.now() - 3600000 * 1,
      addedToMatchQueue: false,
    },
  ],
  updatedAt: Date.now(),
};

/**
 * Recalculate participant fees based on total expenses and participant hours
 */
export function recalculateAllParticipantFees(session: MeetupSession): MeetupParticipant[] {
  const totalCost = session.totalCourtFee + session.totalShuttlecockFee;
  if (session.participants.length === 0 || totalCost <= 0) {
    return session.participants;
  }

  if (session.splitMethod === 'equal_all') {
    const feePerPerson = Math.ceil(totalCost / Math.max(1, session.participants.length));
    return session.participants.map((p) => ({
      ...p,
      calculatedFee: feePerPerson,
    }));
  }

  // per_hour split
  const totalParticipantHours = session.participants.reduce((sum, p) => sum + (p.hoursPlayed || 1), 0);
  if (totalParticipantHours === 0) return session.participants;

  const ratePerHour = totalCost / totalParticipantHours;

  return session.participants.map((p) => ({
    ...p,
    calculatedFee: Math.ceil(ratePerHour * (p.hoursPlayed || 1)),
  }));
}

/**
 * Calculate expected fee for a single new participant
 */
export function estimateParticipantFee(
  session: MeetupSession,
  hours: number,
  isAlreadyRegistered: boolean = false
): number {
  const totalCost = session.totalCourtFee + session.totalShuttlecockFee;
  if (totalCost <= 0) return 0;

  if (session.splitMethod === 'equal_all') {
    const count = session.participants.length + (isAlreadyRegistered ? 0 : 1);
    return Math.ceil(totalCost / Math.max(1, count));
  }

  // per_hour
  const existingHours = session.participants.reduce((sum, p) => sum + (p.hoursPlayed || 1), 0);
  const totalParticipantHours = existingHours + (isAlreadyRegistered ? 0 : hours);
  if (totalParticipantHours === 0) {
    // Fallback: assume average 6 participants
    return Math.ceil((totalCost / (6 * session.totalDurationHours)) * hours);
  }

  const ratePerHour = totalCost / totalParticipantHours;
  return Math.ceil(ratePerHour * hours);
}

export function loadMeetupSession(): MeetupSession {
  try {
    const raw = localStorage.getItem(MEETUP_STORAGE_KEY);
    if (!raw) return DEFAULT_MEETUP_SESSION;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_MEETUP_SESSION,
      ...parsed,
      bankInfo: {
        ...DEFAULT_MEETUP_SESSION.bankInfo,
        ...(parsed.bankInfo || {}),
      },
    };
  } catch {
    return DEFAULT_MEETUP_SESSION;
  }
}

export function saveMeetupSession(session: MeetupSession): void {
  try {
    localStorage.setItem(MEETUP_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save meetup session', e);
  }
}
