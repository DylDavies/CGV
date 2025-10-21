# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project HER** is a 3D horror escape room game built with Three.js, vanilla JavaScript, and Vite. Players navigate a haunted mansion solving puzzles while avoiding a monster, featuring procedural generation, physics-based movement, and atmospheric horror elements.

## Essential Commands

### Development
```bash
npm run dev        # Start development server (http://localhost:5173)
npm run build      # Build for production
npm run preview    # Preview production build
```

### Key Browser Controls
- **F9**: Toggle Developer Mode
- **F10**: Toggle Fixed Y Mode (fly/no-clip for exploration)
- **F11**: Toggle Physics Debug Visualization
- **F**: Toggle flashlight
- **ESC**: Pause menu
- **WASD**: Movement
- **Space**: Jump (or fly up in dev mode)
- **Shift**: Run (or fly down in dev mode)

## Architecture Overview

### Core Systems Pattern
The codebase follows a manager-based architecture where systems are initialized in `src/main.js` and added to the game loop's `updatables` array. Each system implements a `.tick(delta)` method for frame updates.

**Main Game Loop Flow:**
1. `main.js` initializes all systems
2. `Loop.js` calls `.tick(delta)` on each updatable
3. Renderer produces frame

### Critical System Dependencies
- **RapierPhysicsManager** must be created before Loop (Loop requires physics.labelRenderer)
- **UIManager** must initialize before game starts (loads HTML fragments)
- **MansionLoader** loads asynchronously and provides spawn points
- **GameManager** tracks game state and coordinates between systems

### Physics System (Rapier)
Uses Rapier physics engine with kinematic character controller:
- Player is a capsule collider (1.5m height, 0.35m radius)
- Gravity: -15 units/s²
- Walk speed: 4.5 units/s, Run: 7.0 units/s
- Character controller handles stair stepping and ground snapping
- Collision exclusions for doors (see PHYSICS_EXCLUSIONS.md)

### Mansion Loading System
The `MansionLoader` is a complex system that handles:
- GLTF model loading from Blender exports
- Room detection via collection names (e.g., "Entrance", "Library")
- Physics body generation for walls/floors (skips doors)
- Lightmap swapping (lights on/off variants)
- Lamp system with flickering effects
- Fireplace particle systems
- Occlusion culling for performance
- Navigation mesh for AI pathfinding

**Important:** Objects named with "WallDoor", "walldoor", "NoCollision" are excluded from physics collision to allow passage through doorways.

### UI Component System
UI uses a component-based approach managed by `UIManager`:
- HTML fragments in `src/ui/[component]/` folders
- CSS pre-linked in `index.html` head
- UIManager fetches HTML and injects into placeholder divs on init
- Components are cached in `uiManager.uiElements` object

**To add new UI component:**
1. Create `src/ui/[name]/[name].html` and `[name].css`
2. Add `<link>` to CSS in `index.html` head
3. Add placeholder `<div id="[name]-container">` in `index.html` body
4. Update `UIManager.initialize()` to load and cache elements

### Puzzle System
Modular puzzle architecture:
- `PuzzleSystem.js` acts as central registry
- Each puzzle has its own folder with Logic/UI/Timer separation
- Example: `src/puzzles/colorPuzzle/`
  - `ColorPuzzle.js` - Orchestrator
  - `PuzzleLogic.js` - Game rules (no DOM)
  - `PuzzleUI.js` - DOM rendering/animation
  - `PuzzleTimer.js` - Timer management
- Puzzles load level data from `public/puzzles/[name]/levels.json`

## Developer Mode Features

### Debug Commands (Console)
```javascript
// Emergency rescue if falling through floor
window.gameControls.physicsManager.emergencyRescue();

// Get debug info
window.gameControls.mansionLoader.getDebugInfo();
window.gameControls.physicsManager.getDebugInfo();

// Teleport player
window.gameControls.physicsManager.teleportTo(new THREE.Vector3(0, 10, 0));

// Logging controls
logger.disable();           // Disable console logging
logger.enable();            // Enable console logging
logger.enableFileLogging(); // Save logs to buffer
logger.downloadLogs();      // Download log file
logger.clearBuffer();       // Clear log buffer
```

