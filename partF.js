// ---------------- game state machine ----------------
const Game = {
  state: 'BOOT',                       // TITLE READY PLAYING PAUSED DYING CLEARING CLEAR GAMEOVER
  score: 0, gems: 0, lives: 3, timeLeft: LEVEL_TIME,
  high: Store.get('high', 0),
  stage: 1,
  progress: loadCampaignProgress(Store.get('campaign',null),Store.get('stage2Unlocked',false) === true),
  get stage2Unlocked(){ return this.progress.unlocked >= 2; },
  gateHintT: 0,
  get course(){ return COURSES[this.stage-1]; },
  level: null, mainLevel: null, bonusLevel: null, inBonus: false,
  player: null,
  enemies: [], items: [], shots: [], pops: [], enemyShots: [],
  pendingEnemies: [], texts: [],
  secretsFound: 0, secretTotal: 0,
  cam: { x: 0, y: 0 },
  shakeT: 0, shakeMag: 0, shakeDur: 1,
  checkX: START_TX,
  readyT: 0, deathT: 0, pausedFrom: null,
  clearPhase: 0, clearT: 0, flagScore: 0, timeBonus: 0,
  multiQ: 0, multiT: 0, lastMultiX: 0, lastMultiY: 0,
  particles: null,   // assigned in init()
  stompChain: 0, chainT: 0, trailT: 0,
  bonusLockT: 0,
  hintT: 0,
  fade: null,
  mainItems: [],

  init(){
    Particles.init();
    this.particles = Particles;
    this.level = new Level(this.course.rows, false);
    this.mainLevel = this.level;
    this.bonusLevel = new Level(BONUS_ROWS, true);
    this.player = new Player(this);
    this.player.reset(START_TX, 'small', GROUND_ROW);
    this.spawnEntities();
    this.state = 'TITLE';
    this.cam.x = 30; this.cam.y = 0;
    updateStageUI();
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
    this.enemyShots.length = 0;
    for (const s of this.course.enemies){
      if (s[0] === 'walker') this.enemies.push(new Enemy('walker', s[1]*TILE + 7, GROUND_ROW*TILE - 34));
      else if (s[0] === 'shell') this.enemies.push(new Enemy('shell', s[1]*TILE + 6, GROUND_ROW*TILE - 30));
      else if (s[0] === 'plant') this.enemies.push(new Enemy('plant', (s[1]+1)*TILE - 15, s[2]*TILE));
      else {
        const enemy=new Enemy(s[0],s[1]*TILE,(s[2]||GROUND_ROW)*TILE);
        enemy.x += (TILE-enemy.w)/2; enemy.y -= enemy.h; enemy.baseY=enemy.y;
        if(enemy.kind==='guardian'){
          // Three distinct bosses: Copper Sentry, Obsidian Warden, Crown King.
          enemy.boss = Math.round(this.stage/5);
          enemy.hp = enemy.maxHp = [0,4,6,8][enemy.boss] || 4;
        } else if (enemy.kind === 'turret'){
          // Turrets are armour-plated mini-bosses: tougher on the last two tiers.
          enemy.hp = enemy.maxHp = this.stage >= 12 ? 3 : 2;
        }
        this.enemies.push(enemy);
      }
      const enemy=this.enemies[this.enemies.length-1];
      if (s[3] !== undefined){
        enemy.patrolMin=s[3]*TILE; enemy.patrolMax=(s[4]+1)*TILE; enemy.boundedPatrol=true;
      }
      if (s[5] === 'lurk') enemy.lurk = true;
      if (this.course.speedScale && enemy.speed) enemy.speed *= this.course.speedScale;
      if (this.course.speedScale && enemy.dashSpeed) enemy.dashSpeed *= this.course.speedScale;
    }
    // Deterministic opening patrols: every course faces the same way on every
    // attempt, and idle/plant timing is seeded instead of rolled, so retries are
    // learnable rather than replaying a different encounter.
    this.enemies.forEach((enemy, i) => {
      enemy.dir = -1;
      enemy.walkT = shash(this.stage, i, 11) * 10;
      enemy.phaseT = 1 + shash(this.stage, i, 13);
    });
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
  startGame(stage = 1, carry = false){
    const form = carry && this.player ? this.player.form : 'small';
    this.stage = Number.isInteger(stage) ? clamp(stage,1,TOTAL_STAGES) : 1;
    AudioSys.unlock();
    hideAllOverlays();
    document.body.classList.add('in-game');
    document.body.classList.remove('ended');
    if (!carry){ this.score = 0; this.gems = 0; this.lives = 3; }
    this.checkX = START_TX;
    this.gateHintT = 0;
    this.mainLevel = new Level(this.course.rows, false);
    this.level = this.mainLevel;
    this.inBonus = false;
    this.bonusLevel = new Level(BONUS_ROWS, true);
    this.mainItems = [];
    this.pendingEnemies.length = 0;
    this.hintT = 0;
    this.bonusLockT = 0;
    this.shakeT = 0;
    this.secretsFound = 0;
    this.secretTotal = this.mainLevel.hiddenCount + this.mainLevel.vaultCount;
    this.timeLeft = this.course.time;
    this.multiQ = 0;
    this.stompChain = 0; this.chainT = 0;
    this.player = new Player(this);
    this.player.reset(START_TX, form, GROUND_ROW);
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
    this.mainLevel = new Level(this.course.rows, false);
    this.level = this.mainLevel;
    this.inBonus = false;
    this.mainItems = [];
    this.pendingEnemies.length = 0;
    this.hintT = 0;
    this.bonusLockT = 0;
    this.timeLeft = this.course.time;
    this.multiQ = 0;
    this.multiT = 0;
    this.secretsFound = 0;
    this.secretTotal = this.mainLevel.hiddenCount + this.mainLevel.vaultCount;
    this.gateHintT = 0;
    this.stompChain = 0; this.chainT = 0;
    this.shakeT = 0;
    // Dying always costs your power: you resume small at the checkpoint.
    this.player.reset(this.checkX, 'small', GROUND_ROW);
    if (this.stage>=3) this.player.hurtT=1.5; // Safe checkpoint recovery, not a free attack boost.
    this.spawnEntities();
    this.cam.x = clamp(this.player.x - 320, 0, this.level.w*TILE - VIEW_W);
    this.cam.y = 0;
    this.fade = null;
    this.particles.clear();
    this.texts.length = 0;
    document.body.classList.remove('ended');
    this.state = 'READY';
    this.readyT = 1.0;
    this.inputClear();
    // die() stops the music, so a respawn has to start it again.
    AudioSys.startMusic();
    needRender = true;
  },
  toTitle(){
    this.stage = 1;
    // Banking the run here keeps a quitting player's best score.
    this.high = Math.max(this.high, this.score);
    Store.set('high', this.high);
    hideAllOverlays();
    document.body.classList.remove('in-game');
    document.body.classList.remove('ended');
    this.mainLevel = new Level(this.course.rows, false);
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
    updateStageUI();
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
    } else if (c === T.VAULT){
      // Armoured: a head bump only clangs. Needs firepower.
      lv.bumps.set(tx*100 + ty, BUMP_DUR);
      AudioSys.sfx.thud();
      if (this.hintT <= 0){
        this.hintT = 1.4;
        this.addText(tx*TILE + 24, ty*TILE - 8, 'ARMORED — SHOOT IT', '#cfe4f5', 14);
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
  // Hidden blocks are intangible until Maro jumps into one: it then becomes a
  // solid USED block and pays out a secret gem.
  revealHidden(e, dt){
    const lv = this.level;
    if (e.vy >= 0) return;
    // Sweep every row the head passes through this step, not just the row it
    // lands in: a block sitting at head height would otherwise be skipped,
    // because the projected row can already be past it on the first frame.
    const y0 = Math.floor(e.y/TILE);
    const y1 = Math.floor((e.y + e.vy*dt)/TILE);
    const x0 = Math.floor(e.x/TILE), x1 = Math.floor((e.x + e.w - 0.01)/TILE);
    for (let ty = Math.min(y0, y1); ty <= Math.max(y0, y1); ty++){
      for (let tx = x0; tx <= x1; tx++){
      if (lv.get(tx, ty) !== T.HIDDEN) continue;
      // It becomes a ONE-WAY platform on purpose: a solid block would bonk the
      // jump that revealed it (deadly over a ravine), whereas a ledge never
      // blocks the jump and leaves a new foothold behind as the reward.
      lv.set(tx, ty, T.PLATFORM);
      lv.bumps.set(tx*100 + ty, BUMP_DUR);
      // SEC tracks the course, so bonus-room finds stay off the main tally.
      if (!this.inBonus) this.secretsFound++;
      AudioSys.sfx.powerOut();
      this.particles.spark(tx*TILE + 24, ty*TILE + 24, '#7ef0ff', 10);
      this.addText(tx*TILE + 24, ty*TILE - 8, 'SECRET GEM!', '#7ef0ff', 15);
      vib(12);
      // Drop a catchable gem if there is air above; otherwise credit it outright.
      if (lv.get(tx, ty-1) === T.EMPTY){
        const gem = new Item('gem', tx*TILE + 11, (ty-1)*TILE + 11);
        gem.vy = -180;
        this.items.push(gem);
      } else {
        this.pops.push(new CoinPop(tx*TILE + 24, ty*TILE));
        this.gems++; this.score += 500;
      }
      }
    }
  },
  // Vault caches only crack to a fireball or a bowling shell — never a head bump.
  // This is the course's Spark Bloom gate.
  breakVault(tx, ty){
    const lv = this.level;
    if (lv.get(tx, ty) !== T.VAULT) return;
    // A cache is the whole pillar, so one hit clears all of its tiles and
    // scores a single secret rather than one per tile.
    let top = ty, bot = ty;
    while (lv.get(tx, top - 1) === T.VAULT) top--;
    while (lv.get(tx, bot + 1) === T.VAULT) bot++;
    for (let y = top; y <= bot; y++) lv.set(tx, y, T.EMPTY);
    ty = top;
    this.secretsFound++;
    this.score += 500;
    AudioSys.sfx.breakBlock();
    this.particles.debris(tx*TILE + 24, ty*TILE + 24);
    this.particles.spark(tx*TILE + 24, ty*TILE + 24, '#7ef0ff', 12);
    this.shake(3, 0.2);
    vib(18);
    this.addText(tx*TILE + 24, ty*TILE - 8, 'CACHE!', '#7ef0ff', 17);
    this.lastMultiX = tx*TILE + 24;
    this.lastMultiY = ty*TILE - 6;
    this.multiQ = 3;                 // three gems burst out of the cache
    this.multiT = 0;
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
    if (e.dead || e.remove || (e.hitT>0 && style!=='crush')) return;
    if (e.hp>1 && style!=='crush'){
      e.hp--; e.hitT=0.45;
      this.particles.spark(e.x+e.w/2,e.y+10,'#ffe089',6);
      this.addText(e.x+e.w/2,e.y-8,'HIT!', '#ffe089',14);
      AudioSys.sfx.stomp(); return;
    }
    e.hp=0;
    if(e.kind==='guardian'){ pts=1000+this.stage*100; this.enemyShots.length=0; }
    // Stomping a gel splits it; fire and star damage dissolve it outright.
    if (e.kind === 'gel' && e.gen < 1 && style === 'stomp' && this.enemies.length < 40){
      for (const side of [-1, 1]){
        const child = new Enemy('gel', e.x - 4 + (side > 0 ? 12 : 0), e.y + 2);
        child.gen = e.gen + 1;
        child.active = true;
        child.dir = side;
        child.vy = -300;
        child.speed = e.speed * 1.35;
        // Deferred so we never mutate this.enemies mid-iteration.
        this.pendingEnemies.push(child);
      }
      this.addText(e.x + e.w/2, e.y - 10, 'SPLIT!', '#9fe870', 14);
    }
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
    // A shielder's plate is facing the shot: it sparks off and does nothing.
    if (e.kind === 'shielder'){
      const fromFront = (s.vx > 0 && e.dir > 0) || (s.vx < 0 && e.dir < 0);
      if (fromFront){
        AudioSys.sfx.bounce();
        this.particles.spark(s.x, s.y, '#cfe4f5', 6);
        this.addText(e.x + e.w/2, e.y - 8, 'BLOCKED', '#cfe4f5', 13);
        return;
      }
      this.defeatEnemy(e, 300, 'shot');
      return;
    }
    if (e.kind === 'walker') this.defeatEnemy(e, 200, 'shot');
    else if (e.kind === 'plant') this.defeatEnemy(e, 200, 'shot');
    else if (e.kind !== 'shell') this.defeatEnemy(e,200,'shot');
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
    // Star mows down normal foes, but bosses must be fought for real.
    if (p.invT > 0){ if (e.kind !== 'guardian') this.defeatEnemy(e, e.kind === 'walker' ? 100 : 200, 'crush'); return; }
    if (p.hurtT > 0) return;
    const stomp = p.vy > 40 && p.prevBottom <= b.y + 14;
    if (stomp){
      // Spiked crowns: plants and turrets punish a stomp instead of dying to it.
      if (e.kind === 'plant' || e.kind === 'turret'){
        this.hurtPlayer(e);
        return;
      }
      p.vy = Input.jumpHeld ? -640 : -430;
      if (e.kind !== 'shell'){
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
      // Hide the on-screen pad behind the end panel; keep sound/fullscreen handy.
      document.body.classList.add('ended');
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
    if(this.enemies.some(e=>e.kind==='guardian'&&!e.dead&&!e.remove)){
      if(this.gateHintT<=0){ this.addText(p.x,p.y-28,'DEFEAT THE GUARDIAN!', '#ffe089',16); this.gateHintT=1.5; }
      return;
    }
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
      // Bolts were frozen mid-flight while you were inside; drop them so the
      // course cannot shoot you the instant you step back out.
      this.enemyShots.length = 0;
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
  nextStage(){
    if (this.state === 'CLEAR' && this.stage < TOTAL_STAGES) this.startGame(this.stage+1, true);
  },
  finishClear(){
    if (this.state === 'CLEAR') return;
    this.state = 'CLEAR';
    document.body.classList.add('ended');
    this.timeBonus = Math.ceil(this.timeLeft) * 50;
    this.score += this.timeBonus;
    this.high = Math.max(this.high, this.score);
    Store.set('high', this.high);
    $('clear-stats').innerHTML =
      'FLAG BONUS&nbsp;&nbsp;' + pad6(this.flagScore) +
      '<br>TIME BONUS&nbsp;&nbsp;' + pad6(this.timeBonus) +
      '<br>GEMS&nbsp;&nbsp;×' + this.gems +
      (this.secretTotal > 0
        ? '<br>SECRETS&nbsp;&nbsp;' + Math.min(this.secretsFound, this.secretTotal) + ' / ' + this.secretTotal +
          (this.secretsFound >= this.secretTotal ? ' ★' : '')
        : '') +
      '<br><span class="total">TOTAL ' + pad6(this.score) + '</span>';
    const last = this.stage === TOTAL_STAGES;
    this.progress.unlocked=Math.max(this.progress.unlocked,Math.min(TOTAL_STAGES,this.stage+1));
    if(!this.progress.cleared.includes(this.stage)) this.progress.cleared.push(this.stage);
    Store.set('campaign',this.progress);
    if(this.stage===1) Store.set('stage2Unlocked',true); // migrate old two-stage saves
    let reward='';
    if(this.stage%3===0 && this.lives<MAX_LIVES){ this.lives++; reward=' +1 LIFE!'; }
    $('btn-next-stage').hidden=last;
    if(!last) $('btn-next-stage').textContent='NEXT → '+COURSES[this.stage].name;
    $('clear-heading').textContent=last?'CAMPAIGN COMPLETE!':'STAGE '+this.stage+' / '+TOTAL_STAGES+' CLEAR!';
    $('clear-message').textContent=(last?'The Gem Kingdom is safe. All 15 stages conquered!':COURSES[this.stage].name+' unlocked!')+reward;
    updateStageUI();
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
    this.gateHintT=Math.max(0,this.gateHintT-dt);
    this.timeLeft -= dt;
    if (this.timeLeft <= 0){
      this.timeLeft = 0;
      this.die('time');
      return;
    }
    if (this.bonusLockT > 0) this.bonusLockT -= dt;
    if (this.hintT > 0) this.hintT -= dt;
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
          if (o.kind !== 'shell'){
            const b = o.box();
            if (b.active && aabb(e, b)) this.defeatEnemy(o, 200, 'shell');
          }
        }
        // A bowling shell cracks a vault cache just like a fireball does.
        const aheadX = e.x + (e.dir > 0 ? e.w + 4 : -4);
        const vty = Math.floor((e.y + e.h - 8)/TILE);
        if (this.level.get(Math.floor(aheadX/TILE), vty) === T.VAULT){
          this.breakVault(Math.floor(aheadX/TILE), vty);
        }
      }
    }

    // Split gels land here, after every enemy pass has finished, so we never
    // mutate this.enemies while it is being iterated.
    if (this.pendingEnemies.length){
      for (const e of this.pendingEnemies) this.enemies.push(e);
      this.pendingEnemies.length = 0;
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
      for(const shot of this.enemyShots) if(!shot.remove) shot.update(dt,this);
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
    this.compact(this.enemyShots);
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

// Per-stage ambient weather. Deterministic: particle i is derived from its index,
// so a stage looks identical on every visit and replays cleanly.
function drawStageFX(stage, camX){
  const fx = STAGE_FX[clamp(stage,1,15) - 1];
  if (!fx) return;
  const n = Settings.effectsReduced ? Math.max(6, Math.floor(fx.n*0.4)) : fx.n;
  const t = gameT;
  for (let i=0;i<n;i++){
    const col = fx.colors[i % fx.colors.length];
    let sx, sy;
    if (fx.kind === 'twinkle'){
      sx = mod(i*131 - camX*0.12, VIEW_W);
      sy = 40 + (i*97) % (VIEW_H-140);
      ctx.globalAlpha = 0.35 + 0.65*Math.abs(Math.sin(t*2.2 + i));
      ctx.fillStyle = col; ctx.fillRect(sx, sy, fx.size, fx.size);
      ctx.globalAlpha = 1;
      continue;
    }
    if (fx.kind === 'rain'){
      sx = mod(i*97 + t*fx.sway - camX*0.25, VIEW_W);
      sy = mod(i*61 + t*fx.spd, VIEW_H);
      ctx.globalAlpha = 0.5; ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx-4, sy+13); ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    if (fx.kind === 'drift'){
      sx = mod(i*83 + t*fx.spd + Math.sin(t*1.4 + i)*fx.sway - camX*0.1, VIEW_W);
      sy = 90 + (i*67) % (VIEW_H-220) + Math.sin(t*1.1 + i*0.7)*10;
      ctx.globalAlpha = 0.45 + 0.55*Math.abs(Math.sin(t*2.6 + i*1.3));   // blinking
      ctx.fillStyle = col; ctx.fillRect(sx, sy, fx.size, fx.size);
      ctx.globalAlpha = 1;
      continue;
    }
    const dir = fx.kind === 'rise' ? -1 : 1;
    sx = mod(i*83 + Math.sin(t*0.9 + i)*fx.sway - camX*0.1, VIEW_W);
    sy = mod(i*59 + dir*t*fx.spd, VIEW_H);
    ctx.fillStyle = col; ctx.fillRect(sx, sy, fx.size, fx.size);
  }
}

function drawScene(camX, camY){
  const G = Game;
  const backdrop = courseBackdrop(G.stage);
  ctx.drawImage(backdrop.sky, 0, 0);
  drawStageFX(G.stage, camX);
  for (const cl of ASSETS.bg.clouds){
    const sx = mod(cl.x - camX*0.25, VIEW_W + 260) - 130;
    ctx.drawImage(cl.img, Math.round(sx), cl.y);
  }
  drawStrip(backdrop.far, 248, 0.15, camX);
  if (backdrop.mid) drawStrip(backdrop.mid, 262, 0.28, camX);   // per-stage landmarks
  drawStrip(backdrop.near, 336, 0.42, camX);

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

  // Main-course enemies must not leak into the safe bonus room.
  for (const e of (G.inBonus?[]:G.enemies)){
    if (e.remove) continue;
    if (e.x < camX - 80 || e.x > camX + VIEW_W + 80) continue;
    if (e.dead && e.kind === 'plant') continue;   // plants pop, no corpse
    drawEnemy(e, camX, camY);
  }

  if(!G.inBonus) for(const shot of G.enemyShots){
    if(shot.remove) continue;
    ctx.fillStyle='#8f497c'; ctx.beginPath(); ctx.arc(shot.x-camX,shot.y-camY,9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffdc96'; ctx.beginPath(); ctx.arc(shot.x-camX,shot.y-camY,5,0,Math.PI*2); ctx.fill();
  }
  drawPlayer(camX, camY);

  // projectiles
  for (const s of (G.inBonus?[]:G.shots)){
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

function drawCampaignEnemy(e,x,y){
  const R=(a,b,w,h,c)=>{ ctx.fillStyle=c; ctx.fillRect(x+a,y+b,w,h); };
  if (e.hitT>0 && ((gameT*20)|0)%2===0) ctx.globalAlpha=0.5;
  if (e.kind === 'bat'){
    const flap=Math.sin(e.walkT*12)>0 ? -5 : 6;
    R(0,5+flap,12,7,'#533c78'); R(24,5-flap,12,7,'#533c78');
    R(2,6+flap,9,3,'#b394e3'); R(26,6-flap,8,3,'#b394e3');
    R(10,5,16,16,'#7552a1'); R(11,0,4,8,'#7552a1'); R(21,0,4,8,'#7552a1');
    R(12,9,5,5,'#fff4d5'); R(20,9,5,5,'#fff4d5');
    R(15,10,2,3,'#2e254a'); R(22,10,2,3,'#2e254a'); R(17,17,3,4,'#fff4d5');
  } else if (e.kind === 'hopper'){
    const lift=e.onGround?0:3;
    R(2,0,5,13,'#3c8f69'); R(23,0,5,13,'#3c8f69');
    R(3,1,3,6,'#ffcd80'); R(24,1,3,6,'#ffcd80');
    R(3,9,24,19,'#3c8f69'); R(7,18,16,9,'#c6e6ac');
    R(6,12,6,6,'#fff'); R(19,12,6,6,'#fff');
    R(9,14,3,3,'#183c43'); R(21,14,3,3,'#183c43');
    R(0,27-lift,10,5,'#24575a'); R(20,27-lift,10,5,'#24575a');
    if (e.onGround && e.hopT<0.35) R(11,3,8,3,'#ffe58c');
  } else if (e.kind === 'charger'){
    // Horned bull: crouches and glows while winding up, streaks while dashing.
    const winding = e.phase === 'charge';
    const dashing = e.phase === 'dash';
    const lean = dashing ? (e.dir > 0 ? 4 : -4) : 0;
    R(4+lean,26,11,6,'#5a3a1e'); R(24-lean,26,11,6,'#5a3a1e');
    R(2,10,34,18,'#a35a2e'); R(6,14,26,10,'#c97a44');
    if (winding) R(6,14,26,10,'#ff9d47');
    R(28+e.dir*2,6,10,10,'#e8dcc0');          // horn, leads the charge
    R(6,12,8,8,'#fff'); R(20,12,8,8,'#fff');
    R(e.dir>0?10:8,14,4,4,'#2b1a0f'); R(e.dir>0?20:22,14,4,4,'#2b1a0f');
    if (winding){
      ctx.fillStyle='#ffe14d'; ctx.font='bold 20px monospace'; ctx.textAlign='center';
      ctx.fillText('!', x+18, y-12); ctx.textAlign='left';
    }
    if (dashing){ R(0,18,6,4,'#ffd166'); R(32,18,6,4,'#ffd166'); }
    for(let i=0;i<e.hp;i++) R(8+i*12,3,5,4,'#ffe089');
  } else if (e.kind === 'shielder'){
    // Armoured turtle with a bright plate on its front — the side that blocks.
    const front = e.dir > 0 ? 26 : 0;
    R(4,30,10,6,'#3b4a63'); R(26,30,10,6,'#3b4a63');
    R(2,8,36,24,'#4a6fa5'); R(6,4,28,20,'#6f9ad0');
    R(8,6,24,5,'#a8c8ee'); R(front,4,14,30,'#cfe4f5');   // the plate
    R(front+3,8,8,8,'#ffffff'); R(front,20,14,4,'#8fa5cc');
    R(e.dir>0?6:30,16,8,8,'#f4d7a7');
    R(e.dir>0?8:32,18,3,3,'#2b1a0f');
  } else if (e.kind === 'turret'){
    // Rooted sentry: a spiked crown warns that stomping is a bad idea.
    const warn = e.phase === 'warning';
    R(2,28,32,6,'#2f3542'); R(4,12,28,18,'#5b6272');
    R(6,14,24,14,'#7d8798'); R(9,18,18,7,'#2f3542');
    for (let i=0;i<3;i++){                                  // spikes on top
      const sx = 6 + i*10;
      R(sx,4,4,9,'#d9dde3'); R(sx+1,1,2,4,'#ffffff');
    }
    R(e.dir>0?26:4,17,12,7,warn?'#ffe14d':'#ff6a5e');       // muzzle
    R(12,22,12,4,'#3b4252');
    if (warn){
      ctx.fillStyle='#ffe14d'; ctx.font='bold 20px monospace'; ctx.textAlign='center';
      ctx.fillText('!', x+18, y-16); ctx.textAlign='left';
    }
    for(let i=0;i<e.hp;i++) R(6+i*11,32,6,3,'#ffe089');
  } else if (e.kind === 'gel'){
    // Wobbling blob: lighter tint marks the children that spawn from a split.
    const wob = Math.sin(e.walkT*9) > 0 ? 1 : 0;
    const body = e.gen ? '#8ce0b4' : '#2fae7a', lite = e.gen ? '#c8f5df' : '#63d6a2';
    R(2,4+wob,30,20,body); R(4,2+wob,26,6,body);
    R(6,6+wob,22,12,lite); R(8,8+wob,8,5,'#eafff4');
    R(10,12+wob,5,6,'#12352a'); R(20,12+wob,5,6,'#12352a');
    R(e.dir>0?22:10,18+wob,5,3,'#12352a');
    R(0,24,34,4,'#1f7d55');
  } else if (e.kind === 'beetle'){
    const step=Math.sin(e.walkT*10)>0?2:0;
    R(3,24,10,6,'#343d62'); R(26,24-step,9,6,'#343d62');
    R(2,8,34,18,'#345b7a'); R(6,2,26,22,'#5a91a4');
    R(8,4,20,4,'#a2d9cd'); R(17,6,3,16,'#345b7a');
    R(e.dir>0?24:4,16,10,8,'#dceac4'); R(e.dir>0?29:5,17,3,4,'#23364a');
    for(let i=0;i<e.hp;i++) R(10+i*12,10,5,4,'#ffe089');
  } else {
    const v = e.boss || 1;
    const armor = ['#62436a','#3a3350','#4c3a70'][v-1];
    const chest = ['#b96f68','#6a5a8a','#c9a24a'][v-1];
    const helm  = ['#765377','#2e2a44','#5a4480'][v-1];
    const trim  = ['#e2aa63','#9a8ac0','#ffd166'][v-1];
    R(5,53,17,11,'#302d49'); R(34,53,17,11,'#302d49');
    R(5,18,46,38,armor); R(10,20,36,30,chest);
    R(18,28,20,20,'#f6bc75'); R(23,31,10,12,e.phase==='warning'?'#fff4b4':'#8b5470');
    R(9,4,38,22,helm); R(12,7,32,14,'#f4d7a7');
    R(4,0,9,10,trim); R(43,0,9,10,trim);
    R(15,10,8,5,'#302d49'); R(33,10,8,5,'#302d49');
    R(0,27,9,23,helm); R(47,27,9,23,helm);
    if (v === 2){ R(2,-8,6,10,trim); R(48,-8,6,10,trim); }            // Warden horns
    if (v === 3){ R(14,-10,28,8,trim); R(14,-16,5,8,trim);            // King crown
                  R(25,-18,6,10,trim); R(37,-16,5,8,trim); }
    if(e.phase==='warning'){
      ctx.fillStyle='#ffe089'; ctx.font='bold 22px monospace'; ctx.textAlign='center';
      ctx.fillText('!',x+28,y-30); ctx.textAlign='left';
    }
    R(0,-26,56,6,'#302d49'); R(1,-25,54*e.hp/e.maxHp,4,'#f4b86d');
  }
  ctx.globalAlpha=1;
}

function drawEnemy(e, camX, camY){
  if (e.lurk && !e.revealed) return;   // hidden ambushers are invisible until they spring
  const x = Math.round(e.x - camX), y = Math.round(e.y - camY);
  const kind = (xx, yy) => {
    if (e.kind === 'walker') drawWalker(e, xx, yy);
    else if (e.kind === 'shell') drawShell(e, xx, yy);
    else if(e.kind==='plant') drawPlant(e, camX, camY);
    else drawCampaignEnemy(e,xx,yy);
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

// Difficulty tiers read from the course data, each with its own signal colour.
const DIFF_COLORS = {
  TUTORIAL:'#9fe870', ADVENTURE:'#8fd0ff', CHALLENGING:'#ffd166',
  EXPERT:'#ff9d6e', MASTER:'#ff6a8a',
};

// Themed plate + numbered crest that frames the course name in the stage palette.
function drawCoursePlate(x, y, w, h, theme, stage){
  const top = theme[0], far = theme[2], sun = theme[4];
  ctx.fillStyle = 'rgba(10,20,40,.66)';
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 0.35; ctx.fillStyle = top; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
  ctx.strokeStyle = sun; ctx.lineWidth = 1;
  ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
  ctx.fillStyle = far; ctx.fillRect(x, y+h-3, w, 3);
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.moveTo(x+16, y+8); ctx.lineTo(x+29, y+8); ctx.lineTo(x+29, y+19);
  ctx.lineTo(x+22.5, y+27); ctx.lineTo(x+16, y+19);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(10,20,40,.85)';
  ctx.font = '800 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(stage), x+22.5, y+10);
  ctx.textAlign = 'left';
}

function drawDifficultyBadge(x, y, label){
  const fg = DIFF_COLORS[label] || DIFF_COLORS.ADVENTURE;
  ctx.font = '800 12px "Courier New", monospace';
  const w = Math.max(58, label.length*8 + 18);
  ctx.fillStyle = 'rgba(10,20,40,.78)';
  ctx.fillRect(x, y, w, 22);
  ctx.strokeStyle = fg; ctx.lineWidth = 1;
  ctx.strokeRect(x+0.5, y+0.5, w-1, 21);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w/2, y+5);
  ctx.textAlign = 'left';
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
  const name = (G.inBonus ? 'SECRET ROOM' : G.stage + '/'+TOTAL_STAGES+' · ' + G.course.name);
  drawCoursePlate(14, 48, 222, 34, courseTheme(G.stage), G.stage);
  ctx.fillStyle = 'rgba(10,20,40,.75)';
  ctx.fillText(name, 53, 57);
  ctx.fillStyle = '#bcd0f5';
  ctx.fillText(name, 52, 56);
  drawDifficultyBadge(318, 52, (G.course.difficulty || 'ADVENTURE').toUpperCase());
  // Secret tracker: only drawn on courses that actually hide something.
  if (G.secretTotal > 0 && !G.inBonus){
    const found = clamp(G.secretsFound, 0, G.secretTotal);
    const label = 'SEC ' + found + '/' + G.secretTotal;
    ctx.font = '800 13px "Courier New", monospace';
    const sw = label.length*8 + 16;
    ctx.fillStyle = 'rgba(10,20,40,.62)';
    ctx.fillRect(472, 52, sw, 26);
    ctx.strokeStyle = found >= G.secretTotal ? '#9fe870' : 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(472.5, 52.5, sw-1, 25);
    ctx.fillStyle = found >= G.secretTotal ? '#9fe870' : '#ffd166';
    ctx.fillText(label, 480, 56);
  }

  const p = G.player;
  const state = p.invT > 0 ? 'star' : (p.form === 'shoot' ? 'shoot' : (p.form === 'big' ? 'big' : 'small'));
  const labels = { small:'S', big:'G', shoot:'P', star:'*' };
  const cols = { small:'#9fb4dd', big:'#9fe870', shoot:'#ff9dd5', star:'#ffe14d' };
  ctx.fillStyle = 'rgba(10,20,40,.6)';
  ctx.fillRect(240, 52, 34, 26);
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.strokeRect(240.5, 52.5, 33, 25);
  ctx.font = '800 18px "Courier New", monospace';
  ctx.fillStyle = cols[state];
  ctx.fillText(labels[state], 248, 55);
  if (p.invT > 0){
    ctx.fillStyle = cols.star;
    ctx.font = '800 16px "Courier New", monospace';
    ctx.fillText(Math.ceil(p.invT) + 's', 280, 56);
  }
}

function drawReady(){
  const G = Game;
  const theme = courseTheme(G.stage);
  const top = theme[0], far = theme[2], near = theme[3], sun = theme[4];
  const x = 180, y = 148, w = 600, h = 216;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Card body in the course's own palette, with a double themed border.
  const grad = ctx.createLinearGradient(0, y, 0, y+h);
  grad.addColorStop(0, top); grad.addColorStop(1, near);
  ctx.globalAlpha = 0.82; ctx.fillStyle = grad; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(10,20,40,.45)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = sun; ctx.lineWidth = 3; ctx.strokeRect(x+1.5, y+1.5, w-3, h-3);
  ctx.strokeStyle = far; ctx.lineWidth = 1; ctx.strokeRect(x+7.5, y+7.5, w-15, h-15);
  ctx.fillStyle = sun;
  for (const [cx,cy] of [[x+14,y+14],[x+w-14,y+14],[x+14,y+h-14],[x+w-14,y+h-14]]) ctx.fillRect(cx-4,cy-4,8,8);

  // stage pill
  const pill = 'STAGE ' + G.stage + ' / ' + TOTAL_STAGES;
  ctx.font = '800 18px "Courier New", monospace';
  const pw = pill.length*11 + 28;
  ctx.fillStyle = 'rgba(10,20,40,.8)'; ctx.fillRect(480-pw/2, y+22, pw, 28);
  ctx.strokeStyle = sun; ctx.lineWidth = 1; ctx.strokeRect(480-pw/2+0.5, y+22.5, pw-1, 27);
  ctx.fillStyle = sun; ctx.fillText(pill, 480, y+27);

  // course name
  ctx.font = '900 44px "Courier New", monospace';
  ctx.fillStyle = 'rgba(10,20,40,.85)';
  ctx.fillText(G.course.name, 481, y+63);
  ctx.fillStyle = sun;
  ctx.fillText(G.course.name, 480, y+61);

  // difficulty tier + course briefing
  const diff = (G.course.difficulty || 'ADVENTURE').toUpperCase();
  ctx.font = '800 16px "Courier New", monospace';
  ctx.fillStyle = DIFF_COLORS[diff] || DIFF_COLORS.ADVENTURE;
  ctx.fillText('\u25C6 ' + diff + ' \u25C6', 480, y+118);
  ctx.font = '700 14px "Courier New", monospace';
  ctx.fillStyle = '#dce8ff';
  ctx.fillText(G.course.tip || '', 480, y+146);

  ctx.font = '800 24px "Courier New", monospace';
  ctx.globalAlpha = 0.6 + 0.4*Math.sin(gameT*6);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('GET READY!', 480, y+176);
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

function startSelectedStage(stage){
  if(!Number.isInteger(stage)||stage<1||stage>Game.progress.unlocked) return false;
  Game.startGame(stage); return true;
}
function updateStageUI(){
  $('btn-continue').hidden=Game.progress.unlocked<=1;
  $('btn-continue').textContent='CONTINUE · '+Game.progress.unlocked+' / '+TOTAL_STAGES;
  $('stage-progress').textContent=Game.progress.cleared.length+' / '+TOTAL_STAGES+' stages cleared · Unlocked stages start a fresh run.';
  for(let stage=1;stage<=TOTAL_STAGES;stage++){
    const b=$('stage-'+stage), unlocked=stage<=Game.progress.unlocked, done=Game.progress.cleared.includes(stage);
    const diff=(COURSES[stage-1].difficulty||'ADVENTURE').toUpperCase();
    b.disabled=!unlocked;
    b.classList.toggle('cleared',done);
    b.setAttribute('aria-label','Stage '+stage+': '+COURSES[stage-1].name+(done?', cleared':unlocked?', unlocked':', locked'));
    // Each course's card carries its own accent so the menu mirrors the campaign art.
    if (!done) b.style.borderLeft='6px solid '+courseTheme(stage)[4];
    const stEl=$('stage-status-'+stage);
    stEl.textContent=done?'✓ CLEARED':unlocked?(COURSES[stage-1].difficulty||'ADVENTURE'):'LOCKED';
    stEl.style.color=done?'#76c695':unlocked?(DIFF_COLORS[diff]||'#b7cce3'):'#b7cce3';
  }
}

function updateToggles(){
  $('tg-sound').textContent = Settings.sound ? 'ON' : 'OFF';
  $('tg-sound').classList.toggle('on', Settings.sound);
  $('tg-vib').textContent = Settings.vibrate ? 'ON' : 'OFF';
  $('tg-vib').classList.toggle('on', Settings.vibrate);
  // Standard quality always renders with reduced effects, so report the state
  // the player will actually see and disable the override that cannot apply.
  $('tg-reduced').disabled = Settings.quality === 'standard';
  $('tg-reduced').textContent = Settings.effectsReduced ? 'ON' : 'OFF';
  $('tg-reduced').classList.toggle('on', Settings.effectsReduced);
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

// Pausing is allowed during the short READY intro too, and resuming returns to
// whichever of the two you paused from rather than always skipping the intro.
function doPause(){
  if (Game.state !== 'PLAYING' && Game.state !== 'READY') return;
  Game.pausedFrom = Game.state;
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
  Game.state = Game.pausedFrom === 'READY' ? 'READY' : 'PLAYING';
  Game.pausedFrom = null;
  document.body.classList.add('in-game');
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
    if (Settings.quality === 'standard') return;   // already forced on by quality
    Settings.reduced = !Settings.effectsReduced;
    Store.set('reduced', Settings.reduced);
    updateToggles();
  });
  $('rg-op').addEventListener('input', (e) => {
    Settings.opacity = clamp(parseInt(e.target.value, 10) || 85, 20, 100)/100;
    Store.set('opacity', Settings.opacity);
    Settings.apply();
  });
  on('btn-continue', () => Game.startGame(Game.progress.unlocked));
  on('btn-stages', () => { updateStageUI(); showOv('ov-stages'); });
  on('btn-stages-back', () => { hideOv('ov-stages'); showOv('ov-title'); });
  for(let stage=1;stage<=TOTAL_STAGES;stage++) on('stage-'+stage,()=>startSelectedStage(stage));
  on('btn-next-stage', () => Game.nextStage());
  on('btn-retry', () => Game.startGame(Game.stage));
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
  if(k==='escape' && !$('ov-stages').hidden){ hideOv('ov-stages'); showOv('ov-title'); e.preventDefault(); return; }
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
    if (Game.state === 'PLAYING' || Game.state === 'READY') doPause();
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
