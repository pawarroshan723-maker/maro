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
    this.idx = (this.idx + 1) % MAX_PARTICLES;
    const p = this.pool[this.idx];
    p.on = true;
    p.x = o.x; p.y = o.y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.t = 0; p.life = o.life || 0.6;
    p.size = o.size || 3; p.col = o.col || '#fff';
    p.grav = o.grav || 0; p.kind = o.kind || 0;
  },
  debris(x, y){
    const n = Settings.effectsReduced ? 3 : 6;
    const cols = ['#d9803f','#8a4a22','#f2a96b'];
    for (let i = 0; i < n; i++){
      this.spawn({ x:x, y:y, vx:(Math.random()*2-1)*170, vy:-260+Math.random()*120,
        life:0.7, size:4+Math.random()*3, col:cols[i%3], grav:1400, kind:0 });
    }
  },
  puff(x, y, col, n){
    n = Settings.effectsReduced ? Math.ceil((n||8)/2) : (n||8);
    for (let i = 0; i < n; i++){
      const a = Math.random()*6.283, sp = 40+Math.random()*90;
      this.spawn({ x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-30,
        life:0.45, size:4+Math.random()*4, col:col, grav:200, kind:1 });
    }
  },
  spark(x, y, col, n){
    n = Settings.effectsReduced ? Math.ceil((n||6)/2) : (n||6);
    for (let i = 0; i < n; i++){
      const a = Math.random()*6.283, sp = 120+Math.random()*180;
      this.spawn({ x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
        life:0.3, size:2+Math.random()*2, col:col, grav:300, kind:2 });
    }
  },
  dust(x, y){
    for (let i = 0; i < (Settings.effectsReduced?2:4); i++){
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
    const n = Settings.effectsReduced ? 18 : 42;
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
  const R = (gx, gy, w, h, color) => {
    x.fillStyle = color; x.fillRect(Math.round(gx)*2, Math.round(gy)*2, w*2, h*2);
  };
  const big = o.big, crouch = o.crouch;
  const H = crouch ? (big ? 24 : 16) : (big ? 32 : 20);
  const phase = o.phase || 0;
  const moving = o.pose === 'walk' || o.pose === 'run';
  const running = o.pose === 'run';
  const jump = o.pose === 'jump', fall = o.pose === 'fall';
  const air = jump || fall;
  const bob = moving ? (phase % 2) : (o.breathe || 0);
  const headY = crouch ? (big ? 6 : 2) : bob;
  const headH = big ? 13 : 10;
  const bodyY = headY + headH - 1;
  const hipY = crouch ? H-4 : (big ? 25 : 15);
  const ink = '#65352f', light = '#ffa85c', boot = '#34495c';
  const swing = moving ? [ -2, 0, 2, 0 ][phase % 4] : 0;

  // Curved, cream-tipped tail behind the body; it lifts during a leap.
  const tailY = Math.min(H-7, hipY-4) + (jump ? -3 : 0) + (o.flame === 1 ? -1 : 0);
  R(3,tailY,5,7,ink); R(1,tailY-3,4,7,ink);
  R(2,tailY-3,3,5,P.cream); R(3,tailY+1,4,5,P.teal);
  R(4,tailY+2,4,3,light); R(2,tailY-2,2,2,'#ffffff');

  // Far arm and leg use deeper shading for readable depth.
  const armY = bodyY+1;
  const farHand = crouch ? H-5 : armY+3-swing;
  R(7,armY,3,Math.max(2,farHand-armY+2),P.tealD);
  R(7,farHand,3,2,P.cream);
  const footY = H-3;
  const legLen = big ? 6 : 3;
  const liftL = jump ? 3 : (moving ? [0,0,running ? 3 : 2,1][phase % 4] : 0);
  const liftR = jump ? 1 : (moving ? [running ? 3 : 2,1,0,0][phase % 4] : 0);
  const lx = crouch ? 7 : 9 + (running ? swing : 0);
  const rx = crouch ? 15 : 15 - (running ? swing : 0);
  for (const [px,lift] of [[lx,liftL],[rx,liftR]]){
    R(px,footY-legLen-lift,3,legLen,ink);
    R(px,footY-legLen-lift,2,Math.max(1,legLen-1),P.tealD);
    R(px-1,footY-lift,5,3,ink);
    R(px,footY-lift,4,2,boot);
    R(px,footY-lift,3,1,'#7798aa');
  }

  // Compact torso and rounded belly, not a stretched vertical rectangle.
  R(8,bodyY,10,Math.max(3,hipY-bodyY+1),ink);
  R(9,bodyY,8,Math.max(2,hipY-bodyY),P.teal);
  R(10,bodyY+1,6,Math.max(2,hipY-bodyY-1),P.cream);
  if (big){
    R(9,hipY-2,8,2,boot); R(12,hipY-2,2,2,'#ffd36b');
  }
  // Red scarf with a fluttering end and a highlighted knot.
  R(5,bodyY+(phase%2),5,2,P.scarfD);
  R(4,bodyY+1+(phase%2),3,2,P.scarf);
  R(8,bodyY,10,2,P.scarfD); R(9,bodyY,8,1,P.scarf);
  R(16,bodyY,2,3,P.scarf); R(16,bodyY,1,1,'#ffb79c');

  // Pointed ears, rounded cheeks and cream muzzle.
  R(7,headY,4,6,ink); R(16,headY,4,6,ink);
  R(8,headY+1,2,4,P.teal); R(17,headY+1,2,4,P.teal);
  R(9,headY+2,1,2,'#ffc0a4'); R(17,headY+2,1,2,'#ffc0a4');
  R(7,headY+4,13,headH-5,ink);
  R(6,headY+5,15,headH-7,ink);
  R(8,headY+3,11,headH-4,P.teal);
  R(7,headY+5,13,headH-6,P.teal);
  R(9,headY+3,7,1,light); R(8,headY+4,3,1,light);
  const eyeY = headY + (big ? 6 : 4);
  const muzzleY = headY+headH-4;
  R(10,muzzleY,10,3,P.cream); R(12,muzzleY+2,6,1,P.cream);
  R(19,muzzleY,2,2,ink); R(19,muzzleY,1,1,'#ac7770');
  if (o.face === 'dead'){
    for (const ex of [11,16]){
      R(ex,eyeY,1,1,ink); R(ex+2,eyeY,1,1,ink);
      R(ex+1,eyeY+1,1,1,ink); R(ex,eyeY+2,1,1,ink); R(ex+2,eyeY+2,1,1,ink);
    }
  } else if (o.blink || o.happy){
    R(11,eyeY+1,3,1,ink); R(16,eyeY+1,3,1,ink);
    if (o.happy){ R(11,eyeY,1,1,ink); R(16,eyeY,1,1,ink); }
  } else {
    for (const ex of [11,16]){
      R(ex,eyeY,3,3,'#ffffff'); R(ex+1,eyeY+1,2,2,ink);
      R(ex+1,eyeY,1,1,'#ffffff');
    }
  }
  R(8,muzzleY,2,1,'#ef987f'); R(15,muzzleY+2,2,1,ink);

  // Foreground arm: counter-swings with the stride, reaches up in air,
  // and rests on bent knees when crouching. Every pose stays inside its canvas.
  let handY = crouch ? H-6 : armY+3+swing;
  let handX = 18;
  if (jump || o.happy){ handY = headY+3; handX = 21; }
  else if (fall){ handY = armY; handX = 21; }
  R(17,Math.min(armY,handY),3,Math.abs(handY-armY)+2,ink);
  R(18,Math.min(armY,handY),2,Math.abs(handY-armY)+1,P.teal);
  R(handX-1,handY,3,3,ink); R(handX,handY,2,2,P.cream);
}

function buildPip(){
  const specs = { small:{ w:48, h:40, ch:32 }, big:{ w:48, h:64, ch:48 } };
  const basePal = { ...PAL };
  const goldPal = { ...PAL, teal:'#ffd35b', tealD:'#c28b36', cream:'#fff5cd', scarf:'#ed7843', scarfD:'#b44736' };
  for (const [fn, spec] of Object.entries(specs)){
    const make = (o) => {
      const c = cv(spec.w, o.crouch ? spec.ch : spec.h);
      paintPip(g2(c), Object.assign({ big:fn==='big' }, o));
      return c;
    };
    const frames = {};
    for (const [suf,pal] of [['',basePal],['g',goldPal]]){
      frames[suf+'idle0'] = make({pal});
      frames[suf+'idle1'] = make({pal,breathe:1,flame:1});
      frames[suf+'blink'] = make({pal,blink:true});
      for (let phase=0; phase<4; phase++){
        frames[suf+'walk'+phase] = make({pal,pose:'walk',phase,flame:phase%2});
        frames[suf+'run'+phase] = make({pal,pose:'run',phase,flame:phase%2});
      }
      frames[suf+'jump'] = make({pal,pose:'jump'});
      frames[suf+'fall'] = make({pal,pose:'fall'});
      frames[suf+'crouch'] = make({pal,crouch:true});
      frames[suf+'crouch1'] = make({pal,crouch:true,flame:1,blink:true});
      frames[suf+'dead'] = make({pal,face:'dead',pose:'fall'});
      frames[suf+'victory'] = make({pal,happy:true});
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

  // armoured gem cache — only a fireball or a bowling shell can crack it
  c = cv(TILE,TILE); x = g2(c);
  x.fillStyle = '#2c3348'; x.fillRect(0,0,48,48);
  x.fillStyle = '#404b66'; x.fillRect(3,3,42,42);
  x.fillStyle = '#565f7d'; x.fillRect(6,6,36,36);
  x.fillStyle = '#7c86a8'; x.fillRect(6,6,36,4); x.fillRect(6,6,4,36);
  x.fillStyle = '#20263a'; x.fillRect(6,38,36,4); x.fillRect(38,6,4,36);
  // rivets
  x.fillStyle = '#98a3c4';
  for (const [rx,ry] of [[10,10],[34,10],[10,34],[34,34]]) x.fillRect(rx,ry,4,4);
  // gem emblem behind bars
  x.fillStyle = '#59d6ff';
  x.beginPath(); x.moveTo(24,16); x.lineTo(32,24); x.lineTo(24,32); x.lineTo(16,24); x.closePath(); x.fill();
  x.fillStyle = '#eaffff'; x.fillRect(20,20,5,4);
  x.fillStyle = '#151a28';
  x.fillRect(20,14,3,20); x.fillRect(26,14,3,20);
  t[T.VAULT] = c;

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
  // One tall entrance, sliced into two tiles rather than repeating two doors.
  const entrance = cv(TILE,TILE*2);
  g2(entrance).drawImage(c,0,0,TILE,TILE*2);
  for (let half = 0; half < 2; half++){
    const tile = cv(TILE,TILE);
    g2(tile).drawImage(entrance,0,half*TILE,TILE,TILE,0,0,TILE,TILE);
    t[half ? 'endDoorBottom' : 'endDoorTop'] = tile;
  }
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
  // Separate sunset layers keep the original course artwork unchanged.
  const sunset = ASSETS.sunset = {};
  sunset.sky = cv(VIEW_W, VIEW_H);
  const sx = g2(sunset.sky), gradient = sx.createLinearGradient(0,0,0,VIEW_H);
  gradient.addColorStop(0,'#514779'); gradient.addColorStop(0.6,'#df8a91'); gradient.addColorStop(1,'#ffd2a0');
  sx.fillStyle = gradient; sx.fillRect(0,0,VIEW_W,VIEW_H);
  sx.fillStyle = '#ffe8aa'; sx.beginPath(); sx.arc(800,210,54,0,Math.PI*2); sx.fill();
  for (const [name,color] of [['far','#87759e'],['near','#594e79']]){
    const source = ASSETS.bg[name], layer = cv(source.width,source.height), lx = g2(layer);
    lx.drawImage(source,0,0); lx.globalCompositeOperation = 'source-atop';
    lx.fillStyle = color; lx.fillRect(0,0,layer.width,layer.height);
    sunset[name] = layer;
  }
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

// Drops hidden gem blocks into open air only.
//
// A hidden block has to be *reachable* to be a secret rather than a bug: it
// needs headroom above, a clean run-up below (otherwise the jump that would
// reveal it bonks a ceiling first) and solid ground somewhere underneath to
// jump from. Every candidate is validated before it is written, and the search
// is seeded so the same course always hides its gems in the same places.
// Works on both string rows (hand-authored courses) and array rows (generated).
function hideGemsInAir(rows, count, seed){
  const h = rows.length, w = rows[0].length;
  const cell = (x, y) => (x >= 0 && x < w && y >= 0 && y < h) ? (rows[y][x] || '.') : '#';
  const isSolid = (x, y) => SOLID.has(TILE_CHAR[cell(x, y)] || T.EMPTY);
  // The surface Maro would stand on in this column: the topmost solid tile
  // that has two clear rows above it (a big Maro needs both).
  const standRow = (x) => {
    for (let r = 0; r < h; r++){
      if (isSolid(x, r) && !isSolid(x, r-1) && !isSolid(x, r-2)) return r;
    }
    return -1;
  };
  let placed = 0;
  for (let attempt = 0; attempt < 600 && placed < count; attempt++){
    const x = 5 + Math.floor(shash(seed, attempt, 7) * (w - 10));
    const y = 3 + Math.floor(shash(seed, attempt, 13) * 3);      // rows 3-5
    if (cell(x, y) !== '.') continue;
    const sr = standRow(x);
    // Needs a real jump to reach, not merely head height when standing.
    if (sr < 0 || sr - y < 3) continue;
    // Clear air from just under the block down to the standing surface, plus
    // headroom above, so the jump that reveals it can actually be made.
    let open = true;
    for (let r = y + 1; r < sr && open; r++) if (cell(x, r) !== '.') open = false;
    for (let d = 1; d <= 3 && open; d++) if (cell(x, y - d) !== '.') open = false;
    if (!open) continue;
    if (typeof rows[y] === 'string') rows[y] = rows[y].slice(0, x) + 'h' + rows[y].slice(x + 1);
    else rows[y][x] = 'h';
    placed++;
  }
  return placed;
}

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
  R(D10,D10,D10,D10, D10, D10, '.......==.', D10,D10, '....K...BB','IBBS..oo..', D10,'....K.....', '.o....o...',D10,'..F..*****','*..##.....'), // r6 — second checkpoint at 124, open path to flag
  R('.......?..','........oo','.B?G?B....', D10, '.......BBB','BBMBBBBB..','....oo....','.......().','..()..()..','....K.....','......===.','....######','####K#....','===.....B.',D10,'..F..*****','*..##.....'), // r7 — pipes fixed and open path
  R(D10,'........()', D10,D10, '..?.......', D10, '....==....','.......[].','..[]..[]..','....K.....', D10, '...#######','####K##...', D10, '..########','..F..E****','*..##.....'), // r8 — pipes fixed and castle door open for AI
  R('.....ooo..','........[]', D10,D10, '..D.......', D10,D10, '.......[]B','..[]..[]..','....K....o','ooo.......','..########','########..','^^^.....oo','.#########','..F..E****','*..##.....'), // r9 - open path to castle door
  R(G10,G10,'########..','..########', G10,G10, '######....', G10,G10,G10, '#######...', G10,G10,G10,G10,G10,G10),       // r10 ground - pits narrowed for accessibility
  R(G10,G10,'########..','..########', G10,G10, '######....', G10,G10,G10, '#######...', G10,G10,G10,G10,G10,G10),       // r11 ground
];

// Rebuild the destination silhouette without suspended approach masonry.
// Keep the finish lane and two-tile entrance non-solid for the clear walk.
for (let row = 0; row < 10; row++){
  const cells = MAIN_ROWS[row].split('');
  for (let col = 142; col <= 160; col++){
    if (cells[col] === '*' || cells[col] === 'F' || cells[col] === 'E') cells[col] = '.';
  }
  if (row >= 2) cells[152] = 'F';
  if (row === 2 || row === 3) cells[156] = 'F';
  if (row >= 4){
    const right = row === 4 ? 158 : 160;
    for (let col = 155; col <= right; col++) cells[col] = '*';
  }
  if (row === 8 || row === 9) cells[155] = 'E';
  MAIN_ROWS[row] = cells.join('');
}

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
// Two blind-jump secrets: a gem only shows itself if Maro jumps into nothing.
hideGemsInAir(BONUS_ROWS, 2, 211);

// [type, tileX, pipeTopRow?]
// Balanced for accessibility and beauty: fewer enemies, beautiful spacing, no vertical pipe cut
// Stage 1 secrets: three hidden gem blocks, each validated to hang in reachable
// open air with a clean run-up and solid ground beneath.
hideGemsInAir(MAIN_ROWS, 3, 101);

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
// Stage 2: a new course with three short ravines, pipe gardens and gem routes.
const STAGE2_ROWS = (() => {
  const rows = Array.from({length:12}, (_, y) => Array(170).fill(y >= 10 ? '#' : '.'));
  const put = (x,y,text) => { for (let i=0;i<text.length;i++) rows[y][x+i] = text[i]; };
  for (const start of [32,69,123]) for (let y=10;y<12;y++) put(start,y,'...');
  for (const [x,y] of [[24,8],[58,8],[88,7],[118,8]]){
    put(x,y,'()'); for (let r=y+1;r<10;r++) put(x,r,'[]');
  }
  for (const [x,text] of [[9,'BGB'],[36,'B?B'],[51,'BSB'],[79,'BMB'],[103,'BIB'],[130,'B?B']]) put(x,7,text);
  put(42,9,'D');
  // Optional raised paths reward exploration without blocking the ground route.
  put(30,8,'==='); put(67,8,'=='); put(70,7,'===');
  put(95,8,'==='); put(121,8,'=====');
  for (const x of [60,114]) for (let y=7;y<10;y++) put(x,y,'K');
  for (const [x,y,text] of [[6,9,'ooo'],[15,9,'oo'],[24,7,'oo'],[30,7,'ooo'],
    [36,6,'ooo'],[46,9,'ooo'],[58,7,'oo'],[67,6,'oooooo'],[79,6,'ooo'],
    [88,5,'oo'],[95,7,'ooo'],[103,6,'ooo'],[118,7,'oo'],[122,7,'ooo'],[130,6,'ooo'],[146,9,'ooo']]) put(x,y,text);
  for (let y=2;y<10;y++) put(152,y,'F');
  put(156,2,'F'); put(156,3,'F');
  for (let y=4;y<10;y++) put(155,y,y===4?'****':'******');
  put(155,8,'E'); put(155,9,'E');
  // Stage 2 secrets: two hidden blocks, plus an armoured cache on the flats
  // past the Spark Bloom block — the first course that can actually open one.
  hideGemsInAir(rows, 2, 307);
  // The cache sits ON the raised deck at row 8, never on the walking corridor:
  // a vault is unbreakable by bumping, so it must never be able to wall a
  // player in — and the ground route below stays two tiles clear.
  put(123,7,'v');
  return rows.map(row => row.join(''));
})();
const STAGE2_ENEMIES = [
  ['walker',14], ['walker',40], ['shell',64], ['walker',73],
  ['plant',88,7], ['walker',106], ['shell',112], ['walker',135], ['shell',142],
  ['hopper',47],
];
const COURSES = [
  // Stage 1 stays the on-ramp: same seven-lesson layout, slightly livelier patrols.
  { name:'SUNNY BLUFF', theme:'sunny', rows:MAIN_ROWS, enemies:ENEMY_SPAWNS, time:270, speedScale:1.06,
    difficulty:'TUTORIAL' },
  { name:'SUNSET RIDGE', theme:'sunset', rows:STAGE2_ROWS, enemies:STAGE2_ENEMIES, time:285, speedScale:1.12,
    difficulty:'ADVENTURE' },
];

// Hand-arranged module sequences: every course is deterministic and replayable.
// All gaps are at most four tiles; early courses provide generous bridge assists.
const CAMPAIGN_BLUEPRINTS = [
  ['MOSSWOOD TRAIL',   'grove',   [0,5,2,6,1], 'Hoppers leap after a short pause. Stomp from above.'],
  ['CRYSTAL CAVERNS',  'crystal', [2,0,6,1,5], 'Bats patrol the upper routes. Watch their flight path.'],
  ['COPPER OUTPOST',   'copper',  [1,4,5,2,6], 'First guardian: dodge its glowing bolts, then stomp or shoot.'],
  ['CORAL CAUSEWAY',   'coral',   [2,6,0,4,5], 'Armored beetles take two hits. Their shell lights show health.'],
  ['MOONLIT GROVE',    'moon',    [4,0,3,8,2], 'Use the high route above the thorns. A cache sits on the deck.'],
  ['FROSTFALL PASS',   'frost',   [1,5,7,0,6], 'Wider ravines ahead. Run before jumping; physics stay familiar.'],
  ['THUNDER HEIGHTS',  'storm',   [2,3,6,4,8], 'Faster patrols and airborne enemies share the route.'],
  ['OBSIDIAN KEEP',    'obsidian',[7,2,5,6,4], 'The second guardian fires faster. Wait for its warning flash.'],
  ['MIRAGE DUNES',     'dunes',   [0,3,6,2,7], 'Take the gem routes for supplies before the final push.'],
  ['CLOCKWORK ASCENT', 'clock',   [5,4,8,3,6], 'Mix short hops and full jumps through the clockwork terraces.'],
  ['EMBER CHASM',      'ember',   [3,7,6,5,8], 'Thorns and ravines demand careful landings.'],
  ['ECLIPSE RIDGE',    'eclipse', [7,5,2,8,1], 'The fastest patrols guard the road to the crown.'],
  ['CROWN CITADEL',    'crown',   [8,4,7,3,4], 'Final guardian: eight hits and three-bolt volleys. Free the Gem Kingdom!'],
];
const COURSE_THEMES = {
  grove:   ['#256976','#c4e1a5','#6ba68f','#376957','#ffeab2'],
  crystal: ['#252d61','#927fbd','#645e99','#3c426c','#d9faff'],
  copper:  ['#873d54','#f9c488','#aa7f7b','#684e62','#ffda8a'],
  coral:   ['#367e9b','#bdecdc','#77b7b0','#507c97','#ffdea5'],
  moon:    ['#1d244d','#6c719d','#565d85','#323d61','#e9f5ff'],
  frost:   ['#567caa','#e7f7ff','#a2c5d5','#638da9','#fff8e4'],
  storm:   ['#26384d','#9aafc4','#6a849c','#3c526c','#e0eef3'],
  obsidian:['#231e39','#996c87','#665579','#342f4e','#f7ad9a'],
  dunes:   ['#ae655f','#ffe3a5','#c69776','#8e6b65','#fff1bc'],
  clock:   ['#37516d','#c8b99b','#868f97','#555d75','#ffe4aa'],
  ember:   ['#512c4b','#f7a371','#9e6267','#573e5d','#ffdc88'],
  eclipse: ['#181f3c','#886992','#585477','#30324f','#f3bfd6'],
  crown:   ['#3c295f','#db92a5','#8c6b9c','#4c4269','#ffe49c'],
  sunny:   ['#4fb3f6','#d9f2ff','#9fd8c8','#7cc96f','#ffe680'],
  sunset:  ['#514779','#ffd2a0','#87759e','#594e79','#ffe8aa'],
};

// ---------------------------------------------------------------------------
// Per-stage landmark skylines.
//
// Every one of the 15 courses draws its own silhouette into a tiling mid-ground
// strip, so no two stages share a backdrop. Motifs are authored in a local space
// whose origin sits on the strip baseline (y = 0, up is negative) and are then
// placed five times across the strip, mirrored and height-varied per instance.
// ---------------------------------------------------------------------------
const MID_W = 1600, MID_H = 220;
// [silhouette body, lit accent] — tuned to contrast each course's own sky.
const STAGE_MOTIF_PALETTE = [
  ['#6fbf9a','#f7f2dc'],  //  1 Sunny Bluff    — hills and a windmill
  ['#71628b','#ffd2a0'],  //  2 Sunset Ridge   — banded mesas
  ['#3f7a5c','#a8e08a'],  //  3 Mosswood Trail — broad canopy trees
  ['#6a63b0','#c3b0ff'],  //  4 Crystal Caverns — crystal spires
  ['#a5705f','#f5c07a'],  //  5 Copper Outpost — crenellated watchtowers
  ['#4f97a8','#a8ecdc'],  //  6 Coral Causeway — coral arches and bubbles
  ['#3d4470','#a8b4e8'],  //  7 Moonlit Grove  — cypress and fireflies
  ['#8fb4d4','#eaf6ff'],  //  8 Frostfall Pass — icy peaks and frosted pines
  ['#4c6076','#c8dcf0'],  //  9 Thunder Heights— pylons and lightning
  ['#3b3352','#c0a0d8'],  // 10 Obsidian Keep  — fortress wall and towers
  ['#b98a63','#f5dca0'],  // 11 Mirage Dunes   — dunes, cacti, an obelisk
  ['#5f6b8a','#d8c498'],  // 12 Clockwork Ascent — gears and a clock tower
  ['#6d3f52','#f09060'],  // 13 Ember Chasm    — basalt columns and a vent
  ['#3a3560','#b098e0'],  // 14 Eclipse Ridge  — leaning monoliths
  ['#5a4480','#f0cc78'],  // 15 Crown Citadel  — castle spires and banners
];
const STAGE_MOTIF_DRAW = [
  // 1 — rolling hills and a working windmill
  (body,accent,X)=>{
    X.fillStyle=body;
    for(const [dx,r] of [[-80,58],[10,78],[100,50]]){ X.beginPath(); X.arc(dx,0,r,Math.PI,0); X.fill(); }
    X.fillStyle=accent;
    X.beginPath(); X.moveTo(-120,0); X.lineTo(-102,0); X.lineTo(-108,-64); X.lineTo(-114,-64); X.closePath(); X.fill();
    X.strokeStyle=accent; X.lineWidth=5;
    for(let q=0;q<4;q++){ const a=q*Math.PI/2+0.5;
      X.beginPath(); X.moveTo(-111,-64); X.lineTo(-111+Math.cos(a)*26,-64+Math.sin(a)*26); X.stroke(); }
    X.lineWidth=1;
  },
  // 2 — flat-topped mesas with sediment bands
  (body,accent,X)=>{
    X.fillStyle=body;
    const mesa=(dx,w,h)=>{ X.beginPath(); X.moveTo(dx-w/2,0); X.lineTo(dx-w/2+14,-h);
      X.lineTo(dx+w/2-14,-h); X.lineTo(dx+w/2,0); X.closePath(); X.fill(); };
    mesa(-58,124,88); mesa(62,152,64);
    X.fillStyle=accent;
    X.fillRect(-110,-54,100,7); X.fillRect(-108,-32,96,6);
  },
  // 3 — broadleaf canopy trees on visible trunks
  (body,accent,X)=>{
    X.fillStyle=accent;
    for(const dx of [-92,-20,62]) X.fillRect(dx-6,-58,12,58);
    X.fillStyle=body;
    for(const [dx,r,dy] of [[-92,34,-66],[-20,46,-76],[62,30,-60]]){ X.beginPath(); X.arc(dx,dy,r,0,6.2832); X.fill(); }
  },
  // 4 — faceted crystal spires with accent shard highlights
  (body,accent,X)=>{
    X.fillStyle=body;
    const spire=(dx,w,h)=>{ X.beginPath(); X.moveTo(dx-w/2,0); X.lineTo(dx,-h); X.lineTo(dx+w/2,0); X.closePath(); X.fill(); };
    spire(-88,46,96); spire(-24,60,142); spire(50,42,86); spire(100,30,58);
    X.fillStyle=accent;
    X.beginPath(); X.moveTo(-24,-142); X.lineTo(-6,-44); X.lineTo(-24,-44); X.closePath(); X.fill();
    X.beginPath(); X.moveTo(50,-86); X.lineTo(62,-30); X.lineTo(50,-30); X.closePath(); X.fill();
  },
  // 5 — crenellated watchtowers flying a banner
  (body,accent,X)=>{
    X.fillStyle=body;
    const tower=(dx,w,h)=>{ X.fillRect(dx-w/2,-h,w,h);
      for(let i=0;i<Math.floor(w/12);i++) X.fillRect(dx-w/2+i*12,-h-9,7,9); };
    tower(-70,56,98); tower(40,72,72);
    X.fillStyle=accent;
    X.fillRect(-74,-116,4,44);
    X.beginPath(); X.moveTo(-70,-116); X.lineTo(-42,-108); X.lineTo(-70,-100); X.closePath(); X.fill();
  },
  // 6 — coral arches with rising bubble clusters
  (body,accent,X)=>{
    X.strokeStyle=body; X.lineWidth=14; X.lineCap='round';
    for(const [dx,r] of [[-78,34],[-10,44],[70,28]]){ X.beginPath(); X.arc(dx,0,r,Math.PI,0); X.stroke(); }
    X.lineWidth=1; X.lineCap='butt';
    X.fillStyle=accent;
    for(const [dx,dy,r] of [[-42,-122,5],[8,-152,4],[58,-112,6],[92,-142,3]]){ X.beginPath(); X.arc(dx,dy,r,0,6.2832); X.fill(); }
  },
  // 7 — slender cypress silhouettes with fireflies
  (body,accent,X)=>{
    X.fillStyle=body;
    const cy=(dx,h,w)=>{ X.beginPath(); X.moveTo(dx-w,0);
      X.quadraticCurveTo(dx-w*0.72,-h*0.55,dx,-h);
      X.quadraticCurveTo(dx+w*0.72,-h*0.55,dx+w,0); X.closePath(); X.fill(); };
    cy(-84,122,20); cy(-16,152,24); cy(60,104,18);
    X.fillStyle=accent;
    for(const [dx,dy] of [[-50,-92],[20,-132],[86,-70]]){ X.beginPath(); X.arc(dx,dy,3,0,6.2832); X.fill(); }
  },
  // 8 — sharp icy peaks, snowcaps and frosted pines
  (body,accent,X)=>{
    X.fillStyle=body;
    const peak=(dx,w,h)=>{ X.beginPath(); X.moveTo(dx-w/2,0); X.lineTo(dx,-h); X.lineTo(dx+w/2,0); X.closePath(); X.fill(); };
    peak(-74,112,112); peak(34,152,86);
    X.fillStyle=accent;
    X.beginPath(); X.moveTo(-74,-112); X.lineTo(-50,-58); X.lineTo(-98,-58); X.closePath(); X.fill();
    X.beginPath(); X.moveTo(34,-86); X.lineTo(52,-46); X.lineTo(16,-46); X.closePath(); X.fill();
    X.fillStyle=body;
    const pine=(dx,h)=>{ X.beginPath(); X.moveTo(dx-16,0); X.lineTo(dx,-h); X.lineTo(dx+16,0); X.closePath(); X.fill(); };
    pine(-126,64); pine(106,58);
  },
  // 9 — lattice pylons with a struck lightning channel
  (body,accent,X)=>{
    X.strokeStyle=body; X.lineWidth=6;
    const pylon=(dx,h)=>{
      X.beginPath(); X.moveTo(dx-22,0); X.lineTo(dx-8,-h); X.lineTo(dx+8,-h); X.lineTo(dx+22,0); X.stroke();
      for(let i=1;i<=3;i++){ const y=-h*i/3.4, w=22-14*i/3.4;
        X.beginPath(); X.moveTo(dx-w,y); X.lineTo(dx+w,y); X.stroke(); }
      X.beginPath(); X.moveTo(dx-34,-h); X.lineTo(dx+34,-h); X.stroke();
    };
    pylon(-64,120); pylon(58,96);
    X.lineWidth=1;
    X.fillStyle=accent;
    X.beginPath(); X.moveTo(6,-156); X.lineTo(-8,-122); X.lineTo(0,-122); X.lineTo(-12,-90);
    X.lineTo(10,-128); X.lineTo(2,-128); X.closePath(); X.fill();
  },
  // 10 — fortress curtain wall, battlements and roofed towers
  (body,accent,X)=>{
    X.fillStyle=body;
    X.fillRect(-120,-58,240,58);
    for(let i=0;i<10;i++) X.fillRect(-120+i*24,-70,14,12);
    const tower=(dx,w,h)=>{ X.fillRect(dx-w/2,-h,w,h);
      X.beginPath(); X.moveTo(dx-w/2-4,-h); X.lineTo(dx,-h-30); X.lineTo(dx+w/2+4,-h); X.closePath(); X.fill(); };
    tower(-88,42,106); tower(84,48,122);
    X.fillStyle=accent;
    X.fillRect(-93,-74,9,15); X.fillRect(80,-86,9,15);
  },
  // 11 — wind-carved dunes, cacti and a lone obelisk
  (body,accent,X)=>{
    X.fillStyle=body;
    X.beginPath(); X.moveTo(-130,0);
    X.quadraticCurveTo(-70,-60,0,-30); X.quadraticCurveTo(70,-4,130,0); X.closePath(); X.fill();
    X.fillStyle=accent;
    const cactus=(dx,h)=>{ X.fillRect(dx-5,-h,10,h);
      X.fillRect(dx-20,-h*0.66,15,8); X.fillRect(dx-20,-h*0.66,8,-h*0.22);
      X.fillRect(dx+5,-h*0.5,15,8);   X.fillRect(dx+12,-h*0.5,8,-h*0.2); };
    cactus(-94,64); cactus(80,52);
    X.beginPath(); X.moveTo(6,-98); X.lineTo(22,-98); X.lineTo(18,0); X.lineTo(10,0); X.closePath(); X.fill();
  },
  // 12 — meshing gears beside a clock tower
  (body,accent,X)=>{
    X.fillStyle=body;
    const gear=(dx,dy,r,teeth)=>{
      X.beginPath(); X.arc(dx,dy,r*0.62,0,6.2832); X.fill();
      for(let i=0;i<teeth;i++){ const a=i*6.2832/teeth;
        X.save(); X.translate(dx+Math.cos(a)*r*0.62,dy+Math.sin(a)*r*0.62); X.rotate(a);
        X.fillRect(-6,-6,15,12); X.restore(); }
      X.fillStyle=accent; X.beginPath(); X.arc(dx,dy,r*0.22,0,6.2832); X.fill(); X.fillStyle=body;
    };
    gear(-76,-58,46,10); gear(24,-98,62,12);
    X.fillRect(86,-122,30,122);
    X.fillStyle=accent; X.beginPath(); X.arc(101,-134,20,0,6.2832); X.fill();
    X.strokeStyle=body; X.lineWidth=3;
    X.beginPath(); X.moveTo(101,-134); X.lineTo(101,-148); X.moveTo(101,-134); X.lineTo(112,-130); X.stroke();
    X.lineWidth=1;
  },
  // 13 — hexagonal basalt columns over a glowing vent
  (body,accent,X)=>{
    const cols=[[-112,72],[-88,98],[-64,64],[42,88],[66,112],[90,70]];
    X.fillStyle=body;
    for(const [dx,h] of cols) X.fillRect(dx-11,-h,22,h);
    X.fillStyle=accent;
    for(const [dx,h] of cols) X.fillRect(dx-11,-h,22,6);
    X.beginPath(); X.arc(-12,-4,26,Math.PI,0); X.fill();
  },
  // 14 — leaning monoliths with glowing bands
  (body,accent,X)=>{
    X.fillStyle=body;
    const mono=(dx,w,h,tilt)=>{ X.save(); X.translate(dx,0); X.rotate(tilt);
      X.fillRect(-w/2,-h,w,h); X.restore(); };
    mono(-90,26,104,-0.05); mono(-24,30,142,0.03); mono(52,24,88,-0.02); mono(106,20,66,0.06);
    X.fillStyle=accent;
    X.fillRect(-40,-142,31,7); X.fillRect(-104,-104,27,6); X.fillRect(40,-88,25,6);
  },
  // 15 — the crown castle: spires, banners and a gatehouse
  (body,accent,X)=>{
    X.fillStyle=body;
    X.fillRect(-120,-72,240,72);
    for(let i=0;i<10;i++) X.fillRect(-120+i*24,-84,14,12);
    const spire=(dx,w,h)=>{
      X.fillStyle=body; X.fillRect(dx-w/2,-h,w,h);
      X.beginPath(); X.moveTo(dx-w/2-5,-h); X.lineTo(dx,-h-38); X.lineTo(dx+w/2+5,-h); X.closePath(); X.fill();
      X.strokeStyle=accent; X.lineWidth=3;
      X.beginPath(); X.moveTo(dx,-h-38); X.lineTo(dx,-h-58); X.stroke(); X.lineWidth=1;
      X.fillStyle=accent;
      X.beginPath(); X.moveTo(dx,-h-58); X.lineTo(dx+20,-h-52); X.lineTo(dx,-h-46); X.closePath(); X.fill();
    };
    spire(-92,38,118); spire(0,52,150); spire(92,38,118);
    X.fillStyle=accent;
    X.beginPath(); X.arc(0,-72,9,Math.PI,0); X.fill();
    X.fillRect(-9,-72,18,72);
  },
];
function buildStageMid(stage){
  const c = cv(MID_W, MID_H), X = g2(c);
  const idx = clamp(stage,1,15) - 1;
  const [body,accent] = STAGE_MOTIF_PALETTE[idx];
  const draw = STAGE_MOTIF_DRAW[idx];
  [90,410,730,1050,1370].forEach((x,k)=>{
    X.save();
    X.translate(x, MID_H);
    if (k % 2) X.scale(-1,1);                    // mirror alternate instances
    X.scale(1, 0.86 + ((k*7)%4)*0.07);           // vary heights per instance
    draw(body,accent,X);
    X.restore();
  });
  return c;
}

// Per-stage ambient atmosphere. Every course carries its own weather; the motion
// is purely cosmetic and thins out automatically under Reduced Effects.
// kind: fall | rise | drift | rain | twinkle
const STAGE_FX = [
  { kind:'rise',    colors:['#fff3b8','#ffffff'], n:22, spd:14,  sway:16, size:2 }, //  1 pollen motes
  { kind:'drift',   colors:['#ffc489','#ffe0b8'], n:20, spd:11,  sway:8,  size:2 }, //  2 sunset dust
  { kind:'fall',    colors:['#a8e08a','#ffd98a'], n:18, spd:26,  sway:26, size:3 }, //  3 falling leaves
  { kind:'twinkle', colors:['#d9faff','#c3b0ff'], n:26, spd:0,   sway:0,  size:2 }, //  4 crystal sparkle
  { kind:'rise',    colors:['#f5c07a','#c9a06a'], n:20, spd:18,  sway:10, size:2 }, //  5 forge soot
  { kind:'rise',    colors:['#d8fff4','#ffffff'], n:20, spd:30,  sway:12, size:3 }, //  6 rising bubbles
  { kind:'drift',   colors:['#ffe98a','#fff6c0'], n:16, spd:9,   sway:14, size:2 }, //  7 fireflies
  { kind:'fall',    colors:['#e5f8ff','#ffffff'], n:28, spd:22,  sway:14, size:2 }, //  8 snowfall
  { kind:'rain',    colors:['#cfe4f5','#eaf4ff'], n:30, spd:340, sway:40, size:2 }, //  9 storm rain
  { kind:'fall',    colors:['#c0a0d8','#8a7aa8'], n:20, spd:16,  sway:12, size:2 }, // 10 drifting ash
  { kind:'drift',   colors:['#ffe9b8','#f5d090'], n:24, spd:44,  sway:10, size:2 }, // 11 blowing sand
  { kind:'rise',    colors:['#e8e0d0','#ffffff'], n:18, spd:24,  sway:16, size:3 }, // 12 steam puffs
  { kind:'rise',    colors:['#ffc489','#ff9060'], n:28, spd:34,  sway:18, size:2 }, // 13 rising embers
  { kind:'fall',    colors:['#b098e0','#7a6aa8'], n:20, spd:14,  sway:10, size:2 }, // 14 shadow motes
  { kind:'fall',    colors:['#ffe49c','#ffd0e0'], n:26, spd:30,  sway:22, size:3 }, // 15 crown confetti
];
// Deterministic 0..1 hash so every (stage, module) gets its own stable flavor.
function shash(a, b, c){
  let n = (a*374761393 + b*668265263 + c*2246822519) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

function buildCampaignCourse(stage, blueprint){
  const [name,theme,modules,tip] = blueprint;
  const rows = Array.from({length:12}, (_,y) => Array(170).fill(y>=10?'#':'.'));
  const enemies = [], gaps = [], checkpoints = [60,112];
  const put = (x,y,text) => { for (let n=0;n<text.length;n++) rows[y][x+n] = text[n]; };
  const gems = (x,y,n) => { for (let i=0;i<n;i++) if (rows[y][x+i] === '.') rows[y][x+i]='o'; };
  // Difficulty ramp: full-width ravines arrive two courses earlier than before,
  // and bridge assists are withdrawn sooner. Four tiles stays the hard ceiling
  // because that is the widest a running jump can clear.
  const gapWidth = stage < 6 ? 3 : 4;
  const gap = (x) => {
    // Safety net: never punch a ravine out from under a checkpoint or the arena.
    if (checkpoints.some(cx => cx >= x - 1 && cx <= x + gapWidth)) return;
    gaps.push({x,width:gapWidth});
    for (let y=10;y<12;y++) put(x,y,'.'.repeat(gapWidth));
    if (stage < 6) put(x-1,8,'==');
    // Later assists remain optional: the four-tile ground jump is also possible.
    else if (stage % 4 === 0) put(x,8,'==');
    gems(x-1,6,gapWidth+2);
  };
  const pipe = (x,top) => {
    put(x,top,'()'); for (let y=top+1;y<10;y++) put(x,y,'[]');
    gems(x,top-1,2);
  };
  modules.forEach((type,i) => {
    const x = 8+i*26;
    // Per-(stage,module) flavor so layouts, patrols and hazards shift course to course.
    const vary = (salt) => shash(stage + salt*57, i + salt*11, stage*i + salt);
    // Overhead mystery cluster: jitter its column so blocks never line up twice.
    const bo = Math.floor(vary(11)*3);
    put(x+3+bo,7,i===0?'BGB':i===2?'BSB':i===4?'BIB':i===1?'BMB':'B?B');
    gems(x+3+bo,6,3); gems(x,9,3);
    // Mid+ courses hang an extra one-way gem route overhead on many modules.
    if (stage >= 6 && vary(13) > 0.5){ put(x+8,5,'==='); gems(x+8,4,3); }
    if (type === 0){ pipe(x+12+(vary(17)>0.5?1:0),8); gap(x+20); }
    else if (type === 1){
      put(x+11,9,'######'); put(x+13,8,'##'); gems(x+11,7,6); gap(x+20);
    } else if (type === 2){
      gap(x+14); put(x+11,8,'=='); put(x+17,7,'==='); gems(x+17,6,3);
    } else if (type === 3){
      // Thorn beds grow a tile wider on the two hardest tiers of the campaign.
      put(x+14,9,stage>=13?'^^^':stage>=10?'^^':'^'); put(x+12,7,'====='); gems(x+12,6,5);
    } else if (type === 5){
      // Staircase climb: three rising steps crowned by a leap over the ravine.
      put(x+11,9,'###'); put(x+14,8,'###'); put(x+17,7,'###');
      gems(x+11,8,3); gems(x+14,7,3); gems(x+17,6,3);
      gap(x+21);
    } else if (type === 6){
      // Pipe gauntlet: three pipes of shifting height, no ravine to rest on.
      pipe(x+11,8); pipe(x+16, vary(61)>0.5?7:8); pipe(x+21,8);
      gems(x+14,6,2); gems(x+19,6,2);
    } else if (type === 7){
      // Thorn gauntlet: spike beds on the deck, a one-way high line above, and
      // hidden blocks paying out only to players who take the risky route.
      put(x+11,9,'####'); put(x+15,9,'^^'); put(x+17,9,'####');
      put(x+12,6,'====='); put(x+18,5,'===');
      gems(x+12,5,5);
      gap(x+21);
    } else if (type === 8){
      // Vault chamber: an armoured cache behind a turret. Cracking it needs
      // Spark Bloom or a bowling shell, and the ground fireball reaches it.
      put(x+11,9,'#####');
      put(x+13,8,'v'); put(x+13,9,'v');
      put(x+17,9,'####');
      // The ? block on the deck hands out the Spark Bloom the cache demands.
      put(x+20,7,'S'); gems(x+19,6,3);
      gems(x+11,8,5);
      enemies.push(['turret',x+22,10]);
    } else {
      const p2 = x+18+(vary(19)>0.5?1:0);
      pipe(x+11, vary(23)>0.6?7:8); pipe(p2,8);
      if (stage >= 6 && i % 2 === 0) enemies.push(['plant',p2,8]);
    }
    // Enemy rotation is seeded per stage, not a fixed parity pattern.
    const r = vary(29);
    let kind;
    if (stage >= 9 && r > 0.82) kind = 'shielder';       // needs a flank or a stomp
    else if (stage >= 7 && r > 0.62) kind = 'charger';   // telegraphed dash
    else if (stage >= 5 && r > 0.42) kind = 'beetle';
    else if (r > 0.25) kind = 'hopper';
    else kind = 'walker';
    enemies.push([kind,x+8,10,x+6,x+10]);
    enemies.push([vary(31)>0.5?'shell':'walker',x+25,10,x+24,x+25]);
    if (stage >= 11 && vary(37) > 0.4) enemies.push(['beetle',x+6,10,x+6,x+8]);
    if (stage >= 8 && vary(59) > 0.62) enemies.push(['gel',x+22,10,x+20,x+24]);
    if (stage >= 3 && i < Math.min(5,Math.floor((stage-1)/2))){
      enemies.push(['bat',x+15,5,x+11,x+20]);
    }
    if (stage >= 12) enemies.push(['bat',x+21,4,x+17,x+24]);
    // Surprise: a hidden lurker springs out when Maro steps close. More on later tiers.
    if (stage >= 4 && vary(41) > (0.78 - stage*0.02)) enemies.push([vary(43)>0.5?'hopper':'walker',x+10,10,x+9,x+11,'lurk']);
  });
  // Every course from stage 3 onward keeps at least one hidden ambusher.
  if (stage >= 3 && !enemies.some(e => e[5] === 'lurk')){
    const bx = 8 + 2*26;
    enemies.push(['hopper', bx+10, 10, bx+9, bx+11, 'lurk']);
  }
  // The bonus doorway and its return position stay clear on every course.
  put(42,9,'D');
  for (const x of checkpoints) for (let y=7;y<10;y++) put(x,y,'K');
  // A safe final checkpoint and a flat arena for milestone guardians.
  if (stage % 5 === 0){
    checkpoints.push(136);
    for (let y=7;y<10;y++) put(136,y,'K');
    enemies.push(['guardian',145,10,141,150]);
    put(139,7,'S'); gems(138,6,5);
  } else { put(140,7,'+'); gems(139,6,4); }
  for (let y=2;y<10;y++) put(152,y,'F');
  for (let y=2;y<4;y++) put(156,y,'F');
  for (let y=4;y<10;y++) put(155,y,y===4?'****':'******');
  put(155,8,'E'); put(155,9,'E'); gems(147,9,3);

  const grid = rows.map(row => row.join(''));
  // Hidden gems: more of them on the harder tiers, always in validated air.
  hideGemsInAir(grid, stage >= 10 ? 4 : 3, stage * 977);
  // Safety net: every ground enemy must start on solid footing with clear air
  // above it. Anything that would spawn inside a pipe, a wall or a vault — or
  // over a ravine — is dropped rather than left stuck in the scenery.
  const solidCell = (tx, ty) => {
    if (tx < 0 || tx >= 170 || ty < 0 || ty >= grid.length) return true;
    return SOLID.has(TILE_CHAR[grid[ty][tx]] || T.EMPTY);
  };
  for (let i=enemies.length-1;i>=0;i--){
    const col = enemies[i][1];
    if (enemies[i][0] !== 'guardian' && checkpoints.some(x=>Math.abs(x-col)<4)){ enemies.splice(i,1); continue; }
    const groundRow = enemies[i][2] === undefined ? GROUND_ROW : enemies[i][2];
    if (groundRow !== GROUND_ROW) continue;      // flyers are placed in open air
    if (!solidCell(col,10) || solidCell(col,9) || solidCell(col,8)) enemies.splice(i,1);
  }
  return {name,theme,tip,rows:grid,enemies,gaps,checkpoints,
    time:Math.max(195,300-stage*7), speedScale:1+(stage-2)*0.052,
    difficulty:stage<=4?'ADVENTURE':stage<=8?'CHALLENGING':stage<=12?'EXPERT':'MASTER'};
}
for (let i=0;i<CAMPAIGN_BLUEPRINTS.length;i++) COURSES.push(buildCampaignCourse(i+3,CAMPAIGN_BLUEPRINTS[i]));
COURSES[0].tip = 'Learn the jumps, collect gems and reach the castle.';
COURSES[1].tip = 'Explore higher routes and look for the checkpoint pennants.';
const TOTAL_STAGES = COURSES.length;

function loadCampaignProgress(raw, oldStage2){
  const valid = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const unlocked = Number.isInteger(valid.unlocked) ? clamp(valid.unlocked,1,TOTAL_STAGES) : (oldStage2 ? 2 : 1);
  const cleared = Array.isArray(valid.cleared) ? [...new Set(valid.cleared.filter(n=>Number.isInteger(n)&&n>=1&&n<=TOTAL_STAGES&&n<=unlocked))] : [];
  return {unlocked,cleared};
}

// Theme palette for any course, including the two hand-authored opening stages.
function courseTheme(stage){
  const course = COURSES[clamp(stage,1,TOTAL_STAGES) - 1];
  return COURSE_THEMES[(course && course.theme) || 'sunny'] || COURSE_THEMES.sunny;
}

// Cache only the current later-stage backdrop, rather than 13 full canvas sets.
function courseBackdrop(stage){
  let bg;
  if (stage === 1) bg = ASSETS.bg;
  else if (stage === 2) bg = ASSETS.sunset;
  else if (ASSETS.courseBackdrop && ASSETS.courseBackdrop.stage === stage) bg = ASSETS.courseBackdrop;
  else {
    const [top,bottom,far,near,sun] = COURSE_THEMES[COURSES[stage-1].theme];
    bg = {stage,sky:cv(VIEW_W,VIEW_H)};
    const x = g2(bg.sky), grad = x.createLinearGradient(0,0,0,VIEW_H);
    grad.addColorStop(0,top); grad.addColorStop(1,bottom);
    x.fillStyle = grad; x.fillRect(0,0,VIEW_W,VIEW_H);
    x.fillStyle = sun; x.beginPath(); x.arc(790,170,46,0,Math.PI*2); x.fill();
    if ([4,7,10,14,15].includes(stage)){
      x.fillStyle = '#e6e4ff';
      for (let i=0;i<36;i++) x.fillRect((i*137+stage*19)%940,28+(i*73)%250,i%3===0?3:2,2);
    }
    for (const [name,color] of [['far',far],['near',near]]){
      const source=ASSETS.bg[name], layer=cv(source.width,source.height), px=g2(layer);
      px.drawImage(source,0,0); px.globalCompositeOperation='source-atop';
      px.fillStyle=color; px.fillRect(0,0,layer.width,layer.height); bg[name]=layer;
    }
    ASSETS.courseBackdrop=bg;
  }
  // Each course carries its own landmark strip between the hill layers.
  if (!bg.mid) bg.mid = buildStageMid(stage);
  return bg;
}

class Level {
  constructor(rows, isBonus){
    this.isBonus = !!isBonus;
    this.h = rows.length;
    this.w = 0;
    for (const r of rows) if (r.length > this.w) this.w = r.length;
    this.tiles = new Uint8Array(this.w * this.h);
    this.gemSpawns = [];
    this.hiddenCount = 0; this.vaultCount = 0;
    for (let y = 0; y < this.h; y++){
      const row = rows[y];
      for (let x = 0; x < this.w; x++){
        const ch = row[x] || '.';
        let code = T.EMPTY;
        if (TILE_CHAR[ch]) code = TILE_CHAR[ch];
        if (ch === 'o') this.gemSpawns.push({ tx:x, ty:y });
        if (code === T.HIDDEN) this.hiddenCount++;
        // A cache is a vertical pillar of vault tiles; count it once, at its top.
        if (code === T.VAULT && this.tiles[(y-1)*this.w + x] !== T.VAULT) this.vaultCount++;
        this.tiles[y*this.w + x] = code;
      }
    }
    this.bumps = new Map();   // key (tx*100+ty) -> time left
    // Top row of the first flag / checkpoint pole — level-integrity metadata
    // asserted by the smoke suite.
    this.flagTop = -1; this.checkTop = -1;
    for (let y = 0; y < this.h && (this.flagTop < 0 || this.checkTop < 0); y++){
      for (let x = 0; x < this.w; x++){
        const c = this.tiles[y*this.w + x];
        if (c === T.FLAG && this.flagTop < 0) this.flagTop = y;
        if (c === T.CHECK && this.checkTop < 0) this.checkTop = y;
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
