import React, { useState } from 'react';
import { InternationalTeam, WorldCupMatch, WorldCupState } from '../types/game';
import { INTERNATIONAL_TEAMS } from '../data/rosterData';
import { createInitialWorldCupBracket } from '../utils/storage';
import { retroAudio } from '../utils/retroAudio';
import { Trophy, Play, RotateCcw, Award } from 'lucide-react';

interface WorldCupHubProps {
  bracket: WorldCupState | null;
  onUpdateBracket: (next: WorldCupState | null) => void;
  onPlayTournamentMatch: (match: WorldCupMatch, userTeam: InternationalTeam, oppTeam: InternationalTeam) => void;
}

export const WorldCupHub: React.FC<WorldCupHubProps> = ({
  bracket,
  onUpdateBracket,
  onPlayTournamentMatch,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<string>('CAN');
  const [selectedFormat, setSelectedFormat] = useState<'SINGLE' | 'BO3'>('SINGLE');

  const getTeam = (id: string): InternationalTeam =>
    INTERNATIONAL_TEAMS.find((t) => t.id === id) || INTERNATIONAL_TEAMS[0];

  if (!bracket) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">
        <div className="pb-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">
              INTERNATIONAL TOURNAMENT · 16 NATIONAL POWERHOUSES
            </div>
            <h2 className="text-3xl font-extrabold font-display text-white mt-0.5">
              World Cup of Hockey ’94 — Select Your Nation
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setSelectedFormat('SINGLE')}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  selectedFormat === 'SINGLE'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300'
                }`}
              >
                Single Elimination
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('BO3')}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  selectedFormat === 'BO3'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300'
                }`}
              >
                Best-of-3 Series
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                retroAudio.playOrganCharge();
                onUpdateBracket(createInitialWorldCupBracket(selectedCountry, selectedFormat));
              }}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap"
            >
              Launch World Cup Bracket
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {INTERNATIONAL_TEAMS.map((team) => {
            const isSel = selectedCountry === team.id;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setSelectedCountry(team.id)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                  isSel
                    ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/50'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-extrabold text-sm border border-white/20 shrink-0"
                    style={{ backgroundColor: team.primaryColor, color: team.secondaryColor }}
                  >
                    {team.code}
                  </div>
                  <div>
                    <div className="text-base font-bold font-display text-white">{team.name}</div>
                    <div className="text-xs font-mono text-slate-400 tabular-nums">
                      OVR: {team.ovr}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Find current active user match
  const activeUserMatch = bracket.matches.find(
    (m) =>
      !m.winner &&
      (m.teamA === bracket.userTeamId || m.teamB === bracket.userTeamId)
  );

  const rounds: ('R16' | 'QF' | 'SF' | 'FINAL')[] = ['R16', 'QF', 'SF', 'FINAL'];

  return (
    <div className="w-full max-w-[1200px] mx-auto px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-amber-400 uppercase">
            WORLD CUP OF HOCKEY · {bracket.format === 'BO3' ? 'BEST-OF-3 SERIES' : 'SINGLE ELIMINATION'}
          </div>
          <h2 className="text-3xl font-extrabold font-display text-white mt-0.5">
            International Championship Bracket ({getTeam(bracket.userTeamId).name})
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {activeUserMatch && (
            <button
              type="button"
              onClick={() => {
                const userT = getTeam(bracket.userTeamId);
                const oppId =
                  activeUserMatch.teamA === bracket.userTeamId
                    ? activeUserMatch.teamB
                    : activeUserMatch.teamA;
                onPlayTournamentMatch(activeUserMatch, userT, getTeam(oppId));
              }}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4" /> Play Next Match ({activeUserMatch.round})
            </button>
          )}
          <button
            type="button"
            onClick={() => onUpdateBracket(null)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Tournament
          </button>
        </div>
      </div>

      {/* Golden Trophy Ceremony Banner if Champion */}
      {bracket.currentRound === 'CHAMPION' && (
        <div className="my-6 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-2 border-amber-400 rounded-xl p-8 text-center">
          <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-3" />
          <div className="text-xs font-mono text-amber-300 uppercase tracking-widest">
            GOLDEN WORLD CUP TROPHY CEREMONY
          </div>
          <h3 className="text-4xl font-extrabold font-display text-white mt-1">
            {getTeam(bracket.userTeamId).name.toUpperCase()} LIFTS THE GOLDEN CUP!
          </h3>
          <p className="text-sm text-slate-300 mt-2 max-w-xl mx-auto">
            Confetti rains down from the rafters as your captain skates a lap around the rink
            hoisting the 16-bit World Cup of Hockey Championship Trophy!
          </p>
        </div>
      )}

      {/* 4-Column Bracket Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        {rounds.map((r) => {
          const rMatches = bracket.matches.filter((m) => m.round === r);
          const roundLabel =
            r === 'R16'
              ? 'Round of 16'
              : r === 'QF'
              ? 'Quarterfinals'
              : r === 'SF'
              ? 'Semifinals'
              : 'World Cup Final';

          return (
            <div key={r} className="space-y-3">
              <div className="text-sm font-bold font-display text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-800">
                {roundLabel}
              </div>
              {rMatches.length === 0 ? (
                <div className="p-4 rounded-xl border border-slate-900 bg-slate-950/50 text-xs font-mono text-slate-500">
                  Awaiting previous round...
                </div>
              ) : (
                rMatches.map((m) => {
                  const tA = getTeam(m.teamA);
                  const tB = getTeam(m.teamB);
                  const isUserMatch =
                    m.teamA === bracket.userTeamId || m.teamB === bracket.userTeamId;

                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-3 text-xs font-mono ${
                        isUserMatch
                          ? 'bg-slate-900 border-amber-500/60'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between py-1">
                        <span
                          className={`font-sans font-semibold ${
                            m.winner === tA.id ? 'text-amber-400 font-bold' : 'text-white'
                          }`}
                        >
                          {tA.code} · {tA.name}
                        </span>
                        <span className="tabular-nums text-slate-300">
                          {bracket.format === 'BO3'
                            ? `${m.seriesWinsA}W`
                            : m.scoreA !== null
                            ? m.scoreA
                            : '-'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-t border-slate-800/80">
                        <span
                          className={`font-sans font-semibold ${
                            m.winner === tB.id ? 'text-amber-400 font-bold' : 'text-white'
                          }`}
                        >
                          {tB.code} · {tB.name}
                        </span>
                        <span className="tabular-nums text-slate-300">
                          {bracket.format === 'BO3'
                            ? `${m.seriesWinsB}W`
                            : m.scoreB !== null
                            ? m.scoreB
                            : '-'}
                        </span>
                      </div>
                      {m.winner && (
                        <div className="mt-1 pt-1 border-t border-slate-800/50 text-[10px] text-emerald-400 flex items-center gap-1">
                          <Award className="w-3 h-3" /> {getTeam(m.winner).name} Advances
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
