# ASBUN --- Game Design & Implementation Brief

> **Project codename:** ASBUN\
> **Tagline:** A Game of Deception\
> **Genre:** Multiplayer social deduction / mystery / bluffing\
> **Platform:** Web browser (desktop-first, responsive mobile)\
> **Architecture:** Peer-to-peer using WebRTC DataChannels\
> **Visual direction:** Mystery / Detective / Dark Academia\
> **Primary objective:** Build a polished, replayable multiplayer
> word-deduction game inspired by the social mechanics described in this
> document.

------------------------------------------------------------------------

## 1. Instructions to the implementation agent

You are a senior game designer and full-stack frontend engineer.
Implement **ASBUN** in the existing project repository.

Before changing code:

1.  Inspect the repository, framework, package manager, current game
    architecture, room/lobby flow, peer connection implementation,
    styling system, and existing reusable components.
2.  Identify how the current project handles host/join, room codes,
    player identity, reconnects, game state, and WebRTC signaling.
3.  Reuse and extend the existing architecture wherever practical. Do
    not replace working infrastructure or rewrite the project
    unnecessarily.
4.  Report a concise implementation plan and any important architectural
    constraints before making large structural changes.
5.  Treat this document as the product specification. If the existing
    project has a convention that conflicts with this document, explain
    the conflict and prefer the smallest safe adaptation.
6.  Do not silently omit a feature. If something cannot be implemented
    reliably in a serverless P2P environment, explain the limitation and
    propose a practical fallback.

The result should be a working game, not just a static mockup. All
visible controls must work. Do not use fake multiplayer data in the
final implementation except in an explicitly labelled local
preview/development mode.

## 2. Product vision

ASBUN is a social deduction game where players receive secret identities
and, depending on their role, either the same word, a similar but
different word, or no word at all.

Players take turns giving clues, discuss suspicious behavior, and vote
to eliminate someone. The central tension is that players must reveal
enough information to prove they belong to the majority without
revealing the secret word too clearly.

The three core roles are:

-   **Civilian:** Knows the main word.
-   **Spy / Undercover:** Knows a related but different word.
-   **White Man / Mr. White:** Knows no word and must bluff
    convincingly.

The experience should feel like participating in a mysterious
investigation. Players are suspects, clues are evidence, and voting is
the accusation.

## 3. Brand and visual identity

### 3.1 Name and tagline

-   Game title: **ASBUN**
-   Suggested tagline: **A Game of Deception**
-   Use the title consistently in the browser UI, lobby, game screen,
    and result screen.

### 3.2 Art direction

Create a sophisticated mystery/detective atmosphere. Avoid a childish
cartoon style or a generic neon gaming dashboard.

Visual keywords:

-   Dark academia
-   Vintage detective case files
-   Ink and paper
-   Confidential documents
-   Evidence boards
-   Typewritten case notes
-   Subtle paper grain and ink details
-   Muted antique-gold accents
-   Restrained shadows and borders

The interface should remain clean and readable. Decorative effects must
never interfere with gameplay or accessibility.

### 3.3 Color palette

Use CSS variables/design tokens so the palette can be adjusted globally.

Suggested starting palette:

  Token                    Suggested value            Usage
  ------------------------ -------------------------- ----------------------------------
  `--color-ink`            `#17191B`                  Main dark background
  `--color-ink-soft`       `#242629`                  Elevated panels
  `--color-paper`          `#E9E1D1`                  Main light text / paper surfaces
  `--color-paper-muted`    `#BDB4A4`                  Secondary text
  `--color-antique-gold`   `#B69A62`                  Primary accent
  `--color-blood`          `#8D4141`                  Danger / elimination
  `--color-sage`           `#778675`                  Success / safe state
  `--color-line`           `rgba(233,225,209,0.16)`   Subtle borders

Use dark surfaces as the default. Paper-colored surfaces can be used for
clue cards, case documents, or selected panels. Maintain sufficient
contrast.

### 3.4 Typography

Use an elegant editorial serif with an ink-written feeling, paired with
a highly readable UI font.

Recommended combination:

-   **Cormorant Garamond:** Main display font, page titles, headings,
    and important game words.
-   **DM Sans:** Body copy, buttons, labels, player names, timers, and
    interface controls.
-   **Allura:** Optional decorative accent only, such as a signature,
    small flourish, or handwritten annotation.

Alternative display font to evaluate: **IM Fell English**, especially if
a more old-document / manuscript feeling is desired.

