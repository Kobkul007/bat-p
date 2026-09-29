import React, { useState, useEffect } from 'react';
import { Crown, RotateCw, ArrowLeftRight, UserMinus, Plus, Minus, Award, Swords, Sparkles, CheckCircle2, Calculator, Timer, Clock } from 'lucide-react';
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
  const [server, setServer] = useState<'A' | 'B' | null>('A');

  // Live timer tick state
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Resolution confirmation modal state
  const [confirmWinTeam, setConfirmWinTeam] = useState<'A' | 'B' | null>(null);

  // Quick Score modal state
  const [isQuickScoreOpen, setIsQuickScoreOpen] = useState<boolean>(false);

  // Reset scores and server when court changes
  useEffect(() => {
    setScoreA(0);
    setScoreB(0);
    setServer('A');
  }, [court.teamA?.id, court.teamB?.id]);

  // Live tick: updates currentTime every second when match is ACTIVE to calculate duration from court.matchStartedAt
  useEffect(() => {
    if (court.status === 'ACTIVE' && court.matchStartedAt) {
      setCurrentTime(Date.now());
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [court.status, court.matchStartedAt]);

  // Calculate duration strictly from court.matchStartedAt
  const liveDurationSeconds =
    court.status === 'ACTIVE' && court.matchStartedAt
      ? Math.max(0, Math.floor((currentTime - court.matchStartedAt) / 1000))
      : 0;

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDetailedDuration = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins === 0) return `${secs} วิ`;
    return `${mins} นาที ${secs} วิ`;
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
  const loserTeamObj = confirmWinTeam === 'A' ? court.teamB : court.teamA;
  const willExitOnWin = (winnerTeamObj?.consecutiveWins || 0) + 1 >= 2;

  return (
    <div className="bg-white border border-black/[0.06] rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col">
      {/* Court Header & Live Timer Bar */}
      <div className="bg-[#fafafc] px-3.5 sm:px-6 py-3 sm:py-3.5 border-b border-black/[0.05] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${court.status === 'ACTIVE' ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse' : 'bg-neutral-300'}`} />
          <h2 className="font-semibold text-neutral-900 text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
            <span>คอร์ต 1</span>
            <button
              type="button"
              onClick={() => {
                if (court.status === 'ACTIVE') setIsQuickScoreOpen(true);
              }}
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition flex items-center gap-1.5 ${
                court.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer shadow-xs active:scale-95'
                  : court.status === 'WAITING_PLAYERS'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
              title={court.status === 'ACTIVE' ? 'คลิกเพื่อเปิดหน้าต่างบันทึกแต้มด่วน (Quick Score)' : undefined}
            >
              {court.status === 'ACTIVE' && <Calculator className="w-3 h-3 text-emerald-600" />}
              <span>{court.status === 'ACTIVE' ? 'กำลังแข่งขัน (แตะใส่แต้ม)' : court.status === 'WAITING_PLAYERS' ? 'รอผู้ท้าชิง' : 'คอร์ตว่าง'}</span>
            </button>
          </h2>
        </div>

        {/* Live Match Clock based on court.matchStartedAt */}
        {court.status === 'ACTIVE' && court.matchStartedAt ? (
          <div className="flex items-center gap-2 bg-emerald-50/90 px-3 py-1.5 rounded-2xl border border-emerald-200/80 shadow-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
            </span>
            <div className="flex items-center gap-1 text-xs text-emerald-800 font-medium">
              <Timer className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>เวลาสด:</span>
            </div>
            <span className="font-mono font-bold text-emerald-950 text-sm sm:text-base tracking-tight">
              {formatTimer(liveDurationSeconds)}
            </span>
            <span className="text-[11px] text-emerald-700 hidden sm:inline font-medium">
              ({formatDetailedDuration(liveDurationSeconds)})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-neutral-100/80 px-3 py-1.5 rounded-2xl border border-neutral-200 text-xs text-neutral-500">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            <span>{court.status === 'WAITING_PLAYERS' ? 'รอผู้ท้าชิงขึ้นคอร์ต' : 'รอเริ่มการแข่งขัน'}</span>
          </div>
        )}

        {/* Quick Court Management Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {court.status === 'ACTIVE' && court.teamA && court.teamB && (
            <button
              type="button"
              onClick={() => setIsQuickScoreOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-[#1d1d1f] hover:bg-neutral-800 text-white shadow-sm transition active:scale-95 cursor-pointer touch-manipulation min-h-[36px]"
              title="เปิดหน้าต่างบันทึกผลด่วนและแป้นตัวเลข"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-400" />
              <span>บันทึกแต้มด่วน</span>
            </button>
          )}

          <button
            onClick={onSwapSides}
            disabled={!court.teamA && !court.teamB}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-xl bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200/80 shadow-sm disabled:opacity-40 transition touch-manipulation active:scale-95 min-h-[36px]"
            title="สลับฝั่งทีม A และทีม B"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">สลับฝั่ง</span>
          </button>

          <button
            onClick={() => {
              setScoreA(0);
              setScoreB(0);
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-xl bg-white hover:bg-neutral-50 text-neutral-600 border border-neutral-200/80 shadow-sm transition touch-manipulation active:scale-95 min-h-[36px]"
            title="รีเซ็ตคะแนนเป็น 0-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">รีเซ็ตแต้ม</span>
          </button>
        </div>
      </div>

      {/* Visual Badminton Court Arena (Apple Clean Styling) */}
      <div className="p-2 sm:p-5 lg:p-6 bg-[#f5f5f7]/60">
        <div className="relative rounded-2xl overflow-hidden border border-black/[0.06] bg-gradient-to-b from-[#f0fdf4]/50 to-[#ecfdf5]/80 p-3 sm:p-5 lg:p-6 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">
          {/* Subtle Court Boundary Markings */}
          <div className="absolute inset-0 pointer-events-none opacity-25">
            <div className="absolute inset-x-4 sm:inset-x-8 inset-y-0 border-x border-emerald-600" />
            <div className="absolute top-[30%] inset-x-0 border-b border-emerald-600" />
            <div className="absolute bottom-[30%] inset-x-0 border-t border-emerald-600" />
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l border-emerald-600" />
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 border-t-2 border-dashed border-emerald-700/60" />
          </div>

          {/* Teams Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6 relative z-10">
            {/* TEAM A CARD */}
            <div className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all backdrop-blur-md ${
              court.teamA
                ? 'bg-white/95 border border-black/[0.06] shadow-sm'
                : 'bg-white/50 border border-dashed border-neutral-300'
            }`}>
              {court.teamA ? (
                <>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ฝั่ง A
                        </span>
                        {/* Server Badge */}
                        {server === 'A' ? (
                          <span
                            onClick={() => setServer('B')}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md cursor-pointer border border-amber-200 hover:bg-amber-100/60 touch-manipulation active:scale-95"
                            title="เป็นฝ่ายเสิร์ฟ (คลิกเพื่อสลับฝ่ายเสิร์ฟ)"
                          >
                            🏸 เสิร์ฟ
                          </span>
                        ) : (
                          <button
                            onClick={() => setServer('A')}
                            className="text-[11px] text-neutral-400 hover:text-neutral-700 touch-manipulation"
                          >
                            ขอเสิร์ฟ
                          </button>
                        )}
                      </div>

                      <h3 className="text-lg sm:text-2xl font-bold text-neutral-900 mt-1.5 sm:mt-2 tracking-tight flex items-center gap-2 truncate">
                        <span className="truncate">{court.teamA.name}</span>
                        {court.teamA.consecutiveWins > 0 && (
                          <span title={`ชนะติดต่อกันแล้ว ${court.teamA.consecutiveWins} เกม`} className="shrink-0">
                            <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                          </span>
                        )}
                      </h3>

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs ${
                          court.teamA.consecutiveWins >= 2
                            ? 'bg-amber-50 text-amber-800 border border-amber-300 font-medium'
                            : court.teamA.consecutiveWins === 1
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          <Crown className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {court.teamA.consecutiveWins >= 2
                              ? 'ราชาคอร์ต (ชนะ 2/2)'
                              : court.teamA.consecutiveWins === 1
                              ? 'ครองคอร์ต (ชนะ 1 เกม)'
                              : 'ผู้ท้าชิง (0 เกม)'}
                          </span>
                        </div>

                        <span className="text-[11px] sm:text-xs text-neutral-500 bg-neutral-100/80 px-2 py-0.5 rounded-md">
                          เล่น: {court.teamA.totalMatches} แมตช์
                        </span>
                      </div>
                    </div>

                    {/* Sub / Rest Team A */}
                    <button
                      onClick={() => onSubToRest('A')}
                      title="ส่งพักข้างคอร์ต"
                      className="p-2 rounded-xl text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition touch-manipulation active:scale-95 shrink-0"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Clean Score Display with Thumb-Friendly Tap Buttons */}
                  <div className="my-3.5 sm:my-5 flex items-center justify-between bg-[#fbfbfe] p-3 sm:p-3.5 rounded-2xl border border-neutral-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                    <button
                      type="button"
                      onClick={() => setIsQuickScoreOpen(true)}
                      className="flex flex-col text-left group cursor-pointer focus:outline-none touch-manipulation active:scale-95 flex-1 pr-2"
                      title="คลิกเพื่อเปิดหน้าต่างบันทึกแต้มด่วน (Quick Score)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider group-hover:text-emerald-700 transition">
                          คะแนน
                        </span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded font-semibold transition">
                          แตะพิมพ์ด่วน ⚡
                        </span>
                      </div>
                      <div className="font-mono text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight group-hover:text-emerald-600 transition leading-none mt-1">
                        {scoreA}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleScoreChange('A', -1)}
                        className="w-12 sm:w-11 h-12 rounded-xl bg-white hover:bg-neutral-50 text-neutral-700 flex items-center justify-center border border-neutral-200 shadow-sm transition active:scale-90 touch-manipulation text-base font-bold"
                        title="ลด 1 แต้ม"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleScoreChange('A', 1)}
                        className="w-16 sm:w-16 h-12 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 flex items-center justify-center font-bold text-2xl shadow-sm transition active:scale-90 touch-manipulation"
                        title="เพิ่ม 1 แต้ม"
                      >
                        <Plus className="w-6 h-6 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Win Button */}
                  <button
                    onClick={() => handleOpenConfirm('A')}
                    disabled={!court.teamB}
                    className="w-full min-h-[46px] py-3 sm:py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm transition flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                  >
                    <Award className="w-4 h-4" />
                    <span>ทีม A ชนะเกมนี้</span>
                  </button>
                </>
              ) : (
                <div className="flex-1 min-h-[160px] sm:min-h-[200px] flex flex-col items-center justify-center text-center p-4">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                    <Swords className="w-5 h-5" />
                  </div>
                  <h4 className="text-neutral-800 font-medium text-sm">ฝั่ง A ว่าง</h4>
                  <p className="text-xs text-neutral-400 mt-1 max-w-[200px]">
                    กำลังรอผู้เล่นจากคิวขึ้นมาท้าชิง
                  </p>
                  {queue.length > 0 ? (
                    <button
                      onClick={() => onSeatNextChallenger('A')}
                      className="mt-3 px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm transition touch-manipulation active:scale-95"
                    >
                      เชิญ {queue[0].name} เข้าคอร์ต
                    </button>
                  ) : (
                    <span className="mt-3 text-xs text-neutral-400">ไม่มีคิวรอ</span>
                  )}
                </div>
              )}
            </div>

            {/* TEAM B CARD */}
            <div className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all backdrop-blur-md ${
              court.teamB
                ? 'bg-white/95 border border-black/[0.06] shadow-sm'
                : 'bg-white/50 border border-dashed border-neutral-300'
            }`}>
              {court.teamB ? (
                <>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          ฝั่ง B
                        </span>
                        {/* Server Badge */}
                        {server === 'B' ? (
                          <span
                            onClick={() => setServer('A')}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md cursor-pointer border border-amber-200 hover:bg-amber-100/60 touch-manipulation active:scale-95"
                            title="เป็นฝ่ายเสิร์ฟ (คลิกเพื่อสลับฝ่ายเสิร์ฟ)"
                          >
                            🏸 เสิร์ฟ
                          </span>
                        ) : (
                          <button
                            onClick={() => setServer('B')}
                            className="text-[11px] text-neutral-400 hover:text-neutral-700 touch-manipulation"
                          >
                            ขอเสิร์ฟ
                          </button>
                        )}
                      </div>

                      <h3 className="text-lg sm:text-2xl font-bold text-neutral-900 mt-1.5 sm:mt-2 tracking-tight flex items-center gap-2 truncate">
                        <span className="truncate">{court.teamB.name}</span>
                        {court.teamB.consecutiveWins > 0 && (
                          <span title={`ชนะติดต่อกันแล้ว ${court.teamB.consecutiveWins} เกม`} className="shrink-0">
                            <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />
                          </span>
                        )}
                      </h3>

                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs ${
                          court.teamB.consecutiveWins >= 2
                            ? 'bg-amber-50 text-amber-800 border border-amber-300 font-medium'
                            : court.teamB.consecutiveWins === 1
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          <Crown className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {court.teamB.consecutiveWins >= 2
                              ? 'ราชาคอร์ต (ชนะ 2/2)'
                              : court.teamB.consecutiveWins === 1
                              ? 'ครองคอร์ต (ชนะ 1 เกม)'
                              : 'ผู้ท้าชิง (0 เกม)'}
                          </span>
                        </div>

                        <span className="text-[11px] sm:text-xs text-neutral-500 bg-neutral-100/80 px-2 py-0.5 rounded-md">
                          เล่น: {court.teamB.totalMatches} แมตช์
                        </span>
                      </div>
                    </div>

                    {/* Sub / Rest Team B */}
                    <button
                      onClick={() => onSubToRest('B')}
                      title="ส่งพักข้างคอร์ต"
                      className="p-2 rounded-xl text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition touch-manipulation active:scale-95 shrink-0"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Clean Score Display with Thumb-Friendly Tap Buttons */}
                  <div className="my-3.5 sm:my-5 flex items-center justify-between bg-[#fbfbfe] p-3 sm:p-3.5 rounded-2xl border border-neutral-200/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                    <button
                      type="button"
                      onClick={() => setIsQuickScoreOpen(true)}
                      className="flex flex-col text-left group cursor-pointer focus:outline-none touch-manipulation active:scale-95 flex-1 pr-2"
                      title="คลิกเพื่อเปิดหน้าต่างบันทึกแต้มด่วน (Quick Score)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider group-hover:text-blue-700 transition">
                          คะแนน
                        </span>
                        <span className="text-[10px] text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded font-semibold transition">
                          แตะพิมพ์ด่วน ⚡
                        </span>
                      </div>
                      <div className="font-mono text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight group-hover:text-blue-600 transition leading-none mt-1">
                        {scoreB}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleScoreChange('B', -1)}
                        className="w-12 sm:w-11 h-12 rounded-xl bg-white hover:bg-neutral-50 text-neutral-700 flex items-center justify-center border border-neutral-200 shadow-sm transition active:scale-90 touch-manipulation text-base font-bold"
                        title="ลด 1 แต้ม"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleScoreChange('B', 1)}
                        className="w-16 sm:w-16 h-12 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 flex items-center justify-center font-bold text-2xl shadow-sm transition active:scale-90 touch-manipulation"
                        title="เพิ่ม 1 แต้ม"
                      >
                        <Plus className="w-6 h-6 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Win Button */}
                  <button
                    onClick={() => handleOpenConfirm('B')}
                    disabled={!court.teamA}
                    className="w-full min-h-[46px] py-3 sm:py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm transition flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                  >
                    <Award className="w-4 h-4" />
                    <span>ทีม B ชนะเกมนี้</span>
                  </button>
                </>
              ) : (
                <div className="flex-1 min-h-[160px] sm:min-h-[200px] flex flex-col items-center justify-center text-center p-4">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2">
                    <Swords className="w-5 h-5" />
                  </div>
                  <h4 className="text-neutral-800 font-medium text-sm">ฝั่ง B ว่าง</h4>
                  <p className="text-xs text-neutral-400 mt-1 max-w-[200px]">
                    กำลังรอผู้เล่นจากคิวขึ้นมาท้าชิง
                  </p>
                  {queue.length > 0 ? (
                    <button
                      onClick={() => onSeatNextChallenger('B')}
                      className="mt-3 px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm transition touch-manipulation active:scale-95"
                    >
                      เชิญ {queue[0].name} เข้าคอร์ต
                    </button>
                  ) : (
                    <span className="mt-3 text-xs text-neutral-400">ไม่มีคิวรอ</span>
                  )}
                </div>
              )}
            </div>

            {/* Live Match Duration & Quick Score Center Court Banner */}
            {court.status === 'ACTIVE' && court.teamA && court.teamB && (
              <div className="col-span-1 md:col-span-2 flex flex-col sm:flex-row items-center justify-center gap-2 -my-1 sm:-my-2 relative z-20">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-neutral-200 shadow-[0_4px_16px_rgba(0,0,0,0.06)] text-xs text-neutral-800">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span className="text-neutral-500 font-medium">เวลาแข่งขัน:</span>
                  <span className="font-mono font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md text-sm border border-neutral-200/80">
                    {formatTimer(liveDurationSeconds)}
                  </span>
                  {court.matchStartedAt && (
                    <span className="text-neutral-400 text-[11px] hidden sm:inline">
                      ({formatDetailedDuration(liveDurationSeconds)})
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsQuickScoreOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-full bg-[#1d1d1f] hover:bg-neutral-800 text-white text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer touch-manipulation"
                  title="คลิกเพื่อเปิดหน้าต่างบันทึกแต้มด่วน (Quick Score)"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-400" />
                  <span>บันทึกแต้มด่วน (Quick Score)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK SCORE DIALOG (KEYPAD-FRIENDLY FINAL SCORE INPUT) */}
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

      {/* WIN RESOLUTION CONFIRMATION MODAL (APPLE CLEAN WHITE) */}
      {confirmWinTeam && winnerTeamObj && loserTeamObj && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-black/[0.08] rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-xl">
                👑
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  ยืนยันผลการแข่งขัน
                </h3>
                <p className="text-xs text-neutral-500">
                  ระบบจะสลับคิวตามกฎราชาคอร์ต (ชนะสูงสุด 2 เกม)
                </p>
              </div>
            </div>

            {/* Score & Match Summary */}
            <div className="mt-4 p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-center justify-between">
              <div className="flex-1 text-center">
                <span className="text-[11px] text-emerald-700 font-medium block">ทีม A</span>
                <span className="font-semibold text-neutral-900 text-sm truncate block">{court.teamA?.name}</span>
                <span className="text-2xl font-mono font-bold text-neutral-900">{scoreA}</span>
              </div>
              <div className="px-3 text-neutral-400 font-bold text-xs">VS</div>
              <div className="flex-1 text-center">
                <span className="text-[11px] text-blue-700 font-medium block">ทีม B</span>
                <span className="font-semibold text-neutral-900 text-sm truncate block">{court.teamB?.name}</span>
                <span className="text-2xl font-mono font-bold text-neutral-900">{scoreB}</span>
              </div>
            </div>

            {/* Outcome Explanation Box */}
            <div className="mt-4 p-4 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 text-xs space-y-2">
              <div className="flex items-center gap-2 font-medium text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>ผู้ชนะ: {winnerTeamObj.name}</span>
              </div>

              {willExitOnWin ? (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>เงื่อนไข B: ชนะครบ 2 เกมติด (สลับออกไปต่อท้ายคิว)</span>
                  </div>
                  <p className="text-neutral-700 leading-relaxed">
                    • <strong>{winnerTeamObj.name}</strong> ชนะครบ 2 เกมติดแล้ว รีเซ็ตสถิติชนะติดเป็น 0 และไปต่อ<strong>ท้ายสุดของคิว</strong> (ตามหลังผู้แพ้)
                  </p>
                  <p className="text-neutral-700 leading-relaxed">
                    • ว่างคอร์ตทั้งสองฝั่ง และดึง <strong>2 ทีมใหม่</strong> จากหัวคิวขึ้นมาเปิดเกมใหม่
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-emerald-600" />
                    <span>เงื่อนไข A: ผู้ชนะอยู่ต่อในคอร์ต (สถิติ: ชนะ 1/2 เกม)</span>
                  </div>
                  <p className="text-neutral-700 leading-relaxed">
                    • <strong>{winnerTeamObj.name}</strong> อยู่ในคอร์ตต่อเพื่อรอผู้ท้าชิง
                  </p>
                  <p className="text-neutral-700 leading-relaxed">
                    • <strong>{loserTeamObj.name}</strong> รีเซ็ตสถิติชนะติดเป็น 0 และไปต่อท้ายคิว
                  </p>
                  <p className="text-neutral-700 leading-relaxed">
                    • ดึงผู้ท้าชิง 1 ทีมจากหัวแถวคิวขึ้นมาสู้กับราชาคอร์ต
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmWinTeam(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmWin}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-sm transition"
              >
                ยืนยันผลและเลื่อนคิว
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
