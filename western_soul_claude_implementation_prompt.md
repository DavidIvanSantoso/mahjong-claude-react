# Claude Implementation Prompt — WESTERN SOUL
## Single-Player Bullet-Dodging Survival Browser Game

You are a senior game designer and frontend game engineer. Build a polished, playable single-player browser game inspired by the *bullet-dodging combat mechanics* of Undertale, but with an original **Wild West / cowboy** identity. Do not copy Undertale characters, sprites, music, UI, attack designs, dialogue, or other protected assets.

The working title is **WESTERN SOUL**. You may suggest a stronger title, but keep the Wild West survival concept.

---

# 1. Project Goal

Create a browser-based survival game where the player controls a small character inside a bounded combat arena and dodges incoming projectiles, traps, and enemy attack patterns.

The core appeal should be:
- Easy to understand, difficult to master.
- Responsive and precise movement.
- Readable attack telegraphs and fair collision.
- Increasing pressure and varied projectile patterns.
- Short, replayable runs with a satisfying score chase.
- A distinctive Western atmosphere.

This is a **single-player game**. Do not implement multiplayer, accounts, backend services, or online leaderboards.

## Existing project assumptions
- Frontend: React + TypeScript.
- Target: desktop browser first, with responsive support for smaller screens.
- Rendering: HTML5 Canvas for the real-time game scene.
- UI: React components for menus, HUD, pause screen, settings, and results.
- Persistence: LocalStorage for best score and user settings.
- No database or server is required.

Before changing files, inspect the existing repository and follow its conventions. Do not replace or restructure unrelated parts of the project. If the repository is empty, create a clean and maintainable structure.

---

# 2. Creative Direction

## Theme: Wild West / Cowboy

The game takes place in a stylized frontier town, dusty canyon, abandoned saloon, or desert showdown arena.

Visual atmosphere:
- Warm desert palette: sand, burnt orange, dusty brown, muted gold, dark burgundy, and charcoal.
- Western details: wanted posters, sheriff stars, revolvers, dynamite, cactus silhouettes, tumbleweeds, wooden signs, rope, lanterns, and saloon motifs.
- Dramatic but readable effects: dust clouds, muzzle flashes, impact sparks, smoke trails, and subtle screen shake.
- Original Western-inspired UI: wooden panels, engraved borders, sheriff-star indicators, wanted-poster result screen, and vintage typography.

Choose a coherent art direction. **Recommended default: polished 2D pixel art**, but it is acceptable to use clean illustrated/vector-like 2D graphics if that produces a more cohesive result. Do not mix styles randomly.

The game should feel like an arcade Western showdown rather than a realistic gun simulator.

## Player identity

The player controls an original small glowing **soul / heart-shaped spirit**, optionally styled as a sheriff's badge, ember, or tiny frontier spirit. It should be visually distinct from enemies and projectiles.

The player is not required to shoot. The main gameplay is dodging and survival.

---

# 3. Core Gameplay Loop

1. Player selects a game mode and starts a run.
2. A short intro/countdown appears.
3. Player is placed inside the combat arena.
4. An enemy attack pattern begins.
5. Player dodges projectiles and hazards.
6. Surviving the pattern grants score and advances the encounter.
7. Attack intensity and pattern complexity gradually increase.
8. The run ends when player health reaches zero or the player completes the selected challenge.
9. Show a results screen with score, survival time, waves cleared, hits taken, and best-score comparison.
10. Player can retry immediately.

The first playable version should prioritize the core dodge loop over narrative content.

---

# 4. Game Modes

Implement the following modes if scope allows. The first release must make **Endless Survival** fully playable.

## A. Endless Survival — Primary Mode
- Survive as long as possible.
- Waves continue indefinitely.
- Difficulty increases gradually.
- Introduce new attack patterns over time.
- Track survival time, wave, score, and best score.
- Provide a clear game-over and instant retry flow.

