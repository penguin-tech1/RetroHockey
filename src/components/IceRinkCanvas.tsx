import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DifficultyMode, PlayerCard, RinkVenue } from '../types/game';
import { retroAudio } from '../utils/retroAudio';
import { Volume2, VolumeX, Play, Pause, RotateCcw, ShieldAlert, Zap, Award } from 'lucide-react';

export type MatchGameMode = 'DYNASTY' | 'WORLDCUP' | 'POND_3V3' | 'SHOOTOUT';

interface IceRinkCanvasProps {
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
  gopiMode: boolean;
  difficulty?: DifficultyMode;
  autoMode?: boolean;
  onToggleAutoMode?: () => void;
  onMatchComplete: (result: {
    homeScore: number;
    awayScore: number;
    homeShots: number;
    awayShots: number;
    homeHits: number;
    awayHits: number;
  }) => void;
  onExit: () => void;
}

interface SkaterEntity {
  id: string;
  card: PlayerCard;
  team: 'HOME' | 'AWAY';
  role: 'C' | 'LW' | 'RW' | 'LD' | 'RD' | 'G';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  stamina: number;
  stunTimer: number;
  checkCooldown: number;
  animFrame: number;
}

interface SnowParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface PenaltyTimer {
  team: 'HOME' | 'AWAY';
  playerName: string;
  infraction: string;
  timeRemaining: number; // seconds
}

interface BrawlState {
  active: boolean;
  timer: number;
  homeFighter: string;
  awayFighter: string;
  homeHp: number;
  awayHp: number;
  lastAction: string;
}

export interface GoalNetObject {
  id: 'NET_LEFT' | 'NET_RIGHT';
  team: 'HOME' | 'AWAY';
  goalLineX: number;
  centerY: number;
  halfWidth: number;
  depth: number;
  springBulge: number;
  springVelocity: number;
  shatterHits: number;
  postRadius: number;
  crossbarHeight: number;
  isPuckInside: (px: number, py: number) => boolean;
  checkPostCollision: (px: number, py: number) => { hit: boolean; postY?: number; postX?: number };
  applyImpulse: (force: number) => void;
  updatePhysics: () => void;
}

const RINK_W = 1000;
const RINK_H = 520;
const ICE_LEFT = 50;
const ICE_RIGHT = 950;
const ICE_TOP = 40;
const ICE_BOTTOM = 480;
const CORNER_R = 72;

const GOAL_LEFT_X = 115;
const GOAL_RIGHT_X = 885;
const GOAL_Y_CENTER = 260;
const GOAL_HALF_W = 38;