Typography rules:

-   Do not use a cursive font for paragraphs, buttons, timers, or
    essential game information.
-   The secret word should be prominent and immediately readable.
-   Use restrained letter spacing for labels and metadata.
-   Load fonts efficiently and provide sensible system fallbacks.
-   Do not use too many font families or weights.

### 3.5 UI details

-   Prefer fine borders, paper-like cards, subtle grain, and restrained
    shadows.
-   Use small detective-inspired details: case number, classified stamp,
    evidence label, suspect number, or dossier divider.
-   Motion should be subtle: card reveal, stamp animation, phase
    transition, and voting feedback.
-   Respect `prefers-reduced-motion`.
-   Avoid excessive blur, glowing neon, and distracting background
    animation.
-   Use consistent iconography. Prefer an existing icon library already
    installed in the project.

## 4. Core game rules

### 4.1 Roles

#### Civilian

-   Receives the **Civilian word**.
-   Shares that word with all other Civilians.
-   Does not know the Spy word.
-   Does not know which players are Spy or White Man.
-   Gives clues related to the word without making it too obvious.
-   Works with other Civilians to identify and eliminate the opposing
    roles.

#### Spy / Undercover

-   Receives the **Spy word**.
-   Shares that word with other Spies, if the round has more than one
    Spy.
-   The Spy word is related to, but different from, the Civilian word.
-   Does not know the Civilian word.
-   Must blend in by giving clues that sound plausible to Civilians.
-   Wins as a team if the Spy victory condition is reached.

#### White Man / Mr. White

-   Receives no secret word.
-   Is explicitly told that their role is White Man.
-   Does not know either secret word.
-   Must infer the likely Civilian word from clues and discussion.
-   If voted out, gets one opportunity to guess the Civilian word.
-   Wins individually if the guess is correct.

### 4.2 Word-pair design

Each round uses a pair of related words:

-   `civilianWord`: the word given to Civilians.
-   `spyWord`: the related but different word given to Spies.

Example:

-   Civilian word: `Ice Cream`
-   Spy word: `Yogurt`

The relationship should be close enough that a Spy can plausibly blend
in, but different enough that careful clues can expose inconsistencies.

Word-pair data should support:

-   Category
-   Difficulty (`easy`, `medium`, `hard`)
-   Civilian word
-   Spy word
-   Optional locale/language
-   Optional tags

Suggested categories:

-   Food & Beverage
-   Animals
-   Places
-   Technology
-   Nature
-   Professions
-   Objects
-   Sports
-   Entertainment

Create a maintainable local JSON word-pair dataset. Keep word content
separate from game logic. Include enough sample pairs to test every
category and difficulty, but do not claim the sample dataset is
exhaustive.

Do not choose pairs that are unrelated or trivially distinguishable.
Avoid culturally obscure words unless they are marked as hard.

### 4.3 Suggested player and role counts

Initial supported player range: **4--10 players**.

Suggested default role distribution:

    Total players   Civilians   Spies   White Men
  --------------- ----------- ------- -----------
                4           2       1           1
                5           3       1           1
                6           4       1           1
                7           4       2           1
                8           5       2           1
                9           6       2           1
               10           6       2           2

Make role distribution configurable in a clear rules/configuration
module. Validate that every configuration has at least one Civilian, one
Spy, and one White Man, and that the role counts equal the number of
participating players.

The host may select supported player-count presets, but do not allow
invalid custom combinations.

### 4.4 Important information privacy

A player must only receive their own role and their own secret word (if
applicable).

-   Civilian clients receive the Civilian word and their own role.
-   Spy clients receive the Spy word and their own role.
-   White Man clients receive the White Man role and no word.
-   Never broadcast the full role assignment or both secret words to
    every peer.
-   Do not place secret words in shared UI state, public room metadata,
    logs visible to other players, or broadcast game events.
-   Do not reveal a player's word when they are eliminated unless a
    future optional ruleset explicitly enables it.

**P2P trust limitation:** In a host-authoritative peer-to-peer game
without a trusted backend, the host can potentially inspect or
manipulate private game data. The first version may use
host-authoritative orchestration for simplicity, but document this
limitation. Do not describe the game as cheat-proof or cryptographically
secure.

## 5. Round flow and phases

Implement a clear state machine. Suggested phases:

