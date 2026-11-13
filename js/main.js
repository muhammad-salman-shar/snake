import { state, CFG } from './config.js';
import { initScene, renderer, scene, camera, resetGame, startGame, updateGame } from './game.js';
import { initUI } from './ui.js';

const fatalEl = document.getElementById('fatal');
function showFatal(msg){
  fatalEl.textContent = '⚠ ' + msg;
  fatalEl.classList.add('show');
}
window.addEventListener('error', function(e){
  if (e && e.message) showFatal(e.message);
});

let ui = null;

function bootGame(){
  initScene();
  ui = initUI({ onStart: startGame });
  resetGame();
  ui.updateHUD();
  ui.showStartOverlay('start');

  const clock = new THREE.Clock();
  function animate(){
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    updateGame(dt);
    renderer.render(scene, camera);
  }
  animate();
}

function onResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));

(function loadThree(){
  const sources = [
    'https://unpkg.com/three@0.152.2/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
  ];
  let idx = 0;
  function tryNext(){
    if (idx >= sources.length){
      showFatal('Unable to load 3D engine. Please check network connection and reload.');
      return;
    }
    const script = document.createElement('script');
    script.src = sources[idx++];
    script.onload = function(){
      if (window.THREE) {
        try { bootGame(); } catch(err){ showFatal(err.message); }
      } else tryNext();
    };
    script.onerror = tryNext;
    document.head.appendChild(script);
  }
  tryNext();
})();
