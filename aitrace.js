'use strict';
// Copy of aiplay logic but logs every frame between col 20 and 34, first 2 attempts.
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
let deaths = 0, prevSt='PLAYING';
const START = nowMs;
let logAttempt = 0;
while (nowMs - START < 90*1000){
  const st = Game.state;
  if (st === 'GAMEOVER'){ console.log('game over at death', deaths); break; }
  if (st === 'CLEAR'){ console.log('CLEARED at', ((nowMs-START)/1000).toFixed(1)+'s'); break; }
  if (st !== 'PLAYING'){ pump(1); if (st==='DYING' && prevSt!=='DYING'){ deaths++; logAttempt++; console.log('--- death at col', (Game.player.x/48).toFixed(2), 'attempt', deaths); if (logAttempt>2) break; } prevSt=st; continue; }
  const p = Game.player;
  const lv = Game.level;
  const feet = p.y + p.h;
  const ty = Math.floor(feet/48);
  const gap = p.onGround && (() => { for (const off of [8,34]){ const tx = Math.floor((p.x+p.w+off)/48); let g=false; for (let d=0;d<=2;d++){ if (SOLID.has(lv.get(tx,ty+d))){g=true;break;} } if (!g) return true; } return false; })();
  const wall = p.onGround && (() => { const tx = Math.floor((p.x+p.w+10)/48); for (let dy=8;dy<46;dy+=12){ if (SOLID.has(lv.get(tx,Math.floor((p.y+dy)/48)))) return true; } return false; })();
  let stomp=false;
  if (p.onGround){ for (const e of Game.enemies){ if (e.dead||e.remove||e.kind==='plant') continue; if (e.kind==='shell'&&e.state==='live') continue; const dx=(e.x+e.w/2)-(p.x+p.w/2); if (dx>40&&dx<=95&&Math.abs((e.y+e.h)-feet)<26){ stomp=true; break; } } }
  if ((p.x/48)>20 && (p.x/48)<34){
    const wk = Game.enemies.find(e=>e.kind==='walker'&&!e.dead);
    console.log(`col=${(p.x/48).toFixed(2)} y=${p.y.toFixed(0)} vy=${p.vy.toFixed(0)} og=${p.onGround} gap=${gap} wall=${wall} stomp=${stomp} wk=${wk?('x='+(wk.x/48).toFixed(1)+' dir='+wk.dir+' dead='+wk.dead):'none'}`);
  }
  Input.left=false; Input.right=false; Input.down=false; Input.actionHeld=true;
  if (stomp){ Input.jumpQueued=true; Input.jumpHeld=true; Input.right=true; }
  else if (gap||wall){ Input.jumpQueued=true; Input.jumpHeld=true; Input.right=true; }
  else { Input.right=true; Input.jumpHeld = !p.onGround; }
  nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs);
}
console.log('done');
process.exit(0);