1.  `LOBBY`
2.  `ROLE_REVEAL`
3.  `CLUE`
4.  `DISCUSSION`
5.  `VOTING`
6.  `ELIMINATION`
7.  `WHITE_GUESS` (only when White Man is eliminated)
8.  `ROUND_RESULT` or next `CLUE`
9.  `GAME_OVER`

### Phase 1 --- Lobby

-   Players join using the existing room-code / P2P join flow.
-   Show player list, host indicator, ready state, and connection
    status.
-   Host selects supported round settings.
-   Host can start only when the minimum player count is met and
    required players are ready.
-   Clearly show who is host.
-   Provide a leave-room action with confirmation if a game is in
    progress.

### Phase 2 --- Role reveal

-   Assign roles and select a word pair for the round.
-   Send each player's private role payload only to that player.
-   Give players a short private reveal screen.
-   Civilian sees their word.
-   Spy sees their different word.
-   White Man sees their role and a clear message such as: "You have no
    word. Observe the clues and blend in."
-   Do not show the role reveal of other players.
-   Add a ready/continue action or a short configurable reveal timer.

### Phase 3 --- Clue round

-   Every active player gives one clue per round.
-   Use a deterministic player order for the current round.
-   Each player submits one short clue.
-   The clue should not be the exact secret word or an obvious spelling
    variation.
-   Show submitted clues in the shared clue history after submission.
-   Do not reveal secret words.
-   A player who disconnects or fails to submit before the timer expires
    should be handled according to a clear timeout rule.
-   Prevent duplicate submissions for the same player and phase.

Example clue sequence:

  Player                 Example clue
  ---------------------- --------------
  Player 1               Cold
  Player 2               Dessert
  Player 3               Milk
  Player 4               Cone
  Player 5 (White Man)   Sweet

### Phase 4 --- Discussion

-   All active players can discuss suspicions.
-   Provide a visible countdown.
-   In the first version, discussion can be voice/chat outside the app;
    do not assume in-app voice is required.
-   If in-app text chat is implemented, make it optional and synchronize
    messages through P2P.
-   Do not allow secret-word leakage through system-generated messages.

### Phase 5 --- Voting

Default rules:

-   Voting is simultaneous and anonymous.
-   Each active player selects exactly one active player to eliminate.
-   Players cannot vote for themselves.
-   A player may change their vote until submitting or until the timer
    expires, according to the chosen UI behavior.
-   Votes are hidden until the voting phase closes.
-   Reveal the vote tally after everyone has voted or the timer expires.
-   Handle ties explicitly.

Suggested tie rule for v1:

-   If the highest vote count is tied, no player is eliminated.
-   Start another clue/discussion/voting cycle.
-   Optionally add a host-configurable tie-break rule in a future
    version.

Do not silently select a random player in a tie.

### Phase 6 --- Elimination

-   Mark the selected player as eliminated.
-   Remove them from future clue turns and voting.
-   Reveal their **role only** by default.
-   Do not reveal their secret word.
-   Show a clear elimination animation/result.
-   If the eliminated player is White Man, immediately enter
    `WHITE_GUESS`.
-   If a non-White-Man player is eliminated, run the victory checks.

### Phase 7 --- White Man guess

-   White Man gets one attempt to enter the Civilian word.
-   Compare the guess using a normalized comparison:
    -   Trim leading/trailing whitespace.
    -   Compare case-insensitively.
    -   Normalize Unicode consistently.
    -   Do not silently accept unrelated synonyms.
-   Make exact normalized matching the default. If more flexible
    matching is desired later, implement it as an explicit ruleset
    rather than guessing.
-   If correct: White Man wins individually and the game ends.
-   If incorrect: White Man is eliminated permanently; continue to
    victory checks.
-   Do not reveal the correct word until the guess has been submitted.

### Phase 8 --- Victory checks

Use the following default rules unless the product owner explicitly
changes them:

**White Man victory** - White Man is eliminated and correctly guesses
the Civilian word. - This is an individual win and ends the game
immediately.

**Spy victory** - The number of active Spies is greater than or equal to
the number of active non-Spies. - For this calculation, count all active
non-Spies (Civilians and White Men) as non-Spies. - If White Man has
been eliminated, they no longer count as active.

**Civilian victory** - All Spies have been eliminated and White Man has
either been eliminated with an incorrect guess or otherwise is no longer
an active threat. - If White Man is still alive, Civilians have not yet
completed their victory condition.

