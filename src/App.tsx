import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { CourtState, PlayerPair, AppState, MatchHistoryItem, GoogleSheetsConfig } from './types/badminton';
import { loadAppState, saveAppState, loadSheetsConfig, saveSheetsConfig, INITIAL_STATE, isUserAuthorized, loadAdminConfig } from './utils/storage';
import { sounds } from './services/soundEffects';
import { googleSheetsService } from './services/googleSheets';
import { Header } from './components/Header';
import { CourtView } from './components/CourtView';
import { QueueManager } from './components/QueueManager';
import { HistoryLog } from './components/HistoryLog';
import { LeaderboardModal } from './components/LeaderboardModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { AdminDashboard } from './components/AdminDashboard';
import { MeetupGroupModal } from './components/MeetupGroupModal';
import { MeetupSession } from './types/meetup';
import { loadMeetupSession, saveMeetupSession } from './utils/meetupStorage';
import { Users, History, Trophy, FileSpreadsheet, LayoutGrid, ShieldCheck, Lock, QrCode } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const [sheetsConfig, setSheetsConfig] = useState<GoogleSheetsConfig>(() => loadSheetsConfig());
  const [meetupSession, setMeetupSession] = useState<MeetupSession>(() => loadMeetupSession());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => googleSheetsService.getUserEmail());

  // Modals
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isSheetsOpen, setIsSheetsOpen] = useState(false);
  const [isMeetupOpen, setIsMeetupOpen] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);

  // Sync auth email state periodically and on window storage
  useEffect(() => {
    const syncAuth = () => {
      const email = googleSheetsService.getUserEmail();
      setCurrentUserEmail((prev) => (prev !== email ? email : prev));
    };
    window.addEventListener('storage', syncAuth);
    const timer = setInterval(syncAuth, 1000);
    return () => {
      window.removeEventListener('storage', syncAuth);
      clearInterval(timer);
    };
  }, []);

  const isSheetsAuthorized = isUserAuthorized(currentUserEmail, loadAdminConfig());

  // Mobile navigation tab ('court' | 'queue' | 'history' | 'all')
  const [mobileTab, setMobileTab] = useState<'court' | 'queue' | 'history' | 'all'>('court');

  // Toast / Status banner
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warn' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'info' | 'warn' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  // Sync sounds singleton with state
  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  // Persist state to local storage
  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  useEffect(() => {
    saveSheetsConfig(sheetsConfig);
  }, [sheetsConfig]);

  useEffect(() => {
    saveMeetupSession(meetupSession);
  }, [meetupSession]);

  // Keyboard shortcut for Undo (Ctrl+Z or Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (appState.undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState.undoStack]);

  /**
   * Helper: Push current snapshot to undo stack (max depth 10)
   */
  const createUndoSnapshot = (current: AppState) => {
    const newStack = [
      {
        court: JSON.parse(JSON.stringify(current.court)),
        queue: JSON.parse(JSON.stringify(current.queue)),
        restingPairs: JSON.parse(JSON.stringify(current.restingPairs)),
      },
      ...current.undoStack,
    ].slice(0, 10);
    return newStack;
  };

  /**
   * Undo last match resolution
   */
  const handleUndo = useCallback(() => {
    if (appState.undoStack.length === 0) return;

    sounds.playUndo();

    setAppState((prev) => {
      const [lastSnapshot, ...restStack] = prev.undoStack;
      if (!lastSnapshot) return prev;

      // Pop the last match log corresponding to this undo
      const newHistory = prev.historyLog.slice(1);

      showToast('ย้อนกลับผลการแข่งขันก่อนหน้าเรียบร้อย', 'info');

      return {
        ...prev,
        court: lastSnapshot.court,
        queue: lastSnapshot.queue,
        restingPairs: lastSnapshot.restingPairs || prev.restingPairs,
        historyLog: newHistory,
        undoStack: restStack,
      };
    });
  }, [appState.undoStack, showToast]);

  /**
   * MATCH RESOLUTION LOGIC
   * Follows strict King of the Court (Max 2 Wins) specification
   */
  const handleResolveMatch = useCallback(
    async (winnerSlot: 'A' | 'B', scoreA: number, scoreB: number, durationSeconds: number) => {
      const currentCourt = appState.court;
      if (!currentCourt.teamA || !currentCourt.teamB) return;

      const teamA = currentCourt.teamA;
      const teamB = currentCourt.teamB;

      const isWinnerA = winnerSlot === 'A';
      const winner = isWinnerA ? teamA : teamB;
      const loser = isWinnerA ? teamB : teamA;

      const winnerStreakBefore = winner.consecutiveWins;
      const winnerStreakAfter = winnerStreakBefore + 1;
      const willForcedExit = winnerStreakAfter >= 2;

      // 1. Both teams increment totalMatches += 1
      // Loser resets consecutiveWins = 0 and is pushed to tail of queue (ahead of 2-game winner)
      const updatedLoser: PlayerPair = {
        ...loser,
        totalMatches: loser.totalMatches + 1,
        consecutiveWins: 0,
        status: 'waiting',
        lastMatchResult: 'loss',
      };

      // Create snapshot for undoStack BEFORE applying changes
      const updatedUndoStack = createUndoSnapshot(appState);

      // Create match log entry
      const matchLogItem: MatchHistoryItem = {
        matchId: `match-${Date.now()}`,
        timestamp: Date.now(),
        teamA: teamA.name,
        teamB: teamB.name,
        winner: winner.name,
        scoreA,
        scoreB,
        durationSeconds,
        winnerConsecutiveWinsBefore: winnerStreakBefore,
        winnerConsecutiveWinsAfter: winnerStreakAfter,
        forcedExit: willForcedExit,
      };

      let newCourt: CourtState;
      let newQueue: PlayerPair[];

      if (!willForcedExit) {
        // CASE A: winner.consecutiveWins < 2 (Remaining Champion)
        // Winner stays on court with incremented wins & matches
        const updatedWinner: PlayerPair = {
          ...winner,
          totalMatches: winner.totalMatches + 1,
          consecutiveWins: winnerStreakAfter,
          status: 'playing',
          lastMatchResult: 'win',
        };

        const currentQueue = [...appState.queue];
        const challenger = currentQueue.shift() || null;
        if (challenger) {
          challenger.status = 'playing';
        }

        // Updated queue contains remaining waiting teams + loser at the tail
        newQueue = [...currentQueue, updatedLoser];

        if (isWinnerA) {
          newCourt = {
            teamA: updatedWinner,
            teamB: challenger,
            status: challenger ? 'ACTIVE' : 'WAITING_PLAYERS',
            matchStartedAt: challenger ? Date.now() : undefined,
          };
        } else {
          newCourt = {
            teamA: challenger,
            teamB: updatedWinner,
            status: challenger ? 'ACTIVE' : 'WAITING_PLAYERS',
            matchStartedAt: challenger ? Date.now() : undefined,
          };
        }

        sounds.playMatchWin();
        showToast(
          `${winner.name} ชนะ 1 ตา ครองคอร์ตต่อ! ${updatedLoser.name} (คนแพ้) ไปต่อคิวได้สิทธิ์ลงก่อนคนชนะ`,
          'success'
        );
      } else {
        // CASE B: winner.consecutiveWins >= 2 (Forced Exit)
        // กฎ: ชนะ 2 ตาติดออก และหากใครแพ้จะได้ลงก่อนคนชนะ
        const updatedWinner: PlayerPair = {
          ...winner,
          totalMatches: winner.totalMatches + 1,
          consecutiveWins: 0,
          status: 'waiting',
          lastMatchResult: 'king_exit',
        };

        // Both court slots vacated
        // คนแพ้ (updatedLoser) ต่อคิวก่อน เพื่อให้ได้ลงเล่นรอบถัดไปก่อนคนชนะ (updatedWinner)
        const queueWithBoth = [...appState.queue, updatedLoser, updatedWinner];

        // Dequeue up to 2 teams from the head of queue to start brand-new match
        const newTeamA = queueWithBoth.shift() || null;
        const newTeamB = queueWithBoth.shift() || null;

        if (newTeamA) newTeamA.status = 'playing';
        if (newTeamB) newTeamB.status = 'playing';

        newQueue = queueWithBoth;

        const bothSeated = Boolean(newTeamA && newTeamB);
        newCourt = {
          teamA: newTeamA,
          teamB: newTeamB,
          status: bothSeated ? 'ACTIVE' : newTeamA || newTeamB ? 'WAITING_PLAYERS' : 'IDLE',
          matchStartedAt: bothSeated ? Date.now() : undefined,
        };

        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#10b981', '#f59e0b', '#38bdf8', '#fbbf24'],
          });
        } catch {
          // ignore
        }
        sounds.playKingCrowned();

        showToast(
          `👑 ${winner.name} ชนะครบ 2 ตาติดออกพัก! ${updatedLoser.name} (คนแพ้) ต่อคิวก่อนคนชนะ เพื่อได้ลงเล่นรอบถัดไป`,
          'success'
        );
      }

      // Update state
      const nextHistory = [matchLogItem, ...appState.historyLog];
      setAppState({
        ...appState,
        court: newCourt,
        queue: newQueue,
        historyLog: nextHistory,
        undoStack: updatedUndoStack,
      });

      // Background Auto-sync to Google Sheets if connected and authorized
      if (sheetsConfig.spreadsheetId && sheetsConfig.autoSync && isUserAuthorized(googleSheetsService.getUserEmail(), loadAdminConfig())) {
        try {
          await googleSheetsService.appendMatchRecord(
            sheetsConfig.spreadsheetId,
            matchLogItem,
            nextHistory.length
          );
          setSheetsConfig((prev) => ({
            ...prev,
            lastSyncedAt: Date.now(),
          }));
        } catch (err) {
          console.error('Auto-sync error:', err);
        }
      }
    },
    [appState, sheetsConfig, showToast]
  );

  /**
   * Swap sides on court
   */
  const handleSwapSides = () => {
    setAppState((prev) => {
      const currentCourt = prev.court;
      return {
        ...prev,
        court: {
          ...currentCourt,
          teamA: currentCourt.teamB,
          teamB: currentCourt.teamA,
        },
      };
    });
    sounds.playPoint();
    showToast('สลับฝั่งคอร์ตเรียบร้อย', 'info');
  };

  /**
   * Seat next challenger into an empty court slot
   */
  const handleSeatNextChallenger = (slot: 'A' | 'B') => {
    if (appState.queue.length === 0) return;

    setAppState((prev) => {
      const [nextPair, ...remainingQueue] = prev.queue;
      nextPair.status = 'playing';

      const nextCourt: CourtState = {
        ...prev.court,
        [slot === 'A' ? 'teamA' : 'teamB']: nextPair,
      };

      if (nextCourt.teamA && nextCourt.teamB) {
        nextCourt.status = 'ACTIVE';
        nextCourt.matchStartedAt = Date.now();
      } else {
        nextCourt.status = 'WAITING_PLAYERS';
      }

      showToast(`เชิญ ${nextPair.name} ลงเล่นที่ฝั่ง ${slot}`, 'info');

      return {
        ...prev,
        court: nextCourt,
        queue: remainingQueue,
      };
    });
  };

  /**
   * Seat a specific pair directly from queue to any empty slot
   */
  const handleSeatPairDirectly = (pair: PlayerPair) => {
    setAppState((prev) => {
      const filteredQueue = prev.queue.filter((p) => p.id !== pair.id);
      pair.status = 'playing';

      let targetSlot: 'teamA' | 'teamB' = 'teamA';
      if (!prev.court.teamA) {
        targetSlot = 'teamA';
      } else if (!prev.court.teamB) {
        targetSlot = 'teamB';
      } else {
        return prev;
      }

      const nextCourt: CourtState = {
        ...prev.court,
        [targetSlot]: pair,
      };

      if (nextCourt.teamA && nextCourt.teamB) {
        nextCourt.status = 'ACTIVE';
        nextCourt.matchStartedAt = Date.now();
      } else {
        nextCourt.status = 'WAITING_PLAYERS';
      }

      showToast(`เชิญ ${pair.name} ลงสนาม`, 'info');

      return {
        ...prev,
        court: nextCourt,
        queue: filteredQueue,
      };
    });
  };

  /**
   * Send an on-court team to resting bench and pull challenger if available
   */
  const handleSubToRest = (slot: 'A' | 'B') => {
    const pairToRest = slot === 'A' ? appState.court.teamA : appState.court.teamB;
    if (!pairToRest) return;

    setAppState((prev) => {
      const resting: PlayerPair = {
        ...pairToRest,
        status: 'resting',
      };

      const [nextChallenger, ...restQueue] = prev.queue;
      if (nextChallenger) {
        nextChallenger.status = 'playing';
      }

      const isBothActive = Boolean(slot === 'A' ? nextChallenger && prev.court.teamB : prev.court.teamA && nextChallenger);
      const nextCourt: CourtState = {
        ...prev.court,
        [slot === 'A' ? 'teamA' : 'teamB']: nextChallenger || null,
        status: isBothActive ? 'ACTIVE' : 'WAITING_PLAYERS',
        matchStartedAt: isBothActive ? Date.now() : undefined,
      };

      showToast(`${pairToRest.name} ย้ายไปพักข้างคอร์ต`, 'info');

      return {
        ...prev,
        court: nextCourt,
        queue: restQueue,
        restingPairs: [...prev.restingPairs, resting],
      };
    });
  };

  /**
   * Queue management handlers
   */
  const handleAddPair = (name: string) => {
    const newPair: PlayerPair = {
      id: `pair-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      consecutiveWins: 0,
      totalMatches: 0,
      status: 'waiting',
      createdAt: Date.now(),
    };

    setAppState((prev) => {
      if (!prev.court.teamA) {
        newPair.status = 'playing';
        const nextCourt: CourtState = {
          ...prev.court,
          teamA: newPair,
          status: prev.court.teamB ? 'ACTIVE' : 'WAITING_PLAYERS',
          matchStartedAt: prev.court.teamB ? Date.now() : prev.court.matchStartedAt,
        };
        showToast(`เพิ่ม ${name} ลงสนามฝั่ง A ทันที`, 'success');
        return {
          ...prev,
          court: nextCourt,
        };
      } else if (!prev.court.teamB) {
        newPair.status = 'playing';
        const nextCourt: CourtState = {
          ...prev.court,
          teamB: newPair,
          status: 'ACTIVE',
          matchStartedAt: Date.now(),
        };
        showToast(`เพิ่ม ${name} ลงสนามฝั่ง B ทันที`, 'success');
        return {
          ...prev,
          court: nextCourt,
        };
      } else {
        showToast(`เพิ่ม ${name} เข้าคิวผู้ท้าชิง (ลำดับที่ #${prev.queue.length + 1})`, 'success');
        return {
          ...prev,
          queue: [...prev.queue, newPair],
        };
      }
    });
  };

  const handleAddPresets = () => {
    const presets = [
      'อาร์ท + นัท',
      'เคน + แม็กซ์',
      'พลอย + ต้น',
      'เมย์ + โบว์',
      'แบงค์ + โอ๊ค',
      'เดฟ + แซม',
    ];

    presets.forEach((name, idx) => {
      setTimeout(() => {
        handleAddPair(name);
      }, idx * 40);
    });
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setAppState((prev) => {
      const q = [...prev.queue];
      const temp = q[index];
      q[index] = q[index - 1];
      q[index - 1] = temp;
      return { ...prev, queue: q };
    });
  };

  const handleMoveDown = (index: number) => {
    setAppState((prev) => {
      if (index >= prev.queue.length - 1) return prev;
      const q = [...prev.queue];
      const temp = q[index];
      q[index] = q[index + 1];
      q[index + 1] = temp;
      return { ...prev, queue: q };
    });
  };

  const handleMoveToRest = (id: string) => {
    setAppState((prev) => {
      const pair = prev.queue.find((p) => p.id === id);
      if (!pair) return prev;
      const nextQueue = prev.queue.filter((p) => p.id !== id);
      return {
        ...prev,
        queue: nextQueue,
        restingPairs: [...prev.restingPairs, { ...pair, status: 'resting' }],
      };
    });
  };

  const handleReturnFromRest = (id: string) => {
    setAppState((prev) => {
      const pair = prev.restingPairs.find((p) => p.id === id);
      if (!pair) return prev;
      const nextResting = prev.restingPairs.filter((p) => p.id !== id);
      return {
        ...prev,
        restingPairs: nextResting,
        queue: [...prev.queue, { ...pair, status: 'waiting' }],
      };
    });
    showToast('ย้ายผู้เล่นกลับเข้าคิวผู้ท้าชิงแล้ว', 'info');
  };

  const handleRemovePair = (id: string, from: 'queue' | 'resting') => {
    setAppState((prev) => {
      if (from === 'queue') {
        return { ...prev, queue: prev.queue.filter((p) => p.id !== id) };
      } else {
        return { ...prev, restingPairs: prev.restingPairs.filter((p) => p.id !== id) };
      }
    });
  };

  const handleEditPairName = (id: string, newName: string) => {
    setAppState((prev) => {
      const updateList = (list: PlayerPair[]) =>
        list.map((p) => (p.id === id ? { ...p, name: newName } : p));
      const nextCourt = { ...prev.court };
      if (nextCourt.teamA?.id === id) nextCourt.teamA.name = newName;
      if (nextCourt.teamB?.id === id) nextCourt.teamB.name = newName;
      return {
        ...prev,
        court: nextCourt,
        queue: updateList(prev.queue),
        restingPairs: updateList(prev.restingPairs),
      };
    });
  };

  const handleShuffleQueue = () => {
    setAppState((prev) => {
      const q = [...prev.queue];
      for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
      return { ...prev, queue: q };
    });
    showToast('สุ่มสลับลำดับคิวเรียบร้อย', 'info');
  };

  /**
   * Sort queue strictly by rule: Losers get to play before 2-game winners
   */
  const handleSortQueueByRule = () => {
    if (appState.queue.length <= 1) return;
    setAppState((prev) => {
      // Sort rule: Teams that lost (lastMatchResult === 'loss') or waiting longer get placed ahead of 2-game winners (lastMatchResult === 'king_exit')
      const sortedQueue = [...prev.queue].sort((a, b) => {
        if (a.lastMatchResult === 'king_exit' && b.lastMatchResult !== 'king_exit') return 1;
        if (b.lastMatchResult === 'king_exit' && a.lastMatchResult !== 'king_exit') return -1;
        return 0;
      });
      return {
        ...prev,
        queue: sortedQueue,
      };
    });
    showToast('จัดลำดับคิวตามกฎ: คนแพ้ได้ลงก่อนคนชนะ 2 ตาติด เรียบร้อย', 'success');
  };

  const handleResetSession = () => {
    if (window.confirm('ต้องการรีเซ็ตข้อมูลคิวและคะแนนทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?')) {
      setAppState(INITIAL_STATE);
      showToast('รีเซ็ตข้อมูลเซสชันเรียบร้อย', 'info');
    }
  };

  // Compile full list of players for leaderboard/export
  const allCurrentPairs: PlayerPair[] = [
    ...(appState.court.teamA ? [appState.court.teamA] : []),
    ...(appState.court.teamB ? [appState.court.teamB] : []),
    ...appState.queue,
    ...appState.restingPairs,
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col font-['Prompt',-apple-system,BlinkMacSystemFont,sans-serif] selection:bg-neutral-900 selection:text-white">
      {/* Top App Header */}
      <Header
        canUndo={appState.undoStack.length > 0}
        undoDepth={appState.undoStack.length}
        onUndo={handleUndo}
        onOpenSheets={() => setIsSheetsOpen(true)}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenMeetup={() => setIsMeetupOpen(true)}
        meetupParticipantsCount={meetupSession.participants.length}
        meetupMaxParticipants={meetupSession.maxParticipants}
        onResetSession={handleResetSession}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        sheetsConnected={Boolean(sheetsConfig.spreadsheetId)}
        sheetTitle={sheetsConfig.spreadsheetTitle}
        isAdminView={isAdminView}
        onToggleAdminView={() => setIsAdminView((prev) => !prev)}
        isSheetsAuthorized={isSheetsAuthorized}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-[calc(max(env(safe-area-inset-bottom),12px)+64px)] sm:bottom-6 right-3 sm:right-6 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className={`px-4 py-2.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] text-xs sm:text-sm font-medium flex items-center gap-2.5 border backdrop-blur-md ${
            toastMessage.type === 'success'
              ? 'bg-white/95 text-emerald-700 border-emerald-200'
              : toastMessage.type === 'warn'
              ? 'bg-white/95 text-amber-700 border-amber-200'
              : 'bg-white/95 text-neutral-800 border-neutral-200/80'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              toastMessage.type === 'success' ? 'bg-emerald-500' : toastMessage.type === 'warn' ? 'bg-amber-500' : 'bg-neutral-400'
            }`} />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-6 flex-1 w-full space-y-4 sm:space-y-6 pb-28 lg:pb-8">
        {isAdminView ? (
          <AdminDashboard
            appState={appState}
            setAppState={setAppState}
            sheetsConfig={sheetsConfig}
            onOpenSheets={() => setIsSheetsOpen(true)}
            onBackToCourt={() => setIsAdminView(false)}
            onOpenMeetup={() => setIsMeetupOpen(true)}
            showToast={showToast}
          />
        ) : (
          <>
            {/* Mobile Segmented View Bar (Mobile & Tablet) */}
            <div className="lg:hidden sticky top-14 sm:top-16 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 bg-[#f5f5f7]/95 backdrop-blur-md border-b border-neutral-200/70">
              <div className="grid grid-cols-4 bg-neutral-200/70 p-1 rounded-2xl text-xs font-semibold gap-1 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => setMobileTab('court')}
                  className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation active:scale-95 ${
                    mobileTab === 'court'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <span>🏸 คอร์ด</span>
                  {appState.court.status === 'ACTIVE' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMobileTab('queue')}
                  className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation active:scale-95 ${
                    mobileTab === 'queue'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <span>คิว</span>
                  <span className="font-mono px-1.5 py-0.2 bg-neutral-200 text-neutral-700 rounded-full text-[10px] font-bold">
                    {appState.queue.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileTab('history')}
                  className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation active:scale-95 ${
                    mobileTab === 'history'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <span>ประวัติ</span>
                  {appState.historyLog.length > 0 && (
                    <span className="font-mono px-1.5 py-0.2 bg-neutral-200 text-neutral-700 rounded-full text-[10px] font-bold">
                      {appState.historyLog.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMobileTab('all')}
                  className={`py-2 rounded-xl flex items-center justify-center gap-1 transition touch-manipulation active:scale-95 ${
                    mobileTab === 'all'
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <span>ทั้งหมด</span>
                </button>
              </div>
            </div>

            {/* View Layout - Responsive for Mobile & Desktop */}
            <div className="space-y-4 sm:space-y-6">
              {/* Core Court Arena (Always on Desktop, conditional on Mobile) */}
              <div className={`${mobileTab === 'court' || mobileTab === 'all' ? 'block' : 'hidden lg:block'}`}>
                <CourtView
                  court={appState.court}
                  queue={appState.queue}
                  onResolveMatch={handleResolveMatch}
                  onSwapSides={handleSwapSides}
                  onSeatNextChallenger={handleSeatNextChallenger}
                  onSubToRest={handleSubToRest}
                  onClearCourt={() => {}}
                />
              </div>

              {/* Queue Management & Match History Split Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
                {/* Left Column: Challenger Queue & Resting Bench (7 cols) */}
                <div className={`lg:col-span-7 ${mobileTab === 'queue' || mobileTab === 'all' ? 'block' : 'hidden lg:block'}`}>
                  <QueueManager
                    queue={appState.queue}
                    restingPairs={appState.restingPairs}
                    canSeatDirectly={!appState.court.teamA || !appState.court.teamB}
                    onAddPair={handleAddPair}
                    onAddPresets={handleAddPresets}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onMoveToRest={handleMoveToRest}
                    onReturnFromRest={handleReturnFromRest}
                    onRemovePair={handleRemovePair}
                    onSeatPairDirectly={handleSeatPairDirectly}
                    onEditPairName={handleEditPairName}
                    onShuffleQueue={handleShuffleQueue}
                    onSortQueueByRule={handleSortQueueByRule}
                  />
                </div>

                {/* Right Column: Match History Log (5 cols) */}
                <div className={`lg:col-span-5 ${mobileTab === 'history' || mobileTab === 'all' ? 'block' : 'hidden lg:block'}`}>
                  <HistoryLog
                    history={appState.historyLog}
                    onExportCsv={() => {
                      if (!isSheetsAuthorized) {
                        showToast('การส่งออกข้อมูลจำกัดเฉพาะแอดมินหรือผู้ได้รับสิทธิ์เท่านั้น', 'warn');
                        return;
                      }
                      googleSheetsService.downloadCsv(appState.historyLog, allCurrentPairs);
                    }}
                    onOpenSheets={() => setIsSheetsOpen(true)}
                    sheetsConnected={Boolean(sheetsConfig.spreadsheetId && isSheetsAuthorized)}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Mobile Floating Sticky Quick Status Bar when match active & viewing other tabs */}
      {!isAdminView && mobileTab !== 'court' && mobileTab !== 'all' && appState.court.status === 'ACTIVE' && appState.court.teamA && appState.court.teamB && (
        <div className="lg:hidden fixed bottom-[calc(max(env(safe-area-inset-bottom),10px)+60px)] inset-x-3 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setMobileTab('court')}
            className="w-full p-3 bg-neutral-900 text-white rounded-2xl shadow-xl flex items-center justify-between border border-neutral-700/80 active:scale-[0.98] transition text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-neutral-400 block font-normal">กำลังแข่งในคอร์ด</span>
                <span className="text-xs font-bold truncate block">
                  {appState.court.teamA.name} vs {appState.court.teamB.name}
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-300 bg-white/10 px-2.5 py-1 rounded-xl shrink-0">
              ดูกระดานคะแนน 🏸
            </span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation Dock */}
      <nav aria-label="แถบเมนูนำทางหลักบนมือถือ" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-neutral-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] pb-[max(env(safe-area-inset-bottom),8px)] pt-1 px-2">
        <div className="grid grid-cols-6 items-center max-w-lg mx-auto">
          {/* 1. Court Tab */}
          <button
            type="button"
            onClick={() => {
              setIsAdminView(false);
              setMobileTab('court');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition touch-manipulation active:scale-95 relative ${
              !isAdminView && mobileTab === 'court' ? 'text-neutral-950 font-bold' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <div className="relative">
              <span className="text-base sm:text-lg">🏸</span>
              {appState.court.status === 'ACTIVE' && (
                <span className="absolute -top-0.5 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">คอร์ด</span>
          </button>

          {/* 2. Queue Tab */}
          <button
            type="button"
            onClick={() => {
              setIsAdminView(false);
              setMobileTab('queue');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition touch-manipulation active:scale-95 relative ${
              !isAdminView && mobileTab === 'queue' ? 'text-neutral-950 font-bold' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <div className="relative">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              {appState.queue.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[14px] h-[14px] bg-neutral-900 text-white rounded-full text-[8.5px] font-mono font-bold flex items-center justify-center">
                  {appState.queue.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">คิว</span>
          </button>

          {/* 3. Meetup Group Tab */}
          <button
            type="button"
            onClick={() => setIsMeetupOpen(true)}
            className="min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition touch-manipulation active:scale-95 text-neutral-500 hover:text-neutral-900 relative"
          >
            <div className="relative">
              <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[14px] h-[14px] bg-emerald-600 text-white rounded-full text-[8px] font-mono font-bold flex items-center justify-center">
                {meetupSession.participants.length}
              </span>
            </div>
            <span className="text-[10px] mt-0.5 text-emerald-700 font-semibold">ก๊วน/จ่าย</span>
          </button>

          {/* 4. History Tab */}
          <button
            type="button"
            onClick={() => {
              setIsAdminView(false);
              setMobileTab('history');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition touch-manipulation active:scale-95 relative ${
              !isAdminView && mobileTab === 'history' ? 'text-neutral-950 font-bold' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <div className="relative">
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
              {appState.historyLog.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 py-0.2 min-w-[14px] h-[14px] bg-neutral-200 text-neutral-800 rounded-full text-[8.5px] font-mono font-bold flex items-center justify-center">
                  {appState.historyLog.length}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">ประวัติ</span>
          </button>

          {/* 5. Google Sheets Tab */}
          <button
            type="button"
            onClick={() => setIsSheetsOpen(true)}
            className="min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition touch-manipulation active:scale-95 text-neutral-400 hover:text-neutral-700 relative"
          >
            <div className="relative">
              <FileSpreadsheet className={`w-4 h-4 sm:w-5 sm:h-5 ${sheetsConfig.spreadsheetId && isSheetsAuthorized ? 'text-emerald-600' : 'text-neutral-400'}`} />
              {sheetsConfig.spreadsheetId && isSheetsAuthorized ? (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
              ) : !isSheetsAuthorized ? (
                <Lock className="w-2.5 h-2.5 text-amber-500 absolute -bottom-0.5 -right-1.5" />
              ) : null}
            </div>
            <span className="text-[10px] mt-0.5">ชีต</span>
          </button>

          {/* 6. Admin Backoffice Tab */}
          <button
            type="button"
            onClick={() => setIsAdminView(!isAdminView)}
            className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition touch-manipulation active:scale-95 relative ${
              isAdminView ? 'text-indigo-600 font-bold' : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <div className="relative">
              <ShieldCheck className={`w-4 h-4 sm:w-5 sm:h-5 ${isAdminView ? 'text-indigo-600' : 'text-neutral-400'}`} />
              {isAdminView && <span className="w-1.5 h-1.5 rounded-full absolute -top-0.5 -right-1 bg-indigo-600" />}
            </div>
            <span className="text-[10px] mt-0.5">แอดมิน</span>
          </button>
        </div>
      </nav>

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200/80 bg-white/50 py-5 text-center text-xs text-neutral-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SmashQueue · ระบบจัดคิวแบดมินตัน ชนะ 2 ตาติดออก · คนแพ้ได้ลงก่อนคนชนะ</span>
          <span className="text-neutral-400">
            ระบบความปลอดภัยและซิงค์ข้อมูล Google Sheets ในตัว
          </span>
        </div>
      </footer>

      {/* Modals */}
      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        allPairs={allCurrentPairs}
        history={appState.historyLog}
      />

      <GoogleSheetsModal
        isOpen={isSheetsOpen}
        onClose={() => setIsSheetsOpen(false)}
        config={sheetsConfig}
        onUpdateConfig={setSheetsConfig}
        history={appState.historyLog}
        allPairs={allCurrentPairs}
      />

      <MeetupGroupModal
        isOpen={isMeetupOpen}
        onClose={() => setIsMeetupOpen(false)}
        session={meetupSession}
        onUpdateSession={setMeetupSession}
        onAddParticipantToQueue={(name) => {
          handleAddPair(name);
          showToast(`เพิ่ม "${name}" เข้าสู่คิวผู้ท้าชิงเรียบร้อย`, 'success');
        }}
        isAdmin={isSheetsAuthorized}
      />
    </div>
  );
}
