/* ============================================================
   GEM DASH — a self-contained, touch-first platform game.
   All graphics are drawn procedurally on canvas;
   all audio is synthesized with the Web Audio API.
   ============================================================ */

// ---------------- core constants ----------------
const VIEW_W = 960, VIEW_H = 540;      // logical 16:9 resolution
const TILE = 48;                       // logical tile size
const STEP = 1/60;                     // fixed update timestep (60 Hz)
const MAX_ACC = 0.25;                  // clamp for huge frame deltas (s)
const MAX_STEPS = 5;                   // max update steps per frame (spiral guard)

const PHYS = {
  WALK: 210, RUN: 330,                 // max horizontal speeds (px/s)
  G_ACC: 1700, A_ACC: 900,             // ground / air acceleration (px/s^2)
  FRICTION: 1900, AIR_DRAG: 260,       // deceleration when no input (px/s^2)
  GRAV: 1900,                          // gravity (px/s^2)
  JUMP_V: -740,                        // jump impulse (px/s)
  HOLD_GRAV: 0.5,                      // gravity scale while holding jump (ascent)
  FAST_GRAV: 2.1,                      // gravity scale after release (ascent)
  MAX_FALL: 900,                       // terminal falling speed (px/s)
  COYOTE: 0.10, JBUF: 0.12,            // coyote time / jump buffer (s)
};

const SIZES = {
  small:  { w: 28, h: 40 },
  big:    { w: 30, h: 64 },
  crouchS:{ w: 30, h: 32 },
  crouchB:{ w: 32, h: 48 },
};

// tile codes
const T = {
  EMPTY:0, GROUND:1, DIRT:2, BRICK:3,
  Q_GEM:4, Q_GROW:5, Q_SHOT:6, Q_STAR:7, Q_LIFE:8, Q_MULTI:9, USED:10,
  PIPE_TL:11, PIPE_TR:12, PIPE_BL:13, PIPE_BR:14,
  PLATFORM:15, HAZARD:16, DOOR:17, FLAG:18, CHECK:19, BUILD:20, END_DOOR:21,
  HIDDEN:22, VAULT:23,
};
const TILE_CHAR = {
  '#':T.GROUND, '%':T.DIRT, 'B':T.BRICK,
  '?':T.Q_GEM, 'G':T.Q_GROW, 'S':T.Q_SHOT, 'I':T.Q_STAR, '+':T.Q_LIFE, 'M':T.Q_MULTI,
  '=':T.PLATFORM, '^':T.HAZARD,
  '(':T.PIPE_TL, ')':T.PIPE_TR, '[':T.PIPE_BL, ']':T.PIPE_BR,
  'D':T.DOOR, 'F':T.FLAG, 'K':T.CHECK, '*':T.BUILD, 'E':T.END_DOOR,
  'h':T.HIDDEN, 'v':T.VAULT,
};
// HIDDEN is deliberately absent: it is intangible until Maro jumps into it,
// at which point it turns into a solid USED block.
const SOLID = new Set([T.GROUND,T.DIRT,T.BRICK,T.Q_GEM,T.Q_GROW,T.Q_SHOT,T.Q_STAR,T.Q_LIFE,T.Q_MULTI,T.USED,T.PIPE_TL,T.PIPE_TR,T.PIPE_BL,T.PIPE_BR,T.BUILD,T.VAULT]);
const QCODES = new Set([T.Q_GEM,T.Q_GROW,T.Q_SHOT,T.Q_STAR,T.Q_LIFE,T.Q_MULTI]);

const LEVEL_TIME = 300;                // placeholder until a course sets its own timer
const START_TX = 2;
const FLAG_TX = 152;
const BUMP_DUR = 0.18;                 // mystery-block bump animation (s)
const STAR_TIME = 9;                   // invincibility duration (s)
const HURT_TIME = 2;                   // post-damage invulnerability (s)
const MAX_LIVES = 9;
const MAX_PLAYER_SHOTS = 2;
const MAX_PARTICLES = 240;
const MAX_TEXTS = 24;
const GROUND_ROW = 10;                 // main level ground top row
const BONUS_FLOOR_ROW = 9;             // bonus room floor row

