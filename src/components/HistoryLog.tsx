import React, { useState } from 'react';
import { History, Download, FileSpreadsheet, Search, Crown, Sparkles, Clock, Trophy } from 'lucide-react';
import { MatchHistoryItem } from '../types/badminton';

interface HistoryLogProps {
  history: MatchHistoryItem[];
  onExportCsv: () => void;
  onOpenSheets: () => void;
  sheetsConnected: boolean;
}

export const HistoryLog: React.FC<HistoryLogProps> = ({
  history,
  onExportCsv,
  onOpenSheets,
  sheetsConnected,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredHistory = history.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.teamA.toLowerCase().includes(term) ||
      item.teamB.toLowerCase().includes(term) ||
      item.winner.toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center font-medium">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-neutral-900 text-sm sm:text-base tracking-tight">
                ประวัติการแข่งขัน
              </h3>
              <span className="font-mono text-xs font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                {history.length} แมตช์
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              บันทึกคะแนนและสถานะครองคอร์ด
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSheets}
            className={`min-h-[34px] flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-xl transition ${
              sheetsConnected
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80 border border-neutral-200/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{sheetsConnected ? 'ซิงค์ชีตแล้ว' : 'เชื่อมต่อชีต'}</span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            disabled={history.length === 0}
            className="min-h-[34px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-xl shadow-xs disabled:opacity-30 transition"
            title="ดาวน์โหลดไฟล์ CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      {history.length > 0 && (
        <div className="mt-3 relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อคู่ หรือผลการแข่ง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3.5 py-1.5 bg-neutral-50 border border-neutral-200/80 focus:border-neutral-400 focus:bg-white rounded-xl text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none transition"
          />
        </div>
      )}

      {/* History Items List */}
      <div className="mt-3 space-y-2.5 max-h-[480px] overflow-y-auto pr-0.5">
        {filteredHistory.length === 0 ? (
          <div className="py-8 text-center rounded-2xl bg-neutral-50/70 border border-dashed border-neutral-200">
            <p className="text-xs text-neutral-400">
              {history.length === 0 ? 'ยังไม่มีประวัติการแข่งขันที่จบในรอบนี้' : 'ไม่พบรายการที่ค้นหา'}
            </p>
          </div>
        ) : (
          filteredHistory.map((item, idx) => {
            const matchNum = history.length - idx;
            const durationMins = item.durationSeconds
              ? `${Math.floor(item.durationSeconds / 60)} นาที ${item.durationSeconds % 60} วิ`
              : null;

            return (
              <div
                key={item.matchId || idx}
                className="bg-neutral-50/60 border border-neutral-200/80 rounded-2xl p-3 hover:border-neutral-300 hover:bg-white transition"
              >
                {/* Meta row */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-neutral-800 bg-white border border-neutral-200/80 px-2 py-0.5 rounded-md">
                      #{matchNum}
                    </span>
                    <span className="flex items-center gap-1 text-neutral-400">
                      <Clock className="w-3 h-3" />
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {durationMins && (
                      <span className="text-neutral-400 hidden sm:inline">
                        ({durationMins})
                      </span>
                    )}
                  </div>

                  {/* King Outcome Tag */}
                  {item.forcedExit ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      <Sparkles className="w-3 h-3" />
                      <span>ชนะ 2 เกมติด · สลับออก</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      <Crown className="w-3 h-3 text-emerald-600" />
                      <span>ชนะ {item.winnerConsecutiveWinsAfter}/2 · ครองคอร์ดต่อ</span>
                    </span>
                  )}
                </div>

                {/* Match Score & Teams */}
                <div className="flex items-center justify-between bg-white rounded-xl p-2.5 border border-neutral-200/70">
                  <div
                    className={`flex-1 text-left min-w-0 pr-2 ${
                      item.winner === item.teamA
                        ? 'font-bold text-emerald-800'
                        : 'text-neutral-500'
                    }`}
                  >
                    <div className="flex items-center gap-1 truncate">
                      <span className="text-xs sm:text-sm truncate">{item.teamA}</span>
                      {item.winner === item.teamA && (
                        <Trophy className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="px-3 text-center shrink-0">
                    <span className="font-mono tabular-nums font-black text-neutral-900 text-sm sm:text-base">
                      {item.scoreA !== undefined && item.scoreB !== undefined
                        ? `${item.scoreA} - ${item.scoreB}`
                        : 'VS'}
                    </span>
                  </div>

                  <div
                    className={`flex-1 text-right min-w-0 pl-2 ${
                      item.winner === item.teamB
                        ? 'font-bold text-blue-800'
                        : 'text-neutral-500'
                    }`}
                  >
                    <div className="flex items-center justify-end gap-1 truncate">
                      {item.winner === item.teamB && (
                        <Trophy className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      <span className="text-xs sm:text-sm truncate">{item.teamB}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
