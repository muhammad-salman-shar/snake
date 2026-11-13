import { CFG, state, inputs, setBest } from './config.js';
import { sfx } from './audio.js';
import { bus } from './events.js';

export let renderer, scene, camera;
let headGroup, foodGroup, foodMesh, halo, beam, ringMat, wallMat;
let segments = [];
let particles = [];

const SEG_GEO = new THREE.SphereGeometry(1, 14, 10);
const P_GEO = new THREE.SphereGeometry(0.16, 6, 5);

export function initScene() {
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070f);
  scene.fog = new THREE.FogExp2(0x04070f, 0.0075);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 650);
  camera.position.set(0, 10, -14);

  scene.add(new THREE.HemisphereLight(0x3366ff, 0x080a18, 1.1));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.7);
  dirLight.position.set(28, 48, 18);
  scene.add(dirLight);
  const rimLight = new THREE.DirectionalLight(0xff3399, 0.9);
  rimLight.position.set(-32, 22, -28);
  scene.add(rimLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(CFG.arenaRadius, 96),
    new THREE.MeshStandardMaterial({ color:0x0a1730, roughness:0.88, metalness:0.35 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.PolarGridHelper(CFG.arenaRadius, 16, 8, 96, 0x1b4f8a, 0x123a63);
  grid.position.y = 0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.65;
  scene.add(grid);

  ringMat = new THREE.MeshBasicMaterial({ color:0xff2e64 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(CFG.arenaRadius, 0.45, 10, 128), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.55;
  scene.add(ring);

  wallMat = new THREE.MeshBasicMaterial({
    color:0xff2e64, transparent:true, opacity:0.075,
    side:THREE.DoubleSide, depthWrite:false
  });
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(CFG.arenaRadius, CFG.arenaRadius, 5.5, 96, 1, true),
    wallMat
  );
  wall.position.y = 2.75;
  scene.add(wall);

  (function createPosts(){
    const geo = new THREE.BoxGeometry(0.35, 2.2, 0.35);
    const mat = new THREE.MeshBasicMaterial({ color:0xff5588 });
    const count = 44;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++){
      const a = (i / count) * Math.PI * 2;
      m.makeTranslation(Math.cos(a) * CFG.arenaRadius, 1.1, Math.sin(a) * CFG.arenaRadius);
      inst.setMatrixAt(i, m);
    }
    scene.add(inst);
  })();

  headGroup = new THREE.Group();
  scene.add(headGroup);
  headGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(CFG.headRadius, 26, 20),
    new THREE.MeshStandardMaterial({
      color:0x2bffb0, emissive:0x0e9a6a, emissiveIntensity:1.25,
      roughness:0.28, metalness:0.25
    })
  ));
  (function createEyes(){
    const whiteGeo = new THREE.SphereGeometry(0.30, 12, 10);
    const whiteMat = new THREE.MeshBasicMaterial({ color:0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.15, 10, 8);
    const pupilMat = new THREE.MeshBasicMaterial({ color:0x04231a });
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(whiteGeo, whiteMat);
      eye.position.set(0.56 * s, 0.46, 0.98);
      headGroup.add(eye);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(0.62 * s, 0.48, 1.18);
      headGroup.add(pupil);
    });
  })();
  headGroup.add(new THREE.PointLight(0x2bffb0, 26, 22, 2));

  foodGroup = new THREE.Group();
  scene.add(foodGroup);
  foodMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(CFG.foodRadius, 0),
    new THREE.MeshStandardMaterial({
      color:0xffd166, emissive:0xff8a00, emissiveIntensity:2.2,
      roughness:0.25, metalness:0.35
    })
  );
  foodMesh.position.y = 1.25;
  foodGroup.add(foodMesh);
  const foodLight = new THREE.PointLight(0xffaa33, 22, 20, 2);
  foodLight.position.y = 1.4;
  foodGroup.add(foodLight);
  halo = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 2.05, 32),
    new THREE.MeshBasicMaterial({
      color:0xffbb44, transparent:true, opacity:0.35,
      side:THREE.DoubleSide, depthWrite:false
    })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.03;
  foodGroup.add(halo);
  beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 16, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color:0xffbb44, transparent:true, opacity:0.22,
      blending:THREE.AdditiveBlending, depthWrite:false
    })
  );
  beam.position.y = 8;
  foodGroup.add(beam);

  state.headPos = new THREE.Vector3(0, CFG.snakeY, 0);
  state.lookTarget = new THREE.Vector3();
}

function ensureSegments(n){
  while (segments.length < n){
    const i = segments.length;
    const hue = 0.42 - (i % 40) * 0.006;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.85, 0.50),
      emissive: new THREE.Color().setHSL(hue, 0.90, 0.24),
      emissiveIntensity: 1.15,
      roughness: 0.35, metalness: 0.25
    });
    const m = new THREE.Mesh(SEG_GEO, mat);
    const r = Math.max(0.34, 0.95 - i * 0.025) * CFG.headRadius;
    m.scale.setScalar(r);
    m.visible = false;
    scene.add(m);
    segments.push(m);
  }
}

