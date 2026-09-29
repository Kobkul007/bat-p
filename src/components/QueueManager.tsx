import React, { useState } from 'react';
import { Users, Plus, ArrowUp, ArrowDown, BedDouble, Play, Trash2, Shuffle, Sparkles, Check, Edit2, X } from 'lucide-react';
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
}) => {
  const [newPairName, setNewPairName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPairName.trim()) return;
    onAddPair(newPairName.trim());
    setNewPairName('');
  };

  const startEdit = (pair: PlayerPair) => {
    setEditingId(pair.id);
    setEditNameVal(pair.name);
  };

  const saveEdit = (id: string) => {
    if (editNameVal.trim()) {
      onEditPairName(id, editNameVal.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-5">
      {/* QUEUE CARD */}
      <div className="bg-white border border-black/[0.06] rounded-3xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-black/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center font-medium">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-neutral-900 text-sm sm:text-base">คิวผู้ท้าชิง</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/60">
                  {queue.length} คู่รอเล่น
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                ลำดับคิวตามกฎราชาคอร์ต (หัวคิวเข้าสนาม ผู้แพ้และผู้ชนะครบโควตาไปต่อท้าย)
              </p>
            </div>
          </div>

          {/* Queue Actions */}
          <div className="flex items-center gap-1.5">
            {queue.length > 1 && (
              <button
                onClick={onShuffleQueue}
                title="สุ่มสลับลำดับคิว"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl bg-white hover:bg-neutral-50 text-neutral-600 hover:text-neutral-900 border border-neutral-200/80 shadow-sm transition"
              >
                <Shuffle className="w-3.5 h-3.5 text-neutral-400" />
                <span className="hidden sm:inline">สุ่มคิว</span>
              </button>
            )}

            {queue.length === 0 && restingPairs.length === 0 && (
              <button
                onClick={onAddPresets}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-neutral-100 text-neutral-800 hover:bg-neutral-200/70 border border-neutral-200/80 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-neutral-600" />
                <span>โหลดตัวอย่างคู่</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Add Pair Form */}
        <form onSubmit={handleAddSubmit} className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="เพิ่มชื่อคู่ผู้เล่น (เช่น อาร์ท + นัท, พลอย + ต้น)"
            value={newPairName}
            onChange={(e) => setNewPairName(e.target.value)}
            className="flex-1 bg-[#fafafc] border border-neutral-200/80 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition"
          />
          <button
            type="submit"
            disabled={!newPairName.trim()}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-neutral-900 text-white font-medium text-xs rounded-2xl hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95 shrink-0 shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>เพิ่มคู่</span>
          </button>
        </form>

        {/* Queue List */}
        <div className="mt-4 space-y-2.5">
          {queue.length === 0 ? (
            <div className="py-8 text-center rounded-2xl bg-neutral-50/60 border border-dashed border-neutral-200">
              <Users className="w-7 h-7 text-neutral-400 mx-auto mb-1.5" />
              <p className="text-xs sm:text-sm font-medium text-neutral-700">ขณะนี้ไม่มีผู้เล่นในคิว</p>
              <p className="text-xs text-neutral-400 mt-0.5 max-w-sm mx-auto">
                พิมพ์ชื่อคู่ผู้เล่นด้านบน หรือคลิกโหลดคู่ตัวอย่างเพื่อเริ่มรอบ
              </p>
              <button
                onClick={onAddPresets}
                className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-white text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 border border-neutral-200/80 shadow-sm transition"
              >
                + โหลดคู่ตัวอย่าง
              </button>
            </div>
          ) : (
            queue.map((pair, idx) => {
              const isNextChallenger = idx === 0;
              const isEditing = editingId === pair.id;

              return (
                <div
                  key={pair.id}
                  className={`rounded-2xl p-3.5 flex items-center justify-between gap-3 transition border ${
                    isNextChallenger
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-sm'
                      : 'bg-white border-neutral-200/80 hover:border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.02)]'
                  }`}
                >
                  {/* Left: Position & Name */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-medium text-xs shrink-0 ${
                      isNextChallenger
                        ? 'bg-neutral-900 text-white font-semibold'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      #{idx + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editNameVal}
                            onChange={(e) => setEditNameVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(pair.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="bg-white text-neutral-900 text-xs sm:text-sm px-2.5 py-1 rounded-xl border border-neutral-300 focus:outline-none focus:border-neutral-900"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(pair.id)}
                            className="p-1 text-emerald-600 hover:text-emerald-700"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-neutral-400 hover:text-neutral-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900 text-xs sm:text-sm truncate">
                            {pair.name}
                          </span>
                          {isNextChallenger && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100/70 text-emerald-800">
                              คิวถัดไป
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                        <span>ลงเล่น: {pair.totalMatches} แมตช์</span>
                        <span>•</span>
                        <span>ชนะติด: {pair.consecutiveWins} เกม</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Seat Directly to Court if Slot is open */}
                    {canSeatDirectly && (
                      <button
                        onClick={() => onSeatPairDirectly(pair)}
                        title="เชิญลงคอร์ตทันที (มีฝั่งว่าง)"
                        className="p-1.5 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    {/* Move Up */}
                    <button
                      onClick={() => onMoveUp(idx)}
                      disabled={idx === 0}
                      title="เลื่อนคิวขึ้น"
                      className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      onClick={() => onMoveDown(idx)}
                      disabled={idx === queue.length - 1}
                      title="เลื่อนคิวลง"
                      className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Rest */}
                    <button
                      onClick={() => onMoveToRest(pair.id)}
                      title="ย้ายไปพักข้างคอร์ต"
                      className="p-1.5 rounded-xl text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition"
                    >
                      <BedDouble className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Name */}
                    <button
                      onClick={() => startEdit(pair)}
                      title="แก้ไขชื่อคู่"
                      className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onRemovePair(pair.id, 'queue')}
                      title="ลบออกจากระบบ"
                      className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RESTING BENCH */}
      <div className="bg-white border border-black/[0.06] rounded-3xl p-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.05]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-medium">
              <BedDouble className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-neutral-900 text-sm sm:text-base">ม้านั่งพักข้างคอร์ต</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  {restingPairs.length} คู่พัก
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                ผู้เล่นที่พักดื่มน้ำ หรือหยุดพักชั่วคราว
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {restingPairs.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-4">
              ไม่มีคู่ผู้เล่นพักข้างคอร์ต (กดไอคอนเตียงที่คู่ใดก็ได้เพื่อพัก)
            </p>
          ) : (
            restingPairs.map((pair) => (
              <div
                key={pair.id}
                className="bg-neutral-50/70 border border-neutral-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-800 text-xs sm:text-sm truncate">
                      {pair.name}
                    </span>
                    <span className="text-[10px] bg-amber-100/70 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                      กำลังพัก
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    เล่นแล้ว: {pair.totalMatches} แมตช์ • ชนะติด: {pair.consecutiveWins}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onReturnFromRest(pair.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-white text-neutral-800 hover:bg-neutral-100 border border-neutral-200/80 shadow-sm transition"
                  >
                    <span>กลับเข้าคิว</span>
                  </button>
                  <button
                    onClick={() => onRemovePair(pair.id, 'resting')}
                    title="ลบออกจากระบบ"
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