### Lightmap System
```javascript
// Toggle between lights-on and lights-off lightmaps
window.game.mansionLoader.toggleLightmaps();

// Adjust lightmap intensity
window.game.mansionLoader.setLightmapIntensity(5.0); // Brighter
window.game.mansionLoader.setLightmapIntensity(1.0); // Dimmer
```

### Lamp Control
```javascript
// Toggle all lamps
window.gameControls.mansionLoader.toggleLamps();

// Set lamp intensity (0.0 - 1.0)
window.gameControls.mansionLoader.setLampIntensity(0.5);

// Control flicker speed
window.gameControls.mansionLoader.setLampFlickerSpeed(2.0);
```

### Navigation Mesh Visualization
```javascript
gameControls.toggleNavMesh();      // Show/hide navmesh
gameControls.toggleNavMeshNodes(); // Show/hide navmesh nodes
gameControls.toggleMansion();      // Hide mansion to see navmesh better
```

## Important Technical Details

### Spawn Point System
Player spawns at entrance door position from mansion model:
1. Attempts to spawn at `getEntranceDoorSpawnPoint()`
2. Falls back to entrance room center + 2.5 units up
3. Physics delayed 200ms to prevent fall-through
4. Final position set via `physicsManager.teleportTo()`

### Physics Collision Exclusions
Objects with these keywords are excluded from collision:
- `walldoor`, `wall_door`, `walldoorbig`, `wall_door_big`
- `nocollision`
- NOT `entrance` (entrance room needs collision)

See PHYSICS_EXCLUSIONS.md for details.

### Quality Presets
System supports quality levels (low/medium/high/ultra) affecting:
- Fire particle count
- Lamp/fireplace update rates
- Max visible distance for occlusion culling
- Active light count
- Shadow settings

Set via `localStorage.setItem('gameSettings', JSON.stringify({quality: 'medium'}));`

### Asset Loading
- Models: `blender/` directory (.glb format)
- Puzzle data: `public/puzzles/` (.json format)
- Narrative: `public/narrative/narrative.json`
- All assets load asynchronously with progress tracking

### Blender Export Workflow
When exporting models from Blender:
- Export entire "Mansion" collection, not just merged mesh
- Include all named objects (doors, lamps, fireplaces, etc.)
- Name convention matters: "S_WallDoor" for doors, "S_Lamp" for lamps
- Export separate NavMesh.glb for AI pathfinding
- Lightmaps: export two versions (lights on/off) as separate textures

## Common Patterns

### Adding Interactable Objects
1. Add object to Blender model with meaningful name
2. In `InteractionSystem.js`, check for object in raycast hit
3. Set `userData.interactable = true` on mesh
4. Handle interaction in `GameManager` or puzzle-specific code

### Adding New Monster Behaviors
Monster AI is in `MonsterAI.js` using states:
- "idle", "wandering", "chasing", "attacking", "searching"
- Uses pathfinding from `mansionLoader.pathfinding`
- Update states in `tick()` method based on conditions

### Adding Audio
Use `AudioManager` for all sounds:
```javascript
audioManager.play('sound-name'); // Plays from audio manifest
audioManager.stopAll();          // Stop all sounds
```

### Performance Optimization
- Occlusion culling enabled by default (maxVisibleDistance varies by quality)
- Use material caching in MansionLoader
- Limit active lights per quality preset
- Use LOD for complex models if needed
- Check performance with Stats.js (top-left corner)

## Code Style Notes

- ES6+ module imports from CDN (unpkg, skypack, jsdelivr)
- Three.js version: 0.127.0 (check CDN imports if upgrading)
- Logger utility for all console output (supports file logging)
- Async/await for asset loading
- Class-based architecture with constructor dependency injection
- Use `logger.log()` instead of `console.log()` for consistency

## Known Issues & Workarounds

### Player Falling Through Floor
Use emergency rescue:
```javascript
window.gameControls.physicsManager.emergencyRescue();
```
Or manually enable Fixed Y Mode (F9, then F10).

### Lightmaps Not Showing
Check if textures loaded and increase intensity:
```javascript
window.game.mansionLoader.setLightmapIntensity(5.0);
```

### Physics Debug Not Showing
Ensure dev mode enabled first (F9), then press F11.

## Testing & Debugging

- Open browser console (F12) for all debug output
- Enable file logging to capture session logs for bug reports
- Use physics debug visualizer (F11) to see collision boundaries
- Stats panel shows FPS/memory in top-left (always visible)
- Check `window.gameControls` for access to all major systems
