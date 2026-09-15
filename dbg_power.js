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
function teleport(x, y){ const p = Game.player; p.x = x; p.y = y; p.vx = 0; p.vy = 0; Game.cam.x = Math.max(0, Math.min(x - 400, Game.level.w*48 - 960)); }
Game.startGame(); pump(90);
// Where is the walker relative to Q_GROW at (23,7)?
Game.enemies.forEach((e,i) => console.log('enemy', i, e.kind, 'x=', (e.x/48).toFixed(1), 'active=', e.active));
console.log('Q_GROW at (23,7) =', Game.level.get(23,7), '(5=Q_GROW)');
// jump for the block WITHOUT moving enemies
const p = Game.player;
teleport(23*48 + 10, 10*48 - p.h);
p.vy = -560; Input.jumpHeld = true; pump(30); Input.jumpHeld = false; pump(40);
console.log('after block bump: state=', Game.state, 'tile(23,7)=', Game.level.get(23,7), 'form=', p.form, 'y=', p.y.toFixed(0));
console.log('walker positions now:');
Game.enemies.forEach((e,i) => { if (!e.dead) console.log('  enemy', i, e.kind, 'x=', (e.x/48).toFixed(1), 'dead=', e.dead); });
process.exit(0);
