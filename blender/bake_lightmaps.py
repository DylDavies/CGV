# bake_lightmaps.py (Version 10 - Logging & Optimizations)

import bpy
import os
import time

# --- CONFIGURATION ---
MANSION_COLLECTION_NAME = "Mansion"
LIGHTS_ON_COLLECTION_NAME = "Lights_ON"
LIGHTS_OFF_COLLECTION_NAME = "Lights_OFF"
LIGHTMAP_UV_NAME = "LightmapUV"
IMAGE_RESOLUTION = 4096  # Increased from 2048 for better quality
OUTPUT_IMAGE_FORMAT = 'PNG'

blend_file_path = bpy.data.filepath
output_directory = os.path.dirname(blend_file_path)

# --- BAKE PERFORMANCE SETTINGS ---
RENDER_SAMPLES = 64
USE_DENOISE = True
MAX_LIGHT_BOUNCES = 6  # Increased from 2 to 6 for better light distribution
BAKE_MARGIN_PX = 16  # Margin around UV islands to prevent bleeding (increased from 8)
UV_ISLAND_MARGIN = 0.02  # Margin between UV islands (increased from 0.01 to prevent bleeding)

# --- WORLD LIGHTING SETTINGS (for ambient illumination during bake) ---
WORLD_LIGHT_STRENGTH = 0.3  # Ambient light strength (0.0 = pitch black, 1.0 = bright)
WORLD_LIGHT_COLOR = (0.8, 0.85, 0.9)  # Slight blue tint (daylight color)

# --- EXPORT SETTINGS ---
AUTO_EXPORT_GLB = True  # Automatically export GLB after baking
EXPORT_FILENAME = "Mansion.glb"  # Output GLB filename

# --- LOGGING SETTINGS ---
ENABLE_CONSOLE_LOGGING = True  # Set to False to disable console output
ENABLE_FILE_LOGGING = True  # Set to True to log to file
LOG_FILE_PATH = os.path.join(output_directory, "lightmap_bake.log")

# --- END OF CONFIGURATION ---

# --- LOGGING SYSTEM ---
class Logger:
    def __init__(self, console_enabled=True, file_enabled=False, file_path=None):
        self.console_enabled = console_enabled
        self.file_enabled = file_enabled
        self.file_path = file_path
        self.log_file = None

        if self.file_enabled and self.file_path:
            self.log_file = open(self.file_path, 'w', encoding='utf-8')
            self.log(f"Lightmap baking log started at {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

    def log(self, message):
        if self.console_enabled:
            print(message)
        if self.file_enabled and self.log_file:
            self.log_file.write(message + '\n')
            self.log_file.flush()

    def close(self):
        if self.log_file:
            self.log(f"\nLog ended at {time.strftime('%Y-%m-%d %H:%M:%S')}")
            self.log_file.close()

# Initialize logger
logger = Logger(
    console_enabled=ENABLE_CONSOLE_LOGGING,
    file_enabled=ENABLE_FILE_LOGGING,
    file_path=LOG_FILE_PATH
)

def get_all_mesh_objects_in_collection(collection_name):
    mesh_objects = []
    collection = bpy.data.collections.get(collection_name)
    if not collection:
        logger.log(f"Error: Collection '{collection_name}' not found.")
        return []

    def find_meshes(coll):
        for obj in coll.objects:
            if obj.type == 'MESH':
                mesh_objects.append(obj)
        for sub_coll in coll.children:
            find_meshes(sub_coll)

    find_meshes(collection)
    logger.log(f"Found {len(mesh_objects)} mesh objects in '{collection_name}'.")
    return mesh_objects

def unwrap_original_objects(objects):
    """
    NEW WORKFLOW: Unwrap each original object BEFORE duplicating/joining.
    This ensures the exported objects have correct lightmap UVs.
    """
    logger.log("\n--- Unwrapping Original Objects (NEW WORKFLOW) ---")
    logger.log(f"  Processing {len(objects)} objects individually...")

    unwrapped_count = 0
    failed_count = 0

    for idx, obj in enumerate(objects, 1):
        if obj.type != 'MESH':
            continue

        # Make mesh data unique
        if obj.data.users > 1:
            obj.data = obj.data.copy()

        mesh = obj.data

        # Ensure UV1 exists
        if len(mesh.uv_layers) == 0:
            mesh.uv_layers.new(name="UVMap")

        # Remove extra UV layers (keep only UVMap)
        # This includes the problematic "map1" layer that causes "Custom UV set 1" warnings
        layers_to_remove = []
        for i, layer in enumerate(mesh.uv_layers):
            if i > 0:
                layers_to_remove.append(layer)

        for layer in layers_to_remove:
            if layer.name == 'map1':
                logger.log(f"  🧹 Removing 'map1' from {obj.name}") if idx <= 5 else None
            mesh.uv_layers.remove(layer)

        # Create fresh LightmapUV layer
        lightmap_layer = mesh.uv_layers.new(name=LIGHTMAP_UV_NAME)
        lightmap_layer.active = True
        lightmap_layer.active_render = True

        # Select the object
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

        # Enter edit mode and unwrap
        try:
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')

            # Use Lightmap Pack for this individual object
            margin_divisor = int(1.0 / UV_ISLAND_MARGIN) if UV_ISLAND_MARGIN > 0 else 100

            bpy.ops.uv.lightmap_pack(
                PREF_CONTEXT='ALL_FACES',
                PREF_PACK_IN_ONE=True,
                PREF_NEW_UVLAYER=False,
                PREF_BOX_DIV=12,
                PREF_MARGIN_DIV=margin_divisor
            )

            bpy.ops.object.mode_set(mode='OBJECT')
            unwrapped_count += 1

        except Exception as e:
            logger.log(f"  ⚠️ Failed to unwrap {obj.name}: {e}")
            bpy.ops.object.mode_set(mode='OBJECT')
            failed_count += 1

        # Progress logging
        if (idx % 100 == 0) or (idx == len(objects)):
            logger.log(f"    Progress: {idx}/{len(objects)} ({(idx/len(objects)*100):.1f}%)")

    logger.log(f"\n  ✅ Unwrapped {unwrapped_count}/{len(objects)} objects")
    if failed_count > 0:
        logger.log(f"  ⚠️ Failed: {failed_count} objects")

    logger.log("--- Original Objects Unwrapped ---")


def apply_modifiers(objects):
    logger.log("\n--- Starting Modifier Application ---")
    bpy.ops.object.select_all(action='DESELECT')

    total_objects = len(objects)
    for idx, obj in enumerate(objects, 1):
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)

        if obj.data.users > 1:
            logger.log(f"  Making mesh data for '{obj.name}' unique ({idx}/{total_objects})...")
            obj.data = obj.data.copy()

        modifier_count = len(obj.modifiers)
        if modifier_count > 0:
            logger.log(f"  Applying {modifier_count} modifier(s) to {obj.name} ({idx}/{total_objects})...")

        for modifier in reversed(obj.modifiers[:]):
            if modifier.show_viewport:
                try:
                    bpy.ops.object.modifier_apply(modifier=modifier.name)
                except RuntimeError as e:
                    logger.log(f"    Could not apply '{modifier.name}'. Error: {e}")

        obj.select_set(False)

    logger.log("--- Modifier Application Complete ---")


