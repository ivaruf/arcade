"""NeonFox arena overlook; real fox/orb model from the trailblazers game.
The miniature arena is on the north side, clear of the southeast arrival lane.
"""
NX,NY,NZ=NEONFOX['x'],NEONFOX['y'],NEONFOX['z']
beacon('Neonfox',NEONFOX,cyan,5.4)
arena=material('NeonFox midnight arena',(.018,.035,.07),.12,0,.62)
railmat=material('NeonFox silver rail',(.29,.39,.46),.4,0,.4)
foxcyan=material('NeonFox cyan trail',(.04,.7,.86),.15,.65,.38)
foxpink=material('NeonFox pink trail',(.9,.12,.43),.15,.65,.38)
AX,AZ=NX+.5,NZ-3.4
box('NeonFox arena plinth',(AX,NY+.13,AZ),(9,.26,2.8),arena,.12)
for dz in [-1.35,1.35]:
    box('NeonFox arena boundary',(AX,NY+.31,AZ+dz),(8.9,.1,.07),railmat,.025)
    tube('NeonFox arena boundary light',[(AX-4.3,NY+.375,AZ+dz),(AX+4.3,NY+.375,AZ+dz)],.014,foxcyan)
for dx in [-4.4,4.4]:box('NeonFox arena end',(AX+dx,NY+.31,AZ),(.08,.1,2.7),railmat,.025)
for i in range(17):box('NeonFox arena grid',(AX-4+i*.5,NY+.266,AZ),(.012,.008,2.5),railmat,.001)
for dz in [-1,-.5,0,.5,1]:box('NeonFox arena grid',(AX,NY+.266,AZ+dz),(8.5,.008,.012),railmat,.001)
for name,points,mat in [
    ('Cyan',[(-22,-22.1),(-21.5,-21.7),(-21.0,-21.4),(-20.4,-21.4),(-20,-21.65)],foxcyan),
    ('Pink',[(-14.5,-22.3),(-15,-22.2),(-15.7,-21.8),(-16.2,-21.3),(-16.6,-21.6)],foxpink)]:
    tube('NeonFox '+name+' trail',[(x,NY+.32,z) for x,z in points],.045,mat)
# Freeze the game's model in its authored pose and simplify it for a small diorama.
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(OUT/'source'/'neonfox'/'fox-detailed.glb'))
imported=set(bpy.data.objects)-before
bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();frozen=[]
for original in imported:
    if original.type!='MESH':continue
    data=bpy.data.meshes.new_from_object(original.evaluated_get(deps),depsgraph=deps)
    o=bpy.data.objects.new('NeonFox rider '+original.name,data);bpy.context.collection.objects.link(o)
    o.matrix_world=original.matrix_world.copy();frozen.append(o)
    if len(data.polygons)>1000:
        mod=o.modifiers.new('Diorama detail','DECIMATE');mod.ratio=.30
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for o in imported:bpy.data.objects.remove(o,do_unlink=True)
for o in frozen:
    for m in o.data.materials:
        if m and m.use_nodes:
            shader=m.node_tree.nodes.get('Principled BSDF')
            if shader:
                shader.inputs['Emission Strength'].default_value=min(shader.inputs['Emission Strength'].default_value,.20)
                shader.inputs['Metallic'].default_value=min(shader.inputs['Metallic'].default_value,.25)
bpy.context.view_layer.update()
points=[o.matrix_world@Vector(c) for o in frozen for c in o.bound_box]
lo=Vector([min(p[a] for p in points) for a in range(3)]);hi=Vector([max(p[a] for p in points) for a in range(3)])
center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=1.85/(hi.z-lo.z)
for i,(x,z,yaw) in enumerate([(-20,-21.65,-.55),(-16.6,-21.6,2.6)]):
    pivot=bpy.data.objects.new('NeonFox fox on orb '+str(i),None);bpy.context.collection.objects.link(pivot);pivot.parent=root
    for source in frozen:
        o=source if i==0 else source.copy()
        if i: bpy.context.collection.objects.link(o)
        o.parent=pivot
        if i==0:o.location-=center
    pivot.location=bl(x,NY+.29,z);pivot.scale=(scale,)*3;pivot.rotation_euler.z=yaw
# Small illuminated chevrons lead inward rather than putting a sign in the doorway.
for x in [-14.8,-16.0,-17.2]:
    for side in [-1,1]:
        beam('NeonFox approach arrow',(x,NY+.012,-16.6),(x+.30,NY+.012,-16.6+side*.23),.025,foxcyan)
print('NEONFOX_ISLAND_COMPLETE')