## B. Showdown / Boss Encounters — Secondary Mode
- Face a sequence of original Western-themed bosses.
- Each boss has multiple attack phases.
- Boss attacks should be telegraphed and learnable.
- A boss encounter should feel like a duel, not a random projectile spam test.

## C. Wanted Challenges — Optional Mode
- Short handcrafted challenges with specific rules.
- Examples:
  - Survive 30 seconds without taking damage.
  - Survive using no dash.
  - Dodge a fixed sequence of attacks.
  - Survive with only one heart.
- Each challenge has a clear objective and completion result.

Do not let optional modes delay a polished Endless Survival mode.

---

# 5. Player Controls and Movement

## Desktop controls
- `WASD` or arrow keys: move in eight directions.
- `Shift` or `Space`: dash, if dash is enabled.
- `Esc`: pause / resume.
- `Enter`: confirm menu selections where appropriate.

Avoid browser scrolling when movement keys are pressed during gameplay.

## Movement requirements
- Smooth, frame-rate-independent movement.
- Normalize diagonal movement so diagonal speed is not faster.
- Clamp the player to the arena bounds.
- Movement should feel responsive, not floaty.
- Use a configurable movement speed.
- Support keyboard input cleanly, including key release and window blur.

## Dash
Recommended default: include a short dash with a cooldown.
- Dash gives a brief burst of movement.
- Dash must not become a permanent escape from every attack.
- Display cooldown clearly.
- Use a small visual trail and sound effect.
- Decide explicitly whether dash grants a very brief invulnerability window. If enabled, keep it short and balance it carefully.
- Dash should be optional in settings or a mode modifier if balancing requires it.

## Mobile / touch support
- Add a virtual joystick or touch movement control.
- Add a separate dash button if dash is enabled.
- Keep controls away from important HUD elements.
- The desktop experience remains the primary target.

---

# 6. Arena

Use a bounded rectangular arena inspired by Undertale's battle box, redesigned as a Western-themed combat space.

Visual ideas:
- Wooden floorboards or dusty ground.
- A subtle rope / fence boundary.
- Corner posts, sheriff-star details, or a saloon-stage frame.
- Background scenery outside the active arena, such as a desert sunset or saloon interior.

Requirements:
- The player cannot leave the arena.
- Projectiles should have clear entry points and readable trajectories.
- Arena dimensions may change for special attacks, but do not resize unpredictably.
- Ensure the arena scales correctly across screen sizes while preserving gameplay proportions.
- Avoid decorative details that obscure projectiles or the player.

---

# 7. Health, Damage, and Feedback

Recommended starting balance:
- Player starts with **5 HP**.
- A normal projectile hit removes **1 HP**.
- After taking damage, grant a brief invulnerability period (for example, 0.7–1.0 seconds).
- During invulnerability, show a clear but tasteful blink or glow.
- Avoid repeated damage every frame while overlapping one projectile.
- Health should be displayed as hearts, sheriff stars, or small spirit icons.

Damage feedback:
- Brief hit flash.
- Small screen shake, used sparingly.
- Clear damage sound.
- Visible health update.
- Do not obscure the playfield with large effects.

All values must be configurable in one place.

---

# 8. Projectile and Hazard System

Create a reusable projectile system. Do not hardcode each attack directly into the main game loop.

Every projectile should support:
- Position and velocity.
- Radius or collision shape.
- Visual style.
- Damage value.
- Lifetime / despawn rules.
- Optional acceleration or curved movement.
- Optional warning / telegraph phase.
- Collision handling.
- Clear ownership or attack identifier for debugging.

Use object pooling if projectile counts become high. Avoid unnecessary React state updates on every animation frame.

## Required attack patterns

Create at least these original patterns:

### 1. Revolver Fan
A sheriff or outlaw fires a fan of bullets from one side of the arena.
- Several projectiles spread at different angles.
- Leave gaps for the player to pass through.
- Vary spread width and speed.

### 2. Ricochet Round
Bullets bounce from arena walls.
- Limit the number of bounces.
- Make the trajectory readable.
- Avoid impossible or inescapable bounce combinations.

