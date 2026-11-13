# PROJECT MASTER PROMPT --- MAZE MULTIPLAYER RACE

## 1. Role and Objective

Act as a Senior Game Developer, Multiplayer Network Engineer, Game
Designer, and UI/UX Designer.

Design and implement a browser-based multiplayer game called **MAZE
RACE** (working title).

Up to 8 players compete simultaneously inside the same procedurally
generated maze. The objective is simple:

**Be the first player to find the exit and escape the maze.**

The game should feel like a polished competitive arcade game:
responsive, readable, fun, and visually distinctive.

Do not build a generic maze demo. Prioritize a complete, reliable
multiplayer racing experience.

------------------------------------------------------------------------

## 2. Project Constraints

### Technology stack

-   React
-   TypeScript
-   Vite
-   HTML5 Canvas for game rendering
-   WebRTC DataChannel for peer-to-peer communication
-   GitHub Pages for static hosting
-   No traditional game backend
-   No database for match data
-   No mandatory user registration or authentication

The game must run in modern desktop browsers.

### Multiplayer architecture

Use a **Host & Spokes (Star Topology)** architecture.

-   One player creates a room and becomes the Host.
-   Other players join through a room code.
-   Maximum 8 players, including the Host.
-   Each guest connects to the Host using WebRTC.
-   The Host is authoritative for match state, player positions,
    collision validation, and winner determination.
-   The Host distributes relevant game state to all connected clients.

**Important networking constraint:** WebRTC still requires signaling to
exchange connection information. Inspect the existing project and
determine whether its current P2P/signaling implementation can be
reused. Do not assume GitHub Pages provides signaling.

If no suitable signaling mechanism exists, explain practical options and
trade-offs before implementing one. Prefer reusing a proven existing P2P
connection flow over introducing unnecessary infrastructure.

Support STUN. Make TURN configurable as an optional fallback. Do not
hardcode credentials or secrets.

------------------------------------------------------------------------

## 3. Core Game Specifications

  Feature           Requirement
  ----------------- ---------------------------------------
  Game mode         Multiplayer Maze Race
  Maximum players   8
  Maze              Identical for everyone
  Maze generation   Procedural, deterministic seed
  Movement          Smooth real-time movement
  Gameplay          Competitive
  Winner            First valid player to reach the exit
  Match ending      Immediately after winner is validated
  Room system       Create / Join using room code
  Backend           No traditional backend
  Rendering         HTML5 Canvas

### Core gameplay loop

1.  Host creates a room.
2.  Other players join the room.
3.  Players wait in the lobby.
4.  Host starts the match when the minimum required conditions are met.
5.  Host generates a maze seed and match configuration.
6.  All clients load the same maze.
7.  Countdown begins: 3, 2, 1, GO!
8.  Players navigate through the maze simultaneously.
9.  Players can see other players moving in real time.
10. The first player to reach the exit wins.
11. The Host validates the winner and immediately ends the match.
12. All clients transition to the Winner screen.

------------------------------------------------------------------------

## 4. Maze Generation System

All players must receive an identical maze.

### Seed-based generation

The Host generates a random seed at the beginning of each match, for
example:

`mazeSeed = 847291`

Every client must be able to reproduce exactly the same maze from that
seed.

Requirements:

-   Use deterministic procedural generation.
-   The same seed and configuration must always produce the same maze.
-   Maze generation must not depend on rendering or frame rate.
-   All clients must use identical maze dimensions and generation rules.
-   Distribute the seed and configuration to all players during match
    initialization.
-   Consider transmitting a compact maze checksum so clients can verify
    that their generated maze matches the Host's.

### Maze design

Create a maze with:

-   One start position per player.
-   One shared exit.
-   Connected pathways.
-   Walls and corridors.
-   No unreachable regions required to complete the maze.
-   No impossible paths.
-   No spawn directly beside the exit.

The maze should be challenging but fair.

### Fairness

Because everyone competes in the same maze:

-   Spawn positions should be distributed fairly.
-   Every spawn must have a valid route to the exit.
-   Avoid giving one player an overwhelmingly shorter route.
-   Use pathfinding/BFS distance calculations to estimate each spawn's
    distance to the exit.
-   Balance spawn locations so their shortest-path distances are
    reasonably close.
