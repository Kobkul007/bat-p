import React, { useState, useEffect } from 'react';
import {
  Crown,
  RotateCw,
  ArrowLeftRight,
  UserMinus,
  Plus,
  Minus,
  Award,
  Swords,
  Timer,
  Clock,
  Sparkles,
  Calculator,
  UserPlus,
} from 'lucide-react';
import { CourtState, PlayerPair } from '../types/badminton';
import { sounds } from '../services/soundEffects';
import { QuickScoreModal } from './QuickScoreModal';

interface CourtViewProps {
  court: CourtState;
  queue: PlayerPair[];
  onResolveMatch: (winnerTeam: 'A' | 'B', scoreA: number, scoreB: number, durationSeconds: number) => void;
  onSwapSides: () => void;
  onSeatNextChallenger: (slot: 'A' | 'B') => void;
  onSubToRest: (slot: 'A' | 'B') => void;
  onClearCourt: () => void;
}

export const CourtView: React.FC<CourtViewProps> = ({
  court,
  queue,
  onResolveMatch,
  onSwapSides,
  onSeatNextChallenger,
  onSubToRest,
}) => {
  // Rally scoring state
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);
  const [server, setServer] = useState<'A' | 'B'>('A');

  // Live timer tick
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Resolution confirmation modal
  const [confirmWinTeam, setConfirmWinTeam] = useState<'A' | 'B' | null>(null);

  // Quick Score modal state
  const [isQuickScoreOpen, setIsQuickScoreOpen] = useState<boolean>(false);

  // Reset scores and server when court match composition changes
  useEffect(() => {
    setScoreA(0);
    setScoreB(0);
    setServer('A');
  }, [court.teamA?.id, court.teamB?.id]);

  // Live timer tick every second during ACTIVE match
  useEffect(() => {
    if (court.status === 'ACTIVE' && court.matchStartedAt) {
      setCurrentTime(Date.now());
      const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
      return () => clearInterval(interval);
    }
  }, [court.status, court.matchStartedAt]);

  const liveDurationSeconds =
    court.status === 'ACTIVE' && court.matchStartedAt
      ? Math.max(0, Math.floor((currentTime - court.matchStartedAt) / 1000))
      : 0;

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleScoreChange = (team: 'A' | 'B', delta: number) => {
    if (delta > 0) {
      sounds.playPoint();
    }
    if (team === 'A') {
      setScoreA((prev) => {
        const next = Math.max(0, prev + delta);
        if (delta > 0) setServer('A');
        return next;
      });
    } else {
      setScoreB((prev) => {
        const next = Math.max(0, prev + delta);
        if (delta > 0) setServer('B');
        return next;
      });
    }
  };

  const handleOpenConfirm = (team: 'A' | 'B') => {
    setConfirmWinTeam(team);
  };

  const handleConfirmWin = () => {
    if (!confirmWinTeam) return;
    onResolveMatch(confirmWinTeam, scoreA, scoreB, liveDurationSeconds);
    setConfirmWinTeam(null);
  };

  const handleQuickScoreConfirm = (winner: 'A' | 'B', finalA: number, finalB: number) => {
    setScoreA(finalA);
    setScoreB(finalB);
    onResolveMatch(winner, finalA, finalB, liveDurationSeconds);
    setIsQuickScoreOpen(false);
  };

  const winnerTeamObj = confirmWinTeam === 'A' ? court.teamA : court.teamB;
  const willExitOnWin = (winnerTeamObj?.consecutiveWins || 0) + 1 >= 2;

  const isMatchActive = court.status === 'ACTIVE' && Boolean(court.teamA && court.teamB);

  return (
    <div className="bg-white border border-neutral-200/90 rounded-3xl overflow-hidden shadow-xs">
      {/* Top Bar: Court Name, Live Match Status, Clock, and Control Actions */}
      <div className="px-4 sm:px-6 py-3.5 bg-neutral-50/70 border-b border-neutral-200/80 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Court info & Timer */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isMatchActive
                  ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                  : 'bg-neutral-300'
              }`}
            />
            <h2 className="font-bold text-neutral-900 text-sm sm:text-base tracking-tight">
              คอร์ด 1
            </h2>
          </div>

          <span className="text-neutral-300">·</span>

          {isMatchActive ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-1 rounded-xl">
              <Timer className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono tabular-nums">{formatTimer(liveDurationSeconds)}</span>
              <span className="text-[10px] text-emerald-600 font-normal hidden sm:inline">
                (กำลังแข่ง)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{court.status === 'WAITING_PLAYERS' ? 'รอผู้ท้าชิง' : 'คอร์ดว่าง'}</span>
            </div>
          )}
        </div>

        {/* Right: Quick Court Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isMatchActive && (
            <button
              type="button"
              onClick={() => setIsQuickScoreOpen(true)}
              className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs transition active:scale-95 touch-manipulation"
              title="เปิดหน้าต่างใส่คะแนนด่วน (Quick Score)"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-300" />
              <span>ใส่แต้มด่วน</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSwapSides}
            disabled={!court.teamA && !court.teamB}
            className="min-h-[36px] flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200/80 shadow-xs disabled:opacity-40 transition active:scale-95 touch-manipulation"
            title="สลับฝั่งทีม A และทีม B"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">สลับฝั่ง</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScoreA(0);
              setScoreB(0);
            }}
            disabled={scoreA === 0 && scoreB === 0}
            className="min-h-[36px] flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200/80 shadow-xs disabled:opacity-40 transition active:scale-95 touch-manipulation"
            title="รีเซ็ตคะแนนเป็น 0 - 0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">รีเซ็ตแต้ม</span>
          </button>
        </div>
      </div>

      {/* Badminton Court Surface */}
      <div className="p-3 sm:p-5 lg:p-6 bg-[#f4f7f5]/80">
        <div className="relative rounded-2xl overflow-hidden border border-emerald-900/10 bg-gradient-to-b from-[#eaf5ef] to-[#e4f1ea] p-3 sm:p-5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.03)]">
          {/* Authentic Court Markings */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute inset-x-4 sm:inset-x-8 inset-y-0 border-x-2 border-emerald-800" />
            <div className="absolute top-[28%] inset-x-0 border-b border-emerald-800" />
            <div className="absolute bottom-[28%] inset-x-0 border-t border-emerald-800" />
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l border-emerald-800" />
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 border-t-2 border-dashed border-emerald-900/60" />
          </div>

          {/* Teams Split Arena */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 relative z-10">
            {/* ------------------- TEAM A ------------------- */}
            <div
              className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all backdrop-blur-md ${
                court.teamA
                  ? 'bg-white/95 border border-emerald-200/80 shadow-xs'
                  : 'bg-white/60 border border-dashed border-neutral-300'
              }`}
            >
              {court.teamA ? (
                <>
                  {/* Team A Header */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                          ฝั่ง A
                        </span>
                        {/* Server Toggle Button */}
                        <button
                          type="button"
                          onClick={() => setServer('A')}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg transition touch-manipulation flex items-center gap-1 ${
                            server === 'A'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs font-bold'
                              : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                          }`}
                          title={server === 'A' ? 'กำลังเป็นฝ่ายเสิร์ฟ' : 'คลิกเพื่อเปลี่ยนเป็นฝ่ายเสิร์ฟ'}
                        >
                          <span>🏸</span>
                          <span>{server === 'A' ? 'เสิร์ฟ' : 'ขอเสิร์ฟ'}</span>
                        </button>
                      </div>

                      {/* Sub to bench */}
                      <button
                        type="button"
                        onClick={() => onSubToRest('A')}
                        title="ย้ายทีม A ไปพักข้างคอร์ด"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition touch-manipulation"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Team Name */}
                    <div className="mt-2.5">
                      <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2 truncate">
                        <span className="truncate">{court.teamA.name}</span>
                        {court.teamA.consecutiveWins > 0 && (
                          <span
                            title={`ชนะติดต่อกันแล้ว ${court.teamA.consecutiveWins} เกม`}
                            className="shrink-0"
                          >
                            <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                          </span>
                        )}
                      </h3>

                      {/* Metadata: Streak & Matches */}
                      <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                        {court.teamA.consecutiveWins >= 2 ? (
                          <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-md">
                            ราชาคอร์ด (ชนะ 2/2 · สลับออก)
                          </span>
                        ) : court.teamA.consecutiveWins === 1 ? (
                          <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 rounded-md">
                            ครองคอร์ด (ชนะ 1 เกม)
                          </span>
                        ) : (
                          <span>ผู้ท้าชิง</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>แข่ง {court.teamA.totalMatches} แมตช์</span>
                      </div>
                    </div>
                  </div>

                  {/* Score & Counter Controls */}
                  <div className="my-4 p-3.5 bg-neutral-50/80 rounded-2xl border border-neutral-200/70 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setIsQuickScoreOpen(true)}
                      className="text-left group cursor-pointer focus:outline-none touch-manipulation flex-1"
                      title="แตะเพื่อพิมพ์คะแนนโดยตรง"
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 group-hover:text-emerald-700 transition">
                        คะแนน (แตะพิมพ์)
                      </span>
                      <div className="font-mono tabular-nums text-5xl sm:text-6xl font-black text-neutral-900 tracking-tight leading-none mt-0.5 group-hover:text-emerald-700 transition">
                        {scoreA}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleScoreChange('A', -1)}
                        className="w-11 h-12 rounded-xl bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center border border-neutral-200 shadow-xs transition active:scale-90 touch-manipulation font-bold"
                        title="ลด 1 คะแนน"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScoreChange('A', 1)}
                        className="w-14 sm:w-16 h-12 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 flex items-center justify-center font-bold text-2xl shadow-xs transition active:scale-90 touch-manipulation"
                        title="เพิ่ม 1 คะแนน (+1)"
                      >
                        <Plus className="w-6 h-6 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Win Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenConfirm('A')}
                    disabled={!court.teamB}
                    className="w-full min-h-[46px] py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                  >
                    <Award className="w-4 h-4" />
                    <span>ทีม A ชนะเกมนี้</span>
                  </button>
                </>
              ) : (
                <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center p-4">
                  <div className="w-11 h-11 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                    <Swords className="w-5 h-5" />
                  </div>
                  <h4 className="text-neutral-800 font-semibold text-sm">ฝั่ง A ว่าง</h4>
                  <p className="text-xs text-neutral-500 mt-0.5 max-w-[200px]">
                    ยังไม่มีผู้เล่นขึ้นคอร์ดฝั่งนี้
                  </p>
                  {queue.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => onSeatNextChallenger('A')}
                      className="mt-3.5 px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs transition touch-manipulation active:scale-95 flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>เชิญ {queue[0].name}</span>
                    </button>
                  ) : (
                    <span className="mt-3 text-xs text-neutral-400">ไม่มีคิวรอ</span>
                  )}
                </div>
              )}
            </div>

            {/* ------------------- TEAM B ------------------- */}
            <div
              className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all backdrop-blur-md ${
                court.teamB
                  ? 'bg-white/95 border border-blue-200/80 shadow-xs'
                  : 'bg-white/60 border border-dashed border-neutral-300'
              }`}
            >
              {court.teamB ? (
                <>
                  {/* Team B Header */}
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                          ฝั่ง B
                        </span>
                        {/* Server Toggle Button */}
                        <button
                          type="button"
                          onClick={() => setServer('B')}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg transition touch-manipulation flex items-center gap-1 ${
                            server === 'B'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs font-bold'
                              : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                          }`}
                          title={server === 'B' ? 'กำลังเป็นฝ่ายเสิร์ฟ' : 'คลิกเพื่อเปลี่ยนเป็นฝ่ายเสิร์ฟ'}
                        >
                          <span>🏸</span>
                          <span>{server === 'B' ? 'เสิร์ฟ' : 'ขอเสิร์ฟ'}</span>
                        </button>
                      </div>

                      {/* Sub to bench */}
                      <button
                        type="button"
                        onClick={() => onSubToRest('B')}
                        title="ย้ายทีม B ไปพักข้างคอร์ด"
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition touch-manipulation"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Team Name */}
                    <div className="mt-2.5">
                      <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2 truncate">
                        <span className="truncate">{court.teamB.name}</span>
                        {court.teamB.consecutiveWins > 0 && (
                          <span
                            title={`ชนะติดต่อกันแล้ว ${court.teamB.consecutiveWins} เกม`}
                            className="shrink-0"
                          >
                            <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                          </span>
                        )}
                      </h3>

                      {/* Metadata: Streak & Matches */}
                      <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                        {court.teamB.consecutiveWins >= 2 ? (
                          <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-md">
                            ราชาคอร์ด (ชนะ 2/2 · สลับออก)
                          </span>
                        ) : court.teamB.consecutiveWins === 1 ? (
                          <span className="font-semibold text-blue-800 bg-blue-50 border border-blue-200/90 px-2 py-0.5 rounded-md">
                            ครองคอร์ด (ชนะ 1 เกม)
                          </span>
                        ) : (
                          <span>ผู้ท้าชิง</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>แข่ง {court.teamB.totalMatches} แมตช์</span>
                      </div>
                    </div>
                  </div>

                  {/* Score & Counter Controls */}
                  <div className="my-4 p-3.5 bg-neutral-50/80 rounded-2xl border border-neutral-200/70 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setIsQuickScoreOpen(true)}
                      className="text-left group cursor-pointer focus:outline-none touch-manipulation flex-1"
                      title="แตะเพื่อพิมพ์คะแนนโดยตรง"
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 group-hover:text-blue-700 transition">
                        คะแนน (แตะพิมพ์)
                      </span>
                      <div className="font-mono tabular-nums text-5xl sm:text-6xl font-black text-neutral-900 tracking-tight leading-none mt-0.5 group-hover:text-blue-700 transition">
                        {scoreB}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleScoreChange('B', -1)}
                        className="w-11 h-12 rounded-xl bg-white hover:bg-neutral-100 text-neutral-700 flex items-center justify-center border border-neutral-200 shadow-xs transition active:scale-90 touch-manipulation font-bold"
                        title="ลด 1 คะแนน"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScoreChange('B', 1)}
                        className="w-14 sm:w-16 h-12 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 flex items-center justify-center font-bold text-2xl shadow-xs transition active:scale-90 touch-manipulation"
                        title="เพิ่ม 1 คะแนน (+1)"
                      >
                        <Plus className="w-6 h-6 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Win Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenConfirm('B')}
                    disabled={!court.teamA}
                    className="w-full min-h-[46px] py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-xs active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                  >
                    <Award className="w-4 h-4" />
                    <span>ทีม B ชนะเกมนี้</span>
                  </button>
                </>
              ) : (
                <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center p-4">
                  <div className="w-11 h-11 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                    <Swords className="w-5 h-5" />
                  </div>
                  <h4 className="text-neutral-800 font-semibold text-sm">ฝั่ง B ว่าง</h4>
                  <p className="text-xs text-neutral-500 mt-0.5 max-w-[200px]">
                    ยังไม่มีผู้เล่นขึ้นคอร์ดฝั่งนี้
                  </p>
                  {queue.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => onSeatNextChallenger('B')}
                      className="mt-3.5 px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs transition touch-manipulation active:scale-95 flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>เชิญ {queue[0].name}</span>
                    </button>
                  ) : (
                    <span className="mt-3 text-xs text-neutral-400">ไม่มีคิวรอ</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK SCORE DIALOG */}
      <QuickScoreModal
        isOpen={isQuickScoreOpen}
        onClose={() => setIsQuickScoreOpen(false)}
        teamA={court.teamA}
        teamB={court.teamB}
        currentScoreA={scoreA}
        currentScoreB={scoreB}
        durationSeconds={liveDurationSeconds}
        onConfirm={handleQuickScoreConfirm}
      />

      {/* WIN CONFIRMATION MODAL */}
      {confirmWinTeam && winnerTeamObj && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 mx-auto flex items-center justify-center">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900">
                ยืนยันผลการแข่งขัน
              </h3>
              <p className="text-sm text-neutral-600">
                ทีมชนะ:{' '}
                <strong className="text-neutral-900">{winnerTeamObj.name}</strong>
              </p>
              <div className="font-mono font-bold text-xl text-neutral-800 bg-neutral-100 py-1.5 rounded-xl border border-neutral-200/80">
                {scoreA} - {scoreB}
              </div>
            </div>

            {/* Rule Outcome Callout */}
            <div
              className={`p-3.5 rounded-2xl text-xs space-y-1 ${
                willExitOnWin
                  ? 'bg-amber-50/90 text-amber-900 border border-amber-200/80'
                  : 'bg-emerald-50/90 text-emerald-900 border border-emerald-200/80'
              }`}
            >
              <div className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {willExitOnWin
                    ? 'ชนะ 2 ตาติด: สลับออกจากคอร์ดตามกฎ'
                    : 'ชนะ 1 เกม: ครองคอร์ดรอผู้ท้าชิงคนต่อไป'}
                </span>
              </div>
              <p className="text-[11px] opacity-85">
                {willExitOnWin
                  ? 'ทีมชนะและทีมแพ้จะลงไปต่อท้ายคิว โดยคนแพ้จะได้คิวอยู่หน้าคนชนะ 2 ตาติด'
                  : 'ทีมชนะจะอยู่คอร์ดต่อเพื่อเจอกับคิวอันดับ #1'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmWinTeam(null)}
                className="flex-1 py-2.5 px-4 min-h-[44px] rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmWin}
                className="flex-1 py-2.5 px-4 min-h-[44px] rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs transition"
              >
                ยืนยันผล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
