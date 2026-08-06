import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameMode, Zombie, ZombieType, Target, GameSettings, DirectionalWarning } from '../types';
import { soundManager } from '../utils/audio';

interface GameCanvasProps {
  mode: GameMode;
  settings: GameSettings;
  isPaused: boolean;
  wave: number;
  hp: number;
  onPlayerHit: (damage: number) => void;
  onZombieKill: (zombieId: string, isHeadshot: boolean) => void;
  onTargetHit: (targetId: string, isBullseye: boolean) => void;
  onShotFired: (hitSomething: boolean) => void;
  onDirectionalUpdate: (warnings: DirectionalWarning[]) => void;
  onWaveClear: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  settings,
  isPaused,
  wave,
  hp,
  onPlayerHit,
  onZombieKill,
  onTargetHit,
  onShotFired,
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
  const laserDotRef = useRef<THREE.Mesh | null>(null);
  const muzzleFlashLightRef = useRef<THREE.PointLight | null>(null);
  const muzzleFlashMeshRef = useRef<THREE.Mesh | null>(null);
  const flashlightRef = useRef<THREE.SpotLight | null>(null);

  // Game state refs inside loop
  const zombiesRef = useRef<Zombie[]>([]);
  const zombieMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const targetsRef = useRef<Target[]>([]);
  const targetMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const particlesRef = useRef<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[]>([]);

  // Camera rotation & Gyro state
  const yawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const lastTouchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const recoilRef = useRef<number>(0);

  // Wave & Spawning
  const lastSpawnTimeRef = useRef<number>(0);
  const totalWaveZombiesRef = useRef<number>(0);
  const spawnedWaveZombiesRef = useRef<number>(0);
  const killedWaveZombiesRef = useRef<number>(0);

  // Audio interval for low HP heartbeat
  const heartbeatTimerRef = useRef<number>(0);

