import bpy
import os

# --- --- --- SETTINGS --- --- ---
# The folder path where you want to save the final .glb files.
# Use FORWARD SLASHES / even on Windows.
EXPORT_PATH = 'C:/Users/user-pc/Documents/Mansion-Game-Assets/'
# --- --- END OF SETTINGS --- ---

def main():
    """Finds all mesh objects and exports them as individual .glb files."""
    print("--- Starting Optimized Export Script ---")

    # Ensure the export directory exists
    if not os.path.exists(EXPORT_PATH):
        os.makedirs(EXPORT_PATH)
        print(f"Created directory: {EXPORT_PATH}")

    # Get all mesh objects in the scene
    objects_to_export = [obj for obj in bpy.data.objects if obj.type == 'MESH']

    if not objects_to_export:
        print("FATAL ERROR: No mesh objects found to export.")
        return

    print(f"Found {len(objects_to_export)} consolidated objects to export.")

    for obj in objects_to_export:
        # Deselect all objects to ensure we only export one at a time
        bpy.ops.object.select_all(action='DESELECT')

        # Select the current object
        obj.select_set(True)

        # Create a clean filename and the full export path
        clean_name = bpy.path.clean_name(obj.name)
        file_path = os.path.join(EXPORT_PATH, f"{clean_name}.glb")

        print(f"-> Exporting '{obj.name}'...")

        try:
            bpy.ops.export_scene.gltf(
                filepath=file_path,
                use_selection=True,
                export_format='GLB',
                export_apply=True,  # Applies modifiers, which is good for final assets
                export_draco_mesh_compression_enable=True
            )
            print(f"   Success: Saved to {file_path}")
        except Exception as e:
            print(f"   ERROR exporting {obj.name}: {e}")

    print("\n--- Export complete! ---")

# This makes the script runnable from the command line
if __name__ == "__main__":
    main()