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
const { Game, Input } = globalThis.__G;
function pump(frames){ for (let i=0;i<frames;i++){ nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs); } }
Game.startGame(); pump(90);
const p = Game.player;
// stand on last solid tile before pit at 28: left edge at col 27
p.x = 27*48 + 14; p.y = 10*48 - p.h; p.vx = 0; p.vy = 0;
Game.cam.x = Math.max(0, p.x - 400);
pump(3);
console.log('takeoff: x=', p.x.toFixed(1), 'onGround=', p.onGround);
Input.right = true; Input.jumpQueued = true; Input.jumpHeld = true;
let minFeet = 1e9, landed = null, maxX = p.x;
for (let i=0;i<180;i++){
  nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs);
  minFeet = Math.min(minFeet, p.y + p.h);
  maxX = Math.max(maxX, p.x + p.w);
  if (p.onGround){ landed = { i, x: p.x + p.w }; break; }
  if (Game.state !== 'PLAYING'){ landed = { i, x: p.x + p.w, state: Game.state }; break; }
}
console.log('landed at frame', landed && landed.i, 'rightEdge col=', (landed && landed.x/48).toFixed(2), 'minFeet col=', (minFeet/48).toFixed(2), 'state=', Game.state, 'jumpDistPx=', (landed && (landed.x - (27*48+14+28))).toFixed(0));
process.exit(0);