// ---------------- small utilities ----------------
function clamp(v,a,b){ return v < a ? a : (v > b ? b : v); }
function lerp(a,b,t){ return a + (b-a)*t; }
function mod(a,b){ return ((a % b) + b) % b; }
function pad6(n){ return String(Math.max(0, Math.floor(n))).padStart(6, '0'); }
function aabb(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
function circleRect(c,r){
  const cx = clamp(c.x, r.x, r.x+r.w), cy = clamp(c.y, r.y, r.y+r.h);
  const dx = c.x-cx, dy = c.y-cy;
  return dx*dx + dy*dy <= c.r*c.r;
}

// ---------------- persistent storage (fail-safe) ----------------
const Store = {
  get(k, d){
    try {
      const v = localStorage.getItem('gemdash.' + k);
      return v === null ? d : JSON.parse(v);
    } catch(_){ return d; }
  },
  set(k, v){
    try { localStorage.setItem('gemdash.' + k, JSON.stringify(v)); } catch(_){ /* private mode */ }
  },
};

// ---------------- settings ----------------
const Settings = {
  sound:   Store.get('sound', true),
  vibrate: Store.get('vibrate', true),
  opacity: Store.get('opacity', 0.85),
  reduced: Store.get('reduced', false),
  quality: Store.get('quality', 'high') === 'standard' ? 'standard' : 'high',
  get effectsReduced(){ return this.reduced || this.quality === 'standard'; },
  apply(){
    const ui = document.getElementById('touch-ui');
    if (ui) ui.style.opacity = String(Settings.opacity);
    if (AudioSys.ctx && AudioSys.master) AudioSys.master.gain.value = Settings.sound ? 0.5 : 0;
  },
};

function vib(ms){
  if (!Settings.vibrate) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'){
    try { navigator.vibrate(ms); } catch(_){ /* not supported */ }
  }
}