**Priority** 1. Check White Man's correct guess immediately after
`WHITE_GUESS`. 2. Otherwise check Spy parity. 3. Otherwise check
Civilian victory. 4. If no condition is met, begin the next clue round.

Make the victory-check logic a pure, testable function. Cover edge cases
with unit tests.

## 6. UI/UX screens

Build responsive screens for desktop and mobile. The desktop experience
can use a wider evidence-board layout; mobile should stack cards and
controls cleanly.

### 6.1 Home screen

Include:

-   ASBUN logo/title.
-   Tagline: "A Game of Deception".
-   Primary actions: `Create Room` and `Join Room`.
-   A small How to Play link/modal.
-   A subtle detective case-file visual treatment.
-   No unnecessary marketing sections.

### 6.2 Create / join room

Create Room: - Player display name. - Create room action. - Room code
generated using existing project mechanism. - Host enters lobby.

Join Room: - Player display name. - Room code. - Join action. - Helpful
validation and connection states.

Do not invent a new signaling service if the repository already has one.
If the existing signaling mechanism is unavailable, explain what is
required.

### 6.3 Lobby

Show:

-   Room code with copy action.
-   Player cards/avatars.
-   Host label.
-   Ready/not-ready status.
-   Connection status.
-   Host-only settings.
-   Start button.
-   Leave room button.

Settings should include, where practical:

-   Maximum players.
-   Clue timer.
-   Discussion timer.
-   Voting timer.
-   Word difficulty.
-   Word category.
-   Role distribution preset.

### 6.4 Private role screen

Use a visually distinctive classified dossier/card.

-   Show the player's role prominently.
-   Show the secret word only to Civilian and Spy.
-   White Man sees no word.
-   Add a clear reveal/continue action.
-   Prevent accidental word exposure in shared screens or spectator
    views.

### 6.5 Main game screen

This is the most important screen.

Show:

-   Current phase and countdown.
-   Player roster with alive/eliminated state.
-   Current player turn.
-   Clue submission field and character limit.
-   Shared clue history.
-   Discussion timer.
-   Voting controls when relevant.
-   Small connection/host indicator.

Keep the secret word visible only to the local player who is entitled to
it. Consider a hide/show control for the private word in case players
share a screen.

### 6.6 Voting screen

-   Show active player candidates.
-   Clear selected state.
-   Confirm vote action.
-   Indicate whether the local player has submitted.
-   Do not reveal other players' votes before the voting phase ends.
-   Handle timeout and tie states.

### 6.7 White Man guess screen

-   Dramatic but readable reveal.
-   Show the White Man's own role.
-   Provide one text input for the guess.
-   Explain that only one attempt is allowed.
-   Show success/failure result after submission.

### 6.8 Results screen

Show:

-   Winning role/player.
-   Final role reveal for all players.
-   Civilian and Spy words.
-   Round history: clues, eliminations, and votes where available.
-   Play again action.
-   Return to lobby/home action.

## 7. Multiplayer and P2P architecture

### 7.1 General approach

Use the project's existing WebRTC P2P implementation.

For the first version, use a **host-authoritative mesh architecture** if
that is what the existing project supports:

-   Host coordinates phase transitions and validates game actions.
-   Clients send actions to the host.
-   Host broadcasts public state updates.
-   Host sends private role/word payloads directly to the relevant peer
    only.
-   Clients render state received from the host.

Do not assume P2P automatically provides trusted authority. Document
host trust and disconnect limitations.

### 7.2 Suggested event protocol

Use versioned, typed messages. Suggested message names:

-   `PLAYER_READY`
-   `PLAYER_UNREADY`
-   `GAME_START`
-   `PRIVATE_ROLE_ASSIGNMENT`
-   `PHASE_CHANGED`
-   `SUBMIT_CLUE`
-   `CLUE_SUBMITTED`
-   `SUBMIT_VOTE`
-   `VOTE_STATUS`
-   `VOTING_RESULT`
-   `PLAYER_ELIMINATED`
-   `WHITE_GUESS_SUBMIT`
-   `WHITE_GUESS_RESULT`
-   `GAME_STATE_SYNC`
-   `PLAYER_DISCONNECTED`
-   `PLAYER_RECONNECTED`
-   `GAME_OVER`
-   `RETURN_TO_LOBBY`

Every message should include appropriate metadata such as:

-   `protocolVersion`
-   `messageId`
-   `roomId`
-   `roundNumber`
-   `phase`
-   `senderPlayerId`
-   `timestamp` (for diagnostics, not as a trusted ordering authority)

