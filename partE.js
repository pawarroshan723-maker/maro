// ---------------- tile collision (AABB, axis-separated) ----------------
function tileSolidAt(lv, px, py){
  return lv.solid(Math.floor(px/TILE), Math.floor(py/TILE));
}
function rectSolid(lv, x, y, w, h){
  const x0 = Math.floor(x/TILE), x1 = Math.floor((x+w-0.01)/TILE);
  const y0 = Math.floor(y/TILE), y1 = Math.floor((y+h-0.01)/TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (lv.solid(tx, ty)) return true;
  return false;
}
function colSolid(lv, tx, y, h){
  const y0 = Math.floor(y/TILE), y1 = Math.floor((y+h-0.01)/TILE);
  for (let ty = y0; ty <= y1; ty++)
    if (lv.solid(tx, ty)) return true;
  return false;
}
function rowSolid(lv, x, w, ty, prevBottom, allowOneway){
  const x0 = Math.floor(x/TILE), x1 = Math.floor((x+w-0.01)/TILE);
  for (let tx = x0; tx <= x1; tx++){
    if (lv.solid(tx, ty)) return true;
    if (allowOneway && lv.oneway(tx, ty) && prevBottom <= ty*TILE + 8) return true;
  }
  return false;
}

// Moves an entity and resolves against tiles.
// Sets e.onGround, e.onWall (-1/0/1), e.ceilTy (tile hit from below, else null).
function moveAndCollide(lv, e, dt){
  e.onGround = false; e.onWall = 0; e.ceilTy = null;
  if (e.vx > 0){
    e.x += e.vx*dt;
    const tx = Math.floor((e.x+e.w)/TILE);
    if (colSolid(lv, tx, e.y, e.h)){
      e.x = tx*TILE - e.w - 0.01;
      e.vx = 0; e.onWall = 1;
    }
  } else if (e.vx < 0){
    e.x += e.vx*dt;
    const tx = Math.floor(e.x/TILE);
    if (colSolid(lv, tx, e.y, e.h)){
      e.x = (tx+1)*TILE + 0.01;
      e.vx = 0; e.onWall = -1;
    }
  }
  const prevBottom = (e.prevBottom !== undefined) ? e.prevBottom : e.y + e.h;
  if (e.vy >= 0){
    e.y += e.vy*dt;
    const ty = Math.floor((e.y+e.h)/TILE);
    if (rowSolid(lv, e.x, e.w, ty, prevBottom, true)){
      e.y = ty*TILE - e.h - 0.01;
      if (e.vy > 0) e.vy = 0;
      e.onGround = true;
    }
  } else {
    e.y += e.vy*dt;
    const ty = Math.floor(e.y/TILE);
    if (rowSolid(lv, e.x, e.w, ty, prevBottom, false)){
      e.y = (ty+1)*TILE + 0.01;
      e.vy = 0;
      e.ceilTy = ty;
    }
  }
}

// Which solid tile under the entity's top was hit (for block activation)?
function ceilTileAt(lv, e, ty){
  let best = null, bestOv = 0;
  const x0 = Math.floor(e.x/TILE), x1 = Math.floor((e.x+e.w-0.01)/TILE);
  for (let tx = x0; tx <= x1; tx++){
    if (lv.solid(tx, ty)){
      const ov = Math.min(e.x+e.w, (tx+1)*TILE) - Math.max(e.x, tx*TILE);
      if (ov > bestOv){ bestOv = ov; best = { tx, ty }; }
    }
  }
  return best;
}

// ---------------- player ----------------
class Player {
  constructor(G){
    this.G = G;
    this.form = 'small';
    this.x = 0; this.y = 0; this.w = SIZES.small.w; this.h = SIZES.small.h;
    this.vx = 0; this.vy = 0; this.facing = 1;
    this.onGround = false; this.crouching = false;
    this.coyote = 0; this.jbuf = 0;
    this.hurtT = 0; this.invT = 0; this.morphT = 0;
    this.dead = false; this.prevBottom = 0; this.walkT = 0;
    this.invLastSec = -1;
  }
  reset(tx, form, groundRow){
    this.form = form;
    this.crouching = false;
    const s = form === 'small' ? SIZES.small : SIZES.big;
    this.w = s.w; this.h = s.h;
    this.x = tx*TILE + (TILE-this.w)/2;
    this.y = groundRow*TILE - this.h;
    this.vx = 0; this.vy = 0; this.facing = 1;
    this.onGround = true;
    this.coyote = 0; this.jbuf = 0;
    this.hurtT = 0; this.invT = 0; this.morphT = 0;
    this.dead = false;
    this.prevBottom = this.y + this.h;
    this.walkT = 0;
    this.invLastSec = -1;
    this.unstick();
  }
  setForm(f){
    this.form = f;
    this.crouching = false;
    const feet = this.y + this.h;
    const s = f === 'small' ? SIZES.small : SIZES.big;
    this.w = s.w; this.h = s.h;
    this.y = feet - this.h;
    this.morphT = 0.5;
    this.unstick();
  }
  setCrouch(on){
    if (on === this.crouching) return;
    const feet = this.y + this.h;
    this.crouching = on;
    const s = this.form === 'small'
      ? (on ? SIZES.crouchS : SIZES.small)
      : (on ? SIZES.crouchB : SIZES.big);
    this.w = s.w; this.h = s.h;
    this.y = feet - this.h;
  }
  unstick(){
    const lv = this.G.level;
    const tries = [[0,-4],[0,-12],[0,-24],[4,0],[-4,0],[8,0],[-8,0],[0,-40],[12,-4],[-12,-4]];
    for (const [dx,dy] of tries){
      if (!rectSolid(lv, this.x+dx, this.y+dy, this.w, this.h)){
        this.x += dx; this.y += dy;
        return;
      }
    }
  }
  overlapsHazard(lv){
    const x0 = Math.floor(this.x/TILE), x1 = Math.floor((this.x+this.w-1)/TILE);
    const y0 = Math.floor(this.y/TILE), y1 = Math.floor((this.y+this.h-1)/TILE);
    for (let ty = y0; ty <= y1; ty++){
      for (let tx = x0; tx <= x1; tx++){
        if (lv.get(tx,ty) === T.HAZARD && this.y + this.h > ty*TILE + 8) return true;
      }
    }
    return false;
  }
  update(dt){
    const G = this.G, lv = G.level;
    if (this.dead){
      // death animation physics (no collision)
      this.vy += PHYS.GRAV*0.7*dt;
      this.y += this.vy*dt;
      this.x += this.vx*dt;
      return;
    }
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.morphT > 0) this.morphT -= dt;
    if (this.invT > 0) this.invT = Math.max(0, this.invT - dt);

    // action (run / shoot / kick) edge
    if (Input.actionQueued){
      Input.actionQueued = false;
      G.onAction(this);
    }

    // crouch (down on ground)
    const wantC = Input.down && this.onGround;
    if (wantC && !this.crouching) this.setCrouch(true);
    if (!wantC && this.crouching){
      this.setCrouch(false);
      if (rectSolid(lv, this.x, this.y, this.w, this.h)) this.setCrouch(true); // no headroom
    }

    // horizontal movement
    const dir = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
    if (dir !== 0) this.facing = dir;
    const maxV = (Input.actionHeld ? PHYS.RUN : PHYS.WALK) * (this.crouching ? 0.5 : 1);
    if (dir){
      if (this.vx*dir < maxV) this.vx += dir * (this.onGround ? PHYS.G_ACC : PHYS.A_ACC) * dt;
      else if (this.vx*dir > maxV) this.vx -= dir * PHYS.FRICTION * 0.7 * dt;
    } else {
      const f = (this.onGround ? PHYS.FRICTION : PHYS.AIR_DRAG) * dt;
      this.vx = this.vx > 0 ? Math.max(0, this.vx - f) : Math.min(0, this.vx + f);
    }
    this.vx = clamp(this.vx, -PHYS.RUN, PHYS.RUN);
    if (Math.abs(this.vx) > 20) this.walkT += dt * (Math.abs(this.vx)/140);

    // jumping: buffer + coyote + variable height
    this.coyote = this.onGround ? PHYS.COYOTE : Math.max(0, this.coyote - dt);
    if (Input.jumpQueued){
      this.jbuf = PHYS.JBUF;
      Input.jumpQueued = false;
    } else {
      this.jbuf = Math.max(0, this.jbuf - dt);
    }
    if (this.jbuf > 0 && this.coyote > 0){
      if (this.crouching){
        this.crouching = false;
        const feet = this.y + this.h;
        const s = this.form === 'small' ? SIZES.small : SIZES.big;
        this.w = s.w; this.h = s.h;
        this.y = feet - this.h;
      }
      this.vy = PHYS.JUMP_V;
      this.jbuf = 0; this.coyote = 0; this.onGround = false;
      AudioSys.sfx.jump();
      G.particles.dust(this.x + this.w/2, this.y + this.h);
    }

    // gravity (floaty while held, heavy after release)
    let g = PHYS.GRAV;
    if (this.vy < 0) g *= Input.jumpHeld ? PHYS.HOLD_GRAV : PHYS.FAST_GRAV;
    else if (this.vy > 500) g *= 1.3;
    this.vy = Math.min(this.vy + g*dt, PHYS.MAX_FALL);

    // move + collide
    this.prevBottom = this.y + this.h;
    moveAndCollide(lv, this, dt);
    if (this.ceilTy !== null){
      const t = ceilTileAt(lv, this, this.ceilTy);
      if (t) G.onHeadBump(t.tx, t.ty);
      this.ceilTy = null;
    }

    // hazards
    if (this.hurtT <= 0 && this.invT <= 0 && this.overlapsHazard(lv)) G.hurtPlayer(null);

    // pit / out of world fail-safe
    if (this.y > lv.h*TILE + 40) G.die('pit');

    // level triggers
    if (G.state === 'PLAYING'){
      const tx0 = Math.floor(this.x/TILE), tx1 = Math.floor((this.x+this.w-1)/TILE);
      const ty0 = Math.floor(this.y/TILE), ty1 = Math.floor((this.y+this.h-1)/TILE);
      let flag = false;
      for (let ty = ty0; ty <= ty1 && !flag; ty++){
        for (let tx = tx0; tx <= tx1; tx++){
          const cc = lv.get(tx, ty);
          if (cc === T.FLAG){ G.onFlag(this, ty); flag = true; break; }
          if (cc === T.CHECK) G.onCheckpoint(tx);
          if (cc === T.DOOR && Input.down){
            if (lv.isBonus) G.exitBonus();
            else if (G.bonusLockT <= 0) G.enterBonus();
          }
        }
      }
    }
  }
}

