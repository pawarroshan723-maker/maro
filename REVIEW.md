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
not engine bugs. **All 15 are now fixed.** Originally eight were fixed and six were
flagged for sign-off; the second pass fixed those six too, so nothing outstanding
remains.

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

## Fixed in the second pass (originally flagged for sign-off)

### 9. Hostile bolts froze in bonus rooms and resumed on exit
You could step out of a bonus room straight into a guardian bolt already in flight.
`exitBonus()` now clears `enemyShots` **as you return**, so the bolts still hang
frozen (and visible) while you're inside — the existing *"guardian bolts freeze in
bonus rooms"* assertion still exercises real bolts rather than passing vacuously on
an empty array. Verified both halves.

### 10. Stale artifacts and scratch harnesses deleted
`extracted.js` was an old 94 KB snapshot of a now-150 KB script that nothing read.
`debug1–9.js`, `dbg_power.js`, `pitdebug.js`, `jumpdist.js` and `aitrace.js` were
worse than clutter: **every one of them hardcodes `/home/user/game/index.html`**,
a path that doesn't exist in this repo, so they all crash on launch. All 14 deleted,
and a `.gitignore` now keeps that class of file out. The documented dev tools
(`build.js`, `smoke.js`, `campaign-check.js`, `aiplay.js`, `fuzz.js`) are untouched.

### 11. Dead level fields trimmed
`Level` computed four pole-extent fields; only `flagTop` was ever read, and only by
`smoke.js:659`. The two `*Bottom` fields are gone; `flagTop`/`checkTop` are kept as
level-integrity metadata, now with an early exit once both are found.

### 12. `Particles.idx` no longer grows unbounded
`this.pool[this.idx++ % MAX_PARTICLES]` → `this.idx = (this.idx + 1) % MAX_PARTICLES`.

### 13. You can now pause during the 1.2 s intro
`doPause()` accepted only `PLAYING`, yet the `visibilitychange` handler asked it to
pause on `PLAYING || READY` — so tabbing away mid-intro silently didn't pause.
It now pauses from either, remembers which, and `doResume()` returns you to
`READY` rather than skipping the rest of the intro. The `blur` handler matches.

### 14. Touch pad no longer shows through end-of-run panels
`body.in-game` was only cleared by `toTitle()`, so the pad rendered behind the
GAME OVER and COURSE CLEAR overlays. Added a separate `body.ended` class that hides
only `#touch-ui` — **sound and fullscreen stay reachable** on those screens, which
removing `in-game` outright would have broken.

### 15. Pause → restart button relabelled
It calls `restartLevel()`, not `startGame()`, so it's a checkpoint restart that
keeps score and lives. Behaviour is unchanged (it's sensible); the button now reads
**RESTART FROM CHECKPOINT** so it isn't mistaken for a fresh run.

---

## Validation after the changes

```
node build.js              # rebuilt index.html from the part files
node smoke.js              # ALL CHECKS PASSED
node campaign-check.js     # All 15 stages passed terrain, fuzz and regression validation.
```

No engine, collision, level-generation or rendering behaviour was touched — only
the state machine, settings UI, spawn determinism, repo hygiene and documentation.

The six second-pass fixes were each confirmed by a targeted headless probe
(bolt freeze-then-clear, pause/resume from both `READY` and `PLAYING`, the `ended`
class on both end panels, and the particle ring index) as well as by the two
existing suites.
