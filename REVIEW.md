# Code review — Maro: Gem Dash

Reviewed on 2026-09-16 against `main` @ `5d7bc25`.

**Verdict: not "perfect", but genuinely solid.** The engine core is the part people
usually get wrong, and this one gets it right: fixed-timestep accumulator with a
clamped delta and a spiral guard, axis-separated AABB tile collision, coyote time
and jump buffering, pooled particles, baked gradients, DPR capped at 2 with an FPS
rescue, all storage behind `try/catch`, all audio behind a user-gesture unlock.
`node smoke.js` (100+ assertions) and `node campaign-check.js` (15 stages ×
traversal + input fuzz) both pass.

The problems I found are almost entirely **state-machine and documentation bugs**,
not engine bugs. Eight are fixed below; six I left alone because they're design
calls that need your sign-off.

---

## Fixed

### 1. Music never came back after a death — high severity
`die()` calls `AudioSys.stopMusic()`. `afterDeath()` → `restartLevel()` never
restarted it. `startGame()` and the pause-menu restart button did, but the normal
death path didn't — so **every death left the rest of the session silent** until
you went back to the title screen.

Measured before the fix: `after start: musicOn=true → after pit: false → after
respawn: false`. After: `true → false → true`.

`restartLevel()` now calls `AudioSys.startMusic()`.

### 2. The "Reduced effects" switch lied in Standard quality — medium
`effectsReduced` is `reduced || quality === 'standard'`. Clicking the switch ran
`Settings.reduced = !Settings.effectsReduced`, so in Standard quality it flipped
the stored flag, relabelled itself **OFF**, and changed nothing on screen.

Now the switch reports the state you'll actually see, is **disabled** under
Standard (where it cannot apply), and `#quality-help` says why. The README and the
settings help text both state the interaction explicitly.

### 3. Stage 1 enemies spawned randomly — medium
The `Enemy` constructor used `Math.random()` for `dir`, `walkT` and `phaseT`.
`spawnEntities()` pinned `dir = -1` **only for stages 2–15**, so Stage 1 rolled a
new opening on every retry — and plant timing was random on every stage.

Measured before: 19 distinct spawn states across 20 Stage 1 runs.
After: **1 distinct spawn state** across 20 runs on stages 1, 7 and 15.

Defaults are now deterministic and per-enemy variation is seeded with the existing
`shash(stage, index, salt)` helper, so retries replay the exact same encounter.

### 4. Stale run state survived a death — low
`restartLevel()` left `stompChain`, `chainT`, `gateHintT`, `shakeT` and `multiT`
untouched (`startGame()` resets all of them). A stomp chain from the life you just
lost could keep multiplying points into the next one. All five now reset.

### 5. High score not banked on quitting — low
`high` was only written on game-over and on a course clear. Quitting a good run to
the title threw the score away. `toTitle()` now banks it.

### 6. Docs disagreed with the code on guardian hit points — low
The README stage table said **3 / 4 / 5** hits and the Crown Citadel intro card
said "Final guardian: five hits". The code — and the README's own *Three distinct
bosses* section — uses **4 / 6 / 8** (verified: `boss = round(stage/5)`,
`hp = [0,4,6,8][boss]`). Docs corrected to match the game.

### 7. Stage Select advertised the wrong difficulty bands — low
The panel read "Stages 1–5: Adventure · 6–10: Challenge · 11–15: Expert". The real
tiers are **1 Tutorial · 2–4 Adventure · 5–8 Challenging · 9–12 Expert · 13–15
Master**. Text corrected.

### 8. Dead code — trivial
- `LEVEL_NAME` — declared, never read. Removed.
- `this.state = kind === 'shell' ? 'walk' : 'walk'` — both branches identical. Simplified.
- `LEVEL_TIME` comment claimed "seconds per course"; courses use 195–285 s and it only seeds a field that `startGame()` immediately overwrites. Comment corrected.

---

## Found, not changed — your call

### 9. Hostile bolts freeze in bonus rooms instead of clearing
`enterBonus()` keeps `enemyShots` alive but frozen, so you can exit back into a
bolt already in flight at close range. This is **intentional and covered by a
smoke assertion** ("guardian bolts freeze in bonus rooms"), so I left it. If you
want it gone, clear `this.enemyShots` in `exitBonus()` — but update that test, or
it becomes vacuous (`[].every(...)` is always true).

### 10. `extracted.js` is a stale 94 KB artifact
It's an old snapshot of the game script. The live script is 150 KB and nothing in
the repo reads `extracted.js`. Same story for `debug1–9.js`, `dbg_power.js`,
`pitdebug.js`, `jumpdist.js` and `aitrace.js` — undocumented scratch harnesses
sitting next to the documented ones (`aiplay.js`, `fuzz.js`, `campaign-check.js`).
Recommend deleting them and adding a `.gitignore`.

### 11. `Level.flagTop / flagBottom / checkTop / checkBottom`
Computed on every level build but read only by `smoke.js:659`, never by the game.
Cheap, and the test depends on them — keep or drop deliberately.

### 12. `Particles.idx` grows unbounded
`this.pool[this.idx++ % MAX_PARTICLES]`. Correct forever in practice, but
`this.idx = (this.idx + 1) % MAX_PARTICLES` costs nothing.

### 13. Can't pause during the 1.2 s `READY` intro
`doPause()` requires `PLAYING`, but the `visibilitychange` handler tries to pause
on `PLAYING || READY` — so tabbing away during the intro does not pause.

### 14. Touch pad stays visible behind end-of-run overlays
`body.in-game` is only removed in `toTitle()`, so on GAME OVER and COURSE CLEAR the
on-screen pad renders behind the (higher z-index) overlay panel.

### 15. Pause → "RESTART COURSE" keeps score and lives
It calls `restartLevel()`, not `startGame()`, so it's a checkpoint restart rather
than a fresh run. Probably intended, but the label doesn't say so.

---

## Validation after the changes

```
node build.js              # rebuilt index.html from the part files
node smoke.js              # ALL CHECKS PASSED
node campaign-check.js     # All 15 stages passed terrain, fuzz and regression validation.
```

No engine, collision, level-generation or rendering behaviour was touched — only
the state machine, settings UI, spawn determinism and documentation.
