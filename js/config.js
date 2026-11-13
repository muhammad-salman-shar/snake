export const CFG = {
  arenaRadius   : 50,
  headRadius    : 1.30,
  snakeY        : 1.05,
  baseSpeed     : 11.2,
  maxSpeed      : 16.5,
  baseTurnRate  : 2.45,
  segSpacing    : 0.86,
  startSegments : 12,
  growPerFood   : 3,
  foodRadius    : 0.95,
  camBack       : 14.0,
  camUp         : 9.2,
  camAhead      : 6.0,
  camLag        : 6.5,
  lookLag       : 9.0
};

export const state = {
  mode: 'ready',
  score: 0,
  best: Number(localStorage.getItem('neon_viper_best') || 0),
  yaw: 0,
  turnInput: 0,
  speedMult: 1.0,
  segmentCount: CFG.startSegments,
  currentSpeed: CFG.baseSpeed,
  sensitivity: parseFloat(localStorage.getItem('neon_viper_sens') || '1.0'),
  headPos: null,
  lookTarget: null,
  trail: [],
  gameTime: 0,
  shake: 0,
  foodPop: 1
};

export const inputs = { keys: {} };

export function setSensitivity(v) {
  state.sensitivity = Math.max(0.3, Math.min(2.5, parseFloat(v)));
  try { localStorage.setItem('neon_viper_sens', String(state.sensitivity)); } catch(e){}
}

export function setBest(v) {
  state.best = v;
  try { localStorage.setItem('neon_viper_best', String(v)); } catch(e){}
}
