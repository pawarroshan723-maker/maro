'use strict';
const fs = require('fs');
const html = fs.readFileSync('/home/user/game/index.html', 'utf8');
let code = html.match(/<script>([\s\S]*)<\/script>/)[1];
code += '\n;globalThis.__G = { Game, Input, AudioSys, T };\n';
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
const { Game, Input, T } = globalThis.__G;
function pump(frames){ for (let i=0;i<frames;i++){ nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs); } }
const SOLID = new Set([T.GROUND,T.DIRT,T.BRICK,T.Q_GEM,T.Q_GROW,T.Q_SHOT,T.Q_STAR,T.Q_LIFE,T.Q_MULTI,T.USED,T.PIPE_TL,T.PIPE_TR,T.PIPE_BL,T.PIPE_BR,T.BUILD]);
Game.startGame(); pump(90);
// clear all enemies so nothing interferes
Game.enemies.length = 0;
const p = Game.player;
p.x = 24*48; p.y = 10*48 - p.h; p.vx = 0; p.vy = 0;
Game.cam.x = 24*48 - 400;
pump(5);
console.log('start col', (p.x/48).toFixed(2), 'onGround', p.onGround);
for (let i = 0; i < 120; i++){
  const feet = p.y + p.h;
  const lv = Game.level;
  const ty = Math.floor(feet/48);
  let gap = false;
  if (p.onGround){
    for (const off of [8, 34]){
      const tx = Math.floor((p.x + p.w + off)/48);
      let ground = false;
      for (let d = 0; d <= 2; d++){ if (SOLID.has(lv.get(tx, ty + d))) { ground = true; break; } }
      if (!ground) { gap = true; break; }
    }
  }
  if ((p.x/48) > 25.5 && (p.x/48) < 34){
    console.log(`f${i}: col=${(p.x/48).toFixed(2)} y=${p.y.toFixed(0)} vy=${p.vy.toFixed(0)} og=${p.onGround} gap=${gap} vx=${p.vx.toFixed(0)} state=${Game.state}`);
  }
  Input.actionHeld = true;
  if (gap){ Input.jumpQueued = true; Input.jumpHeld = true; }
  else if (!p.onGround) Input.jumpHeld = true;
  else Input.jumpHeld = false;
  Input.right = true;
  nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs);
  if (Game.state !== 'PLAYING') { console.log('state left PLAYING at frame', i); break; }
}
console.log('end col', (p.x/48).toFixed(2), 'y', p.y.toFixed(0), 'state', Game.state);
process.exit(0);
