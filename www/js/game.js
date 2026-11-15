/* Neon Viper 3D - High-Performance Mobile & Desktop Core Game Logic */

function safeGetStorage(key, fallback) { try { const val = localStorage.getItem(key); return val !== null ? val : fallback; } catch (e) { return fallback; } }
function safeSetStorage(key, val) { try { localStorage.setItem(key, String(val)); } catch (e) {} }

const fatalEl = document.getElementById('fatal');
function showFatal(msg) { if (fatalEl) { fatalEl.textContent = '⚠ ' + msg; fatalEl.classList.add('show'); } }
window.addEventListener('error', function (e) { if (e && e.message) showFatal(e.message); });

document.addEventListener('deviceready', async () => {
  try {
    if (window.Capacitor && window.Capacitor.Plugins) {
      if (window.Capacitor.Plugins.ScreenOrientation) {
        await window.Capacitor.Plugins.ScreenOrientation.lock({ orientation: 'landscape' });
      }
      if (window.Capacitor.Plugins.StatusBar) {
        await window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: true });
        await window.Capacitor.Plugins.StatusBar.hide();
      }
    }
  } catch (err) { console.log(err); }
});

class SoundFx {
  constructor() { this.ctx = null; this.muted = safeGetStorage('neon_viper_mute', '0') === '1'; }
  init() { if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); } if (this.ctx && this.ctx.state === 'suspended') { this.ctx.resume().catch(() => {}); } }
  playEat() { if (this.muted || !this.ctx) return; try { const n = this.ctx.currentTime; const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(523.25, n); o.frequency.exponentialRampToValueAtTime(987.77, n + 0.13); g.gain.setValueAtTime(0.24, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.15); o.connect(g); g.connect(this.ctx.destination); o.start(n); o.stop(n + 0.16); } catch (e) {} }
  playBoostTone() { if (this.muted || !this.ctx) return; try { const n = this.ctx.currentTime; const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(190, n); o.frequency.exponentialRampToValueAtTime(360, n + 0.12); g.gain.setValueAtTime(0.08, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.14); o.connect(g); g.connect(this.ctx.destination); o.start(n); o.stop(n + 0.15); } catch (e) {} }
  playCrash() { if (this.muted || !this.ctx) return; try { const n = this.ctx.currentTime; const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(165, n); o.frequency.exponentialRampToValueAtTime(28, n + 0.38); g.gain.setValueAtTime(0.4, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.42); o.connect(g); g.connect(this.ctx.destination); o.start(n); o.stop(n + 0.44); } catch (e) {} }
}
const sfx = new SoundFx();

window.addEventListener('load', () => {
  if (window.THREE) {
    try { bootGame(); } catch (err) { showFatal(err.message); }
  } else {
    showFatal('3D Engine failed to load locally.');
  }
});