// ---------------- enemies ----------------
class Enemy {
  constructor(kind, x, y){
    this.kind = kind;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.active = false; this.dead = false; this.deadT = 0; this.remove = false;
    this.state = kind === 'shell' ? 'walk' : 'walk';
    this.rise = 0; this.baseY = y; this.walkT = Math.random()*10;
    this.phase = 'hidden'; this.phaseT = 1 + Math.random();
    this.hp = 1; this.maxHp = 1; this.hitT = 0; this.hopT = 1.1;
    this.attackT = 1.6; this.warningT = 0;
    this.patrolMin = x-72; this.patrolMax = x+120;
    this.boundedPatrol = false;
    // Tuned for accessibility: slower walkers, shells less aggressive
    if (kind === 'walker'){ this.w = 34; this.h = 34; this.speed = 42; }
    else if (kind === 'shell'){ this.w = 36; this.h = 30; this.speed = 38; }
    else if (kind === 'hopper'){ this.w=30; this.h=32; this.speed=48; }
    else if (kind === 'bat'){ this.w=36; this.h=24; this.speed=64; }
    else if (kind === 'beetle'){ this.w=38; this.h=30; this.speed=35; this.hp=this.maxHp=2; }
    else if (kind === 'guardian'){ this.w=56; this.h=64; this.speed=38; this.hp=this.maxHp=3; this.phase='patrol'; }
    else { // plant
      this.w = 30; this.h = 26;
      this.baseY = y;               // pipe top (world y)
      this.y = y - 26;
    }
  }
  box(){
    if (this.kind === 'plant'){
      return { x:this.x, y:this.baseY - 10 - this.rise*24, w:this.w, h:20 + this.rise*8, active:this.rise > 0.35 };
    }
    return { x:this.x, y:this.y, w:this.w, h:this.h, active:true };
  }
  updatePlant(dt, G){
    const p = G.player;
    const near = Math.abs((p.x + p.w/2) - (this.x + this.w/2)) < 150 &&
                 Math.abs((p.y + p.h) - this.baseY) < 140;
    if (this.phase === 'hidden'){
      this.phaseT -= dt;
      if (this.phaseT <= 0 && !near) this.phase = 'rising';
    } else if (this.phase === 'rising'){
      this.rise = Math.min(1, this.rise + dt/0.35);
      if (this.rise >= 1){ this.phase = 'up'; this.phaseT = 1.3; }
    } else if (this.phase === 'up'){
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.phase = 'falling';
    } else {
      this.rise = Math.max(0, this.rise - dt/0.4);
      if (this.rise <= 0){ this.phase = 'hidden'; this.phaseT = 1.4 + Math.random()*1.2; }
    }
  }
  updateBat(dt, G){
    this.walkT += dt;
    this.x += this.dir*this.speed*dt;
    if (this.x < this.patrolMin){ this.x=this.patrolMin; this.dir=1; }
    if (this.x+this.w > this.patrolMax){ this.x=this.patrolMax-this.w; this.dir=-1; }
    this.y = this.baseY + Math.sin(this.walkT*2.4)*24;
  }
  updateGuardian(dt, G){
    const near = Math.abs((G.player.x+G.player.w/2)-(this.x+this.w/2)) < 440;
    this.attackT -= dt;
    if (this.phase === 'warning'){
      this.warningT -= dt;
      if (this.warningT <= 0){
        if (near && G.enemyShots.filter(s=>!s.remove).length < 6){
          const dir = G.player.x < this.x ? -1 : 1;
          G.enemyShots.push(new EnemyBolt(this.x+this.w/2+dir*36,this.y+this.h-18,dir,160+G.stage*4));
          AudioSys.sfx.shoot();
        }
        this.phase='patrol'; this.attackT=Math.max(1.25,2.8-G.stage*0.06);
      }
    } else if (this.attackT<=0 && near){
      this.phase='warning'; this.warningT=0.85; this.vx=0;
    }
  }
  update(dt, G){
    const lv = G.level, cam = G.cam.x;
    this.hitT = Math.max(0,this.hitT-dt);
    if (!this.active){
      if (this.x > cam - 140 && this.x < cam + 1100) this.active = true;
      else return;
    }
    if (this.dead){
      this.deadT += dt;
      this.vy += PHYS.GRAV*dt;
      this.y += this.vy*dt;
      this.x += this.vx*dt;
      if (this.deadT > 1.4 || this.y > lv.h*TILE + 200) this.remove = true;
      return;
    }
    if (this.kind === 'plant'){
      this.updatePlant(dt, G);
      return;
    }
    if (this.kind === 'bat'){ this.updateBat(dt,G); return; }
    if (this.kind === 'guardian') this.updateGuardian(dt,G);
    if (this.kind === 'hopper' && this.onGround){
      this.hopT -= dt;
      if (this.hopT <= 0){ this.vy=-480; this.hopT=1.5; }
    }
    let sp = this.speed;
    if (this.kind === 'guardian' && this.phase === 'warning') sp=0;
    if (this.kind === 'shell' && this.state === 'live') sp = 300; // was 430, now more controllable
    if (this.kind === 'shell' && this.state === 'idle') sp = 0;
    this.vx = this.dir * sp;
    this.vy = Math.min(this.vy + PHYS.GRAV*dt, PHYS.MAX_FALL);
    this.prevBottom = this.y + this.h;
    moveAndCollide(lv, this, dt);
    if (this.boundedPatrol && !(this.kind==='shell' && this.state==='live')){
      if (this.x<this.patrolMin){ this.x=this.patrolMin; this.dir=1; }
      if (this.x+this.w>this.patrolMax){ this.x=this.patrolMax-this.w; this.dir=-1; }
    }
    if (this.onWall){
      this.dir *= -1;
      if (this.kind === 'shell' && this.state === 'live'){
        AudioSys.sfx.bounce();
        G.shake(1.5, 0.1);
      }
    }
    // turn around at ledges (walkers & idle/walking shells)
    if (this.onGround && !(this.kind === 'shell' && this.state === 'live')){
      const aheadX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
      const belowY = this.y + this.h + 6;
      if (!tileSolidAt(lv, aheadX, belowY)) this.dir *= -1;
    }
    this.walkT += dt;
    if (this.y > lv.h*TILE + 100) this.remove = true;
    if (this.kind === 'shell' && this.state === 'live' && (this.x < cam - 260 || this.x > cam + 1220)) this.remove = true;
  }
}

