# 🗺️ Automated Lightmap Baking Guide

## Overview
This script provides **fully automated** lightmap baking for your 3D mansion model in Blender, with automatic UV setup, verification, and GLB export ready for Three.js.

## 🚀 Quick Start

### 1. Run the Script in Blender
```python
# In Blender's Scripting workspace, open: blender/bake_lightmaps.py
# Press "Run Script" (or Alt+P)
```

That's it! The script will:
- ✅ Verify and fix UV layers on all objects
- ✅ Bake two lightmaps (lights ON and lights OFF)
- ✅ Transfer lightmap UVs to all original objects
- ✅ Verify all objects have both UV1 and UV2
- ✅ Automatically export Mansion.glb
- ✅ Save everything

## 📋 Configuration

Edit these variables at the top of `bake_lightmaps.py`:

```python
# --- CONFIGURATION ---
MANSION_COLLECTION_NAME = "Mansion"          # Your main collection
LIGHTS_ON_COLLECTION_NAME = "Lights_ON"      # Lights to enable for bright bake
LIGHTS_OFF_COLLECTION_NAME = "Lights_OFF"    # Lights to enable for dark bake
LIGHTMAP_UV_NAME = "LightmapUV"              # Name of UV2 layer
IMAGE_RESOLUTION = 4096                       # Lightmap texture size (2048, 4096, 8192)
OUTPUT_IMAGE_FORMAT = 'PNG'                   # Output format

# --- BAKE PERFORMANCE SETTINGS ---
RENDER_SAMPLES = 64                           # Render samples (higher = cleaner, slower)
USE_DENOISE = True                           # Enable denoising
MAX_LIGHT_BOUNCES = 2                        # Light bounces (higher = more realistic)
BAKE_MARGIN_PX = 32                          # Margin around UV islands (prevents bleeding)
UV_ISLAND_MARGIN = 0.05                      # UV island padding (lower = more margin)

# --- EXPORT SETTINGS ---
AUTO_EXPORT_GLB = True                       # Auto-export GLB after baking
EXPORT_FILENAME = "Mansion.glb"              # Output filename

# --- LOGGING SETTINGS ---
ENABLE_CONSOLE_LOGGING = True                # Print to console
ENABLE_FILE_LOGGING = True                   # Save log to file
LOG_FILE_PATH = "lightmap_bake.log"          # Log file location
```

## 🔧 What This Script Does

### Step 1: UV Verification (NEW!)
- Checks all objects have UV1 (UVMap)
- Creates missing UV1 layers automatically
- Logs all fixes

### Step 2: Baking Process
1. **Duplicates** your mansion objects (preserves originals!)
2. **Joins** duplicates into one mesh for efficient baking
3. **Cleans** geometry (merge vertices, recalculate normals, triangulate)
4. **Creates LightmapUV** layer with optimal unwrapping
5. **Bakes two lightmaps**:
   - `Mansion_Lightmap_On.png` (lights on)
   - `Mansion_Lightmap_Off.png` (lights off)

### Step 3: UV Transfer & Verification (ENHANCED!)
- Transfers lightmap UVs from baked mesh to **all** original objects
- Verifies every object has UV2 (LightmapUV)
- **Automatically fixes** any missing UV2 by copying UV1
- Ensures UV2 is set as `active_render`
- Detailed logging of which objects were fixed

### Step 4: Export (NEW!)
- Automatically exports `Mansion.glb` with proper UV settings
- Exports **only** the Mansion collection (excludes baker object)
- Optimized for Three.js:
  - ✅ Both UV channels included
  - ✅ Proper Y-up orientation
  - ✅ All vertex attributes preserved
  - ✅ No Draco compression (better compatibility)

## 📊 Output Files

After running, you'll get:
```
blender/
├── Mansion.glb                    # Your 3D model (ready for Three.js)
├── Mansion_Lightmap_On.png        # Lightmap with lights ON
├── Mansion_Lightmap_Off.png       # Lightmap with lights OFF
├── lightmap_bake.log              # Detailed process log
└── Asset Library.blend            # Updated .blend file
```