function bootGame() {
  const CFG = {
    arenaRadius: 50.4, headRadius: 1.30, snakeY: 1.05, baseSpeed: 10.2, maxSpeed: 16.5,
    baseTurnRate: 2.75, segSpacing: 0.86, startSegments: 12, growPerFood: 3, foodRadius: 0.98,
    camBack: 14.2, camUp: 9.4, camAhead: 6.2, camLag: 7.5, lookLag: 10.0
  };

  let currentSpeed = CFG.baseSpeed;
  let sensitivity = parseFloat(safeGetStorage('neon_viper_sens', '1.0'));
  if (!isFinite(sensitivity)) sensitivity = 1.0;

  const maxDPR = Math.min(window.devicePixelRatio || 1, 2);
  let currentDPR = maxDPR;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.setPixelRatio(currentDPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070f);
  scene.fog = new THREE.FogExp2(0x04070f, 0.0065);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 10, -14);

  scene.add(new THREE.HemisphereLight(0x4488ff, 0x060914, 1.15));
  const dirLight = new THREE.DirectionalLight(0xeef6ff, 1.6);
  dirLight.position.set(28, 52, 22);
  scene.add(dirLight);

  const viperGlowLight = new THREE.PointLight(0x2bffb0, 1.6, 22, 1.8);
  viperGlowLight.position.set(0, 2.8, 0);
  scene.add(viperGlowLight);

  const foodGlowLight = new THREE.PointLight(0xffaa00, 1.8, 18, 1.8);
  foodGlowLight.position.set(0, 2.5, 0);
  scene.add(foodGlowLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(CFG.arenaRadius, 72),
    new THREE.MeshStandardMaterial({ color: 0x081326, roughness: 0.72, metalness: 0.42 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.PolarGridHelper(CFG.arenaRadius, 18, 9, 72, 0x1e5c9e, 0x11365c);
  grid.position.y = 0.03;
  grid.material.transparent = true;
  grid.material.opacity = 0.7;
  scene.add(grid);

  const starCount = 200;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = CFG.arenaRadius + 8 + Math.random() * 70;
    const theta = Math.random() * Math.PI * 2;
    starPos[i * 3] = Math.cos(theta) * r;
    starPos[i * 3 + 1] = 2 + Math.random() * 45;
    starPos[i * 3 + 2] = Math.sin(theta) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x5ff0c0, size: 0.75, transparent: true, opacity: 0.55 }));
  scene.add(starField);

  const COLOR_BLUE_RING = new THREE.Color(0x00a8ff);
  const COLOR_BLUE_POST = new THREE.Color(0x33bbff);
  const COLOR_RED_WARN = new THREE.Color(0xff1a35);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00a8ff });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(CFG.arenaRadius, 0.45, 12, 72), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.55;
  scene.add(ring);

  const wallMat = new THREE.MeshBasicMaterial({ color: 0x00a8ff, transparent: true, opacity: 0.085, side: THREE.DoubleSide, depthWrite: false });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(CFG.arenaRadius, CFG.arenaRadius, 5.5, 72, 1, true), wallMat);
  wall.position.y = 2.75;
  scene.add(wall);

  const postsMat = new THREE.MeshBasicMaterial({ color: 0x33bbff });
  const postsGeo = new THREE.BoxGeometry(0.38, 2.3, 0.38);
  const inst = new THREE.InstancedMesh(postsGeo, postsMat, 48);
  const tempMat4 = new THREE.Matrix4();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    tempMat4.makeTranslation(Math.cos(a) * CFG.arenaRadius, 1.15, Math.sin(a) * CFG.arenaRadius);
    inst.setMatrixAt(i, tempMat4);
  }
  scene.add(inst);

  const headGroup = new THREE.Group();
  scene.add(headGroup);

  const headMat = new THREE.MeshStandardMaterial({ color: 0x2bffb0, emissive: 0x0e9a6a, emissiveIntensity: 0.85, roughness: 0.22, metalness: 0.35 });
  const headCore = new THREE.Mesh(new THREE.SphereGeometry(CFG.headRadius, 20, 16), headMat);
  headCore.scale.set(1.04, 0.86, 1.22);
  headGroup.add(headCore);

  const whiteGeo = new THREE.SphereGeometry(0.30, 10, 8);
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x041e17 });
  [-1, 1].forEach((s) => {
    const eye = new THREE.Mesh(whiteGeo, whiteMat);
    eye.position.set(0.58 * s, 0.42, 0.96);
    headGroup.add(eye);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0.64 * s, 0.44, 1.18);
    headGroup.add(pupil);
  });

  const tongueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.9), new THREE.MeshBasicMaterial({ color: 0xff2e64 }));
  tongueMesh.position.set(0, -0.15, 1.55);
  headGroup.add(tongueMesh);

  const SEG_GEO = new THREE.SphereGeometry(1, 14, 10);
  const PALETTE_SIZE = 24;
  const segMaterials = [];
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const hue = 0.43 - i * 0.008;
    segMaterials.push(new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.85, 0.50),
      emissive: new THREE.Color().setHSL(hue, 0.90, 0.22),
      emissiveIntensity: 0.75, roughness: 0.30, metalness: 0.30
    }));
  }

  const segments = [];
  function ensureSegments(n) {
    while (segments.length < n) {
      const i = segments.length;
      const mat = segMaterials[i % PALETTE_SIZE];
      const mesh = new THREE.Mesh(SEG_GEO, mat);
      mesh.scale.setScalar(CFG.headRadius * 0.94);
      mesh.visible = false;
      scene.add(mesh);
      segments.push(mesh);
    }
  }
  ensureSegments(90);

  const foodGroup = new THREE.Group();
  scene.add(foodGroup);
  const foodMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(CFG.foodRadius, 0),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff8a00, emissiveIntensity: 1.35, roughness: 0.18, metalness: 0.45 })
  );
  foodMesh.position.y = 1.30;
  foodGroup.add(foodMesh);

  const foodRingGeo = new THREE.RingGeometry(1.15, 1.45, 24);
  foodRingGeo.rotateX(-Math.PI / 2);
  const foodRing = new THREE.Mesh(foodRingGeo, new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
  foodRing.position.y = 0.08;
  foodGroup.add(foodRing);

  const PARTICLE_COUNT = 42;
  const particles = [];
  const partGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const pMesh = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    pMesh.visible = false;
    scene.add(pMesh);
    particles.push({ mesh: pMesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.5 });
  }

  function spawnParticles(x, y, z, hexColor, count) {
    let spawned = 0;
    for (let i = 0; i < PARTICLE_COUNT && spawned < count; i++) {
      const p = particles[i];
      if (p.life <= 0) {
        p.mesh.visible = true;
        p.mesh.position.set(x, y, z);
        p.mesh.material.color.setHex(hexColor);
        const ang = Math.random() * Math.PI * 2;
        const spd = 3.5 + Math.random() * 10.5;
        p.vx = Math.cos(ang) * spd;
        p.vy = 3.0 + Math.random() * 7.5;
        p.vz = Math.sin(ang) * spd;
        p.maxLife = 0.38 + Math.random() * 0.28;
        p.life = p.maxLife;
        spawned++;
      }
    }
  }

  const TRAIL_CAPACITY = 4096;
  const trailX = new Float32Array(TRAIL_CAPACITY);
  const trailZ = new Float32Array(TRAIL_CAPACITY);
  let trailHead = 0;
  let trailCount = 0;

  function pushTrailPoint(x, z) {
    trailHead = (trailHead + 1) & (TRAIL_CAPACITY - 1);
    trailX[trailHead] = x;
    trailZ[trailHead] = z;
    if (trailCount < TRAIL_CAPACITY) trailCount++;
  }

  const state = {
    mode: 'ready', score: 0, best: Number(safeGetStorage('neon_viper_best', '0')) || 0,
    yaw: 0, turnInput: 0, speedMult: 1.0, segmentCount: CFG.startSegments, headPos: new THREE.Vector3(0, CFG.snakeY, 0)
  };

  let gameTime = 0;
  const lookTarget = new THREE.Vector3();

  const scoreEl = document.getElementById('scoreEl');
  const bestEl = document.getElementById('bestEl');
  const speedBadge = document.getElementById('speedBadge');
  const ctrlPill = document.getElementById('ctrlPill');
  const startOverlay = document.getElementById('startOverlay');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const ovTitle = document.getElementById('ovTitle');
  const ovSub = document.getElementById('ovSub');
  const startBtn = document.getElementById('startBtn');
  const ovScoreWrap = document.getElementById('ovScoreWrap');
  const ovScore = document.getElementById('ovScore');

  const domCache = { score: -1, best: -1, speedText: '', badgeClass: '', knobClass: '', knobTransform: '', throttleCapText: '', throttleCapColor: '', wheelTransform: '', steerCapText: '', steerCapColor: '' };

  function updateHUD() {
    if (domCache.score !== state.score) { domCache.score = state.score; scoreEl.textContent = state.score; }
    if (domCache.best !== state.best) { domCache.best = state.best; bestEl.textContent = state.best; }
    const mult = state.speedMult;
    const sText = mult.toFixed(1) + 'x SPEED';
    if (domCache.speedText !== sText) { domCache.speedText = sText; speedBadge.textContent = sText; }
    let bClass = 'speed-badge';
    if (mult > 1.15) bClass = 'speed-badge boost';
    else if (mult < 0.85) bClass = 'speed-badge brake';
    if (domCache.badgeClass !== bClass) { domCache.badgeClass = bClass; speedBadge.className = bClass; }
  }

  function showStartOverlay(kind) {
    if (kind === 'over') {
      ovTitle.textContent = 'GAME OVER'; ovTitle.style.color = '#ff5c7a'; ovTitle.style.textShadow = '0 0 24px rgba(255,60,110,.9),0 0 60px rgba(255,0,80,.4)';
      ovSub.style.display = 'none'; ovScoreWrap.style.display = 'block'; ovScore.textContent = state.score; startBtn.textContent = 'RETRY VIPER';
    } else {
      ovTitle.textContent = 'NEON VIPER 3D'; ovTitle.style.color = '#6effd0'; ovTitle.style.textShadow = '0 0 22px rgba(60,255,200,.85),0 0 50px rgba(0,255,180,.45)';
      ovSub.style.display = 'block'; ovScoreWrap.style.display = 'none'; startBtn.textContent = 'START VIPER';
    }
    startOverlay.classList.add('show');
  }

  function hideStartOverlay() { startOverlay.classList.remove('show'); }

  function resetGame() {
    state.yaw = 0; state.turnInput = 0; state.speedMult = 1.0; state.segmentCount = CFG.startSegments; state.score = 0; currentSpeed = CFG.baseSpeed; state.headPos.set(0, CFG.snakeY, 0);
    trailHead = 0; trailCount = 0;
    const step = 0.18;
    const need = state.segmentCount * CFG.segSpacing + 14;
    const n = Math.ceil(need / step);
    for (let i = n; i >= 0; i--) pushTrailPoint(0, -i * step);

    for (let i = 0; i < segments.length; i++) segments[i].visible = false;
    ensureSegments(state.segmentCount);

    ringMat.color.copy(COLOR_BLUE_RING); wallMat.color.copy(COLOR_BLUE_RING); postsMat.color.copy(COLOR_BLUE_POST); wallMat.opacity = 0.085;
    headGroup.position.set(0, CFG.snakeY, 0); headGroup.rotation.set(0, 0, 0); viperGlowLight.position.set(0, 2.8, 0);

    spawnFood(); updateBody(); updateHUD(); snapCamera();
  }

  let lastStartTimestamp = 0;
  function startGame(e) {
    if (e) e.stopPropagation();
    const now = performance.now();
    if (state.mode === 'playing' || now - lastStartTimestamp < 300) return;
    lastStartTimestamp = now;
    try { sfx.init(); resetControlsVisuals(); resetGame(); state.mode = 'playing'; hideStartOverlay(); } catch (err) { showFatal('Start Error: ' + err.message); }
  }

  function spawnFood() {
    const maxR = CFG.arenaRadius - 7.5;
    let x = 0, z = 0;
    for (let t = 0; t < 50; t++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * maxR;
      x = Math.cos(a) * r; z = Math.sin(a) * r;
      if (Math.hypot(x - state.headPos.x, z - state.headPos.z) > 14) break;
    }
    foodGroup.position.set(x, 0, z); foodGlowLight.position.set(x, 2.5, z);
  }

  function updateBody() {
    const count = state.segmentCount;
    ensureSegments(count);
    let acc = 0, segIdx = 0, target = CFG.segSpacing, prevX = state.headPos.x, prevZ = state.headPos.z, cursor = trailHead;

    for (let step = 0; step < trailCount && segIdx < count; step++) {
      const px = trailX[cursor];
      const pz = trailZ[cursor];
      cursor = (cursor - 1 + TRAIL_CAPACITY) & (TRAIL_CAPACITY - 1);
      const dx = px - prevX;
      const dz = pz - prevZ;
      const d = Math.hypot(dx, dz);

      if (d > 1e-5) {
        while (segIdx < count && acc + d >= target) {
          const t = (target - acc) / d;
          const mesh = segments[segIdx];
          mesh.position.set(prevX + dx * t, CFG.snakeY, prevZ + dz * t);
          const taper = Math.max(0.46, 0.95 - (segIdx / (count + 8)) * 0.45);
          mesh.scale.setScalar(CFG.headRadius * taper);
          mesh.visible = true;
          segIdx++; target += CFG.segSpacing;
        }
        acc += d;
      }
      prevX = px; prevZ = pz;
    }

    for (let i = segIdx; i < segments.length; i++) {
      if (segments[i].visible) segments[i].visible = false;
    }
  }

  function snapCamera() {
    const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
    camera.up.set(0, 1, 0);
    camera.position.set(state.headPos.x - fx * CFG.camBack, state.headPos.y + CFG.camUp, state.headPos.z - fz * CFG.camBack);
    lookTarget.set(state.headPos.x + fx * CFG.camAhead, state.headPos.y + 1.2, state.headPos.z + fz * CFG.camAhead);
    camera.lookAt(lookTarget);
  }

  function updateCamera(dt) {
    const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
    const boostCamOffset = (state.speedMult - 1.0) * 2.2;
    const dX = state.headPos.x - fx * (CFG.camBack + boostCamOffset);
    const dY = state.headPos.y + CFG.camUp + boostCamOffset * 0.35;
    const dZ = state.headPos.z - fz * (CFG.camBack + boostCamOffset);
    const kPos = 1 - Math.exp(-CFG.camLag * dt);
    camera.position.x += (dX - camera.position.x) * kPos;
    camera.position.y += (dY - camera.position.y) * kPos;
    camera.position.z += (dZ - camera.position.z) * kPos;

    const tX = state.headPos.x + fx * CFG.camAhead, tY = state.headPos.y + 1.2, tZ = state.headPos.z + fz * CFG.camAhead;
    const kLook = 1 - Math.exp(-CFG.lookLag * dt);
    lookTarget.x += (tX - lookTarget.x) * kLook;
    lookTarget.y += (tY - lookTarget.y) * kLook;
    lookTarget.z += (tZ - lookTarget.z) * kLook;
    camera.up.set(0, 1, 0); camera.lookAt(lookTarget);
  }

  function onEat() {
    sfx.playEat();
    spawnParticles(foodGroup.position.x, 1.3, foodGroup.position.z, 0xffd166, 18);
    state.score++;
    if (state.score > state.best) { state.best = state.score; safeSetStorage('neon_viper_best', state.best); }
    state.segmentCount += CFG.growPerFood;
    currentSpeed = Math.min(CFG.maxSpeed, currentSpeed + 0.22);
    spawnFood(); updateHUD();
  }

  function onGameOver() {
    if (state.mode !== 'playing') return;
    state.mode = 'over'; state.turnInput = 0; state.speedMult = 1.0;
    resetControlsVisuals(); sfx.playCrash();
    spawnParticles(state.headPos.x, state.headPos.y, state.headPos.z, 0xff2e64, 28);
    ringMat.color.copy(COLOR_RED_WARN); wallMat.color.copy(COLOR_RED_WARN); postsMat.color.copy(COLOR_RED_WARN); wallMat.opacity = 0.26;
    if (state.score > state.best) { state.best = state.score; safeSetStorage('neon_viper_best', state.best); }
    updateHUD(); setTimeout(() => showStartOverlay('over'), 520);
  }

  const throttleControl = document.getElementById('throttleControl');
  const throttleKnob = document.getElementById('throttleKnob');
  const throttleCaption = document.getElementById('throttleCaption');
  const steeringControl = document.getElementById('steeringControl');
  const wheelSvg = document.getElementById('wheel-svg');
  const steeringCaption = document.getElementById('steeringCaption');

  let throttleActive = false, throttleTouchId = null, throttleOffsetY = 0, wasBoosting = false;
  const MAX_THROTTLE_PX = 52;

  let steeringActive = false, steeringTouchId = null, prevTouchAngle = 0, wheelAngleDeg = 0;
  const MAX_WHEEL_DEG = 360;

  let gyroEnabled = false, gyroHasData = false, gyroRawSteer = 0, gyroRawPitch = 0, gyroNeedsCalib = true, neutralGy = 0, neutralPitch = 0;

  const gyroHudBtn = document.getElementById('gyroHudBtn');
  const gyroModalToggleBtn = document.getElementById('gyroModalToggleBtn');
  const gyroCalibrateBtn = document.getElementById('gyroCalibrateBtn');

  function handleDeviceMotion(e) {
    const g = e.accelerationIncludingGravity;
    if (!g || (g.x === null && g.y === null && g.z === null)) return;
    gyroHasData = true;

    if (gyroNeedsCalib) {
      neutralGy = g.y;
      neutralPitch = Math.atan2(g.z, Math.hypot(g.x, g.y));
      gyroNeedsCalib = false;
    }

    let rawSteer = g.y - neutralGy;
    const angle = window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number' ? window.screen.orientation.angle : typeof window.orientation === 'number' ? window.orientation : 0;
    if (angle === 270 || angle === -90) rawSteer = -rawSteer;
    if (Math.abs(rawSteer) < 0.35) rawSteer = 0;
    gyroRawSteer = Math.max(-1, Math.min(1, rawSteer / 5.2));

    const currentPitch = Math.atan2(g.z, Math.hypot(g.x, g.y));
    let pitchDelta = currentPitch - neutralPitch;
    if (Math.abs(pitchDelta) < 0.05) pitchDelta = 0;
    gyroRawPitch = Math.max(-1, Math.min(1, pitchDelta / 0.45));
  }

  function updateGyroUI() {
    gyroHudBtn.classList.toggle('active', gyroEnabled);
    gyroModalToggleBtn.classList.toggle('active', gyroEnabled);
    gyroModalToggleBtn.textContent = gyroEnabled ? 'GYRO: ON' : 'GYRO: OFF';
    refreshCtrlBadge();
  }

  function toggleGyro() {
    sfx.init();
    if (!gyroEnabled) {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then((p) => {
          if (p === 'granted') {
            window.addEventListener('devicemotion', handleDeviceMotion, true);
            gyroEnabled = true; gyroNeedsCalib = true; updateGyroUI();
          }
        }).catch(() => {});
      } else {
        window.addEventListener('devicemotion', handleDeviceMotion, true);
        gyroEnabled = true; gyroNeedsCalib = true; updateGyroUI();
      }
    } else { gyroEnabled = false; updateGyroUI(); }
  }

  gyroHudBtn.addEventListener('click', toggleGyro);
  gyroModalToggleBtn.addEventListener('click', toggleGyro);
  gyroCalibrateBtn.addEventListener('click', () => {
    gyroNeedsCalib = true;
    gyroCalibrateBtn.textContent = 'CALIBRATED ✓';
    setTimeout(() => { gyroCalibrateBtn.textContent = 'RECENTER GYRO'; }, 1000);
  });

  let gamepadConnected = false, prevGpStartPressed = false;
  window.addEventListener('gamepadconnected', () => { gamepadConnected = true; refreshCtrlBadge(); });
  window.addEventListener('gamepaddisconnected', () => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    gamepadConnected = Array.from(pads).some((p) => p && p.connected); refreshCtrlBadge();
  });

  function refreshCtrlBadge() {
    if (gamepadConnected && gyroEnabled) { ctrlPill.textContent = 'PAD + GYRO'; ctrlPill.classList.add('show'); }
    else if (gamepadConnected) { ctrlPill.textContent = 'GAMEPAD'; ctrlPill.classList.add('show'); }
    else if (gyroEnabled) { ctrlPill.textContent = 'GYRO TILT'; ctrlPill.classList.add('show'); }
    else { ctrlPill.classList.remove('show'); }
  }

  function pollGamepad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    if (!pads) return null;
    let activePad = null;
    for (let i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { activePad = pads[i]; break; } }
    if (!activePad) return null;
    if (!gamepadConnected) { gamepadConnected = true; refreshCtrlBadge(); }
    const startPressed = Boolean((activePad.buttons[9] && activePad.buttons[9].pressed) || (state.mode !== 'playing' && activePad.buttons[0] && activePad.buttons[0].pressed));
    if (startPressed && !prevGpStartPressed) { if (state.mode !== 'playing' && !settingsOverlay.classList.contains('show')) startGame(); }
    prevGpStartPressed = startPressed;

    let stickX = activePad.axes[0] || 0;
    if (Math.abs(activePad.axes[2] || 0) > Math.abs(stickX)) stickX = activePad.axes[2] || 0;
    if (Math.abs(stickX) < 0.12) stickX = 0;
    if (activePad.buttons[14] && activePad.buttons[14].pressed) stickX = -1;
    if (activePad.buttons[15] && activePad.buttons[15].pressed) stickX = 1;

    const r2 = activePad.buttons[7] ? activePad.buttons[7].value : 0;
    const l2 = activePad.buttons[6] ? activePad.buttons[6].value : 0;
    const btnA = activePad.buttons[0] && activePad.buttons[0].pressed ? 1 : 0;
    const btnB = activePad.buttons[1] && activePad.buttons[1].pressed ? 1 : 0;
    const dUp = activePad.buttons[12] && activePad.buttons[12].pressed ? 1 : 0;
    const dDown = activePad.buttons[13] && activePad.buttons[13].pressed ? 1 : 0;
    const stickY = activePad.axes[1] || 0;
    let throttleNorm = 0;
    if (r2 > 0.08 || btnA || dUp) throttleNorm = Math.max(r2, btnA, dUp);
    else if (l2 > 0.08 || btnB || dDown) throttleNorm = -Math.max(l2, btnB, dDown);
    else if (Math.abs(stickY) > 0.18) throttleNorm = -stickY;

    return { steer: Math.max(-1, Math.min(1, stickX)), throttle: Math.max(-1, Math.min(1, throttleNorm)) };
  }

  function syncThrottleDOM(kClass, capText, capColor, offsetY) {
    if (domCache.knobClass !== kClass) { domCache.knobClass = kClass; throttleKnob.className = kClass; }
    if (domCache.throttleCapText !== capText) { domCache.throttleCapText = capText; throttleCaption.textContent = capText; }
    if (domCache.throttleCapColor !== capColor) { domCache.throttleCapColor = capColor; throttleCaption.style.color = capColor; }
    
    const tf = `translateY(${offsetY.toFixed(1)}px)`;
    
    if (domCache.knobTransform !== tf) { domCache.knobTransform = tf; throttleKnob.style.transform = tf; }
    updateHUD();
  }

  function applyThrottleNorm(norm) {
    throttleOffsetY = -norm * MAX_THROTTLE_PX;
    if (norm > 0.08) {
      const boostFactor = (norm - 0.08) / 0.92;
      state.speedMult = 1.0 + boostFactor * 0.85;
      if (!wasBoosting && boostFactor > 0.4) { sfx.playBoostTone(); wasBoosting = true; }
      syncThrottleDOM('boosting', 'BOOST ' + state.speedMult.toFixed(1) + 'x', '#00ffff', throttleOffsetY);
    } else if (norm < -0.08) {
      const brakeFactor = (Math.abs(norm) - 0.08) / 0.92;
      state.speedMult = 1.0 - brakeFactor * 0.65;
      wasBoosting = false;
      syncThrottleDOM('braking', 'BRAKE ' + state.speedMult.toFixed(1) + 'x', '#ffaa00', throttleOffsetY);
    } else {
      state.speedMult = 1.0;
      wasBoosting = false;
      syncThrottleDOM('', 'CRUISE 1.0x', 'rgba(141,255,224,0.65)', throttleOffsetY);
    }
  }

  function updateThrottleFromClientY(clientY) {
    const rect = throttleControl.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const dy = clientY - centerY;
    const clampedDy = Math.max(-MAX_THROTTLE_PX, Math.min(MAX_THROTTLE_PX, dy));
    const norm = -clampedDy / MAX_THROTTLE_PX;
    applyThrottleNorm(norm);
  }

  function releaseThrottle() { throttleActive = false; throttleTouchId = null; wasBoosting = false; }

  function getAngleFromWheelCenter(clientX, clientY) {
    const rect = steeringControl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX);
  }

  function startSteeringWheel(clientX, clientY, touchId = null) {
    if (state.mode !== 'playing') return;
    sfx.init();
    steeringActive = true;
    steeringTouchId = touchId;
    prevTouchAngle = getAngleFromWheelCenter(clientX, clientY);
  }

  function moveSteeringWheel(clientX, clientY) {
    if (!steeringActive) return;
    const currentAngle = getAngleFromWheelCenter(clientX, clientY);
    let deltaRad = currentAngle - prevTouchAngle;
    while (deltaRad > Math.PI) deltaRad -= Math.PI * 2;
    while (deltaRad < -Math.PI) deltaRad += Math.PI * 2;
    prevTouchAngle = currentAngle;
    const deltaDeg = deltaRad * (180 / Math.PI);
    wheelAngleDeg = Math.max(-MAX_WHEEL_DEG, Math.min(MAX_WHEEL_DEG, wheelAngleDeg + deltaDeg));
    state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180));
    applyWheelVisuals();
  }

  function applyWheelVisuals() {
    const tf = `rotate(${wheelAngleDeg.toFixed(1)}deg)`;
    
    if (domCache.wheelTransform !== tf) { domCache.wheelTransform = tf; wheelSvg.style.transform = tf; }
    const roundedDeg = Math.round(wheelAngleDeg);
    let capText = 'STEER 0°';
    let capColor = 'rgba(141,255,224,0.65)';
    if (Math.abs(roundedDeg) >= 3) {
      const dir = roundedDeg > 0 ? 'R' : 'L';
      capText = `${dir} ${Math.abs(roundedDeg)}°`;
      capColor = '#6effd0';
    }
    if (domCache.steerCapText !== capText) { domCache.steerCapText = capText; steeringCaption.textContent = capText; }
    if (domCache.steerCapColor !== capColor) { domCache.steerCapColor = capColor; steeringCaption.style.color = capColor; }
  }

  function releaseSteeringWheel() { steeringActive = false; steeringTouchId = null; }

  function resetControlsVisuals() {
    throttleActive = false; throttleTouchId = null; throttleOffsetY = 0;
    syncThrottleDOM('', 'CRUISE 1.0x', 'rgba(141,255,224,0.65)', 0);
    steeringActive = false; steeringTouchId = null; wheelAngleDeg = 0; applyWheelVisuals();
  }

  throttleControl.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'playing') return;
    e.preventDefault(); sfx.init();
    if (throttleTouchId === null) {
      throttleActive = true; throttleTouchId = e.pointerId;
      try { throttleControl.setPointerCapture(e.pointerId); } catch (err) {}
      updateThrottleFromClientY(e.clientY);
    }
  });

  steeringControl.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'playing') return;
    e.preventDefault();
    if (steeringTouchId === null) {
      try { steeringControl.setPointerCapture(e.pointerId); } catch (err) {}
      startSteeringWheel(e.clientX, e.clientY, e.pointerId);
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (!throttleActive && !steeringActive) return;
    if (throttleActive && e.pointerId === throttleTouchId) updateThrottleFromClientY(e.clientY);
    if (steeringActive && e.pointerId === steeringTouchId) moveSteeringWheel(e.clientX, e.clientY);
  });

  function handlePointerEnd(e) {
    if (throttleActive && e.pointerId === throttleTouchId) releaseThrottle();
    if (steeringActive && e.pointerId === steeringTouchId) releaseSteeringWheel();
  }
  window.addEventListener('pointerup', handlePointerEnd);
  window.addEventListener('pointercancel', handlePointerEnd);

  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ' || e.key === 'Enter') {
      if (state.mode !== 'playing' && !settingsOverlay.classList.contains('show')) startGame();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  function updateCockpitControls(dt, gpState) {
    let gyroSteerNorm = 0, gyroThrottleNorm = 0;
    if (gyroEnabled && gyroHasData) { gyroSteerNorm = gyroRawSteer; gyroThrottleNorm = gyroRawPitch; }

    const keyUp = keys['ArrowUp'] || keys['w'] || keys['W'];
    const keyDown = keys['ArrowDown'] || keys['s'] || keys['S'];

    if (!throttleActive) {
      if (gpState && Math.abs(gpState.throttle) > 0.05) { applyThrottleNorm(gpState.throttle); }
      else if (gyroEnabled && Math.abs(gyroThrottleNorm) > 0.05) { applyThrottleNorm(gyroThrottleNorm); }
      else if (keyUp) {
        throttleOffsetY += (-MAX_THROTTLE_PX - throttleOffsetY) * Math.min(1, dt * 12);
        state.speedMult = 1.85;
        syncThrottleDOM('boosting', 'BOOST 1.8x', '#00ffff', throttleOffsetY);
      } else if (keyDown) {
        throttleOffsetY += (MAX_THROTTLE_PX - throttleOffsetY) * Math.min(1, dt * 12);
        state.speedMult = 0.35;
        syncThrottleDOM('braking', 'BRAKE 0.4x', '#ffaa00', throttleOffsetY);
      } else if (Math.abs(throttleOffsetY) > 0.05 || Math.abs(state.speedMult - 1.0) > 0.005) {
        throttleOffsetY *= Math.exp(-12 * dt);
        if (Math.abs(throttleOffsetY) < 0.3) throttleOffsetY = 0;
        state.speedMult += (1.0 - state.speedMult) * Math.min(1, dt * 10);
        if (Math.abs(state.speedMult - 1.0) < 0.015) state.speedMult = 1.0;
        syncThrottleDOM('', 'CRUISE 1.0x', 'rgba(141,255,224,0.65)', throttleOffsetY);
      }
    }

    const keyLeft = keys['ArrowLeft'] || keys['a'] || keys['A'];
    const keyRight = keys['ArrowRight'] || keys['d'] || keys['D'];

    if (!steeringActive) {
      if (gpState && Math.abs(gpState.steer) > 0.02) {
        const targetDeg = gpState.steer * 180;
        wheelAngleDeg += (targetDeg - wheelAngleDeg) * Math.min(1, dt * 14);
        state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180));
        applyWheelVisuals();
      } else if (gyroEnabled && Math.abs(gyroSteerNorm) > 0.02) {
        const targetDeg = gyroSteerNorm * 180;
        wheelAngleDeg += (targetDeg - wheelAngleDeg) * Math.min(1, dt * 12);
        state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180));
        applyWheelVisuals();
      } else if (keyLeft || keyRight) {
        const dir = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
        wheelAngleDeg = Math.max(-MAX_WHEEL_DEG, Math.min(MAX_WHEEL_DEG, wheelAngleDeg + dir * 260 * dt));
        state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180));
        applyWheelVisuals();
      } else if (Math.abs(wheelAngleDeg) > 0.05) {
        wheelAngleDeg *= Math.exp(-10 * dt);
        if (Math.abs(wheelAngleDeg) < 0.4) wheelAngleDeg = 0;
        state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180));
        applyWheelVisuals();
      }
    }
  }

  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const sensSlider = document.getElementById('sensSlider');
  const sensValText = document.getElementById('sensValText');
  const gaugeFill = document.getElementById('gaugeFill');
  const presetBtns = document.querySelectorAll('.preset-btn');

  function setSensitivity(val) {
    sensitivity = Math.max(0.3, Math.min(2.5, parseFloat(val)));
    sensSlider.value = sensitivity; sensValText.textContent = sensitivity.toFixed(2) + 'x';
    const pct = ((sensitivity - 0.3) / (2.5 - 0.3)) * 100;
    gaugeFill.style.width = pct + '%';
    presetBtns.forEach((btn) => {
      const s = parseFloat(btn.getAttribute('data-sens'));
      if (Math.abs(s - sensitivity) < 0.05) btn.classList.add('active'); else btn.classList.remove('active');
    });
    safeSetStorage('neon_viper_sens', sensitivity);
  }
  setSensitivity(sensitivity);

  sensSlider.addEventListener('input', (e) => setSensitivity(e.target.value));
  presetBtns.forEach((btn) => { btn.addEventListener('click', () => setSensitivity(btn.getAttribute('data-sens'))); });

  settingsBtn.addEventListener('click', () => {
    if (state.mode === 'playing') state.mode = 'paused';
    settingsOverlay.classList.add('show');
  });
  closeSettingsBtn.addEventListener('click', () => {
    settingsOverlay.classList.remove('show');
    if (state.mode === 'paused') state.mode = 'playing';
  });

  const muteBtn = document.getElementById('muteBtn');
  const audioOnIcon = document.getElementById('audioOnIcon');
  const audioOffIcon = document.getElementById('audioOffIcon');
  function syncMuteUI() {
    audioOnIcon.style.display = sfx.muted ? 'none' : 'block';
    audioOffIcon.style.display = sfx.muted ? 'block' : 'none';
  }
  syncMuteUI();
  muteBtn.addEventListener('click', () => {
    sfx.init();
    sfx.muted = !sfx.muted;
    safeSetStorage('neon_viper_mute', sfx.muted ? '1' : '0');
    syncMuteUI();
  });

  startBtn.addEventListener('click', startGame);
  startOverlay.addEventListener('pointerdown', (e) => { if (e.target === startOverlay || e.target === startBtn) startGame(e); });

  function updateGame(dt) {
    gameTime += dt;
    const gpState = pollGamepad();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) { p.mesh.visible = false; }
        else {
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.vy -= 15 * dt;
          const sc = p.life / p.maxLife;
          p.mesh.scale.setScalar(sc);
        }
      }
    }

    if (state.mode === 'playing') {
      updateCockpitControls(dt, gpState);
      state.yaw -= state.turnInput * CFG.baseTurnRate * sensitivity * dt;

      const speedNow = currentSpeed * state.speedMult;
      const fx = Math.sin(state.yaw);
      const fz = Math.cos(state.yaw);
      const stepDist = speedNow * dt;

      const subSteps = Math.max(1, Math.ceil(stepDist / 0.18));
      const subDx = (fx * stepDist) / subSteps;
      const subDz = (fz * stepDist) / subSteps;
      for (let s = 0; s < subSteps; s++) {
        state.headPos.x += subDx;
        state.headPos.z += subDz;
        pushTrailPoint(state.headPos.x, state.headPos.z);
      }
      state.headPos.y = CFG.snakeY;

      updateBody();

      for (let i = 8; i < state.segmentCount; i++) {
        if (i >= segments.length) break;
        const seg = segments[i];
        if (seg.visible) {
          const dx = state.headPos.x - seg.position.x;
          const dz = state.headPos.z - seg.position.z;
          if (dx * dx + dz * dz < (CFG.headRadius * 1.18) * (CFG.headRadius * 1.18)) { onGameOver(); break; }
        }
      }

      const distFromCenter = Math.hypot(state.headPos.x, state.headPos.z);
      const distToWall = CFG.arenaRadius - distFromCenter;
      if (distToWall < 11) {
        const dangerRatio = Math.max(0, Math.min(1, (11 - distToWall) / 6.5));
        ringMat.color.copy(COLOR_BLUE_RING).lerp(COLOR_RED_WARN, dangerRatio);
        wallMat.color.copy(COLOR_BLUE_RING).lerp(COLOR_RED_WARN, dangerRatio);
        postsMat.color.copy(COLOR_BLUE_POST).lerp(COLOR_RED_WARN, dangerRatio);
        wallMat.opacity = 0.085 + dangerRatio * 0.175;
      } else {
        ringMat.color.copy(COLOR_BLUE_RING);
        wallMat.color.copy(COLOR_BLUE_RING);
        postsMat.color.copy(COLOR_BLUE_POST);
        wallMat.opacity = 0.085;
      }

      if (distFromCenter > CFG.arenaRadius - CFG.headRadius) { onGameOver(); }

      if (state.mode === 'playing') {
        const fdx = state.headPos.x - foodGroup.position.x;
        const fdz = state.headPos.z - foodGroup.position.z;
        const hitDist = CFG.headRadius + CFG.foodRadius + 0.3;
        if (fdx * fdx + fdz * fdz < hitDist * hitDist) { onEat(); }
      }
    }

    headGroup.position.copy(state.headPos);
    headGroup.rotation.y = state.yaw;
    headGroup.rotation.z = -state.turnInput * 0.28;
    tongueMesh.scale.z = 0.75 + Math.sin(gameTime * 16) * 0.35;
    viperGlowLight.position.set(state.headPos.x, 2.8, state.headPos.z);

    foodMesh.rotation.y += dt * 2.4;
    foodMesh.rotation.x += dt * 1.1;
    foodMesh.position.y = 1.30 + Math.sin(gameTime * 3.2) * 0.28;
    const ringScale = 1.0 + Math.sin(gameTime * 4.5) * 0.14;
    foodRing.scale.set(ringScale, ringScale, 1);

    starField.rotation.y += dt * 0.015;
    updateCamera(dt);
  }

  let fpsFrames = 0, fpsTimer = 0;
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    fpsFrames++; fpsTimer += rawDt;
    if (fpsTimer >= 2.0) {
      const avgFps = fpsFrames / fpsTimer;
      if (avgFps < 46 && currentDPR > 1.0) {
        currentDPR = Math.max(1.0, currentDPR - 0.25);
        renderer.setPixelRatio(currentDPR);
      } else if (avgFps > 57 && currentDPR < maxDPR) {
        currentDPR = Math.min(maxDPR, currentDPR + 0.25);
        renderer.setPixelRatio(currentDPR);
      }
      fpsFrames = 0; fpsTimer = 0;
    }

    updateGame(dt);
    renderer.render(scene, camera);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  resetGame(); updateHUD(); showStartOverlay('start'); animate();
}
