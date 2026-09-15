// Smoke test v3: deterministic sections, each starting from a fresh run.
'use strict';
const fs = require('fs');

const html = fs.readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m){ console.error('no script block'); process.exit(1); }
let code = m[1];
code += '\n;globalThis.__G = { Game, Input, AudioSys, Settings, Level, MAIN_ROWS, BONUS_ROWS, T, ' +
  'toggleMute, doPause, doResume, rectSolid, moveAndCollide, Player, Enemy, Item, Projectile, ASSETS, tileImage };\n';

function makeCtx(){
  const ops = [];
  const special = {
    ops,
    fillRect: (...args) => ops.push(['rect', ...args]),
    drawImage: (...args) => ops.push(['image', ...args]),
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
    setAttribute(){}, appendChild(){}, getContext(){ return this.ctx || (this.ctx = makeCtx()); },
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
  check(lv.get(152, 0) === T.EMPTY && lv.get(152, 2) === T.FLAG && lv.get(152, 9) === T.FLAG, 'flag pole rows 2-9 at col 152');
  check(lv.get(42, 9) === T.DOOR, 'bonus door at (42,9)');
  check(lv.get(7, 7) === T.Q_GEM, 'mystery gem at (7,7)');
  check(lv.get(155, 8) === T.END_DOOR && lv.get(155, 9) === T.END_DOOR, '2-tile destination door');
  // pits were narrowed for accessibility: original 62 and 105 are now ground, new pits at 66 and 107
  check(lv.get(28, 10) === T.EMPTY && lv.get(66, 10) === T.EMPTY && lv.get(107, 10) === T.EMPTY, 'pits exist');
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

console.log('== hero artwork and poses ==');
{
  for (const [size,height,crouchHeight] of [['small',40,32],['big',64,48]]){
    const frames = G.ASSETS.pip[size];
    let bounded = true;
    for (const [name,canvas] of Object.entries(frames)){
      const h = name.includes('crouch') ? crouchHeight : height;
      if (canvas.width !== 48 || canvas.height !== h) bounded = false;
      for (const op of canvas.getContext().ops){
        if (op[0] === 'rect' && (op[1]<0 || op[2]<0 || op[3]<=0 || op[4]<=0 ||
            op[1]+op[3]>48 || op[2]+op[4]>h)) bounded = false;
      }
    }
    check(bounded, size+' sprites stay within standing and crouching canvases');
    const signature = name => JSON.stringify(frames[name].getContext().ops);
    check(new Set([0,1,2,3].map(n => signature('walk'+n))).size === 4,
      size+' has four distinct walking poses');
    check(new Set([0,1,2,3].map(n => signature('run'+n))).size === 4,
      size+' has four distinct running poses');
    check(signature('jump') !== signature('fall') && signature('idle0') !== signature('blink'),
      size+' has separate ascent, descent and blink poses');
  }
  fresh();
  const p = Game.player;
  for (const form of ['small','big']){
    p.setForm(form);
    const feet = p.y+p.h;
    p.setCrouch(true);
    check(p.y+p.h === feet && p.h === (form==='small'?32:48), form+' crouch keeps feet planted');
    p.setCrouch(false);
    check(p.y+p.h === feet && p.h === (form==='small'?40:64), form+' standing restores original collision height');
  }
}

console.log('== bonus entrance layout ==');
{
  fresh();
  const lv = Game.level;
  check(lv.get(42,6) === T.EMPTY && lv.get(43,6) === T.EMPTY && lv.get(43,7) === T.EMPTY,
    'no disconnected stonework above bonus entrance');
  check(lv.get(42,9) === T.DOOR && lv.get(42,8) === T.Q_GEM,
    'bonus entrance and reward block preserved');
  check(!lv.solid(42,9) && lv.solid(42,10), 'bonus door remains passable and grounded');
}

console.log('== destination castle layout ==');
{
  fresh();
  const lv = Game.level;
  let supported = true, clearApproach = true;
  for (let y=0; y<10; y++) for (let x=142; x<=160; x++){
    if (x<152 && lv.get(x,y) === T.BUILD) clearApproach = false;
    if (lv.get(x,y) === T.BUILD && !lv.solid(x,y+1) && lv.get(x,y+1) !== T.END_DOOR) supported = false;
  }
  check(supported && clearApproach, 'castle walls are supported and no masonry floats over approach');
  check(lv.flagTop === 2, 'flags start below HUD');
  check(G.tileImage(T.END_DOOR,155,8) === G.ASSETS.tiles.endDoorTop &&
    G.tileImage(T.END_DOOR,155,9) === G.ASSETS.tiles.endDoorBottom,
    'entrance uses distinct halves of one tall door');
  check(!lv.solid(155,8) && !lv.solid(155,9), 'entrance remains passable');
}

console.log('== reward animation and independent checkpoints ==');
{
  fresh();
  Game.enemies.length = 0;
  Game.lastMultiX = 7*48+24;
  Game.lastMultiY = 7*48-6;
  const before = Game.gems;
  Game.spawnContent(T.Q_GEM);
  const pop = Game.pops[0], y = pop.y;
  pump(5);
  check(pop.y !== y && pop.t > 0, 'block reward diamond animates after capture');
  pump(45);
  check(Game.pops.length === 0 && Game.gems === before+1, 'block reward diamond expires without another reward');
  Game.spawnContent(T.Q_MULTI);
  pump(100);
  check(Game.pops.length === 0 && Game.gems === before+6, 'all multi-block reward diamonds expire');
  for (const tx of [94,124]){
    check(G.tileImage(T.CHECK,tx,6) === G.ASSETS.tiles.checkTop, 'checkpoint '+tx+' has its own pennant');
    let bottom = 6;
    while (Game.level.get(tx,bottom+1) === T.CHECK) bottom++;
    check(G.tileImage(T.CHECK,tx,bottom) === G.ASSETS.tiles.checkBase && Game.level.solid(tx,bottom+1),
      'checkpoint '+tx+' has a grounded base');
  }
  check(Game.level.get(134,6) !== T.CHECK && Game.level.get(144,9) !== T.CHECK, 'no orphan checkpoint tiles');
}

console.log('== pipe seams and diamond capture regressions ==');
{
  // Replay the rectangle-only pipe artwork at a point, including tile slices.
  function colorAt(canvas, x, y){
    return canvas.getContext().ops.some(op => {
      if (op[0] === 'rect') return x >= op[1] && x < op[1]+op[3] && y >= op[2] && y < op[2]+op[4];
      if (op[0] === 'image' && op.length === 10)
        return colorAt(op[1], op[2] + x - op[6], op[3] + y - op[7]);
      return false;
    });
  }
  for (const [left, right] of [[T.PIPE_TL,T.PIPE_TR], [T.PIPE_BL,T.PIPE_BR]]){
    check(Array.from({length:48}, (_, y) =>
      colorAt(G.ASSETS.tiles[left],47,y) && colorAt(G.ASSETS.tiles[right],0,y)).every(Boolean),
      'pipe halves meet with no transparent vertical seam (' + left + ',' + right + ')');
  }
  fresh();
  const plant = Game.enemies.find(e => e.kind === 'plant');
  check(plant.baseY === 7*48 && plant.x + plant.w/2 === 87*48,
    'flower is anchored at the center of the pipe rim');
  check(Game.level.get(86, plant.baseY/48) === T.PIPE_TL &&
    Game.level.get(87, plant.baseY/48) === T.PIPE_TR, 'flower base matches actual pipe top');
  check(Array.from({length:48}, (_, y) => colorAt(G.ASSETS.tiles.checkBase,23,y)).every(Boolean),
    'checkpoint pole continues all the way through its base tile');
  Game.enemies.length = 0;
  const tx = 7, ty = 8;
  Game.level.set(tx, ty, T.BRICK);
  const gem = new G.Item('gem', tx*48+11, (ty-1)*48+11);
  const neighbor = new G.Item('gem', (tx+1)*48+11, (ty-1)*48+11);
  Game.items = [gem, neighbor];
  const before = Game.gems, score = Game.score;
  Game.onHeadBump(tx,ty);
  check(gem.remove && !neighbor.remove, 'head bump captures only the diamond above the block');
  check(Game.gems === before+1 && Game.score === score+200, 'head-bumped diamond awards one reward');
  Game.collectItem(gem);
  Game.onHeadBump(tx,ty);
  check(Game.gems === before+1, 'captured diamond cannot be awarded twice');
  Game.compact(Game.items);
  check(!Game.items.includes(gem), 'captured diamond disappears from the item list');
  fresh();
  Game.enemies.length = 0;
  const p = Game.player;
  teleport(350, 300);
  const floating = new G.Item('gem', p.x, p.y-27);
  Game.items = [floating];
  let touches = false;
  for (let i=0; i<180 && !touches; i++){
    teleport(350,300);
    pump(1);
    touches = floating.remove;
  }
  check(touches, 'bobbing diamond touching the head is captured');
}

G.AudioSys.stopMusic();
console.log(failures === 0 ? '\nALL CHECKS PASSED' : '\n' + failures + ' CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
