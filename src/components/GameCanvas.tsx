import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameMode, Zombie, ZombieType, Target, GameSettings, DirectionalWarning } from '../types';
import { soundManager } from '../utils/audio';

// --- THREE.JS DEVICE ORIENTATION MATHEMATICS ---
const zee = new THREE.Vector3(0, 0, 1);
const tempEuler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90 deg X rotation

const computeDeviceQuaternion = (alpha: number, beta: number, gamma: number, orient: number): THREE.Quaternion => {
  const alphaRad = alpha ? THREE.MathUtils.degToRad(alpha) : 0;
  const betaRad = beta ? THREE.MathUtils.degToRad(beta) : 0;
  const gammaRad = gamma ? THREE.MathUtils.degToRad(gamma) : 0;
  const orientRad = orient ? THREE.MathUtils.degToRad(orient) : 0;

  tempEuler.set(betaRad, alphaRad, -gammaRad, 'YXZ');
  const q = new THREE.Quaternion();
  q.setFromEuler(tempEuler);
  q.multiply(q1); // Orient camera looking down -Z axis
  q.multiply(q0.setFromAxisAngle(zee, -orientRad)); // Screen orientation compensation
  return q;
};

// RED ZOMBIE SPAWN POINTS (from map diagram)
const RED_ZOMBIE_SPAWNS = [
  { x: -12, z: -10 }, // Top-Left
  { x: -9, z: -3 },   // Upper-Left alcove
  { x: 5, z: -10 },   // Top-Center-Right
  { x: 12, z: -10 },  // Top-Right
  { x: -2, z: -1 },   // Center alcove
  { x: -12, z: 9 },   // Bottom-Left
  { x: 4, z: 9 },     // Bottom-Right-Center
];

// ORANGE BOSS SPAWN POINT (from map diagram)
const ORANGE_BOSS_SPAWN = { x: -12, z: 0 };

// BLUE PLAYER SPAWN POINT (from map diagram)
const BLUE_PLAYER_SPAWN = { x: 2, y: 1.6, z: -1 };

// Solid Interior Walls matching the diagram provided by user
const MAP_WALLS = [
  // Top-Left L-Wall Structure
  { x: -9.5, z: -6, width: 9, depth: 0.5 },
  { x: -5, z: -3, width: 0.5, depth: 6.5 },

  // Top-Right Structure
  { x: 3.5, z: -7, width: 9, depth: 0.5 },
  { x: 8, z: -8.5, width: 0.5, depth: 7 },
  { x: 9.8, z: -2.5, width: 0.5, depth: 5, rotY: Math.PI / 6 }, // Slanted wall

  // Center T-Wall
  { x: 0, z: -1.5, width: 0.5, depth: 5 },
  { x: -0.5, z: 1, width: 7, depth: 0.5 },

  // Bottom-Left Structure
  { x: -9.5, z: 5, width: 9, depth: 0.5 },
  { x: -3, z: 8.5, width: 0.5, depth: 7 },

  // Bottom-Right Angled Wall (position adjusted to not overlap green zone circle)
  { x: 5.5, z: 6.5, width: 0.5, depth: 5, rotY: -Math.PI / 4 }, // Slanted wall
];

// GREEN RELOAD ZONE CENTER & RADIUS
const GREEN_ZONE_CENTER = { x: 10.5, z: 6.5 };
const GREEN_ZONE_RADIUS = 2.8;

const isInGreenZone = (px: number, pz: number) => {
  const dx = px - GREEN_ZONE_CENTER.x;
  const dz = pz - GREEN_ZONE_CENTER.z;
  return (dx * dx + dz * dz) <= (GREEN_ZONE_RADIUS * GREEN_ZONE_RADIUS);
};

// Helper function to resolve player/zombie collisions against solid interior walls
const resolveMapCollisions = (pos: { x: number; z: number }, radius: number = 0.5, isZombie: boolean = false) => {
  MAP_WALLS.forEach(w => {
    let px = pos.x - w.x;
    let pz = pos.z - w.z;

    if (w.rotY) {
      const cos = Math.cos(-w.rotY);
      const sin = Math.sin(-w.rotY);
      const rx = px * cos - pz * sin;
      const rz = px * sin + pz * cos;
      px = rx;
      pz = rz;
    }

    const halfW = w.width / 2;
    const halfD = w.depth / 2;
    const minX = -halfW;
    const maxX = halfW;
    const minZ = -halfD;
    const maxZ = halfD;

    const closestX = THREE.MathUtils.clamp(px, minX, maxX);
    const closestZ = THREE.MathUtils.clamp(pz, minZ, maxZ);

    const dx = px - closestX;
    const dz = pz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      let pushX = 0;
      let pushZ = 0;
      if (dist > 0.0001) {
        const overlap = radius - dist;
        pushX = (dx / dist) * overlap;
        pushZ = (dz / dist) * overlap;
      } else {
        pushX = radius;
      }

      if (w.rotY) {
        const cos = Math.cos(w.rotY);
        const sin = Math.sin(w.rotY);
        const rx = pushX * cos - pushZ * sin;
        const rz = pushX * sin + pushZ * cos;
        pushX = rx;
        pushZ = rz;
      }

      pos.x += pushX;
      pos.z += pushZ;
    }
  });

  if (isZombie) {
    const dx = pos.x - GREEN_ZONE_CENTER.x;
    const dz = pos.z - GREEN_ZONE_CENTER.z;
    const distSq = dx * dx + dz * dz;
    const minZoneDist = GREEN_ZONE_RADIUS + radius;
    if (distSq < minZoneDist * minZoneDist && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const pushX = (dx / dist) * minZoneDist;
      const pushZ = (dz / dist) * minZoneDist;
      pos.x = GREEN_ZONE_CENTER.x + pushX;
      pos.z = GREEN_ZONE_CENTER.z + pushZ;
    }
  }
};

interface GameCanvasProps {
  mode: GameMode;
  settings: GameSettings;
  isPaused: boolean;
  wave: number;
  hp: number;
  ammo: number;
  recenterSignal?: number;
  onPlayerHit: (damage: number) => void;
  onZombieKill: (zombieId: string, isHeadshot: boolean) => void;
  onTargetHit: (targetId: string, isBullseye: boolean) => void;
  onShotFired: (hitSomething: boolean) => void;
  onReloadProgress: (progressTime: number, isRefilled: boolean) => void;
  onDirectionalUpdate: (warnings: DirectionalWarning[]) => void;
  onWaveClear: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  settings,
  isPaused,
  wave,
  hp,
  ammo,
  recenterSignal = 0,
  onPlayerHit,
  onZombieKill,
  onTargetHit,
  onShotFired,
  onReloadProgress,
  onDirectionalUpdate,
  onWaveClear,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Gun & Laser
  const gunGroupRef = useRef<THREE.Group | null>(null);
  const laserMeshRef = useRef<THREE.Mesh | null>(null);
  const muzzleFlashLightRef = useRef<THREE.PointLight | null>(null);
  const muzzleFlashMeshRef = useRef<THREE.Mesh | null>(null);
  const flashlightRef = useRef<THREE.SpotLight | null>(null);

