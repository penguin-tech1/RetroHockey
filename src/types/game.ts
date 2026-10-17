export type Position = 'C' | 'LW' | 'RW' | 'D' | 'G';
export type CardTier = 'LEGENDARY' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE';
export type PlayerArchetype =
  | 'Sniper'
  | 'Playmaker'
  | 'Enforcer'
  | 'Two-Way Defenseman'
  | 'Brick Wall Goalie';

export interface PlayerCard {
  id: number;
  name: string;
  teamId: number;
  teamName: string;
  pos: Position;
  tier: CardTier;
  ovr: number;
  skt: number;
  sht: number;
  pas: number;
  chk: number;
  def: number; // Note: for Goalies (G), this represents GLO (Glove / Reflexes)
  archetype: PlayerArchetype;
  price: number;
}

export interface FranchiseTeam {
  id: number;
  name: string;
  city: string;
  mascot: string;
  abbr: string;
  primaryColor: string;
  secondaryColor: string;
  jerseyAccent: string;
  players: PlayerCard[];
}

export interface InternationalTeam {
  id: string;
  name: string;
  code: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  ovr: number;
  rosterIds: number[]; // maps to top players in the 500-player database or international stars
}

export type RinkTierId = 1 | 2 | 3 | 4 | 5;
export type DifficultyMode = 'EASY' | 'PRO' | 'LEGEND';
export type PlayerAutoDifficulty = 'EASY' | 'HARD' | 'LEGEND';

export interface RinkVenue {
  tier: RinkTierId;
  name: string;
  subtitle: string;
  description: string;
  iceTint: string;
  boardColor: string;
  glassColor: string;
  isOutdoor: boolean;
  rewardMultiplier: number;
  unlockWinsRequired: number;
  opponentTeamIds: number[];
}

export interface ActiveLineup {
  C: number;
  LW: number;
  RW: number;
  LD: number;
  RD: number;
  G: number;
}

export interface DynastySaveState {
  coins: number;
  wins: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  unlockedTier: RinkTierId;
  currentTier: RinkTierId;
  ownedCardIds: number[];
  duplicateCounts: Record<number, number>;
  lineup: ActiveLineup;
  teamName: string;
  primaryColor: string;
  secondaryColor: string;
  difficulty: DifficultyMode;
  autoMode: boolean;
  playerAutoDifficulty: PlayerAutoDifficulty;
  autoBuildMode: boolean;
  gopiMode: boolean;
  crtScanlines: boolean;
  shootoutHighScore: number;
  hardestShotMph: number;
  soundEnabled: boolean;
  announcerEnabled: boolean;
  tournamentBracket: WorldCupState | null;
}

export interface WorldCupMatch {
  id: string;
  round: 'R16' | 'QF' | 'SF' | 'FINAL';
  teamA: string; // InternationalTeam id
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
  seriesWinsA: number;
  seriesWinsB: number;
  winner: string | null;
}

export interface WorldCupState {
  userTeamId: string;
  format: 'SINGLE' | 'BO3';
  currentRound: 'R16' | 'QF' | 'SF' | 'FINAL' | 'CHAMPION';
  matches: WorldCupMatch[];
}
