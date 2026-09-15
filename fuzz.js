'use strict';
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
let code = html.match(/<script>([\s\S]*)<\/script>/)[1];
code += '\n;globalThis.__G = { Game, Input, AudioSys, T, rectSolid };\n';
function makeCtx(){ const special = { measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop(){} }) };
  return new Proxy({}, { get(t,k){ if (k in special) return special[k]; if (k==='canvas') return {}; return function(){}; }, set(){ return true; } }); }
function makeEl(id){ return { id, style:{}, value:'85', textContent:'', innerHTML:'', width:0, height:0,
  classList:{ _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,f){ if(f===undefined) f=!this._s.has(c); f?this._s.add(c):this._s.delete(c); }, contains(c){ return this._s.has(c); } },
  addEventListener(){}, removeEventListener(){}, setPointerCapture(){}, releasePointerCapture(){}, setAttribute(){}, appendChild(){},
  getContext(){ return makeCtx(); } }; }
const elCache = {};
const document = { getElementById(id){ return elCache[id] || (elCache[id] = makeEl(id)); }, createElement(t){ return makeEl(t); },
  addEventListener(){}, removeEventListener(){}, hidden:false, body: makeEl('body'), documentElement: makeEl('html'),
  querySelector(){ return makeEl('q'); }, fullscreenElement:null };
let nowMs = 0; const rafCbs = [];
function requestAnimationFrame(cb){ rafCbs.push(cb); return 1; }
const windowObj = { innerWidth:1280, innerHeight:800, devicePixelRatio:2, addEventListener(){}, removeEventListener(){}, visualViewport:null,
  AudioContext: class { constructor(){ this.currentTime=0; this.state='running'; this.destination={}; }
    createGain(){ return { gain:{ value:0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(n){ return n; } }; }
    createOscillator(){ return { type:'', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(n){ return n }, start(){}, stop(){} }; }
    createBufferSource(){ return { buffer:null, connect(n){ return n }, start(){}, stop(){} }; }
    createBuffer(c,l){ return { getChannelData(){ return new Float32Array(l); } }; }
    createBiquadFilter(){ return { type:'', frequency:{ value:0 }, Q:{ value:1 }, connect(n){ return n } }; }
    resume(){ return Promise.resolve(); } suspend(){ return Promise.resolve(); } } };
new Function('document','window','navigator','localStorage','performance','requestAnimationFrame','cancelAnimationFrame','screen',
  code)(document, windowObj, { vibrate:null }, { getItem(){ return null; }, setItem(){}, removeItem(){} }, { now: () => nowMs }, requestAnimationFrame, () => {}, { orientation:null });
const { Game, Input, rectSolid } = globalThis.__G;
function pump(frames){ for (let i=0;i<frames;i++){ nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs); } }

Game.startGame(); pump(90);
let stuckSecs = 0, errors = [];
const SECS = 60, SEEDS = [1, 7, 42, 1234, 99999];
function rnd(seed){ let s = seed; return () => { s = (s*1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
let seedIdx = 0;
for (let sec = 0; sec < SECS; sec++){
  const r = rnd(SEEDS[seedIdx % SEEDS.length]);
  // random inputs
  Input.left = r() < 0.3;
  Input.right = r() < 0.3;
  Input.down = r() < 0.2;
  Input.jumpHeld = r() < 0.4;
  if (r() < 0.2) Input.jumpQueued = true;
  if (r() < 0.15){ Input.actionQueued = true; Input.actionHeld = true; } else Input.actionHeld = r() < 0.3;
  // occasionally teleport to a random safe ground column (keep player alive for long runs)
  if (r() < 0.05 && Game.state === 'PLAYING'){
    const cols = [5, 20, 45, 58, 73, 100, 110, 128, 133, 150];
    const c = cols[Math.floor(r()*cols.length)];
    Game.player.x = c*48 + 4; Game.player.y = 10*48 - Game.player.h; Game.player.vx = 0; Game.player.vy = 0;
    Game.cam.x = Math.max(0, Math.min(Game.player.x - 400, Game.level.w*48 - 960));
  }
  try {
    pump(60);
  } catch(e){
    errors.push(`sec ${sec}: ${e.message}`);
    break;
  }
  if (Game.state === 'GAMEOVER'){ Game.startGame(); pump(90); }
  if (Game.state === 'CLEAR'){ Game.toTitle(); Game.startGame(); pump(90); }
  // stuck monitor: embedded in solid for >2s straight (small player idle)
  const p = Game.player;
  if (Game.state === 'PLAYING' && !p.dead && rectSolid(Game.level, p.x, p.y, p.w, p.h)){
    stuckSecs++;
    if (stuckSecs > 2) errors.push(`sec ${sec}: player embedded in solids for ${stuckSecs}s at (${p.x.toFixed(0)},${p.y.toFixed(0)}) form=${p.form}`);
  } else stuckSecs = 0;
  // NaN / unbounded checks
  if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(Game.score)) errors.push(`sec ${sec}: non-finite state x=${p.x} y=${p.y} score=${Game.score}`);
  if (Game.enemies.length > 50 || Game.items.length > 100 || Game.texts.length > 30) errors.push(`sec ${sec}: entity leak e=${Game.enemies.length} i=${Game.items.length} t=${Game.texts.length}`);
}
console.log('final state:', Game.state, 'score:', Game.score, 'lives:', Game.lives, 'x:', Game.player.x.toFixed(0));
console.log(errors.length ? 'FUZZ ERRORS:\n' + errors.join('\n') : 'FUZZ CLEAN (60s, 5 seeds)');
process.exit(errors.length ? 1 : 0);
