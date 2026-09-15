'use strict';
const fs = require('fs');
// reuse stubs by requiring smoke harness pieces — simplest: inline a minimal copy
const html = fs.readFileSync('/home/user/game/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
let code = m[1];
code += '\n;globalThis.__G = { Game, Input, AudioSys, Settings, T, doPause, doResume };\n';

function makeCtx(){
  const special = { measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop(){} }), createRadialGradient: () => ({ addColorStop(){} }) };
  return new Proxy({}, { get(t,k){ if (k in special) return special[k]; if (k==='canvas') return {}; return function(){}; }, set(){ return true; } });
}
function makeEl(id){
  return { id, style:{}, value:'85', hidden:false, textContent:'', innerHTML:'', width:0, height:0,
    classList:{ _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);}, toggle(c,f){ if(f===undefined) f=!this._s.has(c); f?this._s.add(c):this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(){}, removeEventListener(){}, setPointerCapture(){}, releasePointerCapture(){}, setAttribute(){}, appendChild(){},
    getContext(){ return makeCtx(); } };
}
const elCache = {};
const document = {
  getElementById(id){ return elCache[id] || (elCache[id] = makeEl(id)); },
  createElement(t){ return makeEl(t); },
  addEventListener(){}, removeEventListener(){}, hidden:false, body: makeEl('body'), documentElement: makeEl('html'),
  querySelector(){ return makeEl('q'); }, fullscreenElement:null,
};
let nowMs = 0; const rafCbs = [];
function requestAnimationFrame(cb){ rafCbs.push(cb); return rafCbs.length; }
function cancelAnimationFrame(){}
const windowObj = {
  innerWidth:1280, innerHeight:800, devicePixelRatio:2, addEventListener(){}, removeEventListener(){}, visualViewport:null,
  AudioContext: class {
    constructor(){ this.currentTime=0; this.state='running'; this.destination={}; this.sampleRate=44100; }
    createGain(){ return { gain:{ value:0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(n){ return n; } }; }
    createOscillator(){ return { type:'', frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(n){ return n }, start(){}, stop(){} }; }
    createBufferSource(){ return { buffer:null, connect(n){ return n }, start(){}, stop(){} }; }
    createBuffer(ch,len){ return { getChannelData(){ return new Float32Array(len); } }; }
    createBiquadFilter(){ return { type:'', frequency:{ value:0 }, Q:{ value:1 }, connect(n){ return n } }; }
    resume(){ return Promise.resolve(); } suspend(){ return Promise.resolve(); }
  },
};
const navigatorObj = { vibrate:null };
const localStorageObj = { getItem(){ return null; }, setItem(){}, removeItem(){} };
const performanceObj = { now: () => nowMs };
const screenObj = { orientation:null };
const fn = new Function('document','window','navigator','localStorage','performance','requestAnimationFrame','cancelAnimationFrame','screen', code);
fn(document, windowObj, navigatorObj, localStorageObj, performanceObj, requestAnimationFrame, cancelAnimationFrame, screenObj);
const G = globalThis.__G;
const { Game, Input } = G;
function pump(frames){ for (let i=0;i<frames;i++){ nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs); } }
const P = () => Game.player;
function state(){ return `state=${Game.state} pos=(${P().x.toFixed(1)},${P().y.toFixed(1)}) vy=${P().vy.toFixed(1)} form=${P().form} lives=${Game.lives} score=${Game.score} shots=${Game.shots.length} items=${Game.items.length} dead=${P().dead}`; }

Game.startGame();
pump(90);
console.log('A. after start:', state());

// block bump with held jump
P().x = 7*48 + 10; P().y = 10*48 - P().h; P().vy = -560; P().vx = 0;
Input.jumpHeld = true;
pump(30);
Input.jumpHeld = false;
pump(30);
console.log('B. after block bump: tile(7,7)=' + Game.level.get(7,7), 'gems=', Game.gems, state());

// stomp with monitoring
{
  const e = Game.enemies.find(e => e.kind === 'walker' && !e.dead);
  P().x = e.x + (e.w - P().w)/2; P().y = e.y - P().h - 4; P().vy = 80; P().vx = 0;
  let minVy = 999;
  for (let i=0;i<10;i++){
    nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs);
    minVy = Math.min(minVy, P().vy);
    if (i<4) console.log(`  stomp f${i}: e.dead=${e.dead} vy=${P().vy.toFixed(1)}`);
  }
  console.log('C. stomp: e.dead=', e.dead, 'minVy=', minVy.toFixed(1), state());
}

// projectile
{
  P().setForm('shoot');
  P().x = 30*48; P().y = 10*48 - P().h; P().vx = 0; P().vy = 0;
  console.log('D. before shoot:', state(), 'rectSolid=', /*noop*/'');
  Input.actionHeld = true; Input.actionQueued = true;
  pump(1);
  console.log('  after 1 frame: shots=', Game.shots.length, state());
  pump(1);
  console.log('  after 2 frames: shots=', Game.shots.length, state());
  Input.actionHeld = false;
}
pump(90);
console.log('E. after 90 frames near pit edge:', state());
pump(90);
console.log('F. after 180 frames:', state());
process.exit(0);