// Guardian bolts are separate from player shots and freeze in bonus rooms.
class EnemyBolt {
  constructor(x,y,dir,speed){ this.x=x; this.y=y; this.vx=dir*speed; this.r=7; this.t=0; this.remove=false; }
  update(dt,G){
    this.t+=dt; this.x+=this.vx*dt;
    if (this.t>4 || this.x<G.cam.x-160 || this.x>G.cam.x+VIEW_W+160 || tileSolidAt(G.level,this.x,this.y)){
      this.remove=true; return;
    }
    if (circleRect(this,G.player)){
      this.remove=true;
      if (G.player.invT<=0) G.hurtPlayer({x:this.x,w:14});
      else G.particles.spark(this.x,this.y,'#ffe14d',4);
    }
  }
}

// ---------------- items ----------------
class Item {
  constructor(type, x, y){
    this.type = type;
    this.w = 26; this.h = 26;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.t = 0; this.remove = false;
    this.emerge = 0; this.startY = y; this.y0 = y;   // y0 = final (rest) position
    this.staticItem = (type === 'gem');
  }
  pickupBox(){
    // Match the visible bob rather than leaving an invisible box behind.
    const y = this.y + (this.staticItem ? Math.sin(gameT*3 + this.x*0.07)*3 : 0);
    return { x: this.x, y, w: this.w, h: this.h };
  }
  update(dt, G){
    this.t += dt;
    if (this.staticItem) return;
    if (this.emerge > 0){
      this.emerge -= dt;
      const k = 1 - Math.max(0, this.emerge)/0.45;
      this.y = this.startY + (this.y0 - this.startY) * k;
      if (this.emerge <= 0){
        this.emerge = 0;
        this.y = this.y0;
        this.vx = (G.player.facing > 0 ? 1 : -1) * 80;
      }
      return;
    }
    this.vy = Math.min(this.vy + (this.type === 'star' ? 1100 : 1200) * dt, 800);
    this.prevBottom = this.y + this.h;
    moveAndCollide(G.level, this, dt);
    if (this.onWall) this.vx *= -1;
    if (this.onGround && this.type === 'star') this.vy = -380;  // nova bounces
    if (this.y > G.level.h*TILE + 80 || this.t > 14) this.remove = true;
  }
}

