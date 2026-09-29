import React, { useState, useEffect } from 'react';
import { Crown, Sparkles, X, Check, Award, Calculator, Delete, ArrowRight } from 'lucide-react';
import { PlayerPair } from '../types/badminton';
import { sounds } from '../services/soundEffects';

interface QuickScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamA: PlayerPair | null;
  teamB: PlayerPair | null;
  currentScoreA: number;
  currentScoreB: number;
  durationSeconds: number;
  onConfirm: (winner: 'A' | 'B', scoreA: number, scoreB: number) => void;
}

const BADMINTON_PRESETS = [
  { label: '21 - 19', winScore: 21, loseScore: 19 },
  { label: '21 - 18', winScore: 21, loseScore: 18 },
  { label: '21 - 17', winScore: 21, loseScore: 17 },
  { label: '21 - 15', winScore: 21, loseScore: 15 },
  { label: '21 - 12', winScore: 21, loseScore: 12 },
  { label: '21 - 9', winScore: 21, loseScore: 9 },
  { label: '30 - 29', winScore: 30, loseScore: 29 },
];

export const QuickScoreModal: React.FC<QuickScoreModalProps> = ({
  isOpen,
  onClose,
  teamA,
  teamB,
  currentScoreA,
  currentScoreB,
  onConfirm,
}) => {
  const [selectedWinner, setSelectedWinner] = useState<'A' | 'B'>('A');
  const [scoreA, setScoreA] = useState<string>('21');
  const [scoreB, setScoreB] = useState<string>('19');
  const [activeTarget, setActiveTarget] = useState<'A' | 'B'>('B'); // Default to editing loser score if winner is 21

  // Initialize scores whenever modal opens
  useEffect(() => {
    if (isOpen) {
      // Determine initial winner based on current rally scores or default to 21-19
      const winA = currentScoreA >= currentScoreB;
      const initialWin = winA ? 'A' : 'B';
      setSelectedWinner(initialWin);

      if (currentScoreA > 0 || currentScoreB > 0) {
        setScoreA(String(currentScoreA));
        setScoreB(String(currentScoreB));
        setActiveTarget(winA ? 'B' : 'A');
      } else {
        setScoreA(initialWin === 'A' ? '21' : '19');
        setScoreB(initialWin === 'B' ? '21' : '19');
        setActiveTarget(initialWin === 'A' ? 'B' : 'A');
      }
    }
  }, [isOpen, currentScoreA, currentScoreB]);

  if (!isOpen || !teamA || !teamB) return null;

  const winnerObj = selectedWinner === 'A' ? teamA : teamB;
  const loserObj = selectedWinner === 'A' ? teamB : teamA;
  const willExitAfterMatch = (winnerObj.consecutiveWins || 0) + 1 >= 2;

  // Keypad click handlers
  const handleDigit = (digit: string) => {
    sounds.playPoint();
    if (activeTarget === 'A') {
      setScoreA((prev) => {
        if (prev === '0' || prev === '') return digit;
        const next = prev + digit;
        return parseInt(next, 10) > 30 ? '30' : next;
      });
    } else {
      setScoreB((prev) => {
        if (prev === '0' || prev === '') return digit;
        const next = prev + digit;
        return parseInt(next, 10) > 30 ? '30' : next;
      });
    }
  };

  const handleBackspace = () => {
    sounds.playPoint();
    if (activeTarget === 'A') {
      setScoreA((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else {
      setScoreB((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    }
  };

  const handleClear = () => {
    sounds.playPoint();
    if (activeTarget === 'A') setScoreA('0');
    else setScoreB('0');
  };

  const handleQuick21 = () => {
    sounds.playPoint();
    if (activeTarget === 'A') setScoreA('21');
    else setScoreB('21');
  };

  const handleAdjustDelta = (delta: number) => {
    sounds.playPoint();
    if (activeTarget === 'A') {
      setScoreA((prev) => {
        const val = Math.max(0, Math.min(30, (parseInt(prev, 10) || 0) + delta));
        return String(val);
      });
    } else {
      setScoreB((prev) => {
        const val = Math.max(0, Math.min(30, (parseInt(prev, 10) || 0) + delta));
        return String(val);
      });
    }
  };

  const handleSelectWinner = (team: 'A' | 'B') => {
    setSelectedWinner(team);
    // Auto-swap scores if current loser score was higher than winner score
    const numA = parseInt(scoreA, 10) || 0;
    const numB = parseInt(scoreB, 10) || 0;
    if (team === 'A' && numA <= numB) {
      setScoreA('21');
      if (numB >= 21) setScoreB('19');
      setActiveTarget('B');
    } else if (team === 'B' && numB <= numA) {
      setScoreB('21');
      if (numA >= 21) setScoreA('19');
      setActiveTarget('A');
    }
  };

  const handleApplyPreset = (preset: typeof BADMINTON_PRESETS[0]) => {
    sounds.playPoint();
    if (selectedWinner === 'A') {
      setScoreA(String(preset.winScore));
      setScoreB(String(preset.loseScore));
      setActiveTarget('B');
    } else {
      setScoreA(String(preset.loseScore));
      setScoreB(String(preset.winScore));
      setActiveTarget('A');
    }
  };

  const handleConfirm = () => {
    const finalA = parseInt(scoreA, 10) || 0;
    const finalB = parseInt(scoreB, 10) || 0;
    onConfirm(selectedWinner, finalA, finalB);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-black/[0.08] rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-sm shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-[#1d1d1f]">บันทึกแต้มด่วน (Quick Score)</h3>
                <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  กำลังแข่งขัน
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500">
                เลือกคู่ที่ชนะและกดกรอกคะแนนจบเกมด้วยแป้นตัวเลข
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition touch-manipulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 pr-0.5 space-y-3.5 mt-3">
          {/* 1. SELECT WINNING TEAM */}
          <div>
            <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>1. เลือกคู่ที่ชนะเกมนี้</span>
              <span className="text-neutral-400 font-normal">แตะเลือก 1 ฝั่ง</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Team A Option Card */}
              <button
                type="button"
                onClick={() => handleSelectWinner('A')}
                className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative touch-manipulation active:scale-[0.98] ${
                  selectedWinner === 'A'
                    ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                    : 'bg-[#fafafc] border-neutral-200/80 hover:bg-white hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100/60 text-emerald-800">
                    ฝั่ง A
                  </span>
                  {selectedWinner === 'A' && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3 stroke-[3]" /> ชนะ
                    </span>
                  )}
                </div>
                <div className="mt-1.5 font-bold text-sm sm:text-base text-neutral-900 truncate">
                  {teamA.name}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500">
                  <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>ชนะติด {teamA.consecutiveWins} เกม</span>
                </div>
              </button>

              {/* Team B Option Card */}
              <button
                type="button"
                onClick={() => handleSelectWinner('B')}
                className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all relative touch-manipulation active:scale-[0.98] ${
                  selectedWinner === 'B'
                    ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                    : 'bg-[#fafafc] border-neutral-200/80 hover:bg-white hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100/60 text-blue-800">
                    ฝั่ง B
                  </span>
                  {selectedWinner === 'B' && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3 stroke-[3]" /> ชนะ
                    </span>
                  )}
                </div>
                <div className="mt-1.5 font-bold text-sm sm:text-base text-neutral-900 truncate">
                  {teamB.name}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500">
                  <Crown className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>ชนะติด {teamB.consecutiveWins} เกม</span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. INTERACTIVE SCOREBOARD INPUT TARGET */}
          <div>
            <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>2. ผลคะแนนสุดท้าย (แตะช่องเพื่อพิมพ์)</span>
              <span className="text-neutral-500 font-medium text-[10px] truncate max-w-[160px]">
                พิมพ์: {activeTarget === 'A' ? teamA.name : teamB.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 items-center bg-[#f5f5f7] p-2.5 sm:p-3 rounded-2xl border border-neutral-200/80">
              {/* Team A Score Box */}
              <button
                type="button"
                onClick={() => setActiveTarget('A')}
                className={`p-2.5 sm:p-3 rounded-xl text-center transition-all touch-manipulation ${
                  activeTarget === 'A'
                    ? 'bg-white border-2 border-[#1d1d1f] shadow-md ring-2 ring-black/5'
                    : 'bg-white/80 border border-neutral-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-neutral-500">
                  <span className="truncate">{teamA.name}</span>
                  {selectedWinner === 'A' && <span className="text-emerald-600 font-semibold shrink-0">(ชนะ)</span>}
                </div>
                <div className="font-mono text-3xl sm:text-4xl font-bold text-neutral-900 mt-0.5">
                  {scoreA}
                </div>
                {activeTarget === 'A' ? (
                  <span className="text-[10px] text-emerald-700 font-medium block mt-0.5 animate-pulse">
                    ● กำลังพิมพ์ช่องนี้
                  </span>
                ) : (
                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                    แตะเพื่อแก้ไข
                  </span>
                )}
              </button>

              {/* Team B Score Box */}
              <button
                type="button"
                onClick={() => setActiveTarget('B')}
                className={`p-2.5 sm:p-3 rounded-xl text-center transition-all touch-manipulation ${
                  activeTarget === 'B'
                    ? 'bg-white border-2 border-[#1d1d1f] shadow-md ring-2 ring-black/5'
                    : 'bg-white/80 border border-neutral-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-neutral-500">
                  <span className="truncate">{teamB.name}</span>
                  {selectedWinner === 'B' && <span className="text-blue-600 font-semibold shrink-0">(ชนะ)</span>}
                </div>
                <div className="font-mono text-3xl sm:text-4xl font-bold text-neutral-900 mt-0.5">
                  {scoreB}
                </div>
                {activeTarget === 'B' ? (
                  <span className="text-[10px] text-blue-700 font-medium block mt-0.5 animate-pulse">
                    ● กำลังพิมพ์ช่องนี้
                  </span>
                ) : (
                  <span className="text-[10px] text-neutral-400 block mt-0.5">
                    แตะเพื่อแก้ไข
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 3. QUICK SCORE PRESETS */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                แต้มจบเกมยอดนิยม (แตะครั้งเดียว)
              </span>
            </div>
            <div className="flex overflow-x-auto pb-1 gap-1.5 no-scrollbar sm:flex-wrap">
              {BADMINTON_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1.5 text-xs font-mono font-medium rounded-xl bg-[#f5f5f7] hover:bg-neutral-200/80 text-neutral-800 border border-neutral-200/70 transition active:scale-95 touch-manipulation shrink-0"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. KEYPAD-FRIENDLY NUMPAD */}
          <div className="bg-[#f5f5f7]/70 p-2.5 sm:p-3 rounded-2xl border border-neutral-200/80">
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {/* Row 1 */}
              <button
                type="button"
                onClick={() => handleDigit('1')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleDigit('2')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleDigit('3')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDelta(1)}
                className="py-3 rounded-xl bg-neutral-200/90 hover:bg-neutral-300 text-neutral-800 font-semibold text-xs sm:text-sm border border-neutral-300 transition active:scale-95 touch-manipulation min-h-[46px]"
              >
                +1 แต้ม
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={() => handleDigit('4')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleDigit('5')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleDigit('6')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDelta(-1)}
                className="py-3 rounded-xl bg-neutral-200/90 hover:bg-neutral-300 text-neutral-800 font-semibold text-xs sm:text-sm border border-neutral-300 transition active:scale-95 touch-manipulation min-h-[46px]"
              >
                -1 แต้ม
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => handleDigit('7')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleDigit('8')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleDigit('9')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                9
              </button>
              <button
                type="button"
                onClick={handleQuick21}
                className="py-3 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold text-xs sm:text-sm border border-emerald-300 transition active:scale-95 touch-manipulation min-h-[46px]"
              >
                21 แต้ม
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={handleClear}
                className="py-3 rounded-xl bg-neutral-200/90 hover:bg-neutral-300 text-neutral-700 font-semibold text-xs sm:text-sm border border-neutral-300 transition active:scale-95 touch-manipulation min-h-[46px]"
              >
                ล้าง (C)
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="py-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-lg border border-neutral-200 shadow-sm transition active:scale-95 touch-manipulation select-none min-h-[46px]"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="py-3 rounded-xl bg-neutral-200/90 hover:bg-neutral-300 text-neutral-700 flex items-center justify-center font-semibold text-sm border border-neutral-300 transition active:scale-95 touch-manipulation min-h-[46px]"
                title="ลบตัวเลขตัวท้าย"
              >
                <Delete className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTarget(activeTarget === 'A' ? 'B' : 'A')}
                className="py-3 rounded-xl bg-[#1d1d1f] text-white hover:bg-neutral-800 flex items-center justify-center gap-1 font-medium text-xs transition active:scale-95 touch-manipulation min-h-[46px]"
              >
                <span>สลับช่อง</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* 5. RULE & OUTCOME SUMMARY BANNER */}
          <div className="p-3 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs">
            {willExitAfterMatch ? (
              <div className="flex items-start gap-2 text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">ชนะครบ 2/2 เกม (ครองคอร์ตครบโควตา):</span>{' '}
                  <strong>{winnerObj.name}</strong> จะย้ายไปต่อท้ายคิว และดึง 2 ทีมใหม่ขึ้นมา
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-emerald-800">
                <Crown className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">ผู้ชนะอยู่ต่อ (ชนะ 1/2 เกม):</span>{' '}
                  <strong>{winnerObj.name}</strong> จะครองคอร์ตต่อ และดึง 1 ทีมจากหัวคิวขึ้นมาสู้
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6. MODAL ACTIONS (STICKY FOOTER IN MODAL) */}
        <div className="pt-3.5 mt-2 border-t border-neutral-100 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-full text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition touch-manipulation min-h-[44px]"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-full text-xs font-semibold bg-[#1d1d1f] hover:bg-neutral-800 text-white shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 touch-manipulation min-h-[44px]"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate">ยืนยันผล ({selectedWinner === 'A' ? teamA.name : teamB.name} ชนะ)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
