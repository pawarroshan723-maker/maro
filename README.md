# Maro — Gem Dash: The Gem Kingdom

A self-contained, touch-first pixel-art platformer with **15 stages**. Maro travels from Sunny Bluff to Crown Citadel, collecting gems and defeating the three Gate Guardians.

Open `index.html` in a browser: no installation, external assets, or runtime dependencies. Graphics use Canvas 2D and audio uses the Web Audio API.

## How to play

| Action | Default keyboard | Touch |
| --- | --- | --- |
| Move | A / D or ← / → | ◀ / ▶ |
| Jump (hold for height) | Space, W, Z or ↑ | A |
| Run / shoot / kick a shell | Shift or X | B |
| Crouch / enter bonus door | S or ↓ | ▼ |
| Pause | P or Esc | Pause button |
| Sound / fullscreen | M / F | System buttons |

Collect floating gems and hit `?` blocks from below. Growth makes Maro big, Spark Bloom enables fireballs, Nova Star grants nine seconds of invincibility, and life blocks replenish a life. Multi-gem blocks release five rewards. Stand at a wooden bonus door and crouch to enter; the bonus room has gems and an extra life.

Stomp enemies from above or use fireballs. Kick stationary shells to hit other enemies. Reach the finish flag, then the castle entrance. On guardian stages, defeat the guardian before the finish flag will activate.

## The 15-stage adventure

| Stage | Course | Focus |
| --- | --- | --- |
| 1 | Sunny Bluff | Learn movement, blocks, pipes and gems |
| 2 | Sunset Ridge | Raised routes and short ravines |
| 3 | Mosswood Trail | Jumping Hoppers and terraces |
| 4 | Crystal Caverns | Flying Bats above the gem routes |
| 5 | Copper Outpost | First Gate Guardian: 3 hits |
| 6 | Coral Causeway | Armored Beetles: 2 hits |
| 7 | Moonlit Grove | Thorn bypasses and pipe plants |
| 8 | Frostfall Pass | Four-tile ravines and snowfall |
| 9 | Thunder Heights | Faster mixed patrols |
| 10 | Obsidian Keep | Second Gate Guardian: 4 hits |
| 11 | Mirage Dunes | Tighter timing through mixed obstacles |
| 12 | Clockwork Ascent | Terraces, thorns and airborne enemies |
| 13 | Ember Chasm | Expert landings and ember scenery |
| 14 | Eclipse Ridge | Fast patrols and fewer gap assists |
| 15 | Crown Citadel | Final Gate Guardian: 5 hits |

Every course has a distinct deterministic tile layout, a bonus room, gems and power-ups. Stages 3–15 use separately arranged obstacle modules with stage-specific scenery, and a seeded per-stage flavor shifts the mystery-block columns, pipe heights and positions, patrol mixes and hidden extra one-way gem routes so no two courses line up the same way. Later courses progressively increase patrol speed, reduce the timer, widen ravines earlier (never beyond four tiles), and mix more enemy behaviors: armored beetles and extra patrols arrive sooner, thorn beds grow wider on the top tiers, and guardians strike faster with more hit points. Snow, rain, embers and the other weather effects are cosmetic; physics remain consistent.

**Difficulty tiers:** each stage is badged TUTORIAL, ADVENTURE, CHALLENGING, EXPERT or MASTER on its intro card, HUD plate and Stage Select tile, so the ramp is always visible.

**Per-stage art:** every course draws its own landmark skyline — windmills on Sunny Bluff, crystal spires, watchtowers, coral arches, gears, monoliths and the golden Crown Citadel — plus its own ambient weather. The HUD frames each stage's name in its own palette with a numbered crest, and every stage opens with a themed intro card.

**Progression:** Clear a stage and choose **Next Stage** to carry score, gems, lives and form onward. Each new stage starts with a fresh timer and checkpoint. Every third clear awards a life, capped at nine. Stage 15 ends the campaign.

**Replay:** **Stage Select** shows all 15 courses, locked/unlocked status and completion badges. Choose an unlocked stage to start a fresh run. **Continue** starts a fresh run at the highest unlocked stage. Unlocks and badges save to this browser when local storage is available; older Stage 2 unlocks are migrated.

**Checkpoints:** Later stages have safe checkpoints at columns 60 and 112, plus an arena checkpoint at 136 on guardian stages. Restart/death retains the current stage and checkpoint. Late-stage respawns receive brief damage protection. Bonus rooms freeze and hide main-course enemies and hostile bolts.

## New enemies

- **Hopper:** pauses, flashes its forehead and leaps; stomp or shoot it.
- **Bat:** flies a bounded, bobbing route; stomp or shoot it.
- **Armored Beetle:** requires two separated hits. Its glowing shell marks show remaining health. Stomps, fireballs and moving shells damage it.
- **Gate Guardian:** patrols the arena and flashes for under a second (shorter on later courses) before firing a horizontal bolt. Jump bolts and stomp/shoot the guardian. Health bars show remaining hits. Only six hostile bolts can exist at once; bolts expire, hit walls, and are cleared on guardian defeat or stage reset.
- **Lurker ambush:** from Stage 3 on, at least one enemy lies hidden in each course and bursts out when Maro steps close — a genuine jump-scare. More lurkers appear on higher tiers.

Nova Star defeats any enemy, including guardians, and absorbs hostile bolts. Walker, shell and pipe-plant enemies remain throughout the adventure.

## Controls and graphics settings

Pause, then open **Settings**:

- **Keyboard → Default / Custom:** assign letters, numbers, arrows, Space or Shift to movement, crouching, jump and action. Duplicate assignments are rejected. Esc cancels capture; P, M and F stay reserved. Reset Custom Keys restores original primary bindings. Switching to Default does not erase custom assignments. Touch controls are unchanged.
- **Quality → Standard:** 960×540 backing canvas with fewer effects.
- **Quality → High:** 1920×1080 backing canvas with full effects, retaining the pixel-art style. A sustained low-FPS fallback can drop rendering to 1×; changing quality resets it.
- **Reduced effects:** an independent override, also available in High mode.

Settings save locally when browser storage is available.

## Development and validation

The single HTML build is assembled from `partA.html`, `partB.html`, `partC.js`, `partD.js`, `partE.js` and `partF.js`.

```bash
node build.js            # rebuild index.html after source edits
node smoke.js            # gameplay, progression, enemy combat and regression tests
node campaign-check.js   # all 15 terrain traversals + all-stage input fuzz + smoke
```

Individual stages can be simulated with:

```bash
STAGE=8 node aiplay.js
STAGE=15 GEOM_ONLY=1 node aiplay.js
STAGE=15 node fuzz.js
```

**Validation scope:** Terrain traversal deliberately disables enemies to test jump reachability. Combat tests separately cover the new enemies, armor, guardian health/finish gates, warning timing, projectile collisions and limits. Fuzz tests run with enemies enabled and exercise five input seeds across 60 simulated seconds per course. The baseline AI is not a complete strategy for expert combat or guardian fights.

Additional smoke coverage includes all-stage unlocking, progress migration and reload, no Stage 16, life caps, bonus-room isolation, checkpoint recovery, custom controls, quality presets, sprite bounds, pipe seams, diamond expiry and castle entrances. Desktop Chromium checks exercised stage-selection locks, scrolling on a narrow viewport, custom keys, quality switching and new-stage rendering.

No generated screenshots, downloaded browser tools or validation logs are required in the repository. `index.html` remains the only file needed to play.

## License

MIT — Made for Arena.