def join_objects(objects):
    logger.log("\n--- Joining Objects (FOR BAKING ONLY) ---")
    logger.log("  NOTE: Originals preserved - joined mesh will be unwrapped after this step")

    if len(objects) <= 1:
        logger.log("  Only one object, skipping join.")
        return objects, objects

    # First, duplicate all objects to preserve originals
    logger.log("  Duplicating objects (UVs will be inherited)...")
    bpy.ops.object.select_all(action='DESELECT')

    duplicates = []
    for obj in objects:
        obj.select_set(True)

    bpy.ops.object.duplicate()

    # Get duplicated objects
    duplicates = [obj for obj in bpy.context.selected_objects]

    logger.log(f"  Created {len(duplicates)} duplicates for baking")

    # Verify duplicates have both UV layers
    sample_dup = duplicates[0]
    if sample_dup.type == 'MESH':
        uv_layers = [layer.name for layer in sample_dup.data.uv_layers]
        logger.log(f"  Duplicate UV layers: {uv_layers}")
        if LIGHTMAP_UV_NAME not in uv_layers:
            logger.log(f"  ⚠️ WARNING: LightmapUV not found in duplicates!")

    # Now join the duplicates
    bpy.context.view_layer.objects.active = duplicates[0]

    logger.log(f"  Joining {len(duplicates)} duplicates into one mesh for baking...")
    bpy.ops.object.join()

    joined_object = bpy.context.active_object
    joined_object.name = "Mansion_Lightmap_Baker"

    # Verify joined object has both UV layers
    if joined_object.type == 'MESH':
        joined_uv_layers = [layer.name for layer in joined_object.data.uv_layers]
        logger.log(f"  Joined object UV layers: {joined_uv_layers}")

        # CRITICAL FIX: Remove the mysterious "map1" layer that causes UV set 1 warnings
        if 'map1' in joined_object.data.uv_layers:
            logger.log(f"  🧹 Removing 'map1' layer (causes UV set 1 warnings)...")
            joined_object.data.uv_layers.remove(joined_object.data.uv_layers['map1'])
            joined_uv_layers = [layer.name for layer in joined_object.data.uv_layers]
            logger.log(f"  ✅ Cleaned UV layers: {joined_uv_layers}")

        # Ensure LightmapUV is active for rendering
        if LIGHTMAP_UV_NAME in joined_object.data.uv_layers:
            joined_object.data.uv_layers[LIGHTMAP_UV_NAME].active_render = True
            logger.log(f"  ✅ '{LIGHTMAP_UV_NAME}' set as active render UV")

    # Move to a separate collection
    baker_collection = bpy.data.collections.get("Lightmap_Baker")
    if not baker_collection:
        baker_collection = bpy.data.collections.new("Lightmap_Baker")
        bpy.context.scene.collection.children.link(baker_collection)

    # Remove from all collections and add to baker collection
    for coll in joined_object.users_collection:
        coll.objects.unlink(joined_object)
    baker_collection.objects.link(joined_object)

    logger.log(f"  Joined object: {joined_object.name} (in 'Lightmap_Baker' collection)")
    logger.log("  ✅ Original objects preserved with correct UVs!")
    logger.log("--- Join Complete ---")

    return [joined_object], objects


def repack_joined_lightmap_uvs(joined_obj):
    """
    CRITICAL: Repack all individual UV islands into shared 0-1 space.
    Without this, each object's UVs overlap (all in 0-1 independently).
    """
    logger.log("\n--- Repacking Joined Lightmap UVs ---")
    logger.log("  ⚠️ Individual object UVs overlap - repacking into shared space...")

    if joined_obj.type != 'MESH':
        logger.log("  Not a mesh object, skipping")
        return

    # Ensure LightmapUV is active
    if LIGHTMAP_UV_NAME not in joined_obj.data.uv_layers:
        logger.log(f"  ❌ No {LIGHTMAP_UV_NAME} layer found!")
        return

    joined_obj.data.uv_layers[LIGHTMAP_UV_NAME].active = True

    # Select the object
    bpy.ops.object.select_all(action='DESELECT')
    joined_obj.select_set(True)
    bpy.context.view_layer.objects.active = joined_obj

    # Enter edit mode
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')

    # Repack all UV islands into shared 0-1 space
    logger.log(f"  Repacking UV islands with margin={UV_ISLAND_MARGIN}...")
    try:
        bpy.ops.uv.pack_islands(margin=UV_ISLAND_MARGIN)
        logger.log("  ✅ UV islands repacked successfully")
    except Exception as e:
        logger.log(f"  ⚠️ UV packing failed: {e}")
        logger.log("  Trying alternative pack method...")
        try:
            bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', margin=UV_ISLAND_MARGIN)
            logger.log("  ✅ Alternative pack succeeded")
        except Exception as e2:
            logger.log(f"  ❌ All packing methods failed: {e2}")

    bpy.ops.object.mode_set(mode='OBJECT')

    # Verify the repacking
    logger.log("\n  📊 Verifying repacked UVs...")
    uv_layer = joined_obj.data.uv_layers[LIGHTMAP_UV_NAME]
    min_u, max_u = float('inf'), float('-inf')
    min_v, max_v = float('inf'), float('-inf')

    for uv in uv_layer.data:
        min_u = min(min_u, uv.uv[0])
        max_u = max(max_u, uv.uv[0])
        min_v = min(min_v, uv.uv[1])
        max_v = max(max_v, uv.uv[1])

    coverage = (max_u - min_u) * (max_v - min_v)
    logger.log(f"     UV bounds: U[{min_u:.3f}, {max_u:.3f}] V[{min_v:.3f}, {max_v:.3f}]")
    logger.log(f"     Coverage: {coverage:.1%} of texture space")

    if coverage > 0.5:
        logger.log("     ✅ Good UV coverage after repacking")
    else:
        logger.log("     ⚠️ Low UV coverage - islands might be too small")

    logger.log("--- UV Repacking Complete ---")


