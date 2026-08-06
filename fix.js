const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');

// 1. Remove laserDotRef
code = code.replace(/const laserDotRef = useRef<THREE\.Mesh \| null>\(null\);/, '');

code = code.replace(/\/\/ Laser Dot at Hit Point[\s\S]*?laserDotRef\.current = laserDot;/, '');

code = code.replace(/if \(laserMeshRef\.current && laserDotRef\.current\) {[\s\S]*?\}/, `if (laserMeshRef.current) {
      const col = new THREE.Color(settings.laserColor || '#ff0033');
      (laserMeshRef.current.material as THREE.MeshBasicMaterial).color = col;
    }`);

code = code.replace(/if \(hit\.object !== laserMeshRef\.current && hit\.object !== laserDotRef\.current\) \{/, 'if (hit.object !== laserMeshRef.current) {');

code = code.replace(/if \(laserDotRef\.current\) \{[\s\S]*?\}\s*break;/, 'break;');

code = code.replace(/\} else if \(laserDotRef\.current\) \{[\s\S]*?\}/, '}');

// 2. Add Theme refs
const refsToAdd = `
  // Environment Refs for Theme alternating
  const envMaterialsRef = useRef<{
    floor: THREE.MeshStandardMaterial;
    ceiling: THREE.MeshStandardMaterial;
    wall: THREE.MeshStandardMaterial;
    crate: THREE.MeshStandardMaterial;
  } | null>(null);
  
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    emergency: THREE.PointLight;
    corner1: THREE.PointLight;
    corner2: THREE.PointLight;
  } | null>(null);
`;
code = code.replace(/const flashlightRef = useRef<THREE\.SpotLight \| null>\(null\);/, `const flashlightRef = useRef<THREE.SpotLight | null>(null);${refsToAdd}`);

// 3. Update buildRoomEnvironment
const buildRoomRegex = /const buildRoomEnvironment = \(scene: THREE\.Scene\) => \{[\s\S]*?const crateMat = new THREE\.MeshStandardMaterial\(\{ color: 0x3d352e, roughness: 0\.8 \}\);/;
const buildRoomReplacement = `const buildRoomEnvironment = (scene: THREE.Scene) => {
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
    
    envMaterialsRef.current = {
      floor: floorMat,
      ceiling: ceilingMat,
      wall: wallMat,
      crate: crateMat
    };
`;
code = code.replace(buildRoomRegex, buildRoomReplacement);

// 4. Update Lights population
const lightsSetupRegex = /const cornerLight2 = new THREE\.PointLight\(0x112244, 1\.2, 18\);\n\s*cornerLight2\.position\.set\(8, 3, 8\);\n\s*scene\.add\(cornerLight2\);/;
const lightsSetupReplacement = `const cornerLight2 = new THREE.PointLight(0x112244, 1.2, 18);
    cornerLight2.position.set(8, 3, 8);
    scene.add(cornerLight2);
    
    lightsRef.current = {
      ambient: ambientLight,
      emergency: emergencyLight,
      corner1: cornerLight1,
      corner2: cornerLight2
    };`;
code = code.replace(lightsSetupRegex, lightsSetupReplacement);

// 5. Create Zombie function
const createZombieRegex = /const createZombieMesh = \(zombie: Zombie\): THREE\.Group => \{[\s\S]*?let bodyColor = 0xffffff; \/\/ Stark White\n\s*let clothesColor = 0xe0e0e0; \/\/ Bright off-white/;
const createZombieReplacement = `const createZombieMesh = (zombie: Zombie): THREE.Group => {
    const isLightWave = mode === 'PLAY' && wave % 2 === 0;
    const group = new THREE.Group();

    // White character base color with subtle tint variations per type
    let bodyColor = isLightWave ? 0x111111 : 0xffffff; 
    let clothesColor = isLightWave ? 0x222222 : 0xe0e0e0;`;
code = code.replace(createZombieRegex, createZombieReplacement);

const themeEffect = `
  // Theme Switching
  useEffect(() => {
    const isLightWave = mode === 'PLAY' && wave % 2 === 0;

    if (envMaterialsRef.current) {
      envMaterialsRef.current.floor.color.setHex(isLightWave ? 0xdddddd : 0x18181f);
      envMaterialsRef.current.ceiling.color.setHex(isLightWave ? 0xeeeeee : 0x0c0b10);
      envMaterialsRef.current.wall.color.setHex(isLightWave ? 0xcccccc : 0x22222a);
      envMaterialsRef.current.crate.color.setHex(isLightWave ? 0xaaaaaa : 0x3d352e);
    }
    
    if (lightsRef.current) {
      if (isLightWave) {
        lightsRef.current.ambient.color.setHex(0xffffff);
        lightsRef.current.ambient.intensity = 1.0;
        lightsRef.current.emergency.intensity = 0; // turn off red light
        lightsRef.current.corner1.intensity = 0;
        lightsRef.current.corner2.intensity = 0;
      } else {
        lightsRef.current.ambient.color.setHex(0x221525);
        lightsRef.current.ambient.intensity = 0.8;
        lightsRef.current.emergency.intensity = 2.5;
        lightsRef.current.corner1.intensity = 1.2;
        lightsRef.current.corner2.intensity = 1.2;
      }
    }
  }, [wave, mode]);
`;

code = code.replace(/(\/\/ Handle Gyroscope Orientation via standard Three\.js deviceorientation)/, themeEffect + '\n\n  $1');

fs.writeFileSync('src/components/GameCanvas.tsx', code);
console.log("Replaced!");
