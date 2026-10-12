import React, { useState, useEffect, useMemo } from 'react';
import {
  DynastySaveState,
  DifficultyMode,
  InternationalTeam,
  PlayerCard,
  RinkTierId,
  RinkVenue,
  WorldCupMatch,
} from './types/game';
import {
  ALL_PLAYERS,
  FRANCHISE_TEAMS,
  INTERNATIONAL_TEAMS,
  PLAYER_BY_ID,
  RINK_VENUES,
} from './data/rosterData';
import { loadDynastySave, saveDynastyState } from './utils/storage';
import { retroAudio } from './utils/retroAudio';
import { IceRinkCanvas, MatchGameMode } from './components/IceRinkCanvas';
import { DynastyHub } from './components/DynastyHub';
import { WorldCupHub } from './components/WorldCupHub';
import { SkillsCompetition } from './components/SkillsCompetition';
import { GameIntroScreen } from './components/GameIntroScreen';
import {
  Flame,
  Zap,
  PackageOpen,
  Trophy,
  Target,
  Volume2,
  VolumeX,
  Plus,
  Tv,
  Wifi,
  RefreshCw,
  Play,
  RotateCcw,
  Cpu,
} from 'lucide-react';

// Exact generated image asset references
import retroBannerImg from './assets/images/retro_puck_94_banner_1791762371375.jpg';
import tuxedoPenguinLogo from './assets/images/tuxedo_penguin_logo_1791762387098.jpg';

type ActiveView = 'LOBBY' | 'GAME_ARENA' | 'DYNASTY' | 'WORLD_CUP' | 'SKILLS_ACCURACY' | 'SKILLS_HARDEST';

