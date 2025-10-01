# Physics Collision Exclusions

The MansionLoader automatically skips collision generation for certain objects to allow player movement through doorways and openings.

## Excluded Object Names

Objects with these keywords in their names will **NOT** have physics collision:

### Doorways & Openings
- `WallDoor` or `walldoor`
- `Wall_Door` or `wall_door` 
- `WallDoorBig` or `walldoorbig`
- `Wall_Door_Big` or `wall_door_big`

### Manual Exclusions
- `nocollision` or `NoCollision`

## How It Works

When the mansion model loads, the physics system:
1. Scans all mesh objects in the model
2. Checks each mesh name (case-insensitive)
3. Skips collision generation if name contains excluded keywords
4. Logs skipped objects to console: `🚪 Skipping collision for door/opening: ObjectName`

## Example

If you have objects named:
- `WallDoor_001` ✅ No collision (walkable)
- `WallDoorBig_Entrance` ✅ No collision (walkable)
- `Wall_Main_001` ❌ Has collision (blocks player)
- `Floor_NoCollision` ✅ No collision (excluded manually)

## Adding New Exclusions

To exclude other object types, edit `src/systems/MansionLoader.js` line 140-144:

```javascript
if ((nodeName.includes('nocollision') ||
    nodeName.includes('walldoor') ||
    nodeName.includes('wall_door') ||
    nodeName.includes('walldoorbig') ||
    nodeName.includes('wall_door_big') ||
    nodeName.includes('yournewkeyword')) && !nodeName.includes("entrance")) {  // Add your exclusion here
    console.log(`🚪 Skipping collision for: ${node.name}`);
    return;
}
```

## Naming Convention Tips

For best results in Blender:
- **Doorways**: Include "WallDoor" in the name
- **Large openings**: Include "WallDoorBig" in the name  
- **Special exclusions**: Add "NoCollision" suffix
- Keep naming consistent across your model

## Debugging

To see which objects were excluded:
1. Load the game
2. Open browser console (F12)
3. Look for messages: `🚪 Skipping collision for door/opening: [ObjectName]`
4. Verify the correct objects were excluded

To see all physics bodies:
1. Press **F9** (enable dev mode)
2. Press **F11** (show physics debug)
3. Red wireframes = collision bodies
4. Missing wireframes at doorways = correctly excluded!

---

## Debug Commands

If collisions aren't being skipped properly, use these console commands:

### List All Objects
```javascript
// List all objects in the mansion
window.gameControls.mansionLoader.listAllObjects();

// Search for specific objects (e.g., doors)
window.gameControls.mansionLoader.findObjects('door');
window.gameControls.mansionLoader.findObjects('wall');

// Check which objects have physics
window.gameControls.mansionLoader.listAllObjects().filter(obj => obj.hasPhysics);
```

### Check Specific Object
```javascript
// Find objects containing "WallDoor"
window.gameControls.mansionLoader.findObjects('walldoor');

// This will show you:
// - Object names (exact capitalization)
// - Whether they're visible
// - Whether they have physics collision
```

### Example Debug Session
```javascript
// 1. Find all door objects
const doors = window.gameControls.mansionLoader.findObjects('door');

// 2. Check if they have physics (they shouldn't)
console.log(doors.filter(d => d.hasPhysics));
// Should be empty or very few results

// 3. Check what the actual object names are
console.log(doors.map(d => d.name));
// Example output: ["S_WallDoor.001", "S_WallDoor.002", ...]
```

## Troubleshooting "S_WallDoor.001" Not Excluded

If `S_WallDoor.001` is not being excluded:

1. **Verify the name detection is working:**
   ```javascript
   const name = "S_WallDoor.001";
   console.log(name.toLowerCase().includes('walldoor')); // Should be true
   ```

2. **List all door objects to see names:**
   ```javascript
   window.gameControls.mansionLoader.findObjects('walldoor');
   ```

3. **Check if physics was generated before exclusion:**
   - Look at console logs when loading
   - Should see: `🚪 Skipping collision for door/opening: S_WallDoor.001`

4. **Force reload the page** (Ctrl+F5) to ensure changes take effect