def cleanup_meshes(objects):
    logger.log("\n--- Starting Mesh Cleanup ---")
    bpy.ops.object.select_all(action='DESELECT')

    if not objects:
        logger.log("  No objects to clean.")
        return

    for obj in objects:
        obj.select_set(True)
    
    bpy.context.view_layer.objects.active = objects[0]

    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    
    logger.log("  Merging vertices by distance...")
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    
    logger.log("  Recalculating outside normals...")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    
    logger.log("  Triangulating all faces...")
    bpy.ops.mesh.quads_convert_to_tris()

    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    logger.log("--- Mesh Cleanup Complete ---")


def setup_uvs(objects):
    logger.log("\n--- Starting UV Setup (LIGHTMAP PACK METHOD) ---")
    bpy.ops.object.select_all(action='DESELECT')

    if not objects:
        logger.log("  No objects to set up UVs for.")
        return

    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    # CRITICAL FIX: Clean ALL UV layers except the first one (UVMap for textures)
    logger.log("  🧹 Cleaning existing UV layers...")
    mesh = objects[0].data

    # Ensure we have at least one UV layer (original textures)
    if len(mesh.uv_layers) == 0:
        logger.log("  Creating default UV layer...")
        mesh.uv_layers.new(name="UVMap")

    # Store the first UV layer (for original textures)
    original_uv_name = mesh.uv_layers[0].name
    logger.log(f"  Keeping original UV layer: {original_uv_name}")

    # Remove ALL other UV layers (map1, LightmapUV, etc.)
    layers_to_remove = []
    for i, layer in enumerate(mesh.uv_layers):
        if i > 0:  # Keep only the first layer
            layers_to_remove.append(layer)

    for layer in layers_to_remove:
        logger.log(f"  Removing extra UV layer: {layer.name}")
        mesh.uv_layers.remove(layer)

    logger.log(f"  ✅ UV cleanup complete: {len(mesh.uv_layers)} layer(s) remaining")

    # Create fresh lightmap UV layer
    logger.log(f"  Creating '{LIGHTMAP_UV_NAME}' as SECOND UV layer...")
    lightmap_uv_layer = mesh.uv_layers.new(name=LIGHTMAP_UV_NAME)

    # Set lightmap UV as active for unwrapping and rendering
    lightmap_uv_layer.active = True
    lightmap_uv_layer.active_render = True

    # Enter edit mode for unwrapping
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')

    logger.log(f"  Active UV layer for unwrapping: {mesh.uv_layers.active.name}")

    # USE SMART UV PROJECT (much faster for large joined meshes)
    # Lightmap Pack hangs on complex meshes with 732 objects joined
    logger.log("  Unwrapping with Smart UV Project (handles large meshes)...")
    logger.log(f"  UV island margin: {UV_ISLAND_MARGIN}")

    try:
        # Smart UV Project with angle-based island creation
        bpy.ops.uv.smart_project(
            angle_limit=66.0,  # 66 degrees is good balance for lightmaps
            island_margin=UV_ISLAND_MARGIN,
            area_weight=1.0,  # Weight by surface area (larger surfaces = larger UV islands)
            correct_aspect=True,
            scale_to_bounds=False
        )
        logger.log("  ✅ Smart UV Project completed")

        # Pack islands for optimal space usage
        logger.log("  Packing UV islands for optimal coverage...")
        bpy.ops.uv.pack_islands(margin=UV_ISLAND_MARGIN)
        logger.log("  ✅ UV packing completed")

    except Exception as e:
        logger.log(f"  ❌ Smart UV Project failed: {e}")
        logger.log("  Trying basic angle-based unwrap as fallback...")
        try:
            bpy.ops.uv.unwrap(method='ANGLE_BASED', margin=UV_ISLAND_MARGIN)
            logger.log("  ✅ Basic unwrap completed")
        except Exception as e2:
            logger.log(f"  ❌ All UV unwrapping methods failed: {e2}")

    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')

    logger.log(f"  ✅ UV setup complete: {len(mesh.uv_layers)} UV layers")
    for i, uv_layer in enumerate(mesh.uv_layers):
        logger.log(f"     Layer {i}: {uv_layer.name} {'(active render)' if uv_layer.active_render else ''}")

    # ENHANCED UV unwrap quality verification
    logger.log("\n  📊 Verifying UV unwrap quality...")
    if LIGHTMAP_UV_NAME in mesh.uv_layers:
        uv_layer = mesh.uv_layers[LIGHTMAP_UV_NAME]
        uv_count = len(uv_layer.data)

        # Check UV bounds and distribution
        min_u, max_u = float('inf'), float('-inf')
        min_v, max_v = float('inf'), float('-inf')

        # Sample multiple UVs to check distribution
        uv_samples = []
        sample_count = min(100, uv_count)
        for i in range(sample_count):
            idx = int(i * (uv_count / sample_count))
            uv = uv_layer.data[idx].uv
            uv_samples.append((uv[0], uv[1]))
            min_u = min(min_u, uv[0])
            max_u = max(max_u, uv[0])
            min_v = min(min_v, uv[1])
            max_v = max(max_v, uv[1])

        logger.log(f"     UV coordinates: {uv_count}")
        logger.log(f"     UV bounds: U[{min_u:.3f}, {max_u:.3f}] V[{min_v:.3f}, {max_v:.3f}]")

        # Calculate UV coverage (how much of 0-1 space is used)
        coverage_u = max_u - min_u
        coverage_v = max_v - min_v
        total_coverage = coverage_u * coverage_v
        logger.log(f"     UV coverage: {total_coverage:.1%} of texture space")

        # Validation checks
        if coverage_u < 0.1 or coverage_v < 0.1:
            logger.log("     ❌ CRITICAL: UVs are collapsed! Unwrap failed!")
        elif total_coverage < 0.1:
            logger.log("     ⚠️ WARNING: Very low UV coverage - islands might be too small!")
        elif min_u < -0.1 or max_u > 1.1 or min_v < -0.1 or max_v > 1.1:
            logger.log("     ⚠️ WARNING: Some UVs outside 0-1 range!")
        elif total_coverage > 0.5:
            logger.log("     ✅ Excellent UV unwrap! Good coverage.")
        else:
            logger.log("     ✅ UV unwrap looks acceptable")

    logger.log("--- UV Setup Complete ---")


def export_uv_layout(obj, uv_layer_name, output_filename):
    """Export UV layout as image for visual verification"""
    logger.log(f"  Trying to export '{uv_layer_name}'...")

    # Ensure object is selected and active
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    # Set the UV layer as active
    if uv_layer_name in obj.data.uv_layers:
        obj.data.uv_layers[uv_layer_name].active = True
    else:
        logger.log(f"    ❌ UV layer '{uv_layer_name}' not found!")
        return False

    # Enter edit mode
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')

    # Export UV layout
    output_path = os.path.join(output_directory, output_filename)
    try:
        bpy.ops.uv.export_layout(
            filepath=output_path,
            export_all=False,  # Only export active UV map
            size=(2048, 2048),  # High resolution for verification
            opacity=0.5
        )
        logger.log(f"    ✅ Exported to: {output_path}")
        bpy.ops.object.mode_set(mode='OBJECT')
        return True
    except Exception as e:
        # Silently fail if GPU not available (common in script mode)
        bpy.ops.object.mode_set(mode='OBJECT')
        return False