-   Validate the maze before starting the match.

The maze should feel different every round.

### Algorithm selection

Evaluate suitable algorithms such as:

-   Recursive Backtracking
-   Prim's Algorithm
-   Randomized Kruskal

Choose an algorithm appropriate for the desired maze feel and explain
the trade-offs. Avoid overengineering.

------------------------------------------------------------------------

## 5. Player Movement System

Movement must be smooth and continuous, not tile-by-tile.

### Controls

Desktop keyboard controls:

-   W / Arrow Up = Move Up
-   A / Arrow Left = Move Left
-   S / Arrow Down = Move Down
-   D / Arrow Right = Move Right

Requirements:

-   Smooth, responsive movement.
-   Consistent movement speed.
-   Collision detection against maze walls.
-   Players cannot pass through walls or leave maze boundaries.
-   Prevent players from getting stuck at corridor corners.
-   Support diagonal movement if appropriate, with normalized diagonal
    speed.
-   Movement should remain responsive despite network latency.

### Collision detection

Implement an appropriate collision approach using a player radius or
bounding box.

-   Prevent movement through walls.
-   Prevent tunneling through walls at high speeds.
-   Handle corners and narrow corridors reliably.
-   Keep collision rules deterministic between Host and clients.
-   Use a fixed timestep or robust delta-time simulation.

### Movement feel

The game should feel like a real-time arcade game, not a board game.

Use delta time or a fixed timestep for stable movement across different
frame rates. Separate simulation from rendering.

------------------------------------------------------------------------

## 6. Multiplayer Synchronization

This is the most critical technical system.

The game must support up to 8 simultaneous players.

### Host responsibilities

The Host is responsible for:

-   Maintaining authoritative match state.
-   Receiving player input or movement intent.
-   Validating movement and collisions.
-   Tracking player positions and status.
-   Tracking player connection status.
-   Detecting when a player reaches the exit.
-   Determining the winner.
-   Broadcasting relevant game state to all connected clients.

### Client responsibilities

Each client is responsible for:

-   Sending movement input to the Host.
-   Rendering its own player responsively.
-   Rendering other players.
-   Interpolating remote player positions.
-   Displaying the synchronized maze.
-   Displaying match information and connection status.

### Network protocol

Use WebRTC DataChannel and define a typed, versioned message protocol.

Separate messages into logical categories:

1.  Lobby messages
2.  Player join/leave messages
3.  Ready status messages
4.  Match initialization messages
5.  Player input messages
6.  Player state updates
7.  Match state updates
8.  Winner announcement
9.  Disconnect and error notifications

Every message should have a clear type and validated payload. Handle
malformed, stale, or unexpected messages safely.

Use lightweight payloads. Do not repeatedly transmit the entire maze.

### Movement synchronization

Prefer sending input intent to the Host rather than trusting arbitrary
client-reported positions.

Implement:

-   Host-authoritative simulation.
-   Controlled input/update frequency.
-   Remote-player interpolation.
-   Client-side prediction for the local player only if it can be
    reconciled reliably with Host state.
-   Sequence numbers or timestamps to discard stale updates.
-   Reliable delivery for critical events.
-   Unreliable or latest-state-oriented delivery for frequent movement
    updates where appropriate.

Do not send unnecessary network traffic every animation frame.

Aim for responsive movement without excessive bandwidth usage.

### Host disconnect

For the initial MVP:

-   If the Host disconnects, terminate the match gracefully.
-   Show a clear disconnection message.
-   Provide an option to return to the main menu.
-   Do not implement host migration unless it can be delivered reliably
    without making the initial implementation unnecessarily complex.

### Important fairness limitation

A player-hosted architecture cannot provide strong anti-cheat guarantees
because the Host controls the authoritative simulation. Explain this
limitation clearly. For a casual friends-only game, host authority is an
acceptable MVP trade-off.

------------------------------------------------------------------------

## 7. Winner Detection

The first player to reach the exit wins.

Requirements:

-   The Host validates the player's position against the exit area.
-   Do not rely only on client-side winner detection.
-   The Host must prevent multiple winners.
-   The first valid finish event locks the match result.
-   Once a winner is confirmed, freeze the match.
-   Broadcast the winner to all connected players.
-   Transition everyone to the Winner screen.

