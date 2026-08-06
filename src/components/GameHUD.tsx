import React, { useState, useEffect } from 'react';
import { GameMode, PlayerStats, GameSettings, DirectionalWarning } from '../types';
import { Shield, Flame, Target as TargetIcon, Volume2, VolumeX, Pause, Play, Compass, RefreshCw, Eye, Smartphone, Zap, Crosshair, ArrowLeft, ArrowRight, ArrowDown } from 'lucide-react';

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
  onRecenterGyro?: () => void;
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
  onRecenterGyro,
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
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 font-mono text-center">
          <div className="text-2xl text-white uppercase mb-2">WAVE CLEARED</div>
          <div className="text-sm text-[#ff3300] uppercase tracking-widest">{waveBonusMessage}</div>
        </div>
      )}

      {/* RELOAD ZONE & AMMO NOTIFICATIONS */}
      {mode === 'PLAY' && !isPaused && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none z-20 font-mono text-center">
          {stats.reloadTimeInZone > 0 && stats.ammo < stats.maxAmmo && (
            <div className="bg-emerald-950/90 border border-emerald-500/80 px-4 py-2 rounded-md shadow-[0_0_20px_rgba(16,185,129,0.3)] backdrop-blur-sm animate-pulse">
              <div className="text-emerald-400 font-bold text-sm tracking-wider uppercase">⚡ RELOADING IN GREEN ZONE</div>
              <div className="w-36 h-2 bg-emerald-950 rounded-full mt-1.5 overflow-hidden border border-emerald-600/50">
                <div
                  className="h-full bg-emerald-400 transition-all duration-100"
                  style={{ width: `${(stats.reloadTimeInZone / 2.0) * 100}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-emerald-300 mt-0.5">{stats.reloadTimeInZone.toFixed(1)}s / 2.0s</div>
            </div>
          )}

          {stats.ammo === 0 && stats.reloadTimeInZone === 0 && (
            <div className="bg-red-950/90 border border-red-500/80 px-4 py-2 rounded-md shadow-[0_0_20px_rgba(239,68,68,0.4)] backdrop-blur-sm animate-bounce">
              <div className="text-red-400 font-extrabold text-sm tracking-wider uppercase">⚠️ OUT OF AMMO</div>
              <div className="text-[11px] text-zinc-300 mt-0.5">HEAD TO GREEN RELOAD ZONE (BOTTOM-RIGHT)</div>
            </div>
          )}
        </div>
      )}

      {/* DANGER / SPATIAL WARNING TEXT */}
      {mode === 'PLAY' && !isPaused && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-20 font-mono">
          {behindThreat && (
            <div className="text-[#ff3300] text-sm uppercase tracking-[0.2em] animate-pulse">
              [ BEHIND YOU ]
            </div>
          )}
          {leftThreat && !behindThreat && (
            <div className="text-white text-sm uppercase tracking-[0.2em]">
              [ LEFT THREAT ]
            </div>
          )}
          {rightThreat && !behindThreat && (
            <div className="text-white text-sm uppercase tracking-[0.2em]">
              [ RIGHT THREAT ]
            </div>
          )}
        </div>
      )}

      {/* TOP BAR HUD */}
      <div className="flex items-start justify-between w-full pointer-events-auto gap-2 font-mono">
        {/* PLAYER HEALTH & AMMO BARS */}
        <div className="flex flex-col gap-2 min-w-[140px] sm:min-w-[200px]">
          {/* HP Bar */}
          <div className="flex flex-col">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[#ff3300] uppercase text-xs">HP</span>
              <span className={`text-xl leading-none ${stats.hp <= 30 ? 'text-[#ff3300] animate-pulse' : 'text-white'}`}>
                {stats.hp}
              </span>
            </div>
            <div className="w-full bg-zinc-900 h-1">
              <div
                className={`h-full transition-all duration-300 ${stats.hp <= 30 ? 'bg-[#ff3300]' : 'bg-white'}`}
                style={{ width: `${hpPercent}%` }}
              ></div>
            </div>
          </div>

          {/* AMMO Bar */}
          <div className="flex flex-col">
            <div className="flex justify-between items-end mb-0.5">
              <span className="text-emerald-400 uppercase text-[10px]">AMMO</span>
              <span className={`text-base font-bold leading-none ${stats.ammo === 0 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                {stats.ammo} / {stats.maxAmmo}
              </span>
            </div>
            <div className="w-full bg-zinc-900 h-1 overflow-hidden rounded-full">
              <div
                className={`h-full transition-all duration-150 ${stats.ammo === 0 ? 'bg-red-500' : 'bg-emerald-400'}`}
                style={{ width: `${(stats.ammo / stats.maxAmmo) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* MODE STATS BADGES */}
        {mode === 'PLAY' ? (
          <div className="flex items-center gap-6 text-sm uppercase">
            <div className="flex flex-col">
              <span className="text-gray-500">Wave</span>
              <span className="text-white text-xl leading-none">{stats.wave}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Kills</span>
              <span className="text-[#ff3300] text-xl leading-none">{stats.kills}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6 text-sm uppercase">
            <div className="flex flex-col">
              <span className="text-gray-500">Score</span>
              <span className="text-white text-xl leading-none">{stats.practiceScore}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Hits</span>
              <span className="text-white text-xl leading-none">{stats.practiceTargetsHit}</span>
            </div>
          </div>
        )}

        {/* QUICK CONTROL ACTION BUTTONS */}
        <div className="flex items-center gap-1.5">
          {onRecenterGyro && (
            <button
              onClick={onRecenterGyro}
              className="p-2 text-gray-500 hover:text-white transition-colors"
              title="Re-Center Gyro Aim"
            >
              <Crosshair className="w-5 h-5" />
            </button>
          )}

          {mode === 'PRACTICE' && onResetPracticeTargets && (
            <button
              onClick={onResetPracticeTargets}
              className="p-2 text-gray-500 hover:text-white transition-colors"
              title="Reset Practice Targets"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            className="p-2 text-gray-500 hover:text-white transition-colors"
            title="Toggle Sound"
          >
            {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={onTogglePause}
            className="p-2 text-gray-500 hover:text-white transition-colors"
            title="Pause Game"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* RADAR COMPASS INDICATOR AT BOTTOM (REMOVED) */}

      {/* PAUSE MODAL OVERLAY */}
      {isPaused && (
        <div id="pause-modal" className="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-50 pointer-events-auto font-mono">
          <div className="max-w-sm w-full text-center">
            <h2 className="text-4xl font-display text-white uppercase mb-8">
              PAUSED
            </h2>
            <div className="space-y-6 mb-8 text-left">
              <div>
                <label className="text-sm text-gray-500 uppercase block mb-2">
                  Sensitivity: {settings.sensitivity.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={settings.sensitivity}
                  onChange={e => onUpdateSettings({ sensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-[#ff3300]"
                />
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-sm text-gray-300">Mobile Gyro Look</span>
                <button
                  onClick={() => onUpdateSettings({ gyroEnabled: !settings.gyroEnabled })}
                  className={`text-sm uppercase ${settings.gyroEnabled ? 'text-[#ff3300]' : 'text-gray-600'}`}
                >
                  {settings.gyroEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <button onClick={onTogglePause} className="w-full py-4 bg-white text-black font-display text-2xl uppercase hover:bg-gray-200 transition-colors">
                RESUME
              </button>
              <button onClick={onExitHome} className="w-full py-4 text-gray-500 font-display text-xl uppercase hover:text-white transition-colors">
                EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {stats.hp <= 0 && mode === 'PLAY' && (
        <div id="gameover-modal" className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50 pointer-events-auto font-mono">
          <div className="max-w-md w-full text-center">
            <h1 className="text-6xl font-display text-[#ff3300] uppercase mb-8 leading-none">
              DEAD
            </h1>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-10 text-left border-y border-zinc-800 py-6">
              <div>
                <div className="text-xs text-gray-500 uppercase">Waves</div>
                <div className="text-2xl text-white mt-1">{stats.wave}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Kills</div>
                <div className="text-2xl text-[#ff3300] mt-1">{stats.kills}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Headshots</div>
                <div className="text-2xl text-white mt-1">{stats.headshots}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Accuracy</div>
                <div className="text-2xl text-white mt-1">
                  {stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <button onClick={onRestartGame} className="w-full py-4 bg-[#ff3300] text-black font-display text-2xl uppercase hover:bg-white transition-colors">
                RETRY
              </button>
              <button onClick={onExitHome} className="w-full py-4 text-gray-500 font-display text-xl uppercase hover:text-white transition-colors">
                MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
