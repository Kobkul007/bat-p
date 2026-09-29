import React from 'react';
import { RotateCcw, Volume2, VolumeX, FileSpreadsheet, Trophy, RefreshCw, ShieldCheck } from 'lucide-react';
import { sounds } from '../services/soundEffects';

interface HeaderProps {
  canUndo: boolean;
  undoDepth: number;
  onUndo: () => void;
  onOpenSheets: () => void;
  onOpenLeaderboard: () => void;
  onResetSession: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  sheetsConnected: boolean;
  sheetTitle: string | null;
  isAdminView: boolean;
  onToggleAdminView: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  canUndo,
  undoDepth,
  onUndo,
  onOpenSheets,
  onOpenLeaderboard,
  onResetSession,
  soundEnabled,
  onToggleSound,
  sheetsConnected,
  sheetTitle,
  isAdminView,
  onToggleAdminView,
}) => {
  return (
    <header className="border-b border-black/[0.06] bg-white/85 backdrop-blur-xl sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-2">
        {/* Brand & Mode */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            onClick={onToggleAdminView}
            className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-neutral-100 border border-black/[0.06] flex items-center justify-center text-base sm:text-lg shadow-sm cursor-pointer hover:bg-neutral-200 transition"
            title="สลับโหมด คอร์ต / แอดมิน"
          >
            🏸
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1
                onClick={() => { if (isAdminView) onToggleAdminView(); }}
                className="font-semibold text-sm sm:text-lg text-neutral-900 tracking-tight cursor-pointer"
              >
                SmashQueue
              </h1>
              {isAdminView ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  แอดมินหลังบ้าน
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/80">
                  ครองคอร์ตสูงสุด 2 เกม
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-500 hidden md:block">
              {isAdminView
                ? 'ศูนย์สรุปข้อมูล สถิติ และจัดการระบบหลังบ้าน'
                : 'ระบบจัดคิวแบดมินตัน • ชนะ 2 เกมติดสลับออกพัก'}
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Admin Backoffice Button */}
          <button
            onClick={onToggleAdminView}
            className={`min-h-[36px] flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition border shadow-sm touch-manipulation active:scale-95 ${
              isAdminView
                ? 'bg-[#1d1d1f] text-white border-neutral-800 shadow-sm'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200/80 hover:bg-indigo-100 hover:border-indigo-300'
            }`}
            title="เปิดหน้าแอดมินและข้อมูลสรุปหลังบ้าน"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isAdminView ? 'text-indigo-300' : 'text-indigo-600'}`} />
            <span className="hidden sm:inline">{isAdminView ? '🏸 กลับหน้าคอร์ต' : '⚙️ แอดมินหลังบ้าน'}</span>
            <span className="sm:hidden">{isAdminView ? 'คอร์ต' : 'แอดมิน'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              onToggleSound();
              sounds.playPoint();
            }}
            title={soundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
            className="w-9 h-9 sm:w-auto sm:h-auto sm:p-2 rounded-xl bg-white border border-neutral-200/80 text-neutral-500 hover:text-neutral-900 hover:border-neutral-300 shadow-sm transition active:scale-95 touch-manipulation flex items-center justify-center"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-neutral-400" />}
          </button>

          {/* Undo Action */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`min-h-[36px] flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition border shadow-sm touch-manipulation active:scale-95 ${
              canUndo
                ? 'bg-white text-neutral-800 border-amber-300 hover:bg-amber-50/50 hover:border-amber-400'
                : 'bg-neutral-100/60 text-neutral-400 border-neutral-200/60 cursor-not-allowed shadow-none'
            }`}
            title="ย้อนกลับผลการแข่งขันล่าสุด (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ย้อนกลับ</span>
            {undoDepth > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                {undoDepth}
              </span>
            )}
          </button>

          {/* Leaderboard Modal Trigger (Desktop visible) */}
          <button
            onClick={onOpenLeaderboard}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 border border-neutral-200/80 shadow-sm transition touch-manipulation active:scale-95"
            title="ตารางอันดับผู้เล่น"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>ตารางอันดับ</span>
          </button>

          {/* Google Sheets Trigger */}
          <button
            onClick={onOpenSheets}
            className={`min-h-[36px] flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition border shadow-sm touch-manipulation active:scale-95 ${
              sheetsConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/60'
                : 'bg-white text-neutral-700 border-neutral-200/80 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
            title="Google Sheets"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${sheetsConnected ? 'text-emerald-600' : 'text-neutral-500'}`} />
            <span className="hidden md:inline">
              {sheetsConnected ? (sheetTitle ? sheetTitle.slice(0, 14) + '...' : 'ชีตเชื่อมต่อแล้ว') : 'Google Sheets'}
            </span>
            {sheetsConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>

          {/* Reset / New Session */}
          <button
            onClick={onResetSession}
            title="รีเซ็ตเซสชันเริ่มรอบใหม่"
            className="w-9 h-9 sm:w-auto sm:h-auto sm:p-2 rounded-xl bg-white border border-neutral-200/80 text-neutral-400 hover:text-rose-600 hover:border-neutral-300 shadow-sm transition touch-manipulation active:scale-95 flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