The Winner screen should show:

-   Winner name.
-   Winner avatar/color.
-   Final maze or a simplified race overview.
-   Other players' final positions or statuses, if available.
-   Play Again button.
-   Return to Lobby button.

------------------------------------------------------------------------

## 8. Game UI / UX Design

Create a modern, polished, minimalist arcade interface.

The visual identity should feel competitive, playful, and clean. Avoid
generic dashboard UI.

### Main menu

Include:

-   Game title / logo.
-   Play button.
-   Create Room.
-   Join Room.
-   Settings.
-   How to Play.

### Lobby

Include:

-   Room code.
-   Copy room code button.
-   Player list.
-   Player colors.
-   Host indicator.
-   Ready status.
-   Start Match button (Host only).
-   Waiting for players status.
-   Clear connection status for each player.

Show up to 8 player slots.

### In-game HUD

Display:

-   Current player name.
-   Other player indicators.
-   Countdown.
-   Elapsed time.
-   Player status.
-   Connection status.
-   Optional compact mini-map or exploration indicator if it improves
    gameplay.

Keep the HUD minimal so it does not distract from navigation.

### Maze rendering

Use HTML5 Canvas.

Visual direction:

-   Top-down 2D perspective.
-   Clean geometric maze.
-   Clear wall and floor distinction.
-   Distinct player colors.
-   Clearly visible exit.
-   Smooth player animations.
-   Subtle visual effects.
-   Responsive canvas scaling.
-   Readable at different screen sizes.

Every player must be visually distinguishable. Use a consistent color
palette and player identity across lobby, game, and results.

### Winner screen

Create an exciting victory presentation. Visually emphasize the winner
and clearly communicate that the match has ended.

------------------------------------------------------------------------

## 9. Gameplay Rules and Competitive Fairness

Keep the initial rules simple:

-   Every player starts at the same time.
-   Everyone gets the same maze.
-   No player can pass through walls.
-   No player can move outside the maze.
-   The first player to reach the exit wins.
-   No power-ups or attacks in the initial MVP.
-   No elimination system.
-   No respawn system.

Prioritize pure racing and navigation skill. Do not add mechanics that
compromise the core race before it is stable.

------------------------------------------------------------------------

## 10. Technical Architecture

Propose a clean architecture before implementation.

Suggested structure:

``` text
src/
├── components/
│   ├── MainMenu/
│   ├── Lobby/
│   ├── GameHUD/
│   └── WinnerScreen/
│
├── game/
│   ├── engine/
│   │   ├── GameLoop.ts
│   │   ├── Renderer.ts
│   │   └── Camera.ts
│   │
│   ├── maze/
│   │   ├── MazeGenerator.ts
│   │   ├── MazeValidator.ts
│   │   ├── MazePathfinding.ts
│   │   └── MazeRenderer.ts
│   │
│   ├── player/
│   │   ├── Player.ts
│   │   ├── Movement.ts
│   │   └── Collision.ts
│   │
│   └── match/
│       ├── MatchManager.ts
│       └── WinnerDetector.ts
│
├── multiplayer/
│   ├── WebRTCManager.ts
│   ├── PeerManager.ts
│   ├── SignalingManager.ts
│   ├── NetworkProtocol.ts
│   └── StateSynchronizer.ts
│
├── hooks/
├── types/
├── utils/
└── App.tsx
```

You may adjust the structure if a better architecture is justified.

Do not put all game logic inside React components.

Separate:

-   Game simulation
-   Canvas rendering
-   Networking
-   Match state
-   UI state

Use clear interfaces between these systems.

------------------------------------------------------------------------

## 11. Implementation Phases

Do not attempt to implement everything in one giant step. Work
incrementally and keep the project runnable after each phase.

### Phase 1 --- Project Inspection and Technical Design

-   Inspect the existing repository.
-   Identify React/Vite/TypeScript configuration.
-   Identify existing P2P/WebRTC implementations that can be reused.
-   Identify existing signaling and STUN/TURN configuration.
-   Determine whether the current signaling solution supports 8 players.
-   Propose the final architecture.
-   Identify technical risks and limitations.

Do not overwrite existing working systems without a clear reason.

**Deliver a concise technical plan before coding.**

### Phase 2 --- Single-Player Maze Prototype

Implement:

