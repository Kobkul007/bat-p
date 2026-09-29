export interface BankPaymentInfo {
  bankName: string; // e.g. "กสิกรไทย (KBANK)", "ไทยพาณิชย์ (SCB)", "กรุงเทพ (BBL)"
  accountNumber: string; // e.g. "123-4-56789-0"
  accountName: string; // e.g. "สมชาย มั่นคง"
  promptPayId: string; // e.g. "0812345678" or "1100500123456"
  promptPayName: string;
}

export interface MeetupTimeSlot {
  id: string; // e.g. "slot-18-19"
  label: string; // e.g. "18:00 - 19:00"
  startHour: number; // 18
  endHour: number; // 19
}

export interface SlipVerificationResult {
  isValidImage: boolean;
  hasQrCode: boolean;
  qrPayload?: string;
  isDuplicateSlip: boolean;
  duplicateMatchedName?: string;
  fileSizeKb: number;
  imageDimensions: { width: number; height: number };
  detectedBank?: string; // e.g. "กสิกรไทย (KBANK)", "ไทยพาณิชย์ (SCB)", "กรุงไทย (KTB)", "กรุงเทพ (BBL)", "พร้อมเพย์"
  aspectRatio: number;
  score: number; // 0-100 authenticity score
  status: 'passed' | 'warning' | 'flagged';
  passedChecks: string[];
  warnings: string[];
  analyzedAt: number;
}

export interface MeetupParticipant {
  id: string;
  name: string; // Participant's display name
  phone?: string;
  hoursPlayed: number; // Total hours (e.g. 1, 2, 3)
  selectedSlotIds: string[]; // e.g. ["slot-18-19", "slot-19-20"]
  calculatedFee: number; // Total fee in THB
  paymentStatus: 'pending' | 'paid' | 'confirmed' | 'rejected';
  paymentMethod: 'promptpay' | 'bank_transfer' | 'cash';
  registeredAt: number;
  paidAt?: number;
  slipUrl?: string; // Base64 or image data URL of the transfer slip
  slipVerification?: SlipVerificationResult;
  slipNote?: string;
  slipUploadedAt?: number;
  slipFingerprint?: string; // Hash signature for duplicate detection
  adminRejectReason?: string;
  addedToMatchQueue?: boolean; // Synced with court queue
}

export interface OrganizerContactInfo {
  phone?: string; // e.g. "089-123-4567"
  lineId?: string; // e.g. "somchai_badminton" or "@badminton71"
  facebook?: string; // e.g. "ก๊วนแบดวันอังคาร"
  organizerName?: string; // e.g. "พี่สมชาย ผู้จัดก๊วน"
  notes?: string; // e.g. "ติดต่อด่วนหากมีเหตุจำเป็นเรื่องสลิปหรือยกเลิก"
}

export interface MeetupSession {
  id: string;
  title: string; // e.g. "ก๊วนแบดมินตันประจำวัน"
  date: string; // e.g. "2026-09-29"
  location: string; // e.g. "สนามแบดมินตัน สปอร์ตคลับ 71 คอร์ด 3-4"
  startHour: number; // 18
  endHour: number; // 21
  totalDurationHours: number; // 3
  maxParticipants: number; // e.g. 12
  courtHourlyRate: number; // e.g. 200 THB/hr
  courtCount: number; // e.g. 2 courts
  totalCourtFee: number; // courtHourlyRate * courtCount * totalDurationHours
  shuttlecockPricePerPiece: number; // e.g. 50 THB/piece
  shuttlecockEstimatedCount: number; // e.g. 8 pieces
  totalShuttlecockFee: number; // price * count
  splitMethod: 'equal_all' | 'per_hour';
  bankInfo: BankPaymentInfo;
  contactInfo?: OrganizerContactInfo;
  status: 'open' | 'full' | 'closed';
  notes: string;
  participants: MeetupParticipant[];
  updatedAt: number;
  adminPin?: string; // e.g. "1234"
}
