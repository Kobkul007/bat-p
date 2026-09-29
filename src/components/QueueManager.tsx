import React, { useState } from 'react';
import {
  Users,
  Plus,
  ArrowUp,
  ArrowDown,
  BedDouble,
  Play,
  Trash2,
  Shuffle,
  Sparkles,
  Check,
  Edit2,
  X,
  Crown,
  ArrowUpDown,
  MoreHorizontal,
} from 'lucide-react';
import { PlayerPair } from '../types/badminton';

interface QueueManagerProps {
  queue: PlayerPair[];
  restingPairs: PlayerPair[];
  canSeatDirectly: boolean;
  onAddPair: (name: string) => void;
  onAddPresets: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMoveToRest: (id: string) => void;
  onReturnFromRest: (id: string) => void;
  onRemovePair: (id: string, from: 'queue' | 'resting') => void;
  onSeatPairDirectly: (pair: PlayerPair) => void;
  onEditPairName: (id: string, newName: string) => void;
  onShuffleQueue: () => void;
  onSortQueueByRule: () => void;
}

export const QueueManager: React.FC<QueueManagerProps> = ({
  queue,
  restingPairs,
  canSeatDirectly,
  onAddPair,
  onAddPresets,
  onMoveUp,
  onMoveDown,
  onMoveToRest,
  onReturnFromRest,
  onRemovePair,
  onSeatPairDirectly,
  onEditPairName,
  onShuffleQueue,
  onSortQueueByRule,
}) => {
  const [newPairName, setNewPairName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPairName.trim()) return;
    onAddPair(newPairName.trim());
    setNewPairName('');
  };

  const startEdit = (pair: PlayerPair) => {
    setEditingId(pair.id);
    setEditNameVal(pair.name);
    setActiveMenuId(null);
  };

  const saveEdit = (id: string) => {
    if (editNameVal.trim()) {
      onEditPairName(id, editNameVal.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* QUEUE MAIN CARD */}
      <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-xs">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center font-medium">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-neutral-900 text-sm sm:text-base tracking-tight">
                  คิวผู้ท้าชิง
                </h3>
                <span className="font-mono text-xs font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {queue.length} คู่
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">
                กฎ: ชนะ 2 ตาติดออก · คนแพ้ได้ลงก่อนคนชนะ
              </p>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-1.5">
            {queue.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={onSortQueueByRule}
                  title="จัดคิวอัตโนมัติ: คนแพ้ลงก่อนคนชนะ 2 ตาติด"
                  className="min-h-[34px] flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition touch-manipulation active:scale-95"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>จัดคิวตามกฎ</span>
                </button>
                <button
                  type="button"
                  onClick={onShuffleQueue}
                  title="สุ่มสลับลำดับคิว"
                  className="min-h-[34px] flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-xl bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200 shadow-xs transition touch-manipulation active:scale-95"
                >
                  <Shuffle className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="hidden sm:inline">สุ่มคิว</span>
                </button>
              </>
            )}

            {queue.length === 0 && restingPairs.length === 0 && (
              <button
                type="button"
                onClick={onAddPresets}
                className="min-h-[34px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-xl bg-neutral-100 text-neutral-800 hover:bg-neutral-200/80 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
                <span>โหลดตัวอย่างคู่</span>
              </button>
            )}
          </div>
        </div>

        {/* Add Pair Form */}
        <form onSubmit={handleAddSubmit} className="mt-3.5 flex gap-2">
          <input
            type="text"
            placeholder="พิมพ์ชื่อคู่ผู้เล่น (เช่น ต้า + บอย, นัท + ก้อง)..."
            value={newPairName}
            onChange={(e) => setNewPairName(e.target.value)}
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-2xl px-3.5 py-2 min-h-[44px] text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={!newPairName.trim()}
            className="min-h-[44px] px-4 py-2 bg-neutral-900 text-white font-semibold text-xs sm:text-sm rounded-2xl hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95 shrink-0 shadow-xs flex items-center gap-1.5 touch-manipulation"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>เพิ่มคู่</span>
          </button>
        </form>

        {/* Queue List */}
        <div className="mt-3.5 space-y-2">
          {queue.length === 0 ? (
            <div className="py-7 text-center rounded-2xl bg-neutral-50/70 border border-dashed border-neutral-200">
              <Users className="w-6 h-6 text-neutral-400 mx-auto mb-1" />
              <p className="text-xs font-medium text-neutral-600">ยังไม่มีคู่ผู้เล่นในคิว</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                พิมพ์ชื่อคู่ด้านบน หรือคลิกโหลดคู่ตัวอย่าง
              </p>
              <button
                type="button"
                onClick={onAddPresets}
                className="mt-2.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white text-neutral-700 hover:text-neutral-900 border border-neutral-200 shadow-xs transition"
              >
                + โหลดคู่ตัวอย่าง
              </button>
            </div>
          ) : (
            queue.map((pair, idx) => {
              const isNextChallenger = idx === 0;
              const isEditing = editingId === pair.id;
              const isMenuOpen = activeMenuId === pair.id;

              return (
                <div
                  key={pair.id}
                  className={`rounded-2xl p-3 transition border ${
                    isNextChallenger
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                      : 'bg-white border-neutral-200/80 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    {/* Left: Position & Pair Name */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          isNextChallenger
                            ? 'bg-neutral-900 text-white'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        {idx + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 py-0.5">
                            <input
                              type="text"
                              value={editNameVal}
                              onChange={(e) => setEditNameVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(pair.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="bg-white text-neutral-900 text-xs px-2.5 py-1 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-900 w-full"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => saveEdit(pair.id)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-neutral-400 hover:text-neutral-600 touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-semibold text-neutral-900 text-xs sm:text-sm truncate">
                                {pair.name}
                              </span>

                              {isNextChallenger && (
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.2 rounded-full shrink-0">
                                  คิวถัดไป
                                </span>
                              )}

                              {pair.lastMatchResult === 'loss' && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.2 rounded-md shrink-0">
                                  แพ้รอบก่อน (ได้คิวก่อน)
                                </span>
                              )}

                              {pair.lastMatchResult === 'king_exit' && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5">
                                  <Crown className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                  <span>ชนะ 2 เกม (ต่อท้าย)</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                              <span>แข่ง {pair.totalMatches} แมตช์</span>
                              <span aria-hidden="true">·</span>
                              <span>ชนะติด {pair.consecutiveWins}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Seat Directly (if court slot is available) */}
                      {canSeatDirectly && (
                        <button
                          type="button"
                          onClick={() => onSeatPairDirectly(pair)}
                          title="เชิญลงคอร์ดทันที"
                          className="px-2.5 py-1 min-h-[32px] rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition text-xs font-semibold flex items-center gap-1 shadow-xs touch-manipulation active:scale-95"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span className="hidden sm:inline">ลงคอร์ด</span>
                        </button>
                      )}

                      {/* Reorder Up */}
                      <button
                        type="button"
                        onClick={() => onMoveUp(idx)}
                        disabled={idx === 0}
                        title="เลื่อนคิวขึ้น"
                        className="w-8 h-8 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-20 disabled:cursor-not-allowed transition flex items-center justify-center touch-manipulation active:scale-95"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Reorder Down */}
                      <button
                        type="button"
                        onClick={() => onMoveDown(idx)}
                        disabled={idx === queue.length - 1}
                        title="เลื่อนคิวลง"
                        className="w-8 h-8 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-20 disabled:cursor-not-allowed transition flex items-center justify-center touch-manipulation active:scale-95"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Desktop Direct Tool buttons */}
                      <div className="hidden sm:flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onMoveToRest(pair.id)}
                          title="พักข้างคอร์ด"
                          className="w-8 h-8 rounded-xl text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition flex items-center justify-center touch-manipulation"
                        >
                          <BedDouble className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(pair)}
                          title="แก้ไขชื่อ"
                          className="w-8 h-8 rounded-xl text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition flex items-center justify-center touch-manipulation"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemovePair(pair.id, 'queue')}
                          title="ลบออกจากระบบ"
                          className="w-8 h-8 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition flex items-center justify-center touch-manipulation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Mobile More Actions Menu Trigger */}
                      <div className="relative sm:hidden">
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(isMenuOpen ? null : pair.id)}
                          className="w-8 h-8 rounded-xl text-neutral-400 hover:text-neutral-800 flex items-center justify-center touch-manipulation"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 top-9 z-30 bg-white border border-neutral-200 rounded-2xl shadow-lg p-1.5 flex flex-col gap-1 min-w-[130px] animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                onMoveToRest(pair.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-xl text-xs text-neutral-700 hover:bg-neutral-100 flex items-center gap-2"
                            >
                              <BedDouble className="w-3.5 h-3.5 text-amber-500" />
                              <span>พักข้างคอร์ด</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(pair)}
                              className="w-full text-left px-3 py-1.5 rounded-xl text-xs text-neutral-700 hover:bg-neutral-100 flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-neutral-500" />
                              <span>แก้ไขชื่อ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onRemovePair(pair.id, 'queue');
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>ลบคู่</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RESTING BENCH CARD (พักข้างคอร์ด) */}
      {restingPairs.length > 0 && (
        <div className="bg-white border border-neutral-200/90 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <BedDouble className="w-3.5 h-3.5" />
              </div>
              <h4 className="font-bold text-neutral-900 text-xs sm:text-sm">
                พักข้างคอร์ด (Resting)
              </h4>
              <span className="font-mono text-xs text-neutral-500 bg-neutral-100 px-2 py-0.2 rounded-full">
                {restingPairs.length} คู่
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 hidden sm:block">
              แตะ "กลับเข้าคิว" เพื่อไปต่อท้ายคิวผู้ท้าชิง
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {restingPairs.map((pair) => (
              <div
                key={pair.id}
                className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-xs text-neutral-800 truncate block">
                    {pair.name}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    แข่ง {pair.totalMatches} แมตช์
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onReturnFromRest(pair.id)}
                    className="px-2.5 py-1 min-h-[30px] rounded-xl text-xs font-semibold bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-200 shadow-xs transition touch-manipulation active:scale-95"
                  >
                    กลับเข้าคิว
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePair(pair.id, 'resting')}
                    className="p-1.5 text-neutral-400 hover:text-rose-600 transition"
                    title="ลบออก"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
