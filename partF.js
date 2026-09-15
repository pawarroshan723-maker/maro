// ---------------- game state machine ----------------
const Game = {
  state: 'BOOT',                       // TITLE READY PLAYING PAUSED DYING CLEARING CLEAR GAMEOVER
  score: 0, gems: 0, lives: 3, timeLeft: LEVEL_TIME,
  high: Store.get('high', 0),
  level: null, mainLevel: null, bonusLevel: null, inBonus: false,
  player: null,
  enemies: [], items: [], shots: [], pops: [],
  texts: [],
  cam: { x: 0, y: 0 },
  shakeT: 0, shakeMag: 0, shakeDur: 1,
  checkX: START_TX,
  readyT: 0, deathT: 0,
  clearPhase: 0, clearT: 0, flagScore: 0, timeBonus: 0,
  multiQ: 0, multiT: 0, lastMultiX: 0, lastMultiY: 0,
  particles: null,   // assigned in init()
  stompChain: 0, chainT: 0, trailT: 0,
  bonusLockT: 0,
  fade: null,
  mainItems: [],

  init(){
    Particles.init();
    this.particles = Particles;
    this.level = new Level(MAIN_ROWS, false);
    this.mainLevel = this.level;
    this.bonusLevel = new Level(BONUS_ROWS, true);
    this.player = new Player(this);
    this.player.reset(START_TX, 'small', GROUND_ROW);
    this.spawnEntities();
    this.state = 'TITLE';
    this.cam.x = 30; this.cam.y = 0;
    $('title-hi').textContent = 'BEST ' + pad6(this.high);
    setupCanvas();
    TouchUI.init();
    wireUI();
    wireKeys();
    wireGlobal();
    showOv('ov-title');
    needRender = true;
    lastT = performance.now();
    requestAnimationFrame(frame);
  },

  // ---- entity spawning ----
  spawnEntities(){
    this.enemies.length = 0;
    this.items.length = 0;
    this.shots.length = 0;
    this.pops.length = 0;
    for (const s of ENEMY_SPAWNS){
      if (s[0] === 'walker') this.enemies.push(new Enemy('walker', s[1]*TILE + 7, GROUND_ROW*TILE - 34));
      else if (s[0] === 'shell') this.enemies.push(new Enemy('shell', s[1]*TILE + 6, GROUND_ROW*TILE - 30));
      else if (s[0] === 'plant') this.enemies.push(new Enemy('plant', (s[1]+1)*TILE - 15, s[2]*TILE));
    }
    for (const g of this.level.gemSpawns){
      this.items.push(new Item('gem', g.tx*TILE + 11, g.ty*TILE + 11));
    }
  },
  buildBonusItems(){
    const arr = [];
    for (const g of this.bonusLevel.gemSpawns){
      arr.push(new Item('gem', g.tx*TILE + 11, g.ty*TILE + 11));
    }
    const life = new Item('life', 408 - 13, 216 - 13);
    life.staticItem = true;
    arr.push(life);
    return arr;
  },

  // ---- flow ----
  startGame(){
    AudioSys.unlock();
    hideAllOverlays();
    document.body.classList.add('in-game');
    this.score = 0; this.gems = 0; this.lives = 3;
    this.checkX = START_TX;
    this.mainLevel = new Level(MAIN_ROWS, false);
    this.level = this.mainLevel;
    this.inBonus = false;
    this.timeLeft = LEVEL_TIME;
    this.multiQ = 0;
    this.stompChain = 0; this.chainT = 0;
    this.player = new Player(this);
    this.player.reset(START_TX, 'small', GROUND_ROW);
    this.spawnEntities();
    this.particles.clear();
    this.texts.length = 0;
    this.cam.x = 0; this.cam.y = 0;
    this.fade = null;
    this.state = 'READY';
    this.readyT = 1.2;
    this.inputClear();
    AudioSys.startMusic();
    needRender = true;
  },
  restartLevel(){
    this.mainLevel = new Level(MAIN_ROWS, false);
    this.level = this.mainLevel;
    this.inBonus = false;
    this.timeLeft = LEVEL_TIME;
    this.multiQ = 0;
    this.player.reset(this.checkX, this.player.form, GROUND_ROW);
    this.spawnEntities();
    this.cam.x = clamp(this.player.x - 320, 0, this.level.w*TILE - VIEW_W);
    this.cam.y = 0;
    this.fade = null;
    this.particles.clear();
    this.texts.length = 0;
    this.state = 'READY';
    this.readyT = 1.0;
    this.inputClear();
    needRender = true;
  },
  toTitle(){
    hideAllOverlays();
    document.body.classList.remove('in-game');
    this.mainLevel = new Level(MAIN_ROWS, false);
    this.level = this.mainLevel;
    this.bonusLevel = new Level(BONUS_ROWS, true);
    this.inBonus = false;
    this.player = new Player(this);
    this.player.reset(START_TX, 'small', GROUND_ROW);
    this.spawnEntities();
    this.particles.clear();
    this.texts.length = 0;
    this.cam.x = 30; this.cam.y = 0;
    this.fade = null;
    this.state = 'TITLE';
    AudioSys.stopMusic();
    $('title-hi').textContent = 'BEST ' + pad6(this.high);
    showOv('ov-title');
    needRender = true;
  },
  inputClear(){
    Input.clearAll();
    TouchUI.resetVisuals();
  },

  // ---- blocks ----
  onHeadBump(tx, ty){
    const lv = this.level;
    const c = lv.get(tx, ty);
    if (c === T.BRICK){
      if (this.player.form !== 'small'){
        lv.set(tx, ty, T.EMPTY);
        this.score += 50;
        this.particles.debris(tx*TILE + 24, ty*TILE + 24);
        AudioSys.sfx.breakBlock();
        this.shake(2, 0.15);
        vib(15);
        this.addText(tx*TILE + 24, ty*TILE, '50', '#f2a96b', 15);
      } else {
        lv.bumps.set(tx*100 + ty, BUMP_DUR);
        AudioSys.sfx.bump();
      }
    } else if (QCODES.has(c)){
      lv.bumps.set(tx*100 + ty, BUMP_DUR);
      lv.set(tx, ty, T.USED);
      this.lastMultiX = tx*TILE + 24;
      this.lastMultiY = ty*TILE - 6;
      this.spawnContent(c);
    } else {
      AudioSys.sfx.bump();
    }
    this.bumpKillEnemies(tx, ty);
    // A head bump also captures floating gems sitting just above this block.
    const above = { x: tx*TILE, y: ty*TILE - TILE, w: TILE, h: TILE };
    for (const it of this.items){
      if ((c === T.BRICK || QCODES.has(c)) && !it.remove && it.type === 'gem' && aabb(it, above)) this.collectItem(it);
    }
  },
  spawnContent(c){
    const bx = this.lastMultiX, by = this.lastMultiY;
    const blockTop = by + 6;   // lastMultiY is stored as blockTop - 6
    AudioSys.sfx.powerOut();
    if (c === T.Q_GEM){
      this.pops.push(new CoinPop(bx, by));
      this.score += 200; this.gems++;
      AudioSys.sfx.coin();
      this.particles.coinFx(bx, by - 10);
      this.addText(bx, by - 14, '200', '#7ef0ff', 15);
    } else if (c === T.Q_MULTI){
      this.multiQ = 5;
      this.multiT = 0;
    } else {
      let type;
      if (c === T.Q_GROW) type = (this.player.form === 'small') ? 'grow' : 'shoot';
      else if (c === T.Q_SHOT) type = (this.player.form === 'shoot') ? 'bonus1000' : 'shoot';
      else if (c === T.Q_STAR) type = 'star';
      else type = 'life';
      if (type === 'bonus1000'){
        this.score += 1000;
        this.addText(bx, by - 14, '1000', '#ffd23e');
        AudioSys.sfx.oneup();
      } else {
        const it = new Item(type, bx - 13, blockTop - 26);
        it.startY = blockTop - 8;
        it.y0 = blockTop - 26;
        it.emerge = 0.45;
        this.items.push(it);
      }
    }
  },
  bumpKillEnemies(tx, ty){
    const topY = ty*TILE;
    for (const e of this.enemies){
      if (e.dead || e.remove || e.kind === 'plant') continue;
      if (Math.abs((e.y + e.h) - topY) < 8 && e.x + e.w > tx*TILE + 6 && e.x < tx*TILE + 42){
        this.defeatEnemy(e, e.kind === 'walker' ? 100 : 200, 'bump');
      }
    }
  },

  // ---- combat ----
  onAction(p){
    if (p.form === 'shoot'){
      let n = 0;
      for (const s of this.shots) if (!s.remove) n++;
      if (n < MAX_PLAYER_SHOTS){
        this.shots.push(new Projectile(p.x + p.w/2 + p.facing*18, p.y + (p.form === 'small' ? 14 : 24), p.facing));
        AudioSys.sfx.shoot();
      } else {
        AudioSys.sfx.thud();
      }
    } else {
      const s = this.nearestIdleShell(p);
      if (s) this.kickShell(s, p.facing);
    }
  },
  nearestIdleShell(p){
    let best = null, bd = 52;
    for (const e of this.enemies){
      if (e.kind !== 'shell' || e.state !== 'idle' || e.dead || e.remove) continue;
      const d = Math.abs((e.x + e.w/2) - (p.x + p.w/2));
      if (d < bd && Math.abs((e.y + e.h) - (p.y + p.h)) < 40){ bd = d; best = e; }
    }
    return best;
  },
  kickShell(e, dir){
    e.state = 'live';
    e.dir = dir;
    e.vy = -260;
    AudioSys.sfx.kick();
    this.shake(1.5, 0.1);
    vib(12);
  },
  defeatEnemy(e, pts, style){
    if (e.dead) return;
    e.dead = true; e.deadT = 0;
    e.vy = -420;
    e.vx = (Math.random() < 0.5 ? -1 : 1) * 70;
    if (style === 'crush'){ e.vy = -360; e.vx = 0; }
    this.score += pts;
    this.addText(e.x + e.w/2, e.y - 4, String(pts), '#fff', 16);
    this.particles.puff(e.x + e.w/2, e.y + e.h/2, e.kind === 'plant' ? '#ff7d9c' : '#cbb7ff', 8);
    if (style === 'stomp') AudioSys.sfx.stomp();
    else if (style === 'shot') AudioSys.sfx.breakBlock();
    vib(10);
  },
  hitShot(s, e){
    s.remove = true;
    this.particles.spark(s.x, s.y, '#ffd23e', 6);
    if (e.kind === 'walker') this.defeatEnemy(e, 200, 'shot');
    else if (e.kind === 'plant') this.defeatEnemy(e, 200, 'shot');
    else if (e.kind === 'shell'){
      if (e.state === 'live'){
        AudioSys.sfx.bounce();
      } else if (e.state === 'walk'){
        e.state = 'idle'; e.vx = 0;
        this.score += 200;
        this.addText(e.x + e.w/2, e.y - 4, '200', '#fff', 16);
        AudioSys.sfx.stomp();
      } else {
        this.kickShell(e, s.vx > 0 ? 1 : -1);
      }
    }
  },
  playerVsEnemy(e, b){
    const p = this.player;
    if (p.invT > 0){ this.defeatEnemy(e, e.kind === 'walker' ? 100 : 200, 'crush'); return; }
    if (p.hurtT > 0) return;
    const stomp = p.vy > 40 && p.prevBottom <= b.y + 14;
    if (stomp){
      if (e.kind === 'plant'){
        this.hurtPlayer(e);
        return;
      }
      p.vy = Input.jumpHeld ? -640 : -430;
      if (e.kind === 'walker'){
        this.stompChain++;
        this.chainT = 1.2;
        const pts = 100 * (1 << Math.min(this.stompChain - 1, 4));
        this.defeatEnemy(e, pts, 'stomp');
      } else if (e.kind === 'shell'){
        if (e.state === 'idle'){
          p.vy = -200;
          AudioSys.sfx.thud();
        } else {
          e.state = 'idle'; e.vx = 0;
          this.score += 200;
          this.addText(e.x + e.w/2, e.y - 4, '200', '#fff', 16);
          AudioSys.sfx.stomp();
          vib(10);
        }
      }
    } else {
      if (e.kind === 'shell' && e.state === 'idle'){
        this.kickShell(e, (p.x + p.w/2) < (e.x + e.w/2) ? 1 : -1);
      } else {
        this.hurtPlayer(e);
      }
    }
  },
  hurtPlayer(src){
    const p = this.player;
    if (p.invT > 0 || p.hurtT > 0 || this.state !== 'PLAYING') return;
    if (p.form === 'small'){
      this.die('hit');
      return;
    }
    p.setForm(p.form === 'shoot' ? 'big' : 'small');
    p.hurtT = HURT_TIME;
    p.vy = -330;
    if (src && src.x !== undefined){
      p.vx = ((p.x + p.w/2) < (src.x + (src.w || 30)/2) ? -1 : 1) * 260;
    } else {
      p.vx = -p.facing * 260;
    }
    AudioSys.sfx.damage();
    vib(30);
    this.shake(4, 0.25);
  },

  // ---- death / respawn ----
  die(reason){
    if (this.state !== 'PLAYING') return;
    this.state = 'DYING';
    this.player.dead = true;
    this.deathT = (reason === 'pit') ? 0.8 : 1.6;
    this.inputClear();
    AudioSys.sfx.die();
    AudioSys.stopMusic();
    vib(40);
    if (reason !== 'pit'){
      this.player.vy = -620;
      this.player.vx = 0;
    }
  },
  afterDeath(){
    this.lives--;
    if (this.lives <= 0){
      this.high = Math.max(this.high, this.score);
      Store.set('high', this.high);
      this.state = 'GAMEOVER';
      $('over-score').textContent = 'SCORE ' + pad6(this.score);
      $('over-hi').textContent = 'BEST ' + pad6(this.high);
      showOv('ov-over');
    } else {
      this.restartLevel();
    }
  },

  // ---- triggers ----
  onCheckpoint(tx){
    if (tx > this.checkX){
      this.checkX = tx;
      AudioSys.sfx.checkpoint();
      this.addText(tx*TILE + 24, 6*TILE - 10, 'CHECKPOINT', '#ffd23e', 16);
    }
  },
  onFlag(p, ty){
    if (this.state !== 'PLAYING') return;
    this.state = 'CLEARING';
    this.clearPhase = 0;
    this.clearT = 0;
    this.flagScore = Math.round(200 + (9 - ty)/9 * 2800);
    this.score += this.flagScore;
    this.addText(FLAG_TX*TILE + 24, ty*TILE, '+' + this.flagScore, '#ffd23e', 20);
    this.particles.confetti(FLAG_TX*TILE + 24, 2*TILE);
    AudioSys.sfx.clear();
    AudioSys.stopMusic();
    this.inputClear();
    p.facing = 1; p.vx = 0; p.vy = 0;
    p.x = FLAG_TX*TILE - 22;
    p.y = Math.min(p.y, 9*TILE - p.h);
  },
  enterBonus(){
    if (this.inBonus || this.state !== 'PLAYING' || this.fade) return;
    this.inputClear();
    AudioSys.sfx.powerOut();
    this.startFade(() => {
      this.mainItems = this.items;
      this.level = this.bonusLevel;
      this.inBonus = true;
      this.items = this.buildBonusItems();
      this.player.reset(8.5, this.player.form, BONUS_FLOOR_ROW);
      this.cam.x = (this.bonusLevel.w*TILE - VIEW_W)/2;
      this.cam.y = (this.bonusLevel.h*TILE - VIEW_H)/2;
    });
  },
  exitBonus(){
    if (!this.inBonus || this.fade) return;
    this.inputClear();
    AudioSys.sfx.powerOut();
    this.bonusLockT = 0.6;   // prevent instant re-entry while Down is still held
    this.startFade(() => {
      this.level = this.mainLevel;
      this.inBonus = false;
      this.items = this.mainItems;
      this.player.reset(43, this.player.form, GROUND_ROW);
      this.cam.x = clamp(this.player.x - 320, 0, this.level.w*TILE - VIEW_W);
      this.cam.y = 0;
    });
  },
  startFade(cb){
    this.fade = { t: 0, dir: 1, cb };
  },
  updateFade(dt){
    if (!this.fade) return;
    this.fade.t += dt/0.35;
    if (this.fade.dir === 1 && this.fade.t >= 1){
      this.fade.cb();
      this.fade.dir = -1;
      this.fade.t = 0;
    } else if (this.fade.dir === -1 && this.fade.t >= 1){
      this.fade = null;
    }
  },
  finishClear(){
    this.state = 'CLEAR';
    this.timeBonus = Math.ceil(this.timeLeft) * 50;
    this.score += this.timeBonus;
    this.high = Math.max(this.high, this.score);
    Store.set('high', this.high);
    $('clear-stats').innerHTML =
      'FLAG BONUS&nbsp;&nbsp;' + pad6(this.flagScore) +
      '<br>TIME BONUS&nbsp;&nbsp;' + pad6(this.timeBonus) +
      '<br>GEMS&nbsp;&nbsp;×' + this.gems +
      '<br><span class="total">TOTAL ' + pad6(this.score) + '</span>';
    $('clear-hi').textContent = 'BEST ' + pad6(this.high);
    showOv('ov-clear');
  },

  // ---- tick helpers ----
  addText(x, y, txt, col, size){
    this.texts.push({ x, y, txt, col: col || '#fff', t: 0, life: 0.9, size: size || 18 });
    if (this.texts.length > MAX_TEXTS) this.texts.shift();
  },
  updateTexts(dt){
    let w = 0;
    for (let i = 0; i < this.texts.length; i++){
      const t = this.texts[i];
      t.t += dt;
      t.y -= 36*dt;
      if (t.t < t.life) this.texts[w++] = t;
    }
    this.texts.length = w;
  },
  compact(a){
    let w = 0;
    for (let i = 0; i < a.length; i++){
      if (!a[i].remove) a[w++] = a[i];
    }
    a.length = w;
  },
  shake(mag, dur){
    if (Settings.effectsReduced) return;
    this.shakeMag = mag;
    this.shakeDur = dur;
    this.shakeT = dur;
  },
  updateCamera(dt){
    const p = this.player, lv = this.level;
    const worldW = lv.w*TILE, worldH = lv.h*TILE;
    let min = 0, max = worldW - VIEW_W;
    if (worldW < VIEW_W){ min = (worldW - VIEW_W)/2; max = min; }
    let tY = worldH < VIEW_H ? (worldH - VIEW_H)/2 : 0;
    // rise with the player when they jump above the level's top edge
    const upTarget = p.y + p.h/2 - 300;
    if (upTarget < tY) tY = upTarget;
    tY = Math.max(tY, -240);
    const tX = p.x + p.w/2 - VIEW_W*0.42 + p.facing*60;
    const k = 1 - Math.exp(-6*dt);
    this.cam.x += (clamp(tX, min, max) - this.cam.x)*k;
    this.cam.y += (tY - this.cam.y)*k;
    this.cam.x = clamp(this.cam.x, min, max);
    this.cam.y = tY;
  },

  // ---- main tick (fixed timestep) ----
  tick(dt){
    switch (this.state){
      case 'TITLE':
        this.cam.x = 30 + 24 * (1 + Math.sin(gameT * 0.25));
        break;
      case 'READY':
        this.readyT -= dt;
        if (this.readyT <= 0){
          this.state = 'PLAYING';
          this.inputClear();
        }
        break;
      case 'PLAYING':
        this.tickPlaying(dt);
        break;
      case 'DYING':
        this.deathT -= dt;
        this.player.update(dt);
        this.particles.update(dt);
        this.updateTexts(dt);
        if (this.deathT <= 0) this.afterDeath();
        break;
      case 'CLEARING':
        this.tickClearing(dt);
        break;
      case 'CLEAR':
        this.particles.update(dt);
        this.updateTexts(dt);
        break;
      default:
        break;
    }
  },
  tickPlaying(dt){
    const p = this.player;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0){
      this.timeLeft = 0;
      this.die('time');
      return;
    }
    if (this.bonusLockT > 0) this.bonusLockT -= dt;
    if (this.fade) this.updateFade(dt);
    if (this.state !== 'PLAYING') return;

    p.update(dt);
    if (this.state !== 'PLAYING') return;

    // multi-gem fountain
    if (this.multiQ > 0){
      this.multiT -= dt;
      while (this.multiT <= 0 && this.multiQ > 0){
        this.multiT += 0.13;
        this.multiQ--;
        this.pops.push(new CoinPop(this.lastMultiX, this.lastMultiY));
        this.score += 200;
        this.gems++;
        AudioSys.sfx.coin();
        this.addText(this.lastMultiX + (Math.random()*20-10), this.lastMultiY - 14, '200', '#7ef0ff', 14);
      }
    }

    // star invincibility: warning ticks + trail
    if (p.invT > 0){
      const s = Math.ceil(p.invT);
      if (p.invT <= 3.05 && s !== p.invLastSec){
        p.invLastSec = s;
        if (s > 0) AudioSys.sfx.tick();
      }
      if (!Settings.effectsReduced){
        this.trailT -= dt;
        if (this.trailT <= 0){
          this.trailT = 0.07;
          this.particles.trail(p.x + p.w/2 + (Math.random()*16-8), p.y + p.h/2 + (Math.random()*24-12));
        }
      }
    }

    // stomp chain decay
    if (this.chainT > 0){
      this.chainT -= dt;
      if (this.chainT <= 0) this.stompChain = 0;
    }
    if (p.onGround) this.stompChain = 0;

    // enemies (frozen while inside the bonus room)
    if (!this.inBonus){
      for (const e of this.enemies) if (!e.remove) e.update(dt, this);
      // moving shells mow down foes
      for (const e of this.enemies){
        if (e.kind !== 'shell' || e.state !== 'live' || e.dead || e.remove) continue;
        for (const o of this.enemies){
          if (o === e || o.dead || o.remove) continue;
          if (o.kind === 'walker' || o.kind === 'plant'){
            const b = o.box();
            if (b.active && aabb(e, b)) this.defeatEnemy(o, 200, 'shell');
          }
        }
      }
    }

    // items
    for (const it of this.items) if (!it.remove) it.update(dt, this);
    for (const it of this.items){
      if (!it.remove && aabb(it.pickupBox(), p)) this.collectItem(it);
    }

    // projectiles
    if (!this.inBonus){
      for (const s of this.shots) if (!s.remove) s.update(dt, this);
      for (const s of this.shots){
        if (s.remove) continue;
        for (const e of this.enemies){
          if (e.dead || e.remove) continue;
          const b = e.box();
          if (!b.active) continue;
          if (circleRect(s, b)){ this.hitShot(s, e); break; }
        }
      }
      // player vs enemies
      for (const e of this.enemies){
        if (e.dead || e.remove) continue;
        const b = e.box();
        if (!b.active) continue;
        if (aabb(p, b)) this.playerVsEnemy(e, b);
      }
    }

    // Block rewards are already credited; animate and expire their visual pops.
    for (const pop of this.pops) if (!pop.remove) pop.update(dt);

    // cleanup
    this.compact(this.enemies);
    this.compact(this.items);
    this.compact(this.shots);
    this.compact(this.pops);

    this.particles.update(dt);
    this.updateTexts(dt);

    // block bump timers
    const lv = this.level;
    for (const [k, v] of lv.bumps){
      const nv = v - dt;
      if (nv <= 0) lv.bumps.delete(k);
      else lv.bumps.set(k, nv);
    }

    this.updateCamera(dt);
    if (this.shakeT > 0) this.shakeT -= dt;
  },
  tickClearing(dt){
    const p = this.player;
    this.clearT += dt;
    p.walkT += dt * 2;
    if (this.clearPhase === 0){
      p.x = FLAG_TX*TILE - 22;
      p.y += 340*dt;
      p.vy = 0;
      if (p.y >= 10*TILE - p.h){
        p.y = 10*TILE - p.h;
        this.clearPhase = 1;
      }
    } else if (this.clearPhase === 1){
      p.vx = 240;
      p.vy = Math.min(p.vy + PHYS.GRAV*dt, PHYS.MAX_FALL);
      p.prevBottom = p.y + p.h;
      moveAndCollide(this.level, p, dt);
      const tx0 = Math.floor(p.x/TILE), tx1 = Math.floor((p.x+p.w-1)/TILE);
      const ty0 = Math.floor(p.y/TILE), ty1 = Math.floor((p.y+p.h-1)/TILE);
      let hit = false;
      for (let ty = ty0; ty <= ty1 && !hit; ty++){
        for (let tx = tx0; tx <= tx1; tx++){
          if (this.level.get(tx, ty) === T.END_DOOR){ hit = true; break; }
        }
      }
      if ((hit || p.x > 163*TILE) && !this.fade){
        this.startFade(() => this.finishClear());
      }
    }
    this.updateCamera(dt);
    this.particles.update(dt);
    this.updateTexts(dt);
    if (this.fade) this.updateFade(dt);
    if (this.shakeT > 0) this.shakeT -= dt;
  },

  collectItem(it){
    if (it.remove) return; // A captured item can only award its reward once.
    it.remove = true;
    const p = this.player;
    switch (it.type){
      case 'gem':
        this.score += 200; this.gems++;
        AudioSys.sfx.coin();
        this.particles.coinFx(it.x + 13, it.y + 13);
        this.addText(it.x + 13, it.y - 4, '200', '#7ef0ff', 14);
        break;
      case 'grow':
        if (p.form === 'small'){
          p.setForm('big');
          this.addText(it.x + 13, it.y - 4, 'GROW!', '#9fe870');
        } else {
          this.score += 1000;
          this.addText(it.x + 13, it.y - 4, '1000', '#ffd23e');
        }
        AudioSys.sfx.powerGet();
        vib(15);
        break;
      case 'shoot':
        if (p.form !== 'shoot') p.setForm('shoot');
        else {
          this.score += 1000;
          this.addText(it.x + 13, it.y - 4, '1000', '#ffd23e');
        }
        this.addText(it.x + 13, it.y - 22, 'B SHOTS!', '#ff9dd5', 14);
        AudioSys.sfx.powerGet();
        vib(15);
        break;
      case 'star':
        p.invT = STAR_TIME;
        p.invLastSec = -1;
        AudioSys.sfx.powerGet();
        this.addText(it.x + 13, it.y - 4, 'NOVA!', '#ffe14d');
        vib(15);
        break;
      case 'life':
        this.lives = Math.min(MAX_LIVES, this.lives + 1);
        AudioSys.sfx.life();
        this.addText(it.x + 13, it.y - 4, '1UP', '#ff8fa0');
        vib(20);
        break;
    }
  },
};

