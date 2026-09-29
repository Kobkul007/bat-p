import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  LogOut,
  ShieldAlert,
  Lock,
  LogIn,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { GoogleSheetsConfig, MatchHistoryItem, PlayerPair, AdminAuthConfig } from '../types/badminton';
import { googleSheetsService } from '../services/googleSheets';
import { loadAdminConfig, isUserAuthorized } from '../utils/storage';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GoogleSheetsConfig;
  onUpdateConfig: (newConfig: GoogleSheetsConfig) => void;
  history: MatchHistoryItem[];
  allPairs: PlayerPair[];
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  history,
  allPairs,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [customSheetInput, setCustomSheetInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  // Access Control & Auth state
  const [adminConfig, setAdminConfig] = useState<AdminAuthConfig>(() => loadAdminConfig());
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => googleSheetsService.getUserEmail() || config.userEmail);
  const [currentUserName, setCurrentUserName] = useState<string | null>(() => googleSheetsService.getUserName());

  // Reload adminConfig and auth info when modal opens
  useEffect(() => {
    if (isOpen) {
      const cfg = loadAdminConfig();
      setAdminConfig(cfg);
      const email = googleSheetsService.getUserEmail() || config.userEmail;
      setCurrentUserEmail(email);
      setCurrentUserName(googleSheetsService.getUserName());
      setError(null);
      setSuccessMsg(null);
      setPopupBlocked(false);
    }
  }, [isOpen, config.userEmail]);

  // Authorization evaluation
  const isAuth = Boolean(googleSheetsService.isAuthenticated() && currentUserEmail);
  const isAuthorized = useMemo(() => {
    return isUserAuthorized(currentUserEmail, adminConfig);
  }, [currentUserEmail, adminConfig]);

  if (!isOpen) return null;

  /**
   * Handle Google Login to verify administrator or authorized user
   */
  const handleAuthorize = async () => {
    setError(null);
    setSuccessMsg(null);
    setPopupBlocked(false);
    setLoading(true);

    try {
      const res = await googleSheetsService.loginWithGoogle(true);
      setCurrentUserEmail(res.email);
      setCurrentUserName(res.name || null);

      const authorized = isUserAuthorized(res.email, adminConfig);
      if (authorized) {
        onUpdateConfig({
          ...config,
          userEmail: res.email,
        });
        setSuccessMsg(`เข้าสู่ระบบและยืนยันสิทธิ์สำเร็จ: ${res.email}`);
      } else {
        setError(`บัญชี ${res.email} ไม่ได้รับสิทธิ์เข้าถึง Google Sheets`);
      }
    } catch (err: any) {
      const isBlocked =
        err?.isPopupBlocked ||
        err?.message?.includes('popup') ||
        err?.message?.includes('ป๊อปอัป');

      if (isBlocked) {
        setPopupBlocked(true);
        setError('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัปเข้าสู่ระบบ (Popup Blocked)');
      } else {
        setError(err?.message || 'การยืนยันตัวตนล้มเหลว กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    googleSheetsService.disconnect();
    setCurrentUserEmail(null);
    setCurrentUserName(null);
    onUpdateConfig({
      ...config,
      userEmail: null,
    });
    setSuccessMsg('ออกจากระบบ Google แล้ว');
    setPopupBlocked(false);
  };

  const handleCreateNewSheet = async () => {
    if (!isAuthorized) {
      setError('ไม่มีสิทธิ์เข้าถึง Google Sheets: ฟังก์ชันนี้จำกัดเฉพาะแอดมินหรือผู้ได้รับสิทธิ์เท่านั้น');
      return;
    }

    if (!googleSheetsService.isAuthenticated()) {
      await handleAuthorize();
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const sheet = await googleSheetsService.createSessionSpreadsheet(
        `คิวแบดมินตัน ครองคอร์ต - ${new Date().toLocaleDateString('th-TH')}`
      );
      const updatedConfig: GoogleSheetsConfig = {
        ...config,
        spreadsheetId: sheet.id,
        spreadsheetUrl: sheet.url,
        spreadsheetTitle: sheet.title,
        lastSyncedAt: Date.now(),
      };
      onUpdateConfig(updatedConfig);

      // Immediately sync current history if any
      if (history.length > 0 || allPairs.length > 0) {
        await googleSheetsService.syncAllData(sheet.id, history, allPairs);
      }

      setSuccessMsg(`สร้างสเปรดชีตใหม่: "${sheet.title}" เรียบร้อยแล้ว!`);
    } catch (err: any) {
      if (err?.isPopupBlocked || err?.message?.includes('popup')) {
        setPopupBlocked(true);
      }
      setError(err.message || 'ไม่สามารถสร้างสเปรดชีตได้');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExisting = () => {
    if (!isAuthorized) {
      setError('ไม่มีสิทธิ์เข้าถึง Google Sheets: ฟังก์ชันนี้จำกัดเฉพาะแอดมินหรือผู้ได้รับสิทธิ์เท่านั้น');
      return;
    }

    if (!customSheetInput.trim()) return;
    let sheetId = customSheetInput.trim();
    const match = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      sheetId = match[1];
    }

    const updatedConfig: GoogleSheetsConfig = {
      ...config,
      spreadsheetId: sheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
      spreadsheetTitle: `ชีตที่เชื่อมต่อ (${sheetId.slice(0, 8)}...)`,
      lastSyncedAt: null,
    };
    onUpdateConfig(updatedConfig);
    setShowCustomInput(false);
    setCustomSheetInput('');
    setSuccessMsg('เชื่อมต่อสเปรดชีตเดิมสำเร็จ!');
  };

  const handleSyncNow = async () => {
    if (!isAuthorized) {
      setError('ไม่มีสิทธิ์เข้าถึง Google Sheets: ฟังก์ชันนี้จำกัดเฉพาะแอดมินหรือผู้ได้รับสิทธิ์เท่านั้น');
      return;
    }

    if (!config.spreadsheetId) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await googleSheetsService.syncAllData(config.spreadsheetId, history, allPairs);
      onUpdateConfig({
        ...config,
        lastSyncedAt: Date.now(),
      });
      setSuccessMsg(result.message || 'ซิงค์ข้อมูลกับ Google Sheets เรียบร้อย');
    } catch (err: any) {
      if (err?.isPopupBlocked || err?.message?.includes('popup')) {
        setPopupBlocked(true);
      }
      setError(err.message || 'การซิงค์ข้อมูลล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoSync = () => {
    if (!isAuthorized) {
      setError('เฉพาะผู้ดูแลระบบและผู้ได้รับสิทธิ์เท่านั้นที่สามารถเปิดระบบซิงค์ได้');
      return;
    }
    onUpdateConfig({
      ...config,
      autoSync: !config.autoSync,
    });
  };

  const handleDownloadCsv = () => {
    if (!isAuthorized) {
      setError('การดาวน์โหลดข้อมูลสำรองจำกัดเฉพาะแอดมินหรือผู้ได้รับสิทธิ์เท่านั้น');
      return;
    }
    googleSheetsService.downloadCsv(history, allPairs);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.22)] animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[#1d1d1f]">Google Sheets</h3>
                {!isAuthorized ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> ต้องมีสิทธิ์
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> ผู้ดูแลระบบ
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500">บันทึกแมตช์และตารางอันดับลงชีตอัตโนมัติ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerts */}
        {error && !popupBlocked && (
          <div className="mt-3.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Popup Blocked Specific Friendly Guide */}
        {popupBlocked && (
          <div className="mt-3.5 p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-xs space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-amber-950">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป (Popup Blocked)</span>
            </div>
            <p className="text-neutral-700 leading-relaxed">
              เบราว์เซอร์บล็อกหน้าต่างป๊อปอัปสำหรับลงชื่อเข้าใช้ Google กรุณากดปุ่มด้านล่างเพื่อเปิดหน้าต่างอีกครั้ง หรืออนุญาตป๊อปอัปที่แถบที่อยู่เว็บ (URL Bar):
            </p>
            <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60 text-[11px] text-neutral-600 space-y-1">
              <div>• <strong>Chrome / Edge:</strong> แตะไอคอนป๊อปอัปถูกบล็อกที่ขวาบนของแถบ URL &gt; เลือก &quot;อนุญาตเสมอ&quot;</div>
              <div>• <strong>Safari / iPhone:</strong> การตั้งค่า (Settings) &gt; Safari &gt; ปิด &quot;บล็อกหน้าต่างที่แสดงขึ้นมา&quot;</div>
            </div>
            <div className="pt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAuthorize}
                disabled={loading}
                className="px-4 py-2 rounded-full text-xs font-semibold bg-[#1d1d1f] hover:bg-neutral-800 text-white shadow-sm transition active:scale-95 cursor-pointer"
              >
                {loading ? 'กำลังเปิดหน้าต่าง...' : 'แตะเพื่อเปิดหน้าต่างเข้าสู่ระบบอีกครั้ง'}
              </button>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mt-3.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CASE 1: NOT LOGGED IN WITH GOOGLE -> AUTHENTICATION GATE      */}
        {/* ------------------------------------------------------------- */}
        {!currentUserEmail && (
          <div className="mt-4 p-5 sm:p-6 rounded-3xl bg-neutral-50/80 border border-neutral-200/80 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shadow-xs">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-semibold text-neutral-900">
                จำกัดสิทธิ์การเข้าถึง Google Sheets
              </h4>
              <p className="text-xs text-neutral-600 leading-relaxed max-w-sm mx-auto">
                ระบบจัดการและซิงค์ข้อมูล Google Sheets สงวนสิทธิ์เฉพาะ<strong>ผู้ดูแลระบบ (Admin)</strong> และ<strong>อีเมลที่ได้รับอนุญาต</strong>เท่านั้น
              </p>
            </div>

            <div className="p-3 bg-white border border-neutral-200/70 rounded-2xl text-[11px] text-neutral-600 flex items-start gap-2.5 text-left">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google เพื่อยืนยันสิทธิ์ก่อนเข้าใช้งานสเปรดชีต</span>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAuthorize}
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl bg-[#1d1d1f] hover:bg-black text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition touch-manipulation active:scale-[0.98] disabled:opacity-50"
              >
                <LogIn className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'กำลังเปิดหน้าต่างลงชื่อเข้าใช้...' : 'ลงชื่อเข้าใช้ Google เพื่อยืนยันสิทธิ์'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium transition"
              >
                ยกเลิก / ปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CASE 2: LOGGED IN BUT NOT AUTHORIZED -> ACCESS DENIED GATE    */}
        {/* ------------------------------------------------------------- */}
        {currentUserEmail && !isAuthorized && (
          <div className="mt-4 p-5 sm:p-6 rounded-3xl bg-rose-50/40 border border-rose-200/80 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-semibold text-rose-900">
                ปฏิเสธการเข้าถึง (Access Denied)
              </h4>
              <p className="text-xs text-rose-700 leading-relaxed max-w-sm mx-auto">
                บัญชี Google นี้ไม่ได้รับสิทธิ์เข้าถึงระบบ Google Sheets
              </p>
            </div>

            {/* Current user badge showing unauthorized status */}
            <div className="p-3.5 bg-white border border-rose-200 rounded-2xl text-left space-y-1.5">
              <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">
                บัญชี Google ที่เข้าสู่ระบบขณะนี้
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-neutral-900 truncate">
                  {currentUserEmail}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                  ไม่ได้รับสิทธิ์ (Unauthorized)
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-[11px] text-amber-900 text-left leading-relaxed">
              การเข้าถึง Google Sheets จำกัดเฉพาะผู้ดูแลระบบและอีเมลที่ได้รับสิทธิ์เท่านั้น หากท่านเป็นผู้ดูแลสนาม กรุณาสลับบัญชีไปยังอีเมลที่ได้รับอนุญาต หรือติดต่อผู้ดูแลระบบเพื่อขอเพิ่มสิทธิ์
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAuthorize}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#1d1d1f] hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition touch-manipulation active:scale-[0.98] disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>สลับบัญชี Google (Switch Account)</span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex-1 py-2 px-3 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 text-xs font-medium transition"
                >
                  ออกจากระบบ
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium transition"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CASE 3: AUTHORIZED ADMIN/USER -> FULL GOOGLE SHEETS CONTROLS  */}
        {/* ------------------------------------------------------------- */}
        {currentUserEmail && isAuthorized && (
          <div className="mt-4 space-y-3.5">
            {/* Account Status Card */}
            <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-neutral-200/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full ${isAuth ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-neutral-400'} shrink-0`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-neutral-500 block">บัญชี Google ผู้ดูแล:</span>
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-bold">
                      ยืนยันแล้ว ✓
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-[#1d1d1f] truncate block">
                    {currentUserEmail}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleAuthorize}
                  title="สลับบัญชี"
                  className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/60 rounded-full transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-600 hover:text-rose-600 hover:bg-neutral-200/60 rounded-full transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ออก</span>
                </button>
              </div>
            </div>

            {/* Spreadsheet Target */}
            {config.spreadsheetId ? (
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block">
                      สเปรดชีตที่เชื่อมต่อ
                    </span>
                    <h4 className="text-[#1d1d1f] font-semibold text-xs sm:text-sm mt-0.5 truncate max-w-[210px]">
                      {config.spreadsheetTitle || 'ชีตบันทึกคิวแบดมินตัน'}
                    </h4>
                    <span className="text-[10px] text-neutral-500 block font-mono">
                      ID: {config.spreadsheetId.slice(0, 16)}...
                    </span>
                  </div>

                  {config.spreadsheetUrl && (
                    <a
                      href={config.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-sm transition shrink-0"
                    >
                      <span>เปิดดูชีต</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Sync Controls */}
                <div className="pt-3 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoSyncToggle"
                      checked={config.autoSync}
                      onChange={handleToggleAutoSync}
                      className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="autoSyncToggle" className="text-xs text-neutral-700 select-none cursor-pointer">
                      ซิงค์อัตโนมัติเมื่อจบแมตช์
                    </label>
                  </div>

                  <button
                    onClick={handleSyncNow}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white text-neutral-800 hover:bg-neutral-100 border border-neutral-200 shadow-sm transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    <span>ซิงค์ทั้งหมด</span>
                  </button>
                </div>

                {config.lastSyncedAt && (
                  <p className="text-[10px] text-neutral-500">
                    ซิงค์ล่าสุด: {new Date(config.lastSyncedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-[#f5f5f7] border border-neutral-200/70 text-center space-y-3.5">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  สร้างสเปรดชีตใหม่อัตโนมัติ เพื่อบันทึกประวัติการแข่งขันและจัดอันดับผู้เล่นลง Google Sheets ทันที
                </p>

                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    onClick={handleCreateNewSheet}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-[#1d1d1f] text-white hover:bg-neutral-800 transition shadow-sm disabled:opacity-40"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>สร้างสเปรดชีตใหม่</span>
                  </button>

                  <button
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    className="px-4 py-2.5 rounded-full text-xs font-medium bg-white text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200/80 shadow-sm transition"
                  >
                    ใช้ลิงก์ชีตเดิม
                  </button>
                </div>

                {showCustomInput && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="วางลิงก์หรือ Sheet ID"
                      value={customSheetInput}
                      onChange={(e) => setCustomSheetInput(e.target.value)}
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
                    />
                    <button
                      onClick={handleLinkExisting}
                      className="px-4 py-2 text-xs font-semibold bg-[#1d1d1f] text-white rounded-xl hover:bg-neutral-800 transition"
                    >
                      เชื่อม
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Offline CSV Fallback */}
            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
              <span>สำรองข้อมูลลงเครื่อง</span>
              <button
                onClick={handleDownloadCsv}
                className="flex items-center gap-1.5 text-neutral-700 hover:text-[#1d1d1f] font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-neutral-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
