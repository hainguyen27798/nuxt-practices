"""Build the reference-inspired robot in Blender and export its articulated GLB.

Run: /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python scripts/build-robot.py
Blender uses Z up; glTF export converts the named pivots to Y up for Three.js.
"""

from pathlib import Path
from math import copysign, cos, pi, sin

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'models' / 'robot'
EXPORT = ROOT / 'public' / 'models' / 'robot'
SOURCE.mkdir(parents=True, exist_ok=True)
EXPORT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = 0.45
    shader.inputs['Roughness'].default_value = 0.5
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = emission
    return mat


shell = material('Oxide armor', (0.451, 0.063, 0.028))  # sRGB #b3472f
joint = material('Joint graphite', (0.018, 0.015, 0.014))
inset = material('Recess black', (0.003, 0.002, 0.002))
trim = material('Copper seams', (0.451, 0.063, 0.028), 0.4)
eye = material('Optic light', (1.0, 0.41, 0.23), 1.4)


def empty(name, position=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = position
    obj.empty_display_type = 'PLAIN_AXES'
    return obj


def finish(obj, name, mat, parent, bevel=0):
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Machined edge', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.parent = parent
    return obj


def box(name, position, size, parent, mat=shell, bevel=0.05):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, parent, bevel)


def cylinder(name, position, radius, length, parent, mat=joint, axis=(0, 0, 1)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=length, location=position)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized())
    finish(obj, name, mat, parent, 0.012)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj


def sphere(name, position, radius, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=radius, location=position)
    obj = finish(bpy.context.object, name, joint, parent)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def seam(name, points, parent, radius=0.009, mat=trim):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    curve.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj


def hull(name, rings, parent, mat=shell):
    vertices = []
    count = 32
    for z, x, y in rings:
        for index in range(count):
            angle = index * 2 * pi / count
            a, b = cos(angle), sin(angle)
            vertices.append((x * copysign(abs(a) ** .55, a),
                             y * copysign(abs(b) ** .55, b), z))
    faces = [tuple(reversed(range(count)))]
    for row in range(len(rings) - 1):
        for col in range(count):
            a = row * count + col
            b = row * count + (col + 1) % count
            faces.append((a, b, b + count, a + count))
    faces.append(tuple(range(len(vertices) - count, len(vertices))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    subdivision = obj.modifiers.new('Continuous shell curvature', 'SUBSURF')
    subdivision.levels = 2
    subdivision.render_levels = 2
    return obj


def ring(name, position, radius, tube, parent, mat=joint, axis=(0, 0, 1)):
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=10,
                                    location=position, major_radius=radius, minor_radius=tube)
    obj = bpy.context.object
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(axis).normalized())
    finish(obj, name, mat, parent)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def bolt(name, position, parent, axis=(0, -1, 0), radius=.024):
    obj = cylinder(name, position, radius, .018, parent, joint, axis)
    slot = box(name + ' drive', (0, 0, .012), (radius, .006, .006), obj, inset, .002)
    return obj


def plate(name, outline, depth, parent, mat=shell, bevel=.025):
    # Extruded X/Z profile; the front is towards negative Y.
    count = len(outline)
    vertices = [(x, y, z) for y in [-depth / 2, depth / 2] for x, z in outline]
    faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for i in range(count):
        j = (i + 1) % count
        faces.append((i, i + count, j + count, j))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    return finish(obj, name, mat, parent, bevel)


robot = empty('Robot')
# A cropped shoulder/chest bust, with a finished lower edge rather than a waist or arms.
hull('Thoracic chassis', [(0, .67, .26), (.08, .80, .33), (.42, 1.13, .41),
                         (.76, 1.30, .42), (.96, 1.19, .38), (1.12, .68, .31)], robot, joint)