### 3. Dynamite Warning
A marked area appears before a dynamite explosion.
- Show a warning circle or crosshair.
- Give the player time to move away.
- Explode after a clear countdown.
- Apply damage only within the blast radius.

### 4. Tumbleweed Roll
A rolling tumbleweed crosses the arena.
- It can move in straight or gently curved paths.
- Use multiple speeds and entry points.
- It should be visually distinguishable from bullets.

### 5. Cactus Barrage
Spikes or thorn projectiles emerge from arena edges.
- Telegraph the affected edge or lane.
- Use staggered timing.
- Leave safe routes.

### 6. Lasso Sweep
A rope-like hazard sweeps across part of the arena.
- Show its path before activation.
- Use a readable line or arc collision shape.
- Make timing and safe gaps important.

### 7. Wanted Mark
A target marker follows or predicts the player's position.
- Mark the target location.
- Fire after a short delay.
- The shot should target the marked location, not unfairly home in forever.

### 8. Dust Storm
A sequence of broad projectile waves moves across the arena.
- Create safe gaps.
- Vary direction and spacing.
- Use dust as atmosphere without reducing visibility.

## Pattern fairness
- Every dangerous attack must be readable.
- Telegraph attacks before damage whenever appropriate.
- Never spawn unavoidable damage directly on the player.
- Avoid patterns that completely fill the arena without a safe route.
- Difficulty should come from timing, positioning, and pattern combinations—not visual clutter.
- Add a debug option to display projectile hitboxes and attack warnings.

---

# 9. Wave and Difficulty Design

Use a data-driven wave configuration.

Suggested progression:
- Early waves: introduce one pattern at a time.
- Middle waves: combine two familiar patterns.
- Later waves: increase speed, density, and timing complexity.
- Periodically introduce a short recovery window.
- Avoid increasing every difficulty variable simultaneously.

Difficulty variables:
- Projectile speed.
- Projectile count.
- Spawn interval.
- Pattern duration.
- Number of simultaneous patterns.
- Telegraph duration.
- Safe-gap width.

Use a difficulty curve that is challenging but fair. The player should have enough time to learn each new pattern before it becomes intense.

Create a pattern scheduler that can:
- Select patterns based on wave and difficulty.
- Prevent repetitive sequences.
- Avoid incompatible pattern combinations.
- Add a short transition between attacks.
- Support seeded/randomized runs for reproducible debugging.

---

# 10. Score and Progression

Suggested scoring:
- Survival time contributes to score.
- Clearing a wave grants a bonus.
- Avoiding damage during a wave grants a perfect-dodge bonus.
- Boss or challenge completion grants a larger bonus.
- Do not reward reckless or exploitative behavior.

Track:
- Current score.
- Best score.
- Survival duration.
- Highest wave reached.
- Total projectiles dodged (if reliably measurable).
- Hits taken.
- Perfect waves.

Store best score and settings in LocalStorage.

Optional upgrades for a later version:
- Extra heart.
- Faster movement.
- Shorter dash cooldown.
- One-hit shield.
- Longer invulnerability after damage.
- Score multiplier.

If upgrades are added, offer a small number of choices between encounters. Avoid creating an overly complicated RPG system before the survival loop is fun.

---

# 11. Boss Design

Create at least one original Western boss for the secondary boss mode or a later milestone.

Example: **The Gunslinger**
- Phase 1: Revolver Fan and Wanted Mark.
- Phase 2: Ricochet Round and Lasso Sweep.
- Phase 3: Faster combinations with a short recovery window.
- Use clear phase transitions and distinct attack telegraphs.

Other possible bosses:
- The Undertaker: coffin-shaped hazards and slow, heavy attacks.
- The Dynamite Kid: timed explosions and arena zones.
- The Cactus Queen: thorn volleys and edge hazards.
- The Train Wraith: sweeping attacks that resemble a passing locomotive.

Bosses must be original characters. Do not reproduce Undertale bosses or attack sequences.

---

# 12. UI / UX

Create a polished game flow:

