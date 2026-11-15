/* Neon Viper 3D - Core Game Logic */

function safeGetStorage(key, fallback) {
  try { const val = localStorage.getItem(key); return val !== null ? val : fallback; } catch (e) { return fallback; }
}
function safeSetStorage(key, val) { try { localStorage.setItem(key, String(val)); } catch (e) {} }

const fatalEl = document.getElementById('fatal');
function showFatal(msg) { if (fatalEl) { fatalEl.textContent = '⚠ ' + msg; fatalEl.classList.add('show'); } }
window.addEventListener('error', function(e){ if (e && e.message) showFatal(e.message); });

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
  constructor() { this.ctx = null; this.muted = false; }
  init() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  playEat() {
    if (this.muted || !this.ctx) return;
    try {
      const n = this.ctx.currentTime; const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(523.25, n); o.frequency.exponentialRampToValueAtTime(880, n + 0.12);
      g.gain.setValueAtTime(0.25, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.14);
      o.connect(g); g.connect(this.ctx.destination); o.start(n); o.stop(n + 0.15);
    } catch(e){}
  }
  playBoostTone() {
    if (this.muted || !this.ctx) return;
    try {
      const n = this.ctx.currentTime; const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(190, n); o.frequency.exponentialRampToValueAtTime(340, n + 0.12);
      g.gain.setValueAtTime(0.08, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.13);
      o.connect(g); g.connect(this.ctx.destination); o.start(n); o.stop(n + 0.14);
    } catch(e){}
  }
  playCrash() {
    if (this.muted || !this.ctx) return;
    try {
      const n = this.ctx.currentTime; const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(160, n); o.frequency.exponentialRampToValueAtTime(30, n + 0.35);
      g.gain.setValueAtTime(0.45, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.38);
      o.connect(g); g.connect(this.ctx.destination); o.start(n); o.stop(n + 0.4);
    } catch(e){}
  }
}
const sfx = new SoundFx();

window.addEventListener('load', () => {
  if (window.THREE) {
    try { bootGame(); } catch(err) { showFatal(err.message); }
  } else {
    showFatal('3D Engine failed to load locally.');
  }
});