// ---------------- canvas sizing (DPR capped at 2, letterboxed) ----------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let dpr = 1, degraded = false;
let lastT = 0, acc = 0, gameT = 0, needRender = true;

function resizeCanvas(){
  const vv = (typeof window !== 'undefined' && window.visualViewport) ? window.visualViewport : null;
  const cw = vv ? vv.width : window.innerWidth;
  const ch = vv ? vv.height : window.innerHeight;
  const scale = Math.min(cw/VIEW_W, ch/VIEW_H);
  canvas.style.width = Math.floor(VIEW_W*scale) + 'px';
  canvas.style.height = Math.floor(VIEW_H*scale) + 'px';
}
function setupCanvas(){
  dpr = Settings.quality === 'high' ? 2 : 1;
  if (degraded) dpr = 1;
  canvas.width = VIEW_W * dpr;
  canvas.height = VIEW_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  resizeCanvas();
  needRender = true;
}

// sustained low FPS -> drop DPR once to 1 (battery/perf rescue)
let fpsAcc = 0, fpsN = 0, fpsBad = 0;
function setQuality(value){
  Settings.quality = value === 'standard' ? 'standard' : 'high';
  Store.set('quality', Settings.quality);
  degraded = false;
  fpsAcc = fpsN = fpsBad = 0;
  setupCanvas();
  updateToggles();
}
function fpsMonitor(dt){
  fpsAcc += dt;
  fpsN++;
  if (fpsN >= 90){
    const avg = fpsAcc/fpsN;
    fpsAcc = 0; fpsN = 0;
    if (avg > 1/47) fpsBad++;
    else fpsBad = 0;
    if (fpsBad >= 3 && !degraded){
      degraded = true;
      dpr = 1;
      setupCanvas();
      fpsBad = 0;
    }
  }
}