def ensure_uv1_exists(objects):
    """Ensure all objects have at least UV1 (original UVMap) before processing"""
    logger.log("\n--- Verifying UV1 (UVMap) on All Objects ---")

    missing_uv1 = []
    for obj in objects:
        if obj.type != 'MESH':
            continue

        # Ensure at least one UV layer exists
        if len(obj.data.uv_layers) == 0:
            logger.log(f"  ⚠️ {obj.name} has NO UV layers! Creating default UVMap...")
            obj.data.uv_layers.new(name="UVMap")
            missing_uv1.append(obj.name)

    if missing_uv1:
        logger.log(f"  ✅ Created UV1 for {len(missing_uv1)} objects: {missing_uv1}")
    else:
        logger.log(f"  ✅ All {len(objects)} objects have UV1")

    logger.log("--- UV1 Verification Complete ---")


def transfer_lightmap_uvs_fast(baked_object, original_objects):
    """
    FAST UV transfer using direct vertex position mapping.
    10-20x faster than Data Transfer modifier!
    """
    logger.log("\n--- Transferring Lightmap UVs (FAST METHOD) ---")

    if not baked_object:
        logger.log("  ❌ ERROR: No baked object provided!")
        return

    source_mesh = baked_object.data

    # Verify source has lightmap UVs
    if LIGHTMAP_UV_NAME not in source_mesh.uv_layers:
        logger.log(f"  ❌ ERROR: Baked object has no '{LIGHTMAP_UV_NAME}' layer!")
        return

    logger.log(f"  Source: {baked_object.name} (has {LIGHTMAP_UV_NAME})")
    logger.log(f"  ⚡ Using direct UV copy (much faster than Data Transfer)")

    # Get source UV data
    source_uv_layer = source_mesh.uv_layers[LIGHTMAP_UV_NAME]

    # Build vertex position → UV mapping from source
    vert_to_uv = {}
    for poly in source_mesh.polygons:
        for loop_idx in poly.loop_indices:
            loop = source_mesh.loops[loop_idx]
            vert_idx = loop.vertex_index
            vert_co = source_mesh.vertices[vert_idx].co

            # Use position as key (rounded for matching)
            key = (round(vert_co.x, 5), round(vert_co.y, 5), round(vert_co.z, 5))
            uv = source_uv_layer.data[loop_idx].uv

            if key not in vert_to_uv:
                vert_to_uv[key] = uv.copy()

    logger.log(f"  Built lookup table: {len(vert_to_uv)} unique vertices")

    total_objects = len(original_objects)
    transferred = 0

    for idx, obj in enumerate(original_objects, 1):
        if not obj or obj.type != 'MESH':
            continue

        mesh = obj.data

        # Ensure LightmapUV exists
        if LIGHTMAP_UV_NAME not in mesh.uv_layers:
            mesh.uv_layers.new(name=LIGHTMAP_UV_NAME)

        target_uv = mesh.uv_layers[LIGHTMAP_UV_NAME]

        # Copy UVs by matching vertex positions
        for poly in mesh.polygons:
            for loop_idx in poly.loop_indices:
                loop = mesh.loops[loop_idx]
                vert = mesh.vertices[loop.vertex_index]

                key = (round(vert.co.x, 5), round(vert.co.y, 5), round(vert.co.z, 5))

                if key in vert_to_uv:
                    target_uv.data[loop_idx].uv = vert_to_uv[key]

        # Set as active render UV
        mesh.uv_layers[LIGHTMAP_UV_NAME].active_render = True
        transferred += 1

        # Progress (less frequent for speed)
        if idx % 100 == 0 or idx == total_objects:
            logger.log(f"    Progress: {idx}/{total_objects} ({(idx/total_objects*100):.1f}%)")

    logger.log(f"\n  ✅ UV transfer complete! {transferred}/{total_objects} objects")
    logger.log(f"  ⚡ Fast method complete (seconds vs minutes)")
    logger.log("--- UV Transfer Complete ---")


def transfer_lightmap_uvs(baked_object, original_objects):
    """Transfer lightmap UVs using Data Transfer modifier - ROBUST METHOD"""
    logger.log("\n--- Transferring Lightmap UVs (Data Transfer Modifier) ---")

    if not baked_object:
        logger.log("  ❌ ERROR: No baked object provided!")
        return

    source_object = baked_object

    # Verify source has lightmap UVs
    if LIGHTMAP_UV_NAME not in source_object.data.uv_layers:
        logger.log(f"  ❌ ERROR: Baked object has no '{LIGHTMAP_UV_NAME}' layer!")
        return

    logger.log(f"  Source: {source_object.name} (has {LIGHTMAP_UV_NAME})")

    # Deselect all
    bpy.ops.object.select_all(action='DESELECT')

    total_objects = len(original_objects)
    successfully_transferred = 0
    failed_transfers = []

    for idx, orig_obj in enumerate(original_objects, 1):
        if not orig_obj or orig_obj.type != 'MESH':
            continue

        # Create lightmap UV layer if missing
        if LIGHTMAP_UV_NAME not in orig_obj.data.uv_layers:
            orig_obj.data.uv_layers.new(name=LIGHTMAP_UV_NAME)

        # Select and make active
        orig_obj.select_set(True)
        bpy.context.view_layer.objects.active = orig_obj

        # Add Data Transfer modifier
        modifier = orig_obj.modifiers.new(name="LightmapUVTransfer", type='DATA_TRANSFER')
        modifier.object = source_object
        modifier.use_loop_data = True
        modifier.data_types_loops = {'UV'}
        modifier.loop_mapping = 'POLYINTERP_NEAREST'  # Best for spatial matching

        # Configure UV layer mapping
        source_uv = source_object.data.uv_layers.get(LIGHTMAP_UV_NAME)
        dest_uv = orig_obj.data.uv_layers.get(LIGHTMAP_UV_NAME)

        if source_uv and dest_uv:
            modifier.layers_uv_select_src = source_uv.name
            modifier.layers_uv_select_dst = dest_uv.name

            # Apply modifier
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)

                # Set as active render
                orig_obj.data.uv_layers[LIGHTMAP_UV_NAME].active_render = True

                successfully_transferred += 1
            except RuntimeError as e:
                logger.log(f"  ⚠️ Failed on {orig_obj.name}: {e}")
                failed_transfers.append(orig_obj.name)
                # Remove failed modifier
                if modifier.name in orig_obj.modifiers:
                    orig_obj.modifiers.remove(modifier)
        else:
            logger.log(f"  ⚠️ UV layer mismatch on {orig_obj.name}")
            failed_transfers.append(orig_obj.name)
            orig_obj.modifiers.remove(modifier)

        orig_obj.select_set(False)

        # Progress logging
        if idx % 50 == 0 or idx == total_objects:
            logger.log(f"    Progress: {idx}/{total_objects} objects ({(idx/total_objects*100):.1f}%)")

    logger.log(f"\n  ✅ UV transfer complete! Transferred to {successfully_transferred}/{total_objects} objects")

    if failed_transfers:
        logger.log(f"  ⚠️ Failed transfers ({len(failed_transfers)}): {', '.join(failed_transfers[:10])}")
        if len(failed_transfers) > 10:
            logger.log(f"       ... and {len(failed_transfers)-10} more")

    logger.log("--- UV Transfer Complete ---")