  // Environment Refs
  const envMaterialsRef = useRef<{
    floor: THREE.MeshStandardMaterial;
    ceiling: THREE.MeshStandardMaterial;
    wall: THREE.MeshStandardMaterial;
  } | null>(null);

  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    emergency: THREE.PointLight;
    corner1: THREE.PointLight;
    corner2: THREE.PointLight;
  } | null>(null);

  // Game state refs inside loop
  const zombiesRef = useRef<Zombie[]>([]);
  const zombieMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const targetsRef = useRef<Target[]>([]);
  const targetMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const particlesRef = useRef<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[]>([]);

  // Camera rotation & Gyro state
  const yawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0);
  const recoilRef = useRef<number>(0);

  // Device orientation / Gyro refs
  const deviceQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const initialYawOffsetRef = useRef<number | null>(null);
  const hasGyroSensorRef = useRef<boolean>(false);

  // Wave & Spawning
  const lastSpawnTimeRef = useRef<number>(0);
  const totalWaveZombiesRef = useRef<number>(0);
  const spawnedWaveZombiesRef = useRef<number>(0);
  const killedWaveZombiesRef = useRef<number>(0);
  const bossesSpawnedInWaveRef = useRef<number>(0);
  const targetBossesInWaveRef = useRef<number>(0);
  const heartbeatTimerRef = useRef<number>(0);
  const lastSpatialGroanTimeRef = useRef<number>(0);

  // Reload Zone state
  const reloadTimeRef = useRef<number>(0);

  // Player Position & Walking Movement
  const walkDistanceRef = useRef<number>(0);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  // Virtual Joystick State for Walking Movement
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState<boolean>(false);
  const joystickVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const JOYSTICK_MAX_RADIUS = 40;

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    joystickTouchIdRef.current = e.pointerId;
    joystickOriginRef.current = { x: e.clientX, y: e.clientY };
    setIsJoystickActive(true);
    setJoystickPos({ x: 0, y: 0 });
    joystickVectorRef.current = { x: 0, y: 0 };
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isJoystickActive || joystickTouchIdRef.current !== e.pointerId) return;
    e.stopPropagation();

    const dx = e.clientX - joystickOriginRef.current.x;
    const dy = e.clientY - joystickOriginRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let clampedDx = dx;
    let clampedDy = dy;
    if (dist > JOYSTICK_MAX_RADIUS) {
      clampedDx = (dx / dist) * JOYSTICK_MAX_RADIUS;
      clampedDy = (dy / dist) * JOYSTICK_MAX_RADIUS;
    }

    setJoystickPos({ x: clampedDx, y: clampedDy });
    joystickVectorRef.current = {
      x: clampedDx / JOYSTICK_MAX_RADIUS,
      y: clampedDy / JOYSTICK_MAX_RADIUS,
    };
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickTouchIdRef.current === e.pointerId) {
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      joystickTouchIdRef.current = null;
      setIsJoystickActive(false);
      setJoystickPos({ x: 0, y: 0 });
      joystickVectorRef.current = { x: 0, y: 0 };
    }
  };

  // Keyboard Movement Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 1. Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    scene.fog = new THREE.FogExp2(0x0c0c14, 0.05);
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      100
    );
    camera.position.set(BLUE_PLAYER_SPAWN.x, BLUE_PLAYER_SPAWN.y, BLUE_PLAYER_SPAWN.z);
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- ENVIRONMENT & MAP BUILD ---
    buildRoomEnvironment(scene);

    // --- LIGHTS ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const emergencyLight = new THREE.PointLight(0xff1122, 0, 25);
    emergencyLight.position.set(0, 4.8, 0);
    scene.add(emergencyLight);

    const cornerLight1 = new THREE.PointLight(0x442200, 0, 18);
    cornerLight1.position.set(-8, 3, -8);
    scene.add(cornerLight1);

    const cornerLight2 = new THREE.PointLight(0x112244, 0, 18);
    cornerLight2.position.set(8, 3, 8);
    scene.add(cornerLight2);

    lightsRef.current = {
      ambient: ambientLight,
      emergency: emergencyLight,
      corner1: cornerLight1,
      corner2: cornerLight2
    };

    // --- FLASHLIGHT ---
    const flashlight = new THREE.SpotLight(0xfff0dd, 0, 22, Math.PI / 6, 0.4, 1.5);
    flashlight.position.set(0, 1.6, 0);
    flashlight.target.position.set(0, 1.6, -1);
    camera.add(flashlight);
    camera.add(flashlight.target);
    flashlightRef.current = flashlight;

    // --- GUN MODEL & LASER SIGHT ---
    const gunGroup = createGunModel();
    gunGroup.position.set(0.18, -0.22, -0.42);
    camera.add(gunGroup);
    scene.add(camera);
    gunGroupRef.current = gunGroup;

    // Laser Beam
    const laserMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(settings.laserColor || '#CC5200'),
      transparent: true,
      opacity: 0.85,
    });
    const laserGeo = new THREE.CylinderGeometry(0.003, 0.003, 1, 8);
    laserGeo.rotateX(Math.PI / 2);
    laserGeo.translate(0, 0, -0.5);
    const laserMesh = new THREE.Mesh(laserGeo, laserMat);
    gunGroup.add(laserMesh);
    laserMeshRef.current = laserMesh;

    // Muzzle Flash
    const muzzleLight = new THREE.PointLight(0xffaa22, 0, 5);
    gunGroup.add(muzzleLight);
    muzzleFlashLightRef.current = muzzleLight;

    const muzzleFlashGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0 });
    const muzzleFlashMesh = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
    muzzleFlashMesh.position.set(0, 0.05, -0.55);
    gunGroup.add(muzzleFlashMesh);
    muzzleFlashMeshRef.current = muzzleFlashMesh;

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      soundManager.stopAmbientDrone();
      soundManager.stopZombieBuzz();
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
    };
  }, []);

  // Update Laser Color
  useEffect(() => {
    if (laserMeshRef.current) {
      const col = new THREE.Color(settings.laserColor || '#CC5200');
      (laserMeshRef.current.material as THREE.MeshBasicMaterial).color = col;
    }
    soundManager.setMuted(!settings.soundEnabled);
  }, [settings]);

  // Setup / Reset Wave (Resets Player to Blue Spawn Point)
  useEffect(() => {
    // Reset Player to Blue Spawn Point after every wave
    if (cameraRef.current) {
      cameraRef.current.position.set(BLUE_PLAYER_SPAWN.x, BLUE_PLAYER_SPAWN.y, BLUE_PLAYER_SPAWN.z);
    }

    // Clear existing objects
    zombiesRef.current.forEach(z => removeZombieMesh(z.id));
    zombiesRef.current = [];
    targetsRef.current.forEach(t => removeTargetMesh(t.id));
    targetsRef.current = [];

    spawnedWaveZombiesRef.current = 0;
    killedWaveZombiesRef.current = 0;
    bossesSpawnedInWaveRef.current = 0;
    reloadTimeRef.current = 0;

    if (mode === 'PLAY') {
      const isBossWave = wave % 3 === 0;
      const numBosses = isBossWave ? Math.floor(wave / 3) : 0;
      targetBossesInWaveRef.current = numBosses;
      const baseZombies = 5 + wave * 4;
      totalWaveZombiesRef.current = baseZombies + numBosses;
    } else if (mode === 'PRACTICE') {
      spawnPracticeTargets();
    }
  }, [mode, wave]);

  // Recenter signal trigger from HUD
  useEffect(() => {
    initialYawOffsetRef.current = null;
  }, [recenterSignal]);

  // Handle Gyroscope Orientation
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!settings.gyroEnabled) return;
      if (e.alpha === null && e.beta === null && e.gamma === null) return;

      hasGyroSensorRef.current = true;

      const alpha = e.alpha || 0;
      const beta = e.beta || 0;
      const gamma = e.gamma || 0;
      const orient = (window.orientation as number) || (screen.orientation ? screen.orientation.angle : 0) || 0;

      const qRaw = computeDeviceQuaternion(alpha, beta, gamma, orient);

      const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(qRaw);
      const heading = Math.atan2(forwardVec.x, -forwardVec.z);

      if (initialYawOffsetRef.current === null) {
        initialYawOffsetRef.current = heading;
      }

      const yawOffset = initialYawOffsetRef.current;
      const yawOffsetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yawOffset);

      deviceQuatRef.current.copy(yawOffsetQuat).multiply(qRaw);
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [settings.gyroEnabled]);

  // --- ROOM BUILDER ---
  const buildRoomEnvironment = (scene: THREE.Scene) => {
    const roomSize = 30;
    const roomHeight = 7;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(roomSize, roomSize, 32, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x22252e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid helper on floor
    const gridHelper = new THREE.GridHelper(roomSize, 30, 0x556677, 0x333b47);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.9 });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    scene.add(ceiling);

    // 4 Outer Boundary Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2d333f,
      roughness: 0.6,
      metalness: 0.3,
    });

    const wallGeos = [
      { pos: [0, roomHeight / 2, -roomSize / 2], rot: [0, 0, 0] },
      { pos: [0, roomHeight / 2, roomSize / 2], rot: [0, Math.PI, 0] },
      { pos: [-roomSize / 2, roomHeight / 2, 0], rot: [0, Math.PI / 2, 0] },
      { pos: [roomSize / 2, roomHeight / 2, 0], rot: [0, -Math.PI / 2, 0] },
    ];

    wallGeos.forEach(w => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomHeight), wallMat);
      wall.position.set(w.pos[0], w.pos[1], w.pos[2]);
      wall.rotation.set(w.rot[0], w.rot[1], w.rot[2]);
      wall.receiveShadow = true;
      scene.add(wall);
    });

    // SOLID INTERIOR WALL BARRIERS (from diagram) WITH GLOWING WHITE CAP STRIPS
    const interiorWallMat = new THREE.MeshStandardMaterial({
      color: 0x3f4656,
      roughness: 0.5,
      metalness: 0.4,
    });

    const glowCapMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    MAP_WALLS.forEach((w) => {
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(w.width, 3.5, w.depth), interiorWallMat);
      wallMesh.position.set(w.x, 1.75, w.z);
      if (w.rotY) wallMesh.rotation.y = w.rotY;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      scene.add(wallMesh);

      // Glowing White Cap Strip on top of each wall
      const glowCap = new THREE.Mesh(new THREE.BoxGeometry(w.width + 0.1, 0.12, w.depth + 0.1), glowCapMat);
      glowCap.position.set(w.x, 3.52, w.z);
      if (w.rotY) glowCap.rotation.y = w.rotY;
      scene.add(glowCap);
    });

    // BLUE PLAYER SPAWN POINT MARKER (Center-Right) - Vibrant Blue Glow
    const playerSpawnCircle = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.9, 32),
      new THREE.MeshBasicMaterial({ color: 0x00aaff, side: THREE.DoubleSide })
    );
    playerSpawnCircle.rotation.x = -Math.PI / 2;
    playerSpawnCircle.position.set(BLUE_PLAYER_SPAWN.x, 0.02, BLUE_PLAYER_SPAWN.z);
    scene.add(playerSpawnCircle);

    // Glowing Blue Vertical Pillar
    const blueBeamGeo = new THREE.CylinderGeometry(0.85, 0.85, 3.5, 24, 1, true);
    const blueBeamMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const blueBeam = new THREE.Mesh(blueBeamGeo, blueBeamMat);
    blueBeam.position.set(BLUE_PLAYER_SPAWN.x, 1.75, BLUE_PLAYER_SPAWN.z);
    scene.add(blueBeam);

    const blueLight = new THREE.PointLight(0x00aaff, 2.5, 6);
    blueLight.position.set(BLUE_PLAYER_SPAWN.x, 0.8, BLUE_PLAYER_SPAWN.z);
    scene.add(blueLight);

    // GREEN RELOAD ZONE (Bottom-Right Circle Pad & Light Pillar)
    const reloadZoneGeo = new THREE.CircleGeometry(GREEN_ZONE_RADIUS, 32);
    const reloadZoneMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      roughness: 0.1,
      emissive: 0x00ff88,
      emissiveIntensity: 1.2,
      side: THREE.DoubleSide,
    });
    const reloadZone = new THREE.Mesh(reloadZoneGeo, reloadZoneMat);
    reloadZone.rotation.x = -Math.PI / 2;
    reloadZone.position.set(GREEN_ZONE_CENTER.x, 0.02, GREEN_ZONE_CENTER.z);
    scene.add(reloadZone);

    // Green Translucent Light Pillar Beam
    const greenBeamGeo = new THREE.CylinderGeometry(GREEN_ZONE_RADIUS, GREEN_ZONE_RADIUS, 4.0, 32, 1, true);
    const greenBeamMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
    const greenBeam = new THREE.Mesh(greenBeamGeo, greenBeamMat);
    greenBeam.position.set(GREEN_ZONE_CENTER.x, 2.0, GREEN_ZONE_CENTER.z);
    scene.add(greenBeam);

    const greenZoneLight = new THREE.PointLight(0x00ff88, 5.0, 12);
    greenZoneLight.position.set(GREEN_ZONE_CENTER.x, 1.5, GREEN_ZONE_CENTER.z);
    scene.add(greenZoneLight);

    // RED ZOMBIE SPAWN MARKERS - Glowing Red Shapes & Light Pillars
    RED_ZOMBIE_SPAWNS.forEach(sp => {
      const redCircleMat = new THREE.MeshBasicMaterial({ color: 0xCC5200, side: THREE.DoubleSide });
      const redCircle = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.65, 24), redCircleMat);
      redCircle.rotation.x = -Math.PI / 2;
      redCircle.position.set(sp.x, 0.02, sp.z);
      scene.add(redCircle);

      const redPillarGeo = new THREE.CylinderGeometry(0.6, 0.6, 3.5, 16, 1, true);
      const redPillarMat = new THREE.MeshBasicMaterial({ color: 0xCC5200, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      const redPillar = new THREE.Mesh(redPillarGeo, redPillarMat);
      redPillar.position.set(sp.x, 1.75, sp.z);
      scene.add(redPillar);

      const redLight = new THREE.PointLight(0xCC5200, 2.5, 5);
      redLight.position.set(sp.x, 0.8, sp.z);
      scene.add(redLight);
    });

    // PURPLE BOSS SPAWN MARKER (Left Wall) - Glowing Purple Star Shape & Light Beam
    const bossStarGeo = new THREE.RingGeometry(0.3, 1.2, 5);
    const bossStarMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, side: THREE.DoubleSide });
    const bossStar = new THREE.Mesh(bossStarGeo, bossStarMat);
    bossStar.rotation.x = -Math.PI / 2;
    bossStar.position.set(ORANGE_BOSS_SPAWN.x, 0.02, ORANGE_BOSS_SPAWN.z);
    scene.add(bossStar);

    const purplePillarGeo = new THREE.CylinderGeometry(1.1, 1.1, 4.0, 20, 1, true);
    const purplePillarMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const purplePillar = new THREE.Mesh(purplePillarGeo, purplePillarMat);
    purplePillar.position.set(ORANGE_BOSS_SPAWN.x, 2.0, ORANGE_BOSS_SPAWN.z);
    scene.add(purplePillar);

    const purpleLight = new THREE.PointLight(0xaa00ff, 4.5, 8);
    purpleLight.position.set(ORANGE_BOSS_SPAWN.x, 1.0, ORANGE_BOSS_SPAWN.z);
    scene.add(purpleLight);

    envMaterialsRef.current = {
      floor: floorMat,
      ceiling: ceilingMat,
      wall: wallMat,
    };
  };

  // --- GUN MODEL GENERATOR ---
  const createGunModel = (): THREE.Group => {
    const gun = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
    const redMat = new THREE.MeshBasicMaterial({ color: 0xCC5200 });

    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.55), metalMat);
    gun.add(barrel);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.08, 0.5), metalMat);
    slide.position.set(0, 0.06, -0.02);
    gun.add(slide);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.12), darkMat);
    grip.position.set(0, -0.14, 0.15);
    grip.rotation.x = -0.3;
    gun.add(grip);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.1), metalMat);
    guard.position.set(0, -0.08, 0.05);
    gun.add(guard);

    const laserBox = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), darkMat);
    laserBox.position.set(0, -0.07, -0.18);
    gun.add(laserBox);

    const laserLens = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), redMat);
    laserLens.position.set(0, -0.07, -0.24);
    gun.add(laserLens);

    return gun;
  };

  // --- ZOMBIE 3D MODEL GENERATOR (Includes BIG PURPLE BOSS ZOMBIE!) ---
  const createZombieMesh = (zombie: Zombie): THREE.Group => {
    const group = new THREE.Group();

    let bodyColor = 0xff6600; // Vibrant Orange for WALKER
    let clothesColor = 0xcc5200;
    let eyeColor = 0xCC5200;
    let scale = 1.0;

    if (zombie.type === 'BOSS') {
      bodyColor = 0x8800cc; // Vibrant Deep Purple Boss!
      clothesColor = 0x440077;
      eyeColor = 0xe066ff; // Glowing violet eyes
      scale = 2.2; // Huge Boss Zombie!
    } else if (zombie.type === 'RUNNER') {
      bodyColor = 0xff3300;
      clothesColor = 0xb32400;
      scale = 0.88;
    } else if (zombie.type === 'TANK') {
      bodyColor = 0xe65c00;
      clothesColor = 0x993d00;
      scale = 1.5;
    } else if (zombie.type === 'STALKER') {
      bodyColor = 0xff8800;
      clothesColor = 0xb35900;
      scale = 1.05;
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.4,
      emissive: new THREE.Color(bodyColor),
      emissiveIntensity: zombie.type === 'BOSS' ? 0.25 : 0.02,
    });

    const clothesMat = new THREE.MeshStandardMaterial({
      color: clothesColor,
      roughness: 0.5,
      emissive: new THREE.Color(clothesColor),
      emissiveIntensity: zombie.type === 'BOSS' ? 0.2 : 0.02,
    });

    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6 * scale, 0.8 * scale, 0.35 * scale), clothesMat);
    torso.position.y = 1.0 * scale;
    torso.name = 'torso';
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.45 * scale, 0.4 * scale), bodyMat);
    head.position.y = 1.65 * scale;
    head.name = 'head'; // For headshot detection!
    head.castShadow = true;
    group.add(head);

    // Eyes
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 10, 10), eyeMat);
    leftEye.position.set(-0.11 * scale, 1.68 * scale, -0.21 * scale);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 10, 10), eyeMat);
    rightEye.position.set(0.11 * scale, 1.68 * scale, -0.21 * scale);
    group.add(rightEye);

    // Arms
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.7 * scale, 0.2 * scale), bodyMat);
    leftArm.position.set(-0.42 * scale, 1.0 * scale, -0.2 * scale);
    leftArm.rotation.x = -Math.PI / 3;
    leftArm.name = 'leftArm';
    group.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.7 * scale, 0.2 * scale), bodyMat);
    rightArm.position.set(0.42 * scale, 1.0 * scale, -0.2 * scale);
    rightArm.rotation.x = -Math.PI / 3;
    rightArm.name = 'rightArm';
    group.add(rightArm);

    // Legs
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.8 * scale, 0.22 * scale), clothesMat);
    leftLeg.position.set(-0.18 * scale, 0.4 * scale, 0);
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22 * scale, 0.8 * scale, 0.22 * scale), clothesMat);
    rightLeg.position.set(0.18 * scale, 0.4 * scale, 0);
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

    // 3D Floating Health Bar above head
    const healthBarGroup = new THREE.Group();
    healthBarGroup.name = 'healthBarGroup';
    healthBarGroup.position.set(0, 2.15 * scale, 0);

    const isBoss = zombie.type === 'BOSS';
    const numBlocks = isBoss ? 20 : 3;
    const totalBarWidth = isBoss ? 2.4 * scale : 0.96 * scale;
    const barHeight = 0.28 * scale;

    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x0a0c10, side: THREE.DoubleSide });
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(totalBarWidth, barHeight), barBgMat);
    healthBarGroup.add(barBg);

    const barBorderMat = new THREE.MeshBasicMaterial({ color: isBoss ? 0x9900ff : 0x383b4a, side: THREE.DoubleSide });
    const barBorder = new THREE.Mesh(new THREE.PlaneGeometry(totalBarWidth + 0.06 * scale, barHeight + 0.06 * scale), barBorderMat);
    barBorder.position.z = -0.001;
    healthBarGroup.add(barBorder);

    // Discrete Blocks for Health Bar (20 blocks for BOSS, 3 blocks for normal)
    const blockWidth = (totalBarWidth / numBlocks) * 0.82;
    const blockHeight = 0.18 * scale;
    const blockGap = (totalBarWidth / numBlocks) * 0.18;
    const startX = -totalBarWidth / 2 + blockWidth / 2 + blockGap / 2;

    for (let i = 0; i < numBlocks; i++) {
      const blockGeo = new THREE.PlaneGeometry(blockWidth, blockHeight);
      const blockMat = new THREE.MeshBasicMaterial({ color: isBoss ? 0xcc00ff : 0x00ff66, side: THREE.DoubleSide });
      const blockMesh = new THREE.Mesh(blockGeo, blockMat);
      blockMesh.name = `healthBlock_${i}`;
      blockMesh.position.set(startX + i * (blockWidth + blockGap), 0, 0.002);
      healthBarGroup.add(blockMesh);
    }

    group.add(healthBarGroup);
    group.position.set(zombie.position[0], zombie.position[1], zombie.position[2]);
    return group;
  };

  // --- PRACTICE TARGETS GENERATOR ---
  const spawnPracticeTargets = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    targetsRef.current.forEach(t => removeTargetMesh(t.id));
    targetsRef.current = [];

    const targetConfigs: { pos: [number, number, number]; speed?: number; axis?: 'x' | 'y' | 'z'; points: number }[] = [
      { pos: [0, 1.8, -8], points: 100 },
      { pos: [6, 2.2, -6], speed: 1.5, axis: 'x', points: 150 },
      { pos: [-7, 1.5, -5], speed: 1.2, axis: 'y', points: 150 },
      { pos: [9, 2.0, 0], points: 100 },
      { pos: [-8, 2.5, 2], speed: 2.0, axis: 'x', points: 200 },
      { pos: [0, 1.8, 8], speed: 1.8, axis: 'x', points: 150 },
      { pos: [-6, 2.0, 7], points: 100 },
      { pos: [7, 1.6, 6], speed: 2.2, axis: 'z', points: 200 },
    ];

    targetConfigs.forEach((cfg, idx) => {
      const id = `target_${idx}_${Date.now()}`;
      const targetData: Target = {
        id,
        position: cfg.pos,
        radius: 0.6,
        points: cfg.points,
        isHit: false,
        hitTime: 0,
        speed: cfg.speed || 0,
        axis: cfg.axis || 'x',
        minRange: cfg.pos[0] - 3,
        maxRange: cfg.pos[0] + 3,
        direction: 1,
      };

      targetsRef.current.push(targetData);

      const targetGroup = new THREE.Group();

      const outerRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.08, 24),
        new THREE.MeshStandardMaterial({ color: 0xcc1122, roughness: 0.4 })
      );
      outerRing.rotation.x = Math.PI / 2;
      targetGroup.add(outerRing);

      const midRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24),
        new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 })
      );
      midRing.rotation.x = Math.PI / 2;
      targetGroup.add(midRing);

      const bullseye = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.2 })
      );
      bullseye.rotation.x = Math.PI / 2;
      bullseye.name = 'bullseye';
      targetGroup.add(bullseye);

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, cfg.pos[1], 12),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
      );
      post.position.y = -cfg.pos[1] / 2;
      targetGroup.add(post);

      targetGroup.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      targetGroup.lookAt(0, cfg.pos[1], 0);

      scene.add(targetGroup);
      targetMeshesRef.current.set(id, targetGroup);
    });
  };

  const removeZombieMesh = (id: string) => {
    const mesh = zombieMeshesRef.current.get(id);
    if (mesh && sceneRef.current) {
      sceneRef.current.remove(mesh);
      zombieMeshesRef.current.delete(id);
    }
  };

  const removeTargetMesh = (id: string) => {
    const mesh = targetMeshesRef.current.get(id);
    if (mesh && sceneRef.current) {
      sceneRef.current.remove(mesh);
      targetMeshesRef.current.delete(id);
    }
  };

  // --- ZOMBIE SPAWNING (Standard Red Dots & Boss at Orange Star every 3 waves) ---
  const spawnZombieInWave = () => {
    if (spawnedWaveZombiesRef.current >= totalWaveZombiesRef.current) return;

    let isBossToSpawn = false;
    if (bossesSpawnedInWaveRef.current < targetBossesInWaveRef.current) {
      isBossToSpawn = true;
      bossesSpawnedInWaveRef.current++;
    }

    let x = 0;
    let z = 0;
    let type: ZombieType = 'WALKER';
    let speed = 1.3 + wave * 0.15;
    let maxHealth = 150; // 3 normal shots (50 hp per shot)
    let damage = 10;

    if (isBossToSpawn) {
      // Boss Spawns around Orange Star (-12, 0) with slight offsets if multiple
      const offset = (bossesSpawnedInWaveRef.current - 1) * 2.0;
      x = ORANGE_BOSS_SPAWN.x + offset;
      z = ORANGE_BOSS_SPAWN.z;
      type = 'BOSS';
      speed = 1.1 + wave * 0.05;
      maxHealth = 1000; // Takes 20 body shots (or 10 headshots!)
      damage = 25;
    } else {
      // Standard zombies spawn at one of the 7 Red Dots
      const redPoint = RED_ZOMBIE_SPAWNS[Math.floor(Math.random() * RED_ZOMBIE_SPAWNS.length)];
      x = redPoint.x;
      z = redPoint.z;

      const rand = Math.random();
      if (wave >= 2 && rand > 0.6) {
        type = 'RUNNER';
        speed = 2.8 + wave * 0.2;
      } else if (wave >= 3 && rand > 0.85) {
        type = 'TANK';
        speed = 0.8 + wave * 0.1;
      } else if (wave >= 4 && rand > 0.7) {
        type = 'STALKER';
        speed = 2.0;
      }
    }

    const id = `zombie_${Date.now()}_${Math.random()}`;
    const zombie: Zombie = {
      id,
      type,
      position: [x, 0, z],
      health: maxHealth,
      maxHealth,
      speed,
      damage,
      radius: type === 'BOSS' ? 1.8 : type === 'TANK' ? 1.2 : 0.7,
      rotationY: 0,
      attackCooldown: 0,
      isAttacking: false,
      hitFlashTime: 0,
      glowColor: type === 'BOSS' ? '#aa00ff' : type === 'RUNNER' ? '#CC5200' : '#00ff66',
    };

    zombiesRef.current.push(zombie);
    spawnedWaveZombiesRef.current++;

    if (cameraRef.current) {
      soundManager.playDoorSpawnSound({ x, y: 0, z }, cameraRef.current.position, yawRef.current);
      soundManager.playSpatialZombieGroan({ x, y: 1.0, z }, cameraRef.current.position, yawRef.current, type === 'BOSS' ? 'TANK' : type);
    }

    if (sceneRef.current) {
      const mesh = createZombieMesh(zombie);
      sceneRef.current.add(mesh);
      zombieMeshesRef.current.set(id, mesh);

      soundManager.playZombieGroan(type === 'BOSS' ? 0.4 : type === 'TANK' ? 0.6 : type === 'RUNNER' ? 1.4 : 1.0);
    }
  };

  // --- PARTICLES ---
  const createExplosionParticles = (pos: THREE.Vector3, color: string, count: number = 15) => {
    const scene = sceneRef.current;
    if (!scene) return;

    for (let i = 0; i < count; i++) {
      const isWhite = color === '#ffffff';
      const size = isWhite ? 0.15 + Math.random() * 0.1 : 0.05;
      const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
      const pMesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), pMat);

      pMesh.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.2) * 6,
        (Math.random() - 0.5) * 6
      );

      scene.add(pMesh);
      particlesRef.current.push({
        mesh: pMesh,
        vel,
        life: 0,
        maxLife: isWhite ? 1.0 + Math.random() * 1.5 : 0.4 + Math.random() * 0.3,
      });
    }
  };

  const finalizeZombieRemoval = (zId: string) => {
    removeZombieMesh(zId);
    const idx = zombiesRef.current.findIndex(z => z.id === zId);
    if (idx !== -1) {
      zombiesRef.current.splice(idx, 1);
      killedWaveZombiesRef.current++;
    }
    if (
      killedWaveZombiesRef.current >= totalWaveZombiesRef.current &&
      zombiesRef.current.length === 0
    ) {
      soundManager.playWaveComplete();
      onWaveClear();
    }
  };

  // --- SHOOTING MECHANIC (Respects 30 ammo limit & Boss Headshot -2 HP rule) ---
  const handleShoot = () => {
    if (isPaused || !cameraRef.current || !sceneRef.current) return;

    // GREEN ZONE CHECK: Do NOT allow shooting while standing in the Circular Green Reload Zone
    if (cameraRef.current) {
      const px = cameraRef.current.position.x;
      const pz = cameraRef.current.position.z;
      if (isInGreenZone(px, pz)) {
        soundManager.playEmptyClick();
        return;
      }
    }

    // AMMO CHECK: If 0 ammo, play empty click sound & refuse to shoot!
    if (ammo <= 0) {
      soundManager.playEmptyClick();
      return;
    }

    // Audio FX & Recoil
    soundManager.playGunshot();
    soundManager.playLaserZap();
    recoilRef.current = 0.12;

    // Muzzle Flash
    if (muzzleFlashLightRef.current && muzzleFlashMeshRef.current) {
      muzzleFlashLightRef.current.intensity = 4;
      (muzzleFlashMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 1;
      setTimeout(() => {
        if (muzzleFlashLightRef.current) muzzleFlashLightRef.current.intensity = 0;
        if (muzzleFlashMeshRef.current) {
          (muzzleFlashMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      }, 50);
    }

    // Raycast from Camera Center
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);

    let hitSomething = false;

    if (mode === 'PLAY') {
      let closestHitDist = Infinity;
      let hitZombieId: string | null = null;
      let isHeadshot = false;
      let hitPoint: THREE.Vector3 | null = null;

      zombiesRef.current.forEach(z => {
        if (z.isDead) return;
        const meshGroup = zombieMeshesRef.current.get(z.id);
        if (!meshGroup) return;

        const intersects = raycaster.intersectObjects(meshGroup.children, true);
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.distance < closestHitDist) {
            closestHitDist = hit.distance;
            hitZombieId = z.id;
            hitPoint = hit.point;
            isHeadshot = hit.object.name === 'head';
          }
        }
      });

      if (hitZombieId && hitPoint) {
        hitSomething = true;
        const zIndex = zombiesRef.current.findIndex(z => z.id === hitZombieId);
        if (zIndex !== -1) {
          const z = zombiesRef.current[zIndex];
          if (!z.isDead) {
            // BOSS ZOMBIE RULE:
            // "being able to take 20 shots, headshots do -2hp for him, boss will be a big purple zombie"
            // Body shot = 50 damage (1 shot = -1 block out of 20)
            // Headshot on Boss = 100 damage (2 shots = -2 blocks out of 20)
            // Standard Zombie: Headshot = instant kill, Body shot = 50 damage
            let damage = 50;
            if (z.type === 'BOSS') {
              damage = isHeadshot ? 100 : 50; // Headshot does -2 HP (100 damage out of 1000)
            } else {
              damage = isHeadshot ? z.maxHealth + 999 : 50;
            }

            z.health -= damage;
            z.hitFlashTime = Date.now();

            soundManager.playZombieHit();
            createExplosionParticles(hitPoint, isHeadshot ? '#CC5200' : '#e2e8f0', isHeadshot ? 30 : 15);

            if (z.health <= 0) {
              z.health = 0;
              z.isDead = true;

              createExplosionParticles(hitPoint, z.type === 'BOSS' ? '#aa00ff' : isHeadshot ? '#CC5200' : '#ffffff', 50);
              onZombieKill(z.id, isHeadshot);
              finalizeZombieRemoval(z.id);
            }
          }
        }
      }
    } else if (mode === 'PRACTICE') {
      let closestHitDist = Infinity;
      let hitTargetId: string | null = null;
      let isBullseye = false;
      let hitPoint: THREE.Vector3 | null = null;

      targetsRef.current.forEach(t => {
        const meshGroup = targetMeshesRef.current.get(t.id);
        if (!meshGroup) return;

        const intersects = raycaster.intersectObjects(meshGroup.children, true);
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.distance < closestHitDist) {
            closestHitDist = hit.distance;
            hitTargetId = t.id;
            hitPoint = hit.point;
            isBullseye = hit.object.name === 'bullseye';
          }
        }
      });

      if (hitTargetId && hitPoint) {
        hitSomething = true;
        soundManager.playTargetHit();
        createExplosionParticles(hitPoint, isBullseye ? '#ffcc00' : '#ffffff', 20);
        onTargetHit(hitTargetId, isBullseye);

        const targetGroup = targetMeshesRef.current.get(hitTargetId);
        if (targetGroup) {
          targetGroup.rotation.x += Math.PI / 4;
          setTimeout(() => {
            if (targetGroup) targetGroup.rotation.x = 0;
          }, 300);
        }
      }
    }

    onShotFired(hitSomething);
  };

  // --- DESKTOP FALLBACK LOOK ---
  const handlePointerMove = (e: React.PointerEvent) => {
    if (hasGyroSensorRef.current && settings.gyroEnabled) return;

    if (e.buttons === 1 || e.pointerType === 'mouse') {
      const sens = (settings.sensitivity || 1.2) * 0.003;
      yawRef.current -= e.movementX * sens;
      pitchRef.current -= e.movementY * sens;
      pitchRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitchRef.current));
    }
  };

  // --- MAIN GAME LOOP (60 FPS) ---
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      if (isPaused) return;

      const camera = cameraRef.current;
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      if (!camera || !scene || !renderer) return;

      // 1. UPDATE CAMERA ROTATION
      if (hasGyroSensorRef.current && settings.gyroEnabled) {
        camera.quaternion.copy(deviceQuatRef.current);

        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        yawRef.current = Math.atan2(-lookDir.x, -lookDir.z);
        pitchRef.current = Math.asin(THREE.MathUtils.clamp(lookDir.y, -0.98, 0.98));
      } else {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.x = pitchRef.current;
        euler.y = yawRef.current;
        camera.quaternion.setFromEuler(euler);
      }

      // 1.5 PLAYER WALKING MOVEMENT
      const jx = joystickVectorRef.current.x;
      const jy = joystickVectorRef.current.y;

      const moveFwdKey = keysPressedRef.current['w'] || keysPressedRef.current['arrowup'];
      const moveBackKey = keysPressedRef.current['s'] || keysPressedRef.current['arrowdown'];
      const moveLeftKey = keysPressedRef.current['a'] || keysPressedRef.current['arrowleft'];
      const moveRightKey = keysPressedRef.current['d'] || keysPressedRef.current['arrowright'];

      let fwdInput = -jy;
      if (moveFwdKey) fwdInput += 1;
      if (moveBackKey) fwdInput -= 1;

      let strafeInput = jx;
      if (moveRightKey) strafeInput += 1;
      if (moveLeftKey) strafeInput -= 1;

      fwdInput = THREE.MathUtils.clamp(fwdInput, -1, 1);
      strafeInput = THREE.MathUtils.clamp(strafeInput, -1, 1);

      if (Math.abs(fwdInput) > 0.05 || Math.abs(strafeInput) > 0.05) {
        const moveSpeed = 3.8;
        const forwardDir = new THREE.Vector3();
        camera.getWorldDirection(forwardDir);
        forwardDir.y = 0;
        forwardDir.normalize();

        const rightDir = new THREE.Vector3().crossVectors(forwardDir, new THREE.Vector3(0, 1, 0)).normalize();

        const moveVec = new THREE.Vector3()
          .addScaledVector(forwardDir, fwdInput)
          .addScaledVector(rightDir, strafeInput);

        if (moveVec.length() > 1) moveVec.normalize();

        camera.position.addScaledVector(moveVec, moveSpeed * delta);

        walkDistanceRef.current += delta * moveSpeed * moveVec.length();
        const headBob = Math.sin(walkDistanceRef.current * 10) * 0.04;
        camera.position.y = 1.6 + headBob;
      } else {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.6, 0.1);
      }

      // Prevent player from walking through interior map walls & crates
      resolveMapCollisions(camera.position, 0.5);

      // Outer room boundaries
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -13.5, 13.5);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -13.5, 13.5);

      // 1.8 GREEN RELOAD ZONE LOGIC (Circular Zone)
      if (mode === 'PLAY') {
        const px = camera.position.x;
        const pz = camera.position.z;
        if (isInGreenZone(px, pz)) {
          if (ammo < 30) {
            reloadTimeRef.current += delta;
            if (reloadTimeRef.current >= 2.0) {
              soundManager.playReloadComplete();
              onReloadProgress(2.0, true); // Refills ammo to 30
              reloadTimeRef.current = 0;
            } else {
              onReloadProgress(reloadTimeRef.current, false);
            }
          } else {
            reloadTimeRef.current = 0;
            onReloadProgress(0, false);
          }
        } else {
          if (reloadTimeRef.current > 0) {
            reloadTimeRef.current = 0;
            onReloadProgress(0, false);
          }
        }
      }

      // Recoil Recovery
      if (recoilRef.current > 0) {
        pitchRef.current += recoilRef.current * 0.3;
        recoilRef.current = Math.max(0, recoilRef.current - delta * 1.5);
      }

      // 2. LASER BEAM TARGETING
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let laserDist = 25;
      if (intersects.length > 0) {
        for (const hit of intersects) {
          if (hit.object !== laserMeshRef.current) {
            laserDist = hit.distance;
            break;
          }
        }
      }

      if (laserMeshRef.current) {
        laserMeshRef.current.scale.set(1, 1, laserDist);
      }

      // 3. PLAY MODE: ZOMBIE AI & SPAWNING
      if (mode === 'PLAY') {
        if (
          spawnedWaveZombiesRef.current < totalWaveZombiesRef.current &&
          currentTime - lastSpawnTimeRef.current > Math.max(1200, 3200 - wave * 300)
        ) {
          spawnZombieInWave();
          lastSpawnTimeRef.current = currentTime;
        }

        const playerPos = camera.position.clone();
        playerPos.y = 0;
        const warnings: DirectionalWarning[] = [];
        const idsToRemove: string[] = [];
        let minZombieDist = Infinity;
        let closestDx = 0;
        let closestDz = 0;

        zombiesRef.current.forEach(z => {
          const meshGroup = zombieMeshesRef.current.get(z.id);
          if (!meshGroup) return;

          if (z.isDead) {
            idsToRemove.push(z.id);
            return;
          }

          const zPos = new THREE.Vector3(z.position[0], 0, z.position[2]);
          const dirToPlayer = new THREE.Vector3().subVectors(playerPos, zPos).normalize();
          const distToPlayer = zPos.distanceTo(playerPos);

          const dx = z.position[0] - camera.position.x;
          const dz = z.position[2] - camera.position.z;

          if (distToPlayer < minZombieDist) {
            minZombieDist = distToPlayer;
            closestDx = dx;
            closestDz = dz;
          }

          meshGroup.lookAt(playerPos.x, meshGroup.position.y, playerPos.z);

          if (distToPlayer > z.radius) {
            z.position[0] += dirToPlayer.x * z.speed * delta;
            z.position[2] += dirToPlayer.z * z.speed * delta;

            const tempPos = { x: z.position[0], z: z.position[2] };
            resolveMapCollisions(tempPos, z.radius, true);
            z.position[0] = tempPos.x;
            z.position[2] = tempPos.z;

            meshGroup.position.set(z.position[0], 0, z.position[2]);

            const time = currentTime * 0.006 * z.speed;
            const leftArm = meshGroup.getObjectByName('leftArm');
            const rightArm = meshGroup.getObjectByName('rightArm');
            const leftLeg = meshGroup.getObjectByName('leftLeg');
            const rightLeg = meshGroup.getObjectByName('rightLeg');

            if (leftArm) leftArm.rotation.x = -Math.PI / 3 + Math.sin(time) * 0.3;
            if (rightArm) rightArm.rotation.x = -Math.PI / 3 - Math.sin(time) * 0.3;
            if (leftLeg) leftLeg.rotation.x = Math.sin(time) * 0.4;
            if (rightLeg) rightLeg.rotation.x = -Math.sin(time) * 0.4;
          } else {
            if (currentTime - z.attackCooldown > 1200) {
              z.attackCooldown = currentTime;
              soundManager.playZombieAttack();
              onPlayerHit(z.damage);

              createExplosionParticles(meshGroup.position, '#ffffff', 25);
            }
          }

          // Billboard 3D floating Health Bar to face camera
          const healthBar = meshGroup.getObjectByName('healthBarGroup');
          if (healthBar && cameraRef.current) {
            healthBar.lookAt(cameraRef.current.position);

            const numBlocks = z.type === 'BOSS' ? 20 : 3;
            const blocksLeft = Math.max(0, Math.min(numBlocks, Math.ceil((z.health / z.maxHealth) * numBlocks)));

            let colorHex = z.type === 'BOSS' ? 0xcc00ff : 0x00ff66;
            if (blocksLeft <= numBlocks / 3) colorHex = 0xff2200;
            else if (blocksLeft <= (numBlocks * 2) / 3) colorHex = 0xffcc00;
            if (blocksLeft === 0) colorHex = 0x555566;

            for (let i = 0; i < numBlocks; i++) {
              const blockMesh = healthBar.getObjectByName(`healthBlock_${i}`) as THREE.Mesh;
              if (blockMesh) {
                const mat = blockMesh.material as THREE.MeshBasicMaterial;
                if (blocksLeft === 0) {
                  blockMesh.visible = true;
                  mat.color.setHex(0x555566);
                } else if (i < blocksLeft) {
                  blockMesh.visible = true;
                  mat.color.setHex(colorHex);
                } else {
                  blockMesh.visible = true;
                  mat.color.setHex(0x22222a);
                }
              }
            }
          }

          const angleToZombie = Math.atan2(dx, -dz);
          let relAngle = angleToZombie - yawRef.current;
          while (relAngle > Math.PI) relAngle -= Math.PI * 2;
          while (relAngle < -Math.PI) relAngle += Math.PI * 2;

          let dirName: 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT' = 'FRONT';
          if (Math.abs(relAngle) < Math.PI / 4) dirName = 'FRONT';
          else if (Math.abs(relAngle) > (Math.PI * 3) / 4) dirName = 'BACK';
          else if (relAngle < 0) dirName = 'LEFT';
          else dirName = 'RIGHT';

          warnings.push({ direction: dirName, angle: relAngle, distance: distToPlayer });
        });

        soundManager.updateZombieBuzz(minZombieDist, closestDx, closestDz, yawRef.current);
        idsToRemove.forEach(id => finalizeZombieRemoval(id));
        onDirectionalUpdate(warnings);

        if (currentTime - lastSpatialGroanTimeRef.current > 1800 && zombiesRef.current.length > 0) {
          lastSpatialGroanTimeRef.current = currentTime + Math.floor(Math.random() * 600 - 300);
          const randomZombie = zombiesRef.current[Math.floor(Math.random() * zombiesRef.current.length)];
          if (randomZombie) {
            soundManager.playSpatialZombieGroan(
              { x: randomZombie.position[0], y: 1.0, z: randomZombie.position[2] },
              camera.position,
              yawRef.current,
              randomZombie.type === 'BOSS' ? 'TANK' : randomZombie.type
            );
          }
        }

        if (hp < 50 && currentTime - heartbeatTimerRef.current > 900) {
          heartbeatTimerRef.current = currentTime;
          soundManager.playHeartbeat();
        }
      }

      // 4. PRACTICE MODE
      if (mode === 'PRACTICE') {
        soundManager.updateZombieBuzz(Infinity);
        targetsRef.current.forEach(t => {
          const meshGroup = targetMeshesRef.current.get(t.id);
          if (!meshGroup || t.speed === 0) return;

          if (t.axis === 'x') {
            t.position[0] += t.speed * t.direction * delta;
            if (t.position[0] > t.maxRange) t.direction = -1;
            if (t.position[0] < t.minRange) t.direction = 1;
          } else if (t.axis === 'y') {
            t.position[1] += t.speed * t.direction * delta;
            if (t.position[1] > 3.2) t.direction = -1;
            if (t.position[1] < 1.0) t.direction = 1;
          } else if (t.axis === 'z') {
            t.position[2] += t.speed * t.direction * delta;
            if (t.position[2] > 9) t.direction = -1;
            if (t.position[2] < 3) t.direction = 1;
          }

          meshGroup.position.set(t.position[0], t.position[1], t.position[2]);
        });
      }

      // 5. UPDATE PARTICLES
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.life += delta;
        p.mesh.position.addScaledVector(p.vel, delta);
        p.vel.y -= 9.8 * delta;

        if (p.life >= p.maxLife) {
          scene.remove(p.mesh);
          particlesRef.current.splice(i, 1);
        }
      }

      // 6. RENDER SCENE
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [mode, isPaused, wave, hp, ammo]);

  return (
    <div
      ref={mountRef}
      id="game-canvas-container"
      className="relative w-full h-full touch-none select-none overflow-hidden cursor-crosshair bg-black"
      onPointerDown={(e) => {
        e.stopPropagation();
        handleShoot();
      }}
      onPointerMove={handlePointerMove}
    >
      {/* Click To Fire Crosshair Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-\[#CC5200\]/60 rounded-full flex items-center justify-center animate-pulse">
          <div className="w-1.5 h-1.5 bg-\[#CC5200\] rounded-full"></div>
        </div>
      </div>

      {/* VIRTUAL JOYSTICK (BOTTOM LEFT) */}
      {!isPaused && (
        <div
          className="absolute bottom-6 left-6 z-30 pointer-events-auto touch-none select-none flex items-center justify-center p-2"
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
        >
          <div className={`relative w-28 h-28 rounded-full border-2 ${isJoystickActive ? 'border-[#CC5200] bg-black/80 shadow-[0_0_20px_rgba(204,82,0,0.4)]' : 'border-white/40 bg-black/60'} backdrop-blur-md flex items-center justify-center shadow-2xl transition-colors`}>
            <div className="absolute top-1.5 text-[9px] text-white/50 font-mono pointer-events-none">▲</div>
            <div className="absolute bottom-1.5 text-[9px] text-white/50 font-mono pointer-events-none">▼</div>
            <div className="absolute left-1.5 text-[9px] text-white/50 font-mono pointer-events-none">◄</div>
            <div className="absolute right-1.5 text-[9px] text-white/50 font-mono pointer-events-none">►</div>

            <div
              className={`w-12 h-12 rounded-full ${isJoystickActive ? 'bg-[#CC5200] shadow-[0_0_15px_#CC5200]' : 'bg-white/90'} border-2 border-white transition-transform duration-75 ease-out flex items-center justify-center pointer-events-none`}
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              }}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-black/60" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
