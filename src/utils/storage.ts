import { AppState, GoogleSheetsConfig } from '../types/badminton';

const STORAGE_KEY = 'smash_queue_badminton_app_state_v1';
const SHEETS_CONFIG_KEY = 'smash_queue_sheets_config_v1';

export const INITIAL_STATE: AppState = {
  court: {
    teamA: {
      id: 'pair-1',
      name: 'อาร์ท + นัท',
      consecutiveWins: 1,
      totalMatches: 2,
      status: 'playing',
      createdAt: Date.now() - 3600000,
    },
    teamB: {
      id: 'pair-2',
      name: 'เคน + แม็กซ์',
      consecutiveWins: 0,
      totalMatches: 1,
      status: 'playing',
      createdAt: Date.now() - 3000000,
    },
    status: 'ACTIVE',
    matchStartedAt: Date.now() - 320000, // 5 min 20s ago
  },
  queue: [
    {
      id: 'pair-3',
      name: 'พลอย + ต้น',
      consecutiveWins: 0,
      totalMatches: 1,
      status: 'waiting',
      createdAt: Date.now() - 2500000,
    },
    {
      id: 'pair-4',
      name: 'เมย์ + โบว์',
      consecutiveWins: 0,
      totalMatches: 0,
      status: 'waiting',
      createdAt: Date.now() - 2000000,
    },
    {
      id: 'pair-5',
      name: 'แบงค์ + โอ๊ค',
      consecutiveWins: 0,
      totalMatches: 0,
      status: 'waiting',
      createdAt: Date.now() - 1500000,
    },
  ],
  restingPairs: [
    {
      id: 'pair-6',
      name: 'เดฟ + แซม',
      consecutiveWins: 0,
      totalMatches: 2,
      status: 'resting',
      createdAt: Date.now() - 3500000,
    },
  ],
  historyLog: [
    {
      matchId: 'match-init-1',
      timestamp: Date.now() - 720000,
      teamA: 'อาร์ท + นัท',
      teamB: 'พลอย + ต้น',
      winner: 'อาร์ท + นัท',
      scoreA: 21,
      scoreB: 17,
      durationSeconds: 780,
      winnerConsecutiveWinsBefore: 0,
      winnerConsecutiveWinsAfter: 1,
      forcedExit: false,
    },
  ],
  undoStack: [],
};

export const INITIAL_SHEETS_CONFIG: GoogleSheetsConfig = {
  spreadsheetId: null,
  spreadsheetUrl: null,
  spreadsheetTitle: null,
  autoSync: true,
  lastSyncedAt: null,
  userEmail: null,
};

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.court) return INITIAL_STATE;
    return parsed;
  } catch {
    return INITIAL_STATE;
  }
}

export function saveAppState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function loadSheetsConfig(): GoogleSheetsConfig {
  try {
    const raw = localStorage.getItem(SHEETS_CONFIG_KEY);
    if (!raw) return INITIAL_SHEETS_CONFIG;
    return JSON.parse(raw);
  } catch {
    return INITIAL_SHEETS_CONFIG;
  }
}

export function saveSheetsConfig(config: GoogleSheetsConfig) {
  try {
    localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}