## 🐛 Troubleshooting

### Issue: "Missing UV2 on some meshes"
**Fixed!** The script now automatically:
1. Detects objects missing UV2
2. Creates UV2 by copying UV1
3. Logs which objects were fixed
4. Verifies all 1183 meshes have both UV channels

### Issue: "Lightmap streaks/bleeding at high intensity"
**Fixed!** Now using:
- `BAKE_MARGIN_PX = 32` (increased from 16px)
- `UV_ISLAND_MARGIN = 0.05` (increased margin between islands)

### Issue: "GLB export doesn't include UV2"
**Fixed!** Export now uses:
```python
export_texcoords=True       # Export UV coordinates
export_attributes=True      # Export all vertex attributes (including UV2)
```

### Issue: "Some objects still missing UV2 after baking"
Run in Three.js console:
```javascript
window.game.mansionLoader.compareUVChannels()
```
This will show which objects have identical UV1/UV2 vs different.

## 📈 Performance Tips

### For Faster Baking:
```python
RENDER_SAMPLES = 32          # Reduce samples
IMAGE_RESOLUTION = 2048      # Lower resolution
USE_DENOISE = False          # Disable (faster but noisier)
MAX_LIGHT_BOUNCES = 1        # Less realistic but faster
```

### For Best Quality:
```python
RENDER_SAMPLES = 128         # More samples
IMAGE_RESOLUTION = 8192      # Higher resolution (requires lots of RAM!)
USE_DENOISE = True           # Clean result
MAX_LIGHT_BOUNCES = 4        # More realistic lighting
BAKE_MARGIN_PX = 64          # Prevent any bleeding
```

## 🎯 Integration with Three.js

The exported `Mansion.glb` is now **100% ready** for Three.js!

Your existing `MansionLoader.js` will:
1. Load the GLB
2. Detect UV1 and UV2 on all meshes
3. Apply lightmaps automatically
4. Toggle between lights ON/OFF

Verify in console:
```javascript
// Check UV channels
window.game.mansionLoader.debugUVs()

// Should show:
// ✅ Total meshes: 1183
// ✅ Has UV1: 1183
// ✅ Has UV2: 1183
// ✅ Has BOTH: 1183
```

## 📝 Changelog

### Version 11 (Current)
- ✅ Added automatic UV1 verification and creation
- ✅ Added UV2 verification with auto-fix fallback
- ✅ Increased bake margin to 32px (prevents bleeding)
- ✅ Increased UV island margin to 0.05 (prevents streaks)
- ✅ Added automatic GLB export
- ✅ Enhanced logging with detailed statistics
- ✅ Added configuration flags for easy customization

### Previous Versions
- Version 10: Added logging system
- Version 9: Optimized UV transfer
- Version 8: Fixed light collection detection

## ✅ Pre-flight Checklist

Before running the script:
- [ ] Your Blender file is saved
- [ ] You have a "Mansion" collection
- [ ] You have "Lights_ON" and "Lights_OFF" collections
- [ ] You have GPU rendering enabled (faster)
- [ ] You have enough disk space (~100MB for 4K lightmaps)

After running the script:
- [ ] Check `lightmap_bake.log` for any warnings
- [ ] Verify both PNG lightmaps were created
- [ ] Verify `Mansion.glb` was exported
- [ ] Copy files to your Three.js project
- [ ] Test in browser with debug commands

## 🎨 Next Steps

1. Copy these files to your Three.js project:
   ```
   Mansion.glb → /blender/
   Mansion_Lightmap_On.png → /blender/textures/
   Mansion_Lightmap_Off.png → /blender/textures/
   ```

2. Update your lightmap paths in `MansionLoader.js` if needed

3. Test lightmap toggle:
   ```javascript
   window.game.mansionLoader.toggleLightmaps()
   ```

4. Adjust lightmap intensity:
   ```javascript
   window.game.mansionLoader.setLightmapIntensity(2.5)  // Default
   ```

---

**Need help?** Check `lightmap_bake.log` for detailed information about the baking process.
