(function () {
  'use strict';
  const scoreEl = document.getElementById('scoreEl'), bestEl = document.getElementById('bestEl');
  const ctrlPill = document.getElementById('ctrlPill'), speedBadge = document.getElementById('speedBadge');
  const gyroHudBtn = document.getElementById('gyroHudBtn'), muteBtn = document.getElementById('muteBtn');
  const audioOnIcon = document.getElementById('audioOnIcon'), audioOffIcon = document.getElementById('audioOffIcon');
  const settingsBtn = document.getElementById('settingsBtn'), startOverlay = document.getElementById('startOverlay');
  const ovTitle = document.getElementById('ovTitle'), ovSub = document.getElementById('ovSub');
  const ovScoreWrap = document.getElementById('ovScoreWrap'), ovScore = document.getElementById('ovScore');
  const startBtn = document.getElementById('startBtn'), settingsOverlay = document.getElementById('settingsOverlay');
  const sensValText = document.getElementById('sensValText'), sensSlider = document.getElementById('sensSlider');
  const gaugeFill = document.getElementById('gaugeFill'), presetBtns = document.querySelectorAll('.preset-btn');
  const gyroModalToggleBtn = document.getElementById('gyroModalToggleBtn'), gyroCalibrateBtn = document.getElementById('gyroCalibrateBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn'), throttleControl = document.getElementById('throttleControl');
  const throttleCaption = document.getElementById('throttleCaption'), throttleKnob = document.getElementById('throttleKnob');
  const steeringControl = document.getElementById('steeringControl'), steeringCaption = document.getElementById('steeringCaption');
  const wheelSvg = document.getElementById('wheel-svg'), fatalEl = document.getElementById('fatal');

  const store = { get(k, f) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : f; } catch (e) { return f; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  let bestScore = store.get('nv3d_best', 0), sensitivity = store.get('nv3d_sens', 1.0), isMuted = store.get('nv3d_mute', false);
  bestEl.textContent = bestScore;

  // Capacitor Native Bridge (Landscape & Fullscreen)
  document.addEventListener('deviceready', async () => {
    try {
      if (window.Capacitor && window.Capacitor.Plugins) {
        if (window.Capacitor.Plugins.ScreenOrientation) await window.Capacitor.Plugins.ScreenOrientation.lock({ orientation: 'landscape' });
        if (window.Capacitor.Plugins.StatusBar) { await window.Capacitor.Plugins.StatusBar.setOverlaysWebView({ overlay: true }); await window.Capacitor.Plugins.StatusBar.hide(); }
      }
    } catch (e) { console.log(e); }
  });

  const Sound = {
    ctx: null, engineOsc: null, engineGain: null,
    init() { if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; } const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); this.engineOsc = this.ctx.createOscillator(); this.engineGain = this.ctx.createGain(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55; const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 180; this.engineGain.gain.value = 0.0; this.engineOsc.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.ctx.destination); this.engineOsc.start(); },
    updateEngine(ratio, active) { if (!this.ctx || !this.engineGain) return; const now = this.ctx.currentTime; if (!active || isMuted) { this.engineGain.gain.setTargetAtTime(0.0, now, 0.08); return; } this.engineOsc.frequency.setTargetAtTime(46 + ratio * 42, now, 0.06); this.engineGain.gain.setTargetAtTime(0.025 + Math.max(0, (ratio - 1) * 0.025), now, 0.08); },
    playEat(b) { if (isMuted || !this.ctx) return; const n = this.ctx.currentTime, notes = b ? [523.25, 659.25, 783.99, 1046.5] : [440, 587.33, 880]; notes.forEach((f, i) => { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(f, n + i * 0.045); g.gain.setValueAtTime(0.14, n + i * 0.045); g.gain.exponentialRampToValueAtTime(0.001, n + i * 0.045 + 0.18); o.connect(g); g.connect(this.ctx.destination); o.start(n + i * 0.045); o.stop(n + i * 0.045 + 0.19); }); },
    playCrash() { if (isMuted || !this.ctx) return; const n = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(160, n); o.frequency.exponentialRampToValueAtTime(28, n + 0.45); g.gain.setValueAtTime(0.24, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.48); o.connect(g); g.connect(this.ctx.destination); o.start(n); o.stop(n + 0.5); },
    playClick() { if (isMuted || !this.ctx) return; const n = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(660, n); o.frequency.exponentialRampToValueAtTime(880, n + 0.04); g.gain.setValueAtTime(0.08, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.045); o.connect(g); g.connect(this.ctx.destination); o.start(n); o.stop(n + 0.05); }
  };
  function updateMuteUI() { audioOnIcon.style.display = isMuted ? 'none' : 'block'; audioOffIcon.style.display = isMuted ? 'block' : 'none'; muteBtn.classList.toggle('active', !isMuted); }
  updateMuteUI();

  function bootWhenReady() { if (typeof window.THREE === 'undefined') { setTimeout(bootWhenReady, 80); return; } try { initGameEngine(); } catch (err) { fatalEl.textContent = '3D WebGL Init Error: ' + (err && err.message ? err.message : String(err)); fatalEl.classList.add('show'); } }

  function initGameEngine() {
    const THREE = window.THREE;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setClearColor(0x04070f, 1); document.body.insertBefore(renderer.domElement, document.body.firstChild);
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x04070f, 0.0072);
    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 260); camera.position.set(0, 26, 32);
    scene.add(new THREE.AmbientLight(0x88bbee, 0.75));
    const dirLight = new THREE.DirectionalLight(0xaaffec, 0.9); dirLight.position.set(35, 70, 45); scene.add(dirLight);
    const headLight = new THREE.PointLight(0x4affc4, 1.8, 32, 1.5); scene.add(headLight);

    const ARENA_HALF = 68, ARENA_LIMIT = ARENA_HALF - 2.3;
    const arenaGroup = new THREE.Group(); scene.add(arenaGroup);
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2), new THREE.MeshStandardMaterial({ color: 0x050b16, roughness: 0.35, metalness: 0.65 })); floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.y = -0.05; arenaGroup.add(floorMesh);
    const gridHelper = new THREE.GridHelper(ARENA_HALF * 2, 34, 0x22ffc0, 0x0d2b45); gridHelper.position.y = 0.01; arenaGroup.add(gridHelper);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b263d, emissive: 0x00e5ff, emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.8 });
    [{ w: ARENA_HALF * 2 + 1.2, d: 1.2, x: 0, z: -ARENA_HALF - 0.6 }, { w: ARENA_HALF * 2 + 1.2, d: 1.2, x: 0, z: ARENA_HALF + 0.6 }, { w: 1.2, d: ARENA_HALF * 2, x: -ARENA_HALF - 0.6, z: 0 }, { w: 1.2, d: ARENA_HALF * 2, x: ARENA_HALF + 0.6, z: 0 }].forEach(def => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(def.w, 3.2, def.d), wallMat); mesh.position.set(def.x, 1.6, def.z); arenaGroup.add(mesh); });
    
    const starCount = 260, starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) { starPositions[i * 3] = (Math.random() - 0.5) * 240; starPositions[i * 3 + 1] = Math.random() * 65 + 2; starPositions[i * 3 + 2] = (Math.random() - 0.5) * 240; }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3)); const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x5ff0c0, size: 0.85, transparent: true, opacity: 0.55 })); scene.add(starField);

    const MAX_SEGMENTS = 140, SEGMENT_SPACING = 1.38, PATH_CAP = 2800;
    const pathX = new Float32Array(PATH_CAP), pathZ = new Float32Array(PATH_CAP); let pathHeadIdx = 0, pathLen = 0;
    function pushPathSample(x, z) { pathHeadIdx = (pathHeadIdx + 1) % PATH_CAP; pathX[pathHeadIdx] = x; pathZ[pathHeadIdx] = z; if (pathLen < PATH_CAP) pathLen++; }

    const viperGroup = new THREE.Group(); scene.add(viperGroup);
    const headGroup = new THREE.Group(); viperGroup.add(headGroup);
    const headGeo = new THREE.ConeGeometry(1.35, 3.1, 8); headGeo.rotateX(Math.PI / 2);
    const headMesh = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0x4affc4, emissive: 0x16b888, emissiveIntensity: 0.65, roughness: 0.2, metalness: 0.5 })); headMesh.scale.set(1.12, 0.75, 1.0); headMesh.position.y = 1.05; headGroup.add(headMesh);
    const eyeGeo = new THREE.SphereGeometry(0.24, 8, 8), eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2e64 }); const leftEye = new THREE.Mesh(eyeGeo, eyeMat); leftEye.position.set(-0.62, 1.32, 0.55); const rightEye = new THREE.Mesh(eyeGeo, eyeMat); rightEye.position.set(0.62, 1.32, 0.55); headGroup.add(leftEye, rightEye);
    const tongueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 1.1), new THREE.MeshBasicMaterial({ color: 0xff3366 })); tongueMesh.position.set(0, 0.9, 1.65); headGroup.add(tongueMesh);

    const segGeo = new THREE.SphereGeometry(1.0, 12, 10), segMatEven = new THREE.MeshStandardMaterial({ color: 0x26e6a8, emissive: 0x0b6e4f, emissiveIntensity: 0.5, roughness: 0.28, metalness: 0.45 }), segMatOdd = new THREE.MeshStandardMaterial({ color: 0x0f354e, emissive: 0x00a8cc, emissiveIntensity: 0.35, roughness: 0.32, metalness: 0.55 });
    const segmentMeshes = []; for (let i = 0; i < MAX_SEGMENTS; i++) { const m = new THREE.Mesh(segGeo, i % 2 === 0 ? segMatEven : segMatOdd); m.visible = false; m.position.y = 0.95; viperGroup.add(m); segmentMeshes.push(m); }

    const ORB_COUNT = 7, orbs = [], orbGeo = new THREE.OctahedronGeometry(1.25, 0), ringGeo = new THREE.RingGeometry(1.45, 1.75, 20); ringGeo.rotateX(-Math.PI / 2);
    const normalOrbMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xff9f1c, emissiveIntensity: 0.85, roughness: 0.15, metalness: 0.4 }), bonusOrbMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00c8ff, emissiveIntensity: 1.0, roughness: 0.1, metalness: 0.6 }), ringMat = new THREE.MeshBasicMaterial({ color: 0x5ff0c0, side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
    function spawnOrb(o) { const margin = ARENA_LIMIT - 6; let rx = 0, rz = 0; for (let i = 0; i < 15; i++) { rx = (Math.random() * 2 - 1) * margin; rz = (Math.random() * 2 - 1) * margin; if (rx * rx + rz * rz > 100) break; } o.isBonus = Math.random() < 0.22; o.mesh.material = o.isBonus ? bonusOrbMat : normalOrbMat; const sc = o.isBonus ? 1.25 : 1.0; o.mesh.scale.set(sc, sc, sc); o.group.position.set(rx, 0, rz); o.phase = Math.random() * Math.PI * 2; }
    for (let i = 0; i < ORB_COUNT; i++) { const grp = new THREE.Group(), mesh = new THREE.Mesh(orbGeo, normalOrbMat); mesh.position.y = 1.5; const ring = new THREE.Mesh(ringGeo, ringMat); ring.position.y = 0.12; grp.add(mesh, ring); scene.add(grp); orbs.push({ group: grp, mesh, ring, isBonus: false, phase: 0 }); }

    const PARTICLE_POOL_SIZE = 70, particles = [], partGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) { const mat = new THREE.MeshBasicMaterial({ color: 0x5ff0c0 }), mesh = new THREE.Mesh(partGeo, mat); mesh.visible = false; scene.add(mesh); particles.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.6 }); }
    function emitBurst(x, y, z, c, count) { let spawned = 0; for (let i = 0; i < PARTICLE_POOL_SIZE && spawned < count; i++) { const p = particles[i]; if (p.life <= 0) { p.mesh.visible = true; p.mesh.position.set(x, y, z); p.mesh.material.color.setHex(c); const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 14; p.vx = Math.cos(a) * s; p.vy = 4 + Math.random() * 10; p.vz = Math.sin(a) * s; p.maxLife = 0.45 + Math.random() * 0.35; p.life = p.maxLife; spawned++; } } }

    const BASE_SPEED = 20.5, BASE_TURN_RATE = 2.85;
    const viper = { x: 0, z: 12, heading: Math.PI, speedMult: 1.0, targetSpeedMult: 1.0, steerInput: 0, wheelAngleDeg: 0, segmentCount: 10, alive: false, paused: true, score: 0, elapsed: 0 };
    
    function resetViperState() { viper.x = 0; viper.z = 12; viper.heading = Math.PI; viper.speedMult = 1.0; viper.targetSpeedMult = 1.0; viper.steerInput = 0; viper.wheelAngleDeg = 0; viper.segmentCount = 10; viper.score = 0; viper.elapsed = 0; viper.alive = true; viper.paused = false; scoreEl.textContent = '0'; pathHeadIdx = 0; pathLen = 0; for (let i = 160; i >= 0; i--) pushPathSample(viper.x, viper.z + i * 0.25); for (let i = 0; i < MAX_SEGMENTS; i++) segmentMeshes[i].visible = i < viper.segmentCount; orbs.forEach(o => spawnOrb(o)); updateThrottleVisuals(0); updateSteeringVisuals(0); }

    let throttlePointerId = null, throttleStartY = 0; const THROTTLE_MAX_PX = 46;
    let steerPointerId = null, steerPrevAngle = 0, currentWheelDeg = 0; const MAX_WHEEL_DEG = 135;
    const keys = { left: false, right: false, up: false, down: false };
    let gyroEnabled = false, gyroZeroRoll = null, gyroTiltInput = 0;

    function updateThrottleVisuals(offsetY) { const clampedY = Math.max(-THROTTLE_MAX_PX, Math.min(THROTTLE_MAX_PX, offsetY)); throttleKnob.style.transform = `translateY(${clampedY.toFixed(1)}px)`; const norm = -clampedY / THROTTLE_MAX_PX; if (norm > 0.12) { viper.targetSpeedMult = 1.0 + norm * 0.85; throttleKnob.classList.add('boosting'); throttleKnob.classList.remove('braking'); speedBadge.className = 'speed-badge boost'; const txt = viper.targetSpeedMult.toFixed(1) + 'x BOOST'; speedBadge.textContent = txt; throttleCaption.textContent = txt; } else if (norm < -0.12) { viper.targetSpeedMult = 1.0 + norm * 0.45; throttleKnob.classList.add('braking'); throttleKnob.classList.remove('boosting'); speedBadge.className = 'speed-badge brake'; const txt = viper.targetSpeedMult.toFixed(1) + 'x BRAKE'; speedBadge.textContent = txt; throttleCaption.textContent = txt; } else { viper.targetSpeedMult = 1.0; throttleKnob.classList.remove('boosting', 'braking'); speedBadge.className = 'speed-badge'; speedBadge.textContent = '1.0x SPEED'; throttleCaption.textContent = 'CRUISE 1.0x'; } }
    function updateSteeringVisuals(deg) { currentWheelDeg = Math.max(-MAX_WHEEL_DEG, Math.min(MAX_WHEEL_DEG, deg)); wheelSvg.style.transform = `rotate(${currentWheelDeg.toFixed(1)}deg)`; const r = Math.round(currentWheelDeg); if (Math.abs(r) < 3) { steeringCaption.textContent = 'STEER 0°'; } else if (r < 0) { steeringCaption.textContent = `LEFT ${Math.abs(r)}°`; } else { steeringCaption.textContent = `RIGHT ${r}°`; } }

    throttleControl.addEventListener('pointerdown', (e) => { if (throttlePointerId !== null) return; e.preventDefault(); Sound.init(); throttlePointerId = e.pointerId; const rect = throttleControl.getBoundingClientRect(), centerY = rect.top + rect.height / 2; throttleStartY = centerY; updateThrottleVisuals(e.clientY - throttleStartY); try { throttleControl.setPointerCapture(e.pointerId); } catch (err) {} });
    throttleControl.addEventListener('pointermove', (e) => { if (e.pointerId !== throttlePointerId) return; e.preventDefault(); updateThrottleVisuals(e.clientY - throttleStartY); });
    function releaseThrottle(e) { if (e.pointerId !== throttlePointerId) return; throttlePointerId = null; updateThrottleVisuals(0); }
    throttleControl.addEventListener('pointerup', releaseThrottle); throttleControl.addEventListener('pointercancel', releaseThrottle);

    function getTouchAngleFromWheelCenter(cx, cy) { const rect = steeringControl.getBoundingClientRect(), centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2; return Math.atan2(cy - centerY, cx - centerX); }
    steeringControl.addEventListener('pointerdown', (e) => { if (steerPointerId !== null) return; e.preventDefault(); Sound.init(); steerPointerId = e.pointerId; steerPrevAngle = getTouchAngleFromWheelCenter(e.clientX, e.clientY); try { steeringControl.setPointerCapture(e.pointerId); } catch (err) {} });
    steeringControl.addEventListener('pointermove', (e) => { if (e.pointerId !== steerPointerId) return; e.preventDefault(); const curAngle = getTouchAngleFromWheelCenter(e.clientX, e.clientY); let dRad = curAngle - steerPrevAngle; while (dRad > Math.PI) dRad -= Math.PI * 2; while (dRad < -Math.PI) dRad += Math.PI * 2; steerPrevAngle = curAngle; const dDeg = dRad * (180 / Math.PI) * 1.15; updateSteeringVisuals(currentWheelDeg + dDeg); });
    function releaseSteer(e) { if (e.pointerId !== steerPointerId) return; steerPointerId = null; }
    steeringControl.addEventListener('pointerup', releaseSteer); steeringControl.addEventListener('pointercancel', releaseSteer);

    window.addEventListener('keydown', (e) => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true; if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true; if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.up = true; if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true; });
    window.addEventListener('keyup', (e) => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false; if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keys.up = false; if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false; });

    let latestRawTilt = 0;
    window.addEventListener('deviceorientation', (e) => { if (!gyroEnabled) return; const angle = (window.screen && window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0; let tilt = 0; if (angle === 90) tilt = e.beta || 0; else if (angle === -90 || angle === 270) tilt = -(e.beta || 0); else tilt = e.gamma || 0; latestRawTilt = tilt; if (gyroZeroRoll === null) gyroZeroRoll = tilt; const relTilt = tilt - gyroZeroRoll; gyroTiltInput = Math.max(-1, Math.min(1, relTilt / 28)); });

    function toggleGyro() { Sound.init(); Sound.playClick(); if (!gyroEnabled) { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { DeviceOrientationEvent.requestPermission().then((s) => { if (s === 'granted') enableGyroState(true); }).catch(() => enableGyroState(true)); } else enableGyroState(true); } else enableGyroState(false); }
    function enableGyroState(on) { gyroEnabled = on; gyroZeroRoll = null; gyroTiltInput = 0; gyroHudBtn.classList.toggle('active', gyroEnabled); gyroModalToggleBtn.classList.toggle('active', gyroEnabled); gyroModalToggleBtn.textContent = gyroEnabled ? 'GYRO: ON' : 'GYRO: OFF'; updateCtrlPill(); }
    function updateCtrlPill(hasGp) { if (hasGp) { ctrlPill.textContent = 'GAMEPAD'; ctrlPill.classList.add('show'); } else if (gyroEnabled) { ctrlPill.textContent = 'GYRO TILT'; ctrlPill.classList.add('show'); } else ctrlPill.classList.remove('show'); }
    gyroHudBtn.addEventListener('click', toggleGyro); gyroModalToggleBtn.addEventListener('click', toggleGyro); gyroCalibrateBtn.addEventListener('click', () => { Sound.playClick(); gyroZeroRoll = latestRawTilt; gyroCalibrateBtn.textContent = 'RECENTERED ✓'; setTimeout(() => { gyroCalibrateBtn.textContent = 'RECENTER GYRO'; }, 900); });

    function syncSensitivityUI(val) { sensitivity = Math.max(0.3, Math.min(2.5, parseFloat(val) || 1.0)); store.set('nv3d_sens', sensitivity); sensSlider.value = sensitivity; sensValText.textContent = sensitivity.toFixed(2) + 'x'; const pct = ((sensitivity - 0.3) / (2.5 - 0.3)) * 100; gaugeFill.style.width = `${Math.max(4, Math.min(100, pct))}%`; presetBtns.forEach((btn) => { const bVal = parseFloat(btn.getAttribute('data-sens')); btn.classList.toggle('active', Math.abs(bVal - sensitivity) < 0.04); }); }
    syncSensitivityUI(sensitivity);
    sensSlider.addEventListener('input', (e) => syncSensitivityUI(e.target.value)); presetBtns.forEach((btn) => { btn.addEventListener('click', () => { Sound.playClick(); syncSensitivityUI(btn.getAttribute('data-sens')); }); });
    muteBtn.addEventListener('click', () => { Sound.init(); isMuted = !isMuted; store.set('nv3d_mute', isMuted); updateMuteUI(); if (!isMuted) Sound.playClick(); });
    settingsBtn.addEventListener('click', () => { Sound.init(); Sound.playClick(); viper.paused = true; settingsOverlay.classList.add('show'); });
    closeSettingsBtn.addEventListener('click', () => { Sound.playClick(); settingsOverlay.classList.remove('show'); if (viper.alive && !startOverlay.classList.contains('show')) viper.paused = false; });
    startBtn.addEventListener('click', () => { Sound.init(); Sound.playClick(); startOverlay.classList.remove('show'); settingsOverlay.classList.remove('show'); resetViperState(); });

    function triggerGameOver(reasonText) { viper.alive = false; viper.paused = true; Sound.playCrash(); Sound.updateEngine(1.0, false); emitBurst(viper.x, 1.5, viper.z, 0xff2e64, 34); if (viper.score > bestScore) { bestScore = viper.score; store.set('nv3d_best', bestScore); bestEl.textContent = bestScore; } ovTitle.textContent = 'VIPER CRASHED'; ovSub.innerHTML = `${reasonText}<br><span class="dim">Tap below to relaunch into the cyber grid</span>`; ovScore.textContent = viper.score; ovScoreWrap.style.display = 'block'; startBtn.textContent = 'PLAY AGAIN'; startOverlay.classList.add('show'); }

    window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

    let lastTime = performance.now(); const camTargetPos = new THREE.Vector3(), camLookTarget = new THREE.Vector3();
    function animate(now) {
      requestAnimationFrame(animate);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000)); lastTime = now;
      let gpSteer = 0, gpThrottleOffset = null;
      if (navigator.getGamepads) { const pads = navigator.getGamepads(); for (let i = 0; i < pads.length; i++) { const gp = pads[i]; if (gp && gp.connected) { updateCtrlPill(true); const ax0 = gp.axes[0] || 0; if (Math.abs(ax0) > 0.12) gpSteer = ax0; const rt = gp.buttons[7] ? gp.buttons[7].value : 0, lt = gp.buttons[6] ? gp.buttons[6].value : 0; if (rt > 0.1 || lt > 0.1) gpThrottleOffset = (lt - rt) * THROTTLE_MAX_PX; break; } } }
      starField.rotation.y += dt * 0.025;
      for (let i = 0; i < ORB_COUNT; i++) { const o = orbs[i]; o.phase += dt * 3.4; o.mesh.rotation.y += dt * 2.2; o.mesh.rotation.x += dt * 1.1; o.mesh.position.y = 1.45 + Math.sin(o.phase) * 0.35; const p = 1.0 + Math.sin(o.phase * 1.5) * 0.15; o.ring.scale.set(p, p, 1); }
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) { const p = particles[i]; if (p.life > 0) { p.life -= dt; if (p.life <= 0) p.mesh.visible = false; else { p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; p.vy -= 18 * dt; const s = p.life / p.maxLife; p.mesh.scale.set(s, s, s); } } }
      
      if (viper.alive && !viper.paused) {
        viper.elapsed += dt;
        if (throttlePointerId === null) { if (keys.up) updateThrottleVisuals(-THROTTLE_MAX_PX); else if (keys.down) updateThrottleVisuals(THROTTLE_MAX_PX); else if (gpThrottleOffset !== null) updateThrottleVisuals(gpThrottleOffset); }
        if (steerPointerId === null) { const kDir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0); if (kDir !== 0) updateSteeringVisuals(currentWheelDeg + kDir * 220 * dt); else if (Math.abs(gpSteer) > 0.12) updateSteeringVisuals(gpSteer * MAX_WHEEL_DEG); else if (gyroEnabled) updateSteeringVisuals(gyroTiltInput * MAX_WHEEL_DEG); else { const damp = Math.exp(-10 * dt); updateSteeringVisuals(currentWheelDeg * damp); } }
        viper.steerInput = currentWheelDeg / MAX_WHEEL_DEG;
        viper.speedMult += (viper.targetSpeedMult - viper.speedMult) * Math.min(1, dt * 8); Sound.updateEngine(viper.speedMult, true);
        viper.heading += viper.steerInput * (BASE_TURN_RATE * sensitivity) * dt;
        const stepDist = BASE_SPEED * viper.speedMult * dt, subSteps = Math.max(1, Math.ceil(stepDist / 0.25)), subDx = (Math.sin(viper.heading) * stepDist) / subSteps, subDz = (Math.cos(viper.heading) * stepDist) / subSteps;
        for (let s = 0; s < subSteps; s++) { viper.x += subDx; viper.z += subDz; pushPathSample(viper.x, viper.z); }
        headGroup.position.set(viper.x, 0, viper.z); headGroup.rotation.y = viper.heading; headGroup.rotation.z = -viper.steerInput * 0.32; tongueMesh.scale.z = 0.8 + Math.sin(viper.elapsed * 18) * 0.35;
        headLight.position.set(viper.x, 3.2, viper.z); if (viper.speedMult > 1.15) headLight.color.setHex(0x00ffff); else if (viper.speedMult < 0.88) headLight.color.setHex(0xffaa00); else headLight.color.setHex(0x4affc4);
        let arcDist = 0, sampleCursor = pathHeadIdx, prevX = viper.x, prevZ = viper.z, samplesUsed = 0;
        for (let segIdx = 0; segIdx < viper.segmentCount; segIdx++) {
          const targetArc = (segIdx + 1) * SEGMENT_SPACING;
          while (arcDist < targetArc && samplesUsed < pathLen - 1) { sampleCursor = (sampleCursor - 1 + PATH_CAP) % PATH_CAP; samplesUsed++; const sx = pathX[sampleCursor], sz = pathZ[sampleCursor], dx = sx - prevX, dz = sz - prevZ; arcDist += Math.hypot(dx, dz); prevX = sx; prevZ = sz; }
          const mesh = segmentMeshes[segIdx]; mesh.visible = true;
          const taper = Math.max(0.38, 1.0 - (segIdx / (viper.segmentCount + 6)) * 0.65); mesh.position.x = prevX; mesh.position.z = prevZ; mesh.position.y = 0.9 * taper + Math.sin(viper.elapsed * 9 - segIdx * 0.5) * 0.08; mesh.scale.set(taper, taper * 0.88, taper);
          if (segIdx > 6) { const cdx = viper.x - mesh.position.x, cdz = viper.z - mesh.position.z, hitRadius = 0.82 + 0.65 * taper; if (cdx * cdx + cdz * cdz < hitRadius * hitRadius) { triggerGameOver('SELF COLLISION DETECTED'); break; } }
        }
        if (viper.alive && (Math.abs(viper.x) > ARENA_LIMIT || Math.abs(viper.z) > ARENA_LIMIT)) triggerGameOver('ARENA BARRIER IMPACT');
        if (viper.alive) { for (let i = 0; i < ORB_COUNT; i++) { const o = orbs[i], dx = viper.x - o.group.position.x, dz = viper.z - o.group.position.z; if (dx * dx + dz * dz < 6.8) { viper.score += (o.isBonus ? 25 : 10); scoreEl.textContent = viper.score; if (viper.score > bestScore) { bestScore = viper.score; bestEl.textContent = bestScore; store.set('nv3d_best', bestScore); } viper.segmentCount = Math.min(MAX_SEGMENTS, viper.segmentCount + (o.isBonus ? 3 : 1)); Sound.playEat(o.isBonus); emitBurst(o.group.position.x, 1.4, o.group.position.z, o.isBonus ? 0x00ffff : 0xffd166, 18); spawnOrb(o); } } }
      } else { Sound.updateEngine(1.0, false); }
      const camDist = 21 + (viper.speedMult - 1.0) * 4.5, camHeight = 14.5 + (viper.speedMult - 1.0) * 2.0;
      camTargetPos.set(viper.x - Math.sin(viper.heading) * camDist, camHeight, viper.z - Math.cos(viper.heading) * camDist);
      camera.position.lerp(camTargetPos, 1 - Math.exp(-7.5 * dt));
      camLookTarget.set(viper.x + Math.sin(viper.heading) * 8, 1.2, viper.z + Math.cos(viper.heading) * 8); camera.lookAt(camLookTarget);
      renderer.render(scene, camera);
    }
    resetViperState(); viper.paused = true; requestAnimationFrame(animate);
  }
  bootWhenReady();
})();
