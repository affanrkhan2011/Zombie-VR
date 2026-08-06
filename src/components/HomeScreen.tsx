import React from 'react';
import { GameMode, GameSettings } from '../types';
import { Play, Coins, Gem } from 'lucide-react';
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
  const handleStart = () => {
    soundManager.playGunshot();
    // Start game in PLAY mode regardless of VR toggle for now
    onStartGame('PLAY');
  };

  return (
    <div id="home-screen" className="relative w-full h-full bg-[#0A0A0C] text-white flex flex-col font-sans overflow-hidden select-none">
      
      {/* --- ATMOSPHERIC EFFECTS --- */}
      {/* Deep green ambient glow */}
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_bottom_center,rgba(13,31,18,0.8)_0%,rgba(10,10,12,1)_70%)]"></div>
      
      {/* Center glowing flare (orange) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] max-w-2xl max-h-[800px] bg-[radial-gradient(circle,rgba(204,82,0,0.12)_0%,rgba(10,10,12,0)_70%)] rounded-full blur-3xl pointer-events-none"></div>
      
      {/* CRT scanlines */}
      <div className="pointer-events-none absolute inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(204,82,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 mix-blend-overlay"></div>
      
      {/* Dark vignette edges */}
      <div className="pointer-events-none absolute inset-0 z-40 shadow-[inset_0_0_150px_rgba(0,0,0,0.95)]"></div>

      {/* Floating Embers Simulation (CSS inline styles for simple keyframes) */}
      <style>
        {`
          @keyframes float-ember {
            0% { transform: translateY(0) scale(1); opacity: 0; }
            20% { opacity: 0.8; }
            80% { opacity: 0.6; }
            100% { transform: translateY(-120px) scale(0.5); opacity: 0; }
          }
          .ember {
            position: absolute;
            bottom: 30%;
            background: #CC5200;
            border-radius: 50%;
            filter: blur(2px);
            animation: float-ember 4s infinite ease-in;
          }
        `}
      </style>
      {[...Array(12)].map((_, i) => (
        <div 
          key={i} 
          className="ember pointer-events-none z-10"
          style={{
            left: `${10 + Math.random() * 80}%`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${3 + Math.random() * 3}s`
          }}
        />
      ))}


      {/* --- TOP HEADER / STATUS BAR --- */}
      <div className="absolute top-0 w-full p-4 flex justify-end items-start z-30 pt-safe">
        {/* Center: Currency (Hidden on very small screens) */}
        <div className="hidden sm:flex gap-6 bg-[#0D1F12]/80 px-6 py-2 rounded-sm border border-[#CC5200]/20 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-mono text-sm text-yellow-100 font-bold">12.4K</span>
          </div>
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-purple-400" />
            <span className="font-mono text-sm text-purple-100 font-bold">340</span>
          </div>
        </div>
      </div>


      {/* --- HERO CENTERPIECE --- */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 pointer-events-none pt-12">
        <h1 
          className="text-[12vw] sm:text-8xl font-display uppercase tracking-widest text-transparent relative drop-shadow-[0_0_15px_rgba(204,82,0,0.8)]"
          style={{ WebkitTextStroke: '2px #CC5200' }}
        >
          ZOMBIE VR
        </h1>
        <p className="mt-4 text-xs sm:text-sm font-mono text-gray-400 uppercase tracking-[0.3em] opacity-80">
          Survive The Nightmare
        </p>
      </div>


      {/* --- PRIMARY ACTION AREA (Above Nav) --- */}
      <div className="absolute bottom-16 sm:bottom-20 w-full flex flex-col items-center z-30 pb-4">
        {/* PLAY NOW Button */}
        <button 
          onClick={handleStart}
          className="group relative px-12 sm:px-16 py-4 bg-[#CC5200] border border-[#e67300] overflow-hidden shadow-[0_0_40px_rgba(204,82,0,0.5)] hover:shadow-[0_0_60px_rgba(204,82,0,0.8)] transition-all active:scale-95"
        >
          <div className="absolute inset-0 bg-white/20 animate-pulse opacity-40 group-hover:opacity-80"></div>
          <span className="relative z-10 flex items-center gap-3 text-white">
            <Play className="w-8 h-8 fill-current drop-shadow-md" />
            <span className="font-display text-2xl sm:text-3xl uppercase tracking-[0.2em] drop-shadow-md">PLAY NOW</span>
          </span>
          
          {/* Tactical Corner Accents */}
          <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-white/80"></div>
          <div className="absolute top-1 right-1 w-2 h-2 border-t-2 border-r-2 border-white/80"></div>
          <div className="absolute bottom-1 left-1 w-2 h-2 border-b-2 border-l-2 border-white/80"></div>
          <div className="absolute bottom-1 right-1 w-2 h-2 border-b-2 border-r-2 border-white/80"></div>
        </button>
      </div>




    </div>
  );
};

