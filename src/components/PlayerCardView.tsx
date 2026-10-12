import React from 'react';
import { PlayerCard } from '../types/game';
import { Shield, Zap, Crosshair, Eye, Award } from 'lucide-react';

interface PlayerCardViewProps {
  player: PlayerCard;
  isSelected?: boolean;
  isOwned?: boolean;
  duplicateCount?: number;
  actionLabel?: string;
  onAction?: (player: PlayerCard) => void;
  disabledAction?: boolean;
  compact?: boolean;
}

const TIER_STYLES: Record<
  PlayerCard['tier'],
  { border: string; bg: string; headerBg: string; accentText: string; badgeText: string }
> = {
  LEGENDARY: {
    border: 'border-amber-400',
    bg: 'bg-gradient-to-b from-amber-950/90 via-slate-900 to-slate-950',
    headerBg: 'bg-amber-500/20',
    accentText: 'text-amber-300',
    badgeText: 'LEGENDARY FOIL',
  },
  PLATINUM: {
    border: 'border-cyan-400',
    bg: 'bg-gradient-to-b from-cyan-950/85 via-slate-900 to-slate-950',
    headerBg: 'bg-cyan-500/20',
    accentText: 'text-cyan-300',
    badgeText: 'PLATINUM CHROME',
  },
  GOLD: {
    border: 'border-yellow-500/80',
    bg: 'bg-gradient-to-b from-yellow-950/75 via-slate-900 to-slate-950',
    headerBg: 'bg-yellow-500/15',
    accentText: 'text-yellow-400',
    badgeText: 'GOLD SERIES',
  },
  SILVER: {
    border: 'border-slate-400/80',
    bg: 'bg-gradient-to-b from-slate-800/90 via-slate-900 to-slate-950',
    headerBg: 'bg-slate-400/15',
    accentText: 'text-slate-300',
    badgeText: 'SILVER SERIES',
  },
  BRONZE: {
    border: 'border-orange-700/80',
    bg: 'bg-gradient-to-b from-orange-950/65 via-slate-900 to-slate-950',
    headerBg: 'bg-orange-700/15',
    accentText: 'text-orange-400',
    badgeText: 'BRONZE ROOKIE',
  },
};

export const PlayerCardView: React.FC<PlayerCardViewProps> = ({
  player,
  isSelected = false,
  isOwned = false,
  duplicateCount = 0,
  actionLabel,
  onAction,
  disabledAction = false,
  compact = false,
}) => {
  const style = TIER_STYLES[player.tier];
  const isGoalie = player.pos === 'G';

  const renderArchetypeIcon = () => {
    switch (player.archetype) {
      case 'Sniper':
        return <Crosshair className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'Playmaker':
        return <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'Enforcer':
        return <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'Two-Way Defenseman':
        return <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'Brick Wall Goalie':
        return <Award className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    }
  };

  return (
    <div
      className={`relative rounded-xl border ${style.border} ${style.bg} p-4 flex flex-col justify-between transition-transform duration-150 ${
        isSelected ? 'ring-2 ring-amber-400 scale-[1.01]' : 'hover:-translate-y-0.5'
      }`}
    >
      {/* Top Header: OVR + Pos + Tier Kicker */}
      <div>
        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/10">
          <div>
            <div className={`text-[11px] font-mono tracking-wider uppercase ${style.accentText}`}>
              #{String(player.id).padStart(3, '0')} · {style.badgeText}
            </div>
            <h3 className="text-xl font-bold tracking-tight text-white font-display truncate">
              {player.name}
            </h3>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>{player.teamName}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-300 font-medium">{player.pos}</span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className={`text-3xl font-extrabold font-mono leading-none tabular-nums ${style.accentText}`}>
              {player.ovr}
            </div>
            <div className="text-[10px] font-mono text-slate-400 uppercase mt-0.5">OVR</div>
          </div>
        </div>

        {/* Archetype Line */}
        <div className="flex items-center justify-between text-xs text-slate-300 py-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 truncate">
            {renderArchetypeIcon()}
            <span className="truncate">{player.archetype}</span>
          </div>
          {isOwned && (
            <span className="text-[11px] font-mono text-emerald-400 shrink-0">
              OWNED {duplicateCount > 0 ? `(x${duplicateCount + 1})` : ''}
            </span>
          )}
        </div>

        {/* 6 Attribute Grid */}
        {!compact && (
          <div className="grid grid-cols-3 gap-2 my-3 text-center">
            <div className="bg-slate-950/60 rounded-lg py-1.5 px-2 border border-white/5">
              <div className="text-[10px] font-mono text-slate-400">SKT</div>
              <div className="text-sm font-bold font-mono text-white tabular-nums">{player.skt}</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg py-1.5 px-2 border border-white/5">
              <div className="text-[10px] font-mono text-slate-400">SHT</div>
              <div className="text-sm font-bold font-mono text-white tabular-nums">{player.sht}</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg py-1.5 px-2 border border-white/5">
              <div className="text-[10px] font-mono text-slate-400">PAS</div>
              <div className="text-sm font-bold font-mono text-white tabular-nums">{player.pas}</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg py-1.5 px-2 border border-white/5">
              <div className="text-[10px] font-mono text-slate-400">CHK</div>
              <div className="text-sm font-bold font-mono text-white tabular-nums">{player.chk}</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg py-1.5 px-2 border border-white/5">
              <div className="text-[10px] font-mono text-slate-400">{isGoalie ? 'GLO' : 'DEF'}</div>
              <div className="text-sm font-bold font-mono text-white tabular-nums">{player.def}</div>
            </div>
            <div className="bg-slate-950/60 rounded-lg py-1.5 px-2 border border-white/5">
              <div className="text-[10px] font-mono text-slate-400">VAL</div>
              <div className="text-sm font-bold font-mono text-amber-400 tabular-nums">{player.price}</div>
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          type="button"
          disabled={disabledAction}
          onClick={() => onAction(player)}
          className={`w-full mt-2 py-2 px-4 rounded-lg text-xs font-semibold tracking-wide transition-colors whitespace-nowrap shrink-0 ${
            disabledAction
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
          }`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
