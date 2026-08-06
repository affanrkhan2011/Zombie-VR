export type GameMode = 'HOME' | 'PLAY' | 'PRACTICE';

export type ZombieType = 'WALKER' | 'RUNNER' | 'TANK' | 'STALKER' | 'BOSS';

export interface Zombie {
  id: string;
  type: ZombieType;
  position: [number, number, number]; // [x, y, z] in world space
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  radius: number;
  rotationY: number;
  attackCooldown: number; // seconds
  isAttacking: boolean;
  hitFlashTime: number; // timestamp for red flash
  glowColor: string;
  isDead?: boolean;
  deathTime?: number;
}

export interface Target {
  id: string;
  position: [number, number, number];
  radius: number;
  points: number;
  isHit: boolean;
  hitTime: number;
  speed: number; // for moving targets
  axis: 'x' | 'y' | 'z';
  minRange: number;
  maxRange: number;
  direction: number;
}

export interface Particle {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  ammo: number;
  maxAmmo: number;
  reloadTimeInZone: number; // 0 to 2 seconds
  kills: number;
  wave: number;
  score: number;
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  practiceScore: number;
  practiceTargetsHit: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  gyroEnabled: boolean;
  sensitivity: number; // 0.5 to 3.0
  flashlightOn: boolean;
  vrStereoMode: boolean;
  laserColor: string; // '#CC5200' or '#00ff88'
}

export interface DirectionalWarning {
  direction: 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT';
  angle: number; // angle relative to camera view
  distance: number;
}