// ---------------- audio (Web Audio, all synthesized) ----------------
const AudioSys = {
  ctx: null, master: null, musicGain: null, noiseBuf: null,
  musicOn: false, musicTimer: null, musicStep: 0, musicNext: 0,

  // Must only be created/resumed after a user gesture.
  unlock(){
    if (this.ctx){
      if (this.ctx.state === 'suspended'){ this.ctx.resume().catch(()=>{}); }
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = Settings.sound ? 0.5 : 0;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      const len = Math.floor(0.4 * (this.ctx.sampleRate || 44100));
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate || 44100);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random()*2 - 1;
    } catch(_){ this.ctx = null; }
  },
  applyMute(){
    if (this.ctx && this.master) this.master.gain.value = Settings.sound ? 0.5 : 0;
  },
  suspend(){ if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(()=>{}); },
  resume(){ if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{}); },

  // one short oscillator blip
  tone(o){
    const c = this.ctx;
    if (!c) return;
    try {
      const t0 = c.currentTime + (o.at || 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(Math.max(1, o.f0), t0);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(o.vol || 0.2, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g); g.connect(o.dest || this.master);
      osc.start(t0); osc.stop(t0 + o.dur + 0.05);
    } catch(_){ /* ignore */ }
  },
  // filtered noise burst
  noise(o){
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    try {
      const t0 = c.currentTime + (o.at || 0);
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = o.f || 800; f.Q.value = 0.9;
      const g = c.createGain();
      g.gain.setValueAtTime(o.vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      s.connect(f); f.connect(g); g.connect(o.dest || this.master);
      s.start(t0); s.stop(t0 + o.dur + 0.05);
    } catch(_){ /* ignore */ }
  },

  // simple original chiptune loop (8th-note steps)
  startMusic(){
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.musicStep = 0;
    this.musicNext = this.ctx.currentTime + 0.12;
    const EIGHT = 0.225;
    const tick = () => {
      if (!this.ctx || !this.musicOn) return;
      while (this.musicNext < this.ctx.currentTime + 0.35){
        const i = this.musicStep % MUSIC_MEL.length;
        const m = MUSIC_MEL[i], b = MUSIC_BASS[i];
        if (m) this.tone({ type:'triangle', f0:m, dur:0.2, vol:0.16, at:this.musicNext - this.ctx.currentTime, dest:this.musicGain });
        if (b) this.tone({ type:'square', f0:b, dur:0.2, vol:0.06, at:this.musicNext - this.ctx.currentTime, dest:this.musicGain });
        this.musicNext += EIGHT;
        this.musicStep++;
      }
    };
    tick();
    this.musicTimer = setInterval(tick, 90);
  },
  stopMusic(){
    this.musicOn = false;
    if (this.musicTimer){ clearInterval(this.musicTimer); this.musicTimer = null; }
  },
};

// original 4-bar loop in C major (0 = rest)
const MUSIC_MEL = [659,0,784,0,523,0,784,0, 880,0,784,0,659,0,587,0, 523,0,659,0,587,0,523,0, 587,0,659,0,784,0,659,0];
const MUSIC_BASS = [131,0,0,0,98,0,0,0, 110,0,0,0,87,0,98,0, 131,0,0,0,98,0,0,0, 87,0,98,0,110,0,131,0];

AudioSys.sfx = {
  jump(){      AudioSys.tone({ f0:300, f1:680, dur:0.14, vol:0.18 }); },
  coin(){      AudioSys.tone({ f0:988, dur:0.07, vol:0.16 }); AudioSys.tone({ f0:1319, dur:0.16, vol:0.16, at:0.07 }); },
  bump(){      AudioSys.tone({ f0:140, f1:80, dur:0.08, vol:0.22 }); },
  thud(){      AudioSys.tone({ f0:110, f1:60, dur:0.09, vol:0.2 }); },
  breakBlock(){ AudioSys.noise({ dur:0.2, vol:0.26, f:900 }); AudioSys.tone({ f0:220, f1:60, dur:0.16, vol:0.16 }); },
  stomp(){     AudioSys.tone({ f0:420, f1:120, dur:0.11, vol:0.2 }); AudioSys.noise({ dur:0.06, vol:0.1, f:600, at:0.01 }); },
  kick(){      AudioSys.tone({ f0:170, f1:90, dur:0.1, vol:0.22 }); },
  bounce(){    AudioSys.tone({ f0:240, f1:180, dur:0.06, vol:0.12 }); },
  hitWall(){   AudioSys.noise({ dur:0.05, vol:0.1, f:1400 }); },
  damage(){    AudioSys.tone({ type:'sawtooth', f0:520, f1:110, dur:0.32, vol:0.22 }); },
  die(){       [392,330,262,196,131].forEach((f,i)=>AudioSys.tone({ f0:f, dur:0.16, vol:0.2, at:i*0.13 })); },
  powerOut(){  [523,659,784,1047].forEach((f,i)=>AudioSys.tone({ type:'triangle', f0:f, dur:0.09, vol:0.16, at:i*0.06 })); },
  powerGet(){  [523,659,784,1047,1319,1568].forEach((f,i)=>AudioSys.tone({ f0:f, dur:0.07, vol:0.16, at:i*0.05 })); },
  shoot(){     AudioSys.tone({ f0:900, f1:320, dur:0.09, vol:0.13 }); },
  life(){      [523,659,784,1047,1319].forEach((f,i)=>AudioSys.tone({ type:'triangle', f0:f, dur:0.12, vol:0.18, at:i*0.09 })); },
  oneup(){     AudioSys.tone({ f0:1047, dur:0.08, vol:0.18 }); AudioSys.tone({ f0:1319, dur:0.14, vol:0.18, at:0.08 }); },
  pause(){     AudioSys.tone({ f0:660, f1:440, dur:0.09, vol:0.14 }); },
  clear(){     [523,659,784,1047,784,1047,1319].forEach((f,i)=>AudioSys.tone({ type:'triangle', f0:f, dur:0.14, vol:0.2, at:i*0.11 })); },
  tick(){      AudioSys.tone({ f0:1200, dur:0.05, vol:0.1 }); },
  checkpoint(){ AudioSys.tone({ f0:659, dur:0.08, vol:0.16 }); AudioSys.tone({ f0:880, dur:0.12, vol:0.16, at:0.08 }); },
};

// ---------------- input state (shared by touch + keyboard) ----------------
const Input = {
  left:false, right:false, down:false,
  jumpHeld:false, actionHeld:false,
  jumpQueued:false, actionQueued:false,
  press(k){
    if (k==='left') this.left = true;
    else if (k==='right') this.right = true;
    else if (k==='down') this.down = true;
    else if (k==='jump') this.jumpHeld = true;
    else if (k==='action') this.actionHeld = true;
  },
  release(k){
    if (k==='left') this.left = false;
    else if (k==='right') this.right = false;
    else if (k==='down') this.down = false;
    else if (k==='jump') this.jumpHeld = false;
    else if (k==='action') this.actionHeld = false;
  },
  queue(k){
    if (k==='jump') this.jumpQueued = true;
    else if (k==='action') this.actionQueued = true;
  },
  clearAll(){
    this.left = this.right = this.down = false;
    this.jumpHeld = this.actionHeld = false;
    this.jumpQueued = this.actionQueued = false;
  },
};

// ---------------- touch controller (Pointer Events, multi-touch safe) ----------------
const TouchUI = {
  bound: [],
  init(){
    const map = [
      ['btn-left','left'], ['btn-right','right'], ['btn-down','down'],
      ['btn-jump','jump'], ['btn-action','action'],
    ];
    for (const [id, key] of map){
      const el = $(id);
      if (!el) continue;
      const ptrs = new Set();
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        AudioSys.unlock();
        ptrs.add(e.pointerId);
        try { el.setPointerCapture(e.pointerId); } catch(_){ /* ignore */ }
        Input.press(key);
        if (key==='jump' || key==='action') Input.queue(key);
        el.classList.add('on');
        vib(6);
      });
      const release = (e) => {
        ptrs.delete(e.pointerId);
        if (ptrs.size === 0){
          Input.release(key);
          el.classList.remove('on');
        }
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
      this.bound.push({ el, ptrs });
    }
  },
  resetVisuals(){
    for (const b of this.bound){ b.el.classList.remove('on'); b.ptrs.clear(); }
  },
};

// ---------------- DOM helpers ----------------
const els = {};
function $(id){
  if (!els[id]) els[id] = document.getElementById(id);
  return els[id];
}
const OV_IDS = ['ov-title','ov-tut','ov-pause','ov-set','ov-over','ov-clear','ov-stages'];
function showOv(id){ const el = $(id); if (el) el.hidden = false; }
function hideOv(id){ const el = $(id); if (el) el.hidden = true; }
function hideAllOverlays(){ for (const id of OV_IDS) hideOv(id); }
