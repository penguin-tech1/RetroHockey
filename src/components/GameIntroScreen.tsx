import React, { useState, useEffect, useRef } from 'react';
import { retroAudio } from '../utils/retroAudio';
import tuxedoPenguinLogo from '../assets/images/tuxedo_penguin_logo_1791762387098.jpg';
import retroBannerImg from '../assets/images/retro_puck_94_banner_1791762371375.jpg';
import { Play, Volume2, Shield, Zap, Sparkles, HelpCircle, X, Award } from 'lucide-react';

interface GameIntroScreenProps {
  onStartGame: (targetMode?: 'LOBBY' | 'POND_3V3' | 'PRO_5V5' | 'DYNASTY' | 'WORLD_CUP') => void;
}

export const GameIntroScreen: React.FC<GameIntroScreenProps> = ({ onStartGame }) => {
  const [phase, setPhase] = useState<'STUDIO' | 'TITLE'>('STUDIO');
  const [blink, setBlink] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const HIGHLIGHTS = [
    '⚡ BLISTERING 100+ MPH SLAP SHOTS & SIGNATURE ONE-TIMERS',
    '💥 CRUSHING HIP CHECKS & PLEXIGLASS-SHATTERING BOARD SMASHES',
    '🏒 AUTHENTIC INERTIA ICE PHYSICS, SNOW SPRAY & ACTIVE BOARDS',
    '🎴 500-PLAYER UNLICENSED FOIL CARD DYNASTY FRANCHISE',
    '🏆 16-NATION WORLD CUP OF HOCKEY GOLDEN TROPHY RUN',
  ];

  // Blinking cursor
  useEffect(() => {
    const blinkInterval = window.setInterval(() => {
      setBlink((prev) => !prev);
    }, 500);
    return () => clearInterval(blinkInterval);
  }, []);

  // Highlights ticker
  useEffect(() => {
    const tickerTimer = window.setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % HIGHLIGHTS.length);
    }, 3200);
    return () => clearInterval(tickerTimer);
  }, [HIGHLIGHTS.length]);

  // Phase transition: Studio splash -> Title screen
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhase('TITLE');
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcut listener (Space, Enter, Z, X to start)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'KeyZ', 'KeyX'].includes(e.code)) {
        e.preventDefault();
        triggerStart('LOBBY');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Canvas particle animation for retro ice rink attract mode
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Snow spray & spotlight particles
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
    }
    const particles: Particle[] = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: Math.random() * 1.8 + 0.5,
      size: Math.random() * 2.5 + 1,
      alpha: Math.random() * 0.7 + 0.3,
    }));

    // Sliding puck animation
    let puckX = -50;
    let puckY = height * 0.75;
    let puckVx = 8;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Subtle ice surface grid lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw drifting snow / ice spray particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
        }
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        ctx.fillStyle = `rgba(224, 242, 254, ${p.alpha})`;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });

      // Draw sliding retro puck with neon blue trail
      puckX += puckVx;
      if (puckX > width + 100) {
        puckX = -60;
        puckY = height * 0.65 + Math.random() * (height * 0.25);
      }

      // Puck trail
      const grad = ctx.createLinearGradient(puckX - 50, puckY, puckX, puckY);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(puckX - 60, puckY - 4, 60, 8);

      // Puck body
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(puckX, puckY, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [phase]);

  const triggerStart = (mode: 'LOBBY' | 'POND_3V3' | 'PRO_5V5' | 'DYNASTY' | 'WORLD_CUP' = 'LOBBY') => {
    retroAudio.playIntroFanfare();
    setAudioUnlocked(true);
    onStartGame(mode);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none overflow-hidden font-pixel">
      {/* Background Animated Canvas (Snow Particles & Sliding Puck) */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Subtle 16-Bit CRT Scanlines */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-35"
        style={{
          background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.45) 50%)',
          backgroundSize: '100% 4px',
        }}
      />

      {/* Top Right Quick Skip Button */}
      <button
        type="button"
        onClick={() => triggerStart('LOBBY')}
        className="absolute top-4 right-4 z-40 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-400 font-pixel text-[10px] px-3 py-1.5 rounded transition-colors cursor-pointer"
      >
        SKIP INTRO ⏩
      </button>

      {phase === 'STUDIO' ? (
        /* PHASE 1: TUXEDO PENGUIN GAMING SPORTS STUDIO SPLASH */
        <div className="relative z-20 flex flex-col items-center justify-center text-center p-6 space-y-6 max-w-lg animate-fade-in">
          {/* Animated Mascot Emblem */}
          <div className="relative group cursor-pointer" onClick={() => retroAudio.playWhistle()}>
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 border-amber-400 p-1.5 bg-slate-950 shadow-[0_0_60px_rgba(251,191,36,0.5)] transition-transform hover:scale-105">
              <img
                src={tuxedoPenguinLogo}
                alt="Tuxedo Penguin Gaming Sports"
                className="w-full h-full object-cover rounded-full pixelated"
              />
            </div>
            {/* Gold Tag */}
            <div className="absolute -bottom-2 inset-x-0 mx-auto w-fit bg-amber-400 text-slate-950 font-pixel text-[10px] py-1 px-3.5 rounded-full shadow font-bold tracking-wider">
              OFFICIAL 16-BIT SEAL
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="font-pixel text-[10px] sm:text-xs text-amber-400 tracking-widest uppercase">
              TUXEDO PENGUIN GAMING SPORTS STUDIO PRESENTS
            </div>
            <h2 className="font-pixel text-xl sm:text-3xl text-white tracking-widest drop-shadow-md">
              IT'S IN THE GAME!
            </h2>
            <div className="font-mono text-xs text-slate-400 tracking-wider">
              16-Bit Ice Hockey Arcade Experience · Est. 1994
            </div>
          </div>

          {/* Progress bar to Phase 2 */}
          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 animate-[pulse_1s_infinite] w-full" />
          </div>

          <div className="pt-2 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setPhase('TITLE')}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-pixel text-xs px-5 py-2.5 rounded shadow cursor-pointer font-bold tracking-wider"
            >
              ENTER COIN-OP TITLE SCREEN
            </button>
            <div className="text-[9px] text-slate-500 font-pixel">
              [PRESS SPACE / ENTER OR CLICK TO ADVANCE]
            </div>
          </div>
        </div>
      ) : (
        /* PHASE 2: 16-BIT COIN-OP TITLE SCREEN & ATTRACT MODE */
        <div className="relative z-20 w-full h-full flex flex-col justify-between p-4 sm:p-8 max-w-5xl mx-auto">
          {/* Background Arcade Banner Imagery */}
          <img
            src={retroBannerImg}
            alt="Retro Puck '94 Title Banner"
            className="absolute inset-0 w-full h-full object-cover opacity-50 pixelated pointer-events-none -z-10"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/80 pointer-events-none -z-10" />

          {/* Top Marquee Header Row */}
          <div className="w-full flex items-center justify-between text-[10px] sm:text-[11px] text-amber-400 border-b border-amber-500/30 pb-2.5">
            <div className="flex items-center gap-3">
              <span className="bg-red-600/80 text-white px-2 py-0.5 rounded text-[9px] animate-pulse">
                FREE PLAY
              </span>
              <span>CREDITS: 02</span>
            </div>
            <div className="text-cyan-300 tracking-widest font-mono">
              ALL-TIME RECORD: <span className="text-amber-400 font-bold">1,994,000</span>
            </div>
            <div className="text-slate-400 hidden sm:block">1-2 PLAYERS / ARCADE MODE</div>
          </div>

          {/* Center Logo & Game Presentation */}
          <div className="flex flex-col items-center text-center my-auto py-4 space-y-4">
            <div className="flex items-center gap-2 bg-blue-950/70 border border-cyan-400/50 px-3.5 py-1 rounded-full text-cyan-300 text-[10px] tracking-wider uppercase drop-shadow">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AUTHENTIC 16-BIT ICE SHOWDOWN</span>
            </div>

            <div className="relative py-1">
              <h1 className="font-pixel text-4xl sm:text-6xl md:text-7xl text-amber-400 tracking-wider drop-shadow-[0_8px_0_rgba(180,83,9,1)]">
                RETRO PUCK
              </h1>
              <div className="font-pixel text-3xl sm:text-5xl md:text-6xl text-white tracking-widest -mt-1 sm:-mt-2 drop-shadow-[0_6px_0_rgba(15,23,42,1)]">
                ’94
              </div>
            </div>

            {/* Subtitle */}
            <div className="font-mono text-xs sm:text-sm text-slate-200 tracking-wide max-w-xl px-4">
              Presented by Tuxedo Penguin Gaming Sports — <span className="text-amber-400">"It's In The Game!"</span>
            </div>

            {/* Dynamic Highlights Ticker */}
            <div className="bg-slate-900/90 border border-slate-700/80 px-4 py-2 rounded-lg max-w-lg w-full text-[10px] sm:text-xs text-amber-300 font-pixel tracking-wide min-h-[38px] flex items-center justify-center shadow-lg">
              <span className="animate-fade-in">{HIGHLIGHTS[tickerIndex]}</span>
            </div>

            {/* Primary Action Button: PUSH START BUTTON */}
            <div className="pt-2 flex flex-col items-center gap-2 w-full max-w-md">
              <button
                type="button"
                onClick={() => triggerStart('LOBBY')}
                className="w-full group relative px-8 py-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-pixel text-sm sm:text-base font-extrabold tracking-widest rounded-xl shadow-[0_0_40px_rgba(251,191,36,0.6)] cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 border-2 border-amber-200"
              >
                <Play className="w-5 h-5 fill-current" />
                <span className={blink ? 'opacity-100' : 'opacity-85'}>PUSH START BUTTON</span>
              </button>

              <div className="text-[10px] text-slate-400 font-pixel">
                [PRESS SPACE / ENTER OR CLICK TO DROP PUCK]
              </div>
            </div>

            {/* Quick Mode Jump Buttons */}
            <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
              <button
                type="button"
                onClick={() => triggerStart('PRO_5V5')}
                className="bg-slate-900/90 hover:bg-slate-800 border border-amber-500/50 hover:border-amber-400 text-amber-300 font-pixel text-[10px] px-3 py-2 rounded cursor-pointer transition-colors"
              >
                🏒 5v5 PRO ARENA
              </button>
              <button
                type="button"
                onClick={() => triggerStart('POND_3V3')}
                className="bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-pixel text-[10px] px-3 py-2 rounded cursor-pointer transition-colors"
              >
                ❄️ 3v3 POND HOCKEY
              </button>
              <button
                type="button"
                onClick={() => triggerStart('DYNASTY')}
                className="bg-slate-900/90 hover:bg-slate-800 border border-purple-500/50 hover:border-purple-400 text-purple-300 font-pixel text-[10px] px-3 py-2 rounded cursor-pointer transition-colors"
              >
                🎴 DYNASTY FRANCHISE
              </button>
              <button
                type="button"
                onClick={() => setShowControls(true)}
                className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 font-pixel text-[10px] px-3 py-2 rounded cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>CONTROLS</span>
              </button>
            </div>
          </div>

          {/* Bottom Footer Info */}
          <div className="w-full flex flex-wrap items-center justify-between text-[10px] text-slate-400 gap-2 border-t border-slate-800 pt-3">
            <div className="flex items-center gap-2">
              <img
                src={tuxedoPenguinLogo}
                alt="Studio Mascot"
                className="w-5 h-5 rounded-full object-cover border border-amber-400/60 pixelated"
              />
              <span>© 1994-2026 TUXEDO PENGUIN GAMING SPORTS STUDIO</span>
            </div>
            <div className="flex items-center gap-2 text-amber-400/90">
              <Volume2 className="w-3.5 h-3.5" />
              <span>100% SYNTHESIZED WEB AUDIO & ANNOUNCER READY</span>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLS GUIDE MODAL */}
      {showControls && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border-2 border-amber-400 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative font-pixel">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="text-amber-400 text-sm flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                <span>16-BIT RINK CONTROLS</span>
              </div>
              <button
                type="button"
                onClick={() => setShowControls(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-[11px] font-mono">
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-amber-400 font-pixel">WASD / ARROW KEYS</span>
                <span className="text-slate-200">Skate, Glide & Aim Shots</span>
              </div>
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-amber-400 font-pixel">SPACE / J</span>
                <span className="text-slate-200">Shoot / Slap Shot (Hold to Charge) / Poke Check</span>
              </div>
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-amber-400 font-pixel">K</span>
                <span className="text-slate-200">Tape-to-Tape Pass / Signature One-Timer</span>
              </div>
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-amber-400 font-pixel">SHIFT / L</span>
                <span className="text-slate-200">Turbo Sprint / Crushing Body Check</span>
              </div>
              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-amber-400 font-pixel">EASY / PRO / LEGEND</span>
                <span className="text-slate-200">Switch AI aggression anytime in the top bar</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowControls(false);
                triggerStart('LOBBY');
              }}
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-pixel text-xs py-3 rounded font-bold cursor-pointer"
            >
              GOT IT · DROP THE PUCK!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
