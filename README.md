# Maro — Gem Dash: Sunny Bluff

A self-contained, touch-first platformer where **Maro** (a flame-tailed fox called Pip) dashes across Sunny Bluff to save the Gem Bluff.

This is a polished, fully-playable web game with no external dependencies. All graphics are procedural canvas art, all audio is synthesized via Web Audio API.

## 🎮 How to Play

- **◀ ▶** — Move left / right (or A/D, Arrow Keys)
- **A** — Jump (hold for higher jump) (Space, W, Z)
- **B** — Run / Shoot (with Spark Bloom) / Kick shells (Shift, X)
- **▼** — Crouch / Enter hidden doors (S, Down Arrow)
- **P / Esc** — Pause

**Goals:**
- Collect floating gems (o) and Q-block gems (?)
- Stomp walkers from above. Kick idle shells to chain enemies.
- Hit ? blocks for power-ups:
  - **G** — Ember Cap: Grow big (break bricks)
  - **S** — Spark Bloom: Shoot fireballs (B)
  - **I** — Nova Star: Invincibility (9s)
  - **+** — Extra life
  - **M** — Multi-gem fountain
- Find the secret wooden door (D) — crouch (▼) to enter bonus room
- Reach the flag pole (F) at col 152, then the destination door (E)

## 🌄 Stage 2 — Sunset Ridge

Clear Sunny Bluff and select **Next Stage → Sunset Ridge**. Your score, gems, remaining lives and power-up form carry over; the stage starts with a fresh 320-second timer and checkpoint. Once unlocked, **Play Stage 2** also appears on the title screen for fresh standalone runs. Unlocking is saved locally when browser storage is available.

Sunset Ridge features a separate 170×12-tile layout, purple sunset hills, three short ravines, four pipes, nine enemies, 40+ gems, raised routes, growth/shooting/star/multi-gem blocks, a bonus room and grounded checkpoints at columns 60 and 114. Death and restart keep you in the current stage. Finishing Stage 2 completes the adventure.

Stage-specific validation:
```bash
STAGE=2 node aiplay.js
STAGE=2 GEOM_ONLY=1 node aiplay.js
STAGE=2 node fuzz.js
```

## ⚙️ Controls and graphics settings

Pause with **P / Esc**, then open **Settings**.

- **Keyboard controls → Default:** original arrow/WASD controls and jump/action aliases.
- **Keyboard controls → Custom:** click an action's key button, then press a new key. Supports letters, numbers, arrows, Space and Shift. Duplicate assignments are rejected. **Esc** cancels capture; **P**, **M** and **F** remain reserved for pause, sound and fullscreen. Reset Custom Keys restores the original primary bindings. Touch controls are unchanged.
- **Graphics quality → Standard:** 960×540 backing canvas and fewer particles, trails and camera-shake effects for lighter rendering.
- **Graphics quality → High:** 1920×1080 backing canvas and full effects, retaining the crisp pixel-art style. The existing low-FPS fallback can reduce rendering to 1× if necessary. Changing quality resets that fallback.
- **Reduced effects** remains available independently and also works in High mode.

Control presets, custom bindings and quality are saved in local storage on the current browser/device (when storage is available).

## 🏗️ Level Design

- **Size:** 170 columns × 12 rows (8160×576 px world)
- **Pits:** Intentionally forgiving for both human and AI
  - Pit1: cols 28-31 (4 tiles)
  - Pit2: cols 66-69 (4 tiles) — with helper platforms at (64-65, row8) and (67-68, row6)
  - Pit3: cols 107-109 (3 tiles) — with platforms at 106-108, row7
- **Checkpoints:** At col 94 (K)
- **Enemies:** 8 total (balanced for accessibility)
  - Walker at 20 (stomp tutorial)
  - Shell at 54
  - Walker at 72
  - Plant at 86 (timing puzzle)
  - Walker at 98
  - Shell at 111
  - Shell at 136
  - Walker at 139
- **Floating gems:** 21+ scattered for exploration

## 🔧 Tech

- **Self-contained:** Single `index.html` (3022 lines) built from `partA.html + partB.html + partC.js + partD.js + partE.js + partF.js`
- **No dependencies:** Vanilla JS, Canvas 2D, Web Audio API
- **Mobile-first:** Touch controls, pointer events, safe-area insets, landscape lock attempt
- **Performance:** Standard 1× / High 2× rendering, auto-degrade to 1× on sustained low FPS, particle pooling (240 max), fixed timestep (60Hz)

## ✅ Quality Gates

- **Smoke tests:** `node smoke.js` — ALL CHECKS PASSED
  - Covers: boot, movement, jump, mystery blocks, stomp, damage/death/respawn, pit, spikes, power-ups, one-way platforms, bonus room, checkpoint, pause/resume, level complete, game over
- **Fuzz:** `node fuzz.js` — FUZZ CLEAN (60s, 5 seeds)
- **AI:** `node aiplay.js` — AI CLEARED THE LEVEL (25.6s, 0 deaths, 20539 score)
  - With enemies disabled (GEOM_ONLY): clears in 25.1s
  - Full game with 8 enemies: clears consistently after balancing

## 🐛 Bug Fixes Applied

- **Pits narrowed:** Originally 8 tiles (62-69) and 5 tiles (105-109) — impossible for max jump distance (253px). Now 4 and 3 tiles.
- **Enemy overlap:** Walkers at 23 and 100 overlapped Q_GROW and Q_STAR blocks, causing instant death on block bump. Moved to 20 and 98.
- **Enemy crowding:** Removed walker at 40 (zone 32-61) and plant at 81,9 — reduced from 10 to 8 enemies for better flow.
- **Speed tuning:** Walker 60→42, Shell 55→38, Shell live 430→300 for more controllable difficulty.
- **Smoke test:** Updated pit existence check from 28,62,105 to 28,66,107 to match new level.

## 🚀 Running

Just open `index.html` in a browser (file:// works). No server needed.

For tests:
```bash
node smoke.js
node fuzz.js
node aiplay.js
```

## 📝 License

MIT — Made for Arena.
