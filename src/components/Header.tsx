import React from 'react';
import { RotateCcw, Volume2, VolumeX, FileSpreadsheet, Trophy, RefreshCw, ShieldCheck, Lock, Users } from 'lucide-react';
import { sounds } from '../services/soundEffects';

interface HeaderProps {
  canUndo: boolean;
  undoDepth: number;
  onUndo: () => void;
  onOpenSheets: () => void;
  onOpenLeaderboard: () => void;
  onOpenMeetup: () => void;
  meetupParticipantsCount?: number;
  meetupMaxParticipants?: number;
  onResetSession: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  sheetsConnected: boolean;
  sheetTitle: string | null;
  isAdminView: boolean;
  onToggleAdminView: () => void;
  isSheetsAuthorized?: boolean;
  activeView?: 'court' | 'meetup' | 'admin';
  onSelectView?: (view: 'court' | 'meetup' | 'admin') => void;
  isMeetupSynced?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  canUndo,
  undoDepth,
  onUndo,
  onOpenSheets,
  onOpenLeaderboard,
  onOpenMeetup,
  meetupParticipantsCount = 0,
  meetupMaxParticipants = 12,
  onResetSession,
  soundEnabled,
  onToggleSound,
  sheetsConnected,
  sheetTitle,
  isAdminView,
  onToggleAdminView,
  isSheetsAuthorized = false,
  activeView = isAdminView ? 'admin' : 'court',
  onSelectView,
  isMeetupSynced = false,
}) => {
  const handleViewChange = (view: 'court' | 'meetup' | 'admin') => {
    if (onSelectView) {
      onSelectView(view);
    } else {
      if (view === 'admin' && !isAdminView) onToggleAdminView();
      if (view === 'court' && isAdminView) onToggleAdminView();
      if (view === 'meetup') onOpenMeetup();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-neutral-200/80 transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Zone 1: Brand & Current Mode */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => handleViewChange('court')}
            className="flex items-center gap-2 sm:gap-2.5 text-left group focus:outline-none"
            title="SmashQueue - สลับกลับสู่หน้าคอร์ด"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center text-base sm:text-lg font-semibold shadow-xs group-hover:scale-105 transition-transform shrink-0">
              🏸
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold text-sm sm:text-base text-neutral-900 tracking-tight">
                  SmashQueue
                </span>
                {activeView === 'admin' ? (
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full">
                    แอดมิน
                  </span>
                ) : activeView === 'meetup' ? (
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                    ก๊วนแบด
                  </span>
                ) : (
                  <span className="hidden md:inline text-[11px] text-neutral-500 font-normal">
                    King of the Court
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 truncate hidden sm:block">
                {activeView === 'admin'
                  ? 'ศูนย์จัดการระบบและสรุปผลหลังบ้าน'
                  : activeView === 'meetup'
                  ? 'ระบบก๊วนแบดมินตัน & หารค่าใช้จ่าย'
                  : 'ชนะ 2 ตาติดออก · คนแพ้ได้ลงก่อนคนชนะ'}
              </p>
            </div>
          </button>
        </div>

        {/* Zone 2: Desktop Segmented View Switch (Strict Separation of Systems) */}
        <nav className="hidden lg:flex items-center p-1 bg-neutral-100/90 rounded-2xl border border-neutral-200/60">
          <button
            type="button"
            onClick={() => handleViewChange('court')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition ${
              activeView === 'court'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            🏸 ระบบจัดคอร์ด & คิว
          </button>

          <button
            type="button"
            onClick={() => handleViewChange('meetup')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 ${
              activeView === 'meetup'
                ? 'bg-white text-emerald-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span>ระบบก๊วนแบด & หารเงิน</span>
            <span className="font-mono text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">
              {meetupParticipantsCount}/{meetupMaxParticipants}
            </span>
            <span
              className={`text-[9px] px-1 rounded-sm font-semibold ${
                isMeetupSynced ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-200 text-neutral-600'
              }`}
            >
              {isMeetupSynced ? 'ซิงก์คอร์ด' : 'แยกอิสระ'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleViewChange('admin')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 ${
              activeView === 'admin'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>จัดการแอดมิน</span>
          </button>
        </nav>

        {/* Zone 3: Essential Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Quick Meetup View Trigger on mobile/tablet */}
          <button
            type="button"
            onClick={() => handleViewChange('meetup')}
            className={`lg:hidden min-h-[36px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition border touch-manipulation active:scale-95 ${
              activeView === 'meetup'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200/90'
            }`}
            title="ระบบจัดก๊วนแบด & หารเงิน"
          >
            <Users className="w-3.5 h-3.5" />
            <span>ก๊วนแบด</span>
            <span className="font-mono text-[10px] font-bold opacity-90">
              ({meetupParticipantsCount})
            </span>
          </button>

          {/* Undo Action (Only in court view) */}
          {activeView === 'court' && (
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`min-h-[36px] flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition border touch-manipulation ${
                canUndo
                  ? 'bg-amber-50/70 text-amber-900 border-amber-200/90 hover:bg-amber-100/70 shadow-xs active:scale-95'
                  : 'bg-neutral-50/60 text-neutral-300 border-neutral-200/40 cursor-not-allowed opacity-50'
              }`}
              title={canUndo ? `ย้อนกลับผลการแข่งขันก่อนหน้า (Ctrl+Z)` : 'ไม่สามารถย้อนกลับได้'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ย้อนกลับ</span>
              {undoDepth > 0 && (
                <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded-full">
                  {undoDepth}
                </span>
              )}
            </button>
          )}

          {/* Leaderboard Modal Trigger */}
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="min-h-[36px] hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200 shadow-xs transition touch-manipulation active:scale-95"
            title="ตารางอันดับผู้เล่น (Leaderboard)"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>อันดับ</span>
          </button>

          {/* Google Sheets Trigger */}
          <button
            type="button"
            onClick={onOpenSheets}
            className={`min-h-[36px] hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition border shadow-xs touch-manipulation active:scale-95 ${
              sheetsConnected && isSheetsAuthorized
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
            title={
              isSheetsAuthorized
                ? sheetsConnected
                  ? `Google Sheets: ${sheetTitle || 'เชื่อมต่อแล้ว'}`
                  : 'เชื่อมต่อ Google Sheets'
                : 'Google Sheets (จำกัดเฉพาะแอดมิน)'
            }
          >
            <div className="relative">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              {!isSheetsAuthorized ? (
                <Lock className="w-2 h-2 text-amber-500 absolute -bottom-0.5 -right-1" />
              ) : null}
            </div>
            <span className="hidden md:inline">
              {sheetsConnected ? 'ซิงค์ชีตแล้ว' : 'ชีต'}
            </span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            className={`p-2 rounded-xl border transition shadow-xs touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center ${
              soundEnabled
                ? 'bg-white text-neutral-700 hover:bg-neutral-50 border-neutral-200'
                : 'bg-neutral-100 text-neutral-400 border-neutral-200'
            }`}
            title={soundEnabled ? 'ปิดเสียงเอฟเฟกต์' : 'เปิดเสียงเอฟเฟกต์'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Reset Session */}
          <button
            type="button"
            onClick={onResetSession}
            className="p-2 rounded-xl bg-white text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 border border-neutral-200 shadow-xs transition touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center hidden sm:flex"
            title="รีเซ็ตเซสชัน (คิวและสถิติ)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