function spawnFood(){
  const maxR = CFG.arenaRadius - 8;
  let x = 0, z = 0;
  for (let t = 0; t < 50; t++){
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * maxR;
    x = Math.cos(a) * r;
    z = Math.sin(a) * r;
    if (Math.hypot(x - state.headPos.x, z - state.headPos.z) > 15) break;
  }
  foodGroup.position.set(x, 0, z);
  state.foodPop = 0;
}

function updateBody(){
  const count = state.segmentCount;
  ensureSegments(count);

  const maxLen = count * CFG.segSpacing + 4;
  let acc = 0;
  let segIdx = 0;
  let target = CFG.segSpacing;
  let prevX = state.headPos.x;
  let prevZ = state.headPos.z;
  let trimIdx = -1;

  const trail = state.trail;
  for (let i = trail.length - 1; i >= 0; i--){
    const p = trail[i];
    const dx = p.x - prevX;
    const dz = p.z - prevZ;
    const d = Math.hypot(dx, dz);
    if (d > 1e-6){
      while (segIdx < count && acc + d >= target){
        const t = (target - acc) / d;
        const m = segments[segIdx];
        m.position.set(prevX + dx * t, CFG.snakeY, prevZ + dz * t);
        m.visible = true;
        segIdx++;
        target += CFG.segSpacing;
      }
      acc += d;
    }
    prevX = p.x; prevZ = p.z;
    if (acc > maxLen){ trimIdx = i; break; }
  }

  for (let i = segIdx; i < segments.length; i++) segments[i].visible = false;
  if (trimIdx > 0) trail.splice(0, trimIdx);
}

function burst(x, y, z, color, count, spread){
  count = count || 16; spread = spread || 13;
  for (let i = 0; i < count; i++){
    const mat = new THREE.MeshBasicMaterial({ color:color, transparent:true, opacity:1 });
    const m = new THREE.Mesh(P_GEO, mat);
    m.position.set(x, y, z);
    const life = 0.6 + Math.random() * 0.4;
    m.userData = {
      vx:(Math.random()-0.5)*spread,
      vy:Math.random()*spread*0.8 + 3,
      vz:(Math.random()-0.5)*spread,
      life:life, maxLife:life
    };
    scene.add(m);
    particles.push(m);
  }
}

function updateParticles(dt){
  for (let i = particles.length - 1; i >= 0; i--){
    const p = particles[i], u = p.userData;
    u.vy -= 27 * dt;
    p.position.x += u.vx * dt;
    p.position.y += u.vy * dt;
    p.position.z += u.vz * dt;
    if (p.position.y < 0.12){
      p.position.y = 0.12;
      u.vy *= -0.42; u.vx *= 0.7; u.vz *= 0.7;
    }
    u.life -= dt;
    const t = Math.max(0, u.life / u.maxLife);
    p.material.opacity = t;
    p.scale.setScalar(Math.max(0.01, t));
    if (u.life <= 0){
      scene.remove(p);
      p.material.dispose();
      particles.splice(i, 1);
    }
  }
}

function snapCamera(){
  const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
  camera.position.set(
    state.headPos.x - fx * CFG.camBack,
    state.headPos.y + CFG.camUp,
    state.headPos.z - fz * CFG.camBack
  );
  state.lookTarget.set(
    state.headPos.x + fx * CFG.camAhead,
    state.headPos.y + 1.2,
    state.headPos.z + fz * CFG.camAhead
  );
  camera.lookAt(state.lookTarget);
}

function updateCamera(dt){
  const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);

  const dX = state.headPos.x - fx * CFG.camBack;
  const dY = state.headPos.y + CFG.camUp;
  const dZ = state.headPos.z - fz * CFG.camBack;

  const kPos = 1 - Math.exp(-CFG.camLag * dt);
  camera.position.x += (dX - camera.position.x) * kPos;
  camera.position.y += (dY - camera.position.y) * kPos;
  camera.position.z += (dZ - camera.position.z) * kPos;

  const tX = state.headPos.x + fx * CFG.camAhead;
  const tY = state.headPos.y + 1.2;
  const tZ = state.headPos.z + fz * CFG.camAhead;

  const kLook = 1 - Math.exp(-CFG.lookLag * dt);
  state.lookTarget.x += (tX - state.lookTarget.x) * kLook;
  state.lookTarget.y += (tY - state.lookTarget.y) * kLook;
  state.lookTarget.z += (tZ - state.lookTarget.z) * kLook;

  const targetFov = 60 + (state.speedMult - 1.0) * 10;
  camera.fov += (targetFov - camera.fov) * (5.0 * dt);
  camera.updateProjectionMatrix();

  camera.lookAt(state.lookTarget);
  camera.rotation.z = -state.turnInput * 0.04 * state.sensitivity;

  if (state.shake > 0){
    state.shake = Math.max(0, state.shake - dt * 1.6);
    const s = state.shake * state.shake * 1.6;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }
}

