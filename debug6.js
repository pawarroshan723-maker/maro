'use strict';
const fs = require('fs');
const html = fs.readFileSync('/home/user/game/index.html', 'utf8');
let code = html.match(/<script>([\s\S]*)<\/script>/)[1];
code += '\n;globalThis.__G = { Game, Input, AudioSys, T };\n';
function makeCtx(){
  const special = { measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop(){} }) };
  return new Proxy({}, { get(t,k){ if (k in special) return special[k]; if (k==='canvas') return {}; return function(){}; }, set(){ return true; } });
}
function makeEl(id){
  return { id, style:{}, value:'85', textContent:'', innerHTML:'', width:0, height:0,
    classList:{ _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(){}, contains(){ return false; } },
    addEventListener(){}, removeEventListener(){}, setPointerCapture(){}, releasePointerCapture(){}, setAttribute(){}, appendChild(){},
    getContext(){ return makeCtx(); } };
}
const elCache = {};
const document = { getElementById(id){ return elCache[id] || (elCache[id] = makeEl(id)); }, createElement(t){ return makeEl(t); },
  addEventListener(){}, removeEventListener(){}, hidden:false, body: makeEl('body'), documentElement: makeEl('html'),
  querySelector(){ return makeEl('q'); }, fullscreenElement:null };
let nowMs = 0; const rafCbs = [];
function requestAnimationFrame(cb){ rafCbs.push(cb); return 1; }
const windowObj = { innerWidth:1280, innerHeight:800, devicePixelRatio:2, addEventListener(){}, removeEventListener(){}, visualViewport:null,
  AudioContext: class {
    constructor(){ this.currentTime=0; this.state='running'; this.destination={}; }
    createGain(){ return { gain:{ value:0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(n){ return n; } }; }
    createOscillator(){ return { type:'', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(n){ return n }, start(){}, stop(){} }; }
    createBufferSource(){ return { buffer:null, connect(n){ return n }, start(){}, stop(){} }; }
    createBuffer(c,l){ return { getChannelData(){ return new Float32Array(l); } }; }
    createBiquadFilter(){ return { type:'', frequency:{ value:0 }, Q:{ value:1 }, connect(n){ return n } }; }
    resume(){ return Promise.resolve(); } suspend(){ return Promise.resolve(); }
  } };
new Function('document','window','navigator','localStorage','performance','requestAnimationFrame','cancelAnimationFrame','screen',
  code)(document, windowObj, { vibrate:null }, { getItem(){ return null; }, setItem(){}, removeItem(){} }, { now: () => nowMs }, requestAnimationFrame, () => {}, { orientation:null });
const { Game, Input } = globalThis.__G;
function pump(frames){ for (let i=0;i<frames;i++){ nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs); } }

Game.startGame();
pump(90);
const P = Game.player;
// B
P.x = 7*48 + 10; P.y = 10*48 - P.h; P.vy = -560; P.vx = 0;
Input.jumpHeld = true; pump(30); Input.jumpHeld = false; pump(30);
console.log('B done: tile=', Game.level.get(7,7), 'gems=', Game.gems);
// C stomp
const e = Game.enemies.find(e => e.kind === 'walker' && !e.dead);
P.x = e.x + (e.w - P.w)/2; P.y = e.y - P.h - 4; P.vy = 80; P.vx = 0;
pump(10);
console.log('C done: e.dead=', e.dead, 'pos=', P.x.toFixed(0), P.y.toFixed(0), 'onGround=', P.onGround, 'state=', Game.state);
// D shoot — with full trace
P.setForm('shoot');
P.x = 30*48; P.y = 10*48 - P.h; P.vx = 0; P.vy = 0;
console.log('D: state=', Game.state, 'form=', P.form, 'onGround=', P.onGround, 'dead=', P.dead, 'jbuf=', P.jbuf.toFixed(2), 'hurtT=', P.hurtT.toFixed(2), 'morphT=', P.morphT.toFixed(2));
const orig = Game.onAction;
Game.onAction = function(p){ console.log('  >> onAction form=', p.form); return orig.apply(this, arguments); };
const origUpdate = P.update.bind(P);
P.update = function(dt){ console.log('  >> p.update state=', Game.state, 'actionQueued=', Input.actionQueued); return origUpdate(dt); };
Input.actionHeld = true; Input.actionQueued = true;
pump(1);
console.log('after 1 frame: shots=', Game.shots.length);
P.update = origUpdate;
process.exit(0);
