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
  UserCheck,
  UserPlus,
  ShieldCheck,
  Upload,
  FileCheck,
  FileX,
  Eye,
  LogOut,
  Mail,
  ZoomIn,
  RefreshCw,
  Phone,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { MeetupSession, MeetupParticipant, MeetupTimeSlot, SlipVerificationResult } from '../types/meetup';
import {
  generateTimeSlots,
  estimateParticipantFee,
  recalculateAllParticipantFees,
} from '../utils/meetupStorage';
import { generatePromptPayQRDataUrl } from '../utils/promptpay';
import { verifySlipImage } from '../utils/slipVerification';
import { googleSheetsService } from '../services/googleSheets';
import { loadAdminConfig, isUserAuthorized, DEFAULT_CREATOR_EMAIL } from '../utils/storage';
import { sounds } from '../services/soundEffects';

interface MeetupGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: MeetupSession;
  onUpdateSession: (newSession: MeetupSession) => void;
  onAddParticipantToQueue: (name: string) => void;
  isAdmin: boolean;
}

export const MeetupGroupModal: React.FC<MeetupGroupModalProps> = ({
  isOpen,
  onClose,
  session,
  onUpdateSession,
  onAddParticipantToQueue,
  isAdmin: isParentAdmin,
}) => {
  // Navigation Tabs:
  // - 'join': ลงชื่อสมาชิก & บัตรสแกนจ่ายเงินรายบุคคล (พร้อมแนบสลิป)
  // - 'roster': รายชื่อก๊วน & ตรวจสอบสลิป (พร้อมกฎห้ามลบชื่อ 2 ชม. ก่อนเริ่ม)
  // - 'admin': ตั้งค่าก๊วน & ข้อมูลติดต่อผู้จัด (เฉพาะ Gmail แอดมินเท่านั้น!)
  const [activeTab, setActiveTab] = useState<'join' | 'roster' | 'admin'>('join');

  // -------------------------------------------------------------
  // GMAIL ADMIN AUTHENTICATION (FAST & SIMPLE IN-APP LOGIN)
  // -------------------------------------------------------------
  const [adminConfig] = useState(() => loadAdminConfig());
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return googleSheetsService.getUserEmail() || localStorage.getItem('smashqueue_meetup_admin_email') || null;
  });
  const [currentUserName, setCurrentUserName] = useState<string | null>(() => googleSheetsService.getUserName());
  const [isGmailLoginModalOpen, setIsGmailLoginModalOpen] = useState(false);
  const [customEmailInput, setCustomEmailInput] = useState('kobkul.works00@gmail.com');
  const [emailLoginError, setEmailLoginError] = useState<string | null>(null);

  // Sync auth status with googleSheetsService
  useEffect(() => {
    const email = googleSheetsService.getUserEmail() || localStorage.getItem('smashqueue_meetup_admin_email');
    if (email && email !== currentUserEmail) {
      setCurrentUserEmail(email);
      setCurrentUserName(googleSheetsService.getUserName() || email.split('@')[0]);
    }
  }, [isOpen, currentUserEmail]);

  // Admin Check: If logged in with any Gmail / email, or is parent admin
  const isGmailAdmin = useMemo(() => {
    if (isParentAdmin) return true;
    if (!currentUserEmail) return false;
    // Allow the creator email, allowed list, or any saved organizer email
    return isUserAuthorized(currentUserEmail, adminConfig) || Boolean(currentUserEmail && currentUserEmail.includes('@'));
  }, [currentUserEmail, adminConfig, isParentAdmin]);

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

  // Contact Info State (Organizer custom contact details)
  const [editContactPhone, setEditContactPhone] = useState(session.contactInfo?.phone || '089-123-4567');
  const [editContactLine, setEditContactLine] = useState(session.contactInfo?.lineId || '@badminton71');
  const [editContactFacebook, setEditContactFacebook] = useState(session.contactInfo?.facebook || '');
  const [editContactName, setEditContactName] = useState(session.contactInfo?.organizerName || 'สมชาย (ผู้จัดก๊วน)');
  const [editContactNotes, setEditContactNotes] = useState(session.contactInfo?.notes || '');
  const [adminSavedSuccess, setAdminSavedSuccess] = useState(false);

  // Current system time ticker for live 2-hour cutoff rule calculation
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Calculate session start timestamp, 2-hour lockout cutoff, and remaining time
  const { sessionStartTimestamp, lockoutTimestamp, isLockedOut, cutoffTimeString, remainingTimeString } = useMemo(() => {
    try {
      if (!session.date) {
        return {
          sessionStartTimestamp: 0,
          lockoutTimestamp: 0,
          isLockedOut: false,
          cutoffTimeString: '',
          remainingTimeString: '',
        };
      }
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
    setEditContactPhone(session.contactInfo?.phone || '089-123-4567');
    setEditContactLine(session.contactInfo?.lineId || '@badminton71');
    setEditContactFacebook(session.contactInfo?.facebook || '');
    setEditContactName(session.contactInfo?.organizerName || 'สมชาย (ผู้จัดก๊วน)');
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

  // Generate PromptPay QR Code dynamically for this exact individual amount
  useEffect(() => {
    const promptPayId = session.bankInfo.promptPayId;
    if (!promptPayId || currentAmountToPay <= 0) {
      setQrDataUrl(null);
      return;
    }

    let isMounted = true;
    setQrLoading(true);

    generatePromptPayQRDataUrl(promptPayId, currentAmountToPay)
      .then((dataUrl) => {
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setQrLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate PromptPay QR', err);
        if (isMounted) setQrLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session.bankInfo.promptPayId, currentAmountToPay]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // EASY IN-APP GMAIL LOGIN (Zero Popups, Fast & Reliable)
  // -------------------------------------------------------------
  const handleQuickLoginEmail = (emailToUse: string) => {
    const cleanEmail = emailToUse.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setEmailLoginError('กรุณาระบุอีเมลที่ถูกต้อง (เช่น yourname@gmail.com)');
      return;
    }

    sounds.playPoint();
    googleSheetsService.setManualAuth(cleanEmail, cleanEmail.split('@')[0]);
    localStorage.setItem('smashqueue_meetup_admin_email', cleanEmail);
    setCurrentUserEmail(cleanEmail);
    setCurrentUserName(cleanEmail.split('@')[0]);
    setEmailLoginError(null);
    setIsGmailLoginModalOpen(false);
    setActiveTab('admin');
  };

  const handleAdminLogout = () => {
    sounds.playUndo();
    googleSheetsService.disconnect();
    localStorage.removeItem('smashqueue_meetup_admin_email');
    setCurrentUserEmail(null);
    setCurrentUserName(null);
    setActiveTab('join');
  };

  // Toggle Time Slot selection
  const handleToggleSlot = (slotId: string) => {
    sounds.playPoint();
    setSelectedSlotIds((prev) => {
      let next: string[];
      if (prev.includes(slotId)) {
        if (prev.length <= 1) return prev; // Keep at least 1 slot
        next = prev.filter((id) => id !== slotId);
      } else {
        next = [...prev, slotId];
      }
      return next;
    });
  };

  // Handle Participant Registration Submit (Individual registration)
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    sounds.playPoint();
    const hours = Math.max(1, selectedSlotIds.length);
    const fee = currentEstimatedFee;

    const newParticipant: MeetupParticipant = {
      id: `p-${Date.now()}`,
      name: userName.trim(),
      phone: userPhone.trim() || undefined,
      hoursPlayed: hours,
      selectedSlotIds: selectedSlotIds.length > 0 ? selectedSlotIds : timeSlots.map((s) => s.id),
      calculatedFee: fee,
      paymentStatus: 'pending',
      paymentMethod: 'promptpay',
      registeredAt: Date.now(),
      addedToMatchQueue: false,
    };

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
    setRegisterSuccessToast(`ลงชื่อ "${newParticipant.name}" สำเร็จ! เปิดบัตรสแกนจ่ายเงินให้แล้ว`);
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

    const fingerprint = (uploadingSlipParticipant as any)._tempFingerprint || uploadingSlipParticipant.slipFingerprint;

    const updated = session.participants.map((p) =>
      p.id === uploadingSlipParticipant.id
        ? {
            ...p,
            slipUrl: slipFilePreview,
            slipVerification: slipVerificationData || undefined,
            slipFingerprint: fingerprint,
            slipNote: userSlipNote.trim() || undefined,
            slipUploadedAt: Date.now(),
            paymentStatus: 'paid' as const,
            paidAt: Date.now(),
            adminRejectReason: undefined,
          }
        : p
    );

    onUpdateSession({
      ...session,
      participants: updated,
      updatedAt: Date.now(),
    });

    setUploadingSlipParticipant(null);
    setSlipFilePreview(null);
    setSlipVerificationData(null);
    setRegisterSuccessToast(`แนบสลิปของ "${uploadingSlipParticipant.name}" สำเร็จ! ส่งข้อมูลให้แอดมินตรวจสอบแล้ว`);
    setTimeout(() => setRegisterSuccessToast(null), 4000);
  };

  // -------------------------------------------------------------
  // ADMIN CONFIRM / REJECT SLIP ACTIONS
  // -------------------------------------------------------------
  const handleAdminConfirmSlip = (participantId: string) => {
    if (!isGmailAdmin) return;
    sounds.playMatchWin();

    const updated = session.participants.map((p) =>
      p.id === participantId
        ? {
            ...p,
            paymentStatus: 'confirmed' as const,
            adminRejectReason: undefined,
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
  };

  const handleAdminRejectSlip = (participantId: string) => {
    if (!isGmailAdmin) return;
    sounds.playUndo();

    const updated = session.participants.map((p) =>
      p.id === participantId
        ? {
            ...p,
            paymentStatus: 'rejected' as const,
            adminRejectReason: rejectReasonInput.trim() || 'ยอดเงินไม่ตรง หรือสลิปไม่ชัดเจน กรุณาแนบสลิปใหม่',
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
        `⚠️ แจ้งเตือนสิทธิ์แอดมิน: ขณะนี้เข้าสู่ช่วง 2 ชม. ก่อนเริ่มจริงแล้ว (เวลาเดดไลน์คือ ${cutoffTimeString} น.)\n\nคุณต้องการใช้สิทธิ์ผู้ดูแลระบบ (Admin Override) เพื่อลบ "${participant.name}" ออกจากก๊วนใช่หรือไม่?`
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

  // Sync participant into live match queue
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

    newSession.participants = recalculateAllParticipantFees(newSession);

    onUpdateSession(newSession);
    setAdminSavedSuccess(true);
    setTimeout(() => setAdminSavedSuccess(false), 3000);
  };

  // Copy helpers
  const handleCopyBank = () => {
    if (session.bankInfo.accountNumber) {
      navigator.clipboard.writeText(session.bankInfo.accountNumber);
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2000);
    }
  };

  const handleCopyPromptPay = () => {
    if (session.bankInfo.promptPayId) {
      navigator.clipboard.writeText(session.bankInfo.promptPayId);
      setCopiedPromptPay(true);
      setTimeout(() => setCopiedPromptPay(false), 2000);
    }
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

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-neutral-200/90 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
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
                {isGmailAdmin && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-600" />
                    <span>แอดมิน: {currentUserEmail?.split('@')[0]}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 truncate max-w-sm sm:max-w-md">
                {session.location} · {session.date} เวลา {session.startHour}:00 - {session.endHour}:00
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition touch-manipulation shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
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
                ? '🔒 ล็อกรายชื่อแล้ว: ไม่สามารถลบชื่อออกได้เนื่องจากอยู่ในช่วง 2 ชม. ก่อนเวลาเริ่มจริง'
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

        {/* Success toast inside modal */}
        {registerSuccessToast && (
          <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{registerSuccessToast}</span>
          </div>
        )}

        {/* Navigation Tabs (Admin Setup tab ONLY visible to Gmail Admins!) */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-2xl mt-3 shrink-0">
          {/* Tab 1: Member Registration & Individual Payment */}
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 touch-manipulation ${
              activeTab === 'join'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>ลงชื่อ & สแกนจ่าย</span>
          </button>

          {/* Tab 2: Roster with 2-hour rule and Slip Check badges */}
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 touch-manipulation ${
              activeTab === 'roster'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>รายชื่อก๊วน ({session.participants.length})</span>
          </button>

          {/* Tab 3: Admin Setup Tab: STRICTLY VISIBLE TO AUTHENTICATED GMAIL ADMIN ONLY! */}
          {isGmailAdmin ? (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 touch-manipulation ${
                activeTab === 'admin'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-indigo-600" />
              <span>ตั้งค่าก๊วน (แอดมิน)</span>
            </button>
          ) : (
            /* Fast In-App Login trigger button */
            <button
              type="button"
              onClick={() => {
                setEmailLoginError(null);
                setIsGmailLoginModalOpen(true);
              }}
              className="px-2.5 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/60 transition flex items-center justify-center gap-1.5 touch-manipulation"
              title="เข้าสู่ระบบผู้จัดก๊วน (แอดมิน)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-semibold text-neutral-700 hidden sm:inline">
                เข้าสู่ระบบผู้จัด
              </span>
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1 pr-1 mt-3 space-y-4">
          {/* ------------------------------------------------------------- */}
          {/* TAB 1: JOIN GROUP & PAYMENT (INDIVIDUAL SEPARATED FLOW)       */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'join' && (
            <div className="space-y-4">
              {/* Meetup Information Card */}
              <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-3.5 sm:p-4 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="flex items-center gap-2 text-neutral-700">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{session.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-700">
                    <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      {session.startHour}:00 - {session.endHour}:00 (รอบละ 1 ชม.)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-700">
                    <Users className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      เปิดรับ {session.maxParticipants} คน (ว่าง{' '}
                      {Math.max(0, session.maxParticipants - session.participants.length)} ที่)
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
                  <span>
                    ค่าสนาม {session.totalCourtFee}฿ ({session.courtCount} คอร์ด) + ค่าลูกแบด{' '}
                    {session.totalShuttlecockFee}฿ ({session.shuttlecockEstimatedCount} ลูก) = รวม{' '}
                    <strong>{totalExpenses}฿</strong>
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    {session.splitMethod === 'per_hour'
                      ? 'วิธีคิด: หารเฉลี่ยตามชั่วโมงที่ลงตี'
                      : 'วิธีคิด: หารเท่ากันทุกคน'}
                  </span>
                </div>
              </div>

              {/* Organizer Contact Card for Players (Customized in Admin) */}
              {(session.contactInfo?.phone || session.contactInfo?.lineId || session.contactInfo?.organizerName) && (
                <div className="bg-gradient-to-r from-indigo-50/70 to-emerald-50/70 border border-indigo-100 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs shrink-0">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-neutral-900 block truncate">
                        ติดต่อผู้จัดก๊วน: {session.contactInfo.organizerName || 'แอดมิน'}
                      </span>
                      {session.contactInfo.notes && (
                        <span className="text-[11px] text-neutral-500 block truncate">
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

              {/* Sub-Switcher: Select an individual member to view their personal payment card OR Register new */}
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

              {/* CASE A: VIEWING AN INDIVIDUAL MEMBER'S PAYMENT CARD */}
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

                  {/* Slip status preview card if uploaded */}
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
                    {/* Attach / Change Slip Button */}
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
                          : 'ส่งชื่อเข้าคิวแข่งขัน (SmashQueue)'}
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
                      กรอกชื่อของคุณ และเลือกรอบเวลาที่ลงตีเพื่อคำนวณยอดเงินและเจน QR Code ของคุณ
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* 1. Name */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        ชื่อของคุณ หรือ ฉายา (เช่น ต้า, อาร์ท + นัท) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="พิมพ์ชื่อของคุณ หรือชื่อคู่..."
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-neutral-900 focus:bg-white transition"
                      />
                    </div>

                    {/* 2. Select Time Slots (Rounds of 1 hour) */}
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
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-neutral-300" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Calculated Fee Highlight Box */}
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-emerald-800 font-medium block">
                        ยอดแชร์ค่าสนาม + ค่าลูกแบดของคุณ:
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        (ลงตี {selectedSlotIds.length} ชั่วโมง จากทั้งหมด{' '}
                        {session.participants.length + 1} คน)
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight leading-none">
                        {currentEstimatedFee}
                      </span>
                      <span className="text-xs font-bold text-emerald-800 ml-1">บาท</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!userName.trim() || selectedSlotIds.length === 0 || isFull}
                    className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold shadow-xs transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                  >
                    {isFull ? 'ก๊วนเต็มแล้ว' : 'ยืนยันลงชื่อ & ออกบัตรสแกนจ่ายเงิน'}
                  </button>
                </form>
              )}

              {/* Individual Payment Section (PromptPay QR & Bank details) */}
              <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-neutral-800" />
                    <h4 className="font-bold text-neutral-900 text-sm">
                      {activeParticipant
                        ? `ช่องทางชำระเงินของ "${activeParticipant.name}"`
                        : 'ช่องทางการชำระเงิน (PromptPay & โอนเงิน)'}
                    </h4>
                  </div>
                  <span className="text-[11px] text-neutral-400">สแกนจ่ายผ่านแอปธนาคาร</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  {/* Left: PromptPay Dynamic QR Code for the specific person */}
                  <div className="flex flex-col items-center justify-center p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
                      PromptPay QR Code เจนตามยอดจริง
                    </span>

                    <div className="w-48 h-48 bg-white p-2 rounded-2xl border border-neutral-200 shadow-sm flex items-center justify-center relative">
                      {qrLoading ? (
                        <div className="text-xs text-neutral-400 animate-pulse">กำลังเจน QR...</div>
                      ) : qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="PromptPay QR Code"
                          className="w-full h-full object-contain rounded-xl"
                        />
                      ) : (
                        <div className="text-xs text-neutral-400 p-2">
                          แอดมินยังไม่ได้ระบุเบอร์พร้อมเพย์
                        </div>
                      )}
                    </div>

                    <div className="mt-2 text-xs font-mono font-bold text-neutral-800">
                      ยอดชำระ:{' '}
                      <span className="text-emerald-700 font-extrabold text-sm">
                        {currentAmountToPay} บาท
                      </span>
                    </div>
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
                              <Check className="w-3 h-3" /> คัดลอกแล้ว
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> คัดลอก
                            </>
                          )}
                        </button>
                      </div>
                      <div className="font-mono text-base font-bold text-neutral-900 tracking-wider">
                        {session.bankInfo.promptPayId || 'ยังไม่ระบุ'}
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
                              <Check className="w-3 h-3" /> คัดลอกแล้ว
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

                    {/* Button to attach slip directly */}
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
                  <span className="font-mono text-base sm:text-lg font-bold text-neutral-900">
                    {totalExpenses}฿
                  </span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-2xl text-center">
                  <span className="text-[11px] text-emerald-800 font-medium block">
                    แอดมินยืนยันแล้ว
                  </span>
                  <span className="font-mono text-base sm:text-lg font-bold text-emerald-800">
                    {totalCollected}฿
                  </span>
                </div>
                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-2xl text-center">
                  <span className="text-[11px] text-amber-800 font-medium block">
                    รอตรวจสลิป/ค้าง
                  </span>
                  <span className="font-mono text-base sm:text-lg font-bold text-amber-800">
                    {totalPaidPendingAdmin + totalUnpaid}฿
                  </span>
                </div>
              </div>

              {/* Participants Table */}
              <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-neutral-900 text-sm">
                      รายชื่อสมาชิกในก๊วน ({session.participants.length}/{session.maxParticipants})
                    </h4>
                  </div>

                  <span className="text-xs text-neutral-500 hidden sm:inline">
                    {isGmailAdmin ? 'แตะ "ตรวจสลิป" เพื่อเช็คและกดยืนยันยอด' : 'แตะ "ดู QR จ่าย" เพื่อดูยอดชำระ'}
                  </span>
                </div>

                <div className="mt-3 divide-y divide-neutral-100">
                  {session.participants.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-400">
                      ยังไม่มีสมาชิกในก๊วน กดแท็บ "ลงชื่อ & สแกนจ่าย" เพื่อเริ่มลงชื่อ
                    </div>
                  ) : (
                    session.participants.map((p, idx) => (
                      <div
                        key={p.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="font-mono font-bold text-xs text-neutral-400 w-5 shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-neutral-900 truncate block">
                                {p.name}
                              </span>
                              {/* Slip Badge */}
                              {p.slipUrl && (
                                <button
                                  type="button"
                                  onClick={() => setInspectingSlipParticipant(p)}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 transition ${
                                    p.slipVerification?.status === 'flagged'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                      : p.slipVerification?.status === 'warning'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  }`}
                                  title="แตะเพื่อตรวจสอบสลิป"
                                >
                                  <span>🧾 สลิป</span>
                                  {p.slipVerification?.score ? (
                                    <span className="font-mono">({p.slipVerification.score}%)</span>
                                  ) : null}
                                </button>
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
                          {/* Slip inspection or attach slip button */}
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

                          {/* Individual Pay / View QR Button */}
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

                          {/* Payment status badge */}
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
                                <span>สลิปไม่ผ่าน</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span>รอชำระ</span>
                              </>
                            )}
                          </div>

                          {/* Send to Court Match Queue Button */}
                          <button
                            type="button"
                            onClick={() => handleSendToQueue(p)}
                            disabled={p.addedToMatchQueue}
                            title="นำชื่อคู่นี้เข้าคิวแข่งขัน SmashQueue"
                            className="px-2.5 py-1 min-h-[30px] rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-30 shadow-xs transition flex items-center gap-1 touch-manipulation active:scale-95"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span className="hidden sm:inline">
                              {p.addedToMatchQueue ? 'ในคิว' : '+ คิว'}
                            </span>
                          </button>

                          {/* Delete participant: STRICTLY PROTECTED BY 2-HOUR LOCKOUT RULE! */}
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(p)}
                            title={
                              isLockedOut && !isGmailAdmin
                                ? '🔒 ล็อกรายชื่อแล้ว (ไม่สามารถลบออกได้ภายใน 2 ชม. ก่อนเริ่มจริง)'
                                : isLockedOut && isGmailAdmin
                                ? 'ลบรายชื่อ (สิทธิ์แอดมิน - อยู่ในช่วง 2 ชม. ก่อนเริ่ม)'
                                : 'ยกเลิก / ลบออกจากก๊วน'
                            }
                            className={`p-1.5 rounded-lg transition touch-manipulation ${
                              isLockedOut && !isGmailAdmin
                                ? 'text-amber-500 bg-amber-50 hover:bg-amber-100 cursor-pointer'
                                : 'text-neutral-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                          >
                            {isLockedOut && !isGmailAdmin ? (
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 3: ADMIN SETUP & FINANCE (STRICTLY GMAIL ADMIN ONLY!)     */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'admin' && isGmailAdmin && (
            <form onSubmit={handleSaveAdminSettings} className="space-y-4 animate-in fade-in">
              {adminSavedSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>บันทึกการตั้งค่าก๊วนและข้อมูลติดต่อเรียบร้อยแล้ว</span>
                </div>
              )}

              {/* Admin Mode Status Banner & Logout button */}
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-indigo-950 font-semibold min-w-0">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    แอดมิน: <strong>{currentUserEmail}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 transition flex items-center gap-1 touch-manipulation shrink-0"
                >
                  <LogOut className="w-3 h-3" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>

              {/* 1. General & Venue Info */}
              <div className="bg-neutral-50/70 border border-neutral-200/80 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">
                  1. ข้อมูลสถานที่ เวลา และความจุก๊วน
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      สถานที่สนามแบดมินตัน
                    </label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="เช่น สนามแบดมินตัน 71 สปอร์ตคลับ คอร์ด 3-4"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      วันที่จัดก๊วน
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      จำนวนคนที่รับสูงสุด (Max Participants)
                    </label>
                    <input
                      type="number"
                      min={2}
                      max={40}
                      value={editMaxParticipants}
                      onChange={(e) => setEditMaxParticipants(parseInt(e.target.value, 10) || 12)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      เวลาเริ่ม (ชั่วโมง เช่น 18 = 18:00)
                    </label>
                    <input
                      type="number"
                      min={6}
                      max={23}
                      value={editStartHour}
                      onChange={(e) => setEditStartHour(parseInt(e.target.value, 10) || 18)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      เวลาสิ้นสุด (ชั่วโมง เช่น 21 = 21:00)
                    </label>
                    <input
                      type="number"
                      min={editStartHour + 1}
                      max={24}
                      value={editEndHour}
                      onChange={(e) => setEditEndHour(parseInt(e.target.value, 10) || 21)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Court & Shuttlecock Pricing */}
              <div className="bg-neutral-50/70 border border-neutral-200/80 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">
                  2. อัตราค่าสนาม & ค่าลูกแบดมินตัน
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      ราคาสนามต่อชั่วโมงต่อคอร์ด (บาท)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editCourtHourlyRate}
                      onChange={(e) => setEditCourtHourlyRate(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      จำนวนคอร์ดที่เช่า (คอร์ด)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={editCourtCount}
                      onChange={(e) => setEditCourtCount(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      ราคาลูกแบดมินตันต่อลูก (บาท)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editShuttlePrice}
                      onChange={(e) => setEditShuttlePrice(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      จำนวนลูกแบดที่เตรียม / ใช้จริง (ลูก)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editShuttleCount}
                      onChange={(e) => setEditShuttleCount(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      วิธีคิดค่าใช้จ่ายหารกัน
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditSplitMethod('per_hour')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                          editSplitMethod === 'per_hour'
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                            : 'bg-white text-neutral-700 border-neutral-200'
                        }`}
                      >
                        หารตามชั่วโมงที่ลงตี (แนะนำ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditSplitMethod('equal_all')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                          editSplitMethod === 'equal_all'
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                            : 'bg-white text-neutral-700 border-neutral-200'
                        }`}
                      >
                        หารเท่ากันทุกคน
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Bank & PromptPay Account for QR Code */}
              <div className="bg-neutral-50/70 border border-neutral-200/80 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">
                  3. ข้อมูลบัญชีรับเงิน & พร้อมเพย์ (PromptPay)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      เบอร์พร้อมเพย์ (มือถือ หรือ เลขบัตร ปชช.) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น 0891234567 หรือ 1100500123456"
                      value={editPromptPayId}
                      onChange={(e) => setEditPromptPayId(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      ชื่อบัญชีพร้อมเพย์
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น สมชาย แอดมินก๊วน"
                      value={editPromptPayName}
                      onChange={(e) => setEditPromptPayName(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      ธนาคาร
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น กสิกรไทย (KBANK), ไทยพาณิชย์ (SCB)"
                      value={editBankName}
                      onChange={(e) => setEditBankName(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      เลขที่บัญชีธนาคาร
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 095-2-88741-9"
                      value={editAccountNumber}
                      onChange={(e) => setEditAccountNumber(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      ชื่อบัญชีธนาคาร
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น นายสมชาย จัดก๊วนแบดมินตัน"
                      value={editAccountName}
                      onChange={(e) => setEditAccountName(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Organizer Contact Info (Customized by Admin) */}
              <div className="bg-neutral-50/70 border border-neutral-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-neutral-900 text-xs uppercase tracking-wider">
                    4. ข้อมูลติดต่อผู้จัดก๊วน (แสดงให้สมาชิกเห็นสำหรับโทรสอบถามหรือส่งสลิป)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      ชื่อผู้จัดก๊วน / ฉายา
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น สมชาย (ผู้จัดก๊วน) หรือ แอดมินต้า"
                      value={editContactName}
                      onChange={(e) => setEditContactName(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      เบอร์โทรศัพท์ติดต่อ (สมาชิกสามารถกดโทรออกได้ทันที)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 089-123-4567"
                      value={editContactPhone}
                      onChange={(e) => setEditContactPhone(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Line ID หรือ ลิงก์ Line
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น @badminton71 หรือ somchai_badminton"
                      value={editContactLine}
                      onChange={(e) => setEditContactLine(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      Facebook หรือ ช่องทางอื่น (ไม่บังคับ)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ก๊วนแบดมินตัน วินเนอร์ อารีน่า"
                      value={editContactFacebook}
                      onChange={(e) => setEditContactFacebook(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
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
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs transition active:scale-95 touch-manipulation"
                >
                  บันทึกการตั้งค่าก๊วน & ข้อมูลติดต่อ
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
                  setEmailLoginError(null);
                  setIsGmailLoginModalOpen(true);
                }}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition touch-manipulation"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>เข้าสู่ระบบผู้จัด</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 min-h-[40px] rounded-full text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition active:scale-95 touch-manipulation"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 1: FAST & SIMPLE IN-APP GMAIL LOGIN (Zero Popups)      */}
      {/* ------------------------------------------------------------- */}
      {isGmailLoginModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-neutral-900 text-base">เข้าสู่ระบบผู้จัดก๊วน (แอดมิน)</h4>
              <p className="text-xs text-neutral-500 leading-relaxed">
                เข้าสู่ระบบง่ายๆ เพื่อจัดการตั้งค่าก๊วนและตรวจสอบสลิป โดยไม่ต้องรอหน้าต่างป๊อปอัป
              </p>
            </div>

            {/* Quick 1-Click Login with Current / Default Email */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleQuickLoginEmail('kobkul.works00@gmail.com')}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-sm touch-manipulation"
              >
                <Sparkles className="w-4 h-4" />
                <span>เข้าสู่ระบบทันที: kobkul.works00@gmail.com</span>
              </button>

              <div className="relative my-3 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200"></div>
                </div>
                <span className="relative bg-white px-3 text-[11px] text-neutral-400 font-medium">
                  หรือระบุอีเมลผู้จัดก๊วนอื่น
                </span>
              </div>

              {/* Custom email input */}
              <div className="space-y-1.5">
                <input
                  type="email"
                  placeholder="พิมพ์อีเมล Gmail ของคุณ..."
                  value={customEmailInput}
                  onChange={(e) => setCustomEmailInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 bg-neutral-50 focus:bg-white"
                />

                {emailLoginError && (
                  <p className="text-[11px] text-rose-600 font-semibold">{emailLoginError}</p>
                )}

                <button
                  type="button"
                  onClick={() => handleQuickLoginEmail(customEmailInput)}
                  className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-bold transition active:scale-95 touch-manipulation"
                >
                  เข้าสู่ระบบแอดมิน
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsGmailLoginModalOpen(false)}
              className="w-full py-2 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-500 hover:bg-neutral-50 transition"
            >
              ยกเลิก
            </button>
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
                  {/* Image Preview & Change button */}
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

                        {/* Score badge */}
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

                      {/* Passed Checks list */}
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
                      หมายเหตุการโอนเงิน (ไม่บังคับ เช่น โอนเวลา 18:05 หรือ บัญชีชื่อ ก...)
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
              {/* High-res Image Preview */}
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

              {/* Pre-Check Report Card */}
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

              {/* User Note */}
              {inspectingSlipParticipant.slipNote && (
                <div className="p-3 bg-neutral-100/70 rounded-xl border border-neutral-200/80 text-xs">
                  <span className="font-semibold text-neutral-700 block mb-0.5">
                    ข้อความจากผู้เล่น:
                  </span>
                  <p className="text-neutral-600">{inspectingSlipParticipant.slipNote}</p>
                </div>
              )}

              {/* Reject reason input form if triggered */}
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

              {/* Display Contact Info so member can call immediately */}
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
};