Validate all incoming messages. Reject messages that are invalid for the
current phase, from an eliminated player, from the wrong sender,
duplicated, or malformed.

Do not trust a client-provided role, vote count, word, winner, or phase
transition.

### 7.3 State model

Separate state into:

**Public game state** - Room metadata. - Player IDs and display names. -
Alive/eliminated status. - Public role reveal after elimination. -
Current phase and round. - Turn order. - Submitted clues. - Voting
status and final tally after voting closes. - Public result/history.

**Private player state** - Local player's role. - Local player's secret
word, if any. - White Man's guess status. - Any private role-specific
information.

Never put private state into a public broadcast object.

### 7.4 Host and disconnect behavior

Plan for:

-   Host disconnects.
-   Non-host disconnects.
-   Player reconnects.
-   Player leaves during a phase.
-   Host closes the tab.
-   Duplicate messages.
-   Stale messages from a previous round.
-   A player submitting after the timer has expired.

For v1, if robust host migration is not already supported, show a clear
host-disconnected state and allow players to return to the
lobby/recreate the room. Do not pretend the game can continue if
authoritative state has been lost.

Where feasible, allow a reconnecting player to request a state snapshot
from the host. Never send private data belonging to other players in
that snapshot.

### 7.5 Synchronization and timers

-   Host is authoritative for phase changes and deadline decisions.
-   Clients may display a locally interpolated countdown, but should use
    host-provided deadlines or phase updates.
-   Do not rely on every player's local timer reaching zero at exactly
    the same moment.
-   Host validates submissions against the current phase and deadline.
-   Use stable player IDs, not display names, as identity keys.

## 8. Security, fairness, and abuse prevention

This is a casual friend-group game, not a competitive anti-cheat
platform. Still:

-   Validate every action on the host.
-   Prevent self-voting.
-   Prevent multiple votes from one player.
-   Prevent multiple clues in the same round.
-   Prevent eliminated players from acting.
-   Prevent clients from changing their role or secret word.
-   Keep private assignments out of public events and logs.
-   Do not expose the Civilian word in the White Man guess response
    until the guess is resolved.
-   Do not accept arbitrary phase changes from clients.
-   Avoid rendering untrusted player text as HTML.
-   Limit clue/chat text length.
-   Handle malformed and oversized messages safely.

Clearly document that a malicious host can inspect its own memory and
may cheat. A truly trusted game authority requires a trusted backend or
a more advanced cryptographic protocol.

## 9. Accessibility and usability

-   Responsive layout for desktop and mobile.
-   Keyboard-friendly buttons and inputs.
-   Visible focus states.
-   Sufficient contrast.
-   Clear disabled/loading/error states.
-   Reduced-motion support.
-   Do not rely on color alone to communicate roles or status.
-   Make timers readable.
-   Use clear confirmation for destructive actions such as leaving an
    active room.
-   Prevent accidental double submission.

## 10. Suggested code organization

Adapt to the existing repository rather than forcing this exact
structure. Keep responsibilities separated:

``` text
src/
  components/
    common/
    lobby/
    game/
    voting/
    results/
  pages/                 # or routes used by the existing app
  game/
    config/
      roleDistribution
      gameSettings
    data/
      wordPairs.json
    engine/
      assignRoles
      selectWordPair
      gameState
      transitionPhase
      checkVictory
      normalizeGuess
    protocol/
      messageTypes
      validateMessage
      serializeMessage
    hooks/
      useGameState
      useGameTimer
      usePeerRoom
  styles/
    tokens
    typography
    ...
```

Use the project's existing conventions and avoid unnecessary
dependencies.

## 11. Testing requirements

At minimum, add unit tests for:

### Role assignment

-   Every player receives exactly one role.
-   Role counts match the selected preset.
-   No invalid configuration can start.
-   Random assignment does not depend on player display names.

### Word-pair selection

-   Civilian and Spy words are different.
-   Selected pair matches selected category/difficulty when possible.
-   White Man receives no word.
-   Secret assignments are sent only to the correct player.

### Clues

-   One clue per active player per round.
-   Eliminated players cannot submit.
-   Late and duplicate submissions are rejected.
-   Clue length limits are enforced.

### Voting

