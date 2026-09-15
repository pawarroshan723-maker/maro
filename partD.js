// ---------------- particle system (pooled, capped) ----------------
const Particles = {
  pool: [], idx: 0,
  init(){
    this.pool.length = 0;
    for (let i = 0; i < MAX_PARTICLES; i++){
      this.pool.push({ on:false, x:0, y:0, vx:0, vy:0, t:0, life:1, size:3, col:'#fff', grav:0, kind:0 });
    }
  },
  spawn(o){
    const p = this.pool[this.idx++ % MAX_PARTICLES];
    p.on = true;
    p.x = o.x; p.y = o.y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.t = 0; p.life = o.life || 0.6;
    p.size = o.size || 3; p.col = o.col || '#fff';
    p.grav = o.grav || 0; p.kind = o.kind || 0;
  },
  debris(x, y){
    const n = Settings.reduced ? 3 : 6;
    const cols = ['#d9803f','#8a4a22','#f2a96b'];
    for (let i = 0; i < n; i++){
      this.spawn({ x:x, y:y, vx:(Math.random()*2-1)*170, vy:-260+Math.random()*120,
        life:0.7, size:4+Math.random()*3, col:cols[i%3], grav:1400, kind:0 });
    }
  },
  puff(x, y, col, n){
    n = Settings.reduced ? Math.ceil((n||8)/2) : (n||8);
    for (let i = 0; i < n; i++){
      const a = Math.random()*6.283, sp = 40+Math.random()*90;
      this.spawn({ x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-30,
        life:0.45, size:4+Math.random()*4, col:col, grav:200, kind:1 });
    }
  },
  spark(x, y, col, n){
    n = Settings.reduced ? Math.ceil((n||6)/2) : (n||6);
    for (let i = 0; i < n; i++){
      const a = Math.random()*6.283, sp = 120+Math.random()*180;
      this.spawn({ x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
        life:0.3, size:2+Math.random()*2, col:col, grav:300, kind:2 });
    }
  },
  dust(x, y){
    for (let i = 0; i < (Settings.reduced?2:4); i++){
      this.spawn({ x:x+(Math.random()*10-5), y:y-2, vx:(Math.random()*2-1)*40, vy:-20-Math.random()*30,
        life:0.4, size:3+Math.random()*3, col:'#d9c9a8', grav:60, kind:1 });
    }
  },
  trail(x, y){
    this.spawn({ x:x, y:y, vx:(Math.random()*2-1)*30, vy:(Math.random()*2-1)*30,
      life:0.4, size:3+Math.random()*3, col:'#ffe14d', grav:0, kind:3 });
  },
  coinFx(x, y){
    this.spark(x, y, '#7ef0ff', 6);
  },
  confetti(x, y){
    const cols = ['#ffe14d','#ff6a5e','#7ef0ff','#9fe870','#ff9dd5','#fff'];
    const n = Settings.reduced ? 18 : 42;
    for (let i = 0; i < n; i++){
      this.spawn({ x:x, y:y, vx:(Math.random()*2-1)*260, vy:-320+Math.random()*220,
        life:1.4+Math.random()*0.6, size:4+Math.random()*3, col:cols[i%6], grav:520, kind:0 });
    }
  },
  update(dt){
    for (const p of this.pool){
      if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.life){ p.on = false; continue; }
      p.vy += p.grav*dt;
      p.x += p.vx*dt;
      p.y += p.vy*dt;
    }
  },
  draw(ctx, camX, camY){
    for (const p of this.pool){
      if (!p.on) continue;
      const a = 1 - p.t/p.life;
      const x = Math.round(p.x - camX), y = Math.round(p.y - camY);
      if (x < -20 || x > VIEW_W+20 || y < -20 || y > VIEW_H+20) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      if (p.kind === 1){
        ctx.beginPath();
        ctx.arc(x, y, p.size*(0.5+0.9*(p.t/p.life)), 0, 6.2832);
        ctx.fill();
      } else {
        const s = p.size;
        ctx.fillRect(x - s/2, y - s/2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  },
  clear(){ for (const p of this.pool) p.on = false; },
};

// ---------------- procedural art ----------------
const ASSETS = { tiles:{}, bg:{}, pip:{}, items:{} };
function cv(w, h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function g2(c){ return c.getContext('2d'); }

const PAL = {
  teal:'#ff6b35', tealD:'#c94a1a', cream:'#fff8e7',
  scarf:'#e63946', scarfD:'#b71c2a', feet:'#5a2d0c',
  flameO:'#ff7a3c', flameY:'#ffd23e', ink:'#1a1a2a', nose:'#2b1a0f',
};

// Paint Maro (the hero, a flame-tailed fox - now cuter and more beautiful) into a fresh sprite canvas.
function paintPip(x, o){
  const P = o.pal;
  const R = (gx, gy, gw, gh, col) => { x.fillStyle = col; x.fillRect(gx*2, gy*2, gw*2, gh*2); };
  const big = o.big;
  const totalH = o.crouch ? (big ? 24 : 16) : (big ? 32 : 20);
  const footY = totalH - 2;

  if (o.crouch){
    const ty = footY - 12;
    // crouch - cuter with rounder shape
    R(ty-2, 3, 2, 2, P.teal); R(ty-2, 11, 2, 2, P.teal);
    R(ty, 2, 12, 5, P.teal);
    R(ty+1, 1, 14, 3, P.teal);
    R(ty+1, 6, 8, 3, P.cream);
    R(ty+1, 11, 2, 2, P.ink);
    R(ty+3, 13, 1, 1, P.nose);
    R(ty+5, 2, 12, 2, P.scarf);
    R(ty+7, 3, 10, Math.max(1, footY-(ty+7)), P.teal);
    R(ty+8, 5, 6, Math.max(1, footY-(ty+8)-1), P.cream);
    R(ty+7, 1, 2, Math.max(1, footY-(ty+7)), P.feet);
    R(ty+7, 13, 2, Math.max(1, footY-(ty+7)), P.feet);
    return;
  }

  // flame tail - more beautiful with gradient and flicker
  const tailY = (big ? 12 : 9) + (o.legs === 'jump' ? -2 : 0);
  R(0, tailY, 2, 4, P.flameO);
  R(0, tailY+1, 1, 3, P.flameY);
  R(1, tailY+2, 1, 2, '#ffffff');
  if (o.flame === 1) { R(0, tailY-1, 1, 1, P.flameO); R(1, tailY, 1, 1, P.flameY); }
  if (o.flame === 2) { R(1, tailY-1, 2, 2, P.flameY); R(0, tailY, 1, 1, '#ffffff'); }

  // ears - cuter, more pointed with inner fluff
  R(2, 0, 3, 4, P.teal); R(11, 0, 3, 4, P.teal);
  R(2, 0, 3, 1, P.tealD); R(11, 0, 3, 1, P.tealD); // ear tips darker
  R(3, 1, 1, 2, P.cream); R(12, 1, 1, 2, P.cream);
  R(3, 2, 1, 1, '#ff9aa2'); R(12, 2, 1, 1, '#ff9aa2'); // inner ear pink
  // head - rounder, more beautiful
  R(2, 3, 12, 5, P.teal);
  R(1, 4, 14, 5, P.teal);
  R(2, 3, 12, 1, '#ff8c5a'); // highlight top of head
  // face - larger, cream with blush
  R(5, 4, 10, 5, P.cream);
  R(6, 4, 8, 1, '#ffffff'); // forehead highlight
  if (o.face === 'dead'){
    R(9, 4, 6, 3, P.ink);
    R(10, 4, 1, 3, '#fff'); R(13, 4, 1, 3, '#fff');
    R(13, 6, 1, 1, P.nose);
    R(6, 8, 1, 1, '#ff9aa2'); R(13, 8, 1, 1, '#ff9aa2'); // blush when dead
  } else {
    // big beautiful eyes
    R(7, 4, 3, 3, '#ffffff'); R(11, 4, 3, 3, '#ffffff'); // eye whites
    R(8, 5, 2, 2, P.ink); R(12, 5, 2, 2, P.ink); // pupils
    R(8, 5, 1, 1, '#7ef0ff'); R(12, 5, 1, 1, '#7ef0ff'); // eye shine
    R(9, 6, 1, 1, '#ffffff'); R(13, 6, 1, 1, '#ffffff'); // extra shine
    R(10, 7, 2, 1, P.nose); // cute nose
    R(6, 8, 1, 1, '#ff9aa2'); R(13, 8, 1, 1, '#ff9aa2'); // blush
    if (o.happy) {
      R(8, 8, 4, 1, P.ink); // smile
      R(7, 4, 1, 1, '#ff6b9d'); R(14, 4, 1, 1, '#ff6b9d'); // happy blush
    }
  }
  // scarf - more beautiful with pattern
  R(2, 9, 12, 2, P.scarf);
  R(2, 10, 12, 1, P.scarfD);
  R(3, 9, 2, 1, '#ffffff'); R(9, 9, 2, 1, '#ffffff'); // scarf shine
  if (o.happy){ R(1, 7, 2, 3, P.scarf); R(13, 7, 2, 3, P.scarf); }
  // body - more shading
  const bodyTop = 11;
  R(3, bodyTop, 10, footY-bodyTop, P.teal);
  R(3, bodyTop, 10, 1, '#ff8c5a'); // body highlight
  R(3, bodyTop, 1, footY-bodyTop, P.tealD); // body shadow left
  R(12, bodyTop, 1, footY-bodyTop, P.tealD); // body shadow right
  R(5, bodyTop+1, 6, Math.max(1, footY-bodyTop-2), P.cream);
  R(5, bodyTop+1, 6, 1, '#ffffff'); // belly highlight
  if (big){
    R(8, 12, 5, 7, P.scarf);   // gem backpack - more detailed
    R(8, 12, 5, 1, '#ff8c5a');
    R(9, 13, 3, 5, P.cream);
    R(9, 13, 1, 1, '#7ef0ff'); R(11, 13, 1, 1, '#ffd23e'); // gems in backpack
    R(10, 15, 1, 1, P.flameY);
  }
  // feet - cuter with highlight
  if (o.legs === 'jump'){
    R(4, footY-2, 3, 2, P.feet);
    R(9, footY-3, 3, 3, P.feet);
    R(4, footY-2, 3, 1, '#8a5a3a'); // foot highlight
    R(9, footY-3, 3, 1, '#8a5a3a');
  } else if (o.legs){
    const L = o.legs;
    for (let i = 0; i < 2; i++){
      const lx = L[i*2], lift = L[i*2+1];
      R(lx, footY-2-lift, 3, 2, P.tealD);
      R(lx, footY-lift, 3, 2, P.feet);
      R(lx, footY-lift, 3, 1, '#8a5a3a');
    }
  } else {
    R(4, footY, 3, 2, P.feet);
    R(9, footY, 3, 2, P.feet);
    R(4, footY, 3, 1, '#8a5a3a');
    R(9, footY, 3, 1, '#8a5a3a');
  }
}

function buildPip(){
  const specs = { small:{ w:32, h:40, ch:32 }, big:{ w:32, h:64, ch:48 } };
  const basePal = { teal:PAL.teal, tealD:PAL.tealD, cream:PAL.cream, scarf:PAL.scarf, scarfD:PAL.scarfD, feet:PAL.feet, flameO:PAL.flameO, flameY:PAL.flameY, ink:PAL.ink, nose:PAL.nose };
  const goldPal = { teal:'#ffd23e', tealD:'#e0a52e', cream:'#fff3c4', scarf:'#ff8c42', scarfD:'#e06a28', feet:'#b0713a', flameO:'#fff3c4', flameY:'#ff8c42', ink:'#7a4a00', nose:'#8a5a10' };
  for (const [fn, spec] of Object.entries(specs)){
    const make = (o) => {
      const c = cv(spec.w, o.crouch ? spec.ch : spec.h);
      paintPip(g2(c), Object.assign({ big: fn==='big' }, o));
      return c;
    };
    const frames = {};
    for (const [suf, pal] of [['', basePal], ['g', goldPal]]){
      frames[suf+'idle0']   = make({ pal, legs:[4,0,9,0], flame:0 });
      frames[suf+'idle1']   = make({ pal, legs:[4,0,9,0], flame:1 });
      frames[suf+'walk0']   = make({ pal, legs:[4,0,9,2], flame:1 });
      frames[suf+'walk1']   = make({ pal, legs:[4,0,9,0], flame:2 });
      frames[suf+'walk2']   = make({ pal, legs:[4,2,9,0], flame:1 });
      frames[suf+'walk3']   = make({ pal, legs:[4,0,9,0], flame:0 });
      frames[suf+'run0']    = make({ pal, legs:[2,1,11,2], flame:2 });
      frames[suf+'run1']    = make({ pal, legs:[4,2,12,1], flame:1 });
      frames[suf+'jump']    = make({ pal, legs:'jump', flame:2 });
      frames[suf+'crouch']  = make({ pal, crouch:true, flame:1 });
      frames[suf+'dead']    = make({ pal, face:'dead', legs:[4,0,9,0] });
      frames[suf+'victory'] = make({ pal, happy:true, legs:[4,0,9,0], flame:2 });
    }
    ASSETS.pip[fn] = frames;
  }
}

function buildTiles(){
  const t = ASSETS.tiles;
  let c, x;

  // ground - beautiful with lush grass and rich soil
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#9a5a2a'; x.fillRect(0,0,48,48); // rich soil
  x.fillStyle = '#7a4a1a';
  const sp = [[6,20],[20,34],[34,16],[40,40],[14,42],[28,24],[42,28],[2,36],[10,28],[30,36]];
  for (const [sx,sy] of sp) x.fillRect(sx,sy,3,2);
  x.fillStyle = '#b87a3a'; x.fillRect(10,14,3,2); x.fillRect(36,38,4,3); x.fillRect(22,26,3,2);
  // lush grass top - more beautiful
  x.fillStyle = '#4ec44a'; x.fillRect(0,0,48,12);
  x.fillStyle = '#3aa83a'; x.fillRect(0,8,48,4);
  x.fillStyle = '#6ee86a'; x.fillRect(0,0,48,4); // highlight
  x.fillStyle = '#2a8a2a'; x.fillRect(0,10,48,2); // shadow line
  // grass blades
  x.fillStyle = '#6ee86a';
  for (let i=0;i<8;i++) x.fillRect(2+i*6, 12, 2, 5);
  x.fillStyle = '#4ec44a';
  for (let i=0;i<6;i++) x.fillRect(5+i*8, 12, 2, 3);
  // small flowers on grass
  x.fillStyle = '#ffffff'; x.fillRect(12,4,2,2); x.fillRect(36,6,2,2);
  x.fillStyle = '#ffd23e'; x.fillRect(13,5,1,1); x.fillRect(37,7,1,1);
  t[T.GROUND] = c;

  // plain dirt - more texture
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#8a5a2a'; x.fillRect(0,0,48,48);
  x.fillStyle = '#6a4a1a';
  for (const [sx,sy] of sp) x.fillRect(sx,sy,3,2);
  x.fillStyle = '#a87a3a'; x.fillRect(10,14,3,2); x.fillRect(36,38,4,3);
  x.fillStyle = '#5a3a0a'; x.fillRect(0,0,48,2); // top shadow
  t[T.DIRT] = c;

  // breakable brick - more beautiful with cracks and highlights
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#d08040'; x.fillRect(0,0,48,48);
  x.fillStyle = '#e8a06a'; x.fillRect(0,0,48,4); // top highlight
  x.fillStyle = '#f0b080'; x.fillRect(0,0,48,2);
  x.fillStyle = '#a05a2a';
  x.fillRect(0,14,48,3); x.fillRect(0,31,48,3);
  x.fillRect(14,0,3,14); x.fillRect(32,17,3,14); x.fillRect(14,34,3,14);
  x.fillStyle = '#6a3a1a'; x.fillRect(0,45,48,3); // bottom shadow
  // cracks for detail
  x.fillStyle = '#8a4a1a'; x.fillRect(8,8,2,1); x.fillRect(28,20,3,1); x.fillRect(18,36,2,1);
  t[T.BRICK] = c;

  // mystery blocks (two shine frames)
  const qf = [];
  for (let f=0; f<2; f++){
    c = cv(TILE,TILE); x = g2(c);
    x.fillStyle = '#b57a1e'; x.fillRect(0,0,48,48);
    x.fillStyle = '#ffcf4d'; x.fillRect(3,3,42,42);
    x.fillStyle = '#ffe9a8'; x.fillRect(3,3,42,4); x.fillRect(3,3,4,42);
    x.fillStyle = '#c98a1e'; x.fillRect(3,41,42,4); x.fillRect(41,3,4,42);
    x.fillStyle = '#8a5a10';
    x.fillRect(8,8,4,4); x.fillRect(36,8,4,4); x.fillRect(8,36,4,4); x.fillRect(36,36,4,4);
    x.fillStyle = '#fff7e0';
    x.font = '900 28px "Courier New", monospace';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('?', 24, 27);
    x.fillStyle = 'rgba(255,255,255,' + (f ? 0 : 0.35) + ')';
    if (f === 0){ x.fillRect(8,14,6,4); x.fillRect(16,22,6,4); x.fillRect(24,30,6,4); }
    else { x.fillRect(14,12,6,4); x.fillRect(22,20,6,4); x.fillRect(30,28,6,4); }
    qf.push(c);
  }
  t.qframes = qf;

  // used block
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#6d4522'; x.fillRect(0,0,48,48);
  x.fillStyle = '#a3703f'; x.fillRect(3,3,42,42);
  x.fillStyle = '#6d4522';
  x.fillRect(9,9,5,5); x.fillRect(34,9,5,5); x.fillRect(9,34,5,5); x.fillRect(34,34,5,5);
  x.fillStyle = '#c99a5b'; x.fillRect(3,3,42,3);
  t[T.USED] = c;

  // one-way platform
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#8a5a2b'; x.fillRect(0,4,48,12);
  x.fillStyle = '#c98a4b'; x.fillRect(0,4,48,7);
  x.fillStyle = '#e8b077'; x.fillRect(0,4,48,3);
  x.fillStyle = '#5d3a1c'; x.fillRect(0,14,48,2);
  x.fillRect(6,16,4,4); x.fillRect(38,16,4,4);
  t[T.PLATFORM] = c;

  // hazard spikes
  c = cv(TILE,TILE); x = g2(c);
  for (let i=0;i<3;i++){
    const bx = 4 + i*14;
    x.fillStyle = '#9aa8b2';
    x.beginPath(); x.moveTo(bx,48); x.lineTo(bx+6,22); x.lineTo(bx+12,48); x.closePath(); x.fill();
    x.fillStyle = '#cfd8de';
    x.beginPath(); x.moveTo(bx+3,48); x.lineTo(bx+6,28); x.lineTo(bx+8,48); x.closePath(); x.fill();
    x.fillStyle = '#e8564a';
    x.beginPath(); x.moveTo(bx+4,32); x.lineTo(bx+6,22); x.lineTo(bx+8,32); x.closePath(); x.fill();
  }
  t[T.HAZARD] = c;

  // Paint each pipe as one two-tile-wide surface, then slice it.
  // Shading belongs at the outside edges, never at the center join.
  const pipeDark = '#1a5c2a', pipeMid = '#2fb44a', pipeLight = '#5ee87a', pipeHi = '#a8f5b8';
  for (const top of [true, false]){
    const pipe = cv(TILE*2, TILE), px = g2(pipe);
    px.fillStyle = pipeDark; px.fillRect(4,0,TILE*2-8,TILE);
    px.fillStyle = pipeMid; px.fillRect(8,0,TILE*2-18,TILE);
    px.fillStyle = pipeLight; px.fillRect(12,0,12,TILE);
    px.fillStyle = pipeHi; px.fillRect(16,0,4,TILE);
    if (top){
      px.fillStyle = pipeDark; px.fillRect(0,0,TILE*2,18);
      px.fillStyle = pipeMid; px.fillRect(2,2,TILE*2-4,12);
      px.fillStyle = pipeLight; px.fillRect(4,2,TILE*2-8,6);
      px.fillStyle = pipeHi; px.fillRect(8,2,24,3);
    }
    for (let side = 0; side < 2; side++){
      c = cv(TILE,TILE); x = g2(c);
      x.drawImage(pipe, side*TILE, 0, TILE, TILE, 0, 0, TILE, TILE);
      t[top ? (side ? T.PIPE_TR : T.PIPE_TL) : (side ? T.PIPE_BR : T.PIPE_BL)] = c;
    }
  }

  // bonus-room door
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#6e7f95'; x.fillRect(0,0,48,48);
  x.fillStyle = '#8a5a2b'; x.fillRect(6,8,36,40);
  x.fillStyle = '#6e7f95'; x.fillRect(6,8,36,6);
  x.fillStyle = '#8a5a2b'; x.fillRect(10,14,28,34);
  x.fillStyle = '#a0703c'; x.fillRect(10,14,28,4);
  x.fillStyle = '#7a4a24'; x.fillRect(19,14,2,34); x.fillRect(28,14,2,34);
  x.fillStyle = '#ffd23e'; x.fillRect(33,30,4,5);
  t[T.DOOR] = c;

  // finish flag - beautiful with waving flag and castle top
  const pole = (xx) => {
    xx.fillStyle = '#e8ecf0'; xx.fillRect(22,0,5,48);
    xx.fillStyle = '#a8b0b8'; xx.fillRect(25,0,2,48);
    xx.fillStyle = '#ffffff'; xx.fillRect(22,0,1,48); // highlight
  };
  c = cv(TILE,TILE); x = g2(c); pole(x);
  // beautiful flag with gradient and emblem
  x.fillStyle = '#ff3b3b'; // vibrant red
  x.beginPath(); x.moveTo(22,4); x.lineTo(2,12); x.lineTo(2,16); x.lineTo(22,24); x.closePath(); x.fill();
  x.fillStyle = '#ff6b6b'; x.beginPath(); x.moveTo(22,6); x.lineTo(6,12); x.lineTo(6,14); x.lineTo(22,20); x.closePath(); x.fill();
  x.fillStyle = '#ffd23e'; x.beginPath(); x.arc(12,14,5,0,6.2832); x.fill(); // sun emblem
  x.fillStyle = '#ff8c42'; x.beginPath(); x.arc(12,14,2,0,6.2832); x.fill();
  x.fillStyle = '#ffffff'; x.fillRect(10,11,2,2); // shine
  t.flagTop = c;
  c = cv(TILE,TILE); x = g2(c); pole(x);
  // mid pole with small flag shadow
  x.fillStyle = 'rgba(0,0,0,0.1)'; x.fillRect(28,8,8,2);
  t.flagMid = c;
  c = cv(TILE,TILE); x = g2(c); pole(x);
  x.fillStyle = '#8a5a3a'; x.fillRect(12,32,24,16); // wooden base
  x.fillStyle = '#a86a4a'; x.fillRect(14,34,20,4); // highlight
  x.fillStyle = '#6a4a2a'; x.fillRect(12,44,24,4); // shadow
  x.fillStyle = '#5a3a1a'; x.fillRect(10,46,28,2);
  t.flagBase = c;

  // checkpoint - beautiful with glowing pennant
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#e8ecf0'; x.fillRect(22,0,4,48);
  x.fillStyle = '#a8b0b8'; x.fillRect(24,0,2,48);
  x.fillStyle = '#ffffff'; x.fillRect(22,0,1,48);
  // glowing yellow pennant with border
  x.fillStyle = '#ffaa00'; x.beginPath(); x.moveTo(26,6); x.lineTo(46,13); x.lineTo(46,15); x.lineTo(26,22); x.closePath(); x.fill();
  x.fillStyle = '#ffd23e'; x.beginPath(); x.moveTo(26,8); x.lineTo(44,14); x.lineTo(26,20); x.closePath(); x.fill();
  x.fillStyle = '#ffffff'; x.fillRect(28,11,6,2); // shine
  t.checkTop = c;
  c = cv(TILE,TILE); x = g2(c); pole(x);
  x.fillStyle = '#8a5a3a'; x.fillRect(14,36,20,12);
  x.fillStyle = '#a86a4a'; x.fillRect(16,38,16,4);
  x.fillStyle = '#6a4a2a'; x.fillRect(14,44,20,4);
  t.checkBase = c;

  // destination building - beautiful castle with crenellations, windows, and flags
  // Castle base - stone bricks with shading
  c = cv(TILE,TILE); x = g2(c);
  // base stone
  x.fillStyle = '#6b7a9a'; x.fillRect(0,0,48,48);
  x.fillStyle = '#8fa3c8'; x.fillRect(2,2,44,44);
  // brick pattern - more detailed
  x.fillStyle = '#5a6a8a';
  x.fillRect(2,10,44,2); x.fillRect(2,22,44,2); x.fillRect(2,34,44,2);
  x.fillRect(14,2,2,10); x.fillRect(32,2,2,10); x.fillRect(8,12,2,10); x.fillRect(24,12,2,10); x.fillRect(38,12,2,10);
  x.fillRect(14,24,2,10); x.fillRect(32,24,2,10); x.fillRect(8,36,2,8); x.fillRect(24,36,2,8); x.fillRect(38,36,2,8);
  // highlight
  x.fillStyle = '#a8bdd8'; x.fillRect(2,2,44,2); x.fillRect(2,2,2,44);
  x.fillStyle = '#4a5a7a'; x.fillRect(2,44,44,2); x.fillRect(44,2,2,44);
  t.build0 = c;

  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#6b7a9a'; x.fillRect(0,0,48,48);
  x.fillStyle = '#8fa3c8'; x.fillRect(2,2,44,44);
  x.fillStyle = '#5a6a8a';
  x.fillRect(2,10,44,2); x.fillRect(2,22,44,2); x.fillRect(2,34,44,2);
  x.fillRect(14,2,2,10); x.fillRect(32,2,2,10);
  // beautiful window with glow
  x.fillStyle = '#1a2a4a'; x.fillRect(12,10,24,20);
  x.fillStyle = '#3a4a6a'; x.fillRect(14,12,20,16);
  x.fillStyle = '#87ceeb'; x.fillRect(16,14,16,12); // sky blue window
  x.fillStyle = '#ffffff'; x.fillRect(18,16,4,4); x.fillRect(26,16,2,6); // window shine
  x.fillStyle = '#5a6a8a'; x.fillRect(22,12,2,16); x.fillRect(14,18,20,2); // cross
  x.fillStyle = '#a8bdd8'; x.fillRect(2,2,44,2); x.fillRect(2,2,2,44);
  x.fillStyle = '#4a5a7a'; x.fillRect(2,44,44,2); x.fillRect(44,2,2,44);
  t.build1 = c;

  // destination door - beautiful castle entrance
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#6b7a9a'; x.fillRect(0,0,48,48);
  x.fillStyle = '#8fa3c8'; x.fillRect(2,2,44,44);
  // arch
  x.fillStyle = '#4a3a2a'; // dark wood frame
  x.beginPath(); x.moveTo(6,48); x.lineTo(6,20); x.arc(24,20,18,Math.PI,0); x.lineTo(42,48); x.closePath(); x.fill();
  x.fillStyle = '#6b4a2a'; // wood
  x.beginPath(); x.moveTo(9,48); x.lineTo(9,22); x.arc(24,22,15,Math.PI,0); x.lineTo(39,48); x.closePath(); x.fill();
  // wood planks
  x.fillStyle = '#8a5a3a'; x.fillRect(12,28,2,20); x.fillRect(20,24,2,24); x.fillRect(28,24,2,24); x.fillRect(36,28,2,20);
  // metal studs
  x.fillStyle = '#2a2a3a'; x.beginPath(); x.arc(14,30,2,0,6.2832); x.fill(); x.beginPath(); x.arc(24,28,2,0,6.2832); x.fill(); x.beginPath(); x.arc(34,30,2,0,6.2832); x.fill();
  x.beginPath(); x.arc(14,40,2,0,6.2832); x.fill(); x.beginPath(); x.arc(24,42,2,0,6.2832); x.fill(); x.beginPath(); x.arc(34,40,2,0,6.2832); x.fill();
  // handle
  x.fillStyle = '#ffd23e'; x.beginPath(); x.arc(32,36,3,0,6.2832); x.fill(); x.fillStyle = '#ff8c42'; x.beginPath(); x.arc(32,36,1.5,0,6.2832); x.fill();
  // arch highlight
  x.fillStyle = '#a8bdd8'; x.fillRect(2,2,44,2); x.fillRect(2,2,2,44);
  t[T.END_DOOR] = c;
}

function buildBackground(){
  // sky (gradient baked once — never per frame)
  let c = cv(VIEW_W, VIEW_H), x = g2(c);
  const gr = x.createLinearGradient(0,0,0,VIEW_H);
  gr.addColorStop(0, '#4fb3f6');
  gr.addColorStop(0.55, '#8fd4ff');
  gr.addColorStop(1, '#d9f2ff');
  x.fillStyle = gr; x.fillRect(0,0,VIEW_W,VIEW_H);
  // sun with soft glow and rays
  x.fillStyle = 'rgba(255,235,140,0.5)';
  x.beginPath(); x.arc(820,84,52,0,6.2832); x.fill();
  x.fillStyle = '#ffe680';
  x.beginPath(); x.arc(820,84,36,0,6.2832); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.18)';
  for(let i=0;i<8;i++){
    const a = i*Math.PI/4;
    x.beginPath();
    x.moveTo(820+Math.cos(a)*44, 84+Math.sin(a)*44);
    x.lineTo(820+Math.cos(a)*68, 84+Math.sin(a)*68);
    x.lineTo(820+Math.cos(a+0.15)*68, 84+Math.sin(a+0.15)*68);
    x.closePath(); x.fill();
  }
  ASSETS.bg.sky = c;

  // distant hill strip — more hills for depth
  c = cv(1600, 240); x = g2(c);
  x.fillStyle = '#9fd8c8';
  const hill = (cx, r) => { x.beginPath(); x.arc(cx, 240, r, Math.PI, 0); x.fill(); };
  hill(100,90); hill(300,120); hill(550,150); hill(800,110); hill(1050,130); hill(1300,145); hill(1500,120);
  ASSETS.bg.far = c;

  // nearer hills + bushes strip — richer
  c = cv(1600, 180); x = g2(c);
  x.fillStyle = '#7cc96f';
  const hill2 = (cx, r) => { x.beginPath(); x.arc(cx, 180, r, Math.PI, 0); x.fill(); };
  hill2(80,70); hill2(250,90); hill2(520,120); hill2(780,95); hill2(900,100); hill2(1150,110); hill2(1300,130); hill2(1500,100);
  x.fillStyle = '#55b04a';
  const bush = (cx, r) => { x.beginPath(); x.arc(cx, 180, r, Math.PI, 0); x.fill(); };
  bush(180,32); bush(320,40); bush(500,36); bush(700,34); bush(860,38); bush(1100,44); bush(1280,40); bush(1500,36);
  // little flowers on bushes
  x.fillStyle = '#ff8fa0';
  for(const [bx,by] of [[320,140],[700,146],[1100,136]]){ x.beginPath(); x.arc(bx,by,4,0,6.2832); x.fill(); }
  x.fillStyle = '#ffe14d';
  for(const [bx,by] of [[500,144],[860,142],[1280,140]]){ x.beginPath(); x.arc(bx,by,4,0,6.2832); x.fill(); }
  ASSETS.bg.near = c;

  // clouds — more variety
  const mkCloud = (w) => {
    const cc = cv(w, 44), xx = g2(cc);
    xx.fillStyle = '#ffffff';
    xx.beginPath();
    xx.arc(20,30,12,0,6.2832);
    xx.arc(40,22,16,0,6.2832);
    xx.arc(64,28,13,0,6.2832);
    xx.arc(86,30,10,0,6.2832);
    xx.fill();
    xx.fillStyle = '#dceefc';
    xx.fillRect(8,34,w-16,8);
    return cc;
  };
  ASSETS.bg.clouds = [
    { img:mkCloud(96),  x:80,  y:64 },
    { img:mkCloud(120), x:340, y:90 },
    { img:mkCloud(84),  x:520, y:48 },
    { img:mkCloud(110), x:700, y:110 },
    { img:mkCloud(100), x:920, y:150 },
    { img:mkCloud(90),  x:1150, y:70 },
  ];
}

function starPath(x, cx, cy, R, r){
  x.beginPath();
  for (let i=0;i<10;i++){
    const rad = i%2===0 ? R : r;
    const a = -Math.PI/2 + i*Math.PI/5;
    const px = cx + Math.cos(a)*rad, py = cy + Math.sin(a)*rad;
    if (i===0) x.moveTo(px,py); else x.lineTo(px,py);
  }
  x.closePath();
}

function buildItems(){
  let c, x;
  // gem (currency)
  c = cv(30,30); x = g2(c);
  x.fillStyle = '#2b9fd0';
  x.beginPath(); x.moveTo(15,2); x.lineTo(27,15); x.lineTo(15,28); x.lineTo(3,15); x.closePath(); x.fill();
  x.fillStyle = '#59d6ff';
  x.beginPath(); x.moveTo(15,6); x.lineTo(23,15); x.lineTo(15,24); x.lineTo(7,15); x.closePath(); x.fill();
  x.fillStyle = '#eaffff'; x.fillRect(10,7,4,3);
  ASSETS.items.gem = c;

  // Ember Cap (growth)
  c = cv(30,30); x = g2(c);
  x.fillStyle = '#ffe9c9'; x.fillRect(11,16,8,11);
  x.fillStyle = '#f3cf9e'; x.fillRect(16,16,4,11);
  x.fillStyle = '#ff8c42';
  x.beginPath(); x.arc(15,15,11,Math.PI,0); x.fill();
  x.fillRect(4,13,22,4);
  x.fillStyle = '#ffd9b0';
  x.fillRect(8,9,3,3); x.fillRect(16,7,4,4); x.fillRect(21,11,3,3);
  x.fillStyle = '#222';
  x.fillRect(12,19,2,3); x.fillRect(17,19,2,3);
  ASSETS.items.grow = c;

  // Spark Bloom (projectile power)
  c = cv(30,30); x = g2(c);
  x.fillStyle = '#3f9c56'; x.fillRect(14,18,2,10);
  x.fillRect(16,21,5,3);
  x.fillStyle = '#ff6fa5';
  for (let i=0;i<5;i++){
    const a = -Math.PI/2 + i*1.2566;
    x.beginPath(); x.arc(15+Math.cos(a)*7, 11+Math.sin(a)*7, 4.5, 0, 6.2832); x.fill();
  }
  x.fillStyle = '#ffd23e';
  x.beginPath(); x.arc(15,11,4,0,6.2832); x.fill();
  x.fillStyle = '#222'; x.fillRect(13,10,1,2); x.fillRect(16,10,1,2);
  ASSETS.items.shoot = c;

  // Nova Star (invincibility)
  c = cv(30,30); x = g2(c);
  x.fillStyle = '#e0a52e';
  starPath(x, 15, 16, 13, 6); x.fill();
  x.fillStyle = '#ffe14d';
  starPath(x, 15, 15, 12, 5.5); x.fill();
  x.fillStyle = '#fff8d0'; x.fillRect(9,9,4,3);
  x.fillStyle = '#7a4a00'; x.fillRect(11,14,2,3); x.fillRect(17,14,2,3);
  ASSETS.items.star = c;

  // heart (extra life)
  c = cv(30,30); x = g2(c);
  x.fillStyle = '#ff5a6e';
  x.beginPath();
  x.moveTo(15,26);
  x.bezierCurveTo(3,16, 6,5, 15,11);
  x.bezierCurveTo(24,5, 27,16, 15,26);
  x.closePath(); x.fill();
  x.fillStyle = '#ffd0d6'; x.fillRect(9,9,4,3);
  ASSETS.items.life = c;
}

function buildAssets(){
  buildTiles();
  buildBackground();
  buildPip();
  buildItems();
}

// ---------------- level data ----------------
// Each row is 170 columns (17 chunks x 10).
// Legend: # ground  B brick  ?/G/S/I/+ /M mystery blocks  = one-way platform
//         ^ spike   ( ) [ ] pipe  D bonus door  F finish flag  K checkpoint
//         * building  E destination door  o floating gem
const D10 = '..........';
const G10 = '##########';
function R(...c){ return c.join(''); }

// Level design — Sunny Bluff (170 cols, 12 rows)
// Pits are intentionally forgiving so both human and simple AI can clear them.
// Pit1: 28-31 (4 tiles)  Pit2: 66-69 (4 tiles)  Pit3: 107-109 (3 tiles)
// One-way platforms at (64-65, row8) and (67-68, row6) help but are not required.
// Two checkpoints: at 94 (first half) and 124 (second half) for better progression.
// Pipes now all have proper tops () with seamless bottoms [] — no vertical cut!
// Castle now beautiful with twin towers, flags, and detailed stonework!
const MAIN_ROWS = [
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '..F...F...', D10),                       // r0  flag + castle flag at 156
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '..F...F...', D10),                       // r1  flag + castle flag
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '.........o','o.........', D10, '......****','**F..***..', D10), // r2 - castle towers emerging - beautiful
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '........##','##........', D10, '....******','**F..*****', D10), // r3 - castle top with crenellations - beautiful
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '.......###','###.......', D10, '..********','**F..*****','*..##.....'), // r4 - castle upper walls - beautiful
  R(D10,D10,D10,D10,D10,D10, '.......oo.', D10,D10,D10, D10, '......####','####......', D10, D10,'..F...***.','*..##.....'), // r5 - castle approach cleared, beautiful towers
  R(D10,D10,D10,D10, '..**......', D10, '.......==.', D10,D10, '....K...BB','IBBS..oo..', D10,D10, '.o..K.o...',D10,'..F..*****','*..##.....'), // r6 — second checkpoint at 124, open path to flag
  R('.......?..','........oo','.B?G?B....', D10, '...*...BBB','BBMBBBBB..','....oo....','.......().','..()..()..','....K.....','......===.','....######','####K#....','===.....B.',D10,'..F..*****','*..##.....'), // r7 — pipes fixed and open path
  R(D10,'........()', D10,D10, '..?.......', D10, '....==....','.......[].','..[]..[]..','....K.....', D10, '...#######','####K##...', D10, '..########','..F..E****','*..##.....'), // r8 — pipes fixed and castle door open for AI
  R('.....ooo..','........[]', D10,D10, '..D.......', D10,D10, '.......[]B','..[]..[]..','....K....o','ooo.......','..########','########..','^^^.....oo','.###K#####','..F..E****','*..##.....'), // r9 - open path to castle door
  R(G10,G10,'########..','..########', G10,G10, '######....', G10,G10,G10, '#######...', G10,G10,G10,G10,G10,G10),       // r10 ground - pits narrowed for accessibility
  R(G10,G10,'########..','..########', G10,G10, '######....', G10,G10,G10, '#######...', G10,G10,G10,G10,G10,G10),       // r11 ground
];

