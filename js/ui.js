import { CFG, state, inputs, setSensitivity } from './config.js';
import { sfx } from './audio.js';
import { bus } from './events.js';

let isWheelDragging = false;
let wheelTouchId = null;
let wheelStartPos = { x: 0, y: 0 };
let currentWheelRot = 0;
let currentWheelY = 0;

export function initUI({ onStart }){
  const scoreEl = document.getElementById('scoreEl');
  const bestEl = document.getElementById('bestEl');
  const speedBadge = document.getElementById('speedBadge');
  const startOverlay = document.getElementById('startOverlay');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const ovTitle = document.getElementById('ovTitle');
  const ovSub = document.getElementById('ovSub');
  const startBtn = document.getElementById('startBtn');
  const ovScoreWrap = document.getElementById('ovScoreWrap');
  const ovScore = document.getElementById('ovScore');
  const wheelContainer = document.getElementById('wheel-container');
  const wheelSvg = document.getElementById('wheel-svg');

  function updateHUD(){
    scoreEl.textContent = state.score;
    bestEl.textContent = state.best;
    const mult = state.speedMult;
    speedBadge.textContent = mult.toFixed(1) + 'x SPEED';
    if (mult > 1.15) speedBadge.className = 'speed-badge boost';
    else if (mult < 0.85) speedBadge.className = 'speed-badge brake';
    else speedBadge.className = 'speed-badge';
  }

  function showStartOverlay(kind){
    if (kind === 'over'){
      ovTitle.textContent = 'GAME OVER';
      ovTitle.style.color = '#ff5c7a';
      ovTitle.style.textShadow = '0 0 24px rgba(255,60,110,.9),0 0 60px rgba(255,0,80,.4)';
      ovSub.style.display = 'none';
      ovScoreWrap.style.display = 'block';
      ovScore.textContent = state.score;
      startBtn.textContent = 'RETRY VIPER';
    } else {
      ovTitle.textContent = 'NEON VIPER 3D';
      ovTitle.style.color = '#6effd0';
      ovTitle.style.textShadow = '0 0 22px rgba(60,255,200,.85),0 0 50px rgba(0,255,180,.45)';
      ovSub.style.display = 'block';
      ovScoreWrap.style.display = 'none';
      startBtn.textContent = 'START VIPER';
    }
    startOverlay.classList.add('show');
  }

  function hideStartOverlay(){ startOverlay.classList.remove('show'); }

  bus.addEventListener('hud:update', updateHUD);
  bus.addEventListener('game:start', hideStartOverlay);
  bus.addEventListener('game:over', () => setTimeout(() => showStartOverlay('over'), 0));

  // WHEEL INPUT
  function handleWheelStart(clientX, clientY, touchId){
    if (state.mode !== 'playing') return;
    sfx.init();
    isWheelDragging = true;
    wheelTouchId = touchId == null ? null : touchId;
    wheelStartPos = { x: clientX, y: clientY };
  }

  function handleWheelMove(clientX, clientY){
    if (!isWheelDragging) return;
    const dx = clientX - wheelStartPos.x;
    const dy = clientY - wheelStartPos.y;
    const maxDx = 110;
    const clampedDx = Math.max(-maxDx, Math.min(maxDx, dx));
    currentWheelRot = (clampedDx / maxDx) * 135;
    state.turnInput = clampedDx / maxDx;
    const maxDy = 60;
    const clampedDy = Math.max(-maxDy, Math.min(maxDy, dy));
    currentWheelY = (clampedDy / maxDy) * 26;
    if (dy < -10) {
      const norm = Math.min(1, Math.abs(dy + 10) / 45);
      state.speedMult = 1.0 + norm * 0.85;
      wheelSvg.className.baseVal = 'boosting';
    } else if (dy > 10) {
      const norm = Math.min(1, (dy - 10) / 45);
      state.speedMult = 1.0 - norm * 0.65;
      wheelSvg.className.baseVal = 'braking';
    } else {
      state.speedMult = 1.0;
      wheelSvg.className.baseVal = '';
    }
    wheelSvg.style.transform = `translateY(${currentWheelY}px) rotate(${currentWheelRot}deg)`;
    updateHUD();
  }

  function handleWheelEnd(){
    if (!isWheelDragging) return;
    isWheelDragging = false;
    wheelTouchId = null;
    state.turnInput = 0;
    state.speedMult = 1.0;
    currentWheelRot = 0;
    currentWheelY = 0;
    wheelSvg.style.transform = 'translateY(0px) rotate(0deg)';
    wheelSvg.className.baseVal = '';
    updateHUD();
  }

  wheelContainer.addEventListener('touchstart', (e) => {
    if (e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      handleWheelStart(t.clientX, t.clientY, t.identifier);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isWheelDragging) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === wheelTouchId) {
        handleWheelMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        break;
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (!isWheelDragging) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === wheelTouchId) { handleWheelEnd(); break; }
    }
  });
  window.addEventListener('touchcancel', handleWheelEnd);

  wheelContainer.addEventListener('mousedown', (e) => handleWheelStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => {
    if (isWheelDragging && wheelTouchId === null) handleWheelMove(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (isWheelDragging && wheelTouchId === null) handleWheelEnd();
  });

  // KEYBOARD
  window.addEventListener('keydown', (e) => {
    inputs.keys[e.key] = true;
    if (e.key === ' ' || e.key === 'Enter') {
      if (state.mode !== 'playing') onStart();
    }
  });
  window.addEventListener('keyup', (e) => { inputs.keys[e.key] = false; });

  // SETTINGS
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const sensSlider = document.getElementById('sensSlider');
  const sensValText = document.getElementById('sensValText');
  const gaugeFill = document.getElementById('gaugeFill');
  const presetBtns = document.querySelectorAll('.preset-btn');

  function applySens(val){
    setSensitivity(val);
    sensSlider.value = state.sensitivity;
    sensValText.textContent = state.sensitivity.toFixed(2) + 'x';
    const pct = ((state.sensitivity - 0.3) / (2.5 - 0.3)) * 100;
    gaugeFill.style.width = pct + '%';
    presetBtns.forEach(btn => {
      const s = parseFloat(btn.getAttribute('data-sens'));
      if (Math.abs(s - state.sensitivity) < 0.05) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }
  applySens(state.sensitivity);
  sensSlider.addEventListener('input', (e) => applySens(e.target.value));
  presetBtns.forEach(btn => btn.addEventListener('click', () => applySens(btn.getAttribute('data-sens'))));

  settingsBtn.addEventListener('click', () => {
    if (state.mode === 'playing') state.mode = 'paused';
    settingsOverlay.classList.add('show');
  });
  closeSettingsBtn.addEventListener('click', () => {
    settingsOverlay.classList.remove('show');
    if (state.mode === 'paused') state.mode = 'playing';
  });

  // MUTE
  const muteBtn = document.getElementById('muteBtn');
  const audioOnIcon = document.getElementById('audioOnIcon');
  const audioOffIcon = document.getElementById('audioOffIcon');
  muteBtn.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    audioOnIcon.style.display = sfx.muted ? 'none' : 'block';
    audioOffIcon.style.display = sfx.muted ? 'block' : 'none';
  });

  startBtn.addEventListener('click', onStart);

  return { updateHUD, showStartOverlay, hideStartOverlay };
}
