"""Cephalo-Silk export package: optional Blender visualization setup.

Blender >= 3.6 recommended; no third-party Blender plugins.
 blender -b --python open_in_blender.py -- /path/to/extracted/package --render
 blender -b --python open_in_blender.py -- /path/to/extracted/package --turntable

The only animation produced here is camera motion, NOT mechanics simulation.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector


def arguments():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    base = Path(argv[0]).expanduser().resolve() if argv and not argv[0].startswith('--') else Path(__file__).resolve().parent
    return base, '--render' in argv, '--turntable' in argv


def material(name, hexcolor, metallic=0.05, roughness=0.72, opacity=1):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    hexcolor = hexcolor.strip('#')
    try:
        vals = [int(hexcolor[i:i+2], 16)/255 for i in (0, 2, 4)]
    except (ValueError, IndexError):
        vals = [0.65, 0.75, 0.8]
    mat.diffuse_color = (*vals, opacity)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*vals, 1)
        bsdf.inputs['Alpha'].default_value = opacity
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
    return mat


def collection(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in {i.name for i in bpy.context.scene.collection.children}:
        bpy.context.scene.collection.children.link(c)
    return c


def move(obj, target):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    target.objects.link(obj)


def gltf_y_up_to_blender(p):
    """Same right-handed Y-up -> Blender Z-up convention as Blender's glTF importer."""
    return (p[0], -p[2], p[1])


def reconstruct_visuals(base, into, include_hidden=False):
    fp = base / 'visual_layers.json'
    if not fp.exists():
        return {'objects': 0, 'curves': 0, 'meshes': 0}
    doc = json.loads(fp.read_text())
    count = {'objects': 0, 'curves': 0, 'meshes': 0}
    for i, item in enumerate(doc['items']):
        if not item.get('visible', True) and not include_hidden:
            continue
        vertices = item['vertices']
        points = [gltf_y_up_to_blender(vertices[j:j+3]) for j in range(0, len(vertices), 3)]
        indices = item.get('indices', list(range(len(points))))
        name = item.get('name', f'visual_{i}')
        if item['kind'] == 'mesh':
            if len(indices) % 3:
                raise ValueError(f'Visual triangle indexing invalid: {name}')
            mesh = bpy.data.meshes.new(name)
            mesh.from_pydata(points, [], [indices[j:j+3] for j in range(0,len(indices),3)])
            mesh.update()
            obj = bpy.data.objects.new(name, mesh)
            obj.data.materials.append(material('Visual: ' + item.get('color', '#90a4ae'), '#d4d7d8', opacity=item.get('opacity',1)))
            count['meshes'] += 1
        else:
            curve = bpy.data.curves.new(name, 'CURVE');curve.dimensions = '3D';curve.resolution_u = 2
            # Viewport lines are strokes rather than analytical bar sections.
            curve.bevel_depth = 0.008 if name.startswith('pavilion/') else 0.025
            curve.resolution_u = 1;curve.bevel_resolution = 2
            paths = [indices[j:j+2] for j in range(0,len(indices)-1,2)] if item['kind']=='segments' else [indices]
            for path in paths:
                if len(path) < 2:
                    continue
                spline = curve.splines.new('POLY')
                spline.points.add(len(path)-1)
                for n, idx in enumerate(path):
                    p = points[idx]
                    spline.points[n].co = (p[0],p[1],p[2],1)
            obj = bpy.data.objects.new(name,curve)
            obj.data.materials.append(material('Visual line: ' + item.get('color','#90a4ae'),'#667a82'))
            count['curves'] += 1
        into.objects.link(obj)
        count['objects'] += 1
    return count


