import { ActiveLineup, PlayerCard } from '../types/game';
import { PLAYER_BY_ID } from '../data/rosterData';

export interface AutoBuildSlotChange {
  slot: keyof ActiveLineup;
  slotLabel: string;
  expectedPos: string;
  newPlayer: PlayerCard;
  oldPlayer?: PlayerCard;
  changed: boolean;
  ovrDiff: number;
}

export interface AutoBuildResult {
  lineup: ActiveLineup;
  changes: AutoBuildSlotChange[];
  oldOvr: number;
  newOvr: number;
  ovrDelta: number;
  hasUpgrades: boolean;
  upgradedCount: number;
}

export const LINEUP_SLOT_CONFIG: {
  slot: keyof ActiveLineup;
  label: string;
  expectedPos: 'C' | 'LW' | 'RW' | 'D' | 'G';
  fullName: string;
}[] = [
  { slot: 'LW', label: 'Left Wing', expectedPos: 'LW', fullName: 'Left Wing (LW)' },
  { slot: 'C', label: 'Center', expectedPos: 'C', fullName: 'Center (C)' },
  { slot: 'RW', label: 'Right Wing', expectedPos: 'RW', fullName: 'Right Wing (RW)' },
  { slot: 'LD', label: 'Left Defense', expectedPos: 'D', fullName: 'Left Defenseman (LD)' },
  { slot: 'RD', label: 'Right Defense', expectedPos: 'D', fullName: 'Right Defenseman (RD)' },
  { slot: 'G', label: 'Starting Goalie', expectedPos: 'G', fullName: 'Goaltender (G)' },
];

/**
 * Calculates average Overall rating of a 6-player starting lineup
 */
export function calculateLineupOvr(lineup: ActiveLineup): number {
  const ids = Object.values(lineup);
  if (ids.length === 0) return 0;
  const sum = ids.reduce((acc, id) => acc + (PLAYER_BY_ID[id]?.ovr || 60), 0);
  return Math.round(sum / ids.length);
}

/**
 * Checks whether the current player in a slot is the absolute best candidate
 * in the user's owned binder (honoring natural position first, then OVR).
 */
export function isBestCandidateInBinder(
  slot: keyof ActiveLineup,
  currentPlayerId: number,
  ownedCardIds: number[]
): boolean {
  const targetConfig = LINEUP_SLOT_CONFIG.find((s) => s.slot === slot);
  if (!targetConfig) return true;

  const current = PLAYER_BY_ID[currentPlayerId];
  if (!current) return false;

  const uniqueOwned = Array.from(new Set(ownedCardIds));
  const candidateCards = uniqueOwned
    .map((id) => PLAYER_BY_ID[id])
    .filter((p): p is PlayerCard => Boolean(p) && p.pos === targetConfig.expectedPos);

  if (candidateCards.length === 0) return true;

  candidateCards.sort((a, b) => b.ovr - a.ovr);
  const bestOvr = candidateCards[0].ovr;

  // For RD (second D slot), if user owns 2+ D, top 2 are acceptable
  if (slot === 'RD' && candidateCards.length >= 2) {
    const secondOvr = candidateCards[1].ovr;
    return current.ovr >= secondOvr && current.pos === targetConfig.expectedPos;
  }

  return current.ovr >= bestOvr && current.pos === targetConfig.expectedPos;
}

/**
 * Core Auto-Build Algorithm:
 * Places players in the right starting lineup spot by:
 * 1. FIRST natural position match (C -> C, LW -> LW, RW -> RW, D -> LD/RD, G -> G)
 * 2. THEN highest OVR within that position
 * 3. Fallbacks for missing natural positions use highest OVR remaining eligible cards
 */