for side in [-1, 1]:
    chest = plate('Pectoral armor', [(.055, .22), (.63, .19), (1.15, .58),
                                    (1.17, .86), (.64, 1.045), (.12, .89)], .11, robot)
    chest.scale.x = side
    chest.location.y = -.414
    shoulder = hull('Shoulder cap', [(.50, .25, .27), (.62, .33, .32),
                                     (.83, .32, .31), (.98, .21, .25)], robot)
    shoulder.location.x = side * 1.10
    shoulder.rotation_euler.y = side * -.19
    seam('Clavicle inlay', [(side * .17, -.488, .87), (side * .64, -.483, .98),
                           (side * 1.05, -.477, .83)], robot, .005)
    seam('Chest lower seam', [(side * .16, -.484, .28), (side * .60, -.485, .27),
                              (side * .98, -.484, .57)], robot, .004)
    for index in range(7):
        x = side * (.59 + index * .052)
        vent = box('Chest intake', (x, -.477, .58), (.018, .018, .18), robot, inset, .006)
        vent.rotation_euler.y = side * -.35
    for x, z in [(.16, .78), (.63, .88), (.88, .43)]:
        bolt('Chest fastener', (side * x, -.482, z), robot)
    cylinder('Shoulder blanking cap', (side * 1.25, 0, .72), .19, .08, robot, joint, (1, 0, 0))
    ring('Shoulder seal', (side * 1.295, 0, .72), .145, .012, robot, trim, (1, 0, 0))

spine = plate('Sternum cover', [(-.065, .10), (.065, .10), (.11, .65),
                               (.075, .92), (-.075, .92), (-.11, .65)], .12, robot, joint, .02)
spine.location.y = -.443
box('Service badge', (0, -.517, .62), (.082, .025, .20), robot, shell, .012)
for z in [.58, .63, .68]:
    box('Service indicator', (0, -.533, z), (.045, .008, .009), robot, trim, .002)
hull('Bust lower rim', [(0, .67, .27), (.055, .76, .32), (.105, .81, .34)], robot, shell)

# Short gimbal neck seated inside the collar. Ball joints overlap their bearing races.
cylinder('Collar plinth', (0, 0, 1.09), .44, .16, robot, joint)
ring('Collar armor lip', (0, 0, 1.16), .385, .055, robot, shell)
ring('Collar inner seal', (0, 0, 1.19), .276, .024, robot, inset)
for index in range(8):
    angle = index * pi / 4
    bolt('Collar bolt', (.368 * cos(angle), .368 * sin(angle), 1.204), robot, (0, 0, 1), .019)
neck = empty('NeckPivot', (0, 0, 1.20), robot)
sphere('Neck spherical bearing', (0, 0, .035), .24, neck)
cylinder('Neck actuator', (0, 0, .15), .19, .22, neck, joint)
for z in [.08, .13, .18, .23]:
    ring('Neck bellows', (0, 0, z), .207, .019, neck, inset)
for side in [-1, 1]:
    cylinder('Neck trunnion', (side * .218, 0, .17), .081, .05, neck, shell, (1, 0, 0))
    cylinder('Neck trunnion center', (side * .247, 0, .17), .04, .018, neck, joint, (1, 0, 0))
head = empty('HeadPivot', (0, 0, .29), neck)
sphere('Skull socket', (0, 0, -.02), .215, head)
ring('Skull bearing seal', (0, 0, .015), .23, .025, head, joint)

# Rounded helmet envelope, with independent crown, visor, cheeks and rear casing.
hull('Helmet core', [(.035, .245, .25), (.16, .37, .34), (.35, .50, .42),
                    (.62, .57, .47), (1.00, .58, .47), (1.22, .51, .41),
                    (1.35, .35, .29), (1.38, .19, .17)], head, joint)
hull('Crown shell', [(1.045, .588, .478), (1.17, .56, .45),
                    (1.30, .445, .37), (1.395, .27, .23), (1.415, .12, .12)], head)
hull('Brow gasket', [(1.013, .59, .48), (1.055, .59, .48)], head, inset)
# The visor is inset between the crown and cheek armor; curved corners avoid a box face.
visor = box('Optical visor', (0, -.467, .883), (1.012, .095, .245), head, inset, .10)
seam('Upper visor reveal', [(-.46, -.49, 1.003), (-.34, -.516, 1.017),
                            (0, -.52, 1.02), (.34, -.516, 1.017), (.46, -.49, 1.003)], head, .006)
