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
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white border border-black/[0.08] rounded-3xl max-w-lg w-full p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.18)] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">ตารางอันดับผู้เล่น (Leaderboard)</h3>
              <p className="text-xs text-neutral-500">จัดอันดับตามจำนวนเกมที่ชนะและสถิติการเล่น</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Standings Table */}
        <div className="mt-4 max-h-[380px] overflow-y-auto">
          {sortedList.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-8">ยังไม่มีรายชื่อผู้เล่นในรอบนี้</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 text-[11px] font-medium uppercase tracking-wider">
                  <th className="py-2.5 px-3">อันดับ</th>
                  <th className="py-2.5 px-3">ชื่อคู่ผู้เล่น</th>
                  <th className="py-2.5 px-3 text-center">ชนะ</th>
                  <th className="py-2.5 px-3 text-center">เล่นทั้งหมด</th>
                  <th className="py-2.5 px-3 text-center">ชนะติด</th>
                  <th className="py-2.5 px-3 text-right">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedList.map((item, idx) => {
                  return (
                    <tr key={item.pair.id} className="hover:bg-neutral-50/80 transition">
                      <td className="py-3 px-3 font-medium text-neutral-600">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </td>
                      <td className="py-3 px-3 font-medium text-[#1d1d1f]">
                        <div className="flex items-center gap-1.5">
                          <span>{item.pair.name}</span>
                          {item.pair.consecutiveWins > 0 && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-emerald-600">
                        {item.wins}
                      </td>
                      <td className="py-3 px-3 text-center text-neutral-600">
                        {item.totalMatches}
                      </td>
                      <td className="py-3 px-3 text-center font-medium text-amber-600">
                        {item.pair.consecutiveWins}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
                          item.pair.status === 'playing'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            : item.pair.status === 'waiting'
                            ? 'bg-neutral-100 text-neutral-600'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                        }`}>
                          {item.pair.status === 'playing' ? 'กำลังแข่ง' : item.pair.status === 'waiting' ? 'รอคิว' : 'พัก'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-neutral-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-medium bg-[#1d1d1f] text-white hover:bg-neutral-800 transition shadow-sm"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