// ---------------- coin pop (auto-collect gem from blocks) ----------------
class CoinPop {
  constructor(x, y){
    this.x = x; this.y = y;
    this.vx = (Math.random()*2-1) * 30;
    this.vy = -520;
    this.t = 0; this.life = 0.6; this.remove = false;
  }
  update(dt){
    this.t += dt;
    this.vy += 1500*dt;
    this.x += this.vx*dt;
    this.y += this.vy*dt;
    if (this.t >= this.life) this.remove = true;
  }
}

// ---------------- player projectile ----------------
class Projectile {
  constructor(x, y, dir){
    this.x = x; this.y = y;
    this.vx = dir * 540;
    this.vy = -80;
    this.r = 7;
    this.t = 0;
    this.ground = false;
    this.remove = false;
  }
  update(dt, G){
    const lv = G.level;
    this.t += dt;
    if (this.t > 4.5){ this.remove = true; return; }
    this.vy = Math.min(this.vy + 900*dt, 800);
    // horizontal
    this.x += this.vx*dt;
    const dir = this.vx > 0 ? 1 : -1;
    const fx = this.x + dir*this.r;
    if (tileSolidAt(lv, fx, this.y) || tileSolidAt(lv, fx, this.y-6) || tileSolidAt(lv, fx, this.y+6)){
      G.particles.spark(this.x + dir*this.r, this.y, '#fff', 5);
      AudioSys.sfx.hitWall();
      this.remove = true;
      return;
    }
    // vertical
    this.y += this.vy*dt;
    const fy = this.y + this.r;
    if (this.vy > 0 && tileSolidAt(lv, this.x, fy)){
      const ty = Math.floor(fy/TILE);
      this.y = ty*TILE - this.r;
      if (Math.abs(this.vy) > 150){
        this.vy = -this.vy * 0.55;
        AudioSys.sfx.bounce();
      } else {
        this.vy = 0;
        this.ground = true;
      }
    } else if (this.vy < 0){
      const fy2 = this.y - this.r;
      if (tileSolidAt(lv, this.x, fy2)){
        const ty = Math.floor(fy2/TILE);
        this.y = (ty+1)*TILE + this.r;
        this.vy = 0;
      }
    }
    if (this.ground){
      this.vx *= Math.max(0, 1 - 1.2*dt);
      if (Math.abs(this.vx) < 40) this.remove = true;
    }
    if (this.y > lv.h*TILE + 60) this.remove = true;
    const cam = G.cam.x;
    if (this.x < cam - 160 || this.x > cam + 1120) this.remove = true;
  }
}
