import React, { useState } from 'react';
import { GameMode, GameSettings } from '../types';
import { Play, Target as TargetIcon, ShieldAlert, Volume2, VolumeX, Smartphone, Eye, Flame, Trophy, Crosshair, Zap } from 'lucide-react';
import { soundManager } from '../utils/audio';

interface HomeScreenProps {
  onStartGame: (mode: GameMode) => void;
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  highScore: number;
  maxWave: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartGame,
  settings,
  onUpdateSettings,
  highScore,
  maxWave,
}) => {
  const [showGuide, setShowGuide] = useState(false);

  const handleStart = (mode: GameMode) => {
    soundManager.playGunshot();
    onStartGame(mode);
  };

  return (
    <div id="home-screen" className="relative w-full h-full bg-zinc-950 text-white flex flex-col items-center justify-between p-4 sm:p-8 select-none overflow-y-auto">
      {/* Background scary glow FX */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-950/40 via-zinc-950/80 to-black pointer-events-none"></div>

      {/* Header Title Section */}
      <div className="relative z-10 text-center mt-6 sm:mt-10 max-w-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-700/60 text-red-400 text-xs font-black uppercase tracking-widest mb-3 animate-pulse">
          <Flame className="w-4 h-4 text-red-500" /> 360° VR MOB GAME
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-b from-red-500 via-red-600 to-red-900 drop-shadow-[0_5px_15px_rgba(220,38,38,0.5)]">
          ZOMBIE VR
        </h1>
        <div className="text-sm sm:text-lg font-bold tracking-widest text-red-200/90 uppercase -mt-1">
          SURVIVAL OUTBREAK
        </div>
        <p className="text-xs sm:text-sm text-gray-400 mt-2 font-medium">
          Surround sound 3D dark horror shooter. Turn 360 degrees, watch your back, and eliminate the horde.
        </p>
      </div>

      {/* MODE SELECTION BUTTONS (PLAY vs PRACTICE) */}
      <div className="relative z-10 w-full max-w-md my-6 flex flex-col gap-4">
        {/* PLAY MODE CARD */}
        <button
          onClick={() => handleStart('PLAY')}
          className="group relative w-full bg-gradient-to-r from-red-950/90 via-red-900/80 to-zinc-900 border-2 border-red-600/80 hover:border-red-500 rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.02] shadow-[0_0_25px_rgba(185,28,28,0.35)] flex items-center justify-between overflow-hidden"
        >
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-red-600/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition"></div>
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold text-red-400 uppercase tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4 text-red-500" /> MAIN SURVIVAL
            </div>
            <div className="text-2xl font-black text-white tracking-wide uppercase flex items-center gap-2">
              PLAY MODE <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div className="text-xs text-gray-300 mt-1 space-y-0.5 font-medium">
              <div>• Wave Survival with 360° incoming zombies</div>
              <div>• Start at <span className="text-emerald-400 font-bold">150 HP</span> (Bite = <span className="text-red-400 font-bold">-10 HP</span>)</div>
              <div>• Gain <span className="text-emerald-400 font-bold">+1 HP per kill</span> & <span className="text-emerald-400 font-bold">+5 HP per wave</span></div>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-600 group-hover:bg-red-500 text-white flex items-center justify-center transition shadow-lg shrink-0">
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </div>
        </button>

        {/* PRACTICE MODE CARD */}
        <button
          onClick={() => handleStart('PRACTICE')}
          className="group relative w-full bg-zinc-900/90 hover:bg-zinc-800/90 border-2 border-amber-600/60 hover:border-amber-500 rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.02] shadow-xl flex items-center justify-between overflow-hidden"
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-1">
              <Crosshair className="w-4 h-4 text-amber-500" /> TARGET RANGE
            </div>
            <div className="text-2xl font-black text-white tracking-wide uppercase">
              PRACTICE MODE
            </div>
            <div className="text-xs text-gray-300 mt-1 font-medium">
              Targets placed 360° all around you for aim, reaction & laser testing.
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-600 group-hover:bg-amber-500 text-white flex items-center justify-center transition shadow-lg shrink-0">
            <TargetIcon className="w-6 h-6" />
          </div>
        </button>
      </div>

      {/* QUICK SETTINGS & HIGH SCORES */}
      <div className="relative z-10 w-full max-w-md bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3 text-xs font-extrabold text-gray-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-amber-400">
            <Trophy className="w-4 h-4" /> RECORDS
          </span>
          <span>BEST WAVE: <strong className="text-white font-mono">{maxWave}</strong></span>
          <span>HIGH KILLS: <strong className="text-red-400 font-mono">{highScore}</strong></span>
        </div>

        {/* CONTROLS GUIDE TOGGLE */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="text-xs text-red-400 hover:text-red-300 font-bold underline"
          >
            {showGuide ? 'Hide Instructions' : 'How to Play & Controls'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-300 transition"
              title="Toggle Audio"
            >
              {settings.soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
            </button>

            <button
              onClick={() => onUpdateSettings({ gyroEnabled: !settings.gyroEnabled })}
              className={`p-2 rounded-lg transition ${
                settings.gyroEnabled ? 'bg-emerald-950 border border-emerald-500 text-emerald-400' : 'bg-zinc-800 text-gray-500'
              }`}
              title="Toggle Gyroscope Look"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* HOW TO PLAY ACCORDION */}
        {showGuide && (
          <div className="mt-3 p-3 bg-black/60 rounded-xl text-xs text-gray-300 space-y-1.5 border border-zinc-800 leading-relaxed">
            <div className="text-red-400 font-bold uppercase mb-1">🎮 GAME CONTROLS & RULES:</div>
            <div>• <strong>Aiming:</strong> Drag across screen or turn your phone if Gyro is ON.</div>
            <div>• <strong>Firing:</strong> Tap/Click anywhere on screen. Gun features a red laser sight and infinite ammo (no reload).</div>
            <div>• <strong>Surround Warnings:</strong> Watch the top compass radar for incoming zombies from behind or sides!</div>
            <div>• <strong>Health System:</strong> 150 HP max. Zombie bite = -10 HP. Gain +1 HP per kill, +5 HP per wave.</div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="relative z-10 text-[10px] text-gray-600 mt-4 text-center">
        VR MOB SHOOTER • HIGH-PERFORMANCE THREE.JS WEBGL ENGINE
      </div>
    </div>
  );
};