## Main menu
- Game title and Western-themed background.
- Play / Endless Survival.
- Boss Showdown (if implemented).
- Wanted Challenges (if implemented).
- How to Play.
- Settings.
- Best score.

## In-game HUD
- Health.
- Current wave / encounter.
- Score.
- Survival timer.
- Dash cooldown indicator.
- Optional boss health / phase indicator.

## Pause screen
- Resume.
- Restart run.
- Settings.
- Main menu.

## Game-over screen
Style it like a Western wanted poster:
- “WANTED: STILL ALIVE” or another fitting original phrase.
- Final score.
- Survival time.
- Wave reached.
- Hits taken.
- New best score indicator.
- Retry.
- Main menu.

## Settings
- Master volume.
- SFX volume.
- Screen shake toggle.
- Reduced flashes / reduced motion option.
- Control hints.
- Optional dash toggle if supported.

Make menus keyboard accessible. Use clear focus states and readable text.

---

# 13. Audio and Atmosphere

Use original or properly licensed audio only.
- Subtle Western-inspired background music.
- Revolver / projectile firing sounds.
- Dynamite warning and explosion sounds.
- Hit feedback.
- Dash sound.
- Wave transition cue.
- Boss introduction cue.

Do not use music or sound effects ripped from Undertale or any other copyrighted game.

Provide mute and volume controls. The game must remain fully playable with audio disabled.

---

# 14. Technical Architecture

Keep the rendering and simulation independent from React's render cycle.

Suggested structure (adapt to the existing repository):

```text
src/
  game/
    engine/
      GameLoop.ts
      GameState.ts
      Renderer.ts
      InputManager.ts
      CollisionSystem.ts
      CameraEffects.ts
    entities/
      Player.ts
      Projectile.ts
      Hazard.ts
      Enemy.ts
    systems/
      PlayerSystem.ts
      ProjectileSystem.ts
      HazardSystem.ts
      WaveSystem.ts
      PatternScheduler.ts
      ScoreSystem.ts
    patterns/
      RevolverFan.ts
      RicochetRound.ts
      DynamiteWarning.ts
      TumbleweedRoll.ts
      CactusBarrage.ts
      LassoSweep.ts
      WantedMark.ts
      DustStorm.ts
    config/
      balance.ts
      waves.ts
      patterns.ts
    types/
      game.ts
  components/
    GameCanvas.tsx
    MainMenu.tsx
    GameHUD.tsx
    PauseOverlay.tsx
    GameOverScreen.tsx
    SettingsPanel.tsx
    HowToPlay.tsx
  hooks/
    useGameSettings.ts
  utils/
    storage.ts
```

This is a suggested structure, not a requirement to create every file. Keep modules cohesive and avoid unnecessary abstraction.

## Game loop
- Use `requestAnimationFrame`.
- Use delta time for frame-rate-independent movement.
- Clamp unusually large delta times after tab switching.
- Separate update and render phases.
- Keep gameplay simulation out of React component state.
- React should manage high-level screens and low-frequency UI updates.
- Clean up animation frames and event listeners on unmount.

## Collision
- Use circle-circle collision for circular projectiles and the player as a good initial approach.
- Support other shapes where necessary (line / capsule for lasso, circle for explosions).
- Consider slightly forgiving hitboxes compared with visible sprites.
- Ensure collision checks are efficient with many projectiles.

## Performance
- Target smooth 60 FPS on typical desktop browsers.
- Avoid allocating large numbers of temporary objects every frame.
- Use object pooling if needed.
- Cap or clean up expired projectiles.
- Avoid unnecessary React re-renders during gameplay.

---

# 15. Visual and Gameplay Quality Requirements

The game should not look like a bare technical prototype.

Minimum quality bar:
- Cohesive Western art direction.
- Smooth player movement.
- Distinct player and projectile silhouettes.
- Clear warning indicators.
- Satisfying hit and dash feedback.
- Polished menu and HUD.
- Responsive layout.
- No visual effects that hide critical gameplay information.
- No placeholder buttons that do nothing.