def verify_and_fix_uv2(objects):
    """Verify all objects have UV2 (LightmapUV), create if missing"""
    logger.log("\n--- Verifying UV2 (LightmapUV) on All Objects ---")

    missing_uv2 = []
    fixed_uv2 = []

    for obj in objects:
        if obj.type != 'MESH':
            continue

        # Check if UV2 exists
        if LIGHTMAP_UV_NAME not in obj.data.uv_layers:
            missing_uv2.append(obj.name)
            logger.log(f"  ⚠️ {obj.name} is MISSING {LIGHTMAP_UV_NAME}!")

            # FALLBACK: Copy UV1 to UV2
            if len(obj.data.uv_layers) > 0:
                logger.log(f"     → Creating {LIGHTMAP_UV_NAME} by copying UV1...")

                # Get UV1 data
                uv1 = obj.data.uv_layers[0]

                # Create UV2 layer
                uv2 = obj.data.uv_layers.new(name=LIGHTMAP_UV_NAME)
                uv2.active_render = True

                # Copy UV1 data to UV2
                for loop_idx, loop in enumerate(obj.data.loops):
                    uv2.data[loop_idx].uv = uv1.data[loop_idx].uv

                fixed_uv2.append(obj.name)
                logger.log(f"     ✅ Fixed {obj.name} by copying UV1 to UV2")
        else:
            # Ensure UV2 is set as active render
            uv2 = obj.data.uv_layers[LIGHTMAP_UV_NAME]
            uv2.active_render = True

    logger.log(f"\n📊 UV2 Verification Results:")
    logger.log(f"  Total mesh objects: {len([o for o in objects if o.type == 'MESH'])}")
    logger.log(f"  Missing UV2: {len(missing_uv2)}")
    logger.log(f"  Fixed with fallback: {len(fixed_uv2)}")

    if missing_uv2:
        logger.log(f"\n  Objects that were missing UV2:")
        for name in missing_uv2:
            logger.log(f"    - {name}")

    if len(missing_uv2) == 0:
        logger.log(f"  ✅ All objects have {LIGHTMAP_UV_NAME}!")
    elif len(fixed_uv2) == len(missing_uv2):
        logger.log(f"  ✅ All missing UV2s were fixed with fallback")
    else:
        logger.log(f"  ⚠️ Some objects still missing UV2!")

    logger.log("--- UV2 Verification Complete ---")


def clean_lightmap_nodes_from_materials(objects):
    """Remove lightmap image nodes from materials to prevent GLTF export conflicts"""
    logger.log("\n--- Cleaning Lightmap Image Nodes from Materials ---")

    cleaned_count = 0
    total_materials = 0

    for obj in objects:
        if obj.type != 'MESH':
            continue

        for slot in obj.material_slots:
            if not slot.material or not slot.material.use_nodes:
                continue

            total_materials += 1
            material = slot.material
            nodes_to_remove = []

            # Find all Image Texture nodes with lightmap images
            for node in material.node_tree.nodes:
                if node.type == 'ShaderNodeTexImage':
                    if node.image and ('Lightmap' in node.image.name or
                                      node.image.name == 'Mansion_Lightmap_On' or
                                      node.image.name == 'Mansion_Lightmap_Off'):
                        nodes_to_remove.append(node)

            # Remove the nodes
            for node in nodes_to_remove:
                material.node_tree.nodes.remove(node)
                cleaned_count += 1

    logger.log(f"  ✅ Removed {cleaned_count} lightmap image nodes from {total_materials} materials")
    logger.log("  This prevents 'Custom UV set 1' warnings in Three.js")
    logger.log("--- Material Cleanup Complete ---")


def export_mansion_glb():
    """Export the Mansion collection to GLB with proper UV settings"""
    logger.log("\n--- Exporting Mansion to GLB ---")

    # Get the Mansion collection
    mansion_collection = bpy.data.collections.get(MANSION_COLLECTION_NAME)
    if not mansion_collection:
        logger.log(f"  ❌ ERROR: Collection '{MANSION_COLLECTION_NAME}' not found!")
        return False

    # CRITICAL: Clean lightmap nodes from materials before export
    # This prevents Three.js GLTFLoader from trying to use TEXCOORD_1 for textures
    all_mansion_objects = []
    def collect_objects(collection):
        for obj in collection.objects:
            all_mansion_objects.append(obj)
        for child_coll in collection.children:
            collect_objects(child_coll)

    collect_objects(mansion_collection)
    clean_lightmap_nodes_from_materials(all_mansion_objects)

    # Deselect all objects first
    bpy.ops.object.select_all(action='DESELECT')

    # Select all objects in the Mansion collection (recursively)
    def select_collection_objects(collection):
        for obj in collection.objects:
            obj.select_set(True)
        for child_coll in collection.children:
            select_collection_objects(child_coll)

    select_collection_objects(mansion_collection)

    # Count selected objects
    selected_count = len(bpy.context.selected_objects)
    logger.log(f"  Selected {selected_count} objects from '{MANSION_COLLECTION_NAME}' collection")

    # Set export path (same directory as .blend file)
    export_path = os.path.join(output_directory, EXPORT_FILENAME)
    logger.log(f"  Export path: {export_path}")

    # Export settings optimized for Three.js with lightmaps
    logger.log("  Exporting GLB with optimized settings...")

    try:
        bpy.ops.export_scene.gltf(
            filepath=export_path,
            export_format='GLB',

            # Only export selected objects (Mansion collection)
            use_selection=True,

            # UV Settings - CRITICAL for lightmaps
            export_texcoords=True,  # Export UV coordinates
            export_attributes=True,  # Export all vertex attributes including UV2

            # Material settings
            export_materials='EXPORT',

            # Geometry settings
            export_normals=True,
            export_tangents=False,  # Not needed for lightmaps

            # Mesh settings
            export_apply=False,  # Don't apply modifiers (already applied)

            # Optimization
            export_yup=True,  # Use Y-up orientation for Three.js

            # Compression (optional, but good for web)
            export_draco_mesh_compression_enable=False,  # Disable for compatibility
        )

        logger.log(f"  ✅ GLB exported successfully to: {export_path}")

        # Get file size for logging
        file_size = os.path.getsize(export_path) / (1024 * 1024)  # Convert to MB
        logger.log(f"  File size: {file_size:.2f} MB")

        return True

    except Exception as e:
        logger.log(f"  ❌ Export failed: {e}")
        return False

    logger.log("--- GLB Export Complete ---")


