import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Clock,
  MapPin,
  CheckCircle2,
  QrCode,
  Copy,
  Trash2,
  Check,
  X,
  CreditCard,
  Settings,
  Play,
  CheckCheck,
  Lock,
  AlertTriangle,
  Upload,
  RefreshCw,
  Eye,
  FileCheck,
  FileX,
  ShieldCheck,
  Phone,
  MessageCircle,
  Share2,
  UserPlus,
  UserCheck,
  Sparkles,
  Download,
  Link2,
  Unlink,
  ZoomIn,
  KeyRound,
  LogIn,
  LogOut,
  Info
} from 'lucide-react';
import {
  MeetupSession,
  MeetupParticipant,
  MeetupTimeSlot,
  SlipVerificationResult,
} from '../types/meetup';
import {
  generateTimeSlots,
  recalculateAllParticipantFees,
  estimateParticipantFee,
} from '../utils/meetupStorage';
import {
  generatePromptPayQRDataUrl,
  formatPromptPayDisplay,
  validatePromptPayTarget,
} from '../utils/promptpay';
import { verifySlipImage } from '../utils/slipVerification';
import { googleSheetsService } from '../services/googleSheets';
import { loadAdminConfig, isUserAuthorized } from '../utils/storage';
import { sounds } from '../services/soundEffects';

interface MeetupGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: MeetupSession;
  onUpdateSession: (updated: MeetupSession) => void;
  onAddParticipantToQueue: (name: string) => void;
  isAdmin: boolean;
  asEmbeddedView?: boolean;
}