export const IceRinkCanvas: React.FC<IceRinkCanvasProps> = ({
  mode,
  venue,
  homeTeamName,
  homePrimaryColor,
  homeSecondaryColor,
  homeRoster,
  awayTeamName,
  awayPrimaryColor,
  awaySecondaryColor,
  awayRoster,
  gopiMode,
  difficulty = 'PRO',
  autoMode = false,
  onToggleAutoMode,
  onMatchComplete,
  onExit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticRinkBufferRef = useRef<HTMLCanvasElement | null>(null);

  // React UI HUD State (synced cleanly at low frequency so 60 FPS canvas never stutters)
  const [hudState, setHudState] = useState({
    period: 1,
    clockSeconds: mode === 'SHOOTOUT' ? 60 : mode === 'POND_3V3' ? 120 : 120,
    homeScore: 0,
    awayScore: 0,
    homeShots: 0,
    awayShots: 0,
    homeHits: 0,
    awayHits: 0,
    controlledName: homeRoster[0]?.name || 'K. Varga',
    controlledPos: homeRoster[0]?.pos || 'C',
    announcementBanner: 'FACEOFF AT CENTER ICE — TUXEDO PENGUIN DROPS THE PUCK!',
    isPaused: false,
    isGameOver: false,
    isIntermissionZamboni: false,
    goalFlashTimer: 0,
    shatteredGlassSide: null as 'LEFT' | 'RIGHT' | null,
    penalties: [] as PenaltyTimer[],
    shootoutRound: 1,
    shootoutTurn: 'HOME' as 'HOME' | 'AWAY',
    momentumHome: 50,
  });

  const [brawl, setBrawl] = useState<BrawlState>({
    active: false,
    timer: 10,
    homeFighter: 'Enforcer',
    awayFighter: 'Enforcer',
    homeHp: 100,
    awayHp: 100,
    lastAction: 'DROP THE GLOVES!',
  });

  const [soundOn, setSoundOn] = useState(retroAudio.soundEnabled);

  // Mutable Game Engine Reference for Locked 60 FPS (16.6ms fixed timestep)
  const engineRef = useRef({
    skaters: [] as SkaterEntity[],
    controlledId: 'HOME_0',
    puck: {
      x: 500,
      y: 260,
      vx: 0,
      vy: 0,
      z: 0,
      ownerId: null as string | null,
      lastPasserId: null as string | null,
      passTimer: 0, // if > 0, eligible for blistering One-Timer!
    },
    keys: {} as Record<string, boolean>,
    slapCharge: 0,
    isChargingSlap: false,
    leftNet: {
      id: 'NET_LEFT' as const,
      team: 'HOME' as const,
      goalLineX: GOAL_LEFT_X,
      centerY: GOAL_Y_CENTER,
      halfWidth: GOAL_HALF_W,
      depth: 26,
      springBulge: 0,
      springVelocity: 0,
      shatterHits: 0,
      postRadius: 4.5,
      crossbarHeight: 32,
      isPuckInside: (px: number, py: number) =>
        px <= GOAL_LEFT_X && px >= GOAL_LEFT_X - 26 && Math.abs(py - GOAL_Y_CENTER) <= GOAL_HALF_W,
      checkPostCollision: (px: number, py: number) => {
        const topDist = Math.hypot(px - GOAL_LEFT_X, py - (GOAL_Y_CENTER - GOAL_HALF_W));
        const botDist = Math.hypot(px - GOAL_LEFT_X, py - (GOAL_Y_CENTER + GOAL_HALF_W));
        if (topDist <= 5.5) return { hit: true, postX: GOAL_LEFT_X, postY: GOAL_Y_CENTER - GOAL_HALF_W };
        if (botDist <= 5.5) return { hit: true, postX: GOAL_LEFT_X, postY: GOAL_Y_CENTER + GOAL_HALF_W };
        return { hit: false };
      },
      applyImpulse: function (force: number) {
        this.springVelocity = force;
        this.springBulge = Math.min(28, this.springBulge + force);
      },
      updatePhysics: function () {
        this.springBulge *= 0.84;
      },
    },
    rightNet: {
      id: 'NET_RIGHT' as const,
      team: 'AWAY' as const,
      goalLineX: GOAL_RIGHT_X,
      centerY: GOAL_Y_CENTER,
      halfWidth: GOAL_HALF_W,
      depth: 26,
      springBulge: 0,
      springVelocity: 0,
      shatterHits: 0,
      postRadius: 4.5,
      crossbarHeight: 32,
      isPuckInside: (px: number, py: number) =>
        px >= GOAL_RIGHT_X && px <= GOAL_RIGHT_X + 26 && Math.abs(py - GOAL_Y_CENTER) <= GOAL_HALF_W,
      checkPostCollision: (px: number, py: number) => {
        const topDist = Math.hypot(px - GOAL_RIGHT_X, py - (GOAL_Y_CENTER - GOAL_HALF_W));
        const botDist = Math.hypot(px - GOAL_RIGHT_X, py - (GOAL_Y_CENTER + GOAL_HALF_W));
        if (topDist <= 5.5) return { hit: true, postX: GOAL_RIGHT_X, postY: GOAL_Y_CENTER - GOAL_HALF_W };
        if (botDist <= 5.5) return { hit: true, postX: GOAL_RIGHT_X, postY: GOAL_Y_CENTER + GOAL_HALF_W };
        return { hit: false };
      },
      applyImpulse: function (force: number) {
        this.springVelocity = force;
        this.springBulge = Math.min(28, this.springBulge + force);
      },
      updatePhysics: function () {
        this.springBulge *= 0.84;
      },
    },
    goalFlash: 0,
    faceoffCountdown: 90, // frames
    tuxedoPenguinRef: {
      x: 500,
      y: 215,
      visible: true,
      message: 'DROP PUCK!',
      timer: 120,
    },
    zamboni: {
      active: false,
      x: 100,
      y: 160,
      dir: 1,
    },
    particles: Array.from({ length: gopiMode ? 45 : 90 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 20,
      color: '#ffffff',
      size: 2,
    })) as SnowParticle[],
    period: 1,
    clockFrames: (mode === 'SHOOTOUT' ? 60 : 120) * 60,
    homeScore: 0,
    awayScore: 0,
    homeShots: 0,
    awayShots: 0,
    homeHits: 0,
    awayHits: 0,
    penalties: [] as PenaltyTimer[],
    shatteredGlass: null as 'LEFT' | 'RIGHT' | null,
    momentumBonusHome: 0,
    shootoutRound: 1,
    shootoutTurn: 'HOME' as 'HOME' | 'AWAY',
    isPaused: false,
    isGameOver: false,
    brawlActive: false,
  });

  // Pre-render the static rink surface to an offscreen canvas ("Gopi Mode" Zero Overdraw optimization)
  const buildStaticRinkBuffer = useCallback(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = RINK_W;
    offscreen.height = RINK_H;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // Outer stadium / snow surround
    ctx.fillStyle = venue.isOutdoor ? '#cbd5e1' : '#0f172a';
    ctx.fillRect(0, 0, RINK_W, RINK_H);

    // Outdoor snowbanks or indoor crowd seats
    if (venue.isOutdoor) {
      ctx.fillStyle = '#e2e8f0';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect((i * 73) % RINK_W, (i * 29) % 35, 32, 12);
        ctx.fillRect((i * 89) % RINK_W, RINK_H - 35 + ((i * 19) % 25), 36, 12);
      }
    } else {
      // Crisp 16-bit pixel spectators in top & bottom bleachers
      const crowdColors = [homePrimaryColor, awayPrimaryColor, '#facc15', '#e2e8f0', '#94a3b8'];
      for (let x = 60; x < RINK_W - 60; x += 14) {
        ctx.fillStyle = crowdColors[(x * 7) % crowdColors.length];
        ctx.fillRect(x, 10, 8, 8);
        ctx.fillStyle = crowdColors[(x * 13) % crowdColors.length];
        ctx.fillRect(x + 3, 22, 8, 8);
        ctx.fillStyle = crowdColors[(x * 11) % crowdColors.length];
        ctx.fillRect(x, RINK_H - 20, 8, 8);
        ctx.fillStyle = crowdColors[(x * 17) % crowdColors.length];
        ctx.fillRect(x + 3, RINK_H - 32, 8, 8);
      }
    }

    // Rounded Rectangle Rink Path
    const drawRoundedIce = () => {
      ctx.beginPath();
      ctx.moveTo(ICE_LEFT + CORNER_R, ICE_TOP);
      ctx.lineTo(ICE_RIGHT - CORNER_R, ICE_TOP);
      ctx.quadraticCurveTo(ICE_RIGHT, ICE_TOP, ICE_RIGHT, ICE_TOP + CORNER_R);
      ctx.lineTo(ICE_RIGHT, ICE_BOTTOM - CORNER_R);
      ctx.quadraticCurveTo(ICE_RIGHT, ICE_BOTTOM, ICE_RIGHT - CORNER_R, ICE_BOTTOM);
      ctx.lineTo(ICE_LEFT + CORNER_R, ICE_BOTTOM);
      ctx.quadraticCurveTo(ICE_LEFT, ICE_BOTTOM, ICE_LEFT, ICE_BOTTOM - CORNER_R);
      ctx.lineTo(ICE_LEFT, ICE_TOP + CORNER_R);
      ctx.quadraticCurveTo(ICE_LEFT, ICE_TOP, ICE_LEFT + CORNER_R, ICE_TOP);
      ctx.closePath();
    };

    // Crisp High-Contrast Ice Sheet
    drawRoundedIce();
    ctx.fillStyle = venue.iceTint;
    ctx.fill();
    ctx.save();
    ctx.clip();

    // Subtle stadium light sheen on fresh ice
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(220, ICE_TOP, 90, ICE_BOTTOM - ICE_TOP);
    ctx.fillRect(465, ICE_TOP, 70, ICE_BOTTOM - ICE_TOP);
    ctx.fillRect(690, ICE_TOP, 90, ICE_BOTTOM - ICE_TOP);

    // Goal Lines (Red, thin)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(GOAL_LEFT_X, ICE_TOP);
    ctx.lineTo(GOAL_LEFT_X, ICE_BOTTOM);
    ctx.moveTo(GOAL_RIGHT_X, ICE_TOP);
    ctx.lineTo(GOAL_RIGHT_X, ICE_BOTTOM);
    ctx.stroke();

    // Blue Lines (Authentic Arcade Hockey)
    if (mode !== 'POND_3V3') {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(355, ICE_TOP, 8, ICE_BOTTOM - ICE_TOP);
      ctx.fillRect(637, ICE_TOP, 8, ICE_BOTTOM - ICE_TOP);
    }

    // Red Center Line (Dashed 16-bit style)
    ctx.fillStyle = '#dc2626';
    for (let y = ICE_TOP; y < ICE_BOTTOM; y += 20) {
      ctx.fillRect(496, y, 8, 12);
    }

    // Center Ice Faceoff Circle & Logo
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(500, 260, 56, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(500, 260, 6, 0, Math.PI * 2);
    ctx.fill();

    // 4 Zone Faceoff Circles
    const faceoffSpots = [
      [230, 145],
      [230, 375],
      [770, 145],
      [770, 375],
    ];
    faceoffSpots.forEach(([fx, fy]) => {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(fx, fy, 42, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(fx, fy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Goal Creases (Light Blue Half-Circles with Red Outline)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;

    // Left Crease
    ctx.beginPath();
    ctx.arc(GOAL_LEFT_X, GOAL_Y_CENTER, 34, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Crease
    ctx.beginPath();
    ctx.arc(GOAL_RIGHT_X, GOAL_Y_CENTER, 34, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Perimeter Boards & Plexiglass Border
    drawRoundedIce();
    ctx.strokeStyle = venue.boardColor;
    ctx.lineWidth = 10;
    ctx.stroke();

    drawRoundedIce();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    staticRinkBufferRef.current = offscreen;
  }, [venue, mode, homePrimaryColor, awayPrimaryColor]);

  // Spawn / Reset Skater Positions for Faceoff or Breakaway Shootout
  const setupPositions = useCallback(
    (centerTeam: 'HOME' | 'AWAY' = 'HOME') => {
      const eng = engineRef.current;
      const skaters: SkaterEntity[] = [];

      const homeCards = homeRoster.length >= 6 ? homeRoster : homeRoster;
      const awayCards = awayRoster.length >= 6 ? awayRoster : awayRoster;

      const getCard = (arr: PlayerCard[], idx: number) => arr[idx % arr.length];

      if (mode === 'SHOOTOUT') {
        // 1-on-1 Breakaway Challenge: Skater at Center Ice vs Goalie in Net
        const isHomeShooting = eng.shootoutTurn === 'HOME';
        if (isHomeShooting) {
          skaters.push({
            id: 'HOME_0',
            card: getCard(homeCards, 0),
            team: 'HOME',
            role: 'C',
            x: 460,
            y: 260,
            vx: 0,
            vy: 0,
            angle: 0,
            stamina: 100,
            stunTimer: 0,
            checkCooldown: 0,
            animFrame: 0,
          });
          skaters.push({
            id: 'AWAY_G',
            card: awayCards.find((c) => c.pos === 'G') || getCard(awayCards, 5),
            team: 'AWAY',
            role: 'G',
            x: GOAL_RIGHT_X - 14,
            y: GOAL_Y_CENTER,
            vx: 0,
            vy: 0,
            angle: Math.PI,
            stamina: 100,
            stunTimer: 0,
            checkCooldown: 0,
            animFrame: 0,
          });
          eng.controlledId = 'HOME_0';
          eng.puck.x = 472;
          eng.puck.y = 260;
          eng.puck.ownerId = 'HOME_0';
        } else {
          skaters.push({
            id: 'AWAY_0',
            card: getCard(awayCards, 0),
            team: 'AWAY',
            role: 'C',
            x: 540,
            y: 260,
            vx: 0,
            vy: 0,
            angle: Math.PI,
            stamina: 100,
            stunTimer: 0,
            checkCooldown: 0,
            animFrame: 0,
          });
          skaters.push({
            id: 'HOME_G',
            card: homeCards.find((c) => c.pos === 'G') || getCard(homeCards, 5),
            team: 'HOME',
            role: 'G',
            x: GOAL_LEFT_X + 14,
            y: GOAL_Y_CENTER,
            vx: 0,
            vy: 0,
            angle: 0,
            stamina: 100,
            stunTimer: 0,
            checkCooldown: 0,
            animFrame: 0,
          });
          eng.controlledId = 'HOME_G';
          eng.puck.x = 528;
          eng.puck.y = 260;
          eng.puck.ownerId = 'AWAY_0';
        }
        eng.puck.vx = 0;
        eng.puck.vy = 0;
        eng.skaters = skaters;
        eng.faceoffCountdown = 35;
        return;
      }

      // Check active penalties to reduce skater count (Power Play / Penalty Kill)
      const homePenalties = eng.penalties.filter((p) => p.team === 'HOME').length;
      const awayPenalties = eng.penalties.filter((p) => p.team === 'AWAY').length;

      const baseSkaterCount = mode === 'POND_3V3' ? 3 : 5;
      const homeFieldCount = Math.max(3, baseSkaterCount - Math.min(2, homePenalties));
      const awayFieldCount = Math.max(3, baseSkaterCount - Math.min(2, awayPenalties));

      const homeFormations: { role: SkaterEntity['role']; x: number; y: number }[] = [
        { role: 'C', x: 472, y: 260 },
        { role: 'LW', x: 430, y: 165 },
        { role: 'RW', x: 430, y: 355 },
        { role: 'LD', x: 310, y: 195 },
        { role: 'RD', x: 310, y: 325 },
      ];

      const awayFormations: { role: SkaterEntity['role']; x: number; y: number }[] = [
        { role: 'C', x: 528, y: 260 },
        { role: 'LW', x: 570, y: 165 },
        { role: 'RW', x: 570, y: 355 },
        { role: 'LD', x: 690, y: 195 },
        { role: 'RD', x: 690, y: 325 },
      ];

      for (let i = 0; i < homeFieldCount; i++) {
        const f = homeFormations[i];
        skaters.push({
          id: `HOME_${i}`,
          card: getCard(homeCards, i),
          team: 'HOME',
          role: f.role,
          x: f.x,
          y: f.y,
          vx: 0,
          vy: 0,
          angle: 0,
          stamina: 100,
          stunTimer: 0,
          checkCooldown: 0,
          animFrame: 0,
        });
      }

      // Home Goalie
      skaters.push({
        id: 'HOME_G',
        card: homeCards.find((c) => c.pos === 'G') || getCard(homeCards, 5),
        team: 'HOME',
        role: 'G',
        x: GOAL_LEFT_X + 14,
        y: GOAL_Y_CENTER,
        vx: 0,
        vy: 0,
        angle: 0,
        stamina: 100,
        stunTimer: 0,
        checkCooldown: 0,
        animFrame: 0,
      });

      for (let i = 0; i < awayFieldCount; i++) {
        const f = awayFormations[i];
        skaters.push({
          id: `AWAY_${i}`,
          card: getCard(awayCards, i),
          team: 'AWAY',
          role: f.role,
          x: f.x,
          y: f.y,
          vx: 0,
          vy: 0,
          angle: Math.PI,
          stamina: 100,
          stunTimer: 0,
          checkCooldown: 0,
          animFrame: 0,
        });
      }

      // Away Goalie
      skaters.push({
        id: 'AWAY_G',
        card: awayCards.find((c) => c.pos === 'G') || getCard(awayCards, 5),
        team: 'AWAY',
        role: 'G',
        x: GOAL_RIGHT_X - 14,
        y: GOAL_Y_CENTER,
        vx: 0,
        vy: 0,
        angle: Math.PI,
        stamina: 100,
        stunTimer: 0,
        checkCooldown: 0,
        animFrame: 0,
      });

      eng.skaters = skaters;
      eng.controlledId = 'HOME_0';
      eng.puck.x = 500;
      eng.puck.y = 260;
      eng.puck.vx = (centerTeam === 'HOME' ? -1 : 1) * 0.5;
      eng.puck.vy = (Math.random() - 0.5) * 1.2;
      eng.puck.ownerId = null;
      eng.puck.passTimer = 0;
      eng.faceoffCountdown = 55;
      eng.tuxedoPenguinRef = {
        x: 500,
        y: 205,
        visible: true,
        message: 'FACEOFF!',
        timer: 85,
      };
    },
    [homeRoster, awayRoster, mode]
  );

  // Spawn lean snow spray particles on hard stops or checks
  const spawnSnowSpray = (x: number, y: number, vx: number, vy: number, count = 6, color = '#ffffff') => {
    const eng = engineRef.current;
    let spawned = 0;
    for (let i = 0; i < eng.particles.length && spawned < count; i++) {
      const p = eng.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 8;
        p.y = y + (Math.random() - 0.5) * 8;
        p.vx = vx * 0.35 + (Math.random() - 0.5) * 2.8;
        p.vy = vy * 0.35 + (Math.random() - 0.5) * 2.8;
        p.life = 0;
        p.maxLife = 14 + Math.floor(Math.random() * 12);
        p.color = color;
        p.size = 2 + Math.floor(Math.random() * 2);
        spawned++;
      }
    }
  };

  // Trigger Optional 10-Second Retro Glove Drop Brawl after a crushing check!
  const triggerGloveDropBrawl = (homeSkater: SkaterEntity, awaySkater: SkaterEntity) => {
    const eng = engineRef.current;
    if (eng.brawlActive || mode === 'SHOOTOUT') return;
    eng.brawlActive = true;
    retroAudio.playWhistle();
    retroAudio.announce('The gloves are off! Sudden Showdown!', true);
    setBrawl({
      active: true,
      timer: 10,
      homeFighter: homeSkater.card.name,
      awayFighter: awaySkater.card.name,
      homeHp: 100,
      awayHp: 100,
      lastAction: 'GLOVES DROPPED! THROW JABS OR UPPERCUTS!',
    });
  };

  // Handle Brawl Controls
  const handleBrawlMove = (move: 'JAB' | 'HOOK' | 'DODGE') => {
    setBrawl((prev) => {
      if (!prev.active) return prev;
      let homeDmg = 0;
      let awayDmg = 0;
      let log = '';

      const botRoll = Math.random();
      if (move === 'JAB') {
        awayDmg = 18 + Math.floor(Math.random() * 8);
        homeDmg = botRoll > 0.45 ? 12 : 0;
        log = `${prev.homeFighter} lands a crisp 16-bit jab! (-${awayDmg} HP)`;
        retroAudio.playPuckStick(0.9);
      } else if (move === 'HOOK') {
        if (Math.random() > 0.25) {
          awayDmg = 30 + Math.floor(Math.random() * 12);
          log = `CRUSHING RIGHT HOOK BY ${prev.homeFighter}! (-${awayDmg} HP)`;
          retroAudio.playBoardSmash(false);
        } else {
          homeDmg = 18;
          log = `${prev.homeFighter} swings wide and gets countered!`;
        }
      } else {
        awayDmg = 10;
        log = `${prev.homeFighter} weaves & counters off the jersey grab!`;
        retroAudio.playSkateCarve(0.6);
      }

      const nextAwayHp = Math.max(0, prev.awayHp - awayDmg);
      const nextHomeHp = Math.max(0, prev.homeHp - homeDmg);

      if (nextAwayHp <= 0 || nextHomeHp <= 0) {
        const won = nextAwayHp <= 0;
        engineRef.current.brawlActive = false;
        engineRef.current.momentumBonusHome = won ? 25 : -10;
        if (won) {
          retroAudio.playOrganCharge();
          retroAudio.announce('Knockout victory! Momentum boost!', true);
        }
        return {
          ...prev,
          active: false,
          awayHp: nextAwayHp,
          homeHp: nextHomeHp,
          lastAction: won ? 'VICTORY! +25% TEAM SKATING & SHOT MOMENTUM!' : 'BRAWL OVER!',
        };
      }

      return {
        ...prev,
        awayHp: nextAwayHp,
        homeHp: nextHomeHp,
        lastAction: log,
      };
    });
  };

  // Keyboard & Action Controls
  useEffect(() => {
    buildStaticRinkBuffer();
    setupPositions('HOME');
    retroAudio.playWhistle();
  }, [buildStaticRinkBuffer, setupPositions]);

  // Execute Pass / Switch Skater
  const triggerPassOrSwitch = useCallback(() => {
    const eng = engineRef.current;
    if (eng.isPaused || eng.isGameOver || eng.brawlActive) return;

    const controlled = eng.skaters.find((s) => s.id === eng.controlledId);
    if (!controlled) return;

    // If we have the puck: Tape-to-tape pass to open teammate!
    if (eng.puck.ownerId === controlled.id) {
      const teammates = eng.skaters.filter(
        (s) => s.team === 'HOME' && s.id !== controlled.id && s.role !== 'G'
      );
      if (teammates.length === 0) return;

      // Pick teammate most aligned with aim or closest to attacking net
      let bestTarget = teammates[0];
      let bestScore = -9999;
      for (const tm of teammates) {
        const dx = tm.x - controlled.x;
        const dy = tm.y - controlled.y;
        const dist = Math.hypot(dx, dy);
        const forwardBonus = tm.x * 0.45 - dist * 0.25;
        if (forwardBonus > bestScore) {
          bestScore = forwardBonus;
          bestTarget = tm;
        }
      }

      const angle = Math.atan2(bestTarget.y - controlled.y, bestTarget.x - controlled.x);
      const passSpeed = 9.2 + (controlled.card.pas - 70) * 0.06;
      eng.puck.ownerId = null;
      eng.puck.lastPasserId = controlled.id;
      eng.puck.passTimer = 42; // 42 frames window for a blistering One-Timer!
      eng.puck.vx = Math.cos(angle) * passSpeed;
      eng.puck.vy = Math.sin(angle) * passSpeed;
      eng.controlledId = bestTarget.id;
      retroAudio.playPuckStick(0.6);
    } else {
      // Switch to closest home skater to the puck
      const fieldSkaters = eng.skaters.filter((s) => s.team === 'HOME' && s.role !== 'G');
      let closest = fieldSkaters[0];
      let minDist = Infinity;
      for (const s of fieldSkaters) {
        const d = Math.hypot(s.x - eng.puck.x, s.y - eng.puck.y);
        if (d < minDist) {
          minDist = d;
          closest = s;
        }
      }
      if (closest) {
        eng.controlledId = closest.id;
      }
    }
  }, []);

  // Execute Shot (Wrist Shot, Charged Slap Shot, One-Timer, or Wrap-Around!)
  const releaseShot = useCallback((chargeFrames: number, forceOneTimer = false) => {
    const eng = engineRef.current;
    const controlled = eng.skaters.find((s) => s.id === eng.controlledId);
    if (!controlled) return;

    // One-Timer check: if puck is loose and passTimer > 0 and near controlled skater
    const distToPuck = Math.hypot(controlled.x - eng.puck.x, controlled.y - eng.puck.y);
    const isOneTimer =
      (forceOneTimer || eng.puck.passTimer > 0) &&
      (eng.puck.ownerId === controlled.id || distToPuck < 58);

    if (eng.puck.ownerId !== controlled.id && !isOneTimer) return;

    const targetX = GOAL_RIGHT_X;
    // Aim top corner or bottom corner based on up/down input
    let targetY = GOAL_Y_CENTER + (Math.random() - 0.5) * 48;
    if (eng.keys['ArrowUp'] || eng.keys['KeyW']) targetY = GOAL_Y_CENTER - 28;
    if (eng.keys['ArrowDown'] || eng.keys['KeyS']) targetY = GOAL_Y_CENTER + 28;

    // Check Wrap-Around (skating from behind opponent's net at x > GOAL_RIGHT_X)
    const isWrapAround = controlled.x > GOAL_RIGHT_X - 8;
    if (isWrapAround) {
      targetY = controlled.y < GOAL_Y_CENTER ? GOAL_Y_CENTER - 26 : GOAL_Y_CENTER + 26;
    }

    const angle = Math.atan2(targetY - eng.puck.y, targetX - eng.puck.x);
    const shotStatBonus = (controlled.card.sht - 70) * 0.08;
    const momentumBoost = eng.momentumBonusHome > 0 ? 1.5 : 0;

    let speed = 11.2 + shotStatBonus + momentumBoost;
    let shotTypeLabel = 'WRIST SHOT!';

    if (isOneTimer) {
      speed = 15.8 + shotStatBonus + momentumBoost;
      shotTypeLabel = 'BLISTERING ONE-TIMER!';
      retroAudio.playSlapShotBlast(true);
      spawnSnowSpray(eng.puck.x, eng.puck.y, -4, 0, 12, '#facc15');
    } else if (chargeFrames >= 18) {
      speed = 14.6 + Math.min(2.5, chargeFrames * 0.05) + shotStatBonus + momentumBoost;
      shotTypeLabel = '104 MPH SLAP SHOT BLAST!';
      retroAudio.playSlapShotBlast(false);
      spawnSnowSpray(eng.puck.x, eng.puck.y, -3, 0, 10, '#38bdf8');
    } else if (isWrapAround) {
      speed = 11.8 + shotStatBonus;
      shotTypeLabel = 'WRAP-AROUND TUCK!';
      retroAudio.playPuckStick(0.85);
    } else {
      retroAudio.playPuckStick(0.75);
    }

    eng.puck.ownerId = null;
    eng.puck.passTimer = 0;
    eng.puck.vx = Math.cos(angle) * speed;
    eng.puck.vy = Math.sin(angle) * speed;
    eng.homeShots += 1;

    eng.tuxedoPenguinRef.message = shotTypeLabel;
    eng.tuxedoPenguinRef.timer = 45;
  }, []);

  // Execute Poke Check / Stick Lift or Crushing Hip Check into the Boards!
  const triggerDefenseAction = useCallback((type: 'POKE' | 'BODY_CHECK') => {
    const eng = engineRef.current;
    const controlled = eng.skaters.find((s) => s.id === eng.controlledId);
    if (!controlled || controlled.checkCooldown > 0) return;

    controlled.checkCooldown = type === 'BODY_CHECK' ? 28 : 16;

    // Lunge boost for body check
    if (type === 'BODY_CHECK') {
      controlled.vx += Math.cos(controlled.angle) * 4.5;
      controlled.vy += Math.sin(controlled.angle) * 4.5;
      retroAudio.playSkateCarve(0.8);
    } else {
      retroAudio.playPuckStick(0.4);
    }

    const opponents = eng.skaters.filter((s) => s.team === 'AWAY' && s.role !== 'G');
    const reach = type === 'POKE' ? 46 + (controlled.card.def - 70) * 0.3 : 40;

    for (const opp of opponents) {
      const d = Math.hypot(opp.x - controlled.x, opp.y - controlled.y);
      if (d <= reach) {
        if (type === 'POKE') {
          // Precision Poke Check & Stick Lift
          if (eng.puck.ownerId === opp.id) {
            eng.puck.ownerId = null;
            eng.puck.vx = (Math.random() - 0.3) * 5;
            eng.puck.vy = (Math.random() - 0.5) * 5;
            eng.tuxedoPenguinRef.message = 'CLEAN POKE CHECK!';
            eng.tuxedoPenguinRef.timer = 45;
          }
          // 6% chance of accidental tripping/high-sticking if low DEF rating
          if (Math.random() < 0.05 && mode !== 'POND_3V3' && mode !== 'SHOOTOUT') {
            eng.penalties.push({
              team: 'HOME',
              playerName: controlled.card.name,
              infraction: 'High-Sticking (2:00)',
              timeRemaining: 30,
            });
            retroAudio.playWhistle();
            eng.tuxedoPenguinRef.message = `PENALTY: ${controlled.card.name} — HIGH-STICKING!`;
            eng.tuxedoPenguinRef.timer = 90;
          }
        } else {
          // Crushing Hip Check & Board Smash!
          const angle = Math.atan2(opp.y - controlled.y, opp.x - controlled.x);
          const hitForce = 7.5 + (controlled.card.chk - 70) * 0.08;
          opp.vx = Math.cos(angle) * hitForce;
          opp.vy = Math.sin(angle) * hitForce;
          opp.stunTimer = 55;
          eng.homeHits += 1;

          if (eng.puck.ownerId === opp.id) {
            eng.puck.ownerId = controlled.id;
          }

          const nearBoards =
            opp.y < ICE_TOP + 45 ||
            opp.y > ICE_BOTTOM - 45 ||
            opp.x < ICE_LEFT + 55 ||
            opp.x > ICE_RIGHT - 55;

          retroAudio.playBoardSmash(nearBoards && controlled.card.chk >= 85);
          spawnSnowSpray(opp.x, opp.y, opp.vx, opp.vy, 14, '#e0f2fe');

          eng.tuxedoPenguinRef.message = nearBoards ? 'CRUSHING BOARD SMASH!' : 'HEAVY HIP CHECK!';
          eng.tuxedoPenguinRef.timer = 55;

          // If tensions boil over after a huge board check, trigger optional 10-second Retro Glove Drop!
          if (nearBoards && Math.random() < 0.28) {
            triggerGloveDropBrawl(controlled, opp);
          }
        }
        break;
      }
    }
  }, [mode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      eng.keys[e.code] = true;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'KeyZ' || e.code === 'KeyJ') {
        triggerPassOrSwitch();
      } else if (e.code === 'Space' || e.code === 'KeyX' || e.code === 'KeyK') {
        if (!eng.isChargingSlap) {
          eng.isChargingSlap = true;
          eng.slapCharge = 0;
        }
      } else if (e.code === 'KeyC' || e.code === 'KeyL') {
        triggerDefenseAction('BODY_CHECK');
      } else if (e.code === 'KeyV' || e.code === 'KeyU') {
        triggerDefenseAction('POKE');
      } else if (e.code === 'KeyP') {
        eng.isPaused = !eng.isPaused;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      eng.keys[e.code] = false;

      if (e.code === 'Space' || e.code === 'KeyX' || e.code === 'KeyK') {
        if (eng.isChargingSlap) {
          releaseShot(eng.slapCharge);
          eng.isChargingSlap = false;
          eng.slapCharge = 0;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [triggerPassOrSwitch, releaseShot, triggerDefenseAction]);

  // Brawl countdown interval
  useEffect(() => {
    if (!brawl.active) return;
    const id = window.setInterval(() => {
      setBrawl((prev) => {
        if (!prev.active) return prev;
        if (prev.timer <= 1) {
          engineRef.current.brawlActive = false;
          return { ...prev, active: false };
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [brawl.active]);

  // Main Locked 60 FPS (16.6ms fixed timestep) Physics & Render Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let accumulator = 0;
    const FIXED_DT = 1000 / 60; // 16.666ms locked physics tick
    let hudSyncCounter = 0;

    const updatePhysicsTick = () => {
      const eng = engineRef.current;
      if (eng.isPaused || eng.isGameOver || eng.brawlActive) return;

      // Intermission Zamboni Resurfacer animation
      if (eng.zamboni.active) {
        eng.zamboni.x += eng.zamboni.dir * 6.5;
        if (eng.zamboni.x > ICE_RIGHT - 80) {
          eng.zamboni.dir = -1;
          eng.zamboni.y = 330;
        } else if (eng.zamboni.x < ICE_LEFT + 80 && eng.zamboni.dir === -1) {
          eng.zamboni.active = false;
          setupPositions(eng.period % 2 === 0 ? 'AWAY' : 'HOME');
        }
        return;
      }

      // Decrement Goal Flash & Net Spring Cloth Physics
      if (eng.goalFlash > 0) eng.goalFlash--;
      eng.leftNet.updatePhysics();
      eng.rightNet.updatePhysics();
      if (eng.tuxedoPenguinRef.timer > 0) eng.tuxedoPenguinRef.timer--;
      if (eng.puck.passTimer > 0) eng.puck.passTimer--;

      // Faceoff countdown
      if (eng.faceoffCountdown > 0) {
        eng.faceoffCountdown--;
        return;
      }

      // Match Clock & Penalty Box Timers
      eng.clockFrames--;
      if (eng.clockFrames % 60 === 0 && eng.penalties.length > 0) {
        eng.penalties = eng.penalties
          .map((p) => ({ ...p, timeRemaining: p.timeRemaining - 1 }))
          .filter((p) => p.timeRemaining > 0);
      }

      if (eng.clockFrames <= 0) {
        const maxPeriods = mode === 'SHOOTOUT' || mode === 'POND_3V3' ? 1 : 3;
        if (eng.period < maxPeriods) {
          eng.period += 1;
          eng.clockFrames = 120 * 60;
          retroAudio.playWhistle();
          // Run Zamboni resurfacer between periods
          eng.zamboni = { active: true, x: ICE_LEFT + 90, y: 190, dir: 1 };
          eng.tuxedoPenguinRef.message = `PERIOD ${eng.period} — ZAMBONI RESURFACING ICE!`;
          eng.tuxedoPenguinRef.timer = 150;
          return;
        } else {
          eng.isGameOver = true;
          retroAudio.playWhistle();
          onMatchComplete({
            homeScore: eng.homeScore,
            awayScore: eng.awayScore,
            homeShots: eng.homeShots,
            awayShots: eng.awayShots,
            homeHits: eng.homeHits,
            awayHits: eng.awayHits,
          });
          return;
        }
      }

      // Slap Shot Charge Meter
      if (eng.isChargingSlap) {
        eng.slapCharge = Math.min(45, eng.slapCharge + 1);
      }

      // Update Skaters (Inertia & Skating Momentum)
      for (const s of eng.skaters) {
        if (s.stunTimer > 0) s.stunTimer--;
        if (s.checkCooldown > 0) s.checkCooldown--;

        const isControlled = s.id === eng.controlledId;
        const diffMultiplier =
          difficulty === 'EASY'
            ? { botSpeed: 0.72, botAccel: 0.65, botShotChance: 0.018, botCheckChance: 0.22, goalieReflex: 0.75 }
            : difficulty === 'LEGEND'
            ? { botSpeed: 1.25, botAccel: 1.30, botShotChance: 0.075, botCheckChance: 0.78, goalieReflex: 1.35 }
            : { botSpeed: 1.0, botAccel: 1.0, botShotChance: 0.035, botCheckChance: 0.45, goalieReflex: 1.0 };

        const maxSpeed =
          s.role === 'G'
            ? 3.2 * (s.team === 'AWAY' ? diffMultiplier.goalieReflex : 1.0)
            : (4.1 + (s.card.skt - 70) * 0.035 + (s.team === 'HOME' && eng.momentumBonusHome > 0 ? 0.45 : 0)) *
              (s.team === 'AWAY' ? diffMultiplier.botSpeed : 1.0);
        const accel =
          (s.role === 'G' ? 0.35 : 0.26 + (s.card.skt - 70) * 0.0025) *
          (s.team === 'AWAY' ? diffMultiplier.botAccel : 1.0);

        let ax = 0;
        let ay = 0;

        if (s.stunTimer === 0) {
          if (isControlled && !autoMode) {
            if (eng.keys['ArrowLeft'] || eng.keys['KeyA']) ax -= 1;
            if (eng.keys['ArrowRight'] || eng.keys['KeyD']) ax += 1;
            if (eng.keys['ArrowUp'] || eng.keys['KeyW']) ay -= 1;
            if (eng.keys['ArrowDown'] || eng.keys['KeyS']) ay += 1;

            if (ax !== 0 || ay !== 0) {
              const len = Math.hypot(ax, ay);
              ax /= len;
              ay /= len;

              // Detect hard stop / rapid cut for crisp snow spray!
              const dot = ax * s.vx + ay * s.vy;
              if (dot < -1.8 && Math.random() < 0.35) {
                spawnSnowSpray(s.x, s.y + 10, -s.vx, -s.vy, 5);
                retroAudio.playSkateCarve(0.35);
              }

              s.vx += ax * accel;
              s.vy += ay * accel;
              s.angle = Math.atan2(s.vy, s.vx);
              s.animFrame += 0.25;
            }
          } else if (isControlled && autoMode) {
            // AUTO PLAY MODE: Autonomous AI guidance for player-controlled skater
            const hasPuck = eng.puck.ownerId === s.id;
            if (hasPuck) {
              // Skate aggressively into shooting slot towards opponent net (Right)
              const tx = GOAL_RIGHT_X - 110;
              const ty = GOAL_Y_CENTER + Math.sin(eng.clockFrames * 0.06) * 45;
              const dx = tx - s.x;
              const dy = ty - s.y;
              const d = Math.hypot(dx, dy);
              if (d > 10) {
                s.vx += (dx / d) * (accel * 0.95);
                s.vy += (dy / d) * (accel * 0.95);
                s.angle = Math.atan2(s.vy, s.vx);
                s.animFrame += 0.25;
              }
              // Auto shoot when in the attacking zone!
              if (s.x > 620 && Math.random() < 0.042) {
                releaseShot(Math.random() > 0.4 ? 28 : 10, false);
              } else if (s.x > 500 && Math.random() < 0.02) {
                triggerPassOrSwitch();
              }
            } else {
              // Hunt loose puck or forecheck puck carrier
              const dx = eng.puck.x - s.x;
              const dy = eng.puck.y - s.y;
              const d = Math.hypot(dx, dy);
              if (d > 8) {
                s.vx += (dx / d) * (accel * 0.92);
                s.vy += (dy / d) * (accel * 0.92);
                s.angle = Math.atan2(s.vy, s.vx);
                s.animFrame += 0.25;
              }
              if (d < 30 && s.checkCooldown === 0 && eng.puck.ownerId && eng.puck.ownerId.startsWith('AWAY_')) {
                triggerDefenseAction(Math.random() > 0.5 ? 'BODY_CHECK' : 'POKE');
              }
            }
          } else if (s.role === 'G') {
            // Brick Wall Goalie AI: fast cross-crease butterfly tracking
            const goalX = s.team === 'HOME' ? GOAL_LEFT_X + 14 : GOAL_RIGHT_X - 14;
            const targetY = Math.max(
              GOAL_Y_CENTER - GOAL_HALF_W + 6,
              Math.min(GOAL_Y_CENTER + GOAL_HALF_W - 6, eng.puck.y)
            );
            const reflexSpeed = (0.09 + (s.card.def - 70) * 0.0025) * (s.team === 'AWAY' ? diffMultiplier.goalieReflex : 1.0);
            s.x += (goalX - s.x) * 0.2;
            s.y += (targetY - s.y) * reflexSpeed;
          } else {
            // Field AI Skaters (Teammates & Opponents)
            const hasPuck = eng.puck.ownerId === s.id;
            if (s.team === 'HOME') {
              // Supportive offensive/defensive positioning
              let tx = eng.puck.x - 40;
              let ty = s.role === 'LW' || s.role === 'LD' ? 160 : 360;
              if (s.role === 'C') ty = 260;
              if (s.role === 'LD' || s.role === 'RD') tx = Math.min(520, eng.puck.x - 140);
              else tx = Math.min(GOAL_RIGHT_X - 65, eng.puck.x + 85);

              const dx = tx - s.x;
              const dy = ty - s.y;
              const d = Math.hypot(dx, dy);
              if (d > 18) {
                s.vx += (dx / d) * (accel * 0.75);
                s.vy += (dy / d) * (accel * 0.75);
                s.angle = Math.atan2(s.vy, s.vx);
                s.animFrame += 0.2;
              }
            } else {
              // Away Bot AI
              if (hasPuck) {
                // Skate toward Home Net (Left) and shoot when in slot!
                const tx = GOAL_LEFT_X + (difficulty === 'LEGEND' ? 65 : 95);
                const ty = GOAL_Y_CENTER + Math.sin(eng.clockFrames * 0.05) * 45;
                const dx = tx - s.x;
                const dy = ty - s.y;
                const d = Math.hypot(dx, dy);
                if (d > 10) {
                  s.vx += (dx / d) * (accel * 0.88);
                  s.vy += (dy / d) * (accel * 0.88);
                  s.angle = Math.atan2(s.vy, s.vx);
                  s.animFrame += 0.22;
                }
                if (s.x < 360 && Math.random() < diffMultiplier.botShotChance) {
                  const shotAngle = Math.atan2(
                    GOAL_Y_CENTER + (Math.random() - 0.5) * (difficulty === 'LEGEND' ? 40 : 56) - s.y,
                    GOAL_LEFT_X - s.x
                  );
                  const spd = 11.5 + (s.card.sht - 70) * 0.07 + (difficulty === 'LEGEND' ? 2.5 : difficulty === 'EASY' ? -2.0 : 0);
                  eng.puck.ownerId = null;
                  eng.puck.vx = Math.cos(shotAngle) * spd;
                  eng.puck.vy = Math.sin(shotAngle) * spd;
                  eng.awayShots += 1;
                  retroAudio.playPuckStick(0.75);
                }
              } else {
                // Forecheck puck carrier or hold defensive slot
                const awayField = eng.skaters.filter((k) => k.team === 'AWAY' && k.role !== 'G');
                let closestToPuck = awayField[0];
                let bestD = Infinity;
                for (const k of awayField) {
                  const distP = Math.hypot(k.x - eng.puck.x, k.y - eng.puck.y);
                  if (distP < bestD) {
                    bestD = distP;
                    closestToPuck = k;
                  }
                }

                let tx = eng.puck.x;
                let ty = eng.puck.y;
                if (closestToPuck && closestToPuck.id !== s.id) {
                  tx = Math.max(GOAL_LEFT_X + 180, Math.min(GOAL_RIGHT_X - 90, eng.puck.x + 110));
                  ty = s.role === 'LW' || s.role === 'LD' ? 175 : 345;
                }

                const dx = tx - s.x;
                const dy = ty - s.y;
                const d = Math.hypot(dx, dy);
                if (d > 12) {
                  s.vx += (dx / d) * (accel * 0.8);
                  s.vy += (dy / d) * (accel * 0.8);
                  s.angle = Math.atan2(s.vy, s.vx);
                  s.animFrame += 0.2;
                }

                // Bot body check or poke check if close to Home puck carrier
                if (eng.puck.ownerId && eng.puck.ownerId.startsWith('HOME_') && d < 34 && s.checkCooldown === 0) {
                  s.checkCooldown = difficulty === 'LEGEND' ? 28 : difficulty === 'EASY' ? 65 : 45;
                  if (Math.random() < diffMultiplier.botCheckChance) {
                    const carrier = eng.skaters.find((k) => k.id === eng.puck.ownerId);
                    if (carrier) {
                      carrier.stunTimer = difficulty === 'LEGEND' ? 45 : 30;
                      eng.puck.ownerId = s.id;
                      eng.awayHits += 1;
                      retroAudio.playBoardSmash(false);
                      spawnSnowSpray(carrier.x, carrier.y, carrier.vx, carrier.vy, 8);
                    }
                  }
                }
              }
            }
          }
        }

        // Authentic Low-Friction Ice Glide
        s.vx *= 0.965;
        s.vy *= 0.965;

        const spd = Math.hypot(s.vx, s.vy);
        if (spd > maxSpeed) {
          s.vx = (s.vx / spd) * maxSpeed;
          s.vy = (s.vy / spd) * maxSpeed;
        }

        s.x += s.vx;
        s.y += s.vy;

        // Keep Skaters inside Perimeter Boards
        if (s.x < ICE_LEFT + 16) {
          s.x = ICE_LEFT + 16;
          s.vx *= -0.5;
        }
        if (s.x > ICE_RIGHT - 16) {
          s.x = ICE_RIGHT - 16;
          s.vx *= -0.5;
        }
        if (s.y < ICE_TOP + 16) {
          s.y = ICE_TOP + 16;
          s.vy *= -0.5;
        }
        if (s.y > ICE_BOTTOM - 16) {
          s.y = ICE_BOTTOM - 16;
          s.vy *= -0.5;
        }
      }

      // Puck Physics & Active Board Play
      const puck = eng.puck;
      if (puck.ownerId) {
        const owner = eng.skaters.find((s) => s.id === puck.ownerId);
        if (owner) {
          const stickOffset = 16;
          puck.x = owner.x + Math.cos(owner.angle) * stickOffset;
          puck.y = owner.y + Math.sin(owner.angle) * stickOffset;
          puck.vx = owner.vx;
          puck.vy = owner.vy;
        } else {
          puck.ownerId = null;
        }
      } else {
        puck.x += puck.vx;
        puck.y += puck.vy;
        puck.vx *= 0.991;
        puck.vy *= 0.991;

        // Check Goal Scored or Post Ping using GoalNetObject methods!
        // 1. Right Goal (Away Net - Target for Home team!)
        const rightPostHit = eng.rightNet.checkPostCollision(puck.x, puck.y);
        if (rightPostHit.hit) {
          puck.vx *= -0.85;
          puck.vy += (Math.random() - 0.5) * 4;
          retroAudio.playPostPing();
          spawnSnowSpray(puck.x, puck.y, -puck.vx, puck.vy, 6, '#dc2626');
        } else if (eng.rightNet.isPuckInside(puck.x, puck.y) && puck.vx > 0) {
          // GOAL SCORED BY HOME!
          eng.homeScore += 1;
          eng.goalFlash = 110;
          eng.rightNet.applyImpulse(24); // Dynamic spring cloth net bulge on net object!
          retroAudio.playGoalHorn();
          eng.tuxedoPenguinRef.message = `GOAL! ${homeTeamName.toUpperCase()} SCORES!`;
          eng.tuxedoPenguinRef.timer = 110;

          if (mode === 'SHOOTOUT') {
            eng.shootoutTurn = 'AWAY';
          }
          setupPositions('AWAY');
          return;
        }

        // 2. Left Goal (Home Net - Target for Away team!)
        const leftPostHit = eng.leftNet.checkPostCollision(puck.x, puck.y);
        if (leftPostHit.hit) {
          puck.vx *= -0.85;
          puck.vy += (Math.random() - 0.5) * 4;
          retroAudio.playPostPing();
          spawnSnowSpray(puck.x, puck.y, -puck.vx, puck.vy, 6, '#dc2626');
        } else if (eng.leftNet.isPuckInside(puck.x, puck.y) && puck.vx < 0) {
          // GOAL SCORED BY AWAY!
          eng.awayScore += 1;
          eng.goalFlash = 110;
          eng.leftNet.applyImpulse(24); // Dynamic spring cloth net bulge on net object!
          retroAudio.playGoalHorn();
          eng.tuxedoPenguinRef.message = `GOAL! ${awayTeamName.toUpperCase()} SCORES!`;
          eng.tuxedoPenguinRef.timer = 110;

          if (mode === 'SHOOTOUT') {
            eng.shootoutTurn = 'HOME';
            eng.shootoutRound += 1;
          }
          setupPositions('HOME');
          return;
        }

        // Active Board & Rounded Plexiglass Corner Rebounds
        if (puck.y < ICE_TOP + 6) {
          puck.y = ICE_TOP + 6;
          puck.vy *= -0.86;
          retroAudio.playPuckStick(0.35);
        }
        if (puck.y > ICE_BOTTOM - 6) {
          puck.y = ICE_BOTTOM - 6;
          puck.vy *= -0.86;
          retroAudio.playPuckStick(0.35);
        }
        if (puck.x < ICE_LEFT + 6) {
          if (Math.hypot(puck.vx, puck.vy) > 13.5) {
            eng.shatteredGlass = 'LEFT';
            retroAudio.playBoardSmash(true);
            eng.tuxedoPenguinRef.message = '100+ MPH BLAST SHATTERS THE PLEXIGLASS!';
            eng.tuxedoPenguinRef.timer = 95;
          } else {
            retroAudio.playPuckStick(0.4);
          }
          puck.x = ICE_LEFT + 6;
          puck.vx *= -0.84;
        }
        if (puck.x > ICE_RIGHT - 6) {
          if (Math.hypot(puck.vx, puck.vy) > 13.5) {
            eng.shatteredGlass = 'RIGHT';
            retroAudio.playBoardSmash(true);
            eng.tuxedoPenguinRef.message = '100+ MPH BLAST SHATTERS THE PLEXIGLASS!';
            eng.tuxedoPenguinRef.timer = 95;
          } else {
            retroAudio.playPuckStick(0.4);
          }
          puck.x = ICE_RIGHT - 6;
          puck.vx *= -0.84;
        }

        // Rounded Corner Banking Physics (45-degree deflection for dump-and-chase!)
        const corners = [
          { cx: ICE_LEFT + CORNER_R, cy: ICE_TOP + CORNER_R, sx: -1, sy: -1 },
          { cx: ICE_RIGHT - CORNER_R, cy: ICE_TOP + CORNER_R, sx: 1, sy: -1 },
          { cx: ICE_LEFT + CORNER_R, cy: ICE_BOTTOM - CORNER_R, sx: -1, sy: 1 },
          { cx: ICE_RIGHT - CORNER_R, cy: ICE_BOTTOM - CORNER_R, sx: 1, sy: 1 },
        ];
        for (const c of corners) {
          if ((puck.x - c.cx) * c.sx > 0 && (puck.y - c.cy) * c.sy > 0) {
            const dx = puck.x - c.cx;
            const dy = puck.y - c.cy;
            const dist = Math.hypot(dx, dy);
            if (dist > CORNER_R - 6) {
              const nx = dx / dist;
              const ny = dy / dist;
              puck.x = c.cx + nx * (CORNER_R - 6);
              puck.y = c.cy + ny * (CORNER_R - 6);
              const dot = puck.vx * nx + puck.vy * ny;
              puck.vx = (puck.vx - 2 * dot * nx) * 0.88;
              puck.vy = (puck.vy - 2 * dot * ny) * 0.88;
            }
          }
        }

        // Puck Pickup or Goalie Save Check
        for (const s of eng.skaters) {
          if (s.stunTimer > 0) continue;
          const d = Math.hypot(s.x - puck.x, s.y - puck.y);
          if (s.role === 'G') {
            const saveReach = 22 + (s.card.def - 70) * 0.16;
            if (d < saveReach) {
              // Goalie Butterfly / Glove Save!
              const puckSpeed = Math.hypot(puck.vx, puck.vy);
              puck.vx = (s.team === 'HOME' ? 1 : -1) * Math.max(4.5, puckSpeed * 0.55);
              puck.vy = (Math.random() - 0.5) * 6.5;
              retroAudio.playGoalieSave(puckSpeed > 10.5);
              eng.tuxedoPenguinRef.message = `GREAT SAVE BY ${s.card.name.toUpperCase()}!`;
              eng.tuxedoPenguinRef.timer = 55;
              break;
            }
          } else if (d < 20) {
            // Skater picks up loose puck
            // If Home player is holding shoot button during a pass -> Instant One-Timer!
            if (s.team === 'HOME' && eng.puck.passTimer > 0 && eng.isChargingSlap) {
              eng.controlledId = s.id;
              puck.ownerId = s.id;
              releaseShot(30, true);
              eng.isChargingSlap = false;
              eng.slapCharge = 0;
              break;
            }

            puck.ownerId = s.id;
            if (s.team === 'HOME') {
              eng.controlledId = s.id;
            }
            retroAudio.playPuckStick(0.3);
            break;
          }
        }
      }

      // Update Snow Spray Particle Pool
      for (const p of eng.particles) {
        if (!p.active) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.life++;
        if (p.life >= p.maxLife) {
          p.active = false;
        }
      }
    };

    const renderFrame = () => {
      const canvas = canvasRef.current;
      const staticBuf = staticRinkBufferRef.current;
      if (!canvas || !staticBuf) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const eng = engineRef.current;

      // 1. Blit pre-rendered static rink buffer (Zero Overdraw!)
      ctx.drawImage(staticBuf, 0, 0);

      // 2. Flashing Red Goal Lights on Score
      if (eng.goalFlash > 0 && Math.floor(eng.goalFlash / 6) % 2 === 0) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.fillRect(ICE_LEFT, ICE_TOP, ICE_RIGHT - ICE_LEFT, ICE_BOTTOM - ICE_TOP);
      }

      // 3. Draw Dynamic Goal Net Objects (Left Net & Right Net)
      const renderGoalNetObject = (net: GoalNetObject) => {
        const isLeft = net.id === 'NET_LEFT';
        const gx = net.goalLineX;
        const backX = isLeft ? gx - net.depth - net.springBulge : gx + net.depth + net.springBulge;
        const topY = net.centerY - net.halfWidth;
        const botY = net.centerY + net.halfWidth;

        // Realistic Net Cord & Twine Mesh with dynamic bulge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gx, topY);
        ctx.quadraticCurveTo(backX, net.centerY, gx, botY);
        ctx.lineTo(isLeft ? gx - 18 : gx + 18, botY - 5);
        ctx.quadraticCurveTo(backX, net.centerY, isLeft ? gx - 18 : gx + 18, topY + 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 16-Bit Net Twine Cross-Hatching Pattern
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.lineWidth = 1;
        for (let ny = topY + 8; ny < botY; ny += 10) {
          ctx.beginPath();
          ctx.moveTo(gx, ny);
          const midX = isLeft ? gx - 16 - net.springBulge * 0.7 : gx + 16 + net.springBulge * 0.7;
          ctx.lineTo(midX, ny);
          ctx.stroke();
        }

        // Red Steel Goalposts and Crossbar
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(gx, topY);
        ctx.lineTo(isLeft ? gx - 18 : gx + 18, topY + 5);
        ctx.lineTo(isLeft ? gx - 18 : gx + 18, botY - 5);
        ctx.lineTo(gx, botY);
        ctx.stroke();

        // White Padding Base Pipe
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(gx, topY);
        ctx.lineTo(gx, botY);
        ctx.stroke();
      };

      renderGoalNetObject(eng.leftNet);
      renderGoalNetObject(eng.rightNet);

      // 4. Shattered Plexiglass visual indicator if blasted by a 100+ mph Slap Shot
      if (eng.shatteredGlass === 'RIGHT') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          ctx.strokeRect(ICE_RIGHT - 6, 210 + i * 12, 8, 6);
        }
      } else if (eng.shatteredGlass === 'LEFT') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          ctx.strokeRect(ICE_LEFT - 2, 210 + i * 12, 8, 6);
        }
      }

      // 5. Draw Snow Spray Particles
      for (const p of eng.particles) {
        if (!p.active) continue;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }

      // 6. Draw 16-Bit Pixel Skaters (with subtle ice reflection)
      for (const s of eng.skaters) {
        const isControlled = s.id === eng.controlledId;
        const primary = s.team === 'HOME' ? homePrimaryColor : awayPrimaryColor;
        const secondary = s.team === 'HOME' ? homeSecondaryColor : awaySecondaryColor;

        const sx = Math.round(s.x);
        const sy = Math.round(s.y);

        // Subtle pixel ice reflection underneath skater
        ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 12, 11, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Controlled player star ring + One-Timer indicator
        if (isControlled) {
          ctx.strokeStyle = eng.puck.passTimer > 0 ? '#facc15' : '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(sx, sy + 4, 16, 0, Math.PI * 2);
          ctx.stroke();

          // Slap Shot Charge Bar above skater
          if (eng.isChargingSlap && eng.slapCharge > 2) {
            const pct = Math.min(1, eng.slapCharge / 40);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(sx - 16, sy - 26, 32, 5);
            ctx.fillStyle = pct > 0.75 ? '#ef4444' : '#facc15';
            ctx.fillRect(sx - 15, sy - 25, Math.round(30 * pct), 3);
          }
        }

        // Skate blades
        const stride = Math.sin(s.animFrame) * 3;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(sx - 6, sy + 8 + stride, 4, 4);
        ctx.fillRect(sx + 2, sy + 8 - stride, 4, 4);

        // Padded breezers (shorts)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(sx - 7, sy + 2, 14, 6);

        // Retro Team Sweater (Jersey) & Stripes
        ctx.fillStyle = primary;
        ctx.fillRect(sx - 8, sy - 8, 16, 11);
        ctx.fillStyle = secondary;
        ctx.fillRect(sx - 8, sy - 3, 16, 3);

        // Goalie Leg Pads & Blocker if Goalie
        if (s.role === 'G') {
          ctx.fillStyle = secondary;
          ctx.fillRect(sx - 9, sy + 2, 6, 10);
          ctx.fillRect(sx + 3, sy + 2, 6, 10);
        }

        // Helmet & Visor
        ctx.fillStyle = primary;
        ctx.fillRect(sx - 5, sy - 15, 10, 7);
        ctx.fillStyle = '#fde68a'; // Face
        ctx.fillRect(sx - 3, sy - 12, 6, 4);

        // Curved Hockey Stick
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx + 4, sy - 2);
        const stickX = sx + Math.cos(s.angle) * 16;
        const stickY = sy + Math.sin(s.angle) * 16;
        ctx.lineTo(stickX, stickY);
        ctx.stroke();

        // Stunned stars if body checked into the boards
        if (s.stunTimer > 0) {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(sx - 6, sy - 21, 3, 3);
          ctx.fillRect(sx + 3, sy - 21, 3, 3);
        }
      }

      // 7. Draw The Puck (with high-contrast shadow & one-timer glow)
      const px = Math.round(eng.puck.x);
      const py = Math.round(eng.puck.y);
      if (eng.puck.passTimer > 0) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 8. Tuxedo Penguin Referee Mascot Cameo (Dropping Faceoffs & Calling Plays)
      if (eng.faceoffCountdown > 0) {
        const rx = 500;
        const ry = 205;
        // Black & White Referee Stripes
        ctx.fillStyle = '#09090b';
        ctx.fillRect(rx - 7, ry - 14, 14, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rx - 5, ry - 8, 2, 10);
        ctx.fillRect(rx - 1, ry - 8, 2, 10);
        ctx.fillRect(rx + 3, ry - 8, 2, 10);
        // Orange Penguin Beak & Feet
        ctx.fillStyle = '#f97316';
        ctx.fillRect(rx - 3, ry - 11, 6, 3);
        ctx.fillRect(rx - 6, ry + 4, 4, 3);
        ctx.fillRect(rx + 2, ry + 4, 4, 3);
      }

      // 9. Zamboni Ice Resurfacer during Intermission
      if (eng.zamboni.active) {
        const zx = Math.round(eng.zamboni.x);
        const zy = Math.round(eng.zamboni.y);
        // Wet freshly resurfaced ice trail
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(ICE_LEFT + 40, zy - 22, zx - ICE_LEFT, 44);
        // Zamboni body
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(zx - 32, zy - 18, 64, 36);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(zx - 28, zy - 6, 56, 8);
        ctx.fillStyle = '#09090b';
        ctx.fillRect(zx - 24, zy + 16, 14, 6);
        ctx.fillRect(zx + 10, zy + 16, 14, 6);
      }
    };

    const loop = (now: number) => {
      const delta = Math.min(100, now - lastTime);
      lastTime = now;
      accumulator += delta;

      while (accumulator >= FIXED_DT) {
        updatePhysicsTick();
        accumulator -= FIXED_DT;
      }

      renderFrame();

      // Sync React HUD every 12 frames (~5 times/sec) for zero React overhead
      hudSyncCounter++;
      if (hudSyncCounter >= 12) {
        hudSyncCounter = 0;
        const eng = engineRef.current;
        const controlled = eng.skaters.find((s) => s.id === eng.controlledId);
        setHudState({
          period: eng.period,
          clockSeconds: Math.max(0, Math.ceil(eng.clockFrames / 60)),
          homeScore: eng.homeScore,
          awayScore: eng.awayScore,
          homeShots: eng.homeShots,
          awayShots: eng.awayShots,
          homeHits: eng.homeHits,
          awayHits: eng.awayHits,
          controlledName: controlled?.card.name || '',
          controlledPos: controlled?.card.pos || 'C',
          announcementBanner:
            eng.tuxedoPenguinRef.timer > 0
              ? eng.tuxedoPenguinRef.message
              : eng.puck.passTimer > 0
              ? 'PASS ACROSS THE CREASE — TAP SHOOT FOR ONE-TIMER!'
              : `${venue.name.toUpperCase()} · 60 FPS LOCKED`,
          isPaused: eng.isPaused,
          isGameOver: eng.isGameOver,
          isIntermissionZamboni: eng.zamboni.active,
          goalFlashTimer: eng.goalFlash,
          shatteredGlassSide: eng.shatteredGlass,
          penalties: [...eng.penalties],
          shootoutRound: eng.shootoutRound,
          shootoutTurn: eng.shootoutTurn,
          momentumHome: Math.min(100, Math.max(0, 50 + eng.momentumBonusHome)),
        });
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    homeTeamName,
    awayTeamName,
    homePrimaryColor,
    homeSecondaryColor,
    awayPrimaryColor,
    awaySecondaryColor,
    mode,
    venue.name,
    setupPositions,
    releaseShot,
    onMatchComplete,
  ]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[1200px] mx-auto px-4 py-3 select-none">
      {/* Unobtrusive 16-Bit Broadcast Scoreboard HUD */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3 flex flex-wrap items-center justify-between gap-4">
        {/* Home Team */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-extrabold text-lg border border-white/20 shrink-0"
            style={{ backgroundColor: homePrimaryColor, color: homeSecondaryColor }}
          >
            {homeTeamName.slice(0, 3).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wide uppercase font-display">
              {homeTeamName}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              SOG: {hudState.homeShots} · HITS: {hudState.homeHits}
            </div>
          </div>
          <div className="text-4xl font-extrabold font-mono text-amber-400 tabular-nums ml-2">
            {hudState.homeScore}
          </div>
        </div>

        {/* Period & Game Clock + Tuxedo Penguin Live Call */}
        <div className="flex flex-col items-center text-center px-4 py-1 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase text-amber-400">
              {mode === 'SHOOTOUT'
                ? `SHOOTOUT RD ${hudState.shootoutRound}`
                : mode === 'POND_3V3'
                ? '3V3 POND ARCADE'
                : `PERIOD ${hudState.period}`}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {formatTime(hudState.clockSeconds)}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span
              className={`text-[10px] font-pixel px-1.5 py-0.5 rounded ${
                difficulty === 'LEGEND'
                  ? 'bg-rose-950 text-rose-300 border border-rose-500/50'
                  : difficulty === 'PRO'
                  ? 'bg-amber-950 text-amber-300 border border-amber-500/50'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
              }`}
            >
              {difficulty}
            </span>
          </div>
          <div className="text-[11px] font-mono text-sky-300 mt-0.5 truncate max-w-[320px]">
            {hudState.announcementBanner}
          </div>
        </div>

        {/* Away Team */}
        <div className="flex items-center justify-end gap-3 min-w-[200px]">
          <div className="text-4xl font-extrabold font-mono text-white tabular-nums mr-2">
            {hudState.awayScore}
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-white tracking-wide uppercase font-display">
              {awayTeamName}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              SOG: {hudState.awayShots} · HITS: {hudState.awayHits}
            </div>
          </div>
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-extrabold text-lg border border-white/20 shrink-0"
            style={{ backgroundColor: awayPrimaryColor, color: awaySecondaryColor }}
          >
            {awayTeamName.slice(0, 3).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Penalty Box / Power Play Strip (if active) */}
      {hudState.penalties.length > 0 && (
        <div className="w-full bg-rose-950/60 border border-rose-500/40 rounded-lg px-4 py-1.5 mb-2 flex items-center justify-between text-xs font-mono text-rose-200">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>PENALTY KILL (4v5):</span>
            {hudState.penalties.map((p, i) => (
              <span key={i}>
                {p.playerName} · {p.infraction} ({p.timeRemaining}s)
              </span>
            ))}
          </div>
          <span className="text-amber-300">PENALTY BOX ACTIVE</span>
        </div>
      )}

      {/* Main 16-Bit Ice Canvas Container */}
      <div className="relative w-full aspect-[1000/520] max-h-[540px] rounded-xl overflow-hidden border-2 border-slate-800 shadow-2xl bg-slate-950">
        <canvas
          ref={canvasRef}
          width={RINK_W}
          height={RINK_H}
          className="w-full h-full object-contain pixelated"
        />

        {/* Optional 10-Second Retro Glove Drop Mini-Brawl Overlay */}
        {brawl.active && (
          <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center p-6 z-20">
            <div className="bg-slate-900 border-2 border-amber-400 rounded-xl p-6 max-w-md w-full text-center">
              <div className="text-xs font-mono text-amber-400 uppercase tracking-widest">
                SUDDEN SHOWDOWN · {brawl.timer}S REMAINING
              </div>
              <h3 className="text-2xl font-extrabold font-display text-white mt-1">
                RETRO GLOVE DROP!
              </h3>
              <p className="text-xs text-slate-300 mt-1">{brawl.lastAction}</p>

              <div className="grid grid-cols-2 gap-4 my-4 text-left">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-xs font-bold text-sky-400 truncate">{brawl.homeFighter}</div>
                  <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                    HP: {brawl.homeHp}/100
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded mt-1 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 transition-transform duration-150 origin-left"
                      style={{ transform: `scaleX(${brawl.homeHp / 100})` }}
                    />
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-xs font-bold text-rose-400 truncate">{brawl.awayFighter}</div>
                  <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                    HP: {brawl.awayHp}/100
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded mt-1 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 transition-transform duration-150 origin-left"
                      style={{ transform: `scaleX(${brawl.awayHp / 100})` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleBrawlMove('JAB')}
                  className="py-2 px-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Quick Jab
                </button>
                <button
                  type="button"
                  onClick={() => handleBrawlMove('HOOK')}
                  className="py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Heavy Hook
                </button>
                <button
                  type="button"
                  onClick={() => handleBrawlMove('DODGE')}
                  className="py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Dodge & Grab
                </button>
              </div>
            </div>
          </div>
        )}

        {/* End of Match Summary Modal */}
        {hudState.isGameOver && (
          <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center p-6 z-30">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full text-center">
              <Award className="w-10 h-10 text-amber-400 mx-auto mb-2" />
              <div className="text-xs font-mono text-amber-400 uppercase">FINAL HORN</div>
              <h3 className="text-3xl font-extrabold font-display text-white mt-1">
                {hudState.homeScore > hudState.awayScore
                  ? `${homeTeamName} Victory!`
                  : hudState.homeScore < hudState.awayScore
                  ? `${awayTeamName} Wins`
                  : 'Overtime Draw!'}
              </h3>
              <div className="text-2xl font-mono font-bold text-slate-200 my-3 tabular-nums">
                {hudState.homeScore} — {hudState.awayScore}
              </div>
              <div className="text-xs font-mono text-slate-400 mb-5 tabular-nums">
                Shots: {hudState.homeShots} to {hudState.awayShots} · Body Checks:{' '}
                {hudState.homeHits} to {hudState.awayHits}
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const eng = engineRef.current;
                    eng.homeScore = 0;
                    eng.awayScore = 0;
                    eng.homeShots = 0;
                    eng.awayShots = 0;
                    eng.homeHits = 0;
                    eng.awayHits = 0;
                    eng.period = 1;
                    eng.clockFrames = (mode === 'SHOOTOUT' ? 60 : 120) * 60;
                    eng.isGameOver = false;
                    setupPositions('HOME');
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Return to Hub
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Arcade Control Deck & Keybindings Bar */}
      <div className="w-full mt-3 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <span className="font-mono text-amber-400 font-semibold">
            SKATER: {hudState.controlledName} ({hudState.controlledPos})
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="hidden md:inline text-slate-400">
            Move: <strong className="text-slate-200">WASD / Arrows</strong> · Pass/Switch:{' '}
            <strong className="text-slate-200">Z / J</strong> · Wrist/Slap/One-Timer:{' '}
            <strong className="text-slate-200">Space / X (Hold)</strong> · Body Check:{' '}
            <strong className="text-slate-200">C</strong> · Poke Check:{' '}
            <strong className="text-slate-200">V</strong>
          </span>
        </div>

        {/* Direct Click/Touch Arcade Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onToggleAutoMode && (
            <button
              type="button"
              onClick={onToggleAutoMode}
              className={`px-3 py-1.5 border rounded-lg text-xs font-mono font-bold cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1 ${
                autoMode
                  ? 'bg-purple-600 border-purple-400 text-white animate-pulse shadow-md'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Toggle Auto Play Mode (AI plays both teams autonomously)"
            >
              <span>AUTO: {autoMode ? 'ON' : 'OFF'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={triggerPassOrSwitch}
            disabled={autoMode}
            className={`px-3 py-1.5 border text-xs font-mono font-semibold whitespace-nowrap rounded-lg ${
              autoMode
                ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 text-sky-300 cursor-pointer'
            }`}
          >
            Pass / Switch (Z)
          </button>
          <button
            type="button"
            onClick={() => releaseShot(10, false)}
            disabled={autoMode}
            className={`px-3 py-1.5 border text-xs font-mono font-semibold whitespace-nowrap rounded-lg ${
              autoMode
                ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300 cursor-pointer'
            }`}
          >
            Wrist Shot (X)
          </button>
          <button
            type="button"
            onClick={() => releaseShot(32, true)}
            disabled={autoMode}
            className={`px-3 py-1.5 border text-xs font-mono font-semibold whitespace-nowrap rounded-lg flex items-center gap-1 ${
              autoMode
                ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-300 cursor-pointer'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Slap / 1-Timer
          </button>
          <button
            type="button"
            onClick={() => triggerDefenseAction('BODY_CHECK')}
            disabled={autoMode}
            className={`px-3 py-1.5 border text-xs font-mono font-semibold whitespace-nowrap rounded-lg ${
              autoMode
                ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300 cursor-pointer'
            }`}
          >
            Body Check (C)
          </button>
          <button
            type="button"
            onClick={() => triggerDefenseAction('POKE')}
            disabled={autoMode}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg whitespace-nowrap ${
              autoMode
                ? 'opacity-50 cursor-not-allowed bg-slate-900 text-slate-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
            }`}
          >
            Poke (V)
          </button>
          <button
            type="button"
            onClick={() => {
              retroAudio.playOrganCharge();
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-lg text-xs font-mono cursor-pointer whitespace-nowrap"
            title="Play Stadium Organ Charge Riff"
          >
            Organ Riff
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              retroAudio.soundEnabled = next;
              retroAudio.announcerEnabled = next;
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
            title="Toggle Audio & Announcer"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              engineRef.current.isPaused = !engineRef.current.isPaused;
            }}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
            title="Pause / Resume"
          >
            {hudState.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setupPositions('HOME')}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
            title="Reset Faceoff"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onExit}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            Leave Rink
          </button>
        </div>
      </div>
    </div>
  );
};