// ---------------- rendering ----------------
function tileImage(c, tx, ty){
  const lv = Game.level;
  if (c === T.GROUND){
    const above = lv.get(tx, ty-1);
    return (above === T.GROUND || above === T.DIRT) ? ASSETS.tiles[T.DIRT] : ASSETS.tiles[T.GROUND];
  }
  if (QCODES.has(c)) return ASSETS.tiles.qframes[((gameT*3)|0) % 2];
  if (c === T.FLAG){
    if (lv.get(tx, ty-1) !== T.FLAG) return ASSETS.tiles.flagTop;
    if (lv.get(tx, ty+1) !== T.FLAG) return ASSETS.tiles.flagBase;
    return ASSETS.tiles.flagMid;
  }
  if (c === T.CHECK){
    if (lv.get(tx, ty-1) !== T.CHECK) return ASSETS.tiles.checkTop;
    if (lv.get(tx, ty+1) !== T.CHECK) return ASSETS.tiles.checkBase;
    return ASSETS.tiles.flagMid;
  }
  if (c === T.END_DOOR) return lv.get(tx,ty-1) === T.END_DOOR ? ASSETS.tiles.endDoorBottom : ASSETS.tiles.endDoorTop;
  if (c === T.BUILD) return ((tx*7 + ty*13) % 3 === 0) ? ASSETS.tiles.build1 : ASSETS.tiles.build0;
  return ASSETS.tiles[c] || null;
}

