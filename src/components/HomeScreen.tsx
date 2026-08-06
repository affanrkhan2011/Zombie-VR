import React, { useState } from 'react';
import { GameMode, GameSettings } from '../types';
import { Play, Volume2, VolumeX, Smartphone } from 'lucide-react';
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
    <div id="home-screen" className="relative w-full h-full bg-black text-white flex flex-col justify-between p-6 sm:p-12 select-none overflow-y-auto font-sans">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-600 to-black"></div>

      <div className="relative z-10 max-w-2xl mt-12">
        <h1 className="text-6xl sm:text-8xl font-display uppercase tracking-wider text-[#ff3300] leading-none">
          OUTBREAK
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-md font-mono">
          3D survival horror. Survive the horde.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-lg mt-16 space-y-8">
        <button
          onClick={() => handleStart('PLAY')}
          className="group w-full flex items-center justify-between py-4 border-b-2 border-red-900/50 hover:border-[#ff3300] transition-colors"
        >
          <span className="text-4xl sm:text-5xl font-display tracking-wide text-white group-hover:text-[#ff3300] transition-colors">
            SURVIVAL
          </span>
          <Play className="w-8 h-8 sm:w-10 sm:h-10 text-[#ff3300] opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all" />
        </button>

        <button
          onClick={() => handleStart('PRACTICE')}
          className="group w-full flex items-center justify-between py-4 border-b-2 border-zinc-900 hover:border-white transition-colors"
        >
          <span className="text-4xl sm:text-5xl font-display tracking-wide text-gray-500 group-hover:text-white transition-colors">
            PRACTICE
          </span>
          <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all" />
        </button>
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between mt-16 gap-8">
        <div className="flex gap-12 font-mono text-sm">
          <div>
            <div className="text-gray-500 uppercase">Best Wave</div>
            <div className="text-2xl text-white mt-1">{maxWave}</div>
          </div>
          <div>
            <div className="text-gray-500 uppercase">High Kills</div>
            <div className="text-2xl text-[#ff3300] mt-1">{highScore}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="text-sm font-mono text-gray-500 hover:text-white uppercase transition-colors"
          >
            {showGuide ? 'Close Info' : 'Rules'}
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`p-3 rounded-none transition-colors ${settings.soundEnabled ? 'bg-[#ff3300] text-black' : 'bg-zinc-900 text-gray-600'}`}
            >
              {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button
              onClick={() => onUpdateSettings({ gyroEnabled: !settings.gyroEnabled })}
              className={`p-3 rounded-none transition-colors ${settings.gyroEnabled ? 'bg-white text-black' : 'bg-zinc-900 text-gray-600'}`}
            >
              <Smartphone className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {showGuide && (
        <div className="relative z-20 mt-8 p-6 bg-zinc-900 text-sm font-mono text-gray-300 max-w-lg">
          <div className="text-[#ff3300] uppercase mb-4 text-base">Rules of Engagement</div>
          <ul className="space-y-3">
            <li><span className="text-white">Aim:</span> Drag to look. Rotate phone if Gyro ON.</li>
            <li><span className="text-white">Walk:</span> Use the bottom-left Virtual Joystick (or WASD / Arrow keys).</li>
            <li><span className="text-white">Fire:</span> Tap anywhere. Infinite ammo.</li>
            <li><span className="text-white">Health:</span> 150 HP. Bite = -10 HP.</li>
            <li><span className="text-white">Rewards:</span> +1 HP per kill, +5 HP per wave.</li>
          </ul>
        </div>
      )}
    </div>
  );
};
