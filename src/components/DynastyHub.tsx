import React, { useState, useMemo } from 'react';
import {
  ActiveLineup,
  CardTier,
  DynastySaveState,
  PlayerArchetype,
  PlayerCard,
  Position,
  RinkTierId,
} from '../types/game';
import { ALL_PLAYERS, FRANCHISE_TEAMS, PLAYER_BY_ID, RINK_VENUES } from '../data/rosterData';
import { PlayerCardView } from './PlayerCardView';
import { retroAudio } from '../utils/retroAudio';
import {
  PackageOpen,
  Coins,
  Users,
  ShoppingBag,
  Trophy,
  Search,
  RefreshCw,
  Play,
  Zap,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';
import {
  autoBuildBestLineup,
  isBestCandidateInBinder,
  LINEUP_SLOT_CONFIG,
  AutoBuildResult,
} from '../utils/rosterHelper';

interface DynastyHubProps {
  saveState: DynastySaveState;
  onUpdateSave: (updater: (prev: DynastySaveState) => DynastySaveState) => void;
  onStartDynastyMatch: (tier: RinkTierId, opponentTeamId: number) => void;
}

type SubTab = 'LADDER' | 'SQUAD' | 'PACKS' | 'MARKET' | 'DATABASE';

interface PackDefinition {
  id: string;
  name: string;
  cost: number;
  subtitle: string;
  guaranteedTiers: CardTier[];
  accentColor: string;
}

const PACK_OPTIONS: PackDefinition[] = [
  {
    id: 'BRONZE_PACK',
    name: 'Bronze Rookie Pack',
    cost: 220,
    subtitle: '3 Cards · High chance of Bronze & Silver skaters',
    guaranteedTiers: ['BRONZE', 'SILVER'],
    accentColor: 'border-orange-600/80 bg-orange-950/30',
  },
  {
    id: 'SILVER_PACK',
    name: 'Silver Contender Pack',
    cost: 550,
    subtitle: '3 Cards · Guaranteed Silver or Gold Series player',
    guaranteedTiers: ['SILVER', 'GOLD'],
    accentColor: 'border-slate-400/80 bg-slate-800/40',
  },
  {
    id: 'GOLD_PACK',
    name: 'Gold All-Star Foil Pack',
    cost: 1200,
    subtitle: '3 Cards · Guaranteed Gold or Platinum Chrome star',
    guaranteedTiers: ['GOLD', 'PLATINUM'],
    accentColor: 'border-yellow-500/80 bg-yellow-950/30',
  },
  {
    id: 'LEGENDARY_PACK',
    name: 'Legendary ’94 Dynasty Pack',
    cost: 2600,
    subtitle: '3 Cards · Guaranteed Platinum or 95+ OVR Legendary icon!',
    guaranteedTiers: ['PLATINUM', 'LEGENDARY'],
    accentColor: 'border-amber-400 bg-amber-950/40',
  },
];

export const DynastyHub: React.FC<DynastyHubProps> = ({
  saveState,
  onUpdateSave,
  onStartDynastyMatch,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('LADDER');
  const [selectedLineupSlot, setSelectedLineupSlot] = useState<keyof ActiveLineup>('C');
  const [openedCards, setOpenedCards] = useState<PlayerCard[] | null>(null);
  const [autoBuildFeedback, setAutoBuildFeedback] = useState<AutoBuildResult | null>(null);
  const [justAutoBuilt, setJustAutoBuilt] = useState(false);
  const [recentAutoUpgradeNotice, setRecentAutoUpgradeNotice] = useState<string | null>(null);
  const [collectionPosFilter, setCollectionPosFilter] = useState<Position | 'ALL'>('ALL');

  // Filters for Transfer Market & 500-Player Database
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<number | 'ALL'>('ALL');
  const [posFilter, setPosFilter] = useState<Position | 'ALL'>('ALL');
  const [tierFilter, setTierFilter] = useState<CardTier | 'ALL'>('ALL');
  const [archetypeFilter, setArchetypeFilter] = useState<PlayerArchetype | 'ALL'>('ALL');

  const ownedCards = useMemo(() => {
    return saveState.ownedCardIds
      .map((id) => PLAYER_BY_ID[id])
      .filter(Boolean)
      .sort((a, b) => b.ovr - a.ovr);
  }, [saveState.ownedCardIds]);

  const totalDuplicatesCount = useMemo(() => {
    return Object.values(saveState.duplicateCounts).reduce((acc, v) => acc + v, 0);
  }, [saveState.duplicateCounts]);

  const duplicateTradeInValue = useMemo(() => {
    let sum = 0;
    for (const [idStr, count] of Object.entries(saveState.duplicateCounts)) {
      if (count > 0) {
        const card = PLAYER_BY_ID[Number(idStr)];
        if (card) {
          sum += Math.round(card.price * 0.45) * count;
        }
      }
    }
    return sum;
  }, [saveState.duplicateCounts]);

  const squadOvr = useMemo(() => {
    const ids = Object.values(saveState.lineup);
    const sum = ids.reduce((acc, id) => acc + (PLAYER_BY_ID[id]?.ovr || 65), 0);
    return Math.round(sum / ids.length);
  }, [saveState.lineup]);

  // Real-time evaluation of whether owned cards can upgrade the current starting 6
  const autoBuildPotential = useMemo(() => {
    return autoBuildBestLineup(saveState.ownedCardIds, saveState.lineup);
  }, [saveState.ownedCardIds, saveState.lineup]);

  // Execute Auto-Build: Put players in the right spot with higher overall (First Position, Then OVR)
  const handleExecuteAutoBuild = (announce = true) => {
    const result = autoBuildBestLineup(saveState.ownedCardIds, saveState.lineup);
    onUpdateSave((prev) => ({
      ...prev,
      lineup: result.lineup,
    }));
    setAutoBuildFeedback(result);
    setJustAutoBuilt(true);
    setTimeout(() => setJustAutoBuilt(false), 3000);
    retroAudio.playPackOpenChime(true);

    if (announce) {
      if (result.hasUpgrades) {
        retroAudio.announce(
          `Auto-Build complete! Starting lineup upgraded to ${result.newOvr} overall!`,
          true
        );
      } else {
        retroAudio.announce(
          'Starting lineup is already optimized with peak overalls for natural positions!',
          true
        );
      }
    }
  };

  const handleToggleAutoBuildMode = () => {
    const nextVal = !saveState.autoBuildMode;
    onUpdateSave((prev) => ({ ...prev, autoBuildMode: nextVal }));
    retroAudio.playPuckStick(0.6);
    if (nextVal) {
      retroAudio.announce(
        'Auto-Build Mode activated! New packs will auto-slot highest overall players.',
        false
      );
    }
  };

  // Open Foil Card Pack
  const handleOpenPack = (pack: PackDefinition) => {
    if (saveState.coins < pack.cost) return;

    const pool = ALL_PLAYERS.filter((p) => pack.guaranteedTiers.includes(p.tier));
    const generalPool = ALL_PLAYERS;

    const drawn: PlayerCard[] = [
      pool[Math.floor(Math.random() * pool.length)],
      pool[Math.floor(Math.random() * pool.length)],
      generalPool[Math.floor(Math.random() * generalPool.length)],
    ];

    const hasHigh = drawn.some((d) => d.tier === 'LEGENDARY' || d.tier === 'PLATINUM');
    retroAudio.playPackOpenChime(hasHigh);
    if (hasHigh) {
      retroAudio.announce('Incredible pull! Franchise superstar!', true);
    }

    // Compute new owned cards and duplicate counts
    const nextOwned = [...saveState.ownedCardIds];
    const nextDupes = { ...saveState.duplicateCounts };
    for (const card of drawn) {
      if (nextOwned.includes(card.id)) {
        nextDupes[card.id] = (nextDupes[card.id] || 0) + 1;
      } else {
        nextOwned.push(card.id);
      }
    }

    let nextLineup = saveState.lineup;
    let autoRes: AutoBuildResult | null = null;
    let upgradeNotice: string | null = null;

    if (saveState.autoBuildMode) {
      autoRes = autoBuildBestLineup(nextOwned, saveState.lineup);
      if (autoRes.hasUpgrades) {
        nextLineup = autoRes.lineup;
        upgradeNotice = `Auto-Build Mode: Upgraded starting line to ${autoRes.newOvr} OVR (+${autoRes.ovrDelta}) with your new cards!`;
      }
    }

    // Pure state updater passed to parent App without side-effects
    onUpdateSave((prev) => ({
      ...prev,
      coins: prev.coins - pack.cost,
      ownedCardIds: nextOwned,
      duplicateCounts: nextDupes,
      lineup: nextLineup,
    }));

    // Safely update local DynastyHub states outside of parent App state updater
    if (autoRes && autoRes.hasUpgrades) {
      setAutoBuildFeedback(autoRes);
      setJustAutoBuilt(true);
      setTimeout(() => setJustAutoBuilt(false), 3500);
    }

    setRecentAutoUpgradeNotice(upgradeNotice);
    setOpenedCards(drawn);
  };

  // Trade In All Duplicates for Coins
  const handleTradeInDuplicates = () => {
    if (duplicateTradeInValue <= 0) return;
    retroAudio.playPackOpenChime(false);
    onUpdateSave((prev) => ({
      ...prev,
      coins: prev.coins + duplicateTradeInValue,
      duplicateCounts: {},
    }));
  };

  // Buy or Sell Card on Transfer Market
  const handleBuyCard = (player: PlayerCard) => {
    if (saveState.coins < player.price) return;
    retroAudio.playPackOpenChime(player.tier === 'LEGENDARY');
    onUpdateSave((prev) => {
      const alreadyOwned = prev.ownedCardIds.includes(player.id);
      return {
        ...prev,
        coins: prev.coins - player.price,
        ownedCardIds: alreadyOwned ? prev.ownedCardIds : [...prev.ownedCardIds, player.id],
        duplicateCounts: alreadyOwned
          ? { ...prev.duplicateCounts, [player.id]: (prev.duplicateCounts[player.id] || 0) + 1 }
          : prev.duplicateCounts,
      };
    });
  };

  const handleAssignToLineup = (player: PlayerCard) => {
    retroAudio.playPuckStick(0.5);
    onUpdateSave((prev) => ({
      ...prev,
      lineup: {
        ...prev.lineup,
        [selectedLineupSlot]: player.id,
      },
    }));
  };

  const filteredDatabasePlayers = useMemo(() => {
    return ALL_PLAYERS.filter((p) => {
      if (teamFilter !== 'ALL' && p.teamId !== teamFilter) return false;
      if (posFilter !== 'ALL' && p.pos !== posFilter) return false;
      if (tierFilter !== 'ALL' && p.tier !== tierFilter) return false;
      if (archetypeFilter !== 'ALL' && p.archetype !== archetypeFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q) ||
          String(p.id) === q
        );
      }
      return true;
    });
  }, [teamFilter, posFilter, tierFilter, archetypeFilter, searchQuery]);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 py-6">
      {/* Dynasty Franchise Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">
            DYNASTY FRANCHISE & CARD MARKET · 500-PLAYER MANIFEST
          </div>
          <h2 className="text-3xl font-extrabold font-display text-white tracking-tight mt-0.5">
            {saveState.teamName} — Franchise Headquarters
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono tabular-nums">
            <span>SQUAD OVR: {squadOvr}</span>
            <span aria-hidden="true">·</span>
            <span>
              RECORD: {saveState.wins}W - {saveState.losses}L
            </span>
            <span aria-hidden="true">·</span>
            <span>CARDS COLLECTED: {saveState.ownedCardIds.length} / 500</span>
          </div>
        </div>

        {/* Coin Balance & Duplicate Trade-In */}
        <div className="flex items-center gap-3">
          {totalDuplicatesCount > 0 && (
            <button
              type="button"
              onClick={handleTradeInDuplicates}
              className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Trade {totalDuplicatesCount} Dupes (+{duplicateTradeInValue} Coins)
            </button>
          )}
          <div className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-base font-bold font-mono text-amber-400 tabular-nums">
              {saveState.coins.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-slate-400">PUCK COINS</span>
          </div>
        </div>
      </div>

      {/* Interactive Segmented Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-xl my-6 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('LADDER')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'LADDER'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" /> 5-Tier League Ladder
        </button>
        <button
          type="button"
          onClick={() => setSubTab('SQUAD')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'SQUAD'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Active Lineup ({squadOvr} OVR)
        </button>
        <button
          type="button"
          onClick={() => setSubTab('PACKS')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'PACKS'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <PackageOpen className="w-3.5 h-3.5" /> Foil Card Packs
        </button>
        <button
          type="button"
          onClick={() => setSubTab('MARKET')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'MARKET'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" /> Transfer Market
        </button>
        <button
          type="button"
          onClick={() => setSubTab('DATABASE')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            subTab === 'DATABASE'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Search className="w-3.5 h-3.5" /> 500-Player Roster Manifest
        </button>
      </div>

      {/* TAB 1: 5-TIER LEAGUE LADDER */}
      {subTab === 'LADDER' && (
        <div className="space-y-4">
          {RINK_VENUES.map((venue) => {
            const isUnlocked = saveState.wins >= venue.unlockWinsRequired || venue.tier <= saveState.unlockedTier;
            const venueTeams = venue.opponentTeamIds
              .map((id) => FRANCHISE_TEAMS.find((t) => t.id === id))
              .filter(Boolean);

            return (
              <div
                key={venue.tier}
                className={`rounded-xl border p-5 transition-colors ${
                  isUnlocked
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-slate-950/60 border-slate-900 opacity-75'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <div className="text-xs font-mono text-amber-400">
                      TIER 0{venue.tier} · {venue.subtitle} · {venue.rewardMultiplier}x COIN PURSE
                    </div>
                    <h3 className="text-2xl font-bold font-display text-white mt-0.5">
                      0{venue.tier}. {venue.name}
                    </h3>
                    <p className="text-sm text-slate-300 mt-1">{venue.description}</p>
                  </div>

                  <div className="text-right font-mono text-xs">
                    {isUnlocked ? (
                      <span className="text-emerald-400">UNLOCKED & SANCTIONED</span>
                    ) : (
                      <span className="text-slate-400">
                        REQUIRES {venue.unlockWinsRequired} DYNASTY WINS ({saveState.wins}/
                        {venue.unlockWinsRequired})
                      </span>
                    )}
                  </div>
                </div>

                {/* Division Opponent Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
                  {venueTeams.map((team) => {
                    if (!team) return null;
                    const starPlayer = team.players[0];
                    return (
                      <div
                        key={team.id}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-slate-400">
                              #{String(team.id).padStart(2, '0')} · {team.abbr}
                            </span>
                            <span
                              className="w-3 h-3 rounded-sm"
                              style={{ backgroundColor: team.primaryColor }}
                            />
                          </div>
                          <div className="text-lg font-bold font-display text-white mt-0.5">
                            {team.name}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Captain: <span className="text-slate-200">{starPlayer.name}</span> (
                            {starPlayer.ovr} OVR)
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!isUnlocked}
                          onClick={() => onStartDynastyMatch(venue.tier, team.id)}
                          className={`mt-3 w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                            isUnlocked
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5" /> Drop Puck vs {team.abbr}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: ACTIVE SQUAD & LINEUP MANAGEMENT */}
      {subTab === 'SQUAD' && (
        <div className="space-y-6">
          {/* Auto-Build Cockpit Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-amber-500/40 rounded-xl p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-mono font-bold rounded uppercase">
                    Franchise Lineup Engine
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    SQUAD RATING: <strong className="text-white">{squadOvr} OVR</strong>
                  </span>
                </div>
                <h3 className="text-2xl font-black font-display text-white mt-1">
                  Starting 6 Ice Lineup & Auto-Build Mode
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  <strong>Auto-Build Mode</strong> puts each player in the right starting spot by{' '}
                  <span className="text-amber-300 font-semibold">Natural Position first</span> (C, LW, RW, LD, RD, G), then prioritizes the{' '}
                  <span className="text-amber-300 font-semibold">Highest Overall (OVR)</span>.
                </p>
              </div>

              {/* Action Buttons & Mode Switch */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Auto-Build Mode Toggle Switch */}
                <button
                  type="button"
                  onClick={handleToggleAutoBuildMode}
                  className={`px-3.5 py-2.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                    saveState.autoBuildMode
                      ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                  title="When active, opening card packs will automatically slot your highest OVR cards into natural starting positions"
                >
                  {saveState.autoBuildMode ? (
                    <ToggleRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <span>
                    AUTO-BUILD ON PACKS: {saveState.autoBuildMode ? 'ACTIVE' : 'OFF'}
                  </span>
                </button>

                {/* Main 1-Click Auto-Build Button */}
                <button
                  type="button"
                  onClick={() => handleExecuteAutoBuild(true)}
                  className={`px-4 py-2.5 rounded-lg text-xs font-bold font-mono flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shadow-lg ${
                    autoBuildPotential.hasUpgrades
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/20 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <Zap className={`w-4 h-4 ${autoBuildPotential.hasUpgrades ? 'text-slate-950 fill-slate-950' : 'text-amber-400'}`} />
                  <span>
                    {autoBuildPotential.hasUpgrades
                      ? `⚡ AUTO-BUILD STARTING LINE (+${autoBuildPotential.ovrDelta} OVR UPGRADE!)`
                      : `✓ LINEUP OPTIMAL (${squadOvr} OVR) · RE-OPTIMIZE`}
                  </span>
                </button>
              </div>
            </div>

            {/* Auto-Build Result Feedback Banner */}
            {autoBuildFeedback && (
              <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-950/80 rounded-lg p-3.5 border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>
                      {autoBuildFeedback.hasUpgrades
                        ? `Auto-Build Completed: ${autoBuildFeedback.upgradedCount} slot${autoBuildFeedback.upgradedCount > 1 ? 's' : ''} upgraded! Squad now at ${autoBuildFeedback.newOvr} OVR (+${autoBuildFeedback.ovrDelta})`
                        : `Starting lineup confirmed optimal: All 6 natural positions filled by your binder's highest overalls!`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoBuildFeedback(null)}
                    className="text-[11px] font-mono text-slate-400 hover:text-white px-2 py-0.5 bg-slate-900 rounded cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
                  {autoBuildFeedback.changes.map((c) => (
                    <div
                      key={c.slot}
                      className={`p-2 rounded border ${
                        c.changed
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {c.slot} · {c.expectedPos}
                      </div>
                      <div className="font-bold text-white truncate">{c.newPlayer.name}</div>
                      <div className="text-[11px] text-amber-400 font-bold">
                        {c.newPlayer.ovr} OVR
                        {c.changed && c.oldPlayer && (
                          <span className="text-emerald-400 ml-1">
                            (↑ +{c.ovrDiff})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Starting 6 Ice Lineup Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold font-display text-white">
                Starting 6 Ice Lineup (Select slot to view or swap candidates)
              </h3>
              <div className="text-xs font-mono text-slate-400">
                Rule: Highest OVR in Natural Position first
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LINEUP_SLOT_CONFIG.map(({ slot, label, expectedPos, fullName }) => {
                const playerId = saveState.lineup[slot];
                const player = PLAYER_BY_ID[playerId] || ALL_PLAYERS[0];
                const isSelectedSlot = selectedLineupSlot === slot;
                const isOptimal = isBestCandidateInBinder(slot, playerId, saveState.ownedCardIds);

                return (
                  <div
                    key={slot}
                    className={`flex flex-col rounded-xl p-1 transition-all ${
                      justAutoBuilt
                        ? 'ring-2 ring-amber-400 scale-[1.01]'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {fullName}
                      </span>
                      {isOptimal ? (
                        <span className="text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Best in Binder
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono bg-amber-500/20 border border-amber-500/40 text-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold animate-pulse">
                          <Sparkles className="w-3 h-3" /> Upgrade Available
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedLineupSlot(slot)}
                      className={`mb-2 py-1.5 px-3 rounded-lg text-xs font-mono font-bold text-left flex items-center justify-between cursor-pointer transition-colors ${
                        isSelectedSlot
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>SLOT: {slot} ({expectedPos})</span>
                      <span>{isSelectedSlot ? 'VIEWING REPLACEMENTS' : 'CLICK TO SWAP'}</span>
                    </button>

                    <PlayerCardView player={player} isSelected={isSelectedSlot} isOwned />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Owned Franchise Collection / Binder */}
          <div className="pt-6 border-t border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
              <div>
                <h3 className="text-xl font-bold font-display text-white">
                  Owned Franchise Collection ({ownedCards.length} Cards in Binder)
                </h3>
                <p className="text-xs text-slate-400">
                  Assign any owned card directly to the highlighted{' '}
                  <strong className="text-amber-400">{selectedLineupSlot}</strong> slot, or use Auto-Build Mode above to automatically slot highest overalls.
                </p>
              </div>

              {/* Positional quick filters for owned collection */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg">
                {(['ALL', 'C', 'LW', 'RW', 'D', 'G'] as (Position | 'ALL')[]).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setCollectionPosFilter(pos)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded cursor-pointer transition-colors ${
                      collectionPosFilter === pos
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ownedCards
                .filter((card) => collectionPosFilter === 'ALL' || card.pos === collectionPosFilter)
                .map((card) => {
                  const inLineupSlot = Object.entries(saveState.lineup).find(
                    ([, id]) => id === card.id
                  )?.[0];
                  const inLineup = Boolean(inLineupSlot);

                  return (
                    <PlayerCardView
                      key={card.id}
                      player={card}
                      isOwned
                      duplicateCount={saveState.duplicateCounts[card.id] || 0}
                      actionLabel={
                        inLineup
                          ? `Starting in ${inLineupSlot}`
                          : `Equip to ${selectedLineupSlot} Slot`
                      }
                      disabledAction={inLineup}
                      onAction={handleAssignToLineup}
                    />
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FOIL CARD PACKS */}
      {subTab === 'PACKS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PACK_OPTIONS.map((pack) => {
              const canAfford = saveState.coins >= pack.cost;
              return (
                <div
                  key={pack.id}
                  className={`rounded-xl border ${pack.accentColor} p-5 flex flex-col justify-between`}
                >
                  <div>
                    <div className="text-xs font-mono text-amber-300 uppercase">
                      OFFICIAL ’94 FOIL SERIES
                    </div>
                    <h3 className="text-2xl font-extrabold font-display text-white mt-1">
                      {pack.name}
                    </h3>
                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">{pack.subtitle}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs font-mono mb-3">
                      <span className="text-slate-400">PACK PRICE</span>
                      <span className="text-base font-bold text-amber-400 tabular-nums">
                        {pack.cost} COINS
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => handleOpenPack(pack)}
                      className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer font-bold'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? `Rip Pack (${pack.cost} Coins)` : 'Insufficient Coins'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Newly Pulled Foil Cards Reveal */}
          {openedCards && (
            <div className="bg-slate-900 border-2 border-amber-500 rounded-xl p-6 mt-6 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-xs font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    FRESH FROM THE FOIL WRAPPER!
                  </div>
                  <h3 className="text-2xl font-black font-display text-white mt-0.5">
                    Pack Pulls Added to Your Franchise Binder
                  </h3>
                  {recentAutoUpgradeNotice && (
                    <div className="text-xs font-mono text-emerald-400 font-bold mt-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{recentAutoUpgradeNotice}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Auto-Build Shortcut Button */}
                  <button
                    type="button"
                    onClick={() => {
                      handleExecuteAutoBuild(true);
                      setSubTab('SQUAD');
                    }}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors whitespace-nowrap"
                  >
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    Auto-Build Lineup & View Roster
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubTab('SQUAD')}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <span>Franchise Roster</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenedCards(null);
                      setRecentAutoUpgradeNotice(null);
                    }}
                    className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Reveal Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {openedCards.map((c, idx) => (
                  <PlayerCardView
                    key={`${c.id}_${idx}`}
                    player={c}
                    isOwned
                    actionLabel={`Equip to ${selectedLineupSlot}`}
                    onAction={handleAssignToLineup}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4 & 5: TRANSFER MARKET & 500-PLAYER ROSTER MANIFEST */}
      {(subTab === 'MARKET' || subTab === 'DATABASE') && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                SEARCH PLAYER OR #ID
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. K. Varga, D. Rig, 326..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                FRANCHISE TEAM (20)
              </label>
              <select
                value={teamFilter}
                onChange={(e) =>
                  setTeamFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All 20 Teams (500 Players)</option>
                {FRANCHISE_TEAMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id}. {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">POSITION</label>
              <select
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value as Position | 'ALL')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Positions</option>
                <option value="C">Center (C)</option>
                <option value="LW">Left Wing (LW)</option>
                <option value="RW">Right Wing (RW)</option>
                <option value="D">Defenseman (D)</option>
                <option value="G">Goalie (G)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">CARD TIER</label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as CardTier | 'ALL')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Rarity Tiers</option>
                <option value="LEGENDARY">Legendary (95–98 OVR)</option>
                <option value="PLATINUM">Platinum (90–94 OVR)</option>
                <option value="GOLD">Gold (80–89 OVR)</option>
                <option value="SILVER">Silver (70–79 OVR)</option>
                <option value="BRONZE">Bronze (56–69 OVR)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">ARCHETYPE</label>
              <select
                value={archetypeFilter}
                onChange={(e) => setArchetypeFilter(e.target.value as PlayerArchetype | 'ALL')}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="ALL">All Archetypes</option>
                <option value="Sniper">Sniper</option>
                <option value="Playmaker">Playmaker</option>
                <option value="Enforcer">Enforcer</option>
                <option value="Two-Way Defenseman">Two-Way Defenseman</option>
                <option value="Brick Wall Goalie">Brick Wall Goalie</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>
              SHOWING {filteredDatabasePlayers.length} OF 500 OFFICIAL ROSTER PLAYERS
            </span>
            <span>ALL STATS VERIFIED FROM OFFICIAL ’94 MANIFEST</span>
          </div>

          {subTab === 'MARKET' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredDatabasePlayers.slice(0, 48).map((player) => {
                const isOwned = saveState.ownedCardIds.includes(player.id);
                const canAfford = saveState.coins >= player.price;
                return (
                  <PlayerCardView
                    key={player.id}
                    player={player}
                    isOwned={isOwned}
                    duplicateCount={saveState.duplicateCounts[player.id] || 0}
                    actionLabel={
                      canAfford
                        ? `Sign Contract (${player.price} Coins)`
                        : `Need ${player.price} Coins`
                    }
                    disabledAction={!canAfford}
                    onAction={handleBuyCard}
                  />
                );
              })}
            </div>
          ) : (
            /* Tabular 500-Player Manifest View */
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Name</th>
                      <th className="py-3 px-4">Franchise</th>
                      <th className="py-3 px-4">Pos</th>
                      <th className="py-3 px-4">Tier</th>
                      <th className="py-3 px-4">Archetype</th>
                      <th className="py-3 px-4 text-right">OVR</th>
                      <th className="py-3 px-4 text-right">SKT</th>
                      <th className="py-3 px-4 text-right">SHT</th>
                      <th className="py-3 px-4 text-right">PAS</th>
                      <th className="py-3 px-4 text-right">CHK</th>
                      <th className="py-3 px-4 text-right">DEF/GLO</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs font-mono tabular-nums">
                    {filteredDatabasePlayers.map((p) => {
                      const owned = saveState.ownedCardIds.includes(p.id);
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-4 text-slate-400">{p.id}</td>
                          <td className="py-2.5 px-4 font-sans font-bold text-white">{p.name}</td>
                          <td className="py-2.5 px-4 font-sans text-slate-300">{p.teamName}</td>
                          <td className="py-2.5 px-4 text-slate-300">{p.pos}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={
                                p.tier === 'LEGENDARY'
                                  ? 'text-amber-400 font-bold'
                                  : p.tier === 'PLATINUM'
                                  ? 'text-cyan-300 font-bold'
                                  : p.tier === 'GOLD'
                                  ? 'text-yellow-400'
                                  : p.tier === 'SILVER'
                                  ? 'text-slate-300'
                                  : 'text-orange-400'
                              }
                            >
                              {p.tier}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-sans text-slate-400">{p.archetype}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-amber-400">
                            {p.ovr}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-200">{p.skt}</td>
                          <td className="py-2.5 px-4 text-right text-slate-200">{p.sht}</td>
                          <td className="py-2.5 px-4 text-right text-slate-200">{p.pas}</td>
                          <td className="py-2.5 px-4 text-right text-slate-200">{p.chk}</td>
                          <td className="py-2.5 px-4 text-right text-slate-200">{p.def}</td>
                          <td className="py-2.5 px-4 text-right">
                            {owned ? (
                              <span className="text-emerald-400">OWNED</span>
                            ) : (
                              <button
                                type="button"
                                disabled={saveState.coins < p.price}
                                onClick={() => handleBuyCard(p)}
                                className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                                  saveState.coins >= p.price
                                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                Buy ({p.price})
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