function drawStrip(img, y, par, camX){
  const w = img.width;
  let off = -mod(camX*par, w);
  for (let sx = off; sx < VIEW_W; sx += w){
    ctx.drawImage(img, Math.round(sx), y);
  }
}

function drawScene(camX, camY){
  const G = Game;
  ctx.drawImage(ASSETS.bg.sky, 0, 0);
  for (const cl of ASSETS.bg.clouds){
    const sx = mod(cl.x - camX*0.25, VIEW_W + 260) - 130;
    ctx.drawImage(cl.img, Math.round(sx), cl.y);
  }
  drawStrip(ASSETS.bg.far, 248, 0.15, camX);
  drawStrip(ASSETS.bg.near, 336, 0.42, camX);

  const lv = G.level;
  const x0 = Math.floor(camX/TILE) - 1;
  const x1 = x0 + Math.ceil(VIEW_W/TILE) + 3;
  for (let ty = 0; ty < lv.h; ty++){
    const oy = Math.round(ty*TILE - camY);
    if (oy > VIEW_H || oy + TILE < 0) continue;
    for (let tx = x0; tx <= x1; tx++){
      const c = lv.get(tx, ty);
      if (!c) continue;
      const img = tileImage(c, tx, ty);
      if (!img) continue;
      let yy = oy;
      const k = tx*100 + ty;
      if (lv.bumps.has(k)) yy += lv.bumpOff(k);
      ctx.drawImage(img, Math.round(tx*TILE - camX), yy);
    }
  }

  // items
  for (const it of G.items){
    if (it.remove) continue;
    if (it.x < camX - 60 || it.x > camX + VIEW_W + 60) continue;
    let img;
    switch (it.type){
      case 'gem': img = ASSETS.items.gem; break;
      case 'grow': img = ASSETS.items.grow; break;
      case 'shoot': img = ASSETS.items.shoot; break;
      case 'star': img = ASSETS.items.star; break;
      default: img = ASSETS.items.life; break;
    }
    const y = it.pickupBox().y;
    ctx.drawImage(img, Math.round(it.x - camX + (it.w-30)/2), Math.round(y - camY + (it.h-30)/2));
  }

  // coin pops
  for (const pp of G.pops){
    if (pp.remove) continue;
    ctx.globalAlpha = 1 - pp.t/pp.life;
    ctx.drawImage(ASSETS.items.gem, Math.round(pp.x - camX - 13), Math.round(pp.y - camY - 13));
    ctx.globalAlpha = 1;
  }

  // enemies
  for (const e of G.enemies){
    if (e.remove) continue;
    if (e.x < camX - 80 || e.x > camX + VIEW_W + 80) continue;
    if (e.dead && e.kind === 'plant') continue;   // plants pop, no corpse
    drawEnemy(e, camX, camY);
  }

  drawPlayer(camX, camY);

  // projectiles
  for (const s of G.shots){
    if (s.remove) continue;
    const sx = Math.round(s.x - camX), sy = Math.round(s.y - camY);
    ctx.fillStyle = '#ff9d47';
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(sx-1, sy-2, 3, 0, 6.2832); ctx.fill();
  }

  G.particles.draw(ctx, camX, camY);

  // floating score texts
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of G.texts){
    const a = 1 - t.t/t.life;
    ctx.globalAlpha = a;
    ctx.font = '800 ' + t.size + 'px "Courier New", monospace';
    ctx.fillStyle = '#12233a';
    ctx.fillText(t.txt, Math.round(t.x - camX) + 1, Math.round(t.y - camY) + 1);
    ctx.fillStyle = t.col;
    ctx.fillText(t.txt, Math.round(t.x - camX), Math.round(t.y - camY));
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawWalker(e, x, y){
  const ph = Math.sin(e.walkT*10) > 0;
  ctx.fillStyle = '#4a2d18';
  ctx.fillRect(x + 3 + (ph?2:0), y + 30, 11, 4);
  ctx.fillRect(x + 20 + (ph?0:2), y + 30, 11, 4);
  ctx.fillStyle = '#9c6b4a';
  ctx.fillRect(x + 2, y + 10, 30, 20);
  ctx.fillRect(x + 5, y + 5, 24, 8);
  ctx.fillRect(x, y + 16, 34, 10);
  ctx.fillStyle = '#c99a6b';
  ctx.fillRect(x + 8, y + 18, 18, 8);
  ctx.fillStyle = '#e8564a';
  ctx.fillRect(x + 7, y + 8, 8, 3);
  ctx.fillRect(x + 19, y + 8, 8, 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 8, y + 11, 6, 5);
  ctx.fillRect(x + 20, y + 11, 6, 5);
  ctx.fillStyle = '#222';
  const px = e.dir > 0 ? 2 : 0;
  ctx.fillRect(x + 8 + px, y + 13, 3, 3);
  ctx.fillRect(x + 20 + px, y + 13, 3, 3);
}

function drawShell(e, x, y){
  if (e.state === 'idle'){
    ctx.fillStyle = '#2e8f43';
    ctx.fillRect(x, y + 10, 36, 16);
    ctx.fillStyle = '#59c96a';
    ctx.beginPath(); ctx.arc(x + 18, y + 18, 17, Math.PI, 0); ctx.fill();
    ctx.fillRect(x + 1, y + 18, 34, 6);
    ctx.fillStyle = '#8fe09a';
    ctx.fillRect(x + 8, y + 8, 8, 5);
    ctx.fillStyle = '#2e8f43';
    ctx.fillRect(x, y + 26, 36, 4);
  } else {
    const ph = Math.sin(e.walkT*10) > 0;
    ctx.fillStyle = '#4a2d18';
    ctx.fillRect(x + 3 + (ph?2:0), y + 26, 10, 4);
    ctx.fillRect(x + 23 + (ph?0:2), y + 26, 10, 4);
    ctx.fillStyle = '#2e8f43';
    ctx.fillRect(x + 1, y + 14, 34, 12);
    ctx.fillStyle = '#59c96a';
    ctx.beginPath(); ctx.arc(x + 18, y + 20, 17, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#8fe09a';
    ctx.fillRect(x + 8, y + 6, 8, 5);
    ctx.fillStyle = '#2e8f43';
    ctx.fillRect(x + 2, y + 24, 32, 4);
    ctx.fillStyle = '#ffe9c9';
    ctx.fillRect(x + (e.dir > 0 ? 22 : 4), y + 8, 10, 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + (e.dir > 0 ? 26 : 8), y + 10, 2, 3);
  }
}

function drawPlant(e, camX, camY){
  const r = e.rise;
  if (r <= 0.02) return;
  const cx = Math.round(e.x + e.w/2 - camX);
  const by = Math.round(e.baseY - camY);
  const stemH = 6 + r*22;
  ctx.fillStyle = '#2e8f43';
  ctx.fillRect(cx - 6, by - stemH, 12, stemH + 2);
  ctx.fillStyle = '#59c96a';
  ctx.fillRect(cx - 6, by - stemH, 4, stemH + 2);
  const hy = by - stemH - 8;
  ctx.fillStyle = '#e85a7d';
  ctx.beginPath(); ctx.arc(cx, hy, 12, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#ff7d9c';
  ctx.beginPath(); ctx.arc(cx, hy, 9, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#e85a7d';
  for (let i = -2; i <= 2; i++){
    ctx.beginPath();
    ctx.moveTo(cx + i*5 - 2, hy - 8);
    ctx.lineTo(cx + i*5, hy - 14 - Math.abs(i));
    ctx.lineTo(cx + i*5 + 2, hy - 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(cx - 6, hy - 3, 4, 5);
  ctx.fillRect(cx + 2, hy - 3, 4, 5);
  ctx.fillStyle = '#222';
  ctx.fillRect(cx - 5, hy - 1, 2, 3);
  ctx.fillRect(cx + 3, hy - 1, 2, 3);
}

function drawEnemy(e, camX, camY){
  const x = Math.round(e.x - camX), y = Math.round(e.y - camY);
  const kind = (xx, yy) => {
    if (e.kind === 'walker') drawWalker(e, xx, yy);
    else if (e.kind === 'shell') drawShell(e, xx, yy);
    else drawPlant(e, camX, camY);
  };
  if (e.dead){
    const cxp = x + e.w/2, cyp = y + e.h/2;
    ctx.save();
    ctx.translate(cxp, cyp);
    ctx.rotate(Math.min(1, e.deadT/0.6) * Math.PI);
    kind(-e.w/2, -e.h/2);
    ctx.restore();
  } else {
    kind(x, y);
  }
}

function drawPlayer(camX, camY){
  const G = Game, p = G.player;
  const big = p.form !== 'small';
  const set = ASSETS.pip[big ? 'big' : 'small'];
  let name;
  if (p.dead) name = 'dead';
  else if (G.state === 'CLEARING') name = 'victory';
  else if (p.crouching) name = gameT % 3.5 > 3.25 ? 'crouch1' : 'crouch';
  else if (!p.onGround) name = p.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(p.vx) > 250) name = 'run' + (((p.walkT*12)|0) % 4);
  else if (Math.abs(p.vx) > 25) name = 'walk' + (((p.walkT*7)|0) % 4);
  else name = gameT % 4 > 3.8 ? 'blink' : ((((gameT*1.8)|0) % 2 === 0) ? 'idle0' : 'idle1');
  let img = set[name] || set.idle0;
  if (p.invT > 0 && ((gameT*12)|0) % 2 === 0) img = set['g' + name] || img;
  const blink = (p.hurtT > 0 && ((gameT*16)|0) % 2 === 0) || (p.morphT > 0 && ((gameT*20)|0) % 2 === 0);
  if (blink) return;
  const sw = img.width, sh = img.height;
  const sx = Math.round(p.x + (p.w - sw)/2 - camX);
  const sy = Math.round(p.y + (p.h - sh) - camY);
  if (p.dead){
    const pr = 1 - clamp(G.deathT/1.6, 0, 1);
    ctx.save();
    ctx.translate(sx + sw/2, sy + sh/2);
    ctx.rotate(pr * Math.PI);
    ctx.drawImage(img, -sw/2, -sh/2);
    ctx.restore();
    return;
  }
  if (p.facing < 0){
    ctx.save();
    ctx.translate(sx + sw/2, sy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -sw/2, 0);
    ctx.restore();
  } else {
    ctx.drawImage(img, sx, sy);
  }
}

function hudLabel(txt, x, y){
  ctx.font = '700 12px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(10,20,40,.75)';
  ctx.fillText(txt, x + 1, y + 1);
  ctx.fillStyle = '#dce8ff';
  ctx.fillText(txt, x, y);
}
function hudValue(txt, x, y, col){
  ctx.font = '800 22px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(10,20,40,.8)';
  ctx.fillText(txt, x + 1, y + 2);
  ctx.fillStyle = col || '#ffffff';
  ctx.fillText(txt, x, y);
}

function drawHUD(){
  const G = Game;
  hudLabel('SCORE', 20, 8);
  hudValue(pad6(G.score), 20, 22);
  ctx.drawImage(ASSETS.items.gem, 150, 22);
  hudValue('x' + G.gems, 184, 22);
  hudLabel('LIVES', 520, 8);
  hudValue('x' + G.lives, 520, 22);
  hudLabel('TIME', 660, 8);
  const t = Math.ceil(G.timeLeft);
  const low = t <= 60;
  const blink = t <= 30 && ((gameT*2)|0) % 2 === 0;
  hudValue(String(t).padStart(3, '0'), 660, 22, (low && !blink) ? '#ff6a5e' : (low ? '#ffb3a8' : '#ffffff'));

  // level name + power state
  ctx.font = '700 14px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(10,20,40,.75)';
  const name = (G.inBonus ? 'SECRET ROOM' : LEVEL_NAME);
  ctx.fillText(name, 21, 57);
  ctx.fillStyle = '#bcd0f5';
  ctx.fillText(name, 20, 56);

  const p = G.player;
  const state = p.invT > 0 ? 'star' : (p.form === 'shoot' ? 'shoot' : (p.form === 'big' ? 'big' : 'small'));
  const labels = { small:'S', big:'G', shoot:'P', star:'*' };
  const cols = { small:'#9fb4dd', big:'#9fe870', shoot:'#ff9dd5', star:'#ffe14d' };
  ctx.fillStyle = 'rgba(10,20,40,.6)';
  ctx.fillRect(148, 52, 34, 26);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.strokeRect(148.5, 52.5, 33, 25);
  ctx.font = '800 18px "Courier New", monospace';
  ctx.fillStyle = cols[state];
  ctx.fillText(labels[state], 156, 55);
  if (p.invT > 0){
    ctx.fillStyle = cols.star;
    ctx.font = '800 16px "Courier New", monospace';
    ctx.fillText(Math.ceil(p.invT) + 's', 188, 56);
  }
}

function drawReady(){
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '900 46px "Courier New", monospace';
  ctx.fillStyle = 'rgba(10,20,40,.8)';
  ctx.fillText(LEVEL_NAME, 481, 196);
  ctx.fillStyle = '#ffe14d';
  ctx.fillText(LEVEL_NAME, 480, 194);
  ctx.font = '800 26px "Courier New", monospace';
  ctx.globalAlpha = 0.6 + 0.4*Math.sin(gameT*6);
  ctx.fillStyle = '#fff';
  ctx.fillText('GET READY!', 480, 262);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function render(){
  const G = Game;
  let camX = G.cam.x, camY = G.cam.y;
  if (G.shakeT > 0 && !Settings.effectsReduced){
    const m = G.shakeMag * (G.shakeT / G.shakeDur);
    camX += (Math.random()*2 - 1) * m;
    camY += (Math.random()*2 - 1) * m;
  }
  camX = Math.round(camX);
  camY = Math.round(camY);
  drawScene(camX, camY);
  if (G.state === 'READY') drawReady();
  if (G.state === 'PLAYING' || G.state === 'READY' || G.state === 'DYING' ||
      G.state === 'CLEARING' || G.state === 'CLEAR') drawHUD();
  if (G.fade){
    ctx.fillStyle = '#000';
    ctx.globalAlpha = clamp(G.fade.dir === 1 ? G.fade.t : 1 - G.fade.t, 0, 1);
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = 1;
  }
}

// ---------------- main loop (fixed timestep, spiral-of-death guard) ----------------
function frame(now){
  requestAnimationFrame(frame);
  let dt = (now - lastT)/1000;
  lastT = now;
  if (dt > MAX_ACC) dt = MAX_ACC;
  fpsMonitor(dt);
  const active = (Game.state === 'PLAYING' || Game.state === 'READY' || Game.state === 'DYING' ||
                  Game.state === 'CLEARING' || Game.state === 'TITLE' || Game.state === 'CLEAR');
  if (active){
    gameT += dt;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS){
      Game.tick(STEP);
      acc -= STEP;
      n++;
    }
    if (n === MAX_STEPS) acc = 0;   // discard backlog instead of spiraling
    needRender = true;
  } else {
    acc = 0;
  }
  if (needRender){
    render();
    needRender = false;
  }
}

// ---------------- UI wiring ----------------
function on(id, fn){
  $(id).addEventListener('click', (e) => {
    try { e.preventDefault(); } catch(_){ /* ignore */ }
    AudioSys.unlock();
    fn();
  });
}

function updateToggles(){
  $('tg-sound').textContent = Settings.sound ? 'ON' : 'OFF';
  $('tg-sound').classList.toggle('on', Settings.sound);
  $('tg-vib').textContent = Settings.vibrate ? 'ON' : 'OFF';
  $('tg-vib').classList.toggle('on', Settings.vibrate);
  $('tg-reduced').textContent = Settings.reduced ? 'ON' : 'OFF';
  $('tg-reduced').classList.toggle('on', Settings.reduced);
  $('sel-quality').value = Settings.quality;
  updateKeyboardUI();
  $('rg-op').value = Math.round(Settings.opacity*100);
  $('sb-sound').classList.toggle('off', !Settings.sound);
  $('btn-snd-t').classList.toggle('off', !Settings.sound);
}

function toggleMute(){
  Settings.sound = !Settings.sound;
  Store.set('sound', Settings.sound);
  AudioSys.applyMute();
  updateToggles();
  if (Settings.sound) AudioSys.sfx.pause();
}

function toggleFS(){
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen){
    el.requestFullscreen().then(() => {
      // attempt landscape lock only inside a user-gesture chain; fail gracefully
      try {
        if (screen.orientation && screen.orientation.lock){
          screen.orientation.lock('landscape').catch(() => {});
        }
      } catch(_){ /* unsupported */ }
      resizeCanvas();
    }).catch(() => {});
  } else if (document.exitFullscreen){
    document.exitFullscreen().catch(() => {});
  }
  resizeCanvas();
}

function doPause(){
  if (Game.state !== 'PLAYING') return;
  Game.state = 'PAUSED';
  Game.inputClear();
  AudioSys.stopMusic();
  AudioSys.sfx.pause();
  showOv('ov-pause');
  needRender = true;
}
function doResume(){
  Keyboard.cancelCapture();
  if (Game.state !== 'PAUSED') return;
  hideOv('ov-pause');
  hideOv('ov-set');
  Game.state = 'PLAYING';
  Game.inputClear();
  AudioSys.unlock();
  AudioSys.startMusic();
  needRender = true;
}
function togglePause(){
  if (Game.state === 'PLAYING') doPause();
  else if (Game.state === 'PAUSED') doResume();
}

function wireUI(){
  on('btn-start', () => {
    if (!Store.get('seenTut', false)) showOv('ov-tut');
    else Game.startGame();
  });
  on('btn-how', () => showOv('ov-tut'));
  on('btn-tut-go', () => {
    Store.set('seenTut', true);
    Game.startGame();
  });
  on('btn-fs-t', toggleFS);
  on('btn-snd-t', toggleMute);
  on('sb-pause', togglePause);
  on('sb-sound', toggleMute);
  on('sb-fs', toggleFS);
  on('btn-resume', doResume);
  on('btn-restart', () => {
    hideOv('ov-pause');
    hideOv('ov-set');
    Game.restartLevel();
    AudioSys.startMusic();
  });
  on('btn-settings', () => { updateToggles(); showOv('ov-set'); });
  $('sel-quality').addEventListener('change', e => setQuality(e.target.value));
  $('sel-controls').addEventListener('change', e => Keyboard.setMode(e.target.value));
  for (const action of Object.keys(Keyboard.defaults)){
    on('key-'+action, () => Keyboard.beginCapture(action));
  }
  on('btn-reset-keys', () => Keyboard.reset());
  on('btn-to-title', () => Game.toTitle());
  on('btn-set-back', () => {
    Keyboard.cancelCapture();
    hideOv('ov-set');
    showOv('ov-pause');
  });
  on('tg-sound', toggleMute);
  on('tg-vib', () => {
    Settings.vibrate = !Settings.vibrate;
    Store.set('vibrate', Settings.vibrate);
    updateToggles();
    vib(15);
  });
  on('tg-reduced', () => {
    Settings.reduced = !Settings.effectsReduced;
    Store.set('reduced', Settings.reduced);
    updateToggles();
  });
  $('rg-op').addEventListener('input', (e) => {
    Settings.opacity = clamp(parseInt(e.target.value, 10) || 85, 20, 100)/100;
    Store.set('opacity', Settings.opacity);
    Settings.apply();
  });
  on('btn-retry', () => Game.startGame());
  on('btn-over-title', () => Game.toTitle());
  on('btn-again', () => Game.startGame());
  on('btn-clear-title', () => Game.toTitle());
  updateToggles();
  Settings.apply();
}

const KEYMAP = {
  arrowleft:'left', a:'left',
  arrowright:'right', d:'right',
  arrowdown:'down', s:'down',
  ' ':'jump', arrowup:'jump', w:'jump', z:'jump',
  shift:'action', x:'action',
};
const Keyboard = {
  defaults: { left:'a', right:'d', down:'s', jump:' ', action:'shift' },
  mode: Store.get('keyboardMode', 'default') === 'custom' ? 'custom' : 'default',
  bindings: {}, capture: null,
  validKey(key){
    return typeof key === 'string' && !['p','m','f'].includes(key) &&
      (/^[a-z0-9]$/.test(key) || ['arrowleft','arrowright','arrowup','arrowdown',' ','shift'].includes(key));
  },
  load(saved){
    const keys = Object.keys(this.defaults);
    this.bindings = { ...this.defaults };
    if (saved && keys.every(a => this.validKey(saved[a])) && new Set(keys.map(a => saved[a])).size === keys.length){
      for (const a of keys) this.bindings[a] = saved[a];
    }
  },
  resolve(key){
    return this.mode === 'default' ? KEYMAP[key] : Object.keys(this.bindings).find(a => this.bindings[a] === key);
  },
  save(){ Store.set('keyboardMode', this.mode); Store.set('keyBindings', this.bindings); },
  setMode(mode){
    this.mode = mode === 'custom' ? 'custom' : 'default';
    this.cancelCapture(); Input.clearAll(); this.save(); updateKeyboardUI();
  },
  beginCapture(action){
    if (this.mode !== 'custom' || !Object.hasOwn(this.defaults, action)) return;
    this.capture = action; Input.clearAll(); updateKeyboardUI();
    $('key-status').textContent = 'Press a key for '+action+'. Esc cancels. P, M and F are reserved.';
  },
  cancelCapture(){ this.capture = null; updateKeyboardUI(); },
  assign(key){
    const action = this.capture;
    if (!action) return false;
    if (!this.validKey(key)){
      $('key-status').textContent = 'Use a letter, number, arrow, Space or Shift. P, M and F are reserved. Esc cancels.';
      return false;
    }
    const other = Object.keys(this.bindings).find(a => a !== action && this.bindings[a] === key);
    if (other){ $('key-status').textContent = keyLabel(key)+' is already assigned to '+other+'. Choose another key.'; return false; }
    this.bindings[action] = key; this.capture = null; this.save(); updateKeyboardUI();
    $('key-status').textContent = 'Saved: '+action+' → '+keyLabel(key)+'.';
    return true;
  },
  reset(){ this.bindings = { ...this.defaults }; this.capture = null; Input.clearAll(); this.save(); updateKeyboardUI(); },
};
Keyboard.load(Store.get('keyBindings', null));
function keyLabel(key){
  return ({' ':'Space',arrowleft:'←',arrowright:'→',arrowup:'↑',arrowdown:'↓',shift:'Shift'})[key] || key.toUpperCase();
}
function updateKeyboardUI(){
  $('sel-controls').value = Keyboard.mode;
  $('custom-keys').hidden = Keyboard.mode !== 'custom';
  $('default-keys').hidden = Keyboard.mode !== 'default';
  for (const action of Object.keys(Keyboard.defaults)){
    const button = $('key-'+action);
    button.textContent = Keyboard.capture === action ? 'Press key…' : keyLabel(Keyboard.bindings[action]);
    button.classList.toggle('listening', Keyboard.capture === action);
  }
  $('key-status').textContent = 'P / Esc: pause · M: sound · F: fullscreen. Settings are saved on this device.';
}
function keyboardDown(e){
  const k = e.key.toLowerCase();
  if (Keyboard.capture){
    e.preventDefault();
    if (e.repeat) return;
    if (k === 'escape') Keyboard.cancelCapture();
    else if (!e.ctrlKey && !e.altKey && !e.metaKey) Keyboard.assign(k);
    return;
  }
  // Native settings controls and browser shortcuts must not trigger game actions.
  if (e.ctrlKey || e.altKey || e.metaKey || (e.target &&
      (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable))) return;
  if (e.target && e.target.tagName === 'BUTTON' && Game.state !== 'PLAYING' && (k === ' ' || k === 'enter')) return;
  if (k === 'm'){ if (!e.repeat) toggleMute(); e.preventDefault(); return; }
  if (k === 'f'){ if (!e.repeat) toggleFS(); e.preventDefault(); return; }
  if (k === 'p' || k === 'escape'){ if (!e.repeat) togglePause(); e.preventDefault(); return; }
  if (Game.state === 'TITLE' && (k === 'enter' || k === ' ')){
    if (!Store.get('seenTut', false)) showOv('ov-tut');
    else Game.startGame();
    e.preventDefault(); return;
  }
  const key = Keyboard.resolve(k);
  if (!key || Game.state !== 'PLAYING') return;
  e.preventDefault();
  if (e.repeat) return;
  AudioSys.unlock(); Input.press(key);
  if (key === 'jump' || key === 'action') Input.queue(key);
}
function keyboardUp(e){
  const key = Keyboard.resolve(e.key.toLowerCase());
  if (key) Input.release(key);
}
function wireKeys(){
  window.addEventListener('keydown', keyboardDown);
  window.addEventListener('keyup', keyboardUp);
}

function wireGlobal(){
  // block scrolling / zooming / long-press menus, but allow scrolling inside .panel
  document.addEventListener('touchmove', (e) => {
    // Allow touch scroll inside overlay panels (How to Play, etc.)
    const t = e.target;
    if (t && t.closest && t.closest('.panel')) return;
    e.preventDefault();
  }, { passive:false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => {
    // Allow context menu inside panels for accessibility, block elsewhere
    const t = e.target;
    if (t && t.closest && t.closest('.panel')) return;
    e.preventDefault();
  });
  window.addEventListener('dblclick', (e) => e.preventDefault());
  // unlock audio on the first user interaction anywhere
  document.addEventListener('pointerdown', () => AudioSys.unlock());
  // auto-pause when the page is hidden; resume only via user action
  document.addEventListener('visibilitychange', () => {
    if (document.hidden){
      Input.clearAll();
      TouchUI.resetVisuals();
      AudioSys.suspend();
      if (Game.state === 'PLAYING' || Game.state === 'READY') doPause();
    }
  });
  window.addEventListener('blur', () => {
    Input.clearAll();
    TouchUI.resetVisuals();
    if (Game.state === 'PLAYING') doPause();
  });
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCanvas);
  document.addEventListener('fullscreenchange', resizeCanvas);
}

// ---------------- boot ----------------
(function boot(){
  try {
    buildAssets();
    Game.init();
  } catch (err){
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:#070b16;z-index:99;font:16px sans-serif';
    d.textContent = 'Failed to start Gem Dash.';
    document.body.appendChild(d);
  }
})();

</script>
</body>
</html>
