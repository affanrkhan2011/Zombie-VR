import React, { useState, useEffect } from 'react';
import { GameMode, PlayerStats, GameSettings, DirectionalWarning } from '../types';
import { Shield, Flame, Target as TargetIcon, Volume2, VolumeX, Pause, Play, Compass, RefreshCw, Eye, Smartphone, Zap } from 'lucide-react';

interface GameHUDProps {
  mode: GameMode;
  stats: PlayerStats;
  settings: GameSettings;
  isPaused: boolean;
  isDamaged: boolean;
  warnings: DirectionalWarning[];
  waveBonusMessage: string | null;
  onTogglePause: () => void;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  onRestartGame: () => void;
  onExitHome: () => void;
  onResetPracticeTargets?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  mode,
  stats,
  settings,
  isPaused,
  isDamaged,
  warnings,
  waveBonusMessage,
  onTogglePause,
  onUpdateSettings,
  onRestartGame,
  onExitHome,
  onResetPracticeTargets,
}) => {
  const hpPercent = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));

  // Determine closest threat direction warning
  const closeZombies = warnings.filter(w => w.distance < 4.0);
  const behindThreat = closeZombies.some(w => w.direction === 'BACK');
  const leftThreat = closeZombies.some(w => w.direction === 'LEFT');
  const rightThreat = closeZombies.some(w => w.direction === 'RIGHT');

  return (
    <div id="game-hud-overlay" className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none z-10">
      {/* Blood Damage Screen Flash */}
      {isDamaged && (
        <div id="damage-vignette" className="absolute inset-0 bg-red-600/35 border-8 border-red-600/80 pointer-events-none animate-pulse transition-all duration-200"></div>
      )}

      {/* WAVE BONUS ANNOUNCEMENT */}
      {waveBonusMessage && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-950/90 border-2 border-red-500 text-red-100 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md flex flex-col items-center animate-bounce z-20">
          <div className="text-2xl font-black tracking-widest text-red-400 uppercase drop-shadow">
            WAVE COMPLETED!
          </div>
          <div className="text-sm font-semibold text-emerald-400 mt-1 flex items-center gap-1">
            <Zap className="w-4 h-4" /> {waveBonusMessage}
          </div>
        </div>
      )}

      {/* DANGER / SPATIAL WARNING TEXT */}
      {mode === 'PLAY' && !isPaused && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-20">
          {behindThreat && (
            <div id="warning-behind" className="bg-red-600 text-white font-black text-xs md:text-sm px-4 py-1 rounded-full uppercase tracking-widest shadow-lg animate-ping border border-red-300">
              ⚠️ ENEMY BEHIND YOU! TURN AROUND!
            </div>
          )}
          {leftThreat && !behindThreat && (
            <div id="warning-left" className="bg-amber-600 text-white font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-lg animate-pulse">
              ⬅️ THREAT APPROACHING FROM LEFT
            </div>
          )}
          {rightThreat && !behindThreat && (
            <div id="warning-right" className="bg-amber-600 text-white font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-lg animate-pulse">
              THREAT APPROACHING FROM RIGHT ➡️
            </div>
          )}
        </div>
      )}

      {/* TOP BAR HUD */}
      <div className="flex items-center justify-between w-full pointer-events-auto gap-2">
        {/* PLAYER HEALTH BAR */}
        <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md border border-red-900/60 rounded-xl p-2 px-3 shadow-lg max-w-[220px] sm:max-w-xs w-full">
          <Shield className={`w-6 h-6 ${stats.hp <= 30 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} />
          <div className="flex-1">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className="text-red-400 tracking-wider">HEALTH</span>
              <span className={`font-mono ${stats.hp <= 30 ? 'text-red-500 font-extrabold' : 'text-gray-200'}`}>
                {stats.hp} / {stats.maxHp} HP
              </span>
            </div>
            <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-red-950">
              <div
                className={`h-full transition-all duration-300 ${
                  stats.hp > 75 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : stats.hp > 30 ? 'bg-amber-500' : 'bg-red-600 animate-pulse'
                }`}
                style={{ width: `${hpPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* MODE STATS BADGES */}
        {mode === 'PLAY' ? (
          <div className="flex items-center gap-2">
            <div className="bg-red-950/90 border border-red-700/60 px-3 py-1.5 rounded-xl text-center shadow-lg backdrop-blur-sm">
              <div className="text-[10px] text-red-400 uppercase font-extrabold">WAVE</div>
              <div className="text-lg font-black text-white font-mono">{stats.wave}</div>
            </div>
            <div className="bg-zinc-900/90 border border-zinc-700/60 px-3 py-1.5 rounded-xl text-center shadow-lg backdrop-blur-sm">
              <div className="text-[10px] text-gray-400 uppercase font-extrabold">KILLS</div>
              <div className="text-lg font-black text-red-500 font-mono">{stats.kills}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="bg-amber-950/90 border border-amber-600/60 px-3 py-1.5 rounded-xl text-center shadow-lg backdrop-blur-sm">
              <div className="text-[10px] text-amber-400 uppercase font-extrabold">SCORE</div>
              <div className="text-lg font-black text-amber-200 font-mono">{stats.practiceScore}</div>
            </div>
            <div className="bg-zinc-900/90 border border-zinc-700/60 px-3 py-1.5 rounded-xl text-center shadow-lg backdrop-blur-sm">
              <div className="text-[10px] text-gray-400 uppercase font-extrabold">TARGETS</div>
              <div className="text-lg font-black text-emerald-400 font-mono">{stats.practiceTargetsHit}</div>
            </div>
          </div>
        )}

        {/* QUICK CONTROL ACTION BUTTONS */}
        <div className="flex items-center gap-1">
          {mode === 'PRACTICE' && onResetPracticeTargets && (
            <button
              onClick={onResetPracticeTargets}
              className="p-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-gray-200 transition"
              title="Reset Practice Targets"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            className="p-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-600 text-gray-200 transition"
            title="Toggle Sound"
          >
            {settings.soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
          </button>

          <button
            onClick={onTogglePause}
            className="p-2 rounded-xl bg-red-900/90 hover:bg-red-800 border border-red-700 text-white transition shadow-lg"
            title="Pause Game"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* RADAR COMPASS INDICATOR AT BOTTOM */}
      {mode === 'PLAY' && (
        <div className="self-center bg-black/80 border border-red-950 px-4 py-1.5 rounded-full backdrop-blur-md flex items-center gap-3 text-xs text-gray-300 font-mono pointer-events-auto">
          <Compass className="w-4 h-4 text-red-500" />
          <span>360° SURROUND THREAT RADAR</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            <span className="text-[10px] text-red-400">TOUCH LOSS: -10 HP</span>
          </div>
        </div>
      )}

      {/* PAUSE MODAL OVERLAY */}
      {isPaused && (
        <div id="pause-modal" className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 pointer-events-auto">
          <div className="bg-zinc-900 border-2 border-red-800/80 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-black tracking-widest text-red-500 uppercase mb-4 flex items-center justify-center gap-2">
              <Pause className="w-6 h-6" /> GAME PAUSED
            </h2>

            <div className="space-y-4 mb-6 text-left">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                  Aim Sensitivity: {settings.sensitivity.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={settings.sensitivity}
                  onChange={e => onUpdateSettings({ sensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-red-600"
                />
              </div>

              <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-xl">
                <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-400" /> Mobile Gyro Look
                </span>
                <button
                  onClick={() => onUpdateSettings({ gyroEnabled: !settings.gyroEnabled })}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                    settings.gyroEnabled ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-gray-400'
                  }`}
                >
                  {settings.gyroEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center justify-between bg-zinc-800 p-3 rounded-xl">
                <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" /> Night Flashlight
                </span>
                <button
                  onClick={() => onUpdateSettings({ flashlightOn: !settings.flashlightOn })}
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                    settings.flashlightOn ? 'bg-emerald-600 text-white' : 'bg-zinc-700 text-gray-400'
                  }`}
                >
                  {settings.flashlightOn ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={onTogglePause}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl transition shadow-lg flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" /> RESUME GAME
              </button>
              <button
                onClick={onExitHome}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-bold rounded-xl transition"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {stats.hp <= 0 && mode === 'PLAY' && (
        <div id="gameover-modal" className="fixed inset-0 bg-black/95 backdrop-blur-lg flex items-center justify-center p-4 z-50 pointer-events-auto animate-fadeIn">
          <div className="bg-zinc-950 border-2 border-red-600/90 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(220,38,38,0.4)]">
            <div className="w-16 h-16 bg-red-950 border-2 border-red-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Flame className="w-8 h-8 text-red-500 animate-pulse" />
            </div>

            <h1 className="text-3xl font-black tracking-widest text-red-600 uppercase mb-1 drop-shadow-lg">
              YOU WERE OVERRUN
            </h1>
            <p className="text-xs text-red-400/80 uppercase tracking-widest font-semibold mb-6">
              THE ZOMBIES CLAIMED YOUR SOUL
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6 text-left">
              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
                <div className="text-[10px] text-gray-400 font-bold uppercase">SURVIVED WAVES</div>
                <div className="text-xl font-black text-white font-mono">{stats.wave}</div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
                <div className="text-[10px] text-gray-400 font-bold uppercase">TOTAL KILLS</div>
                <div className="text-xl font-black text-red-500 font-mono">{stats.kills}</div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
                <div className="text-[10px] text-gray-400 font-bold uppercase">HEADSHOTS</div>
                <div className="text-xl font-black text-amber-400 font-mono">{stats.headshots}</div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl">
                <div className="text-[10px] text-gray-400 font-bold uppercase">ACCURACY</div>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  {stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={onRestartGame}
                className="w-full py-3.5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-black tracking-wider uppercase rounded-xl transition shadow-xl"
              >
                TRY AGAIN
              </button>

              <button
                onClick={onExitHome}
                className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-gray-300 font-bold rounded-xl border border-zinc-800 transition"
              >
                RETURN TO MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