-   Self-vote is rejected.
-   Duplicate vote is rejected.
-   Eliminated players cannot vote.
-   Votes stay hidden before the voting phase closes.
-   Tie behavior is correct.
-   No-elimination tie proceeds to the next cycle.

### Victory conditions

-   White Man correct guess wins immediately.
-   White Man incorrect guess does not win.
-   Spy parity condition works.
-   Civilian victory requires all Spies to be eliminated and White Man
    no longer active.
-   Victory checks work after each elimination.
-   Only one final winner state can be committed.

### P2P protocol

-   Invalid messages are rejected.
-   Stale round messages are rejected.
-   Wrong-phase actions are rejected.
-   Private payloads are not included in public broadcasts.
-   Reconnect/state snapshot behavior is tested where supported.

## 12. Implementation milestones

Work in small, verifiable milestones.

### Milestone 1 --- Repository assessment

-   Inspect the existing app.
-   Explain the current architecture.
-   Identify reusable P2P and UI components.
-   Present the implementation plan.

### Milestone 2 --- Design foundation

-   Add ASBUN design tokens.
-   Add typography.
-   Build home, create/join, and lobby screens.
-   Ensure responsive layout.

### Milestone 3 --- Game engine

-   Implement role distribution.
-   Implement word-pair selection.
-   Implement phase state machine.
-   Implement clue, voting, elimination, and victory logic.
-   Add unit tests.

### Milestone 4 --- P2P integration

-   Integrate game events with existing WebRTC connections.
-   Add private role delivery.
-   Add public state synchronization.
-   Add message validation and disconnect handling.

### Milestone 5 --- Gameplay UI

-   Build private role reveal.
-   Build clue and discussion screens.
-   Build voting screen.
-   Build White Man guess screen.
-   Build results and replay flow.

### Milestone 6 --- QA and polish

-   Test with the maximum supported player count.
-   Test multiple browsers/devices.
-   Test disconnects and timeouts.
-   Test all victory conditions.
-   Fix responsive and accessibility issues.
-   Remove development-only mock data from production paths.

After each milestone, summarize: - What changed. - Files
created/modified. - Tests run and results. - Known limitations. - Next
milestone.

## 13. Definition of done

ASBUN is ready for an initial release when:

-   A host can create a room and friends can join using the existing P2P
    flow.
-   The lobby correctly shows connected players and ready states.
-   The host can start a valid game.
-   Every player receives only their own role and word.
-   Clue rounds work with the correct turn order.
-   Discussion and voting phases work.
-   Votes are hidden until voting closes.
-   Ties follow the documented rule.
-   White Man gets exactly one guess after elimination.
-   Correct and incorrect guesses produce the correct outcomes.
-   Spy, Civilian, and White Man victory conditions are tested.
-   The game can be played again without stale state leaking into the
    next match.
-   The UI is responsive and follows the ASBUN visual identity.
-   No visible control is inert.
-   Known P2P trust and host-disconnect limitations are documented.

## 14. Product decisions for v1

Use these defaults unless the project owner changes them:

  -----------------------------------------------------------------------
  Decision                            V1 default
  ----------------------------------- -----------------------------------
  Game title                          ASBUN

  Tagline                             A Game of Deception

  Theme                               Mystery / Detective / Dark Academia

  Display font                        Cormorant Garamond

  UI font                             DM Sans

  Accent font                         Allura, decorative only

  Player range                        4--10

  Voting                              Simultaneous and anonymous

  Tie                                 No elimination; start another cycle

  Elimination reveal                  Role only; do not reveal word

  White Man                           One guess after elimination

  White Man correct guess             Immediate individual victory

  White Man incorrect guess           Eliminated; continue game

  Spy victory                         Active Spies \>= active non-Spies

  Civilian victory                    All Spies eliminated and White Man
                                      no longer active

  Word comparison                     Exact match after normalization

  Network                             Existing WebRTC P2P implementation

  Authority                           Host-authoritative for v1

  Backend                             No new dedicated game backend
                                      required
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 15. Final instruction

Build ASBUN as a polished, playable multiplayer game with a strong
identity. Prioritize correctness of secret information, game-state
transitions, and victory conditions before decorative polish.

Do not stop after producing a plan or a mockup. Once the repository has
been inspected and the plan is clear, proceed with implementation in
milestones, testing each important mechanic as it is completed.

When a requirement is ambiguous, state the assumption and keep it
configurable where reasonable. Do not invent infrastructure, silently
weaken privacy boundaries, or claim that P2P is cheat-proof.
