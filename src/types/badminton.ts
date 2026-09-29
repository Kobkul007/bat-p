export interface PlayerPair {
  id: string;
  name: string; // e.g., "Art + Nut"
  consecutiveWins: number; // 0, 1, or 2
  totalMatches: number;
  status: 'playing' | 'waiting' | 'resting';
  createdAt: number;
}

export interface CourtState {
  teamA: PlayerPair | null;
  teamB: PlayerPair | null;
  status: 'IDLE' | 'ACTIVE' | 'WAITING_PLAYERS';
  matchStartedAt?: number;
}

export interface MatchHistoryItem {
  matchId: string;
  timestamp: number;
  teamA: string;
  teamB: string;
  winner: string;
  scoreA?: number;
  scoreB?: number;
  durationSeconds?: number;
  winnerConsecutiveWinsBefore: number;
  winnerConsecutiveWinsAfter: number;
  forcedExit: boolean; // true if winner reached >= 2 and exited
}

export interface AppState {
  court: CourtState;
  queue: PlayerPair[];
  restingPairs: PlayerPair[];
  historyLog: MatchHistoryItem[];
  undoStack: Array<{
    court: CourtState;
    queue: PlayerPair[];
    restingPairs: PlayerPair[];
  }>;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetTitle: string | null;
  autoSync: boolean;
  lastSyncedAt: number | null;
  userEmail: string | null;
}