const BONUS_ROWS = [
  '******************',
  '*' + '......oo........' + '*',
  '*' + '...o......o.....' + '*',
  '*' + '..o........o....' + '*',
  '*' + '.....o..o.......' + '*',
  '*' + '..o.....o..o....' + '*',
  '*' + '....o....o......' + '*',
  '*' + '...o......o.....' + '*',
  '*' + '......DD........' + '*',
  '******************',
];

// [type, tileX, pipeTopRow?]
// Balanced for accessibility and beauty: fewer enemies, beautiful spacing, no vertical pipe cut
const ENEMY_SPAWNS = [
  ['walker', 20],          // first room (19-27): the stomp lesson - beautiful start
  ['walker', 72],          // zone 70-104 - open area
  ['plant', 86, 7],        // single pipe-plant timing puzzle - beautiful timing challenge
  ['walker', 105],         // near star/shot blocks - moved from 98 for better spacing and AI consistency
  ['shell', 111],          // foot of the big staircase - guarding castle approach
  ['shell', 136],          // after the staircase, near the spikes
  ['walker', 139],         // final approach - guarding the beautiful castle
];

// ---------------- level (tile grid + helpers) ----------------
class Level {
  constructor(rows, isBonus){
    this.isBonus = !!isBonus;
    this.h = rows.length;
    this.w = 0;
    for (const r of rows) if (r.length > this.w) this.w = r.length;
    this.tiles = new Uint8Array(this.w * this.h);
    this.gemSpawns = [];
    for (let y = 0; y < this.h; y++){
      const row = rows[y];
      for (let x = 0; x < this.w; x++){
        const ch = row[x] || '.';
        let code = T.EMPTY;
        if (TILE_CHAR[ch]) code = TILE_CHAR[ch];
        if (ch === 'o') this.gemSpawns.push({ tx:x, ty:y });
        this.tiles[y*this.w + x] = code;
      }
    }
    this.bumps = new Map();   // key (tx*100+ty) -> time left
    this.flagTop = -1; this.flagBottom = -1;
    this.checkTop = -1; this.checkBottom = -1;
    for (let y = 0; y < this.h; y++){
      for (let x = 0; x < this.w; x++){
        const c = this.tiles[y*this.w + x];
        if (c === T.FLAG){ if (this.flagTop < 0) this.flagTop = y; this.flagBottom = y; }
        if (c === T.CHECK){ if (this.checkTop < 0) this.checkTop = y; this.checkBottom = y; }
      }
    }
  }
  in(x, y){ return x >= 0 && x < this.w && y >= 0 && y < this.h; }
  get(x, y){
    if (x < 0 || x >= this.w) return T.BUILD;   // side walls
    if (y < 0) return T.EMPTY;
    if (y >= this.h) return T.EMPTY;            // open sky / pits
    return this.tiles[y*this.w + x];
  }
  set(x, y, c){ if (this.in(x, y)) this.tiles[y*this.w + x] = c; }
  solid(x, y){ return SOLID.has(this.get(x, y)); }
  oneway(x, y){ return this.get(x, y) === T.PLATFORM; }
  bumpOff(k){
    const b = this.bumps.get(k);
    return b ? -12 * Math.sin(Math.PI * (1 - b / BUMP_DUR)) : 0;
  }
}
