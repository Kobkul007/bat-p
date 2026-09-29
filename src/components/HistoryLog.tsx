import React, { useState } from 'react';
import { History, Download, FileSpreadsheet, Search, Crown, Sparkles, Clock } from 'lucide-react';
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
    <div className="bg-white border border-black/[0.06] rounded-2xl p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center font-medium">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-[#1d1d1f] text-sm sm:text-base">ประวัติการแข่งขัน</h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f5f5f7] text-neutral-600">
                {history.length} แมตช์
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              บันทึกคะแนนและสถานะครองคอร์ต
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenSheets}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              sheetsConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/70'
                : 'bg-[#f5f5f7] text-neutral-700 border border-neutral-200/80 hover:bg-neutral-200/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{sheetsConnected ? 'ซิงค์ Sheets แล้ว' : 'เชื่อมต่อ Sheets'}</span>
          </button>

          <button
            onClick={onExportCsv}
            disabled={history.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#f5f5f7] text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/70 border border-neutral-200/80 disabled:opacity-30 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      {history.length > 0 && (
        <div className="mt-3.5 relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาตามชื่อผู้เล่นหรือคู่..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3.5 py-1.5 bg-[#f5f5f7] border border-transparent focus:border-neutral-300 focus:bg-white rounded-xl text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none transition"
          />
        </div>
      )}

      {/* History Items List */}
      <div className="mt-3.5 space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
        {filteredHistory.length === 0 ? (
          <div className="py-8 text-center rounded-2xl bg-[#f5f5f7]/60 border border-dashed border-neutral-200">
            <p className="text-xs text-neutral-400">
              {history.length === 0 ? 'ยังไม่มีประวัติการแข่งขันที่จบในรอบนี้' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
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
                className="bg-[#fbfbfd] border border-neutral-200/80 rounded-xl p-3 hover:border-neutral-300 hover:shadow-sm transition space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-600 bg-white border border-neutral-200/60 px-2 py-0.5 rounded-md">
                      แมตช์ #{matchNum}
                    </span>
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {durationMins && (
                      <span className="text-[11px] text-neutral-400 hidden sm:inline">
                        ({durationMins})
                      </span>
                    )}
                  </div>

                  {/* King Outcome Tag */}
                  {item.forcedExit ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                      <Sparkles className="w-3 h-3" />
                      ชนะ 2/2 เกม • ครบโควตาสลับออก
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                      <Crown className="w-3 h-3" />
                      ชนะ {item.winnerConsecutiveWinsAfter}/2 เกม • ครองคอร์ตต่อ
                    </span>
                  )}
                </div>

                {/* Match Score & Teams */}
                <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-neutral-100">
                  <div className={`flex-1 text-left ${item.winner === item.teamA ? 'font-semibold text-emerald-700' : 'text-neutral-500'}`}>
                    <span className="text-xs sm:text-sm">{item.teamA}</span>
                    {item.winner === item.teamA && <span className="ml-1 text-[11px]">🏆</span>}
                  </div>

                  <div className="px-3 text-center">
                    <span className="font-mono font-bold text-neutral-900 text-xs sm:text-sm">
                      {item.scoreA !== undefined && item.scoreB !== undefined ? `${item.scoreA} - ${item.scoreB}` : 'VS'}
                    </span>
                  </div>

                  <div className={`flex-1 text-right ${item.winner === item.teamB ? 'font-semibold text-blue-700' : 'text-neutral-500'}`}>
                    {item.winner === item.teamB && <span className="mr-1 text-[11px]">🏆</span>}
                    <span className="text-xs sm:text-sm">{item.teamB}</span>
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