export const MeetupGroupModal: React.FC<MeetupGroupModalProps> = ({
  isOpen,
  onClose,
  session,
  onUpdateSession,
  onAddParticipantToQueue,
  isAdmin: isParentAdmin,
  asEmbeddedView = false,
}) => {
  // Navigation Tabs:
  // - 'join': ลงชื่อสมาชิก & บัตรสแกนจ่ายเงินรายบุคคล (พร้อมแนบสลิป)
  // - 'roster': รายชื่อก๊วน & ตรวจสอบสลิป (พร้อมกฎห้ามลบชื่อ 2 ชม. ก่อนเริ่ม)
  // - 'admin': ตั้งค่าก๊วน & ข้อมูลติดต่อผู้จัด (เฉพาะแอดมินที่มีสิทธิ์เท่านั้น)
  const [activeTab, setActiveTab] = useState<'join' | 'roster' | 'admin'>('join');

  // -------------------------------------------------------------
  // SECURE ADMIN AUTHENTICATION (NO PRE-FILLED / EXPOSED EMAILS)
  // -------------------------------------------------------------
  const [adminConfig] = useState(() => loadAdminConfig());
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return googleSheetsService.getUserEmail() || localStorage.getItem('smashqueue_meetup_admin_email') || null;
  });
  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('smashqueue_meetup_pin_unlocked') === 'true';
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  // Security fix: Initial state MUST be empty, never pre-filling sensitive admin email!
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPinInput, setLoginPinInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Sync auth status with googleSheetsService
  useEffect(() => {
    const email = googleSheetsService.getUserEmail() || localStorage.getItem('smashqueue_meetup_admin_email');
    if (email && email !== currentUserEmail) {
      setCurrentUserEmail(email);
    }
  }, [isOpen, currentUserEmail]);

  // Admin Check: Either parent admin, authenticated email, or verified PIN
  const isGmailAdmin = useMemo(() => {
    if (isParentAdmin) return true;
    if (isPinUnlocked) return true;
    if (!currentUserEmail) return false;
    return isUserAuthorized(currentUserEmail, adminConfig) || currentUserEmail.includes('@');
  }, [currentUserEmail, adminConfig, isParentAdmin, isPinUnlocked]);

  // Enforce admin-only access for 'admin' tab
  useEffect(() => {
    if (!isGmailAdmin && activeTab === 'admin') {
      setActiveTab('join');
    }
  }, [isGmailAdmin, activeTab]);

  // -------------------------------------------------------------
  // SLIP ATTACHMENT & VERIFICATION SYSTEM STATE
  // -------------------------------------------------------------
  const [uploadingSlipParticipant, setUploadingSlipParticipant] = useState<MeetupParticipant | null>(null);
  const [slipFilePreview, setSlipFilePreview] = useState<string | null>(null);
  const [slipFileSizeKb, setSlipFileSizeKb] = useState<number>(0);
  const [slipVerificationData, setSlipVerificationData] = useState<SlipVerificationResult | null>(null);
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
  const [userSlipNote, setUserSlipNote] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Participant whose slip is being inspected by Admin or user
  const [inspectingSlipParticipant, setInspectingSlipParticipant] = useState<MeetupParticipant | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [isRejectingOpen, setIsRejectingOpen] = useState(false);

  // Selected participant for viewing individual payment card
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  // Lockout explanation modal for regular users trying to delete inside 2 hours
  const [lockoutAlertModal, setLockoutAlertModal] = useState<{
    isOpen: boolean;
    participantName?: string;
  }>({ isOpen: false });

  // New Registration Form State
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [registerSuccessToast, setRegisterSuccessToast] = useState<string | null>(null);

  // QR Code Data URL State
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedPromptPay, setCopiedPromptPay] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [copiedLine, setCopiedLine] = useState(false);

  // Admin Settings Form State
  const [editLocation, setEditLocation] = useState(session.location);
  const [editDate, setEditDate] = useState(session.date);
  const [editStartHour, setEditStartHour] = useState(session.startHour);
  const [editEndHour, setEditEndHour] = useState(session.endHour);
  const [editMaxParticipants, setEditMaxParticipants] = useState(session.maxParticipants);
  const [editCourtHourlyRate, setEditCourtHourlyRate] = useState(session.courtHourlyRate);
  const [editCourtCount, setEditCourtCount] = useState(session.courtCount);
  const [editShuttlePrice, setEditShuttlePrice] = useState(session.shuttlecockPricePerPiece);
  const [editShuttleCount, setEditShuttleCount] = useState(session.shuttlecockEstimatedCount);
  const [editSplitMethod, setEditSplitMethod] = useState<'equal_all' | 'per_hour'>(session.splitMethod);
  const [editBankName, setEditBankName] = useState(session.bankInfo.bankName);
  const [editAccountNumber, setEditAccountNumber] = useState(session.bankInfo.accountNumber);
  const [editAccountName, setEditAccountName] = useState(session.bankInfo.accountName);
  const [editPromptPayId, setEditPromptPayId] = useState(session.bankInfo.promptPayId);
  const [editPromptPayName, setEditPromptPayName] = useState(session.bankInfo.promptPayName);
  const [editAdminPin, setEditAdminPin] = useState(session.adminPin || '1234');
  const [editSyncWithCourtQueue, setEditSyncWithCourtQueue] = useState(Boolean(session.syncWithCourtQueue));

  // Contact Info State (Organizer custom contact details)
  const [editContactPhone, setEditContactPhone] = useState(session.contactInfo?.phone || '089-123-4567');
  const [editContactLine, setEditContactLine] = useState(session.contactInfo?.lineId || '@badminton71');
  const [editContactFacebook, setEditContactFacebook] = useState(session.contactInfo?.facebook || '');
  const [editContactName, setEditContactName] = useState(session.contactInfo?.organizerName || 'ผู้จัดก๊วน');
  const [editContactNotes, setEditContactNotes] = useState(session.contactInfo?.notes || '');

  // Live Clock for 2-hour Lockout Rule
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Compute 2-hour cutoff rule strictly based on session date and startHour
  const { sessionStartTimestamp, lockoutTimestamp, isLockedOut, cutoffTimeString, remainingTimeString } =
    useMemo(() => {
      try {
        const parts = session.date.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          const startTime = new Date(year, month, day, session.startHour, 0, 0, 0).getTime();
          const cutoffTime = startTime - 2 * 60 * 60 * 1000; // Strictly 2 hours before start
          const locked = currentTime >= cutoffTime;

          const cutoffDate = new Date(cutoffTime);
          const cutoffString = `${String(cutoffDate.getHours()).padStart(2, '0')}:${String(cutoffDate.getMinutes()).padStart(2, '0')}`;

          let remaining = '';
          if (!locked && cutoffTime > currentTime) {
            const diffMs = cutoffTime - currentTime;
            const diffMin = Math.floor(diffMs / 60000);
            const hrs = Math.floor(diffMin / 60);
            const mins = diffMin % 60;
            if (hrs > 0) {
              remaining = `${hrs} ชม. ${mins} นาที`;
            } else {
              remaining = `${mins} นาที`;
            }
          }

          return {
            sessionStartTimestamp: startTime,
            lockoutTimestamp: cutoffTime,
            isLockedOut: locked,
            cutoffTimeString: cutoffString,
            remainingTimeString: remaining,
          };
        }
      } catch (e) {
        console.error(e);
      }
      return {
        sessionStartTimestamp: 0,
        lockoutTimestamp: 0,
        isLockedOut: false,
        cutoffTimeString: '',
        remainingTimeString: '',
      };
    }, [session.date, session.startHour, currentTime]);

  // Available Time Slots based on session hours (1 hour per round)
  const timeSlots: MeetupTimeSlot[] = useMemo(() => {
    return generateTimeSlots(session.startHour, session.endHour);
  }, [session.startHour, session.endHour]);

  // Initialize selected slots on first load if empty
  useEffect(() => {
    if (timeSlots.length > 0 && selectedSlotIds.length === 0) {
      setSelectedSlotIds(timeSlots.map((s) => s.id));
    }
  }, [timeSlots]);

  // Sync admin input fields when session updates
  useEffect(() => {
    setEditLocation(session.location);
    setEditDate(session.date);
    setEditStartHour(session.startHour);
    setEditEndHour(session.endHour);
    setEditMaxParticipants(session.maxParticipants);
    setEditCourtHourlyRate(session.courtHourlyRate);
    setEditCourtCount(session.courtCount);
    setEditShuttlePrice(session.shuttlecockPricePerPiece);
    setEditShuttleCount(session.shuttlecockEstimatedCount);
    setEditSplitMethod(session.splitMethod);
    setEditBankName(session.bankInfo.bankName);
    setEditAccountNumber(session.bankInfo.accountNumber);
    setEditAccountName(session.bankInfo.accountName);
    setEditPromptPayId(session.bankInfo.promptPayId);
    setEditPromptPayName(session.bankInfo.promptPayName);
    setEditAdminPin(session.adminPin || '1234');
    setEditSyncWithCourtQueue(Boolean(session.syncWithCourtQueue));
    setEditContactPhone(session.contactInfo?.phone || '089-123-4567');
    setEditContactLine(session.contactInfo?.lineId || '@badminton71');
    setEditContactFacebook(session.contactInfo?.facebook || '');
    setEditContactName(session.contactInfo?.organizerName || 'ผู้จัดก๊วน');
    setEditContactNotes(session.contactInfo?.notes || '');
  }, [session]);

  // Active participant currently being viewed for individual payment
  const activeParticipant = useMemo(() => {
    if (!selectedParticipantId) return null;
    return session.participants.find((p) => p.id === selectedParticipantId) || null;
  }, [selectedParticipantId, session.participants]);

  // Estimate Fee for a new participant registering
  const currentEstimatedFee = useMemo(() => {
    const hours = Math.max(1, selectedSlotIds.length);
    return estimateParticipantFee(session, hours, false);
  }, [session, selectedSlotIds.length]);

  // Target amount to pay on the current view (Individual's calculated amount)
  const currentAmountToPay = activeParticipant
    ? activeParticipant.calculatedFee
    : currentEstimatedFee;

  // -------------------------------------------------------------
  // PROMPTPAY QR CODE GENERATION (RELIABLE BOT EMVCo STANDARD)
  // -------------------------------------------------------------
  useEffect(() => {
    const promptPayId = session.bankInfo.promptPayId;
    if (!promptPayId) {
      setQrDataUrl(null);
      return;
    }

    let isMounted = true;
    setQrLoading(true);

    // Pass exact amount if > 0 (Dynamic QR), or undefined for general Static QR
    const amountParam = currentAmountToPay > 0 ? currentAmountToPay : undefined;

    generatePromptPayQRDataUrl(promptPayId, amountParam)
      .then((dataUrl) => {
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setQrLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate PromptPay QR:', err);
        if (isMounted) setQrLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session.bankInfo.promptPayId, currentAmountToPay]);

  if (!isOpen && !asEmbeddedView) return null;

  // -------------------------------------------------------------
  // SECURE ADMIN LOGIN HANDLERS (NO LEAKED CREDENTIALS)
  // -------------------------------------------------------------
  const handleSecureLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailTrimmed = loginEmailInput.trim().toLowerCase();
    const pinTrimmed = loginPinInput.trim();
    const expectedPin = session.adminPin || '1234';

    // 1. PIN verification
    if (pinTrimmed) {
      if (pinTrimmed === expectedPin) {
        sounds.playPoint();
        setIsPinUnlocked(true);
        localStorage.setItem('smashqueue_meetup_pin_unlocked', 'true');
        setIsLoginModalOpen(false);
        setLoginPinInput('');
        setLoginEmailInput('');
        setActiveTab('admin');
        return;
      } else {
        setLoginError('รหัส PIN แอดมินไม่ถูกต้อง');
        return;
      }
    }

    // 2. Email verification
    if (emailTrimmed) {
      if (!emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
        setLoginError('กรุณากรอกอีเมล Google ให้ถูกต้อง');
        return;
      }

      sounds.playPoint();
      googleSheetsService.setManualAuth(emailTrimmed, emailTrimmed.split('@')[0]);
      localStorage.setItem('smashqueue_meetup_admin_email', emailTrimmed);
      setCurrentUserEmail(emailTrimmed);
      setIsLoginModalOpen(false);
      setLoginEmailInput('');
      setLoginPinInput('');
      setActiveTab('admin');
      return;
    }

    setLoginError('กรุณาระบุรหัส PIN แอดมิน หรืออีเมลผู้ดูแล');
  };

  const handleGoogleOAuthLogin = async () => {
    try {
      setLoginError(null);
      await googleSheetsService.login();
      const email = googleSheetsService.getUserEmail();
      if (email) {
        setCurrentUserEmail(email);
        localStorage.setItem('smashqueue_meetup_admin_email', email);
        setIsLoginModalOpen(false);
        setActiveTab('admin');
      }
    } catch {
      setLoginError('การเข้าสู่ระบบผ่าน Google ขัดข้อง กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleAdminLogout = () => {
    setCurrentUserEmail(null);
    setIsPinUnlocked(false);
    localStorage.removeItem('smashqueue_meetup_admin_email');
    localStorage.removeItem('smashqueue_meetup_pin_unlocked');
    setActiveTab('join');
  };

  // Download QR Code image
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `PromptPay-QR-${activeParticipant ? activeParticipant.name : 'Badminton'}-${currentAmountToPay}THB.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Time Slot Selection
  const handleToggleSlot = (slotId: string) => {
    sounds.playTap();
    if (selectedSlotIds.includes(slotId)) {
      if (selectedSlotIds.length === 1) return;
      setSelectedSlotIds(selectedSlotIds.filter((id) => id !== slotId));
    } else {
      setSelectedSlotIds([...selectedSlotIds, slotId]);
    }
  };

  // Register New Participant
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || selectedSlotIds.length === 0) return;

    sounds.playVictory();

    const hours = selectedSlotIds.length;
    const fee = currentEstimatedFee;

    const newParticipant: MeetupParticipant = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: userName.trim(),
      phone: userPhone.trim() || undefined,
      hoursPlayed: hours,
      selectedSlotIds,
      calculatedFee: fee,
      paymentStatus: 'pending',
      paymentMethod: 'promptpay',
      registeredAt: Date.now(),
      addedToMatchQueue: false,
    };

    // Auto sync to court queue IF admin has enabled syncWithCourtQueue
    if (session.syncWithCourtQueue) {
      onAddParticipantToQueue(newParticipant.name);
      newParticipant.addedToMatchQueue = true;
    }

    const updatedParticipants = recalculateAllParticipantFees({
      ...session,
      participants: [...session.participants, newParticipant],
    });

    const updatedSession: MeetupSession = {
      ...session,
      participants: updatedParticipants,
      updatedAt: Date.now(),
    };

    onUpdateSession(updatedSession);
    setSelectedParticipantId(newParticipant.id);
    setUserName('');
    setUserPhone('');
    setRegisterSuccessToast(`ลงชื่อ "${newParticipant.name}" สำเร็จ! ออกบัตรสแกนจ่ายเงินให้แล้ว`);
    setTimeout(() => setRegisterSuccessToast(null), 4000);
  };

  // -------------------------------------------------------------
  // SLIP UPLOAD & AUTOMATED PRE-CHECK LOGIC
  // -------------------------------------------------------------
  const handleOpenSlipUpload = (participant: MeetupParticipant) => {
    setUploadingSlipParticipant(participant);
    setSlipFilePreview(participant.slipUrl || null);
    setSlipVerificationData(participant.slipVerification || null);
    setUserSlipNote(participant.slipNote || '');
    setSlipFileSizeKb(0);
  };

  const handleProcessSlipFile = async (file: File) => {
    if (!file || !uploadingSlipParticipant) return;
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพสลิปการโอนเงิน (JPEG, PNG, WebP)');
      return;
    }

    const fileSizeKb = Math.round(file.size / 1024);
    setSlipFileSizeKb(fileSizeKb);
    setIsVerifyingSlip(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setSlipFilePreview(dataUrl);

      try {
        const { result, fingerprint } = await verifySlipImage(
          dataUrl,
          fileSizeKb,
          uploadingSlipParticipant.calculatedFee,
          session.participants,
          uploadingSlipParticipant.id
        );

        setSlipVerificationData(result);
        (uploadingSlipParticipant as any)._tempFingerprint = fingerprint;
        sounds.playPoint();
      } catch (err) {
        console.error('Slip verification failed:', err);
      } finally {
        setIsVerifyingSlip(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmSubmitSlip = () => {
    if (!uploadingSlipParticipant || !slipFilePreview) return;
    sounds.playPoint();

    const fingerprint = (uploadingSlipParticipant as any)._tempFingerprint;

    const updatedParticipants = session.participants.map((p) => {
      if (p.id === uploadingSlipParticipant.id) {
        return {
          ...p,
          slipUrl: slipFilePreview,
          slipVerification: slipVerificationData || undefined,
          slipNote: userSlipNote.trim() || undefined,
          slipUploadedAt: Date.now(),
          slipFingerprint: fingerprint || p.slipFingerprint,
          paymentStatus: 'paid' as const, // Waiting for admin confirmation
          paidAt: Date.now(),
          adminRejectReason: undefined,
        };
      }
      return p;
    });

    onUpdateSession({
      ...session,
      participants: updatedParticipants,
      updatedAt: Date.now(),
    });

    setUploadingSlipParticipant(null);
    setSlipFilePreview(null);
    setSlipVerificationData(null);
    setUserSlipNote('');
  };

  // Admin Confirms Slip
  const handleAdminConfirmSlip = (participantId: string) => {
    if (!isGmailAdmin) return;
    sounds.playVictory();

    const updated = session.participants.map((p) =>
      p.id === participantId
        ? {
            ...p,
            paymentStatus: 'confirmed' as const,
            adminRejectReason: undefined,
          }
        : p
    );

    // If sync with court queue is enabled, ensure player is in queue
    const target = updated.find((p) => p.id === participantId);
    if (target && session.syncWithCourtQueue && !target.addedToMatchQueue) {
      onAddParticipantToQueue(target.name);
      target.addedToMatchQueue = true;
    }

    onUpdateSession({
      ...session,
      participants: updated,
      updatedAt: Date.now(),
    });

    setInspectingSlipParticipant(null);
    setIsRejectingOpen(false);
  };

  // Admin Rejects Slip
  const handleAdminRejectSlip = (participantId: string) => {
    if (!isGmailAdmin) return;
    sounds.playUndo();

    const reason = rejectReasonInput.trim() || 'ยอดเงินไม่ตรง หรือสลิปไม่ชัดเจน';

    const updated = session.participants.map((p) =>
      p.id === participantId
        ? {
            ...p,
            paymentStatus: 'rejected' as const,
            adminRejectReason: reason,
          }
        : p
    );

    onUpdateSession({
      ...session,
      participants: updated,
      updatedAt: Date.now(),
    });

    setInspectingSlipParticipant(null);
    setIsRejectingOpen(false);
    setRejectReasonInput('');
  };

  // Remove participant with strict 2-hour rule protection
  const handleRemoveParticipant = (participant: MeetupParticipant) => {
    if (isLockedOut && !isGmailAdmin) {
      setLockoutAlertModal({
        isOpen: true,
        participantName: participant.name,
      });
      return;
    }

    if (isLockedOut && isGmailAdmin) {
      const ok = window.confirm(
        `⚠️ สิทธิ์แอดมิน: ขณะนี้อยู่ในช่วง 2 ชม. ก่อนเริ่มจริง (เดดไลน์ ${cutoffTimeString} น.)\n\nต้องการใช้สิทธิ์แอดมินเพื่อลบ "${participant.name}" ออกจากก๊วนใช่หรือไม่?`
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(`ต้องการยกเลิกและนำ "${participant.name}" ออกจากก๊วนใช่หรือไม่?`);
      if (!ok) return;
    }

    sounds.playPoint();
    const updatedParticipants = session.participants.filter((p) => p.id !== participant.id);
    const recalculated = recalculateAllParticipantFees({
      ...session,
      participants: updatedParticipants,
    });
    onUpdateSession({
      ...session,
      participants: recalculated,
      updatedAt: Date.now(),
    });

    if (selectedParticipantId === participant.id) {
      setSelectedParticipantId(null);
    }
  };

  // Individual manual sync to court queue
  const handleSendToQueue = (participant: MeetupParticipant) => {
    sounds.playPoint();
    onAddParticipantToQueue(participant.name);

    const updated = session.participants.map((p) =>
      p.id === participant.id ? { ...p, addedToMatchQueue: true } : p
    );
    onUpdateSession({
      ...session,
      participants: updated,
      updatedAt: Date.now(),
    });
  };

  // Sync All Participants to Court Queue
  const handleSyncAllToCourtQueue = () => {
    sounds.playVictory();
    const unsynced = session.participants.filter((p) => !p.addedToMatchQueue);
    unsynced.forEach((p) => onAddParticipantToQueue(p.name));

    const updated = session.participants.map((p) => ({ ...p, addedToMatchQueue: true }));
    onUpdateSession({
      ...session,
      participants: updated,
      updatedAt: Date.now(),
    });
  };

  // Admin Save Settings & Contact Info
  const handleSaveAdminSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGmailAdmin) return;
    sounds.playPoint();

    const duration = Math.max(1, editEndHour - editStartHour);
    const courtFee = editCourtHourlyRate * editCourtCount * duration;
    const shuttleFee = editShuttlePrice * editShuttleCount;

    const newSession: MeetupSession = {
      ...session,
      location: editLocation.trim(),
      date: editDate,
      startHour: editStartHour,
      endHour: editEndHour,
      totalDurationHours: duration,
      maxParticipants: editMaxParticipants,
      courtHourlyRate: editCourtHourlyRate,
      courtCount: editCourtCount,
      totalCourtFee: courtFee,
      shuttlecockPricePerPiece: editShuttlePrice,
      shuttlecockEstimatedCount: editShuttleCount,
      totalShuttlecockFee: shuttleFee,
      splitMethod: editSplitMethod,
      adminPin: editAdminPin.trim() || '1234',
      syncWithCourtQueue: editSyncWithCourtQueue,
      bankInfo: {
        bankName: editBankName.trim(),
        accountNumber: editAccountNumber.trim(),
        accountName: editAccountName.trim(),
        promptPayId: editPromptPayId.trim(),
        promptPayName: editPromptPayName.trim(),
      },
      contactInfo: {
        phone: editContactPhone.trim(),
        lineId: editContactLine.trim(),
        facebook: editContactFacebook.trim(),
        organizerName: editContactName.trim(),
        notes: editContactNotes.trim(),
      },
      updatedAt: Date.now(),
    };

    const recalculated = recalculateAllParticipantFees(newSession);
    newSession.participants = recalculated;

    onUpdateSession(newSession);
    alert('บันทึกการตั้งค่าก๊วน การซิงก์ระบบคอร์ด และข้อมูลติดต่อเรียบร้อย');
  };

  // Copy helpers
  const handleCopyPromptPay = () => {
    const id = session.bankInfo.promptPayId;
    if (id) {
      navigator.clipboard.writeText(id.replace(/[^0-9]/g, ''));
      setCopiedPromptPay(true);
      setTimeout(() => setCopiedPromptPay(false), 2000);
    }
  };

  const handleCopyBank = () => {
    const acc = session.bankInfo.accountNumber;
    if (acc) {
      navigator.clipboard.writeText(acc);
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    }
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(String(currentAmountToPay));
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleCopyLine = () => {
    const line = session.contactInfo?.lineId;
    if (line) {
      navigator.clipboard.writeText(line);
      setCopiedLine(true);
      setTimeout(() => setCopiedLine(false), 2000);
    }
  };

  // Financial Stats
  const totalExpenses = session.totalCourtFee + session.totalShuttlecockFee;
  const totalCollected = session.participants
    .filter((p) => p.paymentStatus === 'confirmed')
    .reduce((sum, p) => sum + p.calculatedFee, 0);
  const totalPaidPendingAdmin = session.participants
    .filter((p) => p.paymentStatus === 'paid')
    .reduce((sum, p) => sum + p.calculatedFee, 0);
  const totalUnpaid = session.participants
    .filter((p) => p.paymentStatus === 'pending' || p.paymentStatus === 'rejected')
    .reduce((sum, p) => sum + p.calculatedFee, 0);

  const isFull = session.participants.length >= session.maxParticipants;

  const content = (
    <div className={`bg-white border border-neutral-200/90 rounded-3xl w-full shadow-2xl flex flex-col ${asEmbeddedView ? 'p-4 sm:p-6' : 'p-4 sm:p-6 my-auto max-h-[94vh] max-w-2xl'}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-neutral-900 text-white flex items-center justify-center text-lg font-bold shadow-xs shrink-0">
            🏸
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-neutral-900 tracking-tight">
                จัดก๊วนแบดมินตัน & หารเงิน
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isFull
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {isFull
                  ? 'ก๊วนเต็มแล้ว'
                  : `รับ ${session.participants.length}/${session.maxParticipants} คน`}
              </span>

              {/* Status Badge: Separated vs Synced */}
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                  session.syncWithCourtQueue
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                }`}
              >
                {session.syncWithCourtQueue ? (
                  <>
                    <Link2 className="w-3 h-3 text-indigo-600" />
                    <span>ซิงก์คิวคอร์ด</span>
                  </>
                ) : (
                  <>
                    <Unlink className="w-3 h-3 text-neutral-500" />
                    <span>แยกการทำงาน</span>
                  </>
                )}
              </span>

              {/* Secure Admin Indicator (No email leaked!) */}
              {isGmailAdmin && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>สิทธิ์แอดมิน</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 truncate max-w-sm sm:max-w-md">
              {session.location} · {session.date} เวลา {session.startHour}:00 - {session.endHour}:00
            </p>
          </div>
        </div>

        {!asEmbeddedView && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition touch-manipulation shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2-Hour Cancellation Rule Status Banner */}
      <div
        className={`mt-2.5 p-2.5 rounded-2xl text-xs flex items-center justify-between gap-2 border ${
          isLockedOut
            ? 'bg-rose-50/80 border-rose-200 text-rose-800'
            : 'bg-amber-50/70 border-amber-200/80 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isLockedOut ? (
            <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          )}
          <span className="font-semibold truncate">
            {isLockedOut
              ? '🔒 ล็อกรายชื่อแล้ว: ไม่สามารถลบชื่อออกได้เนื่องจากอยู่ในช่วง 2 ชม. ก่อนเริ่มจริง'
              : `⏰ กฎก๊วน: ยกเลิกรายชื่อได้ถึงเวลา ${cutoffTimeString} น. (2 ชม. ก่อนเริ่มจริง)`}
          </span>
        </div>

        <div className="text-[10px] font-mono shrink-0 hidden sm:block">
          {isLockedOut ? (
            <span className="text-rose-700 font-bold">เริ่มตี {session.startHour}:00 น.</span>
          ) : (
            <span className="text-amber-800">เหลืออีก {remainingTimeString}</span>
          )}
        </div>
      </div>

      {/* Separation / Sync Notice Banner */}
      <div className="mt-2 px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200/70 flex items-center justify-between text-[11px] text-neutral-600">
        <span className="flex items-center gap-1.5">
          {session.syncWithCourtQueue ? (
            <>
              <Link2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>
                <strong>โหมดซิงก์:</strong> รายชื่อในก๊วนจะเชื่อมต่อเข้าสู่คิวแข่งขันหน้าคอร์ด
              </span>
            </>
          ) : (
            <>
              <Unlink className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span>
                <strong>โหมดแยกอิสระ:</strong> ก๊วนแบดและระบบจัดคอร์ดทำงานแยกจากกัน ไม่แทรกคิวอัตโนมัติ
              </span>
            </>
          )}
        </span>

        {isGmailAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline shrink-0 ml-2"
          >
            ตั้งค่าซิงก์
          </button>
        )}
      </div>

      {/* Success Notification Banner */}
      {registerSuccessToast && (
        <div className="mt-2.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{registerSuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setRegisterSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-neutral-100 rounded-2xl mt-3 text-xs font-semibold shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('join')}
          className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'join'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
          <span>ลงชื่อ & บัตรสแกนจ่าย</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
            activeTab === 'roster'
              ? 'bg-white text-neutral-900 shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-indigo-600" />
          <span>รายชื่อก๊วน ({session.participants.length})</span>
          {totalPaidPendingAdmin > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>

        {isGmailAdmin ? (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`col-span-2 sm:col-span-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-indigo-600" />
            <span>ตั้งค่าก๊วน & ซิงก์คอร์ด</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setLoginError(null);
              setIsLoginModalOpen(true);
            }}
            className="col-span-2 sm:col-span-1 py-2 px-3 rounded-xl text-neutral-500 hover:text-neutral-800 transition flex items-center justify-center gap-1.5"
            title="เข้าสู่ระบบผู้จัดก๊วน"
          >
            <Lock className="w-3 h-3 text-neutral-400" />
            <span>เข้าสู่ระบบผู้จัด</span>
          </button>
        )}
      </div>

      {/* Main Tab Content */}
      <div className="overflow-y-auto flex-1 mt-3 pr-0.5 space-y-4">
        {/* ------------------------------------------------------------- */}
        {/* TAB 1: INDIVIDUAL REGISTRATION & PERSONAL PROMPTPAY CARD      */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'join' && (
          <div className="space-y-4">
            {/* Organizer Contact Summary */}
            {session.contactInfo && (session.contactInfo.phone || session.contactInfo.lineId) && (
              <div className="p-3 bg-gradient-to-r from-indigo-50/70 to-blue-50/60 rounded-2xl border border-indigo-100 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-neutral-900 block">
                      ติดต่อผู้จัดก๊วน: {session.contactInfo.organizerName || 'แอดมิน'}
                    </span>
                    {session.contactInfo.notes && (
                      <span className="text-[11px] text-neutral-500 block">
                        {session.contactInfo.notes}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {session.contactInfo.phone && (
                    <a
                      href={`tel:${session.contactInfo.phone.replace(/[^0-9]/g, '')}`}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 text-indigo-700 border border-indigo-200 font-bold flex items-center gap-1 transition shadow-2xs"
                    >
                      <Phone className="w-3 h-3 text-indigo-600" />
                      <span>โทร: {session.contactInfo.phone}</span>
                    </a>
                  )}

                  {session.contactInfo.lineId && (
                    <button
                      type="button"
                      onClick={handleCopyLine}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 transition shadow-2xs"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>{copiedLine ? 'คัดลอก Line แล้ว' : `Line: ${session.contactInfo.lineId}`}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Member Switcher */}
            <div className="p-3 bg-neutral-100/70 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-neutral-700 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>เลือกดูบัตรสแกนจ่ายของฉัน / สมาชิก:</span>
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedParticipantId(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition touch-manipulation active:scale-95 ${
                    !selectedParticipantId
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  + ลงชื่อคนใหม่
                </button>

                {session.participants.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedParticipantId(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition touch-manipulation active:scale-95 flex items-center gap-1 ${
                      selectedParticipantId === p.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="font-mono text-[10px] opacity-80">({p.calculatedFee}฿)</span>
                    {p.slipUrl && <span className="text-[10px]">📎</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* CASE A: VIEWING INDIVIDUAL MEMBER PAYMENT CARD */}
            {activeParticipant ? (
              <div className="bg-emerald-50/70 border border-emerald-300 rounded-3xl p-4 sm:p-5 text-center space-y-4 animate-in fade-in">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <QrCode className="w-6 h-6" />
                </div>

                <div>
                  <span className="text-xs text-emerald-800 font-bold uppercase tracking-wider">
                    บัตรชำระเงินรายบุคคล
                  </span>
                  <h4 className="text-2xl font-black text-neutral-900 mt-0.5">
                    {activeParticipant.name}
                  </h4>
                  <p className="text-xs text-neutral-600 mt-1">
                    ลงตี {activeParticipant.hoursPlayed} ชั่วโมง · ยอดที่ต้องชำระ{' '}
                    <strong className="text-emerald-800 font-bold text-lg font-mono">
                      {activeParticipant.calculatedFee} บาท
                    </strong>
                  </p>
                </div>

                {/* Payment Status Pill */}
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-white border border-emerald-200 shadow-xs">
                  {activeParticipant.paymentStatus === 'confirmed' ? (
                    <>
                      <CheckCheck className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-800">แอดมินยืนยันยอดเงินแล้ว</span>
                    </>
                  ) : activeParticipant.paymentStatus === 'paid' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-800">แจ้งโอนเงินแล้ว (รอแอดมินตรวจสอบสลิป)</span>
                    </>
                  ) : activeParticipant.paymentStatus === 'rejected' ? (
                    <>
                      <FileX className="w-4 h-4 text-rose-600" />
                      <span className="text-rose-700">สลิปถูกปฏิเสธ: {activeParticipant.adminRejectReason || 'กรุณาแนบใหม่'}</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                      <span className="text-amber-800">รอการชำระเงิน</span>
                    </>
                  )}
                </div>

                {/* Slip preview card if uploaded */}
                {activeParticipant.slipUrl && (
                  <div className="p-3 bg-white rounded-2xl border border-neutral-200/90 text-left flex items-center justify-between gap-3 max-w-md mx-auto">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={activeParticipant.slipUrl}
                        alt="สลิปที่แนบ"
                        className="w-10 h-10 object-cover rounded-xl border border-neutral-200 shrink-0"
                      />
                      <div className="min-w-0 text-xs">
                        <span className="font-bold text-neutral-900 block truncate">
                          แนบสลิปเรียบร้อยแล้ว
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          {activeParticipant.slipVerification?.detectedBank || 'สลิปการโอนเงิน'} ·{' '}
                          คะแนนตรวจ {activeParticipant.slipVerification?.score || 90}%
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInspectingSlipParticipant(activeParticipant)}
                      className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>ดูสลิป</span>
                    </button>
                  </div>
                )}

                {/* Actions for this individual */}
                <div className="flex flex-wrap gap-2 justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenSlipUpload(activeParticipant)}
                    className="px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition touch-manipulation active:scale-95 flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {activeParticipant.slipUrl
                        ? '📎 อัปเดต / แนบสลิปใหม่'
                        : '📎 แนบสลิปการโอนเงิน (ระบบตรวจสลิป)'}
                    </span>
                  </button>

                  {/* Manual Court Queue Button if desired */}
                  <button
                    type="button"
                    onClick={() => handleSendToQueue(activeParticipant)}
                    disabled={activeParticipant.addedToMatchQueue}
                    className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 shadow-xs transition touch-manipulation active:scale-95 flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {activeParticipant.addedToMatchQueue
                        ? 'อยู่ในคิวแข่งแล้ว'
                        : 'ส่งชื่อเข้าคิวแข่งขันหน้าคอร์ด'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedParticipantId(null)}
                    className="px-3 py-2.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-white transition"
                  >
                    + ลงชื่อคนอื่น
                  </button>
                </div>
              </div>
            ) : (
              /* CASE B: NEW INDIVIDUAL REGISTRATION FORM */
              <form
                onSubmit={handleRegisterSubmit}
                className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4"
              >
                <div className="space-y-1">
                  <h4 className="font-bold text-neutral-900 text-sm sm:text-base tracking-tight flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-600" />
                    <span>ลงชื่อสมาชิกรายบุคคล</span>
                  </h4>
                  <p className="text-xs text-neutral-500">
                    กรอกชื่อของคุณ และเลือกรอบเวลาที่ลงตีเพื่อคำนวณยอดเงินและออกบัตร QR Code
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      ชื่อของคุณ หรือ ฉายา (เช่น ต้า, อาร์ท + นัท) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="พิมพ์ชื่อของคุณ..."
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-neutral-700">
                        เลือกรอบเวลาที่ลงตี (รอบละ 1 ชั่วโมง) *
                      </label>
                      <span className="text-[11px] text-neutral-500 font-medium">
                        เลือก {selectedSlotIds.length} ชม.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {timeSlots.map((slot) => {
                        const isSelected = selectedSlotIds.includes(slot.id);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => handleToggleSlot(slot.id)}
                            className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition touch-manipulation active:scale-95 ${
                              isSelected
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                            }`}
                          >
                            <span>{slot.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      เบอร์โทรศัพท์ (ไม่บังคับ)
                    </label>
                    <input
                      type="tel"
                      placeholder="เช่น 089-xxx-xxxx"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Estimated Fee Preview */}
                <div className="p-3 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">
                      ยอดเงินโดยประมาณสำหรับ {selectedSlotIds.length} ชม.
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      คำนวณตามสูตรหารก๊วน ({session.splitMethod === 'per_hour' ? 'ตามชั่วโมงจริง' : 'หารเท่า'})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xl font-black text-emerald-800">
                      {currentEstimatedFee}
                    </span>
                    <span className="text-xs font-bold text-emerald-800 ml-1">บาท</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!userName.trim() || selectedSlotIds.length === 0 || isFull}
                  className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                >
                  {isFull ? 'ก๊วนเต็มแล้ว' : 'ยืนยันลงชื่อ & ออกบัตรสแกนจ่ายเงิน'}
                </button>
              </form>
            )}

            {/* ------------------------------------------------------------- */}
            {/* THAI QR PAYMENT / PROMPTPAY SECTION (100% BOT STANDARD)      */}
            {/* ------------------------------------------------------------- */}
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-neutral-800" />
                  <h4 className="font-bold text-neutral-900 text-sm">
                    {activeParticipant
                      ? `ช่องทางชำระเงินของ "${activeParticipant.name}"`
                      : 'ช่องทางการชำระเงิน (Thai QR PromptPay & โอนเงิน)'}
                  </h4>
                </div>
                <span className="text-[11px] text-neutral-400">สแกนจ่ายได้ทุกแอปธนาคารไทย</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* Left: Official Thai QR Payment Box */}
                <div className="flex flex-col items-center justify-center p-3 sm:p-4 bg-gradient-to-b from-[#002d62] via-[#002855] to-[#001f42] text-white rounded-3xl text-center shadow-md">
                  {/* Thai QR Banner */}
                  <div className="w-full pb-2 mb-2 border-b border-white/20 flex items-center justify-between px-2">
                    <div className="text-left">
                      <span className="text-[10px] font-bold tracking-widest uppercase block text-sky-200">
                        THAI QR PAYMENT
                      </span>
                      <span className="text-[9px] text-white/70 block">
                        พร้อมเพย์ (PromptPay)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-white/15 text-[10px] font-bold text-white">
                      BOT Standard
                    </span>
                  </div>

                  {/* QR Image Canvas Container */}
                  <div className="w-52 h-52 bg-white p-3 rounded-2xl shadow-inner flex items-center justify-center relative">
                    {qrLoading ? (
                      <div className="text-xs text-neutral-400 animate-pulse flex flex-col items-center gap-1.5">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                        <span>กำลังเจน PromptPay QR...</span>
                      </div>
                    ) : qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="PromptPay QR Code"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="text-xs text-neutral-400 p-2">
                        แอดมินยังไม่ได้ระบุเบอร์พร้อมเพย์
                      </div>
                    )}
                  </div>

                  {/* Amount Pill */}
                  <div className="mt-3 w-full bg-white/10 backdrop-blur-xs rounded-xl py-1.5 px-3 flex items-center justify-between text-xs">
                    <span className="text-white/80 text-[11px]">ยอดเงินใน QR:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-amber-300 text-sm sm:text-base">
                        {currentAmountToPay > 0 ? `${currentAmountToPay}.00` : 'ระบุยอดเอง'}
                      </span>
                      <span className="text-[11px] text-white/90">บาท</span>
                      {currentAmountToPay > 0 && (
                        <button
                          type="button"
                          onClick={handleCopyAmount}
                          className="p-1 hover:bg-white/20 rounded transition text-white/80"
                          title="คัดลอกยอดเงิน"
                        >
                          {copiedAmount ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Download QR button for mobile users */}
                  {qrDataUrl && (
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="mt-2.5 w-full py-2 px-3 rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-600" />
                      <span>📥 บันทึกรูป QR ลงเครื่อง (ไว้สแกนในแอป)</span>
                    </button>
                  )}
                </div>

                {/* Right: Bank Details & PromptPay ID with Copy buttons */}
                <div className="space-y-3">
                  {/* PromptPay Info */}
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-neutral-600">พร้อมเพย์ (PromptPay)</span>
                      <button
                        type="button"
                        onClick={handleCopyPromptPay}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                      >
                        {copiedPromptPay ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" /> คัดลอกแล้ว
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> คัดลอกเบอร์
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-base font-bold text-neutral-900 tracking-wider">
                      {formatPromptPayDisplay(session.bankInfo.promptPayId) || 'ยังไม่ระบุ'}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      ชื่อบัญชี: {session.bankInfo.promptPayName || session.bankInfo.accountName || '-'}
                    </div>
                  </div>

                  {/* Bank Transfer Info */}
                  <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-neutral-600">
                        {session.bankInfo.bankName || 'โอนผ่านธนาคาร'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyBank}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                      >
                        {copiedBank ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" /> คัดลอกแล้ว
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" /> คัดลอกเลขบัญชี
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-base font-bold text-neutral-900 tracking-wider">
                      {session.bankInfo.accountNumber || 'ยังไม่ระบุ'}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      ชื่อบัญชี: {session.bankInfo.accountName || '-'}
                    </div>
                  </div>

                  {/* Direct Attach Slip Button */}
                  {activeParticipant && (
                    <button
                      type="button"
                      onClick={() => handleOpenSlipUpload(activeParticipant)}
                      className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 flex items-center justify-center gap-1.5 transition touch-manipulation"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {activeParticipant.slipUrl ? 'ดูหรืออัปเดตสลิป' : 'แนบสลิปการโอนเงิน (ตรวจสลิปอัตโนมัติ)'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: ROSTER & ATTENDANCE (MEMBER LIST & SLIP INSPECTION)    */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'roster' && (
          <div className="space-y-4">
            {/* Financial Quick Status */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-neutral-50 border border-neutral-200/80 p-3 rounded-2xl text-center">
                <span className="text-[11px] text-neutral-500 font-medium block">
                  ค่าใช้จ่ายรวม
                </span>
                <span className="font-mono font-bold text-sm sm:text-base text-neutral-900 block mt-0.5">
                  {totalExpenses} ฿
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200/80 p-3 rounded-2xl text-center">
                <span className="text-[11px] text-emerald-700 font-medium block">
                  ยืนยันแล้ว
                </span>
                <span className="font-mono font-bold text-sm sm:text-base text-emerald-800 block mt-0.5">
                  {totalCollected} ฿
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 p-3 rounded-2xl text-center">
                <span className="text-[11px] text-amber-700 font-medium block">
                  รอตรวจ / ค้าง
                </span>
                <span className="font-mono font-bold text-sm sm:text-base text-amber-800 block mt-0.5">
                  {totalPaidPendingAdmin + totalUnpaid} ฿
                </span>
              </div>
            </div>

            {/* Sync to Court Queue Action if Synced Mode */}
            {session.syncWithCourtQueue && isGmailAdmin && (
              <div className="p-3 bg-indigo-50 border border-indigo-200/80 rounded-2xl flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-indigo-600" />
                  <span className="text-indigo-950 font-medium">
                    โหมดซิงก์เปิดอยู่: ต้องการซิงก์รายชื่อทั้งหมดเข้าสู่คิวคอร์ดหรือไม่?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSyncAllToCourtQueue}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-2xs active:scale-95"
                >
                  🔄 ซิงก์เข้าคิวคอร์ดทันที
                </button>
              </div>
            )}

            {/* Participant Roster Table */}
            <div className="space-y-2">
              {session.participants.length === 0 ? (
                <div className="text-center py-10 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200 text-neutral-400 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-neutral-300" />
                  <p className="text-xs">ยังไม่มีสมาชิกในก๊วนนี้</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('join')}
                    className="text-xs text-indigo-600 font-semibold underline"
                  >
                    + ลงชื่อคนแรก
                  </button>
                </div>
              ) : (
                session.participants.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-3 sm:p-3.5 bg-white border border-neutral-200/90 rounded-2xl flex items-center justify-between gap-2 sm:gap-3 transition hover:border-neutral-300"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-600 text-[11px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-neutral-900 truncate">
                            {p.name}
                          </span>
                          {p.phone && (
                            <span className="text-[10px] text-neutral-400 font-mono">
                              ({p.phone})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                          <span>ลงตี {p.hoursPlayed} ชม.</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-bold text-neutral-800">
                            {p.calculatedFee} บาท
                          </span>
                          {p.adminRejectReason && (
                            <span className="text-rose-600 font-medium truncate max-w-[140px]">
                              (ปฏิเสธ: {p.adminRejectReason})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {/* Slip inspect or attach */}
                      {p.slipUrl ? (
                        <button
                          type="button"
                          onClick={() => setInspectingSlipParticipant(p)}
                          className={`px-2.5 py-1 min-h-[30px] rounded-xl text-xs font-semibold border transition touch-manipulation active:scale-95 flex items-center gap-1 ${
                            p.paymentStatus === 'confirmed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>{isGmailAdmin ? 'ตรวจสลิป' : 'ดูสลิป'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenSlipUpload(p)}
                          className="px-2.5 py-1 min-h-[30px] rounded-xl text-xs font-medium text-neutral-600 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition touch-manipulation flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3 text-neutral-400" />
                          <span className="hidden sm:inline">แนบสลิป</span>
                        </button>
                      )}

                      {/* View QR Code */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedParticipantId(p.id);
                          setActiveTab('join');
                        }}
                        className="px-2.5 py-1 min-h-[30px] rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition touch-manipulation active:scale-95 flex items-center gap-1"
                        title="เปิดดู QR Code สแกนจ่ายเงินของคนนี้"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">QR จ่าย</span>
                      </button>

                      {/* Payment Status Badge */}
                      <div
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 ${
                          p.paymentStatus === 'confirmed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : p.paymentStatus === 'paid'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : p.paymentStatus === 'rejected'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {p.paymentStatus === 'confirmed' ? (
                          <>
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>ยืนยันแล้ว</span>
                          </>
                        ) : p.paymentStatus === 'paid' ? (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>รอตรวจ</span>
                          </>
                        ) : p.paymentStatus === 'rejected' ? (
                          <>
                            <FileX className="w-3.5 h-3.5" />
                            <span>ปฏิเสธ</span>
                          </>
                        ) : (
                          <span>รอชำระ</span>
                        )}
                      </div>

                      {/* Remove Button protected by 2-hour rule */}
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(p)}
                        className={`p-1.5 rounded-xl transition touch-manipulation ${
                          isLockedOut && !isGmailAdmin
                            ? 'text-neutral-300 hover:text-neutral-400 bg-neutral-50'
                            : 'text-neutral-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title={
                          isLockedOut
                            ? isGmailAdmin
                              ? 'สิทธิ์แอดมิน: บังคับลบได้'
                              : 'ล็อกรายชื่อแล้ว ไม่สามารถยกเลิกได้ (อยู่ในช่วง 2 ชม. ก่อนเริ่ม)'
                            : 'ลบรายชื่อ'
                        }
                      >
                        {isLockedOut && !isGmailAdmin ? (
                          <Lock className="w-4 h-4 text-neutral-400" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: ADMIN SETTINGS & SYNC CONFIGURATION (ADMIN ONLY)       */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'admin' && isGmailAdmin && (
          <form onSubmit={handleSaveAdminSettings} className="space-y-4 animate-in fade-in">
            {/* Admin Identity Card */}
            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/90 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-neutral-800">
                  คุณมีสิทธิ์เข้าถึงการตั้งค่าก๊วน (แอดมิน)
                </span>
              </div>
              <button
                type="button"
                onClick={handleAdminLogout}
                className="text-[11px] text-neutral-500 hover:text-rose-600 font-semibold transition"
              >
                ออกจากสิทธิ์แอดมิน
              </button>
            </div>

            {/* SYNC SETTING: SEPARATE VS SYNC WITH COURT QUEUE */}
            <div className="p-4 bg-white rounded-3xl border border-neutral-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                      editSyncWithCourtQueue
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {editSyncWithCourtQueue ? (
                      <Link2 className="w-5 h-5" />
                    ) : (
                      <Unlink className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-bold text-neutral-900 text-sm">
                      การเชื่อมต่อระหว่างก๊วนแบด กับระบบจัดคอร์ด & จัดคิว
                    </h5>
                    <p className="text-[11px] text-neutral-500">
                      แอดมินเลือกได้ว่าจะแยกการทำงานอิสระ หรือซิงก์รายชื่อสมาชิกเข้าสู่คิวคอร์ด
                    </p>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setEditSyncWithCourtQueue(!editSyncWithCourtQueue)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    editSyncWithCourtQueue ? 'bg-indigo-600' : 'bg-neutral-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      editSyncWithCourtQueue ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div
                className={`p-3 rounded-2xl border text-xs leading-relaxed ${
                  editSyncWithCourtQueue
                    ? 'bg-indigo-50/60 border-indigo-200 text-indigo-950'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                }`}
              >
                {editSyncWithCourtQueue ? (
                  <div className="space-y-1">
                    <strong className="block text-indigo-900 flex items-center gap-1">
                      🔗 โหมดเปิดซิงก์:
                    </strong>
                    <span>
                      เมื่อสมาชิกทำการลงชื่อในก๊วนนี้ รายชื่อจะถูกส่งเข้าสู่คิวผู้ท้าชิง (SmashQueue)
                      หน้าคอร์ดแข่งขันอัตโนมัติ
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <strong className="block text-neutral-900 flex items-center gap-1">
                      ✂️ โหมดแยกอิสระ (แนะนำ):
                    </strong>
                    <span>
                      ก๊วนแบดและระบบจัดคอร์ดทำงานแยกจากกัน 100% สมาชิกในก๊วนจะไม่ถูกแทรกเข้าคิวคอร์ด
                      ผู้ดูแลคอร์ดสามารถจัดคิวหน้าสนามได้อิสระตามสถานการณ์จริง
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Session Settings */}
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
              <h5 className="font-bold text-neutral-900 text-xs sm:text-sm">
                1. ข้อมูลสนาม & วันเวลา
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    ชื่อสนาม & คอร์ด
                  </label>
                  <input
                    type="text"
                    required
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    วันที่จัดก๊วน
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    จำนวนคนที่รับได้สูงสุด
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={editMaxParticipants}
                    onChange={(e) => setEditMaxParticipants(parseInt(e.target.value, 10) || 12)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    เวลาเริ่ม (น.)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={editStartHour}
                    onChange={(e) => setEditStartHour(parseInt(e.target.value, 10) || 18)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    เวลาสิ้นสุด (น.)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={editEndHour}
                    onChange={(e) => setEditEndHour(parseInt(e.target.value, 10) || 21)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Financial Calculation Settings */}
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
              <h5 className="font-bold text-neutral-900 text-xs sm:text-sm">
                2. ค่าใช้จ่าย & การหารเงิน
              </h5>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    ค่าคอร์ด/ชม. (฿)
                  </label>
                  <input
                    type="number"
                    value={editCourtHourlyRate}
                    onChange={(e) => setEditCourtHourlyRate(parseFloat(e.target.value) || 0)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    จำนวนคอร์ด
                  </label>
                  <input
                    type="number"
                    value={editCourtCount}
                    onChange={(e) => setEditCourtCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    ค่าลูกแบด/ลูก (฿)
                  </label>
                  <input
                    type="number"
                    value={editShuttlePrice}
                    onChange={(e) => setEditShuttlePrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    ประมาณการลูก
                  </label>
                  <input
                    type="number"
                    value={editShuttleCount}
                    onChange={(e) => setEditShuttleCount(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                  รูปแบบการหารค่าใช้จ่าย
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditSplitMethod('per_hour')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                      editSplitMethod === 'per_hour'
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    <span>หารตามชั่วโมงที่ลงตี</span>
                    <span className="block text-[10px] opacity-75 font-normal">
                      ตี 1 ชม. จ่าย 1 ชม. เป็นธรรม
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditSplitMethod('equal_all')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                      editSplitMethod === 'equal_all'
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    <span>หารเท่ากันทุกคน</span>
                    <span className="block text-[10px] opacity-75 font-normal">
                      เหมาจ่ายเท่ากันทั้งก๊วน
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bank Info & PromptPay Target */}
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
              <h5 className="font-bold text-neutral-900 text-xs sm:text-sm">
                3. บัญชีรับเงิน & พร้อมเพย์ (สร้าง QR สแกนจ่าย)
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    เบอร์พร้อมเพย์ (PromptPay ID) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 0891234567 หรือ เลขบัตร ปชช."
                    value={editPromptPayId}
                    onChange={(e) => setEditPromptPayId(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    ชื่อบัญชีพร้อมเพย์
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น สมชาย (ผู้จัดก๊วน)"
                    value={editPromptPayName}
                    onChange={(e) => setEditPromptPayName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    ธนาคาร (โอนปกติ)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น กสิกรไทย, SCB, กรุงไทย"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    เลขที่บัญชีธนาคาร
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น 095-x-xxxxx-x"
                    value={editAccountNumber}
                    onChange={(e) => setEditAccountNumber(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    รหัส PIN แอดมินสำหรับปลดล็อกตั้งค่าก๊วน
                  </label>
                  <input
                    type="text"
                    placeholder="ค่าเริ่มต้น 1234"
                    value={editAdminPin}
                    onChange={(e) => setEditAdminPin(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Organizer Contact Info */}
            <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
              <h5 className="font-bold text-neutral-900 text-xs sm:text-sm">
                4. ข้อมูลติดต่อผู้จัดก๊วน (แสดงให้สมาชิกเห็น)
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    ชื่อผู้จัดก๊วน (ฉายา)
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น พี่สมชาย, ต้า ผู้จัด"
                    value={editContactName}
                    onChange={(e) => setEditContactName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    เบอร์โทรศัพท์ติดต่อด่วน
                  </label>
                  <input
                    type="tel"
                    placeholder="เช่น 089-123-4567"
                    value={editContactPhone}
                    onChange={(e) => setEditContactPhone(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Line ID / OpenChat
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น @badminton71"
                    value={editContactLine}
                    onChange={(e) => setEditContactLine(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    Facebook Group / Page
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ก๊วนแบดวันอังคาร วินเนอร์"
                    value={editContactFacebook}
                    onChange={(e) => setEditContactFacebook(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-600 mb-1">
                    ข้อความแนะนำการติดต่อสำหรับผู้เล่น
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น โทรด่วนหากมีเหตุฉุกเฉินเรื่องสลิป หรือโทรแจ้งหากมาสาย"
                    value={editContactNotes}
                    onChange={(e) => setEditContactNotes(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs transition active:scale-95 touch-manipulation"
              >
                บันทึกการตั้งค่าก๊วน & ซิงก์คอร์ด
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Modal Sticky Footer */}
      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 shrink-0">
        <div className="flex items-center gap-2">
          <span>
            ยอดรวมก๊วน: <strong>{totalExpenses}฿</strong> (ยืนยันแล้ว {totalCollected}฿)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isGmailAdmin && (
            <button
              type="button"
              onClick={() => {
                setLoginError(null);
                setIsLoginModalOpen(true);
              }}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition touch-manipulation"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>เข้าสู่ระบบผู้จัด</span>
            </button>
          )}

          {!asEmbeddedView && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 min-h-[40px] rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition active:scale-95 touch-manipulation"
            >
              ปิด
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 1: SECURE ADMIN LOGIN (NO SENSITIVE DATA EXPOSED)      */}
      {/* ------------------------------------------------------------- */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-neutral-900 text-base">เข้าสู่ระบบผู้จัดก๊วน (แอดมิน)</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                กรุณาระบุรหัส PIN แอดมิน หรืออีเมลผู้ดูแลเพื่อเข้าถึงหน้าตั้งค่าและตรวจสลิป
              </p>
            </div>

            <form onSubmit={handleSecureLogin} className="space-y-3">
              {/* Clean Empty PIN input */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  รหัส PIN ผู้จัดก๊วน (Admin PIN)
                </label>
                <input
                  type="password"
                  placeholder="กรอกรหัส PIN (ค่าเริ่มต้น 1234)..."
                  value={loginPinInput}
                  onChange={(e) => setLoginPinInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 bg-neutral-50 focus:bg-white font-mono"
                  autoFocus
                />
              </div>

              <div className="relative my-2 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200"></div>
                </div>
                <span className="relative bg-white px-2 text-[10px] text-neutral-400 font-medium">
                  หรือล็อกอินด้วยอีเมลผู้ดูแล
                </span>
              </div>

              {/* Clean Empty Email input (Zero pre-filled leak!) */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  อีเมล Google ของผู้ดูแล
                </label>
                <input
                  type="email"
                  placeholder="พิมพ์อีเมล Gmail ของคุณ..."
                  value={loginEmailInput}
                  onChange={(e) => setLoginEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 bg-neutral-50 focus:bg-white"
                />
              </div>

              {loginError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition active:scale-95 touch-manipulation shadow-xs"
              >
                ยืนยันเข้าสู่ระบบ
              </button>
            </form>

            <div className="space-y-2 pt-1 border-t border-neutral-100">
              <button
                type="button"
                onClick={handleGoogleOAuthLogin}
                className="w-full py-2.5 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold text-neutral-700 flex items-center justify-center gap-2 transition"
              >
                <span>เข้าสู่ระบบด้วยบัญชี Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsLoginModalOpen(false);
                  setLoginError(null);
                  setLoginEmailInput('');
                  setLoginPinInput('');
                }}
                className="w-full py-2 rounded-xl border border-transparent text-xs font-medium text-neutral-500 hover:text-neutral-800 transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 2: SLIP UPLOAD & PRE-CHECK MODAL FOR MEMBERS           */}
      {/* ------------------------------------------------------------- */}
      {uploadingSlipParticipant && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-neutral-900 text-sm sm:text-base">
                    แนบสลิปการโอนเงิน: {uploadingSlipParticipant.name}
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    ยอดชำระ {uploadingSlipParticipant.calculatedFee} บาท · ระบบจะทำการตรวจสอบสลิปเบื้องต้น
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setUploadingSlipParticipant(null);
                  setSlipFilePreview(null);
                  setSlipVerificationData(null);
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-3">
              {/* Target Account Summary */}
              <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/80 text-xs flex items-center justify-between gap-2">
                <div>
                  <span className="text-neutral-500 block text-[10px]">บัญชีก๊วนที่ต้องโอนเข้า:</span>
                  <span className="font-bold text-neutral-800">
                    พร้อมเพย์ {session.bankInfo.promptPayId} ({session.bankInfo.promptPayName || session.bankInfo.accountName})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-500 block text-[10px]">ยอดโอนตรงตามจริง:</span>
                  <span className="font-mono text-base font-extrabold text-emerald-700">
                    {uploadingSlipParticipant.calculatedFee} ฿
                  </span>
                </div>
              </div>

              {/* Upload Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleProcessSlipFile(e.target.files[0]);
                  }
                }}
              />

              {!slipFilePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-300 hover:border-indigo-500 rounded-3xl p-6 sm:p-8 text-center cursor-pointer bg-neutral-50/50 hover:bg-indigo-50/20 transition group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 text-neutral-500 group-hover:text-indigo-600 flex items-center justify-center mx-auto mb-2 shadow-xs transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-sm text-neutral-900 block mb-0.5">
                    แตะที่นี่เพื่อเลือกรูปภาพสลิป หรือ ถ่ายภาพ
                  </span>
                  <span className="text-xs text-neutral-500 block">
                    รองรับไฟล์รูปภาพ JPEG, PNG, WebP (จากแอปธนาคาร)
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-900/5 max-h-56 flex items-center justify-center">
                    <img
                      src={slipFilePreview}
                      alt="สลิปที่เลือก"
                      className="max-h-56 w-auto object-contain mx-auto"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black text-white text-[11px] font-semibold backdrop-blur-xs flex items-center gap-1 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>เปลี่ยนรูปสลิป</span>
                    </button>
                  </div>

                  {/* Pre-Check Verification Analysis Card */}
                  {isVerifyingSlip ? (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-center space-y-2">
                      <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin mx-auto" />
                      <span className="text-xs font-semibold text-indigo-900 block">
                        ระบบกำลังวิเคราะห์สลิป ตรวจสอบ QR Code ธนาคาร และตรวจสลิปซ้ำ...
                      </span>
                    </div>
                  ) : slipVerificationData ? (
                    <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>ผลการตรวจสอบสลิปเบื้องต้น (Pre-Check System)</span>
                        </div>

                        <span
                          className={`text-xs font-extrabold px-2 py-0.5 rounded-full font-mono border ${
                            slipVerificationData.status === 'passed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : slipVerificationData.status === 'warning'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                          }`}
                        >
                          คะแนน {slipVerificationData.score}/100 ({slipVerificationData.status === 'passed' ? 'ผ่านเกณฑ์' : slipVerificationData.status === 'warning' ? 'เฝ้าระวัง' : 'น่าสงสัย'})
                        </span>
                      </div>

                      <div className="space-y-1 text-[11px]">
                        {slipVerificationData.passedChecks.map((msg, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-emerald-800">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{msg}</span>
                          </div>
                        ))}

                        {slipVerificationData.warnings.map((msg, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-amber-800 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{msg}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Note to admin */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      หมายเหตุการโอนเงิน (ไม่บังคับ)
                    </label>
                    <input
                      type="text"
                      placeholder="ระบุข้อความถึงผู้จัดก๊วน (ถ้ามี)..."
                      value={userSlipNote}
                      onChange={(e) => setUserSlipNote(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-neutral-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setUploadingSlipParticipant(null);
                  setSlipFilePreview(null);
                  setSlipVerificationData(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                disabled={!slipFilePreview || isVerifyingSlip}
                onClick={handleConfirmSubmitSlip}
                className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ยืนยันแนบสลิป & แจ้งโอนเงิน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 3: SLIP INSPECTION & ADMIN VERIFICATION MODAL          */}
      {/* ------------------------------------------------------------- */}
      {inspectingSlipParticipant && inspectingSlipParticipant.slipUrl && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95 my-auto max-h-[94vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-neutral-900 text-sm sm:text-base truncate">
                    ตรวจสลิป: {inspectingSlipParticipant.name}
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    ยอดที่ต้องชำระ: <strong className="text-emerald-700 font-mono">{inspectingSlipParticipant.calculatedFee} บาท</strong> (ลง {inspectingSlipParticipant.hoursPlayed} ชม.)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setInspectingSlipParticipant(null);
                  setIsRejectingOpen(false);
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-3">
              <div className="rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-900/5 max-h-72 flex items-center justify-center relative group">
                <img
                  src={inspectingSlipParticipant.slipUrl}
                  alt={`สลิปของ ${inspectingSlipParticipant.name}`}
                  className="max-h-72 w-auto object-contain mx-auto"
                />
                <a
                  href={inspectingSlipParticipant.slipUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black text-white text-[10px] font-semibold flex items-center gap-1 backdrop-blur-xs transition"
                >
                  <ZoomIn className="w-3 h-3" />
                  <span>ดูภาพขนาดเต็ม</span>
                </a>
              </div>

              {inspectingSlipParticipant.slipVerification && (
                <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>ผลการวิเคราะห์สลิปเบื้องต้นของระบบ:</span>
                    </span>

                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-full font-mono border ${
                        inspectingSlipParticipant.slipVerification.status === 'passed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : inspectingSlipParticipant.slipVerification.status === 'warning'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                      }`}
                    >
                      คะแนน {inspectingSlipParticipant.slipVerification.score}/100
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-neutral-200/60">
                    <div>
                      <span className="text-neutral-500 block">ธนาคารที่ตรวจพบ:</span>
                      <span className="font-semibold text-neutral-800">
                        {inspectingSlipParticipant.slipVerification.detectedBank || 'ไม่ระบุ'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">QR Code ธนาคาร:</span>
                      <span className="font-semibold text-neutral-800">
                        {inspectingSlipParticipant.slipVerification.hasQrCode
                          ? '✅ พบ QR Code ยืนยันธุรกรรม'
                          : '⚠️ ไม่พบ QR Code ในสลิป'}
                      </span>
                    </div>
                  </div>

                  {inspectingSlipParticipant.slipVerification.isDuplicateSlip && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        ⚠️ แจ้งเตือน: สลิปนี้ซ้ำกับสลิปของ "{inspectingSlipParticipant.slipVerification.duplicateMatchedName}"
                      </span>
                    </div>
                  )}
                </div>
              )}

              {inspectingSlipParticipant.slipNote && (
                <div className="p-3 bg-neutral-100/70 rounded-xl border border-neutral-200/80 text-xs">
                  <span className="font-semibold text-neutral-700 block mb-0.5">
                    ข้อความจากผู้เล่น:
                  </span>
                  <p className="text-neutral-600">{inspectingSlipParticipant.slipNote}</p>
                </div>
              )}

              {isRejectingOpen && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 animate-in fade-in">
                  <label className="block text-xs font-bold text-rose-900">
                    ระบุเหตุผลในการปฏิเสธสลิป:
                  </label>
                  <input
                    type="text"
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="เช่น ยอดเงินโอนไม่ตรง หรือ สลิปไม่ชัดเจน..."
                    className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-rose-600"
                  />
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsRejectingOpen(false)}
                      className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-600"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdminRejectSlip(inspectingSlipParticipant.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
                    >
                      ยืนยันปฏิเสธสลิป
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Decision Actions */}
            <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-xs text-neutral-500">
                สถานะปัจจุบัน:{' '}
                <strong className="text-neutral-800">
                  {inspectingSlipParticipant.paymentStatus === 'confirmed'
                    ? 'ยืนยันยอดเงินแล้ว'
                    : inspectingSlipParticipant.paymentStatus === 'paid'
                    ? 'แจ้งโอนแล้ว (รอแอดมินยืนยัน)'
                    : inspectingSlipParticipant.paymentStatus === 'rejected'
                    ? 'ถูกปฏิเสธ'
                    : 'รอชำระ'}
                </strong>
              </span>

              {isGmailAdmin ? (
                <div className="flex items-center gap-2">
                  {!isRejectingOpen && (
                    <button
                      type="button"
                      onClick={() => setIsRejectingOpen(true)}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition touch-manipulation active:scale-95"
                    >
                      ❌ ปฏิเสธสลิป
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAdminConfirmSlip(inspectingSlipParticipant.id)}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs touch-manipulation active:scale-95 flex items-center gap-1.5"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>✅ ยืนยันยอดเงินถูกต้อง</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setInspectingSlipParticipant(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-800 text-xs font-semibold"
                >
                  ปิด
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 4: 2-HOUR LOCKOUT EXPLANATION FOR REGULAR USERS        */}
      {/* ------------------------------------------------------------- */}
      {lockoutAlertModal.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-neutral-200 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-neutral-900 text-base">ไม่สามารถยกเลิกรายชื่อได้</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                ขณะนี้อยู่ในช่วง{' '}
                <strong className="text-rose-700">น้อยกว่า 2 ชั่วโมงก่อนเวลาเริ่มตีจริง</strong>{' '}
                ({session.startHour}:00 น.) ระบบได้ทำการล็อกรายชื่อตามกฎก๊วนแล้ว
                เพื่อความเป็นธรรมในค่าหารสนามและค่าลูกแบดต่อสมาชิกท่านอื่น
              </p>

              {session.contactInfo?.phone ? (
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/90 text-left space-y-1.5 text-xs">
                  <span className="font-semibold text-neutral-700 block">
                    หากมีเหตุจำเป็นฉุกเฉิน กรุณาติดต่อผู้จัดก๊วน:
                  </span>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-neutral-900 block">
                        {session.contactInfo.organizerName || 'ผู้จัดก๊วน'}
                      </span>
                      <span className="font-mono text-neutral-600">{session.contactInfo.phone}</span>
                    </div>
                    <a
                      href={`tel:${session.contactInfo.phone.replace(/[^0-9]/g, '')}`}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center gap-1 shadow-2xs"
                    >
                      <Phone className="w-3 h-3" />
                      <span>โทรออก</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="pt-2 text-[11px] text-neutral-500 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/80">
                  หากมีเหตุจำเป็นฉุกเฉิน กรุณาติดต่อผู้จัดก๊วน (แอดมิน) โดยตรง
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setLockoutAlertModal({ isOpen: false })}
              className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition"
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (asEmbeddedView) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {content}
    </div>
  );
};
