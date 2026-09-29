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
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-neutral-200/80 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Zone 1: Brand & Current Mode */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (isAdminView) onToggleAdminView();
            }}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
            title="SmashQueue - ระบบจัดคิวแบดมินตัน"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center text-base sm:text-lg font-semibold shadow-xs group-hover:scale-105 transition-transform shrink-0">
              🏸
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base text-neutral-900 tracking-tight">
                  SmashQueue
                </span>
                {isAdminView ? (
                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full">
                    แอดมิน
                  </span>
                ) : (
                  <span className="hidden md:inline text-[11px] text-neutral-500 font-normal">
                    King of the Court
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 truncate hidden sm:block">
                {isAdminView
                  ? 'ศูนย์จัดการระบบและสรุปผล'
                  : 'ชนะ 2 ตาติดออก · คนแพ้ได้ลงก่อนคนชนะ'}
              </p>
            </div>
          </button>
        </div>

        {/* Zone 2: Desktop Segmented View Switch */}
        <nav className="hidden lg:flex items-center p-1 bg-neutral-100/90 rounded-xl border border-neutral-200/60">
          <button
            type="button"
            onClick={() => {
              if (isAdminView) onToggleAdminView();
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
              !isAdminView
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            🏸 คอร์ดแข่งขัน
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isAdminView) onToggleAdminView();
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
              isAdminView
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>จัดการแอดมิน</span>
          </button>
        </nav>

        {/* Zone 3: Essential Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile Admin Toggle */}
          <button
            type="button"
            onClick={onToggleAdminView}
            className={`lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition border touch-manipulation min-h-[36px] ${
              isAdminView
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[11px]">{isAdminView ? 'กลับ' : 'แอดมิน'}</span>
          </button>

          {/* Undo Action */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`min-h-[36px] flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition border touch-manipulation ${
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

          {/* Meetup Group Trigger */}
          <button
            type="button"
            onClick={onOpenMeetup}
            className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100/90 border border-emerald-200/90 shadow-xs transition touch-manipulation active:scale-95"
            title="ระบบจัดก๊วนแบดมินตัน & หารเงิน"
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">ก๊วนแบด</span>
            <span className="font-mono text-[10px] font-bold bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded-full">
              {meetupParticipantsCount}/{meetupMaxParticipants}
            </span>
          </button>

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
            className={`min-h-[36px] flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition border shadow-xs touch-manipulation active:scale-95 ${
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
            <div className="relative flex items-center">
              <FileSpreadsheet
                className={`w-3.5 h-3.5 ${
                  sheetsConnected && isSheetsAuthorized ? 'text-emerald-600' : 'text-neutral-500'
                }`}
              />
              {!isSheetsAuthorized && (
                <Lock className="w-2 h-2 text-amber-600 absolute -bottom-1 -right-1.5" />
              )}
            </div>
            <span className="hidden md:inline">
              {sheetsConnected && isSheetsAuthorized
                ? sheetTitle
                  ? sheetTitle.length > 14
                    ? `${sheetTitle.slice(0, 12)}...`
                    : sheetTitle
                  : 'ชีตพร้อม'
                : 'Google Sheets'}
            </span>
            {sheetsConnected && isSheetsAuthorized && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            )}
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              onToggleSound();
              sounds.playPoint();
            }}
            title={soundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-300 shadow-xs transition active:scale-95 touch-manipulation flex items-center justify-center shrink-0"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-neutral-400" />
            )}
          </button>

          {/* Reset Session */}
          <button
            type="button"
            onClick={onResetSession}
            title="รีเซ็ตเริ่มรอบใหม่ (Reset Session)"
            className="w-9 h-9 rounded-xl bg-white border border-neutral-200 text-neutral-400 hover:text-rose-600 hover:border-rose-200 shadow-xs transition active:scale-95 touch-manipulation flex items-center justify-center shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
