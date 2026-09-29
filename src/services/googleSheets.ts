import { MatchHistoryItem, PlayerPair } from '../types/badminton';

export const OAUTH_CLIENT_ID = '68205401171-sdkp7mromp8ktk8st56qvh4nb7ish5gt.apps.googleusercontent.com';
export const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
            error_callback?: (err: any) => void;
            prompt?: string;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

export interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface StoredAuth {
  accessToken: string;
  expiresAt: number;
  userEmail?: string;
}

class GoogleSheetsService {
  private tokenClient: GoogleTokenClient | null = null;
  private currentAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private userEmail: string | null = null;

  private pendingResolve: ((token: string) => void) | null = null;
  private pendingReject: ((err: any) => void) | null = null;

  constructor() {
    this.restoreToken();
    if (typeof window !== 'undefined') {
      // Try to initialize token client as soon as script is ready
      window.addEventListener('load', () => this.ensureClientInitialized());
      // Check periodically until google script is ready
      const checkInterval = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          this.ensureClientInitialized();
          clearInterval(checkInterval);
        }
      }, 500);
      setTimeout(() => clearInterval(checkInterval), 10000);
    }
  }

  private restoreToken() {
    try {
      const stored = localStorage.getItem('smash_queue_google_auth');
      if (stored) {
        const parsed: StoredAuth = JSON.parse(stored);
        if (parsed.expiresAt > Date.now() + 60000) {
          this.currentAccessToken = parsed.accessToken;
          this.tokenExpiresAt = parsed.expiresAt;
          this.userEmail = parsed.userEmail || null;
        } else {
          localStorage.removeItem('smash_queue_google_auth');
        }
      }
    } catch {
      // ignore
    }
  }

  private saveToken(token: string, expiresInSeconds: number, email?: string) {
    this.currentAccessToken = token;
    this.tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
    if (email) this.userEmail = email;

    const authData: StoredAuth = {
      accessToken: token,
      expiresAt: this.tokenExpiresAt,
      userEmail: this.userEmail || undefined,
    };
    localStorage.setItem('smash_queue_google_auth', JSON.stringify(authData));
  }

  public isAuthenticated(): boolean {
    return Boolean(this.currentAccessToken && this.tokenExpiresAt > Date.now() + 30000);
  }

  public getUserEmail(): string | null {
    return this.userEmail;
  }

  public disconnect() {
    this.currentAccessToken = null;
    this.tokenExpiresAt = 0;
    this.userEmail = null;
    localStorage.removeItem('smash_queue_google_auth');
  }

  /**
   * Initializes the Google Identity Services token client
   */
  public ensureClientInitialized(): boolean {
    if (this.tokenClient) return true;
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) return false;

    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: OAUTH_CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
          if (response.error || !response.access_token) {
            if (this.pendingReject) {
              const err = new Error(response.error || 'ไม่ได้รับสิทธิ์เข้าถึงบัญชี Google');
              this.pendingReject(err);
            }
            this.pendingResolve = null;
            this.pendingReject = null;
            return;
          }

          const expiresIn = response.expires_in || 3600;
          let email: string | undefined;

          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            if (res.ok) {
              const info = await res.json();
              email = info.email;
            }
          } catch {
            // optional userinfo
          }

          this.saveToken(response.access_token, expiresIn, email);

          if (this.pendingResolve) {
            this.pendingResolve(response.access_token);
          }
          this.pendingResolve = null;
          this.pendingReject = null;
        },
        error_callback: (err: any) => {
          const isPopupBlocked =
            err?.type === 'popup_failed_to_open' ||
            err?.message?.includes('popup') ||
            JSON.stringify(err || '').includes('popup');

          let errorObj: Error;
          if (isPopupBlocked) {
            errorObj = new Error(
              'เบราว์เซอร์บล็อกหน้าต่างป๊อปอัปเข้าสู่ระบบ (Popup Blocked) กรุณากดอนุญาตป๊อปอัปที่แถบ URL หรือแตะปุ่มเพื่อเปิดหน้าต่างอีกครั้ง'
            );
            (errorObj as any).isPopupBlocked = true;
          } else {
            errorObj = new Error(err?.message || `OAuth error: ${JSON.stringify(err)}`);
          }

          if (this.pendingReject) {
            this.pendingReject(errorObj);
          }
          this.pendingResolve = null;
          this.pendingReject = null;
        },
      });
      return true;
    } catch (e) {
      console.warn('Failed to init Google Token Client:', e);
      return false;
    }
  }

  /**
   * Request Google OAuth token. Must be initiated during a user click gesture.
   */
  public authorize(): Promise<string> {
    if (this.isAuthenticated() && this.currentAccessToken) {
      return Promise.resolve(this.currentAccessToken);
    }

    const ready = this.ensureClientInitialized();
    if (!ready || !this.tokenClient) {
      const err = new Error('Google Identity Services ยังโหลดไม่เสร็จสมบูรณ์ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง');
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      try {
        // Trigger popup synchronously in direct response to user gesture
        this.tokenClient!.requestAccessToken({ prompt: 'select_account' });
      } catch (err: any) {
        this.pendingResolve = null;
        this.pendingReject = null;
        reject(err);
      }
    });
  }

  /**
   * Creates a new badminton court session Google Spreadsheet with pre-formatted sheets and headers
   */
  public async createSessionSpreadsheet(title?: string): Promise<{ id: string; url: string; title: string }> {
    const token = await this.authorize();
    const sheetTitle = title || `คิวแบดมินตัน ครองคอร์ต - ${new Date().toLocaleDateString('th-TH')}`;

    const createPayload = {
      properties: {
        title: sheetTitle,
      },
      sheets: [
        {
          properties: {
            title: 'Match History',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: 'Player Standings',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    };

    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createPayload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'ไม่สามารถสร้าง Google Spreadsheet ได้ กรุณาลองใหม่อีกครั้ง');
    }

    const data = await res.json();
    const spreadsheetId = data.spreadsheetId;
    const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Populate initial headers
    await this.setupSheetHeaders(spreadsheetId, token);

    return {
      id: spreadsheetId,
      url: spreadsheetUrl,
      title: sheetTitle,
    };
  }

  private async setupSheetHeaders(spreadsheetId: string, token: string) {
    const historyHeaders = [
      ['# แมตช์', 'วันและเวลา', 'ทีม A', 'ทีม B', 'ผู้ชนะ', 'คะแนน (A - B)', 'ระยะเวลาแข่ง', 'สถานะครองคอร์ต', 'Match ID'],
    ];

    const standingsHeaders = [
      ['ชื่อคู่ / ผู้เล่น', 'จำนวนแมตช์ที่เล่น', 'ชนะติดต่อกันปัจจุบัน', 'สถานะ', 'อัปเดตล่าสุด'],
    ];

    // Append headers to Match History
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Match History'!A1:I1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: historyHeaders,
        }),
      }
    );

    // Append headers to Player Standings
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Player Standings'!A1:E1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: standingsHeaders,
        }),
      }
    );
  }

  /**
   * Append a single completed match record to Google Sheet
   */
  public async appendMatchRecord(spreadsheetId: string, item: MatchHistoryItem, matchNumber: number): Promise<boolean> {
    const token = await this.authorize();

    const durationText = item.durationSeconds
      ? `${Math.floor(item.durationSeconds / 60)} นาที ${item.durationSeconds % 60} วิ`
      : '-';

    const kingNote = item.forcedExit
      ? 'ชนะครบ 2/2 เกม (สลับออกไปต่อท้ายคิว)'
      : `ครองคอร์ตต่อ (ชนะติด ${item.winnerConsecutiveWinsAfter}/2 เกม)`;

    const row = [
      matchNumber,
      new Date(item.timestamp).toLocaleString('th-TH'),
      item.teamA,
      item.teamB,
      item.winner,
      item.scoreA !== undefined && item.scoreB !== undefined ? `${item.scoreA} - ${item.scoreB}` : '-',
      durationText,
      kingNote,
      item.matchId || '-',
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Match History'!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );

    return res.ok;
  }

  /**
   * Sync complete match history and player standings to Google Sheet
   */
  public async syncAllData(
    spreadsheetId: string,
    history: MatchHistoryItem[],
    allPairs: PlayerPair[]
  ): Promise<{ success: boolean; message: string }> {
    const token = await this.authorize();

    // 1. Sync Match History
    const historyRows = [
      ['# แมตช์', 'วันและเวลา', 'ทีม A', 'ทีม B', 'ผู้ชนะ', 'คะแนน (A - B)', 'ระยะเวลาแข่ง', 'สถานะครองคอร์ต', 'Match ID'],
      ...history.map((item, idx) => {
        const matchNum = history.length - idx;
        const durationText = item.durationSeconds
          ? `${Math.floor(item.durationSeconds / 60)} นาที ${item.durationSeconds % 60} วิ`
          : '-';
        const kingNote = item.forcedExit
          ? 'ชนะครบ 2/2 เกม (สลับออกไปต่อท้ายคิว)'
          : `ครองคอร์ตต่อ (ชนะติด ${item.winnerConsecutiveWinsAfter}/2 เกม)`;

        return [
          matchNum,
          new Date(item.timestamp).toLocaleString('th-TH'),
          item.teamA,
          item.teamB,
          item.winner,
          item.scoreA !== undefined && item.scoreB !== undefined ? `${item.scoreA} - ${item.scoreB}` : '-',
          durationText,
          kingNote,
          item.matchId || '-',
        ];
      }),
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Match History'!A1:I${historyRows.length + 5}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: historyRows,
        }),
      }
    );

    // 2. Sync Player Standings
    const standingsRows = [
      ['ชื่อคู่ / ผู้เล่น', 'จำนวนแมตช์ที่เล่น', 'ชนะติดต่อกันปัจจุบัน', 'สถานะ', 'อัปเดตล่าสุด'],
      ...allPairs.map((p) => [
        p.name,
        p.totalMatches,
        p.consecutiveWins,
        p.status === 'playing' ? 'กำลังแข่ง' : p.status === 'waiting' ? 'รอคิว' : 'พัก',
        new Date().toLocaleTimeString('th-TH'),
      ]),
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Player Standings'!A1:E${standingsRows.length + 5}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: standingsRows,
        }),
      }
    );

    return {
      success: true,
      message: `ซิงค์ประวัติ ${history.length} แมตช์ และผู้เล่น ${allPairs.length} คู่ เรียบร้อยแล้ว`,
    };
  }

  /**
   * Export CSV format for offline usage without sheets
   */
  public downloadCsv(history: MatchHistoryItem[], allPairs: PlayerPair[]) {
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';

    // Match history section
    csvContent += '--- ประวัติการแข่งขัน (Match History) ---\n';
    csvContent += '#,วันและเวลา,ทีม A,ทีม B,ผู้ชนะ,คะแนน,ระยะเวลา,สถานะ\n';
    history.forEach((item, idx) => {
      const matchNum = history.length - idx;
      const duration = item.durationSeconds ? `${Math.floor(item.durationSeconds / 60)}m ${item.durationSeconds % 60}s` : '-';
      const score = item.scoreA !== undefined && item.scoreB !== undefined ? `${item.scoreA}-${item.scoreB}` : '-';
      const note = item.forcedExit ? 'ชนะ 2/2 ครบโควตา' : 'ครองคอร์ตต่อ';
      csvContent += `"${matchNum}","${new Date(item.timestamp).toLocaleString('th-TH')}","${item.teamA}","${item.teamB}","${item.winner}","${score}","${duration}","${note}"\n`;
    });

    csvContent += '\n--- รายชื่อและสถิติผู้เล่น (Player Standings) ---\n';
    csvContent += 'ชื่อคู่,จำนวนแมตช์,ชนะติด,สถานะ\n';
    allPairs.forEach((p) => {
      csvContent += `"${p.name}","${p.totalMatches}","${p.consecutiveWins}","${p.status}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smash_queue_session_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const googleSheetsService = new GoogleSheetsService();
