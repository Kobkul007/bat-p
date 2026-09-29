import React from 'react';
import { RotateCcw, Volume2, VolumeX, FileSpreadsheet, Trophy, RefreshCw } from 'lucide-react';
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
}) => {
  return (
    <header className="border-b border-black/[0.06] bg-white/80 backdrop-blur-xl sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand & Mode */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neutral-100 border border-black/[0.06] flex items-center justify-center text-lg shadow-sm">
            🏸
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base sm:text-lg text-neutral-900 tracking-tight">
                SmashQueue
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/80">
                ครองคอร์ตสูงสุด 2 เกม
              </span>
            </div>
            <p className="text-xs text-neutral-500 hidden sm:block">
              ระบบจัดคิวแบดมินตัน • ชนะ 2 เกมติดสลับออกพัก
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => {
              onToggleSound();
              sounds.playPoint();
            }}
            title={soundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
            className="p-2 rounded-xl bg-white border border-neutral-200/80 text-neutral-500 hover:text-neutral-900 hover:border-neutral-300 shadow-sm transition"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-neutral-400" />}
          </button>

          {/* Undo Action */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border shadow-sm ${
              canUndo
                ? 'bg-white text-neutral-800 border-amber-300/80 hover:bg-amber-50/50 hover:border-amber-400'
                : 'bg-neutral-100/60 text-neutral-400 border-neutral-200/60 cursor-not-allowed shadow-none'
            }`}
            title="ย้อนกลับผลการแข่งขันล่าสุด (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ย้อนกลับ</span>
            {undoDepth > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px] font-semibold">
                {undoDepth}
              </span>
            )}
          </button>

          {/* Leaderboard Modal Trigger */}
          <button
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 border border-neutral-200/80 shadow-sm transition"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">ตารางอันดับ</span>
          </button>

          {/* Google Sheets Trigger */}
          <button
            onClick={onOpenSheets}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border shadow-sm ${
              sheetsConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/60'
                : 'bg-white text-neutral-700 border-neutral-200/80 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${sheetsConnected ? 'text-emerald-600' : 'text-neutral-500'}`} />
            <span className="hidden md:inline">
              {sheetsConnected ? (sheetTitle ? sheetTitle.slice(0, 14) + '...' : 'เชื่อมต่อชีตแล้ว') : 'Google Sheets'}
            </span>
            {sheetsConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          </button>

          {/* Reset / New Session */}
          <button
            onClick={onResetSession}
            title="รีเซ็ตเซสชันเริ่มรอบใหม่"
            className="p-2 rounded-xl bg-white border border-neutral-200/80 text-neutral-400 hover:text-rose-600 hover:border-neutral-300 shadow-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
