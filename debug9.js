'use strict';
const fs = require('fs');
const html = fs.readFileSync('/home/user/game/index.html', 'utf8');
let code = html.match(/<script>([\s\S]*)<\/script>/)[1];
code += '\n;globalThis.__G = { Game, Input, AudioSys, T };\n';
function makeCtx(){ const special = { measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop(){} }) };
  return new Proxy({}, { get(t,k){ if (k in special) return special[k]; if (k==='canvas') return {}; return function(){}; }, set(){ return true; } }); }
function makeEl(id){ return { id, style:{}, value:'85', textContent:'', innerHTML:'', width:0, height:0,
  classList:{ _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(){}, contains(){ return false; } },
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
function teleport(x, y){ const p = Game.player; p.x = x; p.y = y; p.vx = 0; p.vy = 0; Game.cam.x = Math.max(0, Math.min(x - 400, Game.level.w*48 - 960)); }
let tag = 'boot';
const origDie = Game.die.bind(Game);
Game.die = function(r){ console.log('!! die(', r, ') at tag=', tag, 't=', (nowMs/1000).toFixed(2)); return origDie(r); };

Game.startGame(); pump(90); tag='start';
Input.right = true; pump(80); tag='walk';
Input.right = false; pump(30);
Input.jumpHeld = true; Input.jumpQueued = true; pump(10);
let minY = Game.player.y; pump(30); minY = Math.min(minY, Game.player.y);
Input.jumpHeld = false; Input.jumpQueued = false; pump(60); tag='jump';
console.log('lives after jump phase:', Game.lives, 'state=', Game.state);
// block
teleport(7*48 + 10, 10*48 - Game.player.h);
Game.player.vy = -560; Input.jumpHeld = true; pump(30); Input.jumpHeld = false; pump(40); tag='block';
console.log('lives after block:', Game.lives, 'state=', Game.state);
// stomp
const e = Game.enemies.find(e => e.kind === 'walker' && !e.dead);
teleport(e.x + (e.w - Game.player.w)/2, e.y - Game.player.h - 4);
Game.player.vy = 80; pump(10); tag='stomp';
console.log('lives after stomp:', Game.lives, 'e.dead=', e.dead);
// damage
const e2 = Game.enemies.find(e => e.kind === 'walker' && !e.dead);
console.log('e2 at x=', e2.x.toFixed(0));
Game.player.x = e2.x - Game.player.w - 4;
Game.player.y = e2.y + 4;
Game.player.vx = 400;
pump(20); tag='damage20';
console.log('lives after damage20:', Game.lives, 'state=', Game.state);
pump(140); tag='damage160';
console.log('lives after +140:', Game.lives, 'state=', Game.state);
process.exit(0);