export function autoBuildBestLineup(
  ownedCardIds: number[],
  currentLineup?: ActiveLineup
): AutoBuildResult {
  const uniqueOwnedIds = Array.from(new Set(ownedCardIds));
  const ownedCards: PlayerCard[] = uniqueOwnedIds
    .map((id) => PLAYER_BY_ID[id])
    .filter((p): p is PlayerCard => Boolean(p));

  // Sort helper: highest OVR first
  const sortByOvrDesc = (a: PlayerCard, b: PlayerCard) => b.ovr - a.ovr;

  // Partition owned cards by natural position
  const goalies = ownedCards.filter((p) => p.pos === 'G').sort(sortByOvrDesc);
  const centers = ownedCards.filter((p) => p.pos === 'C').sort(sortByOvrDesc);
  const leftWings = ownedCards.filter((p) => p.pos === 'LW').sort(sortByOvrDesc);
  const rightWings = ownedCards.filter((p) => p.pos === 'RW').sort(sortByOvrDesc);
  const defensemen = ownedCards.filter((p) => p.pos === 'D').sort(sortByOvrDesc);

  const assignedCardIds = new Set<number>();
  const newLineup: Partial<ActiveLineup> = {};

  // Step 1: Assign Goaltender (G) - highest OVR Goalie
  if (goalies.length > 0) {
    newLineup.G = goalies[0].id;
    assignedCardIds.add(goalies[0].id);
  }

  // Step 2: Assign Center (C) - highest OVR Center
  const topC = centers.find((p) => !assignedCardIds.has(p.id));
  if (topC) {
    newLineup.C = topC.id;
    assignedCardIds.add(topC.id);
  }

  // Step 3: Assign Left Wing (LW) - highest OVR Left Wing
  const topLW = leftWings.find((p) => !assignedCardIds.has(p.id));
  if (topLW) {
    newLineup.LW = topLW.id;
    assignedCardIds.add(topLW.id);
  }

  // Step 4: Assign Right Wing (RW) - highest OVR Right Wing
  const topRW = rightWings.find((p) => !assignedCardIds.has(p.id));
  if (topRW) {
    newLineup.RW = topRW.id;
    assignedCardIds.add(topRW.id);
  }

  // Step 5: Assign Left Defense (LD) - highest OVR Defenseman
  const topLD = defensemen.find((p) => !assignedCardIds.has(p.id));
  if (topLD) {
    newLineup.LD = topLD.id;
    assignedCardIds.add(topLD.id);
  }

  // Step 6: Assign Right Defense (RD) - 2nd highest OVR Defenseman
  const topRD = defensemen.find((p) => !assignedCardIds.has(p.id));
  if (topRD) {
    newLineup.RD = topRD.id;
    assignedCardIds.add(topRD.id);
  }

  // Step 7: Fallback handling if user is missing natural positional cards in binder
  const remainingSkaters = ownedCards
    .filter((p) => p.pos !== 'G' && !assignedCardIds.has(p.id))
    .sort(sortByOvrDesc);

  const remainingAll = ownedCards
    .filter((p) => !assignedCardIds.has(p.id))
    .sort(sortByOvrDesc);

  const slotOrder: (keyof ActiveLineup)[] = ['C', 'LW', 'RW', 'LD', 'RD', 'G'];

  for (const slot of slotOrder) {
    if (!newLineup[slot]) {
      if (slot === 'G') {
        const fallbackG = goalies.find((p) => !assignedCardIds.has(p.id)) || remainingAll.shift();
        if (fallbackG) {
          newLineup.G = fallbackG.id;
          assignedCardIds.add(fallbackG.id);
        } else if (currentLineup?.G) {
          newLineup.G = currentLineup.G;
        }
      } else {
        const fallbackSkater = remainingSkaters.shift() || remainingAll.shift();
        if (fallbackSkater) {
          newLineup[slot] = fallbackSkater.id;
          assignedCardIds.add(fallbackSkater.id);
        } else if (currentLineup?.[slot]) {
          newLineup[slot] = currentLineup[slot];
        }
      }
    }
  }

  // Final fallback to defaults if binder was unexpectedly sparse
  const finalLineup: ActiveLineup = {
    C: newLineup.C ?? currentLineup?.C ?? 13,
    LW: newLineup.LW ?? currentLineup?.LW ?? 11,
    RW: newLineup.RW ?? currentLineup?.RW ?? 12,
    LD: newLineup.LD ?? currentLineup?.LD ?? 21,
    RD: newLineup.RD ?? currentLineup?.RD ?? 22,
    G: newLineup.G ?? currentLineup?.G ?? 25,
  };

  const oldOvr = currentLineup ? calculateLineupOvr(currentLineup) : 0;
  const newOvr = calculateLineupOvr(finalLineup);
  const ovrDelta = newOvr - oldOvr;

  const changes: AutoBuildSlotChange[] = LINEUP_SLOT_CONFIG.map(({ slot, label, expectedPos }) => {
    const newId = finalLineup[slot];
    const oldId = currentLineup?.[slot];
    const newPlayer = PLAYER_BY_ID[newId] || ownedCards[0];
    const oldPlayer = oldId ? PLAYER_BY_ID[oldId] : undefined;
    const changed = oldId !== newId;
    const ovrDiff = oldPlayer ? newPlayer.ovr - oldPlayer.ovr : 0;

    return {
      slot,
      slotLabel: label,
      expectedPos,
      newPlayer,
      oldPlayer,
      changed,
      ovrDiff,
    };
  });

  const upgradedCount = changes.filter((c) => c.changed).length;
  const hasUpgrades = upgradedCount > 0;

  return {
    lineup: finalLineup,
    changes,
    oldOvr,
    newOvr,
    ovrDelta,
    hasUpgrades,
    upgradedCount,
  };
}