If custom art assets are unavailable, create original Canvas-drawn shapes, particles, and simple pixel-art-like sprites. Keep the visuals consistent.

---

# 16. Accessibility and Usability

- Support keyboard-only navigation in menus.
- Provide readable contrast.
- Add reduced-flash options.
- Do not rely on color alone to communicate danger.
- Make attack warnings visually distinct through shape, animation, and timing.
- Allow audio to be muted.
- Provide a brief How to Play screen.

---

# 17. Development Milestones

Implement in small, testable milestones.

## Milestone 1 — Playable Core
- Main menu.
- Arena.
- Player movement.
- Keyboard input.
- One projectile type.
- Collision and health.
- Game-over and retry.
- Functional game loop.

## Milestone 2 — Bullet Hell Foundation
- Reusable projectile system.
- All required basic patterns.
- Telegraphs and hazards.
- Dash and cooldown.
- Wave scheduler.
- Difficulty progression.

## Milestone 3 — Game Feel
- Western visuals.
- Particles and effects.
- Sound effects and music.
- HUD and pause menu.
- Results screen.

## Milestone 4 — Replayability
- Score system.
- Local best score.
- More patterns.
- Boss encounter.
- Optional upgrades.
- Challenges.

## Milestone 5 — Polish and QA
- Responsive layout.
- Touch controls.
- Performance profiling.
- Edge-case testing.
- Accessibility options.
- Fix all broken controls and incomplete flows.

Do not attempt to implement every milestone in one giant, unreviewed change if the repository is substantial. Work incrementally and keep the app runnable after each milestone.

---

# 18. Testing Checklist

Verify at minimum:

### Controls
- WASD works.
- Arrow keys work.
- Diagonal movement is normalized.
- Player cannot leave the arena.
- Dash works and cooldown resets.
- Input does not remain stuck after tab switching or window blur.
- Pause stops gameplay simulation.

### Combat
- Projectiles spawn and move correctly.
- Collision removes the correct amount of HP.
- Invulnerability prevents repeated damage.
- Expired projectiles are removed.
- Telegraphs appear before attacks.
- Every pattern has at least one fair dodge route.
- Game ends at zero HP.

### Game flow
- Main menu starts a run.
- Pause and resume work.
- Restart resets the run correctly.
- Game-over results are accurate.
- Best score persists after refresh.
- Settings persist after refresh.
- No buttons are decorative or nonfunctional.

### Performance
- No runaway projectile accumulation.
- No duplicate animation loops.
- No event-listener leaks.
- Stable performance with dense projectile patterns.
- No major frame-rate dependence.

---

# 19. Important Implementation Rules

1. Inspect the repository before coding.
2. Preserve existing project setup and conventions.
3. Do not add a backend or database.
4. Do not use copyrighted Undertale assets, audio, characters, or copied attack patterns.
5. Keep game balance values configurable.
6. Use TypeScript types for entities, patterns, and game states.
7. Avoid putting the entire game in one React component.
8. Avoid React state updates every animation frame.
9. Make all visible controls functional.
10. Prioritize fair, responsive, enjoyable gameplay over feature count.
11. If a requirement conflicts with the existing architecture, explain the trade-off and choose the least disruptive solution.
12. Run the available lint, type-check, and build commands after implementation. Fix errors introduced by your changes.

---

# 20. First Task for Claude

Start by inspecting the repository and reporting:
- Existing framework and project structure.
- Existing scripts and available dependencies.
- Best place to integrate the game.
- Any constraints or conflicts with this specification.

Then propose a concise implementation plan.

After the plan, begin with **Milestone 1 — Playable Core** unless the user explicitly asks for planning only.

At the end of each milestone:
- Summarize files created or changed.
- Explain what is playable.
- List tests and commands run.
- Report known limitations.
- State the next recommended milestone.

**Final objective:** Deliver a polished, original Wild West bullet-dodging survival game that feels responsive, fair, atmospheric, and highly replayable in a browser.
