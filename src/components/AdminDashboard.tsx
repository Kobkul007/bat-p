import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  RotateCcw,
  Trophy,
  Users,
  Clock,
  Flame,
  Search,
  Download,
  Upload,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  Crown,
  BarChart3,
  Layers,
  Sparkles,
  Save,
  X,
  RefreshCw,
  TrendingUp,
  Activity,
  Award
} from 'lucide-react';
import { AppState, MatchHistoryItem, PlayerPair, GoogleSheetsConfig } from '../types/badminton';
import { googleSheetsService } from '../services/googleSheets';

interface AdminDashboardProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  sheetsConfig: GoogleSheetsConfig;
  onOpenSheets: () => void;
  onBackToCourt: () => void;
  showToast: (text: string, type?: 'success' | 'info' | 'warn') => void;
}

type AdminTab = 'overview' | 'players' | 'matches' | 'system';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  appState,
  setAppState,
  sheetsConfig,
  onOpenSheets,
  onBackToCourt,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [matchSearchQuery, setMatchSearchQuery] = useState('');
  const [matchFilterKingOnly, setMatchFilterKingOnly] = useState(false);

  // Match edit state
  const [editingMatch, setEditingMatch] = useState<MatchHistoryItem | null>(null);
  const [editScoreA, setEditScoreA] = useState<number>(21);
  const [editScoreB, setEditScoreB] = useState<number>(19);
  const [editWinner, setEditWinner] = useState<string>('');

  // Player edit state
  const [editingPair, setEditingPair] = useState<PlayerPair | null>(null);
  const [editPairName, setEditPairName] = useState<string>('');

  // Collect all players currently registered across court, queue, and resting bench
  const allCurrentPairs = useMemo<PlayerPair[]>(() => {
    return [
      ...(appState.court.teamA ? [appState.court.teamA] : []),
      ...(appState.court.teamB ? [appState.court.teamB] : []),
      ...appState.queue,
      ...appState.restingPairs,
    ];
  }, [appState]);

  // Aggregate Detailed Statistics for each pair
  const playerStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        pairId: string;
        name: string;
        currentStatus: 'playing' | 'waiting' | 'resting' | 'inactive';
        totalMatches: number;
        wins: number;
        losses: number;
        winRate: number;
        currentStreak: number;
        maxStreak: number;
        kingExits: number; // Reached 2 consecutive wins
        pointsScored: number;
        pointsConceded: number;
      }
    >();

    // Initialize from current roster
    allCurrentPairs.forEach((p) => {
      map.set(p.name, {
        pairId: p.id,
        name: p.name,
        currentStatus: p.status,
        totalMatches: p.totalMatches,
        wins: 0,
        losses: 0,
        winRate: 0,
        currentStreak: p.consecutiveWins,
        maxStreak: p.consecutiveWins,
        kingExits: 0,
        pointsScored: 0,
        pointsConceded: 0,
      });
    });

    // Populate from entire history log
    appState.historyLog.forEach((m) => {
      // Team A
      if (!map.has(m.teamA)) {
        map.set(m.teamA, {
          pairId: `hist-${m.teamA}`,
          name: m.teamA,
          currentStatus: 'inactive',
          totalMatches: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          currentStreak: 0,
          maxStreak: 0,
          kingExits: 0,
          pointsScored: 0,
          pointsConceded: 0,
        });
      }
      // Team B
      if (!map.has(m.teamB)) {
        map.set(m.teamB, {
          pairId: `hist-${m.teamB}`,
          name: m.teamB,
          currentStatus: 'inactive',
          totalMatches: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          currentStreak: 0,
          maxStreak: 0,
          kingExits: 0,
          pointsScored: 0,
          pointsConceded: 0,
        });
      }

      const teamAData = map.get(m.teamA)!;
      const teamBData = map.get(m.teamB)!;

      const scoreA = m.scoreA ?? 0;
      const scoreB = m.scoreB ?? 0;

      teamAData.pointsScored += scoreA;
      teamAData.pointsConceded += scoreB;
      teamBData.pointsScored += scoreB;
      teamBData.pointsConceded += scoreA;

      if (m.winner === m.teamA) {
        teamAData.wins += 1;
        teamBData.losses += 1;
        if (m.winnerConsecutiveWinsAfter > teamAData.maxStreak) {
          teamAData.maxStreak = m.winnerConsecutiveWinsAfter;
        }
      } else if (m.winner === m.teamB) {
        teamBData.wins += 1;
        teamAData.losses += 1;
        if (m.winnerConsecutiveWinsAfter > teamBData.maxStreak) {
          teamBData.maxStreak = m.winnerConsecutiveWinsAfter;
        }
      }

      if (m.forcedExit) {
        const winnerData = map.get(m.winner);
        if (winnerData) {
          winnerData.kingExits += 1;
        }
      }
    });

    // Compute win rates and totals
    map.forEach((item) => {
      const calculatedMatches = item.wins + item.losses;
      item.totalMatches = Math.max(item.totalMatches, calculatedMatches);
      item.winRate = item.totalMatches > 0 ? Math.round((item.wins / item.totalMatches) * 100) : 0;
    });

    return map;
  }, [allCurrentPairs, appState.historyLog]);

  const sortedPlayerStats = useMemo(() => {
    return Array.from(playerStatsMap.values()).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.kingExits !== a.kingExits) return b.kingExits - a.kingExits;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.totalMatches - a.totalMatches;
    });
  }, [playerStatsMap]);

  // Overall Backoffice Metrics
  const summaryMetrics = useMemo(() => {
    const totalMatches = appState.historyLog.length;
    let totalSeconds = 0;
    let totalPoints = 0;
    let maxGamePoints = 0;
    let kingExitsTotal = 0;

    appState.historyLog.forEach((m) => {
      totalSeconds += m.durationSeconds || 0;
      const pts = (m.scoreA || 0) + (m.scoreB || 0);
      totalPoints += pts;
      if (pts > maxGamePoints) maxGamePoints = pts;
      if (m.forcedExit) kingExitsTotal += 1;
    });

    const avgDurationMin = totalMatches > 0 ? Math.round((totalSeconds / totalMatches / 60) * 10) / 10 : 0;
    const avgPointsPerMatch = totalMatches > 0 ? Math.round((totalPoints / totalMatches) * 10) / 10 : 0;

    const topWinner = sortedPlayerStats[0] || null;

    return {
      totalMatches,
      totalDurationSeconds: totalSeconds,
      avgDurationMin,
      totalPoints,
      avgPointsPerMatch,
      maxGamePoints,
      kingExitsTotal,
      activePairsCount: allCurrentPairs.length,
      queueCount: appState.queue.length,
      restingCount: appState.restingPairs.length,
      topWinner,
    };
  }, [appState.historyLog, allCurrentPairs, appState.queue.length, appState.restingPairs.length, sortedPlayerStats]);

  // Duration categorization
  const durationBreakdown = useMemo(() => {
    let fast = 0; // < 10 mins
    let medium = 0; // 10 - 15 mins
    let long = 0; // > 15 mins

    appState.historyLog.forEach((m) => {
      const dur = (m.durationSeconds || 0) / 60;
      if (dur < 10) fast++;
      else if (dur <= 15) medium++;
      else long++;
    });

    return { fast, medium, long };
  }, [appState.historyLog]);

  // Filtered Players list
  const filteredPlayers = useMemo(() => {
    if (!playerSearchQuery.trim()) return sortedPlayerStats;
    const q = playerSearchQuery.toLowerCase().trim();
    return sortedPlayerStats.filter((p) => p.name.toLowerCase().includes(q));
  }, [sortedPlayerStats, playerSearchQuery]);

  // Filtered Matches list
  const filteredMatches = useMemo(() => {
    return appState.historyLog.filter((m) => {
      if (matchFilterKingOnly && !m.forcedExit) return false;
      if (matchSearchQuery.trim()) {
        const q = matchSearchQuery.toLowerCase().trim();
        const matchesName =
          m.teamA.toLowerCase().includes(q) ||
          m.teamB.toLowerCase().includes(q) ||
          m.winner.toLowerCase().includes(q);
        if (!matchesName) return false;
      }
      return true;
    });
  }, [appState.historyLog, matchFilterKingOnly, matchSearchQuery]);

  // Format seconds to mm:ss or hr min
  const formatTime = (seconds: number) => {
    if (!seconds) return '0 นาที';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs} ชม. ${mins} นาที`;
    return `${mins} นาที ${secs > 0 ? secs + ' วิ' : ''}`;
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Actions
  const handleExportBackupJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `smashqueue-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('ดาวน์โหลดไฟล์สำรองข้อมูล JSON เรียบร้อย', 'success');
  };

  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.court && Array.isArray(parsed.queue)) {
            setAppState(parsed);
            showToast('กู้คืนข้อมูลระบบจากไฟล์สำรองสำเร็จ!', 'success');
          } else {
            showToast('รูปแบบไฟล์สำรองไม่ถูกต้อง', 'warn');
          }
        } catch {
          showToast('ไม่สามารถอ่านไฟล์ JSON ได้', 'warn');
        }
      };
    }
  };

  // Generate Mock Data for immediate backoffice preview
  const handleGenerateMockData = () => {
    const sampleTeams = [
      'อาร์ท + นัท',
      'เคน + แม็กซ์',
      'พลอย + ต้น',
      'เมย์ + โบว์',
      'แบงค์ + โอ๊ค',
      'เดฟ + แซม',
      'ก้อง + ติ๊ก',
      'บอส + ภพ',
    ];

    const newLogs: MatchHistoryItem[] = [];
    const now = Date.now();

    for (let i = 1; i <= 6; i++) {
      const idxA = (i * 2) % sampleTeams.length;
      const idxB = (i * 2 + 1) % sampleTeams.length;
      const teamA = sampleTeams[idxA];
      const teamB = sampleTeams[idxB];
      const isKingExit = i % 2 === 0;
      const winner = isKingExit ? teamA : teamB;
      const scoreA = winner === teamA ? 21 : Math.floor(Math.random() * 8) + 12;
      const scoreB = winner === teamB ? 21 : Math.floor(Math.random() * 8) + 12;
      const durationSeconds = Math.floor(Math.random() * 400) + 600; // 10-16 min

      newLogs.push({
        matchId: `mock-match-${now}-${i}`,
        timestamp: now - (7 - i) * 1200000,
        teamA,
        teamB,
        winner,
        scoreA,
        scoreB,
        durationSeconds,
        winnerConsecutiveWinsBefore: isKingExit ? 1 : 0,
        winnerConsecutiveWinsAfter: isKingExit ? 2 : 1,
        forcedExit: isKingExit,
      });
    }

    setAppState((prev) => ({
      ...prev,
      historyLog: [...newLogs, ...prev.historyLog],
    }));

    showToast('สร้างข้อมูลการแข่งขันตัวอย่าง 6 แมตช์สำเร็จแล้ว', 'success');
  };

  // Delete individual match from history
  const handleDeleteMatch = (matchId: string) => {
    if (window.confirm('ยืนยันที่จะลบประวัติแมตช์นี้ออกจากระบบหรือไม่?')) {
      setAppState((prev) => ({
        ...prev,
        historyLog: prev.historyLog.filter((m) => m.matchId !== matchId),
      }));
      showToast('ลบรายการประวัติแมตช์เรียบร้อย', 'info');
    }
  };

  // Edit match score & winner
  const handleOpenEditMatch = (m: MatchHistoryItem) => {
    setEditingMatch(m);
    setEditScoreA(m.scoreA ?? 21);
    setEditScoreB(m.scoreB ?? 19);
    setEditWinner(m.winner);
  };

  const handleSaveEditMatch = () => {
    if (!editingMatch) return;
    setAppState((prev) => ({
      ...prev,
      historyLog: prev.historyLog.map((m) => {
        if (m.matchId === editingMatch.matchId) {
          return {
            ...m,
            scoreA: editScoreA,
            scoreB: editScoreB,
            winner: editWinner,
          };
        }
        return m;
      }),
    }));
    setEditingMatch(null);
    showToast('บันทึกการแก้ไขข้อมูลแมตช์เรียบร้อย', 'success');
  };

  // Edit Player Name
  const handleOpenEditPair = (p: PlayerPair) => {
    setEditingPair(p);
    setEditPairName(p.name);
  };

  const handleSaveEditPair = () => {
    if (!editingPair || !editPairName.trim()) return;
    const trimmed = editPairName.trim();

    setAppState((prev) => {
      const updatePair = (pair: PlayerPair | null) =>
        pair && pair.id === editingPair.id ? { ...pair, name: trimmed } : pair;

      return {
        ...prev,
        court: {
          ...prev.court,
          teamA: updatePair(prev.court.teamA),
          teamB: updatePair(prev.court.teamB),
        },
        queue: prev.queue.map((p) => (p.id === editingPair.id ? { ...p, name: trimmed } : p)),
        restingPairs: prev.restingPairs.map((p) => (p.id === editingPair.id ? { ...p, name: trimmed } : p)),
      };
    });

    setEditingPair(null);
    showToast('อัปเดตชื่อคู่ผู้เล่นเรียบร้อย', 'success');
  };

  // Clear only match history
  const handleClearHistoryOnly = () => {
    if (window.confirm('ต้องการล้างเฉพาะประวัติการแข่งขันทั้งหมดหรือไม่? (รายชื่อคิวและสถานะคอร์ตจะยังคงอยู่)')) {
      setAppState((prev) => ({
        ...prev,
        historyLog: [],
      }));
      showToast('ล้างประวัติการแข่งขันเรียบร้อย', 'info');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Admin Navigation Header */}
      <div className="bg-white border border-black/[0.07] rounded-3xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToCourt}
              className="p-2 sm:p-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition touch-manipulation active:scale-95 shrink-0"
              title="กลับสู่หน้าคอร์ตสด"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h2 className="text-base sm:text-xl font-bold text-[#1d1d1f] tracking-tight">
                  ระบบแอดมิน & สรุปข้อมูลหลังบ้าน
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  ADMIN BACKOFFICE
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                ศูนย์สรุปผลและควบคุมระบบจัดคิวแบดมินตัน กฎครองคอร์ตสูงสุด 2 เกม
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => googleSheetsService.downloadCsv(appState.historyLog, allCurrentPairs)}
              className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition touch-manipulation active:scale-95"
              title="ดาวน์โหลดรายงานสรุปแบบ CSV"
            >
              <Download className="w-3.5 h-3.5 text-neutral-600" />
              <span>ดาวน์โหลด CSV</span>
            </button>

            <button
              onClick={onOpenSheets}
              className={`min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition touch-manipulation active:scale-95 ${
                sheetsConfig.spreadsheetId
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{sheetsConfig.spreadsheetId ? 'Google Sheets (ซิงค์แล้ว)' : 'เชื่อมต่อชีต'}</span>
            </button>

            <button
              onClick={onBackToCourt}
              className="min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#1d1d1f] text-white hover:bg-black transition touch-manipulation active:scale-95 shadow-sm"
            >
              <span>🏸 หน้าคอร์ตสด</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Metric Cards (6 Cards Grid) */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-5">
          {/* Card 1: Total Matches */}
          <div className="bg-[#fbfbfd] border border-neutral-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-medium">แมตช์ทั้งหมด</span>
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                {summaryMetrics.totalMatches}
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                เฉลี่ย {summaryMetrics.avgDurationMin} นาที/เกม
              </p>
            </div>
          </div>

          {/* Card 2: Total Play Time */}
          <div className="bg-[#fbfbfd] border border-neutral-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-medium">เวลารวมในคอร์ต</span>
              <Clock className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight truncate">
                {formatTime(summaryMetrics.totalDurationSeconds)}
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                เวลาสะสมทุกคู่
              </p>
            </div>
          </div>

          {/* Card 3: King of the Court Exits */}
          <div className="bg-[#fbfbfd] border border-neutral-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-medium">ราชาคอร์ต (ชนะ 2 นัด)</span>
              <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-amber-600 tracking-tight">
                {summaryMetrics.kingExitsTotal} <span className="text-xs font-normal text-neutral-500">ครั้ง</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                ชนะติด 2 เกมสลับออก
              </p>
            </div>
          </div>

          {/* Card 4: Total Registered Pairs */}
          <div className="bg-[#fbfbfd] border border-neutral-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-medium">คู่ผู้เล่นในระบบ</span>
              <Users className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                {summaryMetrics.activePairsCount} <span className="text-xs font-normal text-neutral-500">คู่</span>
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                คิว: {summaryMetrics.queueCount} | พัก: {summaryMetrics.restingCount}
              </p>
            </div>
          </div>

          {/* Card 5: Points Scored */}
          <div className="bg-[#fbfbfd] border border-neutral-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-medium">คะแนนรวมทั้งหมด</span>
              <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                {summaryMetrics.totalPoints}
              </div>
              <p className="text-[10px] text-neutral-500 mt-0.5">
                เฉลี่ย {summaryMetrics.avgPointsPerMatch} แต้ม/เกม
              </p>
            </div>
          </div>

          {/* Card 6: Top Performer */}
          <div className="bg-[#fbfbfd] border border-neutral-200/80 rounded-2xl p-3 sm:p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-[11px] font-medium">คู่ครองแชมป์สูงสุด</span>
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-neutral-900 tracking-tight truncate">
                {summaryMetrics.topWinner ? summaryMetrics.topWinner.name : '-'}
              </div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                {summaryMetrics.topWinner ? `ชนะ ${summaryMetrics.topWinner.wins} (${summaryMetrics.topWinner.winRate}%)` : 'ยังไม่มีข้อมูล'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="bg-neutral-200/80 p-1 rounded-2xl flex items-center gap-1 max-w-xl text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation active:scale-95 ${
            activeTab === 'overview'
              ? 'bg-white text-neutral-900 shadow-sm font-semibold'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>ภาพรวม & สถิติ</span>
        </button>

        <button
          onClick={() => setActiveTab('players')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation active:scale-95 ${
            activeTab === 'players'
              ? 'bg-white text-neutral-900 shadow-sm font-semibold'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>สถิติคู่ผู้เล่น ({sortedPlayerStats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('matches')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation active:scale-95 ${
            activeTab === 'matches'
              ? 'bg-white text-neutral-900 shadow-sm font-semibold'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>ประวัติแมตช์ ({appState.historyLog.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation active:scale-95 ${
            activeTab === 'system'
              ? 'bg-white text-neutral-900 shadow-sm font-semibold'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>จัดการระบบ</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Top 5 Dominant Pairs Chart (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-black/[0.07] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-neutral-900">
                  5 อันดับคู่ผู้เล่นฟอร์มแรงที่สุด (Top Dominant Teams)
                </h3>
                <p className="text-xs text-neutral-500">เปรียบเทียบสถิติจำนวนเกมที่ชนะและอัตรา Win Rate</p>
              </div>
              <span className="p-1.5 rounded-xl bg-amber-50 text-amber-600">
                <Flame className="w-4 h-4" />
              </span>
            </div>

            {sortedPlayerStats.length === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-xs">
                ยังไม่มีข้อมูลคู่แข่งขันในระบบ
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {sortedPlayerStats.slice(0, 5).map((stat, idx) => {
                  const maxWins = Math.max(...sortedPlayerStats.map((s) => s.wins), 1);
                  const percentage = Math.round((stat.wins / maxWins) * 100);

                  return (
                    <div key={stat.pairId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 font-bold text-neutral-400 text-center">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                          </span>
                          <span className="font-semibold text-neutral-900">{stat.name}</span>
                          {stat.kingExits > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" />
                              King x{stat.kingExits}
                            </span>
                          )}
                        </div>
                        <div className="text-neutral-600 font-medium">
                          <span className="text-emerald-600 font-bold">{stat.wins} ชนะ</span>
                          <span className="text-neutral-400 mx-1.5">/</span>
                          <span>{stat.totalMatches} แมตช์</span>
                          <span className="text-neutral-400 text-[11px] ml-1.5">({stat.winRate}%)</span>
                        </div>
                      </div>

                      {/* Bar indicator */}
                      <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(percentage, 6)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick King of Court Summary Callout */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/70 rounded-2xl flex items-start gap-3 mt-4">
              <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <span className="font-semibold block">กฎราชาคอร์ต (King of the Court - 2 Wins Exit):</span>
                ผู้ชนะเกมจะยังคงอยู่ในคอร์ตเพื่อรอผู้ท้าชิงถัดไป แต่หากชนะติดต่อกันครบ <strong>2 นัดติด</strong> ระบบจะบังคับให้สลับออกไปพักที่ท้ายคิวอัตโนมัติ เพื่อเปิดโอกาสให้ผู้เล่นคิวอื่นๆ ได้ลงสนามอย่างทั่วถึง
              </div>
            </div>
          </div>

          {/* Right Column: Match Duration Breakdown & Court Efficiency (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Duration Breakdown Card */}
            <div className="bg-white border border-black/[0.07] rounded-3xl p-4 sm:p-6 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm sm:text-base text-neutral-900">
                  ระยะเวลาการแข่งขันแต่ละแมตช์
                </h3>
                <Clock className="w-4 h-4 text-blue-500" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="text-lg font-bold text-neutral-800">{durationBreakdown.fast}</div>
                  <span className="text-[11px] text-neutral-500 block">เกมเร็ว</span>
                  <span className="text-[10px] text-neutral-400">&lt; 10 นาที</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="text-lg font-bold text-neutral-800">{durationBreakdown.medium}</div>
                  <span className="text-[11px] text-neutral-500 block">เกมมาตรฐาน</span>
                  <span className="text-[10px] text-neutral-400">10 - 15 นาที</span>
                </div>
                <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="text-lg font-bold text-neutral-800">{durationBreakdown.long}</div>
                  <span className="text-[11px] text-neutral-500 block">เกมยืดเยื้อ</span>
                  <span className="text-[10px] text-neutral-400">&gt; 15 นาที</span>
                </div>
              </div>

              <div className="text-xs text-neutral-500 pt-1">
                เวลาแข่งขันเฉลี่ยในเซสชันนี้: <strong className="text-neutral-800">{summaryMetrics.avgDurationMin} นาที</strong> ต่อแมตช์
              </div>
            </div>

            {/* Queue Turnover & Roster Status */}
            <div className="bg-white border border-black/[0.07] rounded-3xl p-4 sm:p-6 shadow-sm space-y-3">
              <h3 className="font-semibold text-sm sm:text-base text-neutral-900">
                สถานะการหมุนเวียนคิวปัจจุบัน
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl">
                  <span className="text-neutral-600">กำลังเล่นในสนาม (คอร์ต A vs B)</span>
                  <span className="font-bold text-neutral-900">
                    {appState.court.teamA && appState.court.teamB ? '2 คู่' : 'ว่าง'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl">
                  <span className="text-neutral-600">รอคิวท้าชิงถัดไป</span>
                  <span className="font-bold text-neutral-900">{appState.queue.length} คู่</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl">
                  <span className="text-neutral-600">นั่งพักเบรก (Resting Bench)</span>
                  <span className="font-bold text-neutral-900">{appState.restingPairs.length} คู่</span>
                </div>
              </div>

              {summaryMetrics.totalMatches === 0 && (
                <button
                  onClick={handleGenerateMockData}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 text-xs font-medium transition touch-manipulation flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>สร้างข้อมูลจำลองเพื่อดูรายงานสถิติทันที</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DETAILED PLAYERS ROSTER & STATS */}
      {activeTab === 'players' && (
        <div className="bg-white border border-black/[0.07] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-neutral-900">
                ทำเนียบสถิติคู่ผู้เล่นทั้งหมด (Player Roster & Performance)
              </h3>
              <p className="text-xs text-neutral-500">
                รายละเอียดผลงาน ชนะ แพ้ อัตราการชนะ และจำนวนครั้งที่ครองแชมป์ King of the Court
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อคู่ผู้เล่น..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition"
              />
              {playerSearchQuery && (
                <button
                  onClick={() => setPlayerSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Standings & Stats Table */}
          <div className="overflow-x-auto rounded-2xl border border-neutral-100">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-neutral-50/80 border-b border-neutral-100 text-neutral-500 text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-3">อันดับ</th>
                  <th className="py-3 px-3">ชื่อคู่ผู้เล่น</th>
                  <th className="py-3 px-2 text-center">สถานะ</th>
                  <th className="py-3 px-2 text-center">ลงแข่ง</th>
                  <th className="py-3 px-2 text-center text-emerald-600">ชนะ</th>
                  <th className="py-3 px-2 text-center text-rose-500">แพ้</th>
                  <th className="py-3 px-2 text-center">Win Rate</th>
                  <th className="py-3 px-2 text-center text-amber-600">ราชาคอร์ต (King x2)</th>
                  <th className="py-3 px-2 text-center">แต้มได้ / เสีย</th>
                  <th className="py-3 px-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredPlayers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-neutral-400 text-xs">
                      ไม่พบข้อมูลคู่ผู้เล่นที่ค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredPlayers.map((item, idx) => {
                    const originalPair = allCurrentPairs.find((p) => p.name === item.name);

                    return (
                      <tr key={item.pairId} className="hover:bg-neutral-50/70 transition">
                        <td className="py-3 px-3 font-semibold text-neutral-600">
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                        </td>
                        <td className="py-3 px-3 font-semibold text-neutral-900">
                          <div className="flex items-center gap-1.5">
                            <span>{item.name}</span>
                            {item.currentStreak > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
                                🔥 {item.currentStreak}W
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">
                          {item.currentStatus === 'playing' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              กำลังแข่ง
                            </span>
                          ) : item.currentStatus === 'waiting' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                              รอในคิว
                            </span>
                          ) : item.currentStatus === 'resting' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                              นั่งพัก
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-500">
                              ประวัติเก่า
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center font-medium text-neutral-700">
                          {item.totalMatches}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-emerald-600">
                          {item.wins}
                        </td>
                        <td className="py-3 px-2 text-center font-medium text-rose-500">
                          {item.losses}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-neutral-800">
                          {item.winRate}%
                        </td>
                        <td className="py-3 px-2 text-center">
                          {item.kingExits > 0 ? (
                            <span className="font-bold text-amber-600 flex items-center justify-center gap-1">
                              <Crown className="w-3 h-3 fill-amber-400" />
                              {item.kingExits} ครั้ง
                            </span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center text-neutral-600 font-mono text-[11px]">
                          <span className="text-emerald-700 font-semibold">{item.pointsScored}</span>
                          <span className="text-neutral-300 mx-1">/</span>
                          <span className="text-rose-600">{item.pointsConceded}</span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {originalPair && (
                            <button
                              onClick={() => handleOpenEditPair(originalPair)}
                              className="p-1 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition"
                              title="แก้ไขชื่อคู่ผู้เล่น"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MATCH AUDIT TRAIL & LOGS MANAGEMENT */}
      {activeTab === 'matches' && (
        <div className="bg-white border border-black/[0.07] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-neutral-900">
                ประวัติการแข่งขันทั้งหมด (Match History & Audit Trail)
              </h3>
              <p className="text-xs text-neutral-500">
                ตรวจสอบผลการแข่งขันย้อนหลัง แก้ไขคะแนน หรือลบรายการที่ไม่ถูกต้อง
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setMatchFilterKingOnly(!matchFilterKingOnly)}
                className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-medium border transition touch-manipulation flex items-center gap-1.5 ${
                  matchFilterKingOnly
                    ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                    : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>เฉพาะชนะ 2 เกมติด (King Exit)</span>
              </button>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={matchSearchQuery}
                  onChange={(e) => setMatchSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อคู่..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 transition"
                />
              </div>
            </div>
          </div>

          {/* Match Log Table */}
          <div className="overflow-x-auto rounded-2xl border border-neutral-100">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-neutral-50/80 border-b border-neutral-100 text-neutral-500 text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-3">เวลา</th>
                  <th className="py-3 px-3">ทีม A vs ทีม B</th>
                  <th className="py-3 px-2 text-center">คะแนน</th>
                  <th className="py-3 px-3">ผู้ชนะ</th>
                  <th className="py-3 px-2 text-center">ระยะเวลา</th>
                  <th className="py-3 px-2 text-center">การสลับคิว</th>
                  <th className="py-3 px-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredMatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-400 text-xs">
                      ไม่พบบันทึกการแข่งขัน
                    </td>
                  </tr>
                ) : (
                  filteredMatches.map((match) => {
                    const isTeamAWinner = match.winner === match.teamA;

                    return (
                      <tr key={match.matchId} className="hover:bg-neutral-50/70 transition">
                        <td className="py-3 px-3 font-mono text-neutral-500 text-[11px]">
                          {formatDate(match.timestamp)}
                        </td>
                        <td className="py-3 px-3 font-medium text-neutral-800">
                          <div className="flex items-center gap-1.5">
                            <span className={isTeamAWinner ? 'font-bold text-neutral-900' : 'text-neutral-500'}>
                              {match.teamA}
                            </span>
                            <span className="text-neutral-300 text-[10px]">vs</span>
                            <span className={!isTeamAWinner ? 'font-bold text-neutral-900' : 'text-neutral-500'}>
                              {match.teamB}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-neutral-900">
                          {match.scoreA ?? '-'} : {match.scoreB ?? '-'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            {match.winner}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center text-neutral-500 text-[11px]">
                          {match.durationSeconds ? `${Math.round(match.durationSeconds / 60)} นาที` : '-'}
                        </td>
                        <td className="py-3 px-2 text-center">
                          {match.forcedExit ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                              <Crown className="w-2.5 h-2.5" />
                              ชนะ 2 เกมติด • สลับออกพัก
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-600">
                              ครองคอร์ตต่อ (ชนะ 1 เกม)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditMatch(match)}
                              className="p-1 text-neutral-400 hover:text-neutral-800 rounded-lg hover:bg-neutral-100 transition"
                              title="แก้ไขคะแนนและผลแมตช์"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMatch(match.matchId)}
                              className="p-1 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                              title="ลบแมตช์นี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM MANAGEMENT & BACKUP TOOLS */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* Section 1: Data Backup & Restore */}
          <div className="bg-white border border-black/[0.07] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Download className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-neutral-900">
                  สำรองและกู้คืนข้อมูล (Backup & Restore)
                </h3>
                <p className="text-xs text-neutral-500">บันทึกข้อมูลทั้งระบบ หรือนำเข้าไฟล์ JSON เก่า</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleExportBackupJson}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold flex items-center justify-center gap-2 transition touch-manipulation active:scale-95 shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดไฟล์สำรองข้อมูลทั้งระบบ (.json)</span>
              </button>

              <label className="w-full py-2.5 px-4 rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation active:scale-95">
                <Upload className="w-4 h-4 text-neutral-500" />
                <span>นำเข้าไฟล์สำรองข้อมูล JSON (Restore State)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackupJson}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => googleSheetsService.downloadCsv(appState.historyLog, allCurrentPairs)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 border border-emerald-200 text-xs font-semibold flex items-center justify-center gap-2 transition touch-manipulation active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>ส่งออกรายงานสรุปสถิติและประวัติ (.csv)</span>
              </button>
            </div>
          </div>

          {/* Section 2: Mock Data & Session Maintenance */}
          <div className="bg-white border border-black/[0.07] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <RefreshCw className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-neutral-900">
                  เครื่องมือทดสอบและบำรุงรักษา
                </h3>
                <p className="text-xs text-neutral-500">จัดการข้อมูลประวัติและสร้างข้อมูลทดสอบ</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleGenerateMockData}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 text-xs font-semibold flex items-center justify-center gap-2 transition touch-manipulation active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>เพิ่มข้อมูลจำลอง 6 แมตช์ (Demo Data)</span>
              </button>

              <button
                onClick={handleClearHistoryOnly}
                className="w-full py-2.5 px-4 rounded-xl bg-white text-neutral-700 hover:text-amber-700 hover:bg-amber-50/60 border border-neutral-200 hover:border-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition touch-manipulation active:scale-95"
              >
                <RotateCcw className="w-4 h-4 text-amber-500" />
                <span>ล้างเฉพาะประวัติการแข่งขัน (คงรายชื่อคิวไว้)</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm('คำเตือน: คุณต้องการล้างข้อมูลและรีเซ็ตทุกอย่างกลับเป็นค่าเริ่มต้นหรือไม่?')) {
                    localStorage.removeItem('smash_queue_badminton_app_state_v1');
                    window.location.reload();
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold flex items-center justify-center gap-2 transition touch-manipulation active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>รีเซ็ตระบบทั้งหมดเป็นค่าเริ่มต้นโรงงาน (Factory Reset)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Match Modal */}
      {editingMatch && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-semibold text-sm sm:text-base text-neutral-900">
                แก้ไขข้อมูลแมตช์ย้อนหลัง
              </h3>
              <button
                onClick={() => setEditingMatch(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-neutral-50 rounded-xl space-y-1">
                <span className="text-neutral-500">คู่แข่งขัน:</span>
                <div className="font-bold text-neutral-900 text-sm">
                  {editingMatch.teamA} vs {editingMatch.teamB}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-600 mb-1">คะแนน {editingMatch.teamA}</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={editScoreA}
                    onChange={(e) => setEditScoreA(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 text-center font-bold text-base bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-neutral-600 mb-1">คะแนน {editingMatch.teamB}</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={editScoreB}
                    onChange={(e) => setEditScoreB(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 text-center font-bold text-base bg-neutral-50 border border-neutral-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-600 mb-1">ผู้ชนะ:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditWinner(editingMatch.teamA)}
                    className={`py-2 px-3 rounded-xl border text-center font-medium transition ${
                      editWinner === editingMatch.teamA
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    {editingMatch.teamA}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditWinner(editingMatch.teamB)}
                    className={`py-2 px-3 rounded-xl border text-center font-medium transition ${
                      editWinner === editingMatch.teamB
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    {editingMatch.teamB}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingMatch(null)}
                className="px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEditMatch}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>บันทึกการแก้ไข</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Pair Name Modal */}
      {editingPair && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-semibold text-sm sm:text-base text-neutral-900">
                แก้ไขชื่อคู่ผู้เล่น
              </h3>
              <button
                onClick={() => setEditingPair(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-600 block">ชื่อคู่ผู้เล่น (เช่น เอก + บาส)</label>
              <input
                type="text"
                value={editPairName}
                onChange={(e) => setEditPairName(e.target.value)}
                className="w-full p-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingPair(null)}
                className="px-4 py-2 rounded-xl text-neutral-600 hover:bg-neutral-100 text-xs font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEditPair}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>บันทึก</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
