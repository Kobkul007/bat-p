import React, { useState, useEffect, useMemo } from 'react';
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
  Unlock,
  AlertTriangle,
  UserCheck,
  UserPlus,
  KeyRound,
  ShieldCheck,
  Calendar,
  DollarSign,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { MeetupSession, MeetupParticipant, MeetupTimeSlot } from '../types/meetup';
import {
  generateTimeSlots,
  estimateParticipantFee,
  recalculateAllParticipantFees,
} from '../utils/meetupStorage';
import { generatePromptPayQRDataUrl } from '../utils/promptpay';
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
  // - 'join': ลงชื่อสมาชิก & บัตรสแกนจ่ายเงินรายบุคคล
  // - 'roster': รายชื่อก๊วน & จัดการคิว (พร้อมกฎห้ามลบชื่อ 2 ชม. ก่อนเริ่ม)
  // - 'admin': ตั้งค่าก๊วน & การเงิน (เฉพาะแอดมินเท่านั้น!)
  const [activeTab, setActiveTab] = useState<'join' | 'roster' | 'admin'>('join');

  // Admin session authentication state:
  // Can be authorized via parent (Google OAuth / Admin config) OR via Admin PIN entry
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    if (isParentAdmin) return true;
    try {
      return sessionStorage.getItem('smashqueue_meetup_admin_auth') === 'true';
    } catch {
      return false;
    }
  });

  // Sync if parent prop changes
  useEffect(() => {
    if (isParentAdmin) {
      setIsAdminUnlocked(true);
    }
  }, [isParentAdmin]);

  // Admin PIN prompt modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Lockout explanation modal for regular users trying to delete inside 2 hours
  const [lockoutAlertModal, setLockoutAlertModal] = useState<{
    isOpen: boolean;
    participantName?: string;
  }>({ isOpen: false });

  // Selected participant for viewing individual payment card
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

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
  const [adminSavedSuccess, setAdminSavedSuccess] = useState(false);

  // Current system time ticker for live 2-hour cutoff rule calculation
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Enforce admin-only access for 'admin' tab:
  // If user is not unlocked as admin and somehow enters 'admin' tab, force back to 'join'
  useEffect(() => {
    if (!isAdminUnlocked && activeTab === 'admin') {
      setActiveTab('join');
    }
  }, [isAdminUnlocked, activeTab]);

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
    setEditAdminPin(session.adminPin || '1234');
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

  // Handle Admin PIN verification
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPin = session.adminPin || '1234';
    if (pinInput.trim() === correctPin.trim()) {
      sounds.playPoint();
      setIsAdminUnlocked(true);
      try {
        sessionStorage.setItem('smashqueue_meetup_admin_auth', 'true');
      } catch {
        // ignore
      }
      setIsPinModalOpen(false);
      setPinInput('');
      setPinError('');
      setActiveTab('admin');
    } else {
      sounds.playUndo();
      setPinError('รหัส PIN ไม่ถูกต้อง (ค่าเริ่มต้นคือ 1234)');
    }
  };

  // Lock Admin Mode
  const handleLockAdmin = () => {
    sounds.playUndo();
    setIsAdminUnlocked(false);
    try {
      sessionStorage.removeItem('smashqueue_meetup_admin_auth');
    } catch {
      // ignore
    }
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

  // Mark individual participant as paid
  const handleMarkAsPaid = (participantId: string) => {
    sounds.playPoint();
    const updated = session.participants.map((p) =>
      p.id === participantId
        ? {
            ...p,
            paymentStatus: 'paid' as const,
            paidAt: Date.now(),
          }
        : p
    );

    onUpdateSession({
      ...session,
      participants: updated,
      updatedAt: Date.now(),
    });
  };

  // Admin confirm/toggle payment
  const handleConfirmPayment = (participantId: string) => {
    if (!isAdminUnlocked) return;
    sounds.playPoint();
    const updated = session.participants.map((p) =>
      p.id === participantId
        ? {
            ...p,
            paymentStatus: (p.paymentStatus === 'confirmed' ? 'paid' : 'confirmed') as any,
          }
        : p
    );
    onUpdateSession({
      ...session,
      participants: updated,
      updatedAt: Date.now(),
    });
  };

  // Remove participant with strict 2-hour rule protection
  const handleRemoveParticipant = (participant: MeetupParticipant) => {
    // RULE ENFORCEMENT: Cannot remove name 2 hours before actual session start!
    if (isLockedOut && !isAdminUnlocked) {
      setLockoutAlertModal({
        isOpen: true,
        participantName: participant.name,
      });
      return;
    }

    if (isLockedOut && isAdminUnlocked) {
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

  // Admin Save Settings
  const handleSaveAdminSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminUnlocked) return;
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
      bankInfo: {
        bankName: editBankName.trim(),
        accountNumber: editAccountNumber.trim(),
        accountName: editAccountName.trim(),
        promptPayId: editPromptPayId.trim(),
        promptPayName: editPromptPayName.trim(),
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

  // Financial Stats
  const totalExpenses = session.totalCourtFee + session.totalShuttlecockFee;
  const totalCollected = session.participants
    .filter((p) => p.paymentStatus === 'paid' || p.paymentStatus === 'confirmed')
    .reduce((sum, p) => sum + p.calculatedFee, 0);
  const totalPending = session.participants
    .filter((p) => p.paymentStatus === 'pending')
    .reduce((sum, p) => sum + p.calculatedFee, 0);

  const isFull = session.participants.length >= session.maxParticipants;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
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
                {isAdminUnlocked && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-indigo-600" />
                    <span>โหมดแอดมิน</span>
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

        {/* Navigation Tabs (Admin Setup tab ONLY visible to Admins!) */}
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

          {/* Tab 2: Roster with 2-hour rule */}
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

          {/* Tab 3: Admin Setup Tab: STRICTLY VISIBLE TO AUTHENTICATED ADMIN ONLY! */}
          {isAdminUnlocked ? (
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
            /* Discreet Admin Unlock button for the organizer */
            <button
              type="button"
              onClick={() => {
                setPinInput('');
                setPinError('');
                setIsPinModalOpen(true);
              }}
              className="px-2.5 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition flex items-center justify-center gap-1 touch-manipulation"
              title="เข้าสู่ระบบผู้จัดก๊วนเพื่อตั้งค่า (ใส่รหัส PIN)"
            >
              <Lock className="w-3 h-3 text-neutral-400" />
              <span className="hidden sm:inline text-[11px]">แอดมิน</span>
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
                        <span className="text-emerald-800">แจ้งโอนเงินแล้ว (รอแอดมินตรวจสอบ)</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                        <span className="text-amber-800">รอการชำระเงิน</span>
                      </>
                    )}
                  </div>

                  {/* Actions for this individual */}
                  <div className="flex flex-wrap gap-2 justify-center pt-1">
                    {activeParticipant.paymentStatus === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsPaid(activeParticipant.id)}
                        className="px-5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition touch-manipulation active:scale-95"
                      >
                        ✓ แจ้งโอนเงินแล้ว ({activeParticipant.calculatedFee}฿)
                      </button>
                    )}

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

                    <p className="text-[11px] text-neutral-400">
                      เมื่อโอนเงินเสร็จแล้ว สามารถกดปุ่ม "แจ้งโอนเงินแล้ว" เพื่อให้แอดมินยืนยันยอด
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* TAB 2: ROSTER & ATTENDANCE (MEMBER LIST & 2-HR LOCKOUT)       */}
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
                    เก็บเงินได้แล้ว
                  </span>
                  <span className="font-mono text-base sm:text-lg font-bold text-emerald-800">
                    {totalCollected}฿
                  </span>
                </div>
                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-2xl text-center">
                  <span className="text-[11px] text-amber-800 font-medium block">
                    ค้างชำระ
                  </span>
                  <span className="font-mono text-base sm:text-lg font-bold text-amber-800">
                    {totalPending}฿
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
                    แตะ "ดู QR จ่าย" เพื่อดูยอดชำระรายบุคคล
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
                            <span className="font-bold text-sm text-neutral-900 truncate block">
                              {p.name}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                              <span>ลงตี {p.hoursPlayed} ชม.</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono font-bold text-neutral-800">
                                {p.calculatedFee} บาท
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status & Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
                            <span className="hidden sm:inline">ดู QR จ่าย</span>
                          </button>

                          {/* Payment status badge / toggle (Admin can toggle confirm) */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isAdminUnlocked) {
                                handleConfirmPayment(p.id);
                              } else if (p.paymentStatus === 'pending') {
                                handleMarkAsPaid(p.id);
                              }
                            }}
                            title={
                              isAdminUnlocked
                                ? 'คลิกเพื่อยืนยันยอดเงิน (แอดมิน)'
                                : p.paymentStatus === 'pending'
                                ? 'คลิกเพื่อแจ้งโอนเงิน'
                                : 'สถานะการชำระเงิน'
                            }
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition touch-manipulation active:scale-95 flex items-center gap-1 ${
                              p.paymentStatus === 'confirmed'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : p.paymentStatus === 'paid'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
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
                                <Check className="w-3.5 h-3.5" />
                                <span>แจ้งโอนแล้ว</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                <span>รอชำระ</span>
                              </>
                            )}
                          </button>

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
                              {p.addedToMatchQueue ? 'ในคิวแล้ว' : '+ คิวแข่ง'}
                            </span>
                          </button>

                          {/* Delete participant: STRICTLY PROTECTED BY 2-HOUR LOCKOUT RULE! */}
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(p)}
                            title={
                              isLockedOut && !isAdminUnlocked
                                ? '🔒 ล็อกรายชื่อแล้ว (ไม่สามารถลบออกได้ภายใน 2 ชม. ก่อนเริ่มจริง)'
                                : isLockedOut && isAdminUnlocked
                                ? 'ลบรายชื่อ (สิทธิ์แอดมิน - อยู่ในช่วง 2 ชม. ก่อนเริ่ม)'
                                : 'ยกเลิก / ลบออกจากก๊วน'
                            }
                            className={`p-1.5 rounded-lg transition touch-manipulation ${
                              isLockedOut && !isAdminUnlocked
                                ? 'text-amber-500 bg-amber-50 hover:bg-amber-100 cursor-pointer'
                                : 'text-neutral-400 hover:text-rose-600 hover:bg-rose-50'
                            }`}
                          >
                            {isLockedOut && !isAdminUnlocked ? (
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
          {/* TAB 3: ADMIN SETUP & FINANCE (STRICTLY ADMIN ONLY!)           */}
          {/* ------------------------------------------------------------- */}
          {activeTab === 'admin' && isAdminUnlocked && (
            <form onSubmit={handleSaveAdminSettings} className="space-y-4 animate-in fade-in">
              {adminSavedSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>บันทึกการตั้งค่าก๊วนและคำนวณราคาใหม่เรียบร้อย</span>
                </div>
              )}

              {/* Admin Mode Status Banner & Lock button */}
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-indigo-950 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>โหมดตั้งค่าผู้ดูแลระบบ (Admin Control Panel)</span>
                </div>
                <button
                  type="button"
                  onClick={handleLockAdmin}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-100/70 transition flex items-center gap-1 touch-manipulation"
                >
                  <Lock className="w-3 h-3" />
                  <span>ล็อกโหมดแอดมิน</span>
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

                  <div>
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

                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      รหัส PIN แอดมิน (สำหรับปลดล็อกตั้งค่าก๊วน)
                    </label>
                    <input
                      type="text"
                      value={editAdminPin}
                      onChange={(e) => setEditAdminPin(e.target.value)}
                      placeholder="เช่น 1234"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-neutral-900 font-mono font-bold"
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
                  บันทึกการตั้งค่าก๊วน & คำนวณราคาใหม่
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Sticky Footer */}
        <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 shrink-0">
          <div className="flex items-center gap-2">
            <span>
              ยอดรวมก๊วน: <strong>{totalExpenses}฿</strong> (เก็บได้ {totalCollected}฿)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isAdminUnlocked && (
              <button
                type="button"
                onClick={() => {
                  setPinInput('');
                  setPinError('');
                  setIsPinModalOpen(true);
                }}
                className="text-[11px] text-neutral-400 hover:text-neutral-700 flex items-center gap-1 transition touch-manipulation"
              >
                <KeyRound className="w-3 h-3" />
                <span>แอดมินใส่ PIN</span>
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
      {/* DIALOG 1: ADMIN PIN UNLOCK MODAL                              */}
      {/* ------------------------------------------------------------- */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-neutral-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-neutral-900 text-base">เข้าสู่ระบบผู้จัดก๊วน (Admin)</h4>
              <p className="text-xs text-neutral-500">
                ใส่รหัส PIN เพื่อเปิดหน้าตั้งค่าก๊วนและจัดการการเงิน
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-3">
              <div>
                <input
                  type="password"
                  autoFocus
                  required
                  maxLength={10}
                  placeholder="ใส่รหัส PIN 4 หลัก (เริ่มต้น: 1234)"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  className="w-full text-center tracking-[0.3em] font-mono text-xl py-3 px-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 focus:bg-white"
                />
                {pinError && (
                  <p className="text-xs text-rose-600 mt-1 text-center font-medium">{pinError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 transition"
                >
                  ปลดล็อก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DIALOG 2: 2-HOUR LOCKOUT EXPLANATION FOR REGULAR USERS        */}
      {/* ------------------------------------------------------------- */}
      {lockoutAlertModal.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-neutral-200 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h4 className="font-bold text-neutral-900 text-base">ไม่สามารถยกเลิกรายชื่อได้</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">
                ขณะนี้อยู่ในช่วง{' '}
                <strong className="text-rose-700">น้อยกว่า 2 ชั่วโมงก่อนเวลาเริ่มตีจริง</strong>{' '}
                ({session.startHour}:00 น.) ระบบได้ทำการล็อกรายชื่อตามกฎก๊วนแล้ว
                เพื่อความเป็นธรรมในค่าหารสนามและค่าลูกแบดต่อสมาชิกท่านอื่น
              </p>
              <div className="pt-2 text-[11px] text-neutral-500 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/80">
                หากมีเหตุจำเป็นฉุกเฉิน กรุณาติดต่อผู้จัดก๊วน (แอดมิน) โดยตรง
              </div>
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