-   Procedural maze generation.
-   Seed-based generation.
-   Maze validation.
-   Spawn fairness calculation.
-   Player movement.
-   Smooth animation.
-   Wall collision.
-   Exit detection.
-   Basic Canvas rendering.

At this stage, the game must be playable locally without multiplayer.

### Phase 3 --- Multiplayer Lobby

Implement:

-   Create room.
-   Join room.
-   Room code.
-   Maximum 8 players.
-   Player identity.
-   Player colors.
-   Ready status.
-   Host controls.
-   Connection status.

Test with multiple browser tabs before proceeding.

### Phase 4 --- Multiplayer Synchronization

Implement:

-   WebRTC connections.
-   Host-authoritative state.
-   Player input synchronization.
-   Remote player interpolation.
-   Match initialization.
-   Countdown.
-   Disconnect handling.

Test with multiple browser tabs and multiple physical devices.

### Phase 5 --- Competitive Race

Implement:

-   Simultaneous movement.
-   Winner validation.
-   Match termination.
-   Winner announcement.
-   Results screen.
-   Play Again flow.

### Phase 6 --- Polish and Optimization

Implement:

-   UI polish.
-   Movement animations.
-   Sound effects.
-   Background music with appropriate licensing.
-   Visual feedback.
-   Responsive layout.
-   Performance optimization.
-   Error handling.

### Phase 7 --- GitHub Pages Deployment

Ensure:

-   Vite base path is correctly configured.
-   Static assets load correctly.
-   WebRTC connections work from the deployed HTTPS website.
-   No localhost-only assumptions remain.
-   The game can be accessed through GitHub Pages.
-   Deployment instructions are documented.

------------------------------------------------------------------------

## 12. Testing Requirements

Test and document the following scenarios:

1.  One player can create a room.
2.  Two players can join successfully.
3.  Eight players can join successfully.
4.  A ninth player is rejected.
5.  All players receive the same maze.
6.  Maze seed produces identical layouts across clients.
7.  All players start simultaneously.
8.  Movement is synchronized.
9.  Remote movement appears smooth.
10. Players cannot move through walls.
11. Players cannot leave maze boundaries.
12. The first player to reach the exit wins.
13. Other players immediately see the winner announcement.
14. A guest disconnecting does not crash the match.
15. Host disconnect is handled gracefully.
16. Play Again generates a new maze and resets match state.
17. Repeated matches do not leave stale WebRTC connections.
18. A player cannot send a client-side message to declare themselves the
    winner.

Include a test checklist and document known limitations.

------------------------------------------------------------------------

## 13. Development Rules

Follow these rules throughout implementation:

1.  Prioritize working gameplay over unnecessary abstractions.
2.  Keep the architecture modular.
3.  Use TypeScript types properly.
4.  Avoid `any` unless absolutely necessary.
5.  Avoid unnecessary dependencies.
6.  Do not introduce a backend or database without explaining why it is
    required.
7.  Do not break existing project features.
8.  Keep UI and game logic separated.
9.  Optimize Canvas rendering.
10. Make multiplayer synchronization reliable before adding advanced
    gameplay.
11. Do not fake multiplayer using local player duplication.
12. Do not claim a feature is complete unless it has been implemented
    and tested.
13. Explain important architectural decisions.
14. If a technical requirement cannot be achieved with the current
    infrastructure, explain the limitation and propose alternatives.
15. Do not silently replace existing signaling, networking, or project
    configuration.
16. Keep documentation updated as architecture and implementation
    evolve.

------------------------------------------------------------------------

## 14. First Task --- Inspect Before Coding

Start by inspecting the existing repository.

**Do not immediately generate all the code or make major architectural
changes.**

First, provide:

1.  Current project structure.
2.  Existing technologies and dependencies.
3.  Existing multiplayer/P2P implementation that can be reused.
4.  Current signaling mechanism and whether it supports 8 players.
5.  Recommended architecture for this specific game.
6.  Potential technical bottlenecks.
7.  A phased implementation roadmap.
8.  Any decisions or infrastructure requirements that need my approval.

After presenting the analysis, wait for approval before making major
architectural changes.

The ultimate goal is a polished, fully playable, browser-based
multiplayer maze racing game for up to 8 players, using P2P networking
and static hosting.
