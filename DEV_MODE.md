# Developer Mode Controls

## Activating Dev Mode

Press **F9** to toggle Developer Mode on/off.

When activated, you'll see available dev controls in the console.

## Dev Mode Features

### Fixed Y Mode (F10)
**Best for exploration and flying around**

- Press **F10** to toggle Fixed Y Mode
- Your Y position (height) becomes locked at current level
- Move horizontally with **WASD** (no falling or climbing)
- Adjust height with **Space** (up) and **Shift** (down)
- Perfect for flying around the mansion at constant height
- Physics gravity is disabled while active

**Example Usage:**
```
1. Press F9 (enable dev mode)
2. Press F10 (enable fixed Y mode)
3. Use Space/Shift to set your desired height
4. Fly around with WASD at constant height
```

### Physics Debug Renderer (F11)
**Visualize all physics collision bodies**

- Press **F11** to toggle physics debug visualization
- Shows wireframe boxes for all collision bodies
- **Green wireframe** = Player collision sphere
- **Red wireframes** = World collision bodies (walls, floors, furniture)
- Updates in real-time as you move

**Use Cases:**
- Debug why you're falling through floors
- See collision boundaries of objects
- Verify physics bodies are properly placed
- Debug collision issues

## Key Bindings Summary

| Key | Function | Requires Dev Mode |
|-----|----------|-------------------|
| **F9** | Toggle Dev Mode | No |
| **F10** | Toggle Fixed Y Mode | Yes |
| **F11** | Toggle Physics Debug | Yes |

## Fixed Y Mode Details

When Fixed Y Mode is active:
- **WASD** - Move horizontally (forward/back/left/right)
- **Space** - Increase height
- **Shift** - Decrease height
- **Mouse** - Look around

Your current height is locked until you adjust it with Space/Shift.

## Console Commands

Access physics manager via `window.gameControls.physicsManager`:

```javascript
// 🚁 EMERGENCY: If you fall through the floor, run this immediately!
window.gameControls.physicsManager.emergencyRescue();
// This will:
// - Enable Fixed Y Mode automatically
// - Set your height to at least Y=0
// - Stop all falling
// - Let you fly with SPACE/SHIFT

// Get current debug info
window.gameControls.physicsManager.getDebugInfo();

// Manually toggle physics debug
window.gameControls.physicsManager.togglePhysicsDebug();

// Change movement speed
window.gameControls.physicsManager.setMovementSpeeds(10, 20, 5, 15);

// Set gravity
window.gameControls.physicsManager.setGravity(-30); // Stronger gravity
window.gameControls.physicsManager.setGravity(-5);  // Weaker gravity

// Teleport to position
window.gameControls.physicsManager.teleportTo(new THREE.Vector3(0, 10, 0));
```

## Spawn Position Fix

The spawn position now:
- Spawns **10 units above** the entrance room center
- Delays physics initialization by 200ms to prevent falling through floor
- Falls gently onto the floor when physics activates

## If You Fall Through the Floor

**Quick Fix (Console Command):**
```javascript
window.gameControls.physicsManager.emergencyRescue();
```
This instantly enables Fixed Y Mode at a safe height!

**Manual Fix (Keyboard):**
1. Press **F9** to enable dev mode
2. Press **F10** to enable Fixed Y mode (auto-sets to Y=0 minimum)
3. Use **Space** to rise to comfortable height
4. Press **F11** to see physics collision bodies
5. Check if floor collision bodies exist at your spawn location