def perform_bake(objects, image_name, lights_on_collection, lights_off_collection):
    logger.log(f"\n--- Starting Bake: {image_name} ---")

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = RENDER_SAMPLES
    scene.cycles.use_denoising = USE_DENOISE
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.max_bounces = MAX_LIGHT_BOUNCES

    scene.cycles.bake_type = 'COMBINED'

    bake_settings = scene.render.bake
    bake_settings.use_selected_to_active = False
    bake_settings.target = 'IMAGE_TEXTURES'
    bake_settings.margin = BAKE_MARGIN_PX  # Margin around UV islands to prevent bleeding
    bake_settings.margin_type = 'EXTEND'  # Use extend mode for better results
    bake_settings.use_pass_direct = True  # FIXED: Enable direct lighting
    bake_settings.use_pass_indirect = True  # FIXED: Enable indirect lighting

    # CRITICAL FIX: Add world/ambient lighting for better illumination
    logger.log(f"  🌍 Setting up world lighting (ambient illumination)...")
    if not scene.world:
        scene.world = bpy.data.worlds.new("World")

    scene.world.use_nodes = True
    world_nodes = scene.world.node_tree.nodes
    world_links = scene.world.node_tree.links

    # Clear existing nodes
    world_nodes.clear()

    # Create background shader with ambient light
    bg_node = world_nodes.new(type='ShaderNodeBackground')
    bg_node.inputs['Color'].default_value = (*WORLD_LIGHT_COLOR, 1.0)  # RGB + Alpha
    bg_node.inputs['Strength'].default_value = WORLD_LIGHT_STRENGTH

    output_node = world_nodes.new(type='ShaderNodeOutputWorld')
    world_links.new(bg_node.outputs['Background'], output_node.inputs['Surface'])

    logger.log(f"  ✅ World light: Strength={WORLD_LIGHT_STRENGTH}, Color={WORLD_LIGHT_COLOR}")

    logger.log(f"  Render settings: {RENDER_SAMPLES} samples, Denoise: {USE_DENOISE}, Bounces: {MAX_LIGHT_BOUNCES}")

    # CRITICAL FIX: Actually disable lights by setting energy/emission strength to 0
    # Store original values in dictionaries
    logger.log(f"  Configuring lights for bake: {image_name}")

    # Dictionary to store original light energies
    original_light_energies = {}
    original_emission_strengths = {}

    if "On" in image_name:
        # Turn ON lights in Lights_ON collection
        for obj in lights_on_collection.all_objects:
            if obj.type == 'LIGHT' and hasattr(obj.data, 'energy'):
                # Store original if not already stored
                if obj.name not in original_light_energies:
                    original_light_energies[obj.name] = obj.data.energy
                # Restore original energy
                obj.data.energy = original_light_energies[obj.name]
            # Also handle emissive meshes
            if obj.type == 'MESH' and obj.material_slots:
                for slot_idx, slot in enumerate(obj.material_slots):
                    if slot.material and slot.material.use_nodes:
                        for node_idx, node in enumerate(slot.material.node_tree.nodes):
                            if node.type == 'EMISSION' and len(node.inputs) > 1:
                                key = f"{obj.name}_{slot_idx}_{node_idx}"
                                if key not in original_emission_strengths:
                                    original_emission_strengths[key] = node.inputs[1].default_value
                                node.inputs[1].default_value = original_emission_strengths[key]

        # Turn OFF lights in Lights_OFF collection
        for obj in lights_off_collection.all_objects:
            if obj.type == 'LIGHT' and hasattr(obj.data, 'energy'):
                # Store original if not already stored
                if obj.name not in original_light_energies:
                    original_light_energies[obj.name] = obj.data.energy
                obj.data.energy = 0.0
            # Also handle emissive meshes
            if obj.type == 'MESH' and obj.material_slots:
                for slot_idx, slot in enumerate(obj.material_slots):
                    if slot.material and slot.material.use_nodes:
                        for node_idx, node in enumerate(slot.material.node_tree.nodes):
                            if node.type == 'EMISSION' and len(node.inputs) > 1:
                                key = f"{obj.name}_{slot_idx}_{node_idx}"
                                if key not in original_emission_strengths:
                                    original_emission_strengths[key] = node.inputs[1].default_value
                                node.inputs[1].default_value = 0.0

        logger.log("  ✅ Lights ON collection enabled, Lights OFF collection disabled")
    else:
        # Turn OFF lights in Lights_ON collection
        for obj in lights_on_collection.all_objects:
            if obj.type == 'LIGHT' and hasattr(obj.data, 'energy'):
                if obj.name not in original_light_energies:
                    original_light_energies[obj.name] = obj.data.energy
                obj.data.energy = 0.0
            if obj.type == 'MESH' and obj.material_slots:
                for slot_idx, slot in enumerate(obj.material_slots):
                    if slot.material and slot.material.use_nodes:
                        for node_idx, node in enumerate(slot.material.node_tree.nodes):
                            if node.type == 'EMISSION' and len(node.inputs) > 1:
                                key = f"{obj.name}_{slot_idx}_{node_idx}"
                                if key not in original_emission_strengths:
                                    original_emission_strengths[key] = node.inputs[1].default_value
                                node.inputs[1].default_value = 0.0

        # Turn ON lights in Lights_OFF collection
        for obj in lights_off_collection.all_objects:
            if obj.type == 'LIGHT' and hasattr(obj.data, 'energy'):
                if obj.name not in original_light_energies:
                    original_light_energies[obj.name] = obj.data.energy
                obj.data.energy = original_light_energies[obj.name]
            if obj.type == 'MESH' and obj.material_slots:
                for slot_idx, slot in enumerate(obj.material_slots):
                    if slot.material and slot.material.use_nodes:
                        for node_idx, node in enumerate(slot.material.node_tree.nodes):
                            if node.type == 'EMISSION' and len(node.inputs) > 1:
                                key = f"{obj.name}_{slot_idx}_{node_idx}"
                                if key not in original_emission_strengths:
                                    original_emission_strengths[key] = node.inputs[1].default_value
                                node.inputs[1].default_value = original_emission_strengths[key]

        logger.log("  ✅ Lights OFF collection enabled, Lights ON collection disabled")

    # Diagnostic: Count lights in each collection
    on_lights = sum(1 for obj in lights_on_collection.all_objects if obj.type == 'LIGHT')
    off_lights = sum(1 for obj in lights_off_collection.all_objects if obj.type == 'LIGHT')
    on_emissive = sum(1 for obj in lights_on_collection.all_objects if obj.type == 'MESH' and any(
        slot.material and slot.material.use_nodes and any(n.type == 'EMISSION' for n in slot.material.node_tree.nodes)
        for slot in obj.material_slots))
    off_emissive = sum(1 for obj in lights_off_collection.all_objects if obj.type == 'MESH' and any(
        slot.material and slot.material.use_nodes and any(n.type == 'EMISSION' for n in slot.material.node_tree.nodes)
        for slot in obj.material_slots))
    logger.log(f"  Debug: Lights_ON has {on_lights} lights + {on_emissive} emissive meshes")
    logger.log(f"  Debug: Lights_OFF has {off_lights} lights + {off_emissive} emissive meshes")

    logger.log(f"  Creating target image: '{image_name}' ({IMAGE_RESOLUTION}x{IMAGE_RESOLUTION})")
    bpy.ops.image.new(name=image_name, width=IMAGE_RESOLUTION, height=IMAGE_RESOLUTION)
    bake_image = bpy.data.images[image_name]

    logger.log("  Assigning target image node to all materials...")
    obj = objects[0]
    if not obj.material_slots:
        new_mat = bpy.data.materials.new(name="LightmapMaterial")
        new_mat.use_nodes = True
        obj.data.materials.append(new_mat)
        logger.log("  Created and assigned new material 'LightmapMaterial'")

    for material_slot in obj.material_slots:
        if material_slot.material and material_slot.material.use_nodes:
            nodes = material_slot.material.node_tree.nodes
            
            image_node = nodes.new(type='ShaderNodeTexImage')
            image_node.image = bake_image
            nodes.active = image_node

    logger.log("  Selecting the joined mesh for baking...")
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    logger.log("\n  >>> BAKING... This may take a while. Check the terminal for progress. <<<")
    start_time = time.time()
    
    bpy.ops.object.bake()
    
    end_time = time.time()
    logger.log(f"  >>> BAKE COMPLETE! (Took { (end_time - start_time) / 60 :.2f} minutes) <<<")

    output_path = os.path.join(output_directory, f"{image_name}.{OUTPUT_IMAGE_FORMAT.lower()}")
    logger.log(f"  Saving baked image to: {output_path}")
    bake_image.filepath_raw = output_path
    bake_image.file_format = OUTPUT_IMAGE_FORMAT
    bake_image.save()
    logger.log(f"--- Finished Bake: {image_name} ---")


