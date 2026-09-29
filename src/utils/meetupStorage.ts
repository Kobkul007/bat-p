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
