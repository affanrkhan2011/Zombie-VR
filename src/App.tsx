import React, { useState, useEffect } from 'react';
import { GameMode, PlayerStats, GameSettings, DirectionalWarning } from './types';
import { HomeScreen } from './components/HomeScreen';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';

export default function App() {
  const [mode, setMode] = useState<GameMode>('HOME');

  const [stats, setStats] = useState<PlayerStats>({
    hp: 150,
    maxHp: 150,
    kills: 0,
    wave: 1,
    score: 0,
    shotsFired: 0,
    shotsHit: 0,
    headshots: 0,
    practiceScore: 0,
    practiceTargetsHit: 0,
  });

  const [settings, setSettings] = useState<GameSettings>({
    soundEnabled: true,
    gyroEnabled: true,
    sensitivity: 1.2,
    flashlightOn: true,
    vrStereoMode: false,
    laserColor: '#ff0033',
  });

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isDamaged, setIsDamaged] = useState<boolean>(false);
  const [warnings, setWarnings] = useState<DirectionalWarning[]>([]);
  const [waveBonusMessage, setWaveBonusMessage] = useState<string | null>(null);
  const [recenterSignal, setRecenterSignal] = useState<number>(0);

  // Persistent High Scores
  const [highScore, setHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('zombie_high_kills') || '0', 10);
  });
  const [maxWave, setMaxWave] = useState<number>(() => {
    return parseInt(localStorage.getItem('zombie_max_wave') || '1', 10);
  });

  const requestGyroPermission = async () => {
    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
      ) {
        await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      }
      if (
        typeof DeviceMotionEvent !== 'undefined' &&
        typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
      ) {
        await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      }
      setSettings(prev => ({ ...prev, gyroEnabled: true }));
    } catch (err) {
      console.warn('Gyro permission request:', err);
    }
  };

  // Start Game Mode
  const handleStartGame = (selectedMode: GameMode) => {
    requestGyroPermission();
    setMode(selectedMode);
    setIsPaused(false);
    setWaveBonusMessage(null);
    setRecenterSignal(prev => prev + 1);
    setStats({
      hp: 150,
      maxHp: 150,
      kills: 0,
      wave: 1,
      score: 0,
      shotsFired: 0,
      shotsHit: 0,
      headshots: 0,
      practiceScore: 0,
      practiceTargetsHit: 0,
    });
  };

  // Player Damaged (-10 HP per zombie bite)
  const handlePlayerHit = (damage: number) => {
    setIsDamaged(true);
    setTimeout(() => setIsDamaged(false), 250);

    setStats(prev => {
      const newHp = Math.max(0, prev.hp - damage);
      return { ...prev, hp: newHp };
    });
  };

  // Zombie Killed (+1 HP per kill)
  const handleZombieKill = (zombieId: string, isHeadshot: boolean) => {
    setStats(prev => {
      const newKills = prev.kills + 1;
      const newHeadshots = isHeadshot ? prev.headshots + 1 : prev.headshots;
      // Gain 1 HP per kill (up to 150 max)
      const newHp = Math.min(prev.maxHp, prev.hp + 1);

      if (newKills > highScore) {
        setHighScore(newKills);
        localStorage.setItem('zombie_high_kills', newKills.toString());
      }

      return {
        ...prev,
        kills: newKills,
        headshots: newHeadshots,
        hp: newHp,
        score: prev.score + (isHeadshot ? 250 : 100),
      };
    });
  };

  // Target Hit in Practice Mode
  const handleTargetHit = (targetId: string, isBullseye: boolean) => {
    setStats(prev => ({
      ...prev,
      practiceTargetsHit: prev.practiceTargetsHit + 1,
      practiceScore: prev.practiceScore + (isBullseye ? 200 : 100),
    }));
  };

  // Shot Fired Track Stats
  const handleShotFired = (hitSomething: boolean) => {
    setStats(prev => ({
      ...prev,
      shotsFired: prev.shotsFired + 1,
      shotsHit: hitSomething ? prev.shotsHit + 1 : prev.shotsHit,
    }));
  };

  // Wave Clear (+5 HP per wave)
  const handleWaveClear = () => {
    setWaveBonusMessage('+5 HP WAVE BONUS RESTORED!');

    setStats(prev => {
      const nextWave = prev.wave + 1;
      const newHp = Math.min(prev.maxHp, prev.hp + 5);

      if (nextWave > maxWave) {
        setMaxWave(nextWave);
        localStorage.setItem('zombie_max_wave', nextWave.toString());
      }

      return {
        ...prev,
        wave: nextWave,
        hp: newHp,
      };
    });

    setTimeout(() => {
      setWaveBonusMessage(null);
    }, 2800);
  };

  // Settings Update
  const handleUpdateSettings = (newSettings: Partial<GameSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative font-sans text-white select-none">
      {mode === 'HOME' ? (
        <HomeScreen
          onStartGame={handleStartGame}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          highScore={highScore}
          maxWave={maxWave}
        />
      ) : (
        <div className="relative w-full h-full">
          <GameCanvas
            mode={mode}
            settings={settings}
            isPaused={isPaused}
            wave={stats.wave}
            hp={stats.hp}
            recenterSignal={recenterSignal}
            onPlayerHit={handlePlayerHit}
            onZombieKill={handleZombieKill}
            onTargetHit={handleTargetHit}
            onShotFired={handleShotFired}
            onDirectionalUpdate={setWarnings}
            onWaveClear={handleWaveClear}
          />

          <GameHUD
            mode={mode}
            stats={stats}
            settings={settings}
            isPaused={isPaused}
            isDamaged={isDamaged}
            warnings={warnings}
            waveBonusMessage={waveBonusMessage}
            onTogglePause={() => setIsPaused(!isPaused)}
            onUpdateSettings={handleUpdateSettings}
            onRestartGame={() => handleStartGame(mode)}
            onExitHome={() => setMode('HOME')}
            onRecenterGyro={() => setRecenterSignal(prev => prev + 1)}
          />
        </div>
      )}
    </div>
  );
}
