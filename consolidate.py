import bpy

# --- Configuration ---
# Names of the Empty objects you placed in the center of your rooms.
CENTER_POINT_NAMES = [
    "CENTRE_bottom_left_corridor",
    "CENTRE_bottom_right_back_room",
    "CENTRE_bottom_right_back_room.001",
    "CENTRE_bottom_right_back_room2",
    "CENTRE_bottom_right_corridor",
    "CENTRE_bottom_right_mid_room",
    "CENTRE_corridor",
    "CENTRE_Entry",
    "CENTRE_Entry_library",
    "CENTRE_Entry_right",
    "CENTRE_Entry_top_right",
    "CENTRE_Entry_top_back_bathroom",
    "CENTRE_Entry_top_back_room",
    "CENTRE_top_left_corridor_centre",
    "CENTRE_top_left_corridor_end",
    "CENTRE_top_left_corridor_entrance",
    "CENTRE_top_left_room1",
    "CENTRE_top_left_room2",
    "CENTRE_top_middle_room",
    "CENTRE_top_right_corridor_end",
    "CENTRE_top_right_corridor_entrance",
    "CENTRE_top_right_corridor_kink",
    "CENTRE_top_right_room_end"
]
# The path where the new, optimized .blend file will be saved.
OUTPUT_FILEPATH = r"C:/Users/user-pc/Documents/mansion-OPTIMIZED.blend"
# ---------------------

# Find the actual center point objects in the scene
centers = [obj for obj in bpy.context.scene.objects if obj.name in CENTER_POINT_NAMES]

if not centers:
    print("Error: No center point Empties found. Please create them and add their names to the script.")
else:
    grouped_objects = {center.name: [] for center in centers}
    all_meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']

    print(f"Processing {len(all_meshes)} mesh objects...")

    # Step 1: Assign each mesh to the nearest center point
    for mesh_obj in all_meshes:
        closest_center = None
        min_dist = float('inf')
        for center in centers:
            dist = (mesh_obj.location - center.location).length
            if dist < min_dist:
                min_dist = dist
                closest_center = center
        if closest_center:
            grouped_objects[closest_center.name].append(mesh_obj)

    print("Finished grouping objects.")

    # Step 2: Join all objects within each group
    for center_name, objects_to_join in grouped_objects.items():
        if not objects_to_join:
            continue

        print(f"Joining {len(objects_to_join)} objects for group '{center_name}'...")
        bpy.context.view_layer.objects.active = objects_to_join[0]
        for obj in bpy.context.selected_objects:
            obj.select_set(False)
        for obj in objects_to_join:
            obj.select_set(True)
        bpy.ops.object.join()
        bpy.context.active_object.name = f"MERGED_{center_name}"

    # Step 3: Save the result as a new .blend file
    print(f"Saving consolidated file to: {OUTPUT_FILEPATH}")
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_FILEPATH)

    print("--- Script Finished! ---")