  // 1. Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050204);
    scene.fog = new THREE.FogExp2(0x070305, 0.065);
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.6, 0); // Player eye level 1.6m
    cameraRef.current = camera;

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- ENVIRONMENT: DARK BUNKER ROOM ---
    buildRoomEnvironment(scene);

    // --- LIGHTS ---
    const ambientLight = new THREE.AmbientLight(0x221525, 0.8);
    scene.add(ambientLight);

    // Red Emergency Pulsing Overhead Light
    const emergencyLight = new THREE.PointLight(0xff1122, 2.5, 25);
    emergencyLight.position.set(0, 4.8, 0);
    emergencyLight.castShadow = true;
    scene.add(emergencyLight);

    // Dim Corner Lights
    const cornerLight1 = new THREE.PointLight(0x442200, 1.2, 18);
    cornerLight1.position.set(-8, 3, -8);
    scene.add(cornerLight1);

    const cornerLight2 = new THREE.PointLight(0x112244, 1.2, 18);
    cornerLight2.position.set(8, 3, 8);
    scene.add(cornerLight2);

    // --- FLASHLIGHT ---
    const flashlight = new THREE.SpotLight(0xfff0dd, 4.0, 22, Math.PI / 6, 0.4, 1.5);
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
      color: new THREE.Color(settings.laserColor || '#ff0033'),
      transparent: true,
      opacity: 0.85,
    });
    const laserGeo = new THREE.CylinderGeometry(0.003, 0.003, 1, 8);
    laserGeo.rotateX(Math.PI / 2);
    laserGeo.translate(0, 0, -0.5); // origin at base
    const laserMesh = new THREE.Mesh(laserGeo, laserMat);
    gunGroup.add(laserMesh);
    laserMeshRef.current = laserMesh;

    // Laser Dot at Hit Point
    const laserDotMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(settings.laserColor || '#ff0033'),
      transparent: true,
      opacity: 0.9,
    });
    const laserDotGeo = new THREE.SphereGeometry(0.035, 12, 12);
    const laserDot = new THREE.Mesh(laserDotGeo, laserDotMat);
    scene.add(laserDot);
    laserDotRef.current = laserDot;

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

    // Audio Drone
    soundManager.startAmbientDrone();

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
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
    };
  }, []);

  // Update Laser Color or Flashlight based on Settings
  useEffect(() => {
    if (laserMeshRef.current && laserDotRef.current) {
      const col = new THREE.Color(settings.laserColor || '#ff0033');
      (laserMeshRef.current.material as THREE.MeshBasicMaterial).color = col;
      (laserDotRef.current.material as THREE.MeshBasicMaterial).color = col;
    }
    if (flashlightRef.current) {
      flashlightRef.current.visible = settings.flashlightOn;
    }
    soundManager.setMuted(!settings.soundEnabled);
  }, [settings]);

  // Setup / Reset Wave or Practice Mode
  useEffect(() => {
    // Clear existing objects
    zombiesRef.current.forEach(z => removeZombieMesh(z.id));
    zombiesRef.current = [];
    targetsRef.current.forEach(t => removeTargetMesh(t.id));
    targetsRef.current = [];

    spawnedWaveZombiesRef.current = 0;
    killedWaveZombiesRef.current = 0;

    if (mode === 'PLAY') {
      // Calculate zombies for this wave (Wave 1 = 6, Wave 2 = 10, Wave 3 = 15...)
      totalWaveZombiesRef.current = 5 + wave * 4;
    } else if (mode === 'PRACTICE') {
      // Spawn Practice Targets
      spawnPracticeTargets();
    }
  }, [mode, wave]);

  // Handle Gyroscope Orientation with smooth relative delta / motion rate
  const lastGyroRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);

  useEffect(() => {
    if (!settings.gyroEnabled) {
      lastGyroRef.current = null;
      return;
    }

    let usesMotion = false;

    // 1. Preferred high-precision Gyro rate via DeviceMotionEvent
    const handleMotion = (e: DeviceMotionEvent) => {
      const rr = e.rotationRate;
      if (!rr || (rr.alpha === null && rr.beta === null && rr.gamma === null)) return;

      usesMotion = true;
      const alpha = rr.alpha || 0; // deg/sec
      const beta = rr.beta || 0;   // deg/sec
      const gamma = rr.gamma || 0; // deg/sec

      const dt = (e.interval ? e.interval / 1000 : 0.016);
      const screenOrient = (window.orientation as number) || (screen.orientation ? screen.orientation.angle : 0) || 0;

      let yawSpeed = 0;
      let pitchSpeed = 0;

      if (screenOrient === 90) {
        yawSpeed = -beta;
        pitchSpeed = -gamma;
      } else if (screenOrient === -90 || screenOrient === 270) {
        yawSpeed = beta;
        pitchSpeed = gamma;
      } else {
        // Portrait
        yawSpeed = -gamma;
        pitchSpeed = beta;
      }

      const gyroSens = (settings.sensitivity || 1.2) * 0.025;
      yawRef.current += THREE.MathUtils.degToRad(yawSpeed) * dt * gyroSens * 50;
      pitchRef.current += THREE.MathUtils.degToRad(pitchSpeed) * dt * gyroSens * 50;
      pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -Math.PI / 2.2, Math.PI / 2.2);
    };

    // 2. Fallback relative orientation delta via DeviceOrientationEvent
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (usesMotion) return; // motion rate takes precedence
      if (e.alpha === null && e.beta === null && e.gamma === null) return;

      const alpha = e.alpha || 0;
      const beta = e.beta || 0;
      const gamma = e.gamma || 0;

      if (!lastGyroRef.current) {
        lastGyroRef.current = { alpha, beta, gamma };
        return;
      }

      let dAlpha = alpha - lastGyroRef.current.alpha;
      let dBeta = beta - lastGyroRef.current.beta;
      let dGamma = gamma - lastGyroRef.current.gamma;

      // Handle 360 wrap around
      if (dAlpha > 180) dAlpha -= 360;
      if (dAlpha < -180) dAlpha += 360;

      // Filter out glitchy spikes
      if (Math.abs(dAlpha) > 25) dAlpha = 0;
      if (Math.abs(dBeta) > 25) dBeta = 0;
      if (Math.abs(dGamma) > 25) dGamma = 0;

      lastGyroRef.current = { alpha, beta, gamma };

      const screenOrient = (window.orientation as number) || (screen.orientation ? screen.orientation.angle : 0) || 0;

      let dYaw = 0;
      let dPitch = 0;

      if (screenOrient === 90) {
        dYaw = -dBeta;
        dPitch = -dGamma;
      } else if (screenOrient === -90 || screenOrient === 270) {
        dYaw = dBeta;
        dPitch = dGamma;
      } else {
        dYaw = -dAlpha;
        dPitch = dBeta;
      }

      const gyroSens = (settings.sensitivity || 1.2) * 0.02;
      yawRef.current += THREE.MathUtils.degToRad(dYaw) * gyroSens;
      pitchRef.current += THREE.MathUtils.degToRad(dPitch) * gyroSens;
      pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -Math.PI / 2.2, Math.PI / 2.2);
    };

    window.addEventListener('devicemotion', handleMotion, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener('devicemotion', handleMotion, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [settings.gyroEnabled, settings.sensitivity]);

  // --- ROOM BUILDER ---
  const buildRoomEnvironment = (scene: THREE.Scene) => {
    const roomSize = 30;
    const roomHeight = 7;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(roomSize, roomSize, 32, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x18181f,
      roughness: 0.85,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor grid / blood stain decals
    const gridHelper = new THREE.GridHelper(roomSize, 30, 0xff2233, 0x221525);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x0c0b10, roughness: 0.9 });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    scene.add(ceiling);

    // 4 Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x22222a,
      roughness: 0.7,
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

    // Decorative Pillars & Industrial Crates
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3d352e, roughness: 0.8 });
    const cratePositions = [
      [-10, 1, -10], [11, 1, -8], [-9, 1, 11], [10, 1, 10],
      [-12, 1.2, 2], [12, 1.2, -3], [3, 0.8, -12], [-4, 0.8, 12]
    ];
    cratePositions.forEach(([cx, cy, cz]) => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), crateMat);
      crate.position.set(cx, cy, cz);
      crate.castShadow = true;
      crate.receiveShadow = true;
      scene.add(crate);
    });
  };

  // --- GUN MODEL GENERATOR ---
  const createGunModel = (): THREE.Group => {
    const gun = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.3, metalness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.6 });
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });

    // Barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.55), metalMat);
    gun.add(barrel);

    // Slide
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.08, 0.5), metalMat);
    slide.position.set(0, 0.06, -0.02);
    gun.add(slide);

    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.12), darkMat);
    grip.position.set(0, -0.14, 0.15);
    grip.rotation.x = -0.3;
    gun.add(grip);

    // Trigger Guard
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.1), metalMat);
    guard.position.set(0, -0.08, 0.05);
    gun.add(guard);

    // Laser Sight Box under barrel
    const laserBox = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), darkMat);
    laserBox.position.set(0, -0.07, -0.18);
    gun.add(laserBox);

    const laserLens = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), redMat);
    laserLens.position.set(0, -0.07, -0.24);
    gun.add(laserLens);

    return gun;
  };

  // --- ZOMBIE 3D MODEL GENERATOR ---
  const createZombieMesh = (zombie: Zombie): THREE.Group => {
    const group = new THREE.Group();

    // White character base color with subtle tint variations per type
    let bodyColor = 0xffffff; // Stark White
    let clothesColor = 0xe0e0e0; // Bright off-white
    let scale = 1.0;

    if (zombie.type === 'RUNNER') {
      bodyColor = 0xfff0f0; // Pale blood-tinted white
      clothesColor = 0xd5c5c5;
      scale = 0.88;
    } else if (zombie.type === 'TANK') {
      bodyColor = 0xe6e6e6; // Heavy bone white
      clothesColor = 0xcccccc;
      scale = 1.5;
    } else if (zombie.type === 'STALKER') {
      bodyColor = 0xf0f8ff; // Ghostly silver white
      clothesColor = 0xd8e0e8;
      scale = 1.05;
    }

    // Bright materials with subtle emissive component for dark visibility
    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: 0.4,
      emissive: new THREE.Color(bodyColor),
      emissiveIntensity: 0.15, // Subtle self-glow so they POP in dark room
    });

    const clothesMat = new THREE.MeshStandardMaterial({
      color: clothesColor,
      roughness: 0.5,
      emissive: new THREE.Color(clothesColor),
      emissiveIntensity: 0.1,
    });

    // Vivid glowing red eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

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

    // Red Eyes - Slightly larger for striking visibility
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 10, 10), eyeMat);
    leftEye.position.set(-0.11 * scale, 1.68 * scale, -0.21 * scale);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 10, 10), eyeMat);
    rightEye.position.set(0.11 * scale, 1.68 * scale, -0.21 * scale);
    group.add(rightEye);

    // Arms
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.7 * scale, 0.2 * scale), bodyMat);
    leftArm.position.set(-0.42 * scale, 1.0 * scale, -0.2 * scale);
    leftArm.rotation.x = -Math.PI / 3; // Reaching arms
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

    group.position.set(zombie.position[0], zombie.position[1], zombie.position[2]);
    return group;
  };

  // --- PRACTICE TARGETS GENERATOR ---
  const spawnPracticeTargets = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear old targets
    targetsRef.current.forEach(t => removeTargetMesh(t.id));
    targetsRef.current = [];

    // Target Positions in 360 degrees around origin
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

      // Create 3D Mesh
      const targetGroup = new THREE.Group();

      // Outer Red Ring
      const outerRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.08, 24),
        new THREE.MeshStandardMaterial({ color: 0xcc1122, roughness: 0.4 })
      );
      outerRing.rotation.x = Math.PI / 2;
      targetGroup.add(outerRing);

      // Middle White Ring
      const midRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24),
        new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 })
      );
      midRing.rotation.x = Math.PI / 2;
      targetGroup.add(midRing);

      // Bullseye Yellow Center
      const bullseye = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.2 })
      );
      bullseye.rotation.x = Math.PI / 2;
      bullseye.name = 'bullseye';
      targetGroup.add(bullseye);

      // Stand post
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, cfg.pos[1], 12),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
      );
      post.position.y = -cfg.pos[1] / 2;
      targetGroup.add(post);

      // Face player direction initially
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

  // --- ZOMBIE SPAWNING IN PLAY MODE ---
  const spawnZombieInWave = () => {
    if (spawnedWaveZombiesRef.current >= totalWaveZombiesRef.current) return;

    // Pick random spawn angle around 360 degrees
    const angle = Math.random() * Math.PI * 2;
    const distance = 13 + Math.random() * 5; // Spawn 13-18m away
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;

    // Determine zombie type based on wave
    const rand = Math.random();
    let type: ZombieType = 'WALKER';
    let speed = 1.3 + wave * 0.15;
    let maxHealth = 100;
    let damage = 10; // Standard 10 HP loss per touch

    if (wave >= 2 && rand > 0.6) {
      type = 'RUNNER';
      speed = 2.8 + wave * 0.2;
      maxHealth = 60;
    } else if (wave >= 3 && rand > 0.85) {
      type = 'TANK';
      speed = 0.8 + wave * 0.1;
      maxHealth = 280;
    } else if (wave >= 4 && rand > 0.7) {
      type = 'STALKER';
      speed = 2.0;
      maxHealth = 90;
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
      radius: type === 'TANK' ? 1.2 : 0.7,
      rotationY: 0,
      attackCooldown: 0,
      isAttacking: false,
      hitFlashTime: 0,
      glowColor: type === 'RUNNER' ? '#ff3300' : '#00ff66',
    };

    zombiesRef.current.push(zombie);
    spawnedWaveZombiesRef.current++;

    if (sceneRef.current) {
      const mesh = createZombieMesh(zombie);
      sceneRef.current.add(mesh);
      zombieMeshesRef.current.set(id, mesh);

      // Play zombie groan on spawn
      soundManager.playZombieGroan(type === 'TANK' ? 0.6 : type === 'RUNNER' ? 1.4 : 1.0);
    }
  };

  // --- BLOOD & SPARK PARTICLES ---
  const createExplosionParticles = (pos: THREE.Vector3, color: string, count: number = 15) => {
    const scene = sceneRef.current;
    if (!scene) return;

    for (let i = 0; i < count; i++) {
      const pGeo = new THREE.BufferGeometry();
      const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
      const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), pMat);

      pMesh.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.2) * 4,
        (Math.random() - 0.5) * 4
      );

      scene.add(pMesh);
      particlesRef.current.push({
        mesh: pMesh,
        vel,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
      });
    }
  };

  // --- SHOOTING MECHANIC ---
  const handleShoot = () => {
    if (isPaused || !cameraRef.current || !sceneRef.current) return;

    // Audio FX & Recoil
    soundManager.playGunshot();
    soundManager.playLaserZap();
    recoilRef.current = 0.12; // Gun kickback

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
      // Check hits against zombies
      let closestHitDist = Infinity;
      let hitZombieId: string | null = null;
      let isHeadshot = false;
      let hitPoint: THREE.Vector3 | null = null;

      zombiesRef.current.forEach(z => {
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
          const damage = isHeadshot ? 120 : 50;
          z.health -= damage;
          z.hitFlashTime = Date.now();

          soundManager.playZombieHit();
          createExplosionParticles(hitPoint, '#aa0011', 18);

          if (z.health <= 0) {
            // Zombie Killed!
            createExplosionParticles(hitPoint, '#ff1100', 35);
            removeZombieMesh(z.id);
            zombiesRef.current.splice(zIndex, 1);
            killedWaveZombiesRef.current++;

            onZombieKill(z.id, isHeadshot);

            // Check wave completion
            if (
              killedWaveZombiesRef.current >= totalWaveZombiesRef.current &&
              zombiesRef.current.length === 0
            ) {
              soundManager.playWaveComplete();
              onWaveClear();
            }
          }
        }
      }
    } else if (mode === 'PRACTICE') {
      // Check hits against practice targets
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

        // Respawn / animate target hit reaction
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

  // --- TOUCH & DRAG LOOK CONTROLS ---
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    isDraggingRef.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    lastTouchRef.current = { x: clientX, y: clientY };
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - lastTouchRef.current.x;
    const deltaY = clientY - lastTouchRef.current.y;
    lastTouchRef.current = { x: clientX, y: clientY };

    const sens = (settings.sensitivity || 1.2) * 0.003;
    yawRef.current -= deltaX * sens;
    pitchRef.current -= deltaY * sens;

    // Clamp pitch (-85deg to +85deg)
    pitchRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitchRef.current));
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
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
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.x = pitchRef.current;
      euler.y = yawRef.current;
      camera.quaternion.setFromEuler(euler);

      // Recoil Recovery
      if (recoilRef.current > 0) {
        pitchRef.current += recoilRef.current * 0.3;
        recoilRef.current -= delta * 0.8;
        if (recoilRef.current < 0) recoilRef.current = 0;
      }

      // 2. GUN RECOIL & LASER RAYCAST
      if (gunGroupRef.current) {
        gunGroupRef.current.position.z = -0.42 + recoilRef.current * 0.15;
      }

      // Laser Raycast to calculate beam length & laser dot position
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let laserDist = 25; // max laser range
      if (intersects.length > 0) {
        for (const hit of intersects) {
          // Ignore laser beam itself
          if (hit.object !== laserMeshRef.current && hit.object !== laserDotRef.current) {
            laserDist = hit.distance;
            if (laserDotRef.current) {
              laserDotRef.current.position.copy(hit.point);
              laserDotRef.current.visible = true;
            }
            break;
          }
        }
      } else if (laserDotRef.current) {
        laserDotRef.current.visible = false;
      }

      if (laserMeshRef.current) {
        laserMeshRef.current.scale.set(1, 1, laserDist);
      }

      // 3. PLAY MODE: ZOMBIE AI & SPAWNING
      if (mode === 'PLAY') {
        // Spawn zombies periodically if needed
        if (
          spawnedWaveZombiesRef.current < totalWaveZombiesRef.current &&
          currentTime - lastSpawnTimeRef.current > Math.max(1200, 3200 - wave * 300)
        ) {
          spawnZombieInWave();
          lastSpawnTimeRef.current = currentTime;
        }

        const playerPos = new THREE.Vector3(0, 0, 0);
        const warnings: DirectionalWarning[] = [];

        // Update Zombies
        zombiesRef.current.forEach(z => {
          const meshGroup = zombieMeshesRef.current.get(z.id);
          if (!meshGroup) return;

          const zPos = new THREE.Vector3(z.position[0], 0, z.position[2]);
          const dirToPlayer = new THREE.Vector3().subVectors(playerPos, zPos).normalize();
          const distToPlayer = zPos.distanceTo(playerPos);

          // Rotate Zombie towards player
          meshGroup.lookAt(0, meshGroup.position.y, 0);

          // Move Zombie toward player
          if (distToPlayer > z.radius) {
            z.position[0] += dirToPlayer.x * z.speed * delta;
            z.position[2] += dirToPlayer.z * z.speed * delta;
            meshGroup.position.set(z.position[0], 0, z.position[2]);

            // Walking limb wobble animation
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
            // Zombie reached player (TOUCHED PLAYER)!
            // Lose 10 HP out of 150!
            if (currentTime - z.attackCooldown > 1200) {
              z.attackCooldown = currentTime;
              soundManager.playZombieAttack();
              onPlayerHit(z.damage); // 10 HP loss
            }
          }

          // Calculate directional warning for HUD radar
          const angleToZombie = Math.atan2(z.position[0], -z.position[2]); // angle relative to north
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

        onDirectionalUpdate(warnings);

        // Low HP Heartbeat
        if (hp < 50 && currentTime - heartbeatTimerRef.current > 900) {
          heartbeatTimerRef.current = currentTime;
          soundManager.playHeartbeat();
        }
      }

      // 4. PRACTICE MODE: MOVING TARGETS
      if (mode === 'PRACTICE') {
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
        p.vel.y -= 9.8 * delta; // Gravity

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
  }, [mode, isPaused, wave, hp]);

  return (
    <div
      ref={mountRef}
      id="game-canvas-container"
      className="relative w-full h-full touch-none select-none overflow-hidden cursor-crosshair bg-black"
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleShoot}
    >
      {/* Click To Fire Crosshair Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-red-500/60 rounded-full flex items-center justify-center animate-pulse">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};
