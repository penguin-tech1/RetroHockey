import React, { useState, useEffect, useRef } from 'react';
import { retroAudio } from '../utils/retroAudio';
import { Target, Award, RotateCcw, Volume2 } from 'lucide-react';

interface SkillsCompetitionProps {
  initialMode?: 'ACCURACY' | 'HARDEST_SHOT';
  onUpdateRecord: (type: 'ACCURACY' | 'HARDEST_SHOT', score: number) => void;
  bestAccuracyScore: number;
  bestShotMph: number;
  onExit: () => void;
}

interface TargetBullseye {
  id: number;
  x: number;
  y: number;
  r: number;
  hit: boolean;
  cornerName: string;
}

export const SkillsCompetition: React.FC<SkillsCompetitionProps> = ({
  initialMode = 'ACCURACY',
  onUpdateRecord,
  bestAccuracyScore,
  bestShotMph,
  onExit,
}) => {
  const [contest, setContest] = useState<'ACCURACY' | 'HARDEST_SHOT'>(initialMode);

  // Accuracy Shooting Challenge State
  const [accuracyPucksLeft, setAccuracyPucksLeft] = useState(10);
  const [accuracyHits, setAccuracyHits] = useState(0);
  const [accuracyTimer, setAccuracyTimer] = useState(30);
  const [accuracyActive, setAccuracyActive] = useState(false);
  const [accuracyAimX, setAccuracyAimX] = useState(50); // 0 to 100%
  const [accuracyAimY, setAccuracyAimY] = useState(50);
  const [accuracyTargets, setAccuracyTargets] = useState<TargetBullseye[]>([
    { id: 1, x: 22, y: 22, r: 16, hit: false, cornerName: 'TOP LEFT SHELF' },
    { id: 2, x: 78, y: 22, r: 16, hit: false, cornerName: 'TOP RIGHT ROOF' },
    { id: 3, x: 22, y: 78, r: 16, hit: false, cornerName: 'LOW FAR POST' },
    { id: 4, x: 78, y: 78, r: 16, hit: false, cornerName: 'LOW NEAR POST' },
  ]);
  const [contestAnnouncement, setContestAnnouncement] = useState('PRESS SPACE OR CLICK SHOOT TO FIRE AT FOAM TARGETS!');

  // Hardest Slap Shot State
  const [shotCharge, setShotCharge] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [lastShotMph, setLastShotMph] = useState<number | null>(null);
  const [radarHits, setRadarHits] = useState<number[]>([]);
  const chargeIntervalRef = useRef<number | null>(null);

  // Timer countdown for accuracy
  useEffect(() => {
    if (!accuracyActive) return;
    const interval = window.setInterval(() => {
      setAccuracyTimer((prev) => {
        if (prev <= 1) {
          setAccuracyActive(false);
          retroAudio.playWhistle();
          setContestAnnouncement(`TIME'S UP! FINAL SCORE: ${accuracyHits} / 4 TARGETS HIT!`);
          onUpdateRecord('ACCURACY', accuracyHits);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [accuracyActive, accuracyHits, onUpdateRecord]);

  // Aim crosshair oscillating sweep for 16-bit challenge
  useEffect(() => {
    if (!accuracyActive) return;
    let frameId: number;
    let t = 0;
    const animateAim = () => {
      t += 0.055;
      setAccuracyAimX(50 + Math.sin(t * 1.3) * 36);
      setAccuracyAimY(50 + Math.cos(t * 1.8) * 32);
      frameId = requestAnimationFrame(animateAim);
    };
    frameId = requestAnimationFrame(animateAim);
    return () => cancelAnimationFrame(frameId);
  }, [accuracyActive]);

  const handleStartAccuracy = () => {
    setAccuracyPucksLeft(10);
    setAccuracyHits(0);
    setAccuracyTimer(30);
    setAccuracyTargets([
      { id: 1, x: 22, y: 22, r: 16, hit: false, cornerName: 'TOP LEFT SHELF' },
      { id: 2, x: 78, y: 22, r: 16, hit: false, cornerName: 'TOP RIGHT ROOF' },
      { id: 3, x: 22, y: 78, r: 16, hit: false, cornerName: 'LOW FAR POST' },
      { id: 4, x: 78, y: 78, r: 16, hit: false, cornerName: 'LOW NEAR POST' },
    ]);
    setAccuracyActive(true);
    setContestAnnouncement('SHOOTING SESSION LIVE! TIME THE MOVING SIGHTS!');
    retroAudio.playWhistle();
  };

  const handleFireAccuracyShot = () => {
    if (!accuracyActive || accuracyPucksLeft <= 0) return;

    setAccuracyPucksLeft((prev) => prev - 1);
    retroAudio.playPuckStick(0.8);

    // Check collision with targets
    let hitTarget: TargetBullseye | null = null;
    const nextTargets = accuracyTargets.map((tgt) => {
      if (tgt.hit) return tgt;
      const dist = Math.hypot(tgt.x - accuracyAimX, tgt.y - accuracyAimY);
      if (dist <= tgt.r) {
        hitTarget = tgt;
        return { ...tgt, hit: true };
      }
      return tgt;
    });

    if (hitTarget) {
      retroAudio.playPostPing();
      const nextCount = accuracyHits + 1;
      setAccuracyHits(nextCount);
      setAccuracyTargets(nextTargets);
      setContestAnnouncement(`TARGET SHATTERED: ${(hitTarget as TargetBullseye).cornerName}! BULLSEYE!`);

      if (nextCount >= 4) {
        setAccuracyActive(false);
        retroAudio.playGoalHorn();
        setContestAnnouncement(`ALL 4 FOAM TARGETS SNIPED IN ${30 - accuracyTimer} SECONDS!`);
        onUpdateRecord('ACCURACY', 4);
      }
    } else {
      setContestAnnouncement('OFF THE MARK! RE-CENTER SIGHTS AND FIRE!');
    }

    if (accuracyPucksLeft - 1 <= 0 && (!hitTarget || accuracyHits + 1 < 4)) {
      setAccuracyActive(false);
      setContestAnnouncement(`OUT OF PUCKS! TOTAL TARGETS HIT: ${accuracyHits + (hitTarget ? 1 : 0)} / 4`);
      onUpdateRecord('ACCURACY', accuracyHits + (hitTarget ? 1 : 0));
    }
  };

  // Hardest Slap Shot Logic
  const startChargingSlap = () => {
    setIsCharging(true);
    setShotCharge(0);
    if (chargeIntervalRef.current) clearInterval(chargeIntervalRef.current);
    chargeIntervalRef.current = window.setInterval(() => {
      setShotCharge((prev) => {
        if (prev >= 100) return 100;
        return prev + 5;
      });
    }, 30);
  };

  const releaseChargingSlap = () => {
    if (!isCharging) return;
    setIsCharging(false);
    if (chargeIntervalRef.current) {
      clearInterval(chargeIntervalRef.current);
      chargeIntervalRef.current = null;
    }

    // Calculate radar gun velocity (88 to 109 MPH based on charge sweet spot)
    const powerPct = shotCharge / 100;
    // Perfect release sweet spot at 85-95%
    let calculatedMph: number;
    if (powerPct >= 0.8 && powerPct <= 0.98) {
      calculatedMph = Math.round(101 + Math.random() * 8); // 101-109 mph!
    } else if (powerPct > 0.98) {
      // Overcharge / shattered composite stick
      calculatedMph = Math.round(94 + Math.random() * 4);
    } else {
      calculatedMph = Math.round(82 + powerPct * 20);
    }

    setLastShotMph(calculatedMph);
    setRadarHits((prev) => [calculatedMph, ...prev.slice(0, 4)]);

    const isRecord = calculatedMph > bestShotMph;
    if (calculatedMph >= 100) {
      retroAudio.playSlapShotBlast(true);
      retroAudio.playBoardSmash(true);
      setContestAnnouncement(`RADAR GUN BOOM: ${calculatedMph} MPH! SHATTERED PLEXIGLASS!`);
      if (isRecord) {
        retroAudio.playOrganCharge();
      }
    } else {
      retroAudio.playSlapShotBlast(false);
      setContestAnnouncement(`RADAR REGISTERED: ${calculatedMph} MPH!`);
    }

    if (isRecord) {
      onUpdateRecord('HARDEST_SHOT', calculatedMph);
    }
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4 py-4 font-mono select-none">
      {/* Contest Mode Switcher */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-amber-500/40 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-pixel text-xs tracking-wider">ALL-STAR CONTEST</span>
          <span className="text-slate-600">/</span>
          <button
            type="button"
            onClick={() => setContest('ACCURACY')}
            className={`font-pixel text-[11px] px-3 py-1.5 rounded cursor-pointer whitespace-nowrap ${
              contest === 'ACCURACY' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            TARGET ACCURACY
          </button>
          <button
            type="button"
            onClick={() => setContest('HARDEST_SHOT')}
            className={`font-pixel text-[11px] px-3 py-1.5 rounded cursor-pointer whitespace-nowrap ${
              contest === 'HARDEST_SHOT' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            HARDEST SLAP SHOT
          </button>
        </div>

        <button
          type="button"
          onClick={onExit}
          className="font-pixel text-[10px] text-slate-400 hover:text-amber-400 cursor-pointer"
        >
          [RETURN TO HUB]
        </button>
      </div>

      {contest === 'ACCURACY' ? (
        /* TARGET ACCURACY CONTEST */
        <div className="bg-slate-950 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="font-pixel text-xs text-amber-400">16-BIT CORNER SNIPER DRILL</div>
              <div className="text-xs text-slate-400 mt-1">
                Hit all 4 foam targets strung to the goalposts before time expires.
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-pixel">
              <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-sky-400">
                PUCKS: {accuracyPucksLeft}
              </div>
              <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-amber-400">
                TARGETS: {accuracyHits} / 4
              </div>
              <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-emerald-400">
                TIME: {accuracyTimer}S
              </div>
              <div className="text-slate-400 text-[10px]">
                BEST: {bestAccuracyScore} PTS
              </div>
            </div>
          </div>

          {/* Goal Net Target Range Area */}
          <div className="relative my-6 w-full h-[320px] bg-slate-900 border-4 border-red-700 rounded-lg overflow-hidden flex items-center justify-center">
            {/* White Netting Texture */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, #fff, #fff 1px, transparent 1px, transparent 16px), repeating-linear-gradient(90deg, #fff, #fff 1px, transparent 1px, transparent 16px)',
              }}
            />

            {/* Red Steel Crossbar and Posts */}
            <div className="absolute inset-x-8 top-6 h-3 bg-red-600 shadow-md" />
            <div className="absolute left-8 inset-y-6 w-3 bg-red-600 shadow-md" />
            <div className="absolute right-8 inset-y-6 w-3 bg-red-600 shadow-md" />

            {/* 4 Foam Circular Target Bullseyes */}
            {accuracyTargets.map((t) => (
              <div
                key={t.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 flex items-center justify-center transition-all duration-200"
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  width: `${t.r * 2.5}px`,
                  height: `${t.r * 2.5}px`,
                  borderColor: t.hit ? '#475569' : '#f59e0b',
                  backgroundColor: t.hit ? '#1e293b' : '#dc2626',
                  opacity: t.hit ? 0.35 : 1,
                }}
              >
                {!t.hit && <div className="w-3 h-3 rounded-full bg-white shadow-inner" />}
              </div>
            ))}

            {/* Moving Laser Crosshair Sight */}
            {accuracyActive && (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 pointer-events-none transition-all duration-75"
                style={{
                  left: `${accuracyAimX}%`,
                  top: `${accuracyAimY}%`,
                }}
              >
                <div className="w-full h-full border-2 border-dashed border-cyan-400 rounded-full animate-spin" />
                <div className="absolute inset-x-1/2 top-0 bottom-0 w-0.5 bg-cyan-400 -translate-x-1/2" />
                <div className="absolute inset-y-1/2 left-0 right-0 h-0.5 bg-cyan-400 -translate-y-1/2" />
              </div>
            )}

            {/* Announcement Banner Overlay */}
            <div className="absolute bottom-3 inset-x-4 bg-slate-950/90 border border-amber-500/50 py-1.5 px-3 rounded text-center">
              <span className="font-pixel text-[10px] text-amber-300">{contestAnnouncement}</span>
            </div>
          </div>

          {/* Action Triggers */}
          <div className="flex items-center justify-center gap-4">
            {!accuracyActive ? (
              <button
                type="button"
                onClick={handleStartAccuracy}
                className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-pixel text-xs rounded-lg cursor-pointer flex items-center gap-2"
              >
                <Target className="w-4 h-4" /> START SHOOTING ROUND
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFireAccuracyShot}
                className="py-3 px-8 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-pixel text-xs rounded-lg cursor-pointer flex items-center gap-2 animate-pulse"
              >
                [RELEASE PUCK (SPACE / CLICK)]
              </button>
            )}
          </div>
        </div>
      ) : (
        /* HARDEST SLAP SHOT RADAR CONTEST */
        <div className="bg-slate-950 border-2 border-amber-500/60 rounded-xl p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="font-pixel text-xs text-amber-400">100+ MPH RADAR GUN SPEED CAGE</div>
              <div className="text-xs text-slate-400 mt-1">
                Charge the power meter into the yellow/red zone and release for maximum blast velocity.
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-pixel">
              <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-amber-400">
                CURRENT BLAST: {lastShotMph ? `${lastShotMph} MPH` : 'READY'}
              </div>
              <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-rose-400">
                ARENA RECORD: {bestShotMph} MPH
              </div>
            </div>
          </div>

          {/* Radar Speed Display Big Screen */}
          <div className="my-6 p-8 bg-slate-900 border-4 border-slate-800 rounded-xl text-center relative overflow-hidden">
            <div className="text-[11px] font-pixel text-slate-400 tracking-widest uppercase">
              RADAR GUN VELOCITY SENSOR
            </div>
            <div className="text-6xl sm:text-7xl font-extrabold font-pixel text-amber-400 my-4 tabular-nums tracking-wider">
              {lastShotMph ? `${lastShotMph}` : '000'}
              <span className="text-2xl text-slate-500 ml-2">MPH</span>
            </div>

            {/* Charge Meter Bar */}
            <div className="max-w-md mx-auto">
              <div className="flex justify-between text-[10px] font-pixel text-slate-400 mb-1">
                <span>WIND-UP</span>
                <span className="text-amber-400">SWEET SPOT (85-95%)</span>
                <span>MAX</span>
              </div>
              <div className="w-full h-6 bg-slate-950 border-2 border-slate-700 rounded overflow-hidden p-0.5">
                <div
                  className="h-full transition-all duration-75"
                  style={{
                    width: `${shotCharge}%`,
                    backgroundColor:
                      shotCharge > 95 ? '#ef4444' : shotCharge > 75 ? '#f59e0b' : '#38bdf8',
                  }}
                />
              </div>
            </div>

            <div className="mt-4 font-pixel text-[11px] text-sky-300">{contestAnnouncement}</div>
          </div>

          {/* Slap Shot Blast Button */}
          <div className="flex flex-col items-center justify-center gap-3">
            <button
              type="button"
              onMouseDown={startChargingSlap}
              onMouseUp={releaseChargingSlap}
              onTouchStart={startChargingSlap}
              onTouchEnd={releaseChargingSlap}
              className={`py-4 px-10 rounded-xl font-pixel text-xs tracking-wider cursor-pointer select-none transition-transform ${
                isCharging
                  ? 'bg-red-600 text-white scale-95 ring-4 ring-amber-400'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              {isCharging ? 'HOLDING WIND-UP... RELEASE TO BLAST!' : 'HOLD TO WIND UP SLAP SHOT'}
            </button>
            <span className="text-[10px] text-slate-400 font-pixel">
              (TIP: RELEASE AT ~90% CHARGE TO CRACK 105+ MPH)
            </span>
          </div>

          {/* Past Shots History Log */}
          {radarHits.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-800 text-xs flex items-center justify-center gap-3">
              <span className="text-slate-400 font-pixel text-[10px]">RECENT RADARS:</span>
              {radarHits.map((spd, i) => (
                <span
                  key={i}
                  className={`font-pixel text-[11px] px-2 py-0.5 rounded ${
                    spd >= 100 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  {spd} MPH
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
