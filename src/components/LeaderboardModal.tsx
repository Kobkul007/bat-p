import React from 'react';
import { Trophy, Crown, X } from 'lucide-react';
import { PlayerPair, MatchHistoryItem } from '../types/badminton';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPairs: PlayerPair[];
  history: MatchHistoryItem[];
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  allPairs,
  history,
}) => {
  if (!isOpen) return null;

  // Calculate detailed stats per pair
  const statsMap = new Map<
    string,
    {
      pair: PlayerPair;
      wins: number;
      losses: number;
      totalMatches: number;
      currentStreak: number;
      maxStreak: number;
    }
  >();

  // Initialize
  allPairs.forEach((p) => {
    statsMap.set(p.name, {
      pair: p,
      wins: 0,
      losses: 0,
      totalMatches: p.totalMatches,
      currentStreak: p.consecutiveWins,
      maxStreak: p.consecutiveWins,
    });
  });

  // Reconstruct from match history
  history.forEach((m) => {
    const winnerStats = statsMap.get(m.winner);
    if (winnerStats) {
      winnerStats.wins += 1;
      if (m.winnerConsecutiveWinsAfter > winnerStats.maxStreak) {
        winnerStats.maxStreak = m.winnerConsecutiveWinsAfter;
      }
    }

    const loser = m.winner === m.teamA ? m.teamB : m.teamA;
    const loserStats = statsMap.get(loser);
    if (loserStats) {
      loserStats.losses += 1;
    }
  });

  const sortedList = Array.from(statsMap.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pair.consecutiveWins !== a.pair.consecutiveWins) return b.pair.consecutiveWins - a.pair.consecutiveWins;
    return b.totalMatches - a.totalMatches;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-neutral-200/90 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150 my-auto">
        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 tracking-tight">
                ตารางอันดับผู้เล่น (Leaderboard)
              </h3>
              <p className="text-[11px] sm:text-xs text-neutral-500">
                จัดอันดับตามจำนวนชัยชนะ และสถิติแมตช์
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition touch-manipulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Standings Table */}
        <div className="mt-3.5 max-h-[420px] overflow-y-auto overflow-x-auto">
          {sortedList.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-8">
              ยังไม่มีรายชื่อผู้เล่นในเซสชันนี้
            </p>
          ) : (
            <table className="w-full text-left text-xs min-w-[360px]">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider sticky top-0 bg-white">
                  <th className="py-2.5 px-3">อันดับ</th>
                  <th className="py-2.5 px-3">คู่ผู้เล่น</th>
                  <th className="py-2.5 px-2 text-center">ชนะ</th>
                  <th className="py-2.5 px-2 text-center">แข่ง</th>
                  <th className="py-2.5 px-2 text-center">ชนะติด</th>
                  <th className="py-2.5 px-3 text-right">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-mono tabular-nums">
                {sortedList.map((item, idx) => {
                  return (
                    <tr key={item.pair.id} className="hover:bg-neutral-50/80 transition">
                      <td className="py-2.5 sm:py-3 px-3 font-semibold text-neutral-600 font-sans">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 font-bold text-neutral-900 font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[130px] sm:max-w-[190px]">
                            {item.pair.name}
                          </span>
                          {item.pair.consecutiveWins > 0 && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 sm:py-3 px-2 text-center font-bold text-emerald-700">
                        {item.wins}
                      </td>
                      <td className="py-2.5 sm:py-3 px-2 text-center text-neutral-600">
                        {item.totalMatches}
                      </td>
                      <td className="py-2.5 sm:py-3 px-2 text-center font-medium text-amber-700">
                        {item.pair.consecutiveWins}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 text-right font-sans">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            item.pair.status === 'playing'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : item.pair.status === 'waiting'
                              ? 'bg-neutral-100 text-neutral-600'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.pair.status === 'playing'
                            ? 'กำลังแข่ง'
                            : item.pair.status === 'waiting'
                            ? 'รอคิว'
                            : 'พัก'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 min-h-[44px] rounded-full text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition shadow-xs touch-manipulation active:scale-95"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