export function App() {
  const [saveState, setSaveState] = useState<DynastySaveState>(() => loadDynastySave());
  const [activeView, setActiveView] = useState<ActiveView>('LOBBY');
  const [showIntro, setShowIntro] = useState<boolean>(true);

  // Match configuration for the 60 FPS arena
  const [matchConfig, setMatchConfig] = useState<{
    mode: MatchGameMode;
    venue: RinkVenue;
    homeTeamName: string;
    homePrimaryColor: string;
    homeSecondaryColor: string;
    homeRoster: PlayerCard[];
    awayTeamName: string;
    awayPrimaryColor: string;
    awaySecondaryColor: string;
    awayRoster: PlayerCard[];
    tournamentMatchId?: string;
    dynastyTier?: RinkTierId;
  } | null>(null);

  // Persistence helper
  const updateSave = (updater: (prev: DynastySaveState) => DynastySaveState) => {
    setSaveState((prev) => {
      const next = updater(prev);
      saveDynastyState(next);
      return next;
    });
  };

  useEffect(() => {
    retroAudio.soundEnabled = saveState.soundEnabled;
    retroAudio.announcerEnabled = saveState.announcerEnabled;
  }, [saveState.soundEnabled, saveState.announcerEnabled]);

  const userDynastyRoster = useMemo(() => {
    const ids = [
      saveState.lineup.C,
      saveState.lineup.LW,
      saveState.lineup.RW,
      saveState.lineup.LD,
      saveState.lineup.RD,
      saveState.lineup.G,
    ];
    return ids.map((id) => PLAYER_BY_ID[id] || ALL_PLAYERS[0]);
  }, [saveState.lineup]);

  // Mode Launcher: 3v3 Pond Hockey
  const handleStart3v3Pond = () => {
    const venue = RINK_VENUES[0]; // Frozen Pond Circuit
    const oppTeam = FRANCHISE_TEAMS[13]; // Edmonton Drillers
    const oppLineup = [
      oppTeam.players[0],
      oppTeam.players[1],
      oppTeam.players[15],
      oppTeam.players[22],
    ];

    retroAudio.playIntroTagline();
    setMatchConfig({
      mode: 'POND_3V3',
      venue,
      homeTeamName: saveState.teamName,
      homePrimaryColor: saveState.primaryColor,
      homeSecondaryColor: saveState.secondaryColor,
      homeRoster: userDynastyRoster,
      awayTeamName: oppTeam.name,
      awayPrimaryColor: oppTeam.primaryColor,
      awaySecondaryColor: oppTeam.secondaryColor,
      awayRoster: oppLineup,
    });
    setActiveView('GAME_ARENA');
  };

  // Mode Launcher: 5v5 Pro Arena Showdown
  const handleStart5v5Pro = (tierOverride?: RinkTierId, oppTeamId?: number) => {
    const tier = tierOverride || saveState.unlockedTier;
    const venue = RINK_VENUES.find((v) => v.tier === tier) || RINK_VENUES[3];
    const oppTeam = FRANCHISE_TEAMS.find((t) => t.id === (oppTeamId || 4)) || FRANCHISE_TEAMS[3]; // Detroit Motor City
    const oppLineup = [
      oppTeam.players[0],
      oppTeam.players[1],
      oppTeam.players[2],
      oppTeam.players[15],
      oppTeam.players[16],
      oppTeam.players[22],
    ].filter(Boolean);

    retroAudio.playIntroTagline();
    setMatchConfig({
      mode: 'DYNASTY',
      venue,
      homeTeamName: saveState.teamName,
      homePrimaryColor: saveState.primaryColor,
      homeSecondaryColor: saveState.secondaryColor,
      homeRoster: userDynastyRoster,
      awayTeamName: oppTeam.name,
      awayPrimaryColor: oppTeam.primaryColor,
      awaySecondaryColor: oppTeam.secondaryColor,
      awayRoster: oppLineup,
      dynastyTier: tier,
    });
    setActiveView('GAME_ARENA');
  };

  // Mode Launcher: World Cup of Hockey match
  const handleStartWorldCupMatch = (
    match: WorldCupMatch,
    userTeam: InternationalTeam,
    oppTeam: InternationalTeam
  ) => {
    const venue = RINK_VENUES[4]; // World Championship Arena
    const userCards = userTeam.rosterIds.map((id) => PLAYER_BY_ID[id] || ALL_PLAYERS[0]);
    const oppCards = oppTeam.rosterIds.map((id) => PLAYER_BY_ID[id] || ALL_PLAYERS[25]);

    retroAudio.playIntroTagline();
    setMatchConfig({
      mode: 'WORLDCUP',
      venue,
      homeTeamName: userTeam.name,
      homePrimaryColor: userTeam.primaryColor,
      homeSecondaryColor: userTeam.secondaryColor,
      homeRoster: userCards,
      awayTeamName: oppTeam.name,
      awayPrimaryColor: oppTeam.primaryColor,
      awaySecondaryColor: oppTeam.secondaryColor,
      awayRoster: oppCards,
      tournamentMatchId: match.id,
    });
    setActiveView('GAME_ARENA');
  };

  // Match Finished Handler
  const handleMatchComplete = (result: {
    homeScore: number;
    awayScore: number;
    homeShots: number;
    awayShots: number;
    homeHits: number;
    awayHits: number;
  }) => {
    const userWon = result.homeScore >= result.awayScore;
    const baseReward = userWon ? 350 : 120;
    const goalBonus = result.homeScore * 35;
    const hitBonus = result.homeHits * 8;
    const mult = matchConfig?.venue.rewardMultiplier || 1;
    const earnedCoins = Math.round((baseReward + goalBonus + hitBonus) * mult);

    updateSave((prev) => {
      const nextWins = userWon ? prev.wins + 1 : prev.wins;
      const nextLosses = userWon ? prev.losses : prev.losses + 1;
      let nextUnlockedTier = prev.unlockedTier;
      for (const v of RINK_VENUES) {
        if (nextWins >= v.unlockWinsRequired && v.tier > nextUnlockedTier) {
          nextUnlockedTier = v.tier;
        }
      }

      // Handle World Cup Tournament Bracket Updates
      let nextBracket = prev.tournamentBracket;
      if (matchConfig?.mode === 'WORLDCUP' && nextBracket && matchConfig.tournamentMatchId) {
        const updatedMatches = nextBracket.matches.map((m) => {
          if (m.id === matchConfig.tournamentMatchId) {
            const userIsA = m.teamA === nextBracket!.userTeamId;
            const winA = userIsA ? userWon : !userWon;
            const sWinsA = m.seriesWinsA + (winA ? 1 : 0);
            const sWinsB = m.seriesWinsB + (!winA ? 1 : 0);
            const needed = nextBracket!.format === 'BO3' ? 2 : 1;
            const winner = sWinsA >= needed ? m.teamA : sWinsB >= needed ? m.teamB : null;
            return {
              ...m,
              scoreA: userIsA ? result.homeScore : result.awayScore,
              scoreB: userIsA ? result.awayScore : result.homeScore,
              seriesWinsA: sWinsA,
              seriesWinsB: sWinsB,
              winner,
            };
          } else if (!m.winner && m.round === nextBracket!.currentRound) {
            const tA = INTERNATIONAL_TEAMS.find((t) => t.id === m.teamA);
            const tB = INTERNATIONAL_TEAMS.find((t) => t.id === m.teamB);
            const aWins = (tA?.ovr || 85) + Math.random() * 10 >= (tB?.ovr || 85) + Math.random() * 10;
            return {
              ...m,
              scoreA: aWins ? 4 : 2,
              scoreB: aWins ? 2 : 4,
              seriesWinsA: aWins ? 2 : 0,
              seriesWinsB: aWins ? 0 : 2,
              winner: aWins ? m.teamA : m.teamB,
            };
          }
          return m;
        });

        const currentRoundMatches = updatedMatches.filter(
          (m) => m.round === nextBracket!.currentRound
        );
        const allDecided = currentRoundMatches.every((m) => m.winner !== null);

        if (allDecided) {
          const winners = currentRoundMatches.map((m) => m.winner!);
          if (nextBracket.currentRound === 'R16') {
            for (let i = 0; i < 4; i++) {
              updatedMatches.push({
                id: `QF_${i}`,
                round: 'QF',
                teamA: winners[i * 2],
                teamB: winners[i * 2 + 1],
                scoreA: null,
                scoreB: null,
                seriesWinsA: 0,
                seriesWinsB: 0,
                winner: null,
              });
            }
            nextBracket = { ...nextBracket, currentRound: 'QF', matches: updatedMatches };
          } else if (nextBracket.currentRound === 'QF') {
            for (let i = 0; i < 2; i++) {
              updatedMatches.push({
                id: `SF_${i}`,
                round: 'SF',
                teamA: winners[i * 2],
                teamB: winners[i * 2 + 1],
                scoreA: null,
                scoreB: null,
                seriesWinsA: 0,
                seriesWinsB: 0,
                winner: null,
              });
            }
            nextBracket = { ...nextBracket, currentRound: 'SF', matches: updatedMatches };
          } else if (nextBracket.currentRound === 'SF') {
            updatedMatches.push({
              id: `FINAL_0`,
              round: 'FINAL',
              teamA: winners[0],
              teamB: winners[1],
              scoreA: null,
              scoreB: null,
              seriesWinsA: 0,
              seriesWinsB: 0,
              winner: null,
            });
            nextBracket = { ...nextBracket, currentRound: 'FINAL', matches: updatedMatches };
          } else if (nextBracket.currentRound === 'FINAL') {
            nextBracket = {
              ...nextBracket,
              currentRound: winners[0] === nextBracket.userTeamId ? 'CHAMPION' : 'FINAL',
              matches: updatedMatches,
            };
          }
        } else {
          nextBracket = { ...nextBracket, matches: updatedMatches };
        }
      }

      return {
        ...prev,
        coins: prev.coins + earnedCoins,
        wins: nextWins,
        losses: nextLosses,
        goalsFor: prev.goalsFor + result.homeScore,
        goalsAgainst: prev.goalsAgainst + result.awayScore,
        unlockedTier: nextUnlockedTier,
        tournamentBracket: nextBracket,
      };
    });
  };

  // Add Free Coins button handler
  const handleAddCoins = () => {
    retroAudio.playPackOpenChime(false);
    updateSave((prev) => ({ ...prev, coins: prev.coins + 250 }));
  };

  return (
    <div
      className={`min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-mono selection:bg-amber-500 selection:text-slate-950 ${
        saveState.crtScanlines ? 'crt-scanlines' : ''
      }`}
    >
      {/* 0. 16-BIT RETRO INTRO SCREEN & ATTRACT MODE (WHEN LAUNCHED OR REPLAYED) */}
      {showIntro && (
        <GameIntroScreen
          onStartGame={(targetMode) => {
            setShowIntro(false);
            if (targetMode === 'POND_3V3') {
              handleStart3v3Pond();
            } else if (targetMode === 'PRO_5V5') {
              handleStart5v5Pro(saveState.unlockedTier);
            } else if (targetMode === 'DYNASTY') {
              setMatchConfig(null);
              setActiveView('DYNASTY');
            } else if (targetMode === 'WORLD_CUP') {
              setMatchConfig(null);
              setActiveView('WORLD_CUP');
            } else {
              setMatchConfig(null);
              setActiveView('LOBBY');
            }
          }}
        />
      )}

      {/* 1. TOP RETRO ARCADE NAVIGATION BAR */}
      <header className="bg-black border-b border-amber-500/20 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Yellow Arcade Wordmark */}
        <div
          onClick={() => {
            setMatchConfig(null);
            setActiveView('LOBBY');
          }}
          className="cursor-pointer flex flex-col"
        >
          <span className="font-pixel text-sm sm:text-base text-amber-400 tracking-wider">
            RETRO PUCK
          </span>
          <span className="font-pixel text-[11px] text-amber-400 -mt-1 text-center">’94</span>
        </div>

        {/* Center: Arcade Mode Tab Links */}
        <nav className="flex items-center gap-1 sm:gap-4 overflow-x-auto text-[11px] font-pixel">
          <button
            type="button"
            onClick={handleStart3v3Pond}
            className={`px-2 py-1 text-center cursor-pointer whitespace-nowrap transition-colors ${
              activeView === 'GAME_ARENA' && matchConfig?.mode === 'POND_3V3'
                ? 'text-amber-400 font-bold'
                : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            <div>3v3</div>
            <div className="text-[9px] text-slate-400">POND</div>
          </button>

          <button
            type="button"
            onClick={() => handleStart5v5Pro()}
            className={`px-2 py-1 text-center cursor-pointer whitespace-nowrap transition-colors ${
              activeView === 'GAME_ARENA' && matchConfig?.mode === 'DYNASTY'
                ? 'text-amber-400 font-bold'
                : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            <div>5v5</div>
            <div className="text-[9px] text-slate-400">PRO</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMatchConfig(null);
              setActiveView('DYNASTY');
            }}
            className={`px-2 py-1 text-center cursor-pointer whitespace-nowrap transition-colors ${
              activeView === 'DYNASTY' ? 'text-amber-400 font-bold' : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            FRANCHISE
          </button>

          <button
            type="button"
            onClick={() => {
              setMatchConfig(null);
              setActiveView('WORLD_CUP');
            }}
            className={`px-2 py-1 text-center cursor-pointer whitespace-nowrap transition-colors ${
              activeView === 'WORLD_CUP' ? 'text-amber-400 font-bold' : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            <div>WORLD</div>
            <div className="text-[9px] text-slate-400">CUP</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMatchConfig(null);
              setActiveView('SKILLS_ACCURACY');
            }}
            className={`px-2 py-1 text-center cursor-pointer whitespace-nowrap transition-colors ${
              activeView === 'SKILLS_ACCURACY' ? 'text-amber-400 font-bold' : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            <div>TARGET</div>
            <div className="text-[9px] text-slate-400">SNIPER</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMatchConfig(null);
              setActiveView('SKILLS_HARDEST');
            }}
            className={`px-2 py-1 text-center cursor-pointer whitespace-nowrap transition-colors ${
              activeView === 'SKILLS_HARDEST' ? 'text-amber-400 font-bold' : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            <div>RADAR</div>
            <div className="text-[9px] text-slate-400">SLAP SHOT</div>
          </button>
        </nav>

        {/* Right: Golden Primary CTA Button */}
        <button
          type="button"
          onClick={() => handleStart5v5Pro(saveState.unlockedTier)}
          className="bg-amber-400 hover:bg-amber-300 text-black font-pixel text-[11px] sm:text-xs px-3 sm:px-4 py-2 uppercase font-bold tracking-wider cursor-pointer whitespace-nowrap shadow-sm"
        >
          DROP PUCK FACEOFF
        </button>
      </header>

      {/* 2. SECONDARY STUDIO STATUS BAR */}
      <div className="bg-[#0b0f17] border-b border-slate-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 flex-wrap">
        {/* Tuxedo Penguin Studio branding */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowIntro(true)}
            className="group relative cursor-pointer focus:outline-none shrink-0"
            title="Click to replay 16-Bit Arcade Intro"
          >
            <img
              src={tuxedoPenguinLogo}
              alt="Tuxedo Penguin Gaming Sports Studio"
              className="w-9 h-9 rounded-full border border-amber-500/60 object-cover pixelated group-hover:scale-110 group-hover:border-amber-400 transition-transform shadow-[0_0_12px_rgba(251,191,36,0.3)]"
            />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[11px] text-white tracking-wider">
                TUXEDO PENGUIN GAMING SPORTS STUDIO
              </span>
              <button
                type="button"
                onClick={() => setShowIntro(true)}
                className="text-[9px] font-pixel text-slate-400 hover:text-amber-400 underline cursor-pointer"
                title="Replay intro video & attract screen"
              >
                [INTRO]
              </button>
            </div>
            <div className="text-[10px] text-amber-400 italic">"It's In The Game!"</div>
          </div>
        </div>

        {/* Coin balance & Free coin button & Audio toggle */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Difficulty Mode Selector */}
          <div className="bg-black border border-slate-700 rounded p-0.5 flex items-center gap-0.5 text-[10px] font-pixel">
            <span className="text-slate-500 px-1 text-[9px] hidden sm:inline">AI:</span>
            <button
              type="button"
              onClick={() => {
                retroAudio.playPuckStick(0.4);
                updateSave((prev) => ({ ...prev, difficulty: 'EASY' }));
              }}
              className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                saveState.difficulty === 'EASY'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
              title="Easy: relaxed checking, slower goalie reflexes, gentle shots"
            >
              EASY
            </button>
            <button
              type="button"
              onClick={() => {
                retroAudio.playPuckStick(0.5);
                updateSave((prev) => ({ ...prev, difficulty: 'PRO' }));
              }}
              className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                saveState.difficulty === 'PRO'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
              title="Pro: authentic '94 balanced arcade aggression"
            >
              PRO
            </button>
            <button
              type="button"
              onClick={() => {
                retroAudio.playPuckStick(0.8);
                retroAudio.announce('Legend difficulty activated!', false);
                updateSave((prev) => ({ ...prev, difficulty: 'LEGEND' }));
              }}
              className={`px-2 py-1 rounded cursor-pointer transition-colors ${
                saveState.difficulty === 'LEGEND'
                  ? 'bg-rose-500 text-slate-950 font-bold animate-pulse'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
              title="Legend: ruthless forechecking, bone-crushing board smashes, laser slap shots, brick wall goalies"
            >
              LEGEND
            </button>
          </div>

          {/* Coin balance pill */}
          <div className="bg-black border border-amber-500/50 rounded px-3 py-1.5 flex items-center gap-1.5 text-amber-400 font-pixel text-xs">
            <span className="text-amber-400">🪙</span>
            <span className="tabular-nums font-bold">{saveState.coins.toLocaleString()}</span>
          </div>

          {/* +250 Coins button */}
          <button
            type="button"
            onClick={handleAddCoins}
            className="bg-[#0f402c] hover:bg-[#165a3f] border border-emerald-500/60 text-emerald-300 font-pixel text-[10px] px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>+250 COINS</span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !saveState.soundEnabled;
              updateSave((prev) => ({
                ...prev,
                soundEnabled: next,
                announcerEnabled: next,
              }));
              retroAudio.soundEnabled = next;
              retroAudio.announcerEnabled = next;
            }}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700 p-2 rounded text-slate-300 cursor-pointer"
            title="Toggle Arena Sound & Announcer"
          >
            {saveState.soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE / ACTIVE VIEW ROUTING */}
      <main className="flex-1">
        {activeView === 'GAME_ARENA' && matchConfig ? (
          <IceRinkCanvas
            mode={matchConfig.mode}
            venue={matchConfig.venue}
            homeTeamName={matchConfig.homeTeamName}
            homePrimaryColor={matchConfig.homePrimaryColor}
            homeSecondaryColor={matchConfig.homeSecondaryColor}
            homeRoster={matchConfig.homeRoster}
            awayTeamName={matchConfig.awayTeamName}
            awayPrimaryColor={matchConfig.awayPrimaryColor}
            awaySecondaryColor={matchConfig.awaySecondaryColor}
            awayRoster={matchConfig.awayRoster}
            gopiMode={saveState.gopiMode}
            difficulty={saveState.difficulty}
            autoMode={saveState.autoMode}
            onToggleAutoMode={() =>
              updateSave((prev) => ({ ...prev, autoMode: !prev.autoMode }))
            }
            onMatchComplete={handleMatchComplete}
            onExit={() => {
              setMatchConfig(null);
              setActiveView('LOBBY');
            }}
          />
        ) : activeView === 'DYNASTY' ? (
          <DynastyHub
            saveState={saveState}
            onUpdateSave={updateSave}
            onStartDynastyMatch={(tier, oppId) => handleStart5v5Pro(tier, oppId)}
          />
        ) : activeView === 'WORLD_CUP' ? (
          <WorldCupHub
            bracket={saveState.tournamentBracket}
            onUpdateBracket={(b) => updateSave((prev) => ({ ...prev, tournamentBracket: b }))}
            onPlayTournamentMatch={handleStartWorldCupMatch}
          />
        ) : activeView === 'SKILLS_ACCURACY' || activeView === 'SKILLS_HARDEST' ? (
          <SkillsCompetition
            initialMode={activeView === 'SKILLS_ACCURACY' ? 'ACCURACY' : 'HARDEST_SHOT'}
            bestAccuracyScore={saveState.shootoutHighScore}
            bestShotMph={saveState.hardestShotMph}
            onUpdateRecord={(type, val) => {
              updateSave((prev) => ({
                ...prev,
                shootoutHighScore: type === 'ACCURACY' ? Math.max(prev.shootoutHighScore, val) : prev.shootoutHighScore,
                hardestShotMph: type === 'HARDEST_SHOT' ? Math.max(prev.hardestShotMph, val) : prev.hardestShotMph,
              }));
            }}
            onExit={() => setActiveView('LOBBY')}
          />
        ) : (
          /* LOBBY VIEW MATCHING THE ATTACHED SCREENSHOT EXACTLY */
          <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* HERO BANNER BLOCK WITH GENERATED PIXEL ART BACKGROUND */}
            <div className="relative rounded-xl border border-amber-500/40 overflow-hidden shadow-2xl bg-black min-h-[220px] sm:min-h-[260px] flex items-end p-6 sm:p-8">
              {/* Background Art */}
              <img
                src={retroBannerImg}
                alt="Retro Puck '94 16-Bit Ice Showdown"
                className="absolute inset-0 w-full h-full object-cover opacity-85 pixelated"
              />
              {/* Gradient scrim for high text contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

              {/* Title Overlay Text */}
              <div className="relative z-10 max-w-2xl">
                <div className="font-pixel text-[11px] text-amber-400 tracking-wider">
                  ARCADE 16-BIT ICE HOCKEY SIMULATOR
                </div>
                <h1 className="font-pixel text-2xl sm:text-4xl text-white tracking-wide mt-1.5 drop-shadow">
                  RETRO PUCK ’94
                </h1>
                <p className="text-xs text-slate-300 mt-2 font-mono leading-relaxed">
                  Authentic Ice Physics · Crushing Hip Checks · 100+ MPH Slap Shots & One-Timers ·
                  500-Player Franchise Dynasty Card Market · 100% In-Browser Zero Downloads
                </p>
              </div>
            </div>

            {/* 6-CARD GRID (2 ROWS X 3 COLUMNS) MATCHING THE SCREENSHOT */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* CARD 1: 3v3 Pond Hockey (Orange border) */}
              <div
                onClick={handleStart3v3Pond}
                className="bg-[#0b0e14] border-2 border-amber-600/90 hover:border-amber-400 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:-translate-y-1 shadow-lg group"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-500 mb-3">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="font-pixel text-xs text-amber-400 uppercase tracking-wide">
                    3v3 POND HOCKEY
                  </div>
                  <h3 className="font-pixel text-base text-white mt-1">Frozen Lake to 10</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                    Outdoor frozen lake action with wooden pine boards and snow banks. Zero
                    offsides, zero icing, rapid end-to-end rushes.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-pixel text-amber-400 group-hover:text-amber-300">
                  <span>PLAY POND HOCKEY</span>
                  <span className="text-base">→</span>
                </div>
              </div>

              {/* CARD 2: 5v5 Pro Arena Showdown (Yellow border) */}
              <div
                onClick={() => handleStart5v5Pro()}
                className="bg-[#0b0e14] border-2 border-yellow-500/90 hover:border-yellow-300 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:-translate-y-1 shadow-lg group relative"
              >
                {/* Detail Tag Top Right */}
                <span className="absolute top-4 right-4 bg-yellow-500/10 border border-yellow-500/50 text-yellow-300 text-[9px] font-pixel px-2 py-0.5 rounded">
                  DETAIL RINKS
                </span>

                <div>
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/40 flex items-center justify-center text-yellow-400 mb-3">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="font-pixel text-xs text-yellow-400 uppercase tracking-wide">
                    5v5 FULL-RINK PRO
                  </div>
                  <h3 className="font-pixel text-base text-white mt-1">NHL ’94 Arena</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                    High-contrast ice sheet, red center lines, blue lines, faceoff circles, board
                    banking, Zamboni resurfacer, and goal sirens.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-pixel text-yellow-400 group-hover:text-yellow-300">
                  <span>PLAY FULL RINK</span>
                  <span className="text-base">→</span>
                </div>
              </div>

              {/* CARD 3: Dynasty Franchise (Gold border) */}
              <div
                onClick={() => {
                  setMatchConfig(null);
                  setActiveView('DYNASTY');
                }}
                className="bg-[#0b0e14] border-2 border-amber-500/90 hover:border-amber-300 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:-translate-y-1 shadow-lg group"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3">
                    <PackageOpen className="w-4 h-4" />
                  </div>
                  <div className="font-pixel text-xs text-amber-400 uppercase tracking-wide">
                    DYNASTY FRANCHISE
                  </div>
                  <h3 className="font-pixel text-base text-white mt-1">Foil Packs & Market</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                    Draft rookie bronze talent, open foil packs, buy/sell official 500-player cards
                    on the transfer market, and climb 5 tiers.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-pixel text-amber-400 group-hover:text-amber-300">
                  <span>MANAGE DYNASTY</span>
                  <span className="text-base">→</span>
                </div>
              </div>

              {/* CARD 4: World Cup '94 16-Team Bracket (Orange border) */}
              <div
                onClick={() => {
                  setMatchConfig(null);
                  setActiveView('WORLD_CUP');
                }}
                className="bg-[#0b0e14] border-2 border-amber-600/90 hover:border-amber-400 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:-translate-y-1 shadow-lg group"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="font-pixel text-xs text-amber-400 uppercase tracking-wide">
                    WORLD CUP ’94
                  </div>
                  <h3 className="font-pixel text-base text-white mt-1">16-Team Bracket</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                    Single-elimination or best-of-3 tournament featuring Canada, Sweden, Finland,
                    USA, Czechia, Russia, and more.
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-pixel text-amber-400 group-hover:text-amber-300">
                  <span>ENTER WORLD CUP</span>
                  <span className="text-base">→</span>
                </div>
              </div>

              {/* CARD 5: All-Star Target Accuracy (Cyan/Teal border) */}
              <div
                onClick={() => {
                  setMatchConfig(null);
                  setActiveView('SKILLS_ACCURACY');
                }}
                className="bg-[#0b0e14] border-2 border-emerald-500/90 hover:border-emerald-300 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:-translate-y-1 shadow-lg group"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3">
                    <Target className="w-4 h-4" />
                  </div>
                  <div className="font-pixel text-xs text-emerald-400 uppercase tracking-wide">
                    ALL-STAR CONTEST
                  </div>
                  <h3 className="font-pixel text-base text-white mt-1">Target Accuracy</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                    4 foam targets strung to the posts, 10 pucks, and 30 seconds. Release at apex
                    for pinpoint top-shelf snipes!
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-pixel text-emerald-400 group-hover:text-emerald-300">
                  <span>HIGH SCORE: {saveState.shootoutHighScore} PTS</span>
                  <span className="text-base">→</span>
                </div>
              </div>

              {/* CARD 6: Hardest Slap Shot Radar Gun (Red border) */}
              <div
                onClick={() => {
                  setMatchConfig(null);
                  setActiveView('SKILLS_HARDEST');
                }}
                className="bg-[#0b0e14] border-2 border-rose-600/90 hover:border-rose-400 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-150 hover:-translate-y-1 shadow-lg group"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-500 mb-3">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div className="font-pixel text-xs text-rose-400 uppercase tracking-wide">
                    ALL-STAR CONTEST
                  </div>
                  <h3 className="font-pixel text-base text-white mt-1">Hardest Slap Shot</h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                    Heavy wind-up charge meter, 100+ mph heavy blasts, and glass-shattering audio
                    measured on the official speed radar!
                  </p>
                </div>
                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-pixel text-rose-400 group-hover:text-rose-300">
                  <span>RECORD: {saveState.hardestShotMph} MPH</span>
                  <span className="text-base">→</span>
                </div>
              </div>
            </div>

            {/* 4. SYSTEM ARCHITECTURE & DISPLAY FOOTER BAR (MATCHING SCREENSHOT) */}
            <div className="bg-[#0b0e14] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              {/* Left label */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400">⚙</span>
                <span className="font-pixel text-[11px] text-white tracking-wider">
                  SYSTEM ARCHITECTURE & DISPLAY
                </span>
              </div>

              {/* Controls center / right */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Playing Mode / Difficulty Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextDiff =
                      saveState.difficulty === 'EASY'
                        ? 'PRO'
                        : saveState.difficulty === 'PRO'
                        ? 'LEGEND'
                        : 'EASY';
                    retroAudio.playPuckStick(0.6);
                    updateSave((prev) => ({ ...prev, difficulty: nextDiff }));
                  }}
                  className={`px-3 py-1.5 rounded font-pixel text-[10px] cursor-pointer border transition-colors flex items-center gap-1.5 ${
                    saveState.difficulty === 'LEGEND'
                      ? 'bg-rose-950 border-rose-500/70 text-rose-300'
                      : saveState.difficulty === 'PRO'
                      ? 'bg-amber-950 border-amber-500/70 text-amber-300'
                      : 'bg-emerald-950 border-emerald-500/70 text-emerald-300'
                  }`}
                  title="Cycle Opponent AI Aggressiveness: Easy -> Pro -> Legend"
                >
                  <span>AI DIFFICULTY: {saveState.difficulty}</span>
                </button>

                {/* Auto Play Mode Button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextAuto = !saveState.autoMode;
                    retroAudio.playPuckStick(0.6);
                    if (nextAuto) {
                      retroAudio.announce('Auto Play Mode Enabled', false);
                    }
                    updateSave((prev) => ({ ...prev, autoMode: nextAuto }));
                  }}
                  className={`px-3 py-1.5 rounded font-pixel text-[10px] cursor-pointer border transition-colors flex items-center gap-1.5 ${
                    saveState.autoMode
                      ? 'bg-purple-950 border-purple-500/70 text-purple-300 animate-pulse'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                  title="Auto Play Mode: Autonomous AI controls both squads"
                >
                  <span>AUTO MODE: {saveState.autoMode ? 'ON' : 'OFF'}</span>
                </button>

                {/* Gopi Mode Button */}
                <button
                  type="button"
                  onClick={() =>
                    updateSave((prev) => ({ ...prev, gopiMode: !prev.gopiMode }))
                  }
                  className={`px-3 py-1.5 rounded font-pixel text-[10px] cursor-pointer border transition-colors flex items-center gap-1.5 ${
                    saveState.gopiMode
                      ? 'bg-[#0f402c] border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>GOPI MODE: {saveState.gopiMode ? 'ON (60 FPS)' : 'OFF'}</span>
                </button>

                {/* CRT Scanlines Button */}
                <button
                  type="button"
                  onClick={() =>
                    updateSave((prev) => ({ ...prev, crtScanlines: !prev.crtScanlines }))
                  }
                  className={`px-3 py-1.5 rounded font-pixel text-[10px] cursor-pointer border transition-colors ${
                    saveState.crtScanlines
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  CRT SCANLINES: {saveState.crtScanlines ? 'ON' : 'OFF'}
                </button>

                {/* Build Version Tag */}
                <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded font-pixel text-[10px] text-cyan-300 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                  <span>v1.9.4 · SYNCED</span>
                  <RefreshCw className="w-3 h-3 text-slate-500" />
                </div>
              </div>
            </div>

            {/* Offline-First Persistence Subtext */}
            <div className="text-center text-[10px] text-slate-500 font-pixel">
              100% In-Browser · Auto-Syncs Online · Playable Offline Locally · GitHub Pages Hostable
            </div>
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-900 px-6 py-3 text-[10px] text-slate-600 flex flex-wrap items-center justify-between gap-4 font-pixel">
        <div>RETRO PUCK ’94 · PRESENTED BY TUXEDO PENGUIN GAMING SPORTS STUDIO</div>
        <div>500-PLAYER DATABASE · LOCALSTORAGE PERSISTENCE</div>
      </footer>
    </div>
  );
}

export default App;