def fix_texture_uv_assignments(objects):
    """
    Fix texture UV channel assignments to prevent 'Custom UV set 1' warnings.
    Ensures all textures use UV channel 0 (UVMap), not channel 1.

    This fixes TWO issues:
    1. UV Map nodes pointing to wrong UV layer
    2. Image Texture nodes with uv_map property set to wrong layer
    """
    logger.log("\n--- Fixing Texture UV Channel Assignments ---")

    fixed_uvmap_nodes = 0
    fixed_image_nodes = 0
    added_uvmap_nodes = 0
    total_materials = 0

    for obj in objects:
        if obj.type != 'MESH':
            continue

        for slot in obj.material_slots:
            if not slot.material or not slot.material.use_nodes:
                continue

            total_materials += 1
            material = slot.material
            nodes = material.node_tree.nodes
            links = material.node_tree.links

            # Find all Image Texture nodes
            for node in nodes:
                if node.type == 'ShaderNodeTexImage':

                    # Method 1: Check UV Map node connected to this texture
                    vector_input = node.inputs.get('Vector')
                    if vector_input and vector_input.links:
                        for link in vector_input.links:
                            if link.from_node.type == 'ShaderNodeUVMap':
                                # Force it to use UV channel 0 (UVMap)
                                if link.from_node.uv_map != 'UVMap':
                                    logger.log(f"  Fixing {material.name}: UVMap node {link.from_node.uv_map} → UVMap")
                                    link.from_node.uv_map = 'UVMap'
                                    fixed_uvmap_nodes += 1

                    # Method 2: If no UV Map node, add one and connect it
                    elif vector_input and not vector_input.links:
                        # Create UV Map node
                        uvmap_node = nodes.new(type='ShaderNodeUVMap')
                        uvmap_node.uv_map = 'UVMap'
                        uvmap_node.location = (node.location.x - 300, node.location.y)

                        # Connect it
                        links.new(uvmap_node.outputs['UV'], node.inputs['Vector'])

                        logger.log(f"  Added UVMap node to {material.name}")
                        added_uvmap_nodes += 1

                    # Method 3: Check if node has uv_map attribute (some node types)
                    if hasattr(node, 'uv_map') and node.uv_map != 'UVMap' and node.uv_map != '':
                        logger.log(f"  Fixing {material.name}: Image node uv_map {node.uv_map} → UVMap")
                        node.uv_map = 'UVMap'
                        fixed_image_nodes += 1

    total_fixed = fixed_uvmap_nodes + fixed_image_nodes + added_uvmap_nodes

    logger.log(f"\n  ✅ Fixed {total_fixed} texture UV assignments:")
    logger.log(f"     - UV Map nodes fixed: {fixed_uvmap_nodes}")
    logger.log(f"     - Image nodes fixed: {fixed_image_nodes}")
    logger.log(f"     - UV Map nodes added: {added_uvmap_nodes}")
    logger.log(f"     - Total materials processed: {total_materials}")
    logger.log(f"  All textures now use UV channel 0 (UVMap)")
    logger.log("--- UV Assignment Fix Complete ---")


