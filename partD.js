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
  teal:'#38c6da', tealD:'#1d8798', cream:'#ffe9c9',
  scarf:'#ff8c42', scarfD:'#e06a28', feet:'#7a4a24',
  flameO:'#ff7a3c', flameY:'#ffd23e', ink:'#12303c', nose:'#5a3a20',
};

// Paint Pip (the hero, a flame-tailed fox) into a fresh sprite canvas.
function paintPip(x, o){
  const P = o.pal;
  const R = (gx, gy, gw, gh, col) => { x.fillStyle = col; x.fillRect(gx*2, gy*2, gw*2, gh*2); };
  const big = o.big;
  const totalH = o.crouch ? (big ? 24 : 16) : (big ? 32 : 20);
  const footY = totalH - 2;

  if (o.crouch){
    const ty = footY - 12;
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

  // flame tail (behind, flickers per frame)
  const tailY = (big ? 12 : 9) + (o.legs === 'jump' ? -2 : 0);
  R(0, tailY, 2, 3, P.flameO);
  R(0, tailY+1, 1, 2, P.flameY);
  if (o.flame === 1) R(0, tailY-1, 1, 1, P.flameO);
  if (o.flame === 2) R(1, tailY-1, 1, 1, P.flameY);

  // ears
  R(2, 0, 3, 4, P.teal); R(11, 0, 3, 4, P.teal);
  R(3, 1, 1, 2, P.cream); R(12, 1, 1, 2, P.cream);
  // head
  R(2, 3, 12, 4, P.teal);
  R(1, 4, 14, 4, P.teal);
  // face
  R(6, 4, 8, 4, P.cream);
  if (o.face === 'dead'){
    R(10, 4, 4, 3, P.ink);
    R(11, 4, 1, 3, '#fff');
    R(13, 5, 1, 1, P.nose);
  } else {
    R(11, 4, 2, 2, P.ink);
    R(11, 4, 1, 1, '#fff');
    R(13, 6, 1, 1, P.nose);
    if (o.happy) R(9, 7, 4, 1, P.ink);
  }
  // scarf
  R(2, 8, 12, 2, P.scarf);
  R(2, 9, 4, 1, P.scarfD);
  if (o.happy){ R(1, 6, 2, 2, P.scarfD); R(13, 6, 2, 2, P.scarfD); }
  // body
  const bodyTop = 10;
  R(3, bodyTop, 10, footY-bodyTop, P.teal);
  R(5, bodyTop+1, 6, Math.max(1, footY-bodyTop-2), P.cream);
  if (big){
    R(8, 11, 5, 7, P.scarf);   // gem backpack
    R(9, 12, 3, 5, P.cream);
    R(9, 13, 1, 1, P.flameY);
  }
  // feet
  if (o.legs === 'jump'){
    R(4, footY-2, 3, 2, P.feet);
    R(9, footY-3, 3, 3, P.feet);
  } else if (o.legs){
    const L = o.legs;
    for (let i = 0; i < 2; i++){
      const lx = L[i*2], lift = L[i*2+1];
      R(lx, footY-2-lift, 3, 2, P.tealD);
      R(lx, footY-lift, 3, 2, P.feet);
    }
  } else {
    R(4, footY, 3, 2, P.feet);
    R(9, footY, 3, 2, P.feet);
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

  // ground (grass top)
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#b0713a'; x.fillRect(0,0,48,48);
  x.fillStyle = '#8a5426';
  const sp = [[6,20],[20,34],[34,16],[40,40],[14,42],[28,24],[42,28],[2,36]];
  for (const [sx,sy] of sp) x.fillRect(sx,sy,4,3);
  x.fillStyle = '#c98a4b'; x.fillRect(10,12,4,3); x.fillRect(36,40,4,3);
  x.fillStyle = '#5ec24f'; x.fillRect(0,0,48,10);
  x.fillStyle = '#3f9c39'; x.fillRect(0,7,48,3);
  x.fillStyle = '#7ad86b'; x.fillRect(0,0,48,3);
  for (let i=0;i<6;i++) x.fillRect(3+i*8, 10, 3, 4);
  t[T.GROUND] = c;

  // plain dirt
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#a0632f'; x.fillRect(0,0,48,48);
  x.fillStyle = '#7c4a1f';
  for (const [sx,sy] of sp) x.fillRect(sx,sy,4,3);
  x.fillStyle = '#c98a4b'; x.fillRect(10,12,4,3); x.fillRect(36,40,4,3);
  t[T.DIRT] = c;

  // breakable brick
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#d9803f'; x.fillRect(0,0,48,48);
  x.fillStyle = '#f2a96b'; x.fillRect(0,0,48,3);
  x.fillStyle = '#8a4a22';
  x.fillRect(0,14,48,3); x.fillRect(0,31,48,3);
  x.fillRect(14,0,3,14); x.fillRect(32,17,3,14); x.fillRect(14,34,3,14);
  x.fillStyle = '#6e3a1c'; x.fillRect(0,45,48,3);
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

  // pipes (four half-tiles)
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#2f9440'; x.fillRect(0,0,26,16); x.fillRect(4,16,22,32);
  x.fillStyle = '#4cc75e'; x.fillRect(2,2,22,12); x.fillRect(6,16,18,32);
  x.fillStyle = '#8fe09a'; x.fillRect(6,2,4,12); x.fillRect(8,16,4,32);
  x.fillStyle = '#1d6e2c'; x.fillRect(24,2,2,12); x.fillRect(22,16,2,32);
  t[T.PIPE_TL] = c;

  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#2f9440'; x.fillRect(22,0,26,16); x.fillRect(22,16,22,32);
  x.fillStyle = '#4cc75e'; x.fillRect(24,2,22,12); x.fillRect(24,16,18,32);
  x.fillStyle = '#8fe09a'; x.fillRect(40,2,4,12); x.fillRect(38,16,4,32);
  x.fillStyle = '#1d6e2c'; x.fillRect(22,2,2,12); x.fillRect(24,16,2,32);
  t[T.PIPE_TR] = c;

  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#2f9440'; x.fillRect(4,0,22,48);
  x.fillStyle = '#4cc75e'; x.fillRect(6,0,18,48);
  x.fillStyle = '#8fe09a'; x.fillRect(8,0,4,48);
  x.fillStyle = '#1d6e2c'; x.fillRect(22,0,2,48);
  t[T.PIPE_BL] = c;

  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#2f9440'; x.fillRect(22,0,22,48);
  x.fillStyle = '#4cc75e'; x.fillRect(24,0,18,48);
  x.fillStyle = '#8fe09a'; x.fillRect(38,0,4,48);
  x.fillStyle = '#1d6e2c'; x.fillRect(24,0,2,48);
  t[T.PIPE_BR] = c;

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

  // finish flag (top / mid / base)
  const pole = (xx) => {
    xx.fillStyle = '#cfd6dd'; xx.fillRect(22,0,5,48);
    xx.fillStyle = '#8f9aa5'; xx.fillRect(26,0,1,48);
  };
  c = cv(TILE,TILE); x = g2(c); pole(x);
  x.fillStyle = '#ff5a5a';
  x.beginPath(); x.moveTo(22,6); x.lineTo(2,14); x.lineTo(22,22); x.closePath(); x.fill();
  x.fillStyle = '#ffd23e'; x.beginPath(); x.arc(24,14,4,0,6.2832); x.fill();
  t.flagTop = c;
  c = cv(TILE,TILE); x = g2(c); pole(x);
  t.flagMid = c;
  c = cv(TILE,TILE); x = g2(c); pole(x);
  x.fillStyle = '#8a5a2b'; x.fillRect(14,34,20,14);
  x.fillStyle = '#6d4522'; x.fillRect(14,44,20,4);
  t.flagBase = c;

  // checkpoint pennant (top / base)
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#cfd6dd'; x.fillRect(22,0,4,48);
  x.fillStyle = '#ffd23e';
  x.beginPath(); x.moveTo(26,8); x.lineTo(44,14); x.lineTo(26,20); x.closePath(); x.fill();
  t.checkTop = c;
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#8a5a2b'; x.fillRect(16,38,16,10);
  t.checkBase = c;

  // destination building stones
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#5f7099'; x.fillRect(0,0,48,48);
  x.fillStyle = '#8fa3c8'; x.fillRect(2,2,44,44);
  x.fillStyle = '#7a8fb5';
  x.fillRect(2,24,44,3); x.fillRect(24,2,3,22); x.fillRect(12,27,3,19); x.fillRect(34,27,3,19);
  t.build0 = c;
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#5f7099'; x.fillRect(0,0,48,48);
  x.fillStyle = '#8fa3c8'; x.fillRect(2,2,44,44);
  x.fillStyle = '#d9ecff'; x.fillRect(14,12,20,16);
  x.fillStyle = '#5f7099'; x.fillRect(22,12,4,16); x.fillRect(14,18,20,4);
  x.fillStyle = '#7a8fb5'; x.fillRect(2,24,44,3);
  t.build1 = c;

  // destination door (decorative)
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#5f7099'; x.fillRect(0,0,48,48);
  x.fillStyle = '#3a2c46';
  x.beginPath(); x.moveTo(8,48); x.lineTo(8,20); x.arc(24,20,16,Math.PI,0); x.lineTo(40,48); x.closePath(); x.fill();
  x.fillStyle = '#241a30';
  x.beginPath(); x.moveTo(14,48); x.lineTo(14,24); x.arc(24,24,10,Math.PI,0); x.lineTo(34,48); x.closePath(); x.fill();
  x.fillStyle = '#ffd23e'; x.fillRect(30,32,4,5);
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
const MAIN_ROWS = [
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '..F.......', D10),                       // r0  flag
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '..F.......', D10),                       // r1  flag
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '.........o','o.........', D10, '........##','##F.......', D10), // r2
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '........##','##........', D10, '.......###','##F.......', D10), // r3
  R(D10,D10,D10,D10,D10,D10,D10,D10,D10,D10,D10, '.......###','###.......', D10, '......####','##F.......','...##.....'), // r4
  R(D10,D10,D10,D10,D10,D10, '.......oo.', D10,D10,D10, D10, '......####','####......', D10, '.....#####','##F..*****','*..##.....'), // r5
  R(D10,D10,D10,D10, '..**......', D10, '.......==.', D10,D10, '....K...BB','IBBS..oo..', D10,D10, '.o..K.o...','....######','##F..*****','*..##.....'), // r6 — second checkpoint at 124
  R('.......?..','........oo','.B?G?B....', D10, '...*...BBB','BBMBBBBB..','....oo....','.......().','..()..[]..','....K.....','......===.','....######','####K#....','===.....B.','...#######','##F..*****','*..##.....'), // r7 — second checkpoint at 124 (####K#....)
  R(D10,'........()', D10,D10, '..?.......', D10, '....==....','.......().','..[]..[]..','....K.....', D10, '...#######','####K##...', D10, '..########','##F..E****','*..##.....'), // r8 — second checkpoint at 124 (####K##...)
  R('.....ooo..','........[]', D10,D10, '..D.......', D10,D10, '.......[]B','..[]..[]..','....K....o','ooo.......','..########','########..','^^^.....oo','.###K#####','##F..E****','*..##.....'), // r9 — K at 124
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
// Balanced for accessibility: fewer enemies, walkers moved away from Q blocks.
const ENEMY_SPAWNS = [
  ['walker', 20],          // first room (19-27): the stomp lesson
  ['shell', 54],           // zone 32-61, now only shell (walker 40 removed)
  ['walker', 72],          // zone 70-104
  ['plant', 86, 6],        // single pipe-plant timing puzzle (81 removed for accessibility)
  ['walker', 98],          // near star/shot blocks — moved from 100
  ['shell', 111],          // foot of the big staircase
  ['shell', 136],          // after the staircase, near the spikes
  ['walker', 139],         // final approach
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
