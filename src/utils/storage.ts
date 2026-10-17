import { DynastySaveState, WorldCupMatch, WorldCupState } from '../types/game';
import { INTERNATIONAL_TEAMS } from '../data/rosterData';

const STORAGE_KEY = 'RETRO_PUCK_94_DYNASTY_SAVE_V1';

export const DEFAULT_DYNASTY_SAVE: DynastySaveState = {
  coins: 1250,
  wins: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  unlockedTier: 1,
  currentTier: 1,
  // Start with a rookie Bronze squad from Anchorage Blizzard + extras
  ownedCardIds: [13, 11, 12, 21, 22, 25, 14, 15, 36, 37, 46, 50],
  duplicateCounts: {},
  lineup: {
    C: 13,  // C. Sleet (64 Bronze C)
    LW: 11, // H. Chill (68 Bronze LW)
    RW: 12, // P. Rime (66 Bronze RW)
    LD: 21, // S. Block (67 Bronze D)
    RD: 22, // D. Iron (62 Bronze D)
    G: 25,  // K. Driftwood (63 Bronze G)
  },
  teamName: 'Tuxedo Glaciers',
  primaryColor: '#0284c7',
  secondaryColor: '#facc15',
  difficulty: 'PRO',
  autoMode: false,
  playerAutoDifficulty: 'HARD',
  autoBuildMode: true,
  gopiMode: true, // Default tuned for Intel N-Series Locked 60 FPS & zero overdraw
  crtScanlines: false,
  shootoutHighScore: 14,
  hardestShotMph: 104,
  soundEnabled: true,
  announcerEnabled: true,
  tournamentBracket: null,
};

export function loadDynastySave(): DynastySaveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DYNASTY_SAVE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DYNASTY_SAVE,
      ...parsed,
      playerAutoDifficulty: parsed.playerAutoDifficulty || DEFAULT_DYNASTY_SAVE.playerAutoDifficulty,
      lineup: {
        ...DEFAULT_DYNASTY_SAVE.lineup,
        ...(parsed.lineup || {}),
      },
    };
  } catch {
    return DEFAULT_DYNASTY_SAVE;
  }
}

export function saveDynastyState(state: DynastySaveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota errors in restricted storage
  }
}

export function createInitialWorldCupBracket(
  userTeamId: string,
  format: 'SINGLE' | 'BO3'
): WorldCupState {
  const teams = INTERNATIONAL_TEAMS.map((t) => t.id);
  // Ensure userTeamId is at slot 0
  const idx = teams.indexOf(userTeamId);
  if (idx > 0) {
    const temp = teams[0];
    teams[0] = userTeamId;
    teams[idx] = temp;
  }

  const matches: WorldCupMatch[] = [];
  for (let i = 0; i < 8; i++) {
    matches.push({
      id: `R16_${i}`,
      round: 'R16',
      teamA: teams[i * 2],
      teamB: teams[i * 2 + 1],
      scoreA: null,
      scoreB: null,
      seriesWinsA: 0,
      seriesWinsB: 0,
      winner: null,
    });
  }

  return {
    userTeamId,
    format,
    currentRound: 'R16',
    matches,
  };
}