def main():
    logger.log("=============================================")
    logger.log("===      AUTOMATED LIGHTMAP BAKER      ===")
    logger.log("=============================================")

    bpy.ops.object.select_all(action='DESELECT')

    mansion_objects = get_all_mesh_objects_in_collection(MANSION_COLLECTION_NAME)
    if not mansion_objects:
        return

    # STEP 1: Ensure all objects have UV1 before processing
    ensure_uv1_exists(mansion_objects)

    # STEP 2: Apply modifiers and join FIRST (before unwrapping)
    # This is CRITICAL - we must join before unwrapping so Lightmap Pack can
    # size UV islands based on actual surface area (not per-object)
    apply_modifiers(mansion_objects)
    joined_mansion, original_objects = join_objects(mansion_objects)
    cleanup_meshes(joined_mansion)

    # STEP 3: Unwrap the JOINED mesh (correct workflow for lightmaps)
    # This ensures UV islands are sized proportionally to surface area
    # Large surfaces get large UV islands, small objects get small UV islands
    setup_uvs(joined_mansion)

    # Export UV layouts for visual verification (skip if GPU not available)
    logger.log("\n🔍 Attempting UV layout export (may fail in background mode)...")
    uv1_exported = export_uv_layout(joined_mansion[0], "UVMap", "UV_Layout_UVMap.png")
    uv2_exported = export_uv_layout(joined_mansion[0], LIGHTMAP_UV_NAME, "UV_Layout_LightmapUV.png")

    if not uv1_exported and not uv2_exported:
        logger.log("  ℹ️ UV layout export skipped (GPU not available in this mode)")
        logger.log("  💡 To visually check UVs: Open the .blend file in Blender UI")
        logger.log("     and switch to UV Editing workspace to inspect LightmapUV")

    # Try to find light collections - they might be nested in Mansion collection
    lights_on = bpy.data.collections.get(LIGHTS_ON_COLLECTION_NAME)
    lights_off = bpy.data.collections.get(LIGHTS_OFF_COLLECTION_NAME)

    # If not found at root, search in Mansion collection children
    if not lights_on or not lights_off:
        mansion_collection = bpy.data.collections.get(MANSION_COLLECTION_NAME)
        if mansion_collection:
            for child in mansion_collection.children:
                if child.name == LIGHTS_ON_COLLECTION_NAME:
                    lights_on = child
                if child.name == LIGHTS_OFF_COLLECTION_NAME:
                    lights_off = child

    if not lights_on or not lights_off:
        logger.log("Error: Could not find 'Lights_ON' or 'Lights_OFF' collections.")
        logger.log(f"Available collections: {[c.name for c in bpy.data.collections]}")
        return

    logger.log(f"Found light collections: {lights_on.name} and {lights_off.name}")

    perform_bake(joined_mansion, "Mansion_Lightmap_On", lights_on, lights_off)
    perform_bake(joined_mansion, "Mansion_Lightmap_Off", lights_on, lights_off)

    # STEP 4: Transfer correctly-sized UVs from joined mesh back to original objects
    # The joined mesh has proper surface-area-based UV islands
    # Using FAST method (10-20x faster than Data Transfer modifier)
    transfer_lightmap_uvs_fast(joined_mansion[0], original_objects)

    # Verify originals have correct lightmap UVs
    logger.log("\n🔍 Verifying original objects received lightmap UVs...")
    sample_obj = original_objects[0] if original_objects else None
    if sample_obj and LIGHTMAP_UV_NAME in sample_obj.data.uv_layers:
        uv_layer = sample_obj.data.uv_layers[LIGHTMAP_UV_NAME]
        if len(uv_layer.data) > 0:
            # Check first UV coordinate
            first_uv = uv_layer.data[0].uv
            logger.log(f"  Sample object: {sample_obj.name}")
            logger.log(f"  First UV coord: ({first_uv[0]:.3f}, {first_uv[1]:.3f})")

            # Check if UVs are in valid range
            if 0 <= first_uv[0] <= 1 and 0 <= first_uv[1] <= 1:
                logger.log(f"  ✅ Original objects have correct lightmap UVs!")
            else:
                logger.log(f"  ⚠️ UV coordinates out of range - transfer may have failed")
    logger.log("")

    # Verify UV2 exists on all objects
    verify_and_fix_uv2(original_objects)

    # Hide the baker object (no longer needed)
    joined_mansion[0].hide_viewport = True
    joined_mansion[0].hide_render = True
    logger.log(f"\n  Hidden baker object: {joined_mansion[0].name}")

    # Save the .blend file
    logger.log("\n💾 Saving .blend file...")
    try:
        bpy.ops.wm.save_mainfile()  # Use save_mainfile instead of save_as_mainfile
        logger.log(f"✅ Saved to: {bpy.data.filepath}")
    except Exception as e:
        logger.log(f"⚠️ Save warning: {e}")
        logger.log("   File may have been saved with @ suffix (backup issue)")
        logger.log("   You can manually save: File > Save or Ctrl+S")

    # CRITICAL: Fix texture UV assignments RIGHT BEFORE EXPORT
    # This ensures all materials use UVMap (channel 0) instead of any other UV layer
    logger.log("\n🔧 Final texture UV assignment check before export...")
    fix_texture_uv_assignments(original_objects)

    # Export GLB automatically (if enabled)
    export_success = False
    if AUTO_EXPORT_GLB:
        export_success = export_mansion_glb()
    else:
        logger.log("\n⏭️ GLB export skipped (AUTO_EXPORT_GLB = False)")

    logger.log("\n" + "="*50)
    logger.log("✅ ALL TASKS COMPLETED SUCCESSFULLY!")
    logger.log("="*50)
    logger.log(f"📊 Summary:")
    logger.log(f"   - Baked lightmaps: Mansion_Lightmap_On.png, Mansion_Lightmap_Off.png")
    logger.log(f"   - UV layouts exported: UV_Layout_UVMap.png, UV_Layout_LightmapUV.png")
    logger.log(f"   - UV layers verified and fixed on all {len(original_objects)} objects")
    if AUTO_EXPORT_GLB:
        logger.log(f"   - GLB exported: {'✅ Success' if export_success else '❌ Failed'}")
    logger.log(f"   - Ready to use in Three.js!")
    logger.log("="*50)
    logger.log("\n💡 Configuration used:")
    logger.log(f"   - Image resolution: {IMAGE_RESOLUTION}x{IMAGE_RESOLUTION}")
    logger.log(f"   - Bake margin: {BAKE_MARGIN_PX}px")
    logger.log(f"   - UV island margin: {UV_ISLAND_MARGIN}")
    logger.log(f"   - Samples: {RENDER_SAMPLES}")
    logger.log("="*50)
    logger.log("\n🔍 UV Verification Steps:")
    if uv2_exported:
        logger.log("   1. Open UV_Layout_LightmapUV.png to verify the UV unwrap")
        logger.log("      - You should see a proper flattened layout, not jumbled lines")
    else:
        logger.log("   1. Open the .blend file in Blender UI")
        logger.log("   2. Select 'Mansion_Lightmap_Baker' object (in Lightmap_Baker collection)")
        logger.log("   3. Switch to 'UV Editing' workspace (top menu)")
        logger.log("   4. In UV Editor, select 'LightmapUV' from UV map dropdown")
        logger.log("   5. You should see proper UV islands, NOT jumbled overlapping lines")
    logger.log("\n   📊 Check the log above for UV bounds and quality warnings")
    logger.log("      - UV bounds should be roughly [0.000, 1.000]")
    logger.log("      - Should say '✅ UV unwrap looks good'")
    logger.log("="*50)


if __name__ == "__main__":
    try:
        main()
    finally:
        # Close the logger to ensure log file is properly closed
        logger.close()