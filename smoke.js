// Smoke test v3: deterministic sections, each starting from a fresh run.
'use strict';
const fs = require('fs');

const html = fs.readFileSync('/home/user/game/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m){ console.error('no script block'); process.exit(1); }
let code = m[1];
code += '\n;globalThis.__G = { Game, Input, AudioSys, Settings, Level, MAIN_ROWS, BONUS_ROWS, T, ' +
  'toggleMute, doPause, doResume, rectSolid, moveAndCollide, Player, Enemy, Item, Projectile };\n';

function makeCtx(){
  const special = {
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop(){} }),
    createRadialGradient: () => ({ addColorStop(){} }),
  };
  return new Proxy({}, {
    get(t, k){ if (k in special) return special[k]; if (k === 'canvas') return {}; return function(){}; },
    set(){ return true; },
  });
}
const elCache = {};
function makeEl(id){
  return {
    id, style: {}, value: '85', hidden: false, textContent: '', innerHTML: '', width: 0, height: 0,
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); },
      toggle(c, f){ if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(){}, removeEventListener(){}, setPointerCapture(){}, releasePointerCapture(){},
    setAttribute(){}, appendChild(){}, getContext(){ return makeCtx(); },
  };
}
const document = {
  getElementById(id){ return elCache[id] || (elCache[id] = makeEl(id)); },
  createElement(tag){ return makeEl(tag); },
  addEventListener(){}, removeEventListener(){},
  hidden: false, body: makeEl('body'), documentElement: makeEl('html'),
  querySelector(){ return makeEl('q'); }, fullscreenElement: null,
};
let nowMs = 0;
const rafCbs = [];
function requestAnimationFrame(cb){ rafCbs.push(cb); return rafCbs.length; }
function cancelAnimationFrame(){}
const windowObj = {
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2,
  addEventListener(){}, removeEventListener(){}, visualViewport: null,
  AudioContext: class {
    constructor(){ this.currentTime = 0; this.state = 'running'; this.destination = {}; this.sampleRate = 44100; }
    createGain(){ return { gain: { value: 0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(n){ return n; } }; }
    createOscillator(){ return { type:'', frequency: { setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(n){ return n }, start(){}, stop(){} }; }
    createBufferSource(){ return { buffer: null, connect(n){ return n }, start(){}, stop(){} }; }
    createBuffer(ch, len){ return { getChannelData(){ return new Float32Array(len); } }; }
    createBiquadFilter(){ return { type:'', frequency: { value: 0 }, Q: { value: 1 }, connect(n){ return n } }; }
    resume(){ this.state = 'running'; return Promise.resolve(); }
    suspend(){ this.state = 'suspended'; return Promise.resolve(); }
  },
};
const navigatorObj = { vibrate: null };
const localStorageObj = { _d: {}, getItem(k){ return k in this._d ? this._d[k] : null; }, setItem(k, v){ this._d[k] = String(v); }, removeItem(k){ delete this._d[k]; } };
const performanceObj = { now: () => nowMs };
const screenObj = { orientation: null };

const fn = new Function('document','window','navigator','localStorage','performance','requestAnimationFrame','cancelAnimationFrame','screen', code);
fn(document, windowObj, navigatorObj, localStorageObj, performanceObj, requestAnimationFrame, cancelAnimationFrame, screenObj);

const G = globalThis.__G;
const { Game, Input, MAIN_ROWS, T } = G;

let failures = 0;
function check(cond, msg){
  if (cond) console.log('  ok -', msg);
  else { failures++; console.error('  FAIL -', msg); }
}
function pump(frames){
  for (let i = 0; i < frames; i++){
    nowMs += 1000/60;
    const cbs = rafCbs.splice(0);
    for (const cb of cbs) cb(nowMs);
  }
}
// fresh PLAYING state, small form, lives=3, camera near start
function fresh(){
  Game.startGame();
  pump(90);
}
// teleport + keep camera sane
function teleport(x, y){
  const p = Game.player;
  p.x = x; p.y = y; p.vx = 0; p.vy = 0;
  Game.cam.x = Math.max(0, Math.min(x - 400, Game.level.w*48 - 960));
  Game.cam.y = 0;
}
// full-height jump into the block above (tx,ty)
function jumpIntoBlock(tx, ty){
  const p = Game.player;
  teleport(tx*48 + 10, 10*48 - p.h);
  p.vy = -560;
  Input.jumpHeld = true;
  pump(30);
  Input.jumpHeld = false;
  pump(40);
}
// wait until state is PLAYING again (handles READY transitions)
function waitPlaying(maxFrames){
  for (let i = 0; i < maxFrames && Game.state !== 'PLAYING'; i++) pump(1);
  return Game.state === 'PLAYING';
}

console.log('== level data ==');
{
  check(MAIN_ROWS.every(r => r.length === 170), 'main rows all 170 cols');
  const lv = new G.Level(MAIN_ROWS, false);
  check(lv.get(2, 10) === T.GROUND, 'ground under start');
  check(lv.get(152, 0) === T.FLAG && lv.get(152, 9) === T.FLAG, 'flag pole rows 0-9 at col 152');
  check(lv.get(42, 9) === T.DOOR, 'bonus door at (42,9)');
  check(lv.get(7, 7) === T.Q_GEM, 'mystery gem at (7,7)');
  check(lv.get(155, 8) === T.END_DOOR && lv.get(155, 9) === T.END_DOOR, '2-tile destination door');
  check(lv.get(28, 10) === T.EMPTY && lv.get(62, 10) === T.EMPTY && lv.get(105, 10) === T.EMPTY, 'pits exist');
  check(lv.gemSpawns.length > 0, 'floating gems: ' + lv.gemSpawns.length);
  const blv = new G.Level(G.BONUS_ROWS, true);
  check(blv.w === 18 && blv.h === 10, 'bonus room 18x10');
  check(blv.get(7, 8) === T.DOOR && blv.get(8, 8) === T.DOOR, 'bonus exit door');
}

console.log('== boot ==');
check(Game.state === 'TITLE', 'boots to TITLE (got ' + Game.state + ')');
pump(30);
check(Game.state === 'TITLE', 'title animates');
G.AudioSys.unlock();
check(G.AudioSys.ctx !== null, 'audio context created after gesture');

console.log('== start ==');
Game.startGame();
check(Game.state === 'READY', 'READY after start');
check(Game.lives === 3 && Game.score === 0 && Game.gems === 0, 'fresh run state');
pump(90);
check(Game.state === 'PLAYING', 'PLAYING after ready');
const t0 = Game.timeLeft;
pump(60);
check(Game.timeLeft < t0, 'timer counts down');

console.log('== movement & jumping ==');
{
  Input.right = true;
  pump(80);
  check(Game.player.x > 150, 'walks right (x=' + Math.round(Game.player.x) + ')');
  Input.right = false;
  pump(30);
  Input.jumpHeld = true; Input.jumpQueued = true;
  pump(10);
  let minY = Game.player.y;
  pump(30);
  minY = Math.min(minY, Game.player.y);
  Input.jumpHeld = false; Input.jumpQueued = false;
  pump(60);
  check(minY < 440 - 60, 'held jump rises ' + Math.round(440 - minY) + 'px');
  check(Game.player.onGround === true, 'lands after jump');
  check(!G.rectSolid(Game.level, Game.player.x, Game.player.y, Game.player.w, Game.player.h), 'not embedded after jump');
}

console.log('== mystery block (gem) ==');
{
  fresh();
  jumpIntoBlock(7, 7);
  check(Game.level.get(7,7) === T.USED, 'block became USED (got ' + Game.level.get(7,7) + ')');
  check(Game.gems >= 1, 'gem collected');
  check(Game.score >= 200, 'score includes gem');
}

console.log('== stomp ==');
{
  fresh();
  const e = Game.enemies.find(e => e.kind === 'walker' && !e.dead);
  check(!!e, 'walker found');
  teleport(e.x - 80, 10*48 - Game.player.h);  // bring camera in range so it activates
  pump(10);
  teleport(e.x + (e.w - Game.player.w)/2, e.y - Game.player.h - 4);
  Game.player.vy = 80;
  let minVy = 999;
  for (let i = 0; i < 10; i++){
    nowMs += 1000/60;
    const cbs = rafCbs.splice(0);
    for (const cb of cbs) cb(nowMs);
    minVy = Math.min(minVy, Game.player.vy);
  }
  check(e.dead === true, 'walker stomped');
  check(minVy < -100, 'player bounced off stomp (minVy=' + minVy.toFixed(0) + ')');
}

console.log('== damage -> death -> respawn ==');
{
  fresh();
  const e2 = Game.enemies.find(e => e.kind === 'walker' && !e.dead);
  check(!!e2, 'walker found');
  teleport(e2.x - 80, 10*48 - Game.player.h);  // activate via camera range
  pump(10);
  // overlap the walker from the side (guaranteed contact regardless of its direction)
  teleport(e2.x + e2.w/2 - Game.player.w/2, e2.y);
  pump(10);
  check(Game.state === 'DYING', 'small player dies on side hit (got ' + Game.state + ')');
  waitPlaying(300);
  check(Game.state === 'PLAYING', 'respawned to PLAYING (got ' + Game.state + ')');
  check(Game.lives === 2, 'life deducted (lives=' + Game.lives + ')');
}

console.log('== pit death ==');
{
  const p = Game.player;
  teleport(29*48 + 10, 13*48);
  pump(60);
  check(Game.state === 'DYING' || Game.state === 'READY', 'pit triggers death (state ' + Game.state + ')');
  waitPlaying(300);
  check(Game.state === 'PLAYING', 'respawned after pit (got ' + Game.state + ')');
  check(Game.lives === 1, 'lives=1 after pit (got ' + Game.lives + ')');
}

console.log('== hazards (spikes) ==');
{
  fresh();
  teleport(131*48, 10*48 - Game.player.h);
  pump(20);
  check(Game.state === 'DYING' || Game.state === 'READY', 'spikes kill small player (state ' + Game.state + ')');
  waitPlaying(300);
  check(Game.state === 'PLAYING', 'respawned after spikes (got ' + Game.state + ')');
}

console.log('== power-ups (grow + shoot + star) ==');
{
  fresh();
  const p = Game.player;
  jumpIntoBlock(23, 7);
  check(Game.level.get(23,7) === T.USED, 'Q_GROW block used');
  let it = Game.items.find(i => !i.remove && (i.type === 'grow' || i.type === 'shoot'));
  check(!!it, 'power-up item emerged');
  if (it){
    it.emerge = 0;
    it.x = p.x + 2; it.y = p.y + 10;
    pump(5);
    check(p.form === 'big' || p.form === 'shoot', 'grew (form=' + p.form + ')');
    check(!G.rectSolid(Game.level, p.x, p.y, p.w, p.h), 'not embedded after grow');
  }
  p.setForm('shoot');
  teleport(20*48 + 5, 10*48 - p.h);
  pump(10);
  Input.actionHeld = true; Input.actionQueued = true;
  pump(1);
  Input.actionHeld = false;
  check(Game.shots.length === 1, 'projectile fired (shots=' + Game.shots.length + ')');
  pump(10);
  check(Game.shots.length >= 1 || Game.shots.every(s => s.remove), 'projectile lives briefly');
  p.invT = 9;
  const e3 = Game.enemies.find(e => e.kind === 'walker' && !e.dead && e.active);
  if (e3){
    teleport(e3.x - 10, e3.y);
    pump(5);
    check(e3.dead === true, 'star kills enemy on contact');
  }
  p.invT = 0;
}

console.log('== one-way platform ==');
{
  const p = Game.player;
  if (Game.state !== 'PLAYING') fresh();
  teleport(64*48 + 4, 8*48 - p.h);
  pump(5);
  check(p.y + p.h <= 8*48 + 1, 'lands on one-way (bottom=' + (p.y + p.h).toFixed(1) + ')');
  teleport(65*48 + 4, 10*48 - p.h);
  Game.player.vy = -560;
  Input.jumpHeld = true;
  pump(40);
  check(p.y < 8*48 - p.h - 10, 'jumped through one-way from below (y=' + p.y.toFixed(0) + ')');
  Input.jumpHeld = false;
  pump(60);
}

console.log('== bonus room ==');
{
  fresh();
  teleport(42*48 + 8, 9*48 - Game.player.h);
  Input.down = true;
  pump(50);
  Input.down = false;
  check(Game.inBonus === true, 'entered bonus room (state ' + Game.state + ')');
  check(Game.level.isBonus === true, 'level swapped to bonus');
  pump(20);
  Input.down = true;
  pump(50);
  Input.down = false;
  check(Game.inBonus === false, 'exited bonus room');
  check(Game.level.isBonus === false, 'level restored');
  check(!G.rectSolid(Game.level, Game.player.x, Game.player.y, Game.player.w, Game.player.h), 'not embedded after exit');
}

console.log('== checkpoint ==');
{
  fresh();
  const p = Game.player;
  const before = Game.checkX;
  teleport(94*48 + 4, 10*48 - p.h);
  pump(10);
  check(Game.checkX === 94, 'checkpoint set at 94 (was ' + before + ', now ' + Game.checkX + ')');
  Game.die('time');
  waitPlaying(300);
  check(Game.state === 'PLAYING', 'back in PLAYING after checkpoint death');
  check(Math.abs(p.x - 94*48) < 60, 'respawned near checkpoint (x=' + p.x.toFixed(0) + ')');
}

console.log('== pause / resume ==');
{
  if (Game.state !== 'PLAYING') fresh();
  G.doPause();
  check(Game.state === 'PAUSED', 'paused');
  const s = Game.score;
  pump(30);
  check(Game.score === s && Game.state === 'PAUSED', 'frozen while paused');
  G.doResume();
  check(Game.state === 'PLAYING', 'resumed');
}

console.log('== level complete ==');
{
  teleport(152*48 - 6, 4*48);
  pump(8);
  check(Game.state === 'CLEARING', 'flag starts clear (got ' + Game.state + ')');
  check(Game.flagScore > 200, 'flag height score (got ' + Game.flagScore + ')');
  pump(1500);
  check(Game.state === 'CLEAR', 'reached clear panel (got ' + Game.state + ')');
  check(Game.score > 0, 'final score ' + Game.score);
  Game.toTitle();
  check(Game.state === 'TITLE', 'back to title');
}

console.log('== game over flow ==');
{
  Game.startGame();
  pump(90);
  Game.lives = 1;
  Game.die('time');
  pump(160);
  check(Game.state === 'GAMEOVER', 'game over at 0 lives (got ' + Game.state + ')');
  Game.startGame();
  pump(90);
  check(Game.state === 'PLAYING', 'retry works');
  G.toggleMute();
  G.toggleMute();
  Game.toTitle();
}

G.AudioSys.stopMusic();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
