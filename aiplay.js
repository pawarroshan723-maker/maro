'use strict';
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
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
function p0(){ return Game.player; }
function pump(frames){ for (let i=0;i<frames;i++){ nowMs += 1000/60; const cbs = rafCbs.splice(0); for (const cb of cbs) cb(nowMs); } }
const SOLID = new Set([T.GROUND,T.DIRT,T.BRICK,T.Q_GEM,T.Q_GROW,T.Q_SHOT,T.Q_STAR,T.Q_LIFE,T.Q_MULTI,T.USED,T.PIPE_TL,T.PIPE_TR,T.PIPE_BL,T.PIPE_BR,T.BUILD]);

Game.startGame(process.env.STAGE === '2' ? 2 : 1); pump(90);
if (process.env.GEOM_ONLY) { Game.enemies.length = 0; console.log('GEOM_ONLY: enemies removed'); }
let deaths = 0, maxX = 0, lastLog = 0, waitFrames = 0, prevSt='PLAYING', deathCols=[], airFromTap=false, tapHold=0;
const START = nowMs;
while (nowMs - START < 6*60*1000){
  const st = Game.state;
  if (st === 'GAMEOVER'){ console.log('AI gave up (game over) at col=', (maxX/48).toFixed(1), 'deaths=', deaths); break; }
  if (st === 'CLEAR'){
    console.log('AI CLEARED THE LEVEL! time=', ((nowMs-START)/1000).toFixed(1)+'s', 'deaths=', deaths, 'score=', Game.score, 'gems=', Game.gems);
    break;
  }
  airFromTap = false; tapHold = 0;
  if (st !== 'PLAYING'){ pump(1); if (st === 'DYING' && prevSt !== 'DYING'){ deaths++; deathCols.push((p0().x/48).toFixed(1)); } prevSt = st; continue; }
  const p = Game.player;
  maxX = Math.max(maxX, p.x);
  const lv = Game.level;
  const feet = p.y + p.h;
  const probeX = p.x + p.w*0.5 + 26;
  const feetTy = Math.floor(feet/48);
  const gap = p.onGround && (() => {
    const ty = feetTy;
    // sample just ahead of the front edge and a bit further; if no solid ground there, jump
    for (const off of [8, 34]){
      const tx = Math.floor((p.x + p.w + off)/48);
      let ground = false;
      for (let d = 0; d <= 2; d++){
        const c = lv.get(tx, ty + d);
        if (SOLID.has(c)){ ground = true; break; }
      }
      if (!ground) return true;
    }
    return false;
  })();
  const wall = p.onGround && (() => { const tx = Math.floor((p.x + p.w + 10)/48);
    const y0 = Math.floor(p.y/48), y1 = Math.floor((p.y + p.h - 1)/48);
    for (let ry = y0; ry <= y1; ry++){ if (SOLID.has(lv.get(tx, ry))) return true; } return false; })();
  // spikes ahead
  const spikes = (() => { const ty = Math.floor(feet/48);
    const x0 = Math.floor((p.x + p.w + 2)/48), x1 = Math.floor((p.x + p.w + 60)/48);
    for (let tx = x0; tx <= x1; tx++) if (lv.get(tx, ty) === T.HAZARD || lv.get(tx, ty-1) === T.HAZARD) return true;
    return false; })();

  // plants ahead -> wait until retracted
  let plantBlock = false;
  for (const e of Game.enemies){
    if (e.kind !== 'plant' || e.dead || e.remove) continue;
    const dx = (e.x + e.w/2) - (p.x + p.w/2);
    if (dx > -20 && dx < 170 && e.rise > 0.05) { plantBlock = true; break; }
  }

  // live shell approaching -> wait
  let shellBlock = false;
  for (const e of Game.enemies){
    if (e.kind !== 'shell' || e.state !== 'live' || e.dead || e.remove) continue;
    const dx = (e.x + e.w/2) - (p.x + p.w/2);
    if (dx > -30 && dx < 130 && Math.abs((e.y + e.h) - feet) < 40) { shellBlock = true; break; }
  }
  // enemy approaching (walker/shell moving toward us) in tap-stomp window
  let tapTarget = false;
  if (p.onGround && !plantBlock && !shellBlock){
    for (const e of Game.enemies){
      if (e.dead || e.remove || e.kind === 'plant') continue;
      if (e.kind === 'shell' && e.state === 'live') continue;
      const dx = (e.x + e.w/2) - (p.x + p.w/2);
      if (dx > -12 && dx <= 150 && Math.abs((e.y + e.h) - feet) < 26){
        if (e.dir < 0){                       // approaching (player is left of it)
          if (dx <= 70){ tapTarget = true; break; }
          if (dx <= 130){ /* close, keep walking; it will enter the window */ }
        }
      }
    }
  }
  // is there ground under a tap landing (~85-130px ahead)?
  const tapHasGround = (() => { const tx = Math.floor((p.x + p.w + 110)/48);
    for (let d = 0; d <= 2; d++){ if (SOLID.has(lv.get(tx, feetTy + d))) return true; } return false; })();
  // are we standing on a raised surface (ground >= 2 tiles below our feet)?
  let raised = false;
  {
    const bx = Math.floor((p.x + p.w*0.5)/48);
    for (let d = 1; d <= 8; d++){
      if (SOLID.has(lv.get(bx, feetTy + d))) { raised = d >= 2; break; }
    }
  }

  // will a full jump from here land on top of an enemy? if so, wait for it to clear
  const landX = p.x + p.w/2 + 500;
  let landingBlocked = false;
  if (gap || spikes || (wall && !raised) || (tapTarget && !tapHasGround)){
    for (const e of Game.enemies){
      if (e.dead || e.remove || e.kind === 'plant') continue;
      if (e.kind === 'shell' && e.state === 'live') continue;
      if (Math.abs((e.x + e.w/2) - landX) < 110 && Math.abs((e.y + e.h) - (p.y + p.h)) < 70){ landingBlocked = true; break; }
    }
  }

  Input.left = false; Input.right = false; Input.down = false; Input.actionHeld = true;
  if ((gap || spikes) && !landingBlocked){
    Input.jumpQueued = true; Input.jumpHeld = true; Input.right = true; airFromTap = false; tapHold = 0;
  } else if ((gap || spikes) && landingBlocked){
    waitFrames++;
  } else if (wall){
    if (raised && tapHasGround){
      // hop off the raised edge, don't overshoot
      if (p.onGround && tapHold === 0){ Input.jumpQueued = true; Input.jumpHeld = true; tapHold = 6; airFromTap = true; }
      Input.right = true;
    } else if (landingBlocked){
    waitFrames++;
    } else {
      Input.jumpQueued = true; Input.jumpHeld = true; Input.right = true; airFromTap = false; tapHold = 0;
    }
  } else if (tapTarget && p.onGround && tapHold === 0){
    if (tapHasGround){
      Input.jumpQueued = true; Input.jumpHeld = true; Input.right = true; airFromTap = true; tapHold = 6;
    } else {
      Input.jumpQueued = true; Input.jumpHeld = true; Input.right = true; airFromTap = false; tapHold = 0;
    }
  } else if (plantBlock || shellBlock){
    waitFrames++;
  } else {
    Input.right = true;
    if (airFromTap){
      if (tapHold > 0){ tapHold--; Input.jumpHeld = true; if (tapHold === 0) Input.jumpHeld = false; }
      else Input.jumpHeld = false;
    }
    else if (!p.onGround) Input.jumpHeld = true;
    else { Input.jumpHeld = false; airFromTap = false; }
  }
  let dec = 'walk';
  if (gap || spikes) dec = 'FULL';
  else if (wall) dec = raised ? 'WALL-TAP' : 'FULL';
  else if (tapTarget) dec = 'TAP';
  else if (plantBlock || shellBlock) dec = 'wait';
  if (deaths < 1 && (p.x/48) > 23 && (p.x/48) < 37){
    const wk = Game.enemies.find(e=>e.kind==='walker' && !e.dead && !e.remove);
    console.log(`col=${(p.x/48).toFixed(2)} y=${p.y.toFixed(0)} vy=${p.vy.toFixed(0)} og=${p.onGround} dec=${dec} gap=${gap} wall=${wall} raised=${raised} spikes=${spikes} tap=${tapTarget} tapG=${tapHasGround} plantB=${plantBlock} shellB=${shellBlock} airT=${airFromTap} wk=${wk?((wk.x/48).toFixed(1)+' d'+wk.dir):'-'}`);
  }
  pump(1);
  if (nowMs - lastLog > 5000){
    lastLog = nowMs;
    console.log(`t=${((nowMs-START)/1000).toFixed(0)}s col=${(p.x/48).toFixed(1)} y=${Math.round(p.y)} deaths=${deaths} form=${p.form}`);
  }
}
console.log('final:', Game.state, 'maxCol=', (maxX/48).toFixed(1), 'deaths=', deaths, 'score=', Game.score, 'deathCols=', deathCols.slice(0,40).join(','));
process.exit(Game.state === 'CLEAR' ? 0 : 1);