seam('Lower visor reveal', [(-.45, -.49, .778), (-.29, -.514, .758),
                            (0, -.52, .75), (.29, -.514, .758), (.45, -.49, .778)], head, .005)
for side in [-1, 1]:
    box('Optic housing', (side * .218, -.521, .889), (.305, .022, .075), head, joint, .028)
    box('Optic slit', (side * .218, -.538, .889), (.232, .014, .024), head, eye, .01)
    for index in range(3):
        box('Optic divider', (side * .218 + (index - 1) * .05, -.548, .889),
            (.006, .008, .031), head, inset, .002)
    cheek = plate('Cheek armor', [(.10, .22), (.32, .17), (.49, .43),
                                  (.53, .69), (.37, .747), (.17, .55)], .07, head, shell, .04)
    cheek.scale.x = side
    cheek.location.y = -.419
    seam('Cheek inset', [(side * .22, -.46, .32), (side * .38, -.46, .48),
                         (side * .42, -.46, .64)], head, .004)
    for x, z in [(.36, .31), (.46, .64)]:
        bolt('Cheek screw', (side * x, -.461, z), head, radius=.017)
    # Circular side actuators, with a recessed center and fastened outer race.
    cylinder('Auditory gasket', (side * .574, .02, .76), .266, .052, head, inset, (1, 0, 0))
    cylinder('Auditory shell', (side * .612, .02, .76), .237, .082, head, shell, (1, 0, 0))
    ring('Auditory outer ring', (side * .659, .02, .76), .193, .012, head, trim, (1, 0, 0))
    cylinder('Auditory inner recess', (side * .665, .02, .76), .167, .015, head, inset, (1, 0, 0))
    cylinder('Auditory center', (side * .681, .02, .76), .100, .027, head, joint, (1, 0, 0))
    ring('Auditory core ring', (side * .70, .02, .76), .066, .007, head, trim, (1, 0, 0))
    for index in range(6):
        angle = index * pi / 3
        bolt('Auditory fastener', (side * .665, .02 + .212 * cos(angle), .76 + .212 * sin(angle)),
             head, (side, 0, 0), .015)
    for index in range(5):
        z = .36 + index * .046
        box('Temple louver', (side * .514, .02, z), (.018, .24, .018), head, inset, .005)
    seam('Crown longitudinal seam', [(side * .19, -.431, 1.227),
                                     (side * .18, -.35, 1.324), (side * .10, -.20, 1.406),
                                     (side * .10, .20, 1.406)], head, .004)
    bolt('Brow screw', (side * .48, -.41, 1.12), head, radius=.016)

jaw = plate('Mandible', [(-.29, .14), (0, .08), (.29, .14), (.31, .26),
                         (.19, .34), (-.19, .34), (-.31, .26)], .11, head, shell, .04)
jaw.location.y = -.339
face = plate('Central face shield', [(-.12, .29), (.12, .29), (.16, .48),
                                    (.11, .71), (-.11, .71), (-.16, .48)], .075, head, joint, .025)
face.location.y = -.442
for index in range(4):
    box('Voice grille', (0, -.489, .36 + index * .036), (.15 + index * .013, .014, .012),
        head, inset, .004)
box('Nose sensor', (0, -.487, .637), (.075, .025, .09), head, inset, .022)
cylinder('Nose optic', (0, -.508, .65), .017, .012, head, trim, (0, 1, 0))
for side in [-1, 1]:
    box('Rear cooling spine', (side * .23, .415, .91), (.16, .075, .39), head, shell, .04)
    for index in range(6):
        box('Rear vent', (side * .23, .46, .78 + index * .05), (.11, .018, .019), head, inset, .004)

# Save an editable Blender source and only the articulated robot asset for the browser.
bpy.context.scene.world.color = (.025, .018, .016)
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.shading.type = 'MATERIAL'
        area.spaces.active.region_3d.view_distance = 5
        area.spaces.active.region_3d.view_location = (0, 0, 1.5)
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = robot
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'robot.blend'))
bpy.ops.export_scene.gltf(filepath=str(EXPORT / 'robot.glb'), export_format='GLB',
                          use_selection=True, export_yup=True, export_apply=True)
print('Detailed bust exported: no arms, no lower body, short articulated neck.')