def frame_camera(camera, objects):
    coords = []
    for obj in objects:
        if obj.type not in ('MESH','CURVE'):
            continue
        coords.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not coords:
        return
    lo = Vector([min(p[i] for p in coords) for i in range(3)])
    hi = Vector([max(p[i] for p in coords) for i in range(3)])
    center = (lo+hi)/2
    span = max((hi-lo).length,0.01)
    direction = Vector((.85, -1.7, .9)).normalized()
    camera.rotation_euler = (-direction).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'PERSP'
    camera.data.lens = 52
    camera.data.sensor_width = 36
    camera.data.clip_start = .01
    camera.data.clip_end = max(2000.0, span * 12)
    # Fit all imported member surfaces using the final aspect ratio and camera rotation.
    aspect = bpy.context.scene.render.resolution_x / bpy.context.scene.render.resolution_y
    tan_x = camera.data.sensor_width / (2 * camera.data.lens)
    tan_y = tan_x / aspect
    inverse = camera.rotation_euler.to_quaternion().inverted()
    projected = [inverse @ (p-center) for p in coords]
    distance = max(p.z + max(abs(p.x)/(tan_x*.88), abs(p.y)/(tan_y*.88)) for p in projected)
    camera.location = center + direction * distance
    return center


def light(name, location, energy, size):
    data = bpy.data.lights.new(name,'AREA');data.energy = energy;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(obj);obj.location=location
    obj.rotation_euler = (Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


def validate_import(base,meta,objects):
    model=json.loads((base/'structural_model.json').read_text())
    members={m['id']:m for m in model['members']}
    seen=[];max_error=0.;groups={}
    for obj in objects:
        if obj.name.startswith('visual_'): continue
        if 'member' in obj:
            ids=[obj['member']]
            m=members[ids[0]]
            lo=min(v.co.z for v in obj.data.vertices);hi=max(v.co.z for v in obj.data.vertices)
            ends=[obj.matrix_world@Vector((0,0,lo)),obj.matrix_world@Vector((0,0,hi))]
            expected=[Vector(gltf_y_up_to_blender(model['nodes'][m[k]]['position'])) for k in ('a','b')]
            error=min(max((ends[i]-expected[i]).length for i in (0,1)),max((ends[i]-expected[1-i]).length for i in (0,1)))
            max_error=max(max_error,error)
            key=m['system']
        else:
            ids=list(obj.get('original_member_ids',[]))
            if not ids: raise ValueError('Missing analytical member IDs: '+obj.name)
            # glTF may split vertices by normal; read unique POSITION accessor in GLB below.
            key=obj.name.replace('Structural_','')
        seen.extend(ids);groups[key]=groups.get(key,0)+len(ids)
    assert sorted(seen)==sorted(members), 'Missing or duplicated structural members'
    assert groups==meta['structural']['groupCounts'], (groups,meta['structural']['groupCounts'])
    assert max_error<3e-5, ('Bridge member endpoint/axis/scale error',max_error)
    # Re-read glTF POSITION records and compare actual imported grouped mesh vertices.
    if meta['case_id']!='bridge':
        for obj in objects:
            ids=list(obj.get('original_member_ids',[]))
            if not ids: continue
            # Importer keeps vertex order for the position-only grouped cylinders.
            assert len(obj.data.vertices)==20*len(ids), 'Unexpected imported member tessellation'
            for k,mid in enumerate(ids):
                m=members[mid]
                for end,node_id in enumerate(m['nodes']):
                    ring=[obj.matrix_world@obj.data.vertices[k*20+end*10+j].co for j in range(10)]
                    center=Vector([math.fsum(p[axis] for p in ring)/10 for axis in range(3)])
                    expected=Vector(gltf_y_up_to_blender(model['nodes'][node_id]['position']))
                    max_error=max(max_error,(center-expected).length)
        assert max_error<3e-5, ('Imported endpoint/axis/scale error',max_error)
    report={'case':meta['case_id'],'blender':bpy.app.version_string,'members':len(seen),'nodes_in_source':len(model['nodes']),
            'groups':groups,'max_endpoint_error_m':max_error,'scale_length':bpy.context.scene.unit_settings.scale_length,
            'axis_mapping':'x,-z,y','member_coverage':'every member imported exactly once','status':'pass'}
    (base/'blender-import-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('CEPHALO_IMPORT_AUDIT',json.dumps(report))


def publication_settings(scene):
    """Consistent neutral illumination and white figure background; geometry unchanged."""
    background=scene.world.node_tree.nodes.get('Background')
    if background:
        background.inputs['Color'].default_value=(.8,.8,.8,1)
        background.inputs['Strength'].default_value=.8
    analytical=bpy.data.collections.get('01 | Analytical members')
    if analytical:
        for obj in analytical.objects:
            system=obj.get('system',obj.name.replace('Structural_',''))
            color='#44392a' if system in ('web','cable_web') else '#243b46' if system in ('primary_arch','arch','tower') else '#4b5e66'
            obj.data.materials.clear();obj.data.materials.append(material('Publication '+str(system),color))
    scene.render.engine='CYCLES'
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    scene.view_settings.exposure=0;scene.view_settings.gamma=1
    scene.cycles.samples=64;scene.cycles.use_denoising=False
    scene.render.film_transparent=True
    scene.render.image_settings.color_mode='RGBA'
    if bpy.app.version >= (5, 0, 0):
        # Blender 5 removed the legacy compositor scene.node_tree and
        # CompositorNodeComposite. Use an opaque, neutral-white world instead.
        # This changes only presentation, never imported scientific geometry.
        scene.render.use_compositing = False
        scene.render.film_transparent = False
        scene.render.image_settings.color_mode = 'RGB'
        if background:
            background.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
            background.inputs['Strength'].default_value = 0.8
        return
    scene.use_nodes=True
    tree=scene.node_tree;tree.nodes.clear()
    layer=tree.nodes.new('CompositorNodeRLayers')
    over=tree.nodes.new('CompositorNodeAlphaOver');over.inputs[0].default_value=1
    over.inputs[1].default_value=(1,1,1,1)
    tree.links.new(layer.outputs['Image'],over.inputs[2])
    out=tree.nodes.new('CompositorNodeComposite');tree.links.new(over.outputs['Image'],out.inputs['Image'])


def main():
    base, do_render, turntable = arguments()
    meta = json.loads((base/'metadata.json').read_text())
    assert meta['case_id'] in ('bridge','loop-towers','pavilion')
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.import_scene.gltf(filepath=str(base/'scene.glb'))
    # Move imported scientific geometry without modifying original mesh coordinates.
    structural = collection('01 | Analytical members')
    bridge_visuals = collection('02 | Canonical Bridge display only')
    imported = [o for o in bpy.context.scene.objects if o.type in {'MESH','CURVE'}]
    for obj in imported:
        visual = obj.name.startswith('visual_')
        move(obj,bridge_visuals if visual else structural)
        obj['scientific_role'] = 'display only' if visual else 'analytical member surface'
        # Preserve topology and coordinates; only presentation materials are changed.
        system = obj.get('system', obj.name.replace('Structural_', ''))
        color = '#9c8464' if system in ('web','cable_web') else '#576f79' if system in ('primary_arch','arch','tower') else '#87969d'
        if visual: color='#cbd0d2'
        obj.data.materials.clear()
        obj.data.materials.append(material('Publication '+str(system),color))
    validate_import(base,meta,imported)
    for index,obj in enumerate(imported):
        if obj.name.startswith('visual_') and obj.type=='MESH' and not obj.data.polygons and obj.data.edges:
            mesh=obj.data;curve=bpy.data.curves.new(obj.name+' strokes','CURVE');curve.dimensions='3D';curve.bevel_depth=.012;curve.bevel_resolution=1
            for edge in mesh.edges:
                spline=curve.splines.new('POLY');spline.points.add(1)
                for j,idx in enumerate(edge.vertices):spline.points[j].co=(*mesh.vertices[idx].co,1)
            for mat in mesh.materials:curve.materials.append(mat)
            strokes=bpy.data.objects.new(obj.name+' strokes',curve);bridge_visuals.objects.link(strokes)
            strokes.matrix_world=obj.matrix_world.copy();strokes['scientific_role']='display-only line strokes'
            imported[index]=strokes
            bpy.data.objects.remove(obj,do_unlink=True)
    bpy.context.view_layer.update()
    visuals = collection('02 | Captured display surfaces and woven lines')
    visual_info = reconstruct_visuals(base,visuals)
    # Mark separately in Blender so the viewer cannot confuse display with stiffness.
    visuals['scientific_role'] = 'visual meshes/lines only; NOT shell/cable finite elements'
    structural['scientific_role'] = 'GLB geometry from source structural nodes/members or original renderer'
    cam_data=bpy.data.cameras.new('Publication camera');cam=bpy.data.objects.new('Publication camera',cam_data)
    bpy.context.scene.collection.objects.link(cam);bpy.context.scene.camera=cam
    bpy.context.scene.render.resolution_x=3000;bpy.context.scene.render.resolution_y=2100
    bpy.context.view_layer.update()
    center=frame_camera(cam, imported+list(visuals.objects)) or Vector((0,0,0))
    for obj in [cam]: obj['case_id']=meta['case_id']
    bbox = max((obj.dimensions.length for obj in list(structural.objects)+list(visuals.objects)),default=10)
    distance=max(20,bbox*2)
    for name,pos,energy in [('Key',(1,-1,2),3500),('Fill',(-1,-.5,1),2200),('Rim',(-.5,1,2),4500)]:
        source=center+Vector(pos)*distance
        lamp=light(name,source,energy*max(distance/30,1)**2,max(distance*.75,5))
        lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler()
    world=bpy.data.worlds.new('Neutral studio') if not bpy.data.worlds else bpy.data.worlds[0]
    bpy.context.scene.world=world;world.use_nodes=True
    background=world.node_tree.nodes.get('Background')
    if background: background.inputs['Color'].default_value=(0.11,0.14,0.18,1);background.inputs['Strength'].default_value=.6
    scene=bpy.context.scene
    scene.render.engine='CYCLES'  # publication_settings() uses Cycles; works on Blender 4.x/5.x
    scene.render.resolution_x=3000;scene.render.resolution_y=2100;scene.render.resolution_percentage=100
    scene.cycles.samples=64;scene.cycles.use_denoising=False
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
    scene.render.filepath='//'+meta['case_id']+'-render.png'
    if turntable:
        # Cosmetic camera orbit only: no structural-state interpolation or time-varying solver data.
        pivot=bpy.data.objects.new('Camera-only turntable pivot',None)
        bpy.context.scene.collection.objects.link(pivot);pivot.location=center
        cam.parent=pivot;cam.matrix_parent_inverse=pivot.matrix_world.inverted()
        pivot.rotation_euler[2]=0;pivot.keyframe_insert(data_path='rotation_euler',index=2,frame=1)
        pivot.rotation_euler[2]=2*math.pi;pivot.keyframe_insert(data_path='rotation_euler',index=2,frame=120)
        scene.frame_start=1;scene.frame_end=120
        for fcurve in pivot.animation_data.action.fcurves:
            for kp in fcurve.keyframe_points: kp.interpolation='LINEAR'
    publication_settings(scene)
    target=base/(meta['case_id']+'-studio.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
    print('CEPHALO_BLENDER_IMPORT_OK',json.dumps({'case':meta['case_id'],'imported_objects':len(imported),'visuals':visual_info,'blend':str(target)}))
    if do_render:
        bpy.ops.render.render(write_still=True)
        print('CEPHALO_BLENDER_RENDER_OK',scene.render.filepath)

if __name__=='__main__': main()