export function resetGame(){
  state.yaw = 0;
  state.turnInput = 0;
  state.speedMult = 1.0;
  state.segmentCount = CFG.startSegments;
  state.score = 0;
  state.currentSpeed = CFG.baseSpeed;
  state.headPos.set(0, CFG.snakeY, 0);

  state.trail.length = 0;
  const step = 0.2;
  const need = state.segmentCount * CFG.segSpacing + 12;
  const n = Math.ceil(need / step);
  for (let i = n; i >= 0; i--) state.trail.push({ x:0, z:-i * step });

  for (let i = 0; i < segments.length; i++) segments[i].visible = false;
  ensureSegments(state.segmentCount);

  ringMat.color.setHex(0xff2e64);
  wallMat.color.setHex(0xff2e64);
  wallMat.opacity = 0.075;

  headGroup.position.set(0, CFG.snakeY, 0);
  headGroup.rotation.set(0, 0, 0);

  spawnFood();
  updateBody();
  snapCamera();

  bus.dispatchEvent(new Event('hud:update'));
}

export function startGame(){
  sfx.init();
  resetGame();
  state.mode = 'playing';
  bus.dispatchEvent(new Event('game:start'));
}

function onEat(){
  sfx.playEat();
  state.score++;
  state.segmentCount += CFG.growPerFood;
  burst(foodGroup.position.x, 1.3, foodGroup.position.z, 0xffd166, 20, 15);
  burst(foodGroup.position.x, 1.3, foodGroup.position.z, 0xff8a00, 12, 10);
  state.currentSpeed = Math.min(CFG.maxSpeed, state.currentSpeed + 0.22);
  spawnFood();
  bus.dispatchEvent(new Event('hud:update'));
}

function onGameOver(){
  if (state.mode !== 'playing') return;
  state.mode = 'over';
  state.turnInput = 0;
  sfx.playCrash();
  burst(state.headPos.x, CFG.snakeY, state.headPos.z, 0x2bffb0, 36, 20);
  burst(state.headPos.x, CFG.snakeY, state.headPos.z, 0xff2e64, 24, 16);
  ringMat.color.setHex(0xff2233);
  wallMat.color.setHex(0xff2233);
  wallMat.opacity = 0.24;
  state.shake = 0.75;
  if (state.score > state.best){
    setBest(state.score);
  }
  bus.dispatchEvent(new Event('hud:update'));
  setTimeout(() => bus.dispatchEvent(new Event('game:over')), 550);
}

function processKeyboardInputs(){
  let tInput = 0;
  if (inputs.keys['ArrowLeft'] || inputs.keys['a'] || inputs.keys['A']) tInput -= 1;
  if (inputs.keys['ArrowRight'] || inputs.keys['d'] || inputs.keys['D']) tInput += 1;
  state.turnInput = tInput;
  let sMult = 1.0;
  if (inputs.keys['ArrowUp'] || inputs.keys['w'] || inputs.keys['W']) sMult = 1.85;
  if (inputs.keys['ArrowDown'] || inputs.keys['s'] || inputs.keys['S']) sMult = 0.35;
  state.speedMult = sMult;
}

export function updateGame(dt){
  state.gameTime += dt;

  if (state.mode === 'playing'){
    processKeyboardInputs();
    state.yaw -= state.turnInput * CFG.baseTurnRate * state.sensitivity * dt;
    const speedNow = state.currentSpeed * state.speedMult;
    const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
    state.headPos.x += fx * speedNow * dt;
    state.headPos.z += fz * speedNow * dt;
    state.headPos.y = CFG.snakeY;

    state.trail.push({ x: state.headPos.x, z: state.headPos.z });
    if (state.trail.length > 4000) state.trail.splice(0, 2000);

    updateBody();

    const distFromCenter = Math.hypot(state.headPos.x, state.headPos.z);
    if (distFromCenter > CFG.arenaRadius - 10) {
      const proxRatio = (distFromCenter - (CFG.arenaRadius - 10)) / 10;
      wallMat.opacity = 0.075 + proxRatio * 0.15;
    } else {
      wallMat.opacity = 0.075;
    }

    if (distFromCenter > CFG.arenaRadius - CFG.headRadius){
      onGameOver();
    }

    if (state.mode === 'playing'){
      const fdx = state.headPos.x - foodGroup.position.x;
      const fdz = state.headPos.z - foodGroup.position.z;
      if (Math.hypot(fdx, fdz) < CFG.headRadius + CFG.foodRadius + 0.25){
        onEat();
      }
    }
  }

  headGroup.position.copy(state.headPos);
  headGroup.rotation.y = state.yaw;

  foodMesh.rotation.y += dt * 2.4;
  foodMesh.rotation.x += dt * 1.1;
  foodMesh.position.y = 1.25 + Math.sin(state.gameTime * 3.2) * 0.28;
  halo.rotation.z -= dt * 1.6;
  halo.scale.setScalar(1 + Math.sin(state.gameTime * 3.6) * 0.10);

  state.foodPop = Math.min(1, state.foodPop + dt * 4.5);
  const popEase = 1 - Math.pow(1 - state.foodPop, 3);
  foodGroup.scale.setScalar(0.2 + popEase * 0.8);

  updateParticles(dt);
  updateCamera(dt);
}
