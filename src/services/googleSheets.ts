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
            error_callback?: (err: unknown) => void;
            prompt?: string;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
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

  constructor() {
    this.restoreToken();
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

  public async authorize(): Promise<string> {
    if (this.isAuthenticated() && this.currentAccessToken) {
      return this.currentAccessToken;
    }

    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services script is loading. Please try again in a moment.');
    }

    return new Promise((resolve, reject) => {
      try {
        const client = window.google!.accounts.oauth2.initTokenClient({
          client_id: OAUTH_CLIENT_ID,
          scope: SCOPES,
          callback: async (response) => {
            if (response.error || !response.access_token) {
              reject(new Error(response.error || 'Failed to obtain access token'));
              return;
            }

            const expiresIn = response.expires_in || 3600;
            let email: string | undefined;

            try {
              // Fetch user info for display
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
            resolve(response.access_token);
          },
          error_callback: (err) => {
            reject(new Error(`OAuth error: ${JSON.stringify(err)}`));
          },
        });

        this.tokenClient = client;
        client.requestAccessToken();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Creates a new badminton court session Google Spreadsheet with pre-formatted sheets and headers
   */
  public async createSessionSpreadsheet(title?: string): Promise<{ id: string; url: string; title: string }> {
    const token = await this.authorize();
    const sheetTitle = title || `Badminton King of the Court - ${new Date().toLocaleDateString('en-GB')}`;

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
      const err = await res.json();
      throw new Error(err.error?.message || 'Failed to create Google Spreadsheet');
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
      ['#', 'Date & Time', 'Team A', 'Team B', 'Winner', 'Score (A - B)', 'Duration', 'King Status / Rule', 'Match ID'],
    ];

    const standingsHeaders = [
      ['Pair / Player Name', 'Total Matches Played', 'Current Win Streak', 'Status', 'Last Updated'],
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
      ? `${Math.floor(item.durationSeconds / 60)}m ${item.durationSeconds % 60}s`
      : '-';

    const kingNote = item.forcedExit
      ? 'King Crowned (2/2 Wins - Force Exited to Queue Tail)'
      : `Champion Stays (${item.winnerConsecutiveWinsAfter}/2 Consecutive Wins)`;

    const row = [
      matchNumber,
      new Date(item.timestamp).toLocaleString(),
      item.teamA,
      item.teamB,
      item.winner,
      item.scoreA !== undefined && item.scoreB !== undefined ? `${item.scoreA} - ${item.scoreB}` : 'Finished',
      durationText,
      kingNote,
      item.matchId,
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Match History'!A:I:append?valueInputOption=USER_ENTERED`,
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
   * Sync complete match history & player standings to Google Sheet
   */
  public async syncAllData(
    spreadsheetId: string,
    history: MatchHistoryItem[],
    allPairs: PlayerPair[]
  ): Promise<{ success: boolean; message: string }> {
    const token = await this.authorize();

    // 1. Ensure headers exist & clear old match list
    const historyRows: (string | number)[][] = [
      ['#', 'Date & Time', 'Team A', 'Team B', 'Winner', 'Score (A - B)', 'Duration', 'King Status / Rule', 'Match ID'],
    ];

    history.forEach((item, idx) => {
      const durationText = item.durationSeconds
        ? `${Math.floor(item.durationSeconds / 60)}m ${item.durationSeconds % 60}s`
        : '-';

      const kingNote = item.forcedExit
        ? 'King Crowned (2/2 Wins - Force Exited to Queue Tail)'
        : `Champion Stays (${item.winnerConsecutiveWinsAfter}/2 Consecutive Wins)`;

      historyRows.push([
        idx + 1,
        new Date(item.timestamp).toLocaleString(),
        item.teamA,
        item.teamB,
        item.winner,
        item.scoreA !== undefined && item.scoreB !== undefined ? `${item.scoreA} - ${item.scoreB}` : 'Finished',
        durationText,
        kingNote,
        item.matchId,
      ]);
    });

    // 2. Player standings
    const standingsRows: (string | number)[][] = [
      ['Pair / Player Name', 'Total Matches Played', 'Current Win Streak', 'Status', 'Last Updated'],
    ];

    // Sort by matches and win streak
    const sortedPairs = [...allPairs].sort((a, b) => b.totalMatches - a.totalMatches || b.consecutiveWins - a.consecutiveWins);

    sortedPairs.forEach((pair) => {
      standingsRows.push([
        pair.name,
        pair.totalMatches,
        pair.consecutiveWins,
        pair.status.toUpperCase(),
        new Date().toLocaleTimeString(),
      ]);
    });

    // Write to Match History
    const historyRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Match History'!A1:I${historyRows.length}?valueInputOption=USER_ENTERED`,
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

    // Write to Player Standings
    const standingsRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Player Standings'!A1:E${standingsRows.length}?valueInputOption=USER_ENTERED`,
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

    if (historyRes.ok && standingsRes.ok) {
      return { success: true, message: `Successfully synced ${history.length} matches and ${sortedPairs.length} pairs.` };
    } else {
      throw new Error('Failed to update one or more sheets in Google Spreadsheet');
    }
  }

  /**
   * Helper to download match history as CSV
   */
  public downloadCsv(history: MatchHistoryItem[], allPairs: PlayerPair[]) {
    let csv = 'Match #,Timestamp,Team A,Team B,Winner,Score,Duration,King Status\n';
    history.forEach((item, idx) => {
      const score = item.scoreA !== undefined ? `"${item.scoreA}-${item.scoreB}"` : '""';
      const dur = item.durationSeconds ? `"${Math.floor(item.durationSeconds / 60)}m ${item.durationSeconds % 60}s"` : '""';
      const kingStatus = item.forcedExit ? '"King Crowned (2 Wins - Exit)"' : `"${item.winnerConsecutiveWinsAfter} Win(s) Champion"`;
      csv += `${idx + 1},"${new Date(item.timestamp).toISOString()}","${item.teamA}","${item.teamB}","${item.winner}",${score},${dur},${kingStatus}\n`;
    });

    csv += '\n\nPlayer Standings\nPair Name,Total Matches,Win Streak,Status\n';
    allPairs.forEach((p) => {
      csv += `"${p.name}",${p.totalMatches},${p.consecutiveWins},"${p.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Badminton_Court_Session_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const googleSheetsService = new GoogleSheetsService();