function bootGame() {
  const CFG = {
    arenaRadius: 50.4, headRadius: 1.30, snakeY: 1.05, baseSpeed: 9.5, maxSpeed: 15.5,
    baseTurnRate: 2.65, segSpacing: 0.86, startSegments: 12, growPerFood: 3, foodRadius: 0.95,
    camBack: 14.0, camUp: 9.2, camAhead: 6.0, camLag: 6.5, lookLag: 9.0
  };

  let currentSpeed = CFG.baseSpeed;
  let sensitivity = parseFloat(safeGetStorage('neon_viper_sens', '1.0'));
  if (!isFinite(sensitivity)) sensitivity = 1.0;

  const renderer = new THREE.WebGLRenderer({ antialias:false, powerPreference:'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070f);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1400);
  camera.position.set(0, 10, -14);

  scene.add(new THREE.HemisphereLight(0x3366ff, 0x080a18, 1.1));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.7);
  dirLight.position.set(28, 48, 18);
  scene.add(dirLight);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(CFG.arenaRadius, 64), new THREE.MeshStandardMaterial({ color:0x0a1730, roughness:0.88, metalness:0.35 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  const grid = new THREE.PolarGridHelper(CFG.arenaRadius, 16, 8, 64, 0x1b4f8a, 0x123a63);
  grid.position.y = 0.02; grid.material.transparent = true; grid.material.opacity = 0.65; scene.add(grid);

  const COLOR_BLUE_RING = new THREE.Color(0x00a8ff);
  const COLOR_BLUE_POST = new THREE.Color(0x33bbff);
  const COLOR_RED_WARN  = new THREE.Color(0xff1a35);

  const ringMat = new THREE.MeshBasicMaterial({ color:0x00a8ff });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(CFG.arenaRadius, 0.45, 8, 64), ringMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.55; scene.add(ring);

  const wallMat = new THREE.MeshBasicMaterial({ color:0x00a8ff, transparent:true, opacity:0.085, side:THREE.DoubleSide, depthWrite:false });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(CFG.arenaRadius, CFG.arenaRadius, 5.5, 64, 1, true), wallMat);
  wall.position.y = 2.75; scene.add(wall);

  const postsMat = new THREE.MeshBasicMaterial({ color:0x33bbff });
  const postsGeo = new THREE.BoxGeometry(0.35, 2.2, 0.35);
  const inst = new THREE.InstancedMesh(postsGeo, postsMat, 44);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 44; i++) { const a = (i / 44) * Math.PI * 2; m.makeTranslation(Math.cos(a) * CFG.arenaRadius, 1.1, Math.sin(a) * CFG.arenaRadius); inst.setMatrixAt(i, m); }
  scene.add(inst);

  const headGroup = new THREE.Group(); scene.add(headGroup);
  headGroup.add(new THREE.Mesh(new THREE.SphereGeometry(CFG.headRadius, 16, 12), new THREE.MeshStandardMaterial({ color:0x2bffb0, emissive:0x0e9a6a, emissiveIntensity:1.25, roughness:0.28, metalness:0.25 })));
  const whiteGeo = new THREE.SphereGeometry(0.30, 8, 6); const whiteMat = new THREE.MeshBasicMaterial({ color:0xffffff });
  const pupilGeo = new THREE.SphereGeometry(0.15, 6, 4); const pupilMat = new THREE.MeshBasicMaterial({ color:0x04231a });
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(whiteGeo, whiteMat); eye.position.set(0.56 * s, 0.46, 0.98); headGroup.add(eye);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat); pupil.position.set(0.62 * s, 0.48, 1.18); headGroup.add(pupil);
  });

  const SEG_GEO = new THREE.SphereGeometry(1, 8, 6); const segments = [];
  function ensureSegments(n) {
    while (segments.length < n) {
      const i = segments.length;
      const hue = 0.42 - (i % 40) * 0.006;
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.85, 0.50), emissive: new THREE.Color().setHSL(hue, 0.90, 0.24), emissiveIntensity: 1.15, roughness: 0.35, metalness: 0.25 });
      const mesh = new THREE.Mesh(SEG_GEO, mat);
      mesh.scale.setScalar(CFG.headRadius * 0.95);
      mesh.visible = false; scene.add(mesh); segments.push(mesh);
    }
  }

  const foodGroup = new THREE.Group(); scene.add(foodGroup);
  const foodMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(CFG.foodRadius, 0), new THREE.MeshStandardMaterial({ color:0xffd166, emissive:0xff8a00, emissiveIntensity:2.2, roughness:0.25, metalness:0.35 }));
  foodMesh.position.y = 1.30; foodGroup.add(foodMesh);

  const state = { mode: 'ready', score: 0, best: Number(safeGetStorage('neon_viper_best', '0')) || 0, yaw: 0, turnInput: 0, speedMult: 1.0, segmentCount: CFG.startSegments, headPos: new THREE.Vector3(0, CFG.snakeY, 0) };
  const trail = []; let gameTime = 0; const lookTarget = new THREE.Vector3();

  const scoreEl = document.getElementById('scoreEl');
  const bestEl  = document.getElementById('bestEl');
  const speedBadge = document.getElementById('speedBadge');
  const ctrlPill = document.getElementById('ctrlPill');
  const startOverlay = document.getElementById('startOverlay');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const ovTitle = document.getElementById('ovTitle');
  const ovSub   = document.getElementById('ovSub');
  const startBtn = document.getElementById('startBtn');
  const ovScoreWrap = document.getElementById('ovScoreWrap');
  const ovScore = document.getElementById('ovScore');

  function updateHUD() {
    scoreEl.textContent = state.score; bestEl.textContent = state.best;
    const mult = state.speedMult; speedBadge.textContent = mult.toFixed(1) + 'x SPEED';
    if (mult > 1.15) speedBadge.className = 'speed-badge boost';
    else if (mult < 0.85) speedBadge.className = 'speed-badge brake';
    else speedBadge.className = 'speed-badge';
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
    trail.length = 0; const step = 0.2; const need = state.segmentCount * CFG.segSpacing + 12; const n = Math.ceil(need / step);
    for (let i = n; i >= 0; i--) trail.push({ x: 0, z: -i * step });
    for (let i = 0; i < segments.length; i++) segments[i].visible = false;
    ensureSegments(state.segmentCount);
    ringMat.color.copy(COLOR_BLUE_RING); wallMat.color.copy(COLOR_BLUE_RING); postsMat.color.copy(COLOR_BLUE_POST); wallMat.opacity = 0.085;
    headGroup.position.set(0, CFG.snakeY, 0); headGroup.rotation.set(0, 0, 0);
    spawnFood(); updateBody(); updateHUD(); snapCamera();
  }

  function startGame() {
    try { sfx.init(); resetGame(); state.mode = 'playing'; hideStartOverlay(); } catch (e) { alert('Start Error: ' + e.message); }
  }

  function spawnFood() {
    const maxR = CFG.arenaRadius - 8; let x = 0, z = 0;
    for (let t = 0; t < 50; t++) { const a = Math.random() * Math.PI * 2; const r = Math.sqrt(Math.random()) * maxR; x = Math.cos(a) * r; z = Math.sin(a) * r; if (Math.hypot(x - state.headPos.x, z - state.headPos.z) > 15) break; }
    foodGroup.position.set(x, 0, z);
  }

  function updateBody() {
    const count = state.segmentCount; ensureSegments(count);
    const maxLen = count * CFG.segSpacing + 4; let acc = 0, segIdx = 0, target = CFG.segSpacing, prevX = state.headPos.x, prevZ = state.headPos.z, trimIdx = -1;
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i]; const dx = p.x - prevX; const dz = p.z - prevZ; const d = Math.hypot(dx, dz);
      if (d > 1e-6) {
        while (segIdx < count && acc + d >= target) { const t = (target - acc) / d; const mesh = segments[segIdx]; mesh.position.set(prevX + dx * t, CFG.snakeY, prevZ + dz * t); mesh.visible = true; segIdx++; target += CFG.segSpacing; }
        acc += d;
      }
      prevX = p.x; prevZ = p.z; if (acc > maxLen) { trimIdx = i; break; }
    }
    for (let i = segIdx; i < segments.length; i++) segments[i].visible = false;
    if (trimIdx > 0) trail.splice(0, trimIdx);
  }

  function snapCamera() {
    const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw); camera.up.set(0, 1, 0);
    camera.position.set(state.headPos.x - fx * CFG.camBack, state.headPos.y + CFG.camUp, state.headPos.z - fz * CFG.camBack);
    lookTarget.set(state.headPos.x + fx * CFG.camAhead, state.headPos.y + 1.2, state.headPos.z + fz * CFG.camAhead);
    camera.lookAt(lookTarget);
  }

  function updateCamera(dt) {
    const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
    const dX = state.headPos.x - fx * CFG.camBack, dY = state.headPos.y + CFG.camUp, dZ = state.headPos.z - fz * CFG.camBack;
    const kPos = 1 - Math.exp(-CFG.camLag * dt);
    camera.position.x += (dX - camera.position.x) * kPos; camera.position.y += (dY - camera.position.y) * kPos; camera.position.z += (dZ - camera.position.z) * kPos;
    const tX = state.headPos.x + fx * CFG.camAhead, tY = state.headPos.y + 1.2, tZ = state.headPos.z + fz * CFG.camAhead;
    const kLook = 1 - Math.exp(-CFG.lookLag * dt);
    lookTarget.x += (tX - lookTarget.x) * kLook; lookTarget.y += (tY - lookTarget.y) * kLook; lookTarget.z += (tZ - lookTarget.z) * kLook;
    camera.up.set(0, 1, 0); camera.lookAt(lookTarget);
  }

  function onEat() {
    sfx.playEat(); state.score++; state.segmentCount += CFG.growPerFood;
    currentSpeed = Math.min(CFG.maxSpeed, currentSpeed + 0.22); spawnFood(); updateHUD();
  }

  function onGameOver() {
    if (state.mode !== 'playing') return;
    state.mode = 'over'; state.turnInput = 0; state.speedMult = 1.0;
    resetControlsVisuals(); sfx.playCrash();
    ringMat.color.copy(COLOR_RED_WARN); wallMat.color.copy(COLOR_RED_WARN); postsMat.color.copy(COLOR_RED_WARN); wallMat.opacity = 0.26;
    if (state.score > state.best) { state.best = state.score; safeSetStorage('neon_viper_best', state.best); }
    updateHUD(); setTimeout(() => showStartOverlay('over'), 550);
  }

  // --- CONTROLS ---
  const throttleControl = document.getElementById('throttleControl');
  const throttleKnob    = document.getElementById('throttleKnob');
  const throttleCaption = document.getElementById('throttleCaption');
  const steeringControl = document.getElementById('steeringControl');
  const wheelSvg        = document.getElementById('wheel-svg');
  const steeringCaption = document.getElementById('steeringCaption');

  let throttleActive  = false; let throttleTouchId = null; let throttleOffsetY = 0; const MAX_THROTTLE_PX = 52; let wasBoosting = false;
  let steeringActive  = false; let steeringTouchId = null; let prevTouchAngle  = 0; let wheelAngleDeg   = 0; const MAX_WHEEL_DEG = 360;

  let gyroEnabled = false; let gyroHasData = false; let gyroRawSteer = 0; let gyroRawPitch = 0;
  let gyroNeedsCalib = true; let neutralGy = 0; let neutralPitch = 0;

  const gyroHudBtn = document.getElementById('gyroHudBtn');
  const gyroModalToggleBtn = document.getElementById('gyroModalToggleBtn');
  const gyroCalibrateBtn = document.getElementById('gyroCalibrateBtn');

  function handleDeviceMotion(e) {
    const g = e.accelerationIncludingGravity;
    if (!g || (g.x === null && g.y === null && g.z === null)) return;
    gyroHasData = true;

    if (gyroNeedsCalib) { neutralGy = g.y; neutralPitch = Math.atan2(g.z, Math.hypot(g.x, g.y)); gyroNeedsCalib = false; }

    let rawSteer = g.y - neutralGy;
    const angle = (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number') ? window.screen.orientation.angle : (typeof window.orientation === 'number' ? window.orientation : 0);
    if (angle === 270 || angle === -90) rawSteer = -rawSteer;
    
    if (Math.abs(rawSteer) < 0.4) rawSteer = 0;
    gyroRawSteer = Math.max(-1, Math.min(1, rawSteer / 5.5));

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
    if (!gyroEnabled) {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(p => { if (p === 'granted') { window.addEventListener('devicemotion', handleDeviceMotion, true); gyroEnabled = true; gyroNeedsCalib = true; updateGyroUI(); } }).catch(() => {});
      } else {
        window.addEventListener('devicemotion', handleDeviceMotion, true); gyroEnabled = true; gyroNeedsCalib = true; updateGyroUI();
      }
    } else { gyroEnabled = false; updateGyroUI(); }
  }

  gyroHudBtn.addEventListener('click', toggleGyro); gyroModalToggleBtn.addEventListener('click', toggleGyro);
  gyroCalibrateBtn.addEventListener('click', () => { gyroNeedsCalib = true; gyroCalibrateBtn.textContent = 'CALIBRATED ✓'; setTimeout(() => { gyroCalibrateBtn.textContent = 'RECENTER GYRO'; }, 1000); });

  let gamepadConnected = false; let prevGpStartPressed = false;
  window.addEventListener('gamepadconnected', () => { gamepadConnected = true; refreshCtrlBadge(); });
  window.addEventListener('gamepaddisconnected', () => { const pads = navigator.getGamepads ? navigator.getGamepads() : []; gamepadConnected = Array.from(pads).some(p => p && p.connected); refreshCtrlBadge(); });
  function refreshCtrlBadge() {
    if (gamepadConnected && gyroEnabled) { ctrlPill.textContent = 'PAD + GYRO'; ctrlPill.classList.add('show'); }
    else if (gamepadConnected) { ctrlPill.textContent = 'GAMEPAD'; ctrlPill.classList.add('show'); }
    else if (gyroEnabled) { ctrlPill.textContent = 'GYRO TILT'; ctrlPill.classList.add('show'); }
    else ctrlPill.classList.remove('show');
  }

  function pollGamepad() {
    if (!navigator.getGamepads) return null; const pads = navigator.getGamepads(); if (!pads) return null;
    let activePad = null; for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { activePad = pads[i]; break; }
    if (!activePad) return null; if (!gamepadConnected) { gamepadConnected = true; refreshCtrlBadge(); }
    const startPressed = Boolean((activePad.buttons[9] && activePad.buttons[9].pressed) || (state.mode !== 'playing' && activePad.buttons[0] && activePad.buttons[0].pressed));
    if (startPressed && !prevGpStartPressed) { if (state.mode !== 'playing' && !settingsOverlay.classList.contains('show')) startGame(); }
    prevGpStartPressed = startPressed;
    let stickX = activePad.axes[0] || 0; if (Math.abs(activePad.axes[2] || 0) > Math.abs(stickX)) stickX = activePad.axes[2] || 0;
    if (Math.abs(stickX) < 0.12) stickX = 0; if (activePad.buttons[14] && activePad.buttons[14].pressed) stickX = -1; if (activePad.buttons[15] && activePad.buttons[15].pressed) stickX = 1;
    const r2 = activePad.buttons[7] ? activePad.buttons[7].value : 0, l2 = activePad.buttons[6] ? activePad.buttons[6].value : 0, btnA = activePad.buttons[0] && activePad.buttons[0].pressed ? 1 : 0, btnB = activePad.buttons[1] && activePad.buttons[1].pressed ? 1 : 0, dUp = activePad.buttons[12] && activePad.buttons[12].pressed ? 1 : 0, dDown = activePad.buttons[13] && activePad.buttons[13].pressed ? 1 : 0, stickY = activePad.axes[1] || 0;
    let throttleNorm = 0;
    if (r2 > 0.08 || btnA || dUp) throttleNorm = Math.max(r2, btnA, dUp); else if (l2 > 0.08 || btnB || dDown) throttleNorm = -Math.max(l2, btnB, dDown); else if (Math.abs(stickY) > 0.18) throttleNorm = -stickY;
    return { steer: Math.max(-1, Math.min(1, stickX)), throttle: Math.max(-1, Math.min(1, throttleNorm)) };
  }

  function applyThrottleNorm(norm) {
    throttleOffsetY = -norm * MAX_THROTTLE_PX;
    if (norm > 0.08) {
      const boostFactor = (norm - 0.08) / 0.92; state.speedMult = 1.0 + boostFactor * 0.85; throttleKnob.className = 'boosting'; throttleCaption.textContent = 'BOOST ' + state.speedMult.toFixed(1) + 'x'; throttleCaption.style.color = '#00ffff';
      if (!wasBoosting && boostFactor > 0.4) { sfx.playBoostTone(); wasBoosting = true; }
    } else if (norm < -0.08) {
      const brakeFactor = (Math.abs(norm) - 0.08) / 0.92; state.speedMult = 1.0 - brakeFactor * 0.65; throttleKnob.className = 'braking'; throttleCaption.textContent = 'BRAKE ' + state.speedMult.toFixed(1) + 'x'; throttleCaption.style.color = '#ffaa00'; wasBoosting = false;
    } else { state.speedMult = 1.0; throttleKnob.className = ''; throttleCaption.textContent = 'CRUISE 1.0x'; throttleCaption.style.color = 'rgba(141,255,224,0.65)'; wasBoosting = false; }
    throttleKnob.style.transform = `translateY(${throttleOffsetY.toFixed(1)}px)`; updateHUD();
  }

  function updateThrottleFromClientY(clientY) {
    const rect = throttleControl.getBoundingClientRect(); const centerY = rect.top + rect.height / 2; const dy = clientY - centerY;
    const clampedDy = Math.max(-MAX_THROTTLE_PX, Math.min(MAX_THROTTLE_PX, dy)); const norm = -clampedDy / MAX_THROTTLE_PX; applyThrottleNorm(norm);
  }
  function releaseThrottle() { throttleActive = false; throttleTouchId = null; wasBoosting = false; }

  function getAngleFromWheelCenter(clientX, clientY) { const rect = steeringControl.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2; return Math.atan2(clientY - centerY, clientX - centerX); }
  function startSteeringWheel(clientX, clientY, touchId = null) { if (state.mode !== 'playing') return; sfx.init(); steeringActive = true; steeringTouchId = touchId; prevTouchAngle = getAngleFromWheelCenter(clientX, clientY); }
  function moveSteeringWheel(clientX, clientY) {
    if (!steeringActive) return; const currentAngle = getAngleFromWheelCenter(clientX, clientY); let deltaRad = currentAngle - prevTouchAngle;
    if (deltaRad > Math.PI) deltaRad -= Math.PI * 2; if (deltaRad < -Math.PI) deltaRad += Math.PI * 2; prevTouchAngle = currentAngle;
    const deltaDeg = deltaRad * (180 / Math.PI); wheelAngleDeg = Math.max(-MAX_WHEEL_DEG, Math.min(MAX_WHEEL_DEG, wheelAngleDeg + deltaDeg));
    state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180)); applyWheelVisuals();
  }
  function applyWheelVisuals() {
    wheelSvg.style.transform = `rotate(${wheelAngleDeg.toFixed(1)}deg)`; const roundedDeg = Math.round(wheelAngleDeg);
    if (Math.abs(roundedDeg) < 3) { steeringCaption.textContent = 'STEER 0°'; steeringCaption.style.color = 'rgba(141,255,224,0.65)'; }
    else { const dir = roundedDeg > 0 ? 'R' : 'L'; steeringCaption.textContent = `${dir} ${Math.abs(roundedDeg)}°`; steeringCaption.style.color = '#6effd0'; }
  }
  function releaseSteeringWheel() { steeringActive = false; steeringTouchId = null; }
  function resetControlsVisuals() {
    throttleActive = false; throttleTouchId = null; throttleOffsetY = 0; throttleKnob.style.transform = 'translateY(0px)'; throttleKnob.className = ''; throttleCaption.textContent = 'CRUISE 1.0x'; throttleCaption.style.color = 'rgba(141,255,224,0.65)';
    steeringActive = false; steeringTouchId = null; wheelAngleDeg = 0; applyWheelVisuals();
  }

  throttleControl.addEventListener('pointerdown', (e) => { if (state.mode !== 'playing') return; e.preventDefault(); sfx.init(); if (throttleTouchId === null) { throttleActive = true; throttleTouchId = e.pointerId; updateThrottleFromClientY(e.clientY); } });
  steeringControl.addEventListener('pointerdown', (e) => { if (state.mode !== 'playing') return; e.preventDefault(); if (steeringTouchId === null) { startSteeringWheel(e.clientX, e.clientY, e.pointerId); } });
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
  window.addEventListener('keydown', (e) => { keys[e.key] = true; if (e.key === ' ' || e.key === 'Enter') { if (state.mode !== 'playing' && !settingsOverlay.classList.contains('show')) startGame(); } });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  function updateCockpitControls(dt, gpState) {
    let gyroSteerNorm = 0, gyroThrottleNorm = 0;
    if (gyroEnabled && gyroHasData) { gyroSteerNorm = gyroRawSteer; gyroThrottleNorm = gyroRawPitch; }
    const keyUp = keys['ArrowUp'] || keys['w'] || keys['W'], keyDown = keys['ArrowDown'] || keys['s'] || keys['S'];
    if (!throttleActive) {
      if (gpState && Math.abs(gpState.throttle) > 0.05) applyThrottleNorm(gpState.throttle);
      else if (gyroEnabled && Math.abs(gyroThrottleNorm) > 0.05) applyThrottleNorm(gyroThrottleNorm);
      else if (keyUp) { throttleOffsetY += (-MAX_THROTTLE_PX - throttleOffsetY) * Math.min(1, dt * 12); state.speedMult = 1.85; throttleKnob.className = 'boosting'; throttleCaption.textContent = 'BOOST 1.8x'; throttleCaption.style.color = '#00ffff'; throttleKnob.style.transform = `translateY(${throttleOffsetY.toFixed(1)}px)`; updateHUD(); }
      else if (keyDown) { throttleOffsetY += (MAX_THROTTLE_PX - throttleOffsetY) * Math.min(1, dt * 12); state.speedMult = 0.35; throttleKnob.className = 'braking'; throttleCaption.textContent = 'BRAKE 0.4x'; throttleCaption.style.color = '#ffaa00'; throttleKnob.style.transform = `translateY(${throttleOffsetY.toFixed(1)}px)`; updateHUD(); }
      else { throttleOffsetY *= Math.exp(-12 * dt); if (Math.abs(throttleOffsetY) < 0.4) throttleOffsetY = 0; state.speedMult += (1.0 - state.speedMult) * Math.min(1, dt * 10); if (Math.abs(state.speedMult - 1.0) < 0.02) state.speedMult = 1.0; throttleKnob.className = ''; throttleCaption.textContent = 'CRUISE 1.0x'; throttleCaption.style.color = 'rgba(141,255,224,0.65)'; throttleKnob.style.transform = `translateY(${throttleOffsetY.toFixed(1)}px)`; updateHUD(); }
    }
    const keyLeft = keys['ArrowLeft'] || keys['a'] || keys['A'], keyRight = keys['ArrowRight'] || keys['d'] || keys['D'];
    if (!steeringActive) {
      if (gpState && Math.abs(gpState.steer) > 0.02) { const targetDeg = gpState.steer * 180; wheelAngleDeg += (targetDeg - wheelAngleDeg) * Math.min(1, dt * 14); state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180)); applyWheelVisuals(); }
      else if (gyroEnabled && Math.abs(gyroSteerNorm) > 0.02) { const targetDeg = gyroSteerNorm * 180; wheelAngleDeg += (targetDeg - wheelAngleDeg) * Math.min(1, dt * 12); state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180)); applyWheelVisuals(); }
      else if (keyLeft || keyRight) { const dir = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0); wheelAngleDeg = Math.max(-MAX_WHEEL_DEG, Math.min(MAX_WHEEL_DEG, wheelAngleDeg + dir * 260 * dt)); state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180)); applyWheelVisuals(); }
      else { wheelAngleDeg *= Math.exp(-10 * dt); if (Math.abs(wheelAngleDeg) < 0.5) wheelAngleDeg = 0; state.turnInput = Math.max(-1, Math.min(1, wheelAngleDeg / 180)); applyWheelVisuals(); }
    }
  }

  const settingsBtn = document.getElementById('settingsBtn'), closeSettingsBtn = document.getElementById('closeSettingsBtn'), sensSlider = document.getElementById('sensSlider'), sensValText = document.getElementById('sensValText'), gaugeFill = document.getElementById('gaugeFill'), presetBtns = document.querySelectorAll('.preset-btn');
  function setSensitivity(val) {
    sensitivity = Math.max(0.3, Math.min(2.5, parseFloat(val))); sensSlider.value = sensitivity; sensValText.textContent = sensitivity.toFixed(2) + 'x';
    const pct = ((sensitivity - 0.3) / (2.5 - 0.3)) * 100; gaugeFill.style.width = pct + '%';
    presetBtns.forEach(btn => { const s = parseFloat(btn.getAttribute('data-sens')); if (Math.abs(s - sensitivity) < 0.05) btn.classList.add('active'); else btn.classList.remove('active'); });
    safeSetStorage('neon_viper_sens', sensitivity);
  }
  setSensitivity(sensitivity);
  sensSlider.addEventListener('input', (e) => setSensitivity(e.target.value));
  presetBtns.forEach(btn => { btn.addEventListener('click', () => setSensitivity(btn.getAttribute('data-sens'))); });
  settingsBtn.addEventListener('click', () => { if (state.mode === 'playing') state.mode = 'paused'; settingsOverlay.classList.add('show'); });
  closeSettingsBtn.addEventListener('click', () => { settingsOverlay.classList.remove('show'); if (state.mode === 'paused') state.mode = 'playing'; });

  const muteBtn = document.getElementById('muteBtn'), audioOnIcon = document.getElementById('audioOnIcon'), audioOffIcon = document.getElementById('audioOffIcon');
  muteBtn.addEventListener('click', () => { sfx.muted = !sfx.muted; audioOnIcon.style.display = sfx.muted ? 'none' : 'block'; audioOffIcon.style.display = sfx.muted ? 'block' : 'none'; });

  startBtn.addEventListener('click', startGame);
  startOverlay.addEventListener('pointerdown', startGame);

  function updateGame(dt) {
    gameTime += dt;
    const gpState = pollGamepad();
    if (state.mode === 'playing') {
      updateCockpitControls(dt, gpState);
      state.yaw -= state.turnInput * CFG.baseTurnRate * sensitivity * dt;
      const speedNow = currentSpeed * state.speedMult; const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
      state.headPos.x += fx * speedNow * dt; state.headPos.z += fz * speedNow * dt; state.headPos.y = CFG.snakeY;
      trail.push({ x: state.headPos.x, z: state.headPos.z }); if (trail.length > 4000) trail.splice(0, 2000);
      
      updateBody();
      for (let i = 8; i < state.segmentCount; i++) {
        if (i >= segments.length) break;
        const seg = segments[i];
        if (seg.visible) {
          const dx = state.headPos.x - seg.position.x;
          const dz = state.headPos.z - seg.position.z;
          if (Math.hypot(dx, dz) < CFG.headRadius * 1.25) { onGameOver(); break; }
        }
      }

      const distFromCenter = Math.hypot(state.headPos.x, state.headPos.z); const distToWall = CFG.arenaRadius - distFromCenter;
      if (distToWall < 11) {
        const dangerRatio = Math.max(0, Math.min(1, (11 - distToWall) / 6.5));
        ringMat.color.copy(COLOR_BLUE_RING).lerp(COLOR_RED_WARN, dangerRatio); wallMat.color.copy(COLOR_BLUE_RING).lerp(COLOR_RED_WARN, dangerRatio); postsMat.color.copy(COLOR_BLUE_POST).lerp(COLOR_RED_WARN, dangerRatio); wallMat.opacity = 0.085 + dangerRatio * 0.175;
      } else { ringMat.color.copy(COLOR_BLUE_RING); wallMat.color.copy(COLOR_BLUE_RING); postsMat.color.copy(COLOR_BLUE_POST); wallMat.opacity = 0.085; }

      if (distFromCenter > CFG.arenaRadius - CFG.headRadius) onGameOver();
      if (state.mode === 'playing') {
        const fdx = state.headPos.x - foodGroup.position.x; const fdz = state.headPos.z - foodGroup.position.z;
        if (Math.hypot(fdx, fdz) < CFG.headRadius + CFG.foodRadius + 0.25) onEat();
      }
    }
    headGroup.position.copy(state.headPos); headGroup.rotation.y = state.yaw;
    foodMesh.rotation.y += dt * 2.4; foodMesh.rotation.x += dt * 1.1; foodMesh.position.y = 1.30 + Math.sin(gameTime * 3.2) * 0.28;
    updateCamera(dt);
  }

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    updateGame(dt);
    renderer.render(scene, camera);
  }

  function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
  window.addEventListener('resize', onResize);

  resetGame(); updateHUD(); showStartOverlay('start'); animate();
}
