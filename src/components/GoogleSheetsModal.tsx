import React, { useState } from 'react';
import { FileSpreadsheet, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, X, Download, LogOut } from 'lucide-react';
import { GoogleSheetsConfig, MatchHistoryItem, PlayerPair } from '../types/badminton';
import { googleSheetsService } from '../services/googleSheets';

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

  if (!isOpen) return null;

  const isAuth = googleSheetsService.isAuthenticated();
  const userEmail = googleSheetsService.getUserEmail() || config.userEmail;

  const handleAuthorize = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await googleSheetsService.authorize();
      const email = googleSheetsService.getUserEmail();
      onUpdateConfig({
        ...config,
        userEmail: email || config.userEmail,
      });
      setSuccessMsg('เชื่อมต่อบัญชี Google สำเร็จเรียบร้อย');
    } catch (err: any) {
      setError(err.message || 'การยืนยันตัวตนล้มเหลว กรุณาอนุญาตป๊อปอัปในเบราว์เซอร์');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    googleSheetsService.disconnect();
    onUpdateConfig({
      ...config,
      userEmail: null,
    });
    setSuccessMsg('ยกเลิกการเชื่อมต่อบัญชี Google แล้ว');
  };

  const handleCreateNewSheet = async () => {
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
      setError(err.message || 'ไม่สามารถสร้างสเปรดชีตได้');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExisting = () => {
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
      setError(err.message || 'การซิงค์ข้อมูลล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoSync = () => {
    onUpdateConfig({
      ...config,
      autoSync: !config.autoSync,
    });
  };

  const handleDownloadCsv = () => {
    googleSheetsService.downloadCsv(history, allPairs);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.18)] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Google Sheets</h3>
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
        {error && (
          <div className="mt-3.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="mt-4 space-y-3.5">
          {/* Account Status Card */}
          <div className="p-3.5 rounded-2xl bg-[#f5f5f7] border border-neutral-200/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isAuth ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-neutral-400'}`} />
              <div>
                <span className="text-[11px] text-neutral-500 block">บัญชี Google</span>
                <span className="text-xs sm:text-sm font-medium text-[#1d1d1f] truncate max-w-[190px] block">
                  {userEmail || (isAuth ? 'เข้าสู่ระบบแล้ว' : 'ยังไม่ได้เชื่อมต่อ')}
                </span>
              </div>
            </div>

            {isAuth ? (
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-neutral-600 hover:text-rose-600 hover:bg-neutral-200/60 rounded-full transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกจากระบบ</span>
              </button>
            ) : (
              <button
                onClick={handleAuthorize}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-full bg-[#1d1d1f] text-white hover:bg-neutral-800 transition shadow-sm"
              >
                เข้าสู่ระบบ Google
              </button>
            )}
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
