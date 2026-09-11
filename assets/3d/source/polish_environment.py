"""Environment finishing pass, executed by build_clouds.py before export.
Keeps the five platform positions and all existing furniture footprints.
Fish GLBs are local source copies from the sibling Fishtank project.
"""
from mathutils import Vector

def remove(prefix):
    for o in list(root.children_recursive):
        if o.name.startswith(prefix):bpy.data.objects.remove(o,do_unlink=True)

def paint(o,mat):o.data.materials.clear();o.data.materials.append(mat)

def tube(name,points,r,mat,closed=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=r;c.bevel_resolution=3
    s=c.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*bl(*co),1)
    s.use_cyclic_u=closed
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.parent=root;c.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
    return bpy.context.object

def beam(name,a,b,width,mat):
    a,b=Vector(bl(*a)),Vector(bl(*b));bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2)
    o=bpy.context.object;o.dimensions=(width,width,(b-a).length);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();finish(o,name,mat)
    m=o.modifiers.new('Rounded joinery','BEVEL');m.width=.015;m.segments=3;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o

def ring(name,pos,r,minor,mat,axis='y'):
    rot={'y':(0,0,0),'z':(math.pi/2,0,0),'x':(0,math.pi/2,0)}[axis]
    bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=8,location=bl(*pos),major_radius=r,minor_radius=minor,rotation=rot)
    o=finish(bpy.context.object,name,mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

def glass(name,color,alpha):
    m=material(name,color,0,0,.16);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Alpha'].default_value=alpha
    m.diffuse_color=(*color,alpha);m.surface_render_method='DITHERED';m.use_transparency_overlap=False
    return m

wood=material('Warm oiled cedar',(.32,.155,.065),0,0,.52)
woodlight=material('Cedar end grain',(.47,.26,.11),0,0,.6)
brass=material('Satin champagne trim',(.48,.34,.16),.24,0,.32)
ceramic=material('Porcelain enamel',(.71,.78,.75),.12,0,.27)
structural=material('Deep petrol powder coat',(.035,.105,.115),.16,0,.4)
stone=material('Warm sandstone',(.48,.40,.29),0,0,.8)
foliage=material('Jade leaves',(.07,.22,.12),0,0,.65)
foliagelight=material('Sage leaf tips',(.23,.38,.16),0,0,.6)
glazing=glass('Clear aquarium glazing',(.65,.88,.92),.075)
roofglass=glass('Smoked pavilion glazing',(.35,.65,.67),.18)
# Large surfaces have real shading; only narrow lights emit.
for m in [cloudy,cloud_under,glassy,water]:m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=0
cloudy.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85
cloud_under.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.68,.77,.88,1)

cloudskin=material('Cloud soft shading',(.95,.97,1),0,0,.86)
color_node=cloudskin.node_tree.nodes.new('ShaderNodeVertexColor');color_node.layer_name='CloudTint'
cloudskin.node_tree.links.new(color_node.outputs['Color'],cloudskin.node_tree.nodes['Principled BSDF'].inputs['Base Color'])

# Sculpt a closed, scalloped cloud island around each unchanged collision
# rectangle. A broad top rolls into rounded billows, never a paper-thin slab.
bpy.context.view_layer.update()
for tag,d in zip(['Welcome','Race','Water','Mine','Calm'],DECKS):
    x,y,z,hx,hz=[d[k] for k in ('x','y','z','hx','hz')]
    remove(tag+' cloud');remove(tag+' underside')
    verts=[bl(x,y-.055,z)];faces=[];N=128
    rings=[(.16,-.055),(.34,-.055),(.53,-.055),(.70,-.06),(.81,-.06),
           (.90,-.06),(.94,-.06),(.99,-.30),(1.035,-.65),(1.04,-1.05),(.98,-1.55),
           (.9,-1.98),(.75,-2.38),(.52,-2.65),(.25,-2.82)]
    for radius,height in rings:
        for i in range(N):
            a=i*math.tau/N;c=math.cos(a);t=math.sin(a)
            scallop=1+.026*math.sin(9*a+.5)+.018*math.cos(13*a)
            xx=math.copysign(abs(c)**.5,c)*hx*1.3*radius
            zz=math.copysign(abs(t)**.5,t)*hz*1.3*radius
            modulation=max(0,(radius-.75)/.25)
            bulge=1+(scallop-1)*modulation
            yy=y+height+.10*math.sin(9*a)*modulation
            verts.append(bl(x+xx*bulge,yy,z+zz*bulge))
    for i in range(N):faces.append((0,1+i,1+(i+1)%N))
    for r in range(len(rings)-1):
        for i in range(N):
            a=1+r*N+i;b=1+r*N+(i+1)%N;faces.append((a,a+N,b+N,b))
    end=len(verts);verts.append(bl(x,y-2.9,z))
    for i in range(N):faces.append((end,1+(len(rings)-1)*N+(i+1)%N,1+(len(rings)-1)*N+i))
    me=bpy.data.meshes.new(tag+' sculpted cloud');me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(tag+' sculpted cloud',me);bpy.context.collection.objects.link(o);finish(o,o.name,cloudskin)
    colors=me.color_attributes.new(name='CloudTint',type='FLOAT_COLOR',domain='POINT')
    for v,col in zip(me.vertices,colors.data):
        t=min(1,max(0,(y-v.co.z)/2.9))
        col.color=(.94-.25*t,.96-.19*t,.99-.10*t,1)
    for p in me.polygons:p.use_smooth=True
    smooth=o.modifiers.new('Soft cloud contours','SUBSURF');smooth.levels=1;smooth.render_levels=1
    # Remove rock above the walking surface while retaining the hanging outcrop.
    if tag=='Mine':
        for o in list(root.children_recursive):
            if o.name.startswith(('Outcrop','Ore seam')):
                for v in o.data.vertices:
                    if (o.matrix_world@v.co).z>y-.1:v.co.z=(y-.1-o.location.z)/o.scale.z
    # Replace the sharp rectangle of flat emissive bars with a rounded tube.
    remove(tag+' edge')
    pts=[];r=.35
    for cx,cz,starta in [(x+hx-r,z+hz-r,0),(x-hx+r,z+hz-r,90),(x-hx+r,z-hz+r,180),(x+hx-r,z-hz+r,270)]:
        for j in range(9):
            a=math.radians(starta+j*90/8);pts.append((cx+r*math.cos(a),y-.008,cz+r*math.sin(a)))
    tube(tag+' inset landing light',pts,.018,[cyan,gold,cyan,gold,pink][DECKS.index(d)],True)
# Keep decorative clouds from swallowing structures or the flying routes.
for o in list(root.children_recursive):
    if o.name.startswith(('Near cloud','Drifting cloud')):
        gx,gy,gz=-o.location.x,o.location.z,-o.location.y
        if any(abs(gx-d['x'])<d['hx']+4 and abs(gz-d['z'])<d['hz']+4 and gy>d['y']-6 and gy<d['y']+7 for d in DECKS):
            o.location.z=min(d['y']-8 for d in DECKS)

# Correct the sketch's text planes, which sat behind their opaque boards.
for o in list(root.children_recursive):
    if o.name.startswith(('Welcome title','Hint line','Home sign')):o.location.y -= .55

# Arrival architecture: layered sign, curved crest, fitted post shoes.
for o in list(root.children_recursive):
    if o.name.startswith(('Welcome post','Welcome beam','Home post','Home lintel')):paint(o,structural)
for sx in [-3.4,3.4]:
    box('Welcome brass post shoe',(sx,.14,-4.2),(.41,.28,.41),brass,.045)
    box('Welcome inset post light',(sx,1.85,-4.395),(.045,2.6,.025),cyan,.012)
    for yy in [.28,3.2]:cylinder('Post fastening',(sx,yy,-4.414),.045,.025,brass,axis='z')
box('Welcome sign backing',(0,4.0,-4.15),(6.7,1.15,.16),structural,.16)
tube('Welcome curved crown',[(-3.35+6.7*i/32,4.60+.25*math.sin(math.pi*i/32),-4.17) for i in range(33)],.045,brass)
box('Welcome sign lower reveal',(0,3.39,-4.28),(6.65,.045,.055),brass,.012)
for sx in [-2.64,2.64]:box('Hint board edging',(sx,1.5,-4.44),(.045,1.38,.02),brass,.012)
for o in root.children_recursive:
    if o.name=='Welcome title':o.location.z=4.1
    if o.name=='Welcome title2':o.location.z=3.70

# Circular portal threshold, with a warm stone surround instead of square pixels.
remove('Home ring')
ring('Portal threshold',(.0+HOME[0],.015,HOME[2]),1.25,.038,pink)
ring('Portal outer inlay',(HOME[0],-.005,HOME[2]),1.33,.02,brass)

# Slatted benches use the same footprints and heights as the collision boxes.
remove('Welcome bench');remove('Bench leg');remove('Calm bench')
for bx in [-4.6,4.6]:
    for i in range(4):box('Welcome cedar seat',(bx-.255+i*.17,.35,-1),(.15,.13,1.96),wood,.035)
    for bz in [-1.75,-.25]:
        box('Welcome bench trestle',(bx,.17,bz),(.58,.31,.12),structural,.025)
        box('Welcome bench shoe',(bx,.035,bz),(.64,.07,.22),brass,.025)
# Relative to CALM, not written out. These were the one thing on this island
# left at absolute coordinates, so when the island moved the benches stayed
# where it used to be and hung in open sky — while their collision boxes,
# which ARE derived, moved correctly. Everything on an island belongs to the
# island.
for bx in [-2.2,2.2]:
    for i in range(3):box('Calm cedar seat',(CX+bx,CY+.29,CZ+2.2-.18+i*.18),(1.6,.14,.16),wood,.03)
    for dx in [-.6,.6]:box('Calm seat leg',(CX+bx+dx,CY+.12,CZ+2.2),(.12,.24,.46),structural,.025)

# Conservatory: the previous solid luminous roof is now transparent panes
# in a proper structure, with drainage trim, ribs and bolted column bases.
remove('Pavilion roof');remove('Pavilion rim')
for o in list(root.children_recursive):
    if o.name.startswith('Pavilion post'):paint(o,structural)
for dx in [-5.4,5.4]:
    for dz in [-4,4]:box('Pavilion column shoe',(WX+dx,WY+.16,WZ+dz),(.26,.32,.26),brass,.025)
for dz in [-4.2,4.2]:box('Pavilion eave',(WX,WY+3.94,WZ+dz),(11.35,.2,.13),structural,.03)
for dx in [-5.6,5.6]:box('Pavilion gable',(WX+dx,WY+3.94,WZ),(.13,.2,8.5),structural,.03)
for dx in [-5.5,-3.3,-1.1,1.1,3.3,5.5]:
    tube('Pavilion arched rib',[(WX+dx,WY+4.02+.65*math.sin(math.pi*i/24),WZ-4.2+8.4*i/24) for i in range(25)],.055,structural)
# Curved roof tessellation, separately framed panes.
for ix in range(5):
    for iz in range(8):
        vs=[]
        for u,v in [(0,0),(1,0),(1,1),(0,1)]:
            xx=WX-5.5+(ix+u)*2.2;zz=WZ-4.2+(iz+v)*1.05
            yy=WY+4.02+.65*math.sin(math.pi*(iz+v)/8)
            vs.append(bl(xx,yy,zz))
        me=bpy.data.meshes.new('Canopy pane');me.from_pydata(vs,[],[(0,1,2,3)]);me.update()
        o=bpy.data.objects.new('Canopy pane',me);bpy.context.collection.objects.link(o);finish(o,o.name,roofglass)
for dz in [-4.2,4.2]:tube('Pavilion fine light',[(WX-5.5,WY+3.91,WZ+dz),(WX+5.5,WY+3.91,WZ+dz)],.016,cyan)

# Aquarium: keep tank footprint, replace opaque water and broad end slabs.
remove('Tank water');remove('Tank frame');remove('Tank weed');remove('Bubble')
TX=WX-3.6
for yy in [WY+.46,WY+3.55]:
    for dx in [-1,1]:box('Aquarium long frame',(TX+dx,yy,WZ),(.09,.13,7.45),structural,.025)
    for dz in [-3.68,3.68]:box('Aquarium end frame',(TX,yy,WZ+dz),(2.08,.13,.09),structural,.025)
for dx in [-.98,.98]:
    for dz in [-3.63,3.63]:box('Aquarium corner',(TX+dx,WY+2,WZ+dz),(.065,3.1,.065),brass,.012)
for dx in [-.96,.96]:box('Aquarium clear side',(TX+dx,WY+2,WZ),(.012,3.02,7.18),glazing,0)
for dz in [-3.6,3.6]:box('Aquarium clear end',(TX,WY+2,WZ+dz),(1.92,3.02,.012),glazing,0)
box('Water surface',(TX,WY+3.43,WZ),(1.90,.012,7.16),glazing,0)
for dx in [-.83,.83]:tube('Aquarium light bar',[(TX+dx,WY+3.44,WZ-3.45),(TX+dx,WY+3.44,WZ+3.45)],.018,cyan)
for dz in [-2.6,-.9,.9,2.6]:
    for k in range(4):
        px=TX-.42+k*.24;h=.55+(k%3)*.27
        tube('Aquatic leaf',[(px+.1*math.sin(i*.45+k),WY+.73+h*i/8,WZ+dz+.08*math.sin(i*.7)) for i in range(9)],.045,foliage)
    sphere('Aquarium river stone',(TX+.2,WY+.79,WZ+dz),.24,stone,scale=(1.6,.55,1),segs=20)
# The actual Fishtank meshes, normalized individually and kept static in this GLB.
fish_dir=OUT/'source'/'fishtank'
for idx,(filename,length,dx,yy,dz) in enumerate([
 ('clownfish',.75,.20,1.45,-2.55),('blue-tang',1.05,.10,2.5,-1.5),
 ('angelfish',.9,.05,1.85,-.25),('royal-gramma',.8,.18,2.5,1.25),
 ('clownfish',.65,-.1,1.3,2.35),('blue-tang',.85,.2,2.7,2.65)]):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(fish_dir/(filename+'.glb')))
    imported=set(bpy.data.objects)-before;bpy.context.view_layer.update()
    corners=[o.matrix_world@Vector(c) for o in imported if o.type=='MESH' for c in o.bound_box]
    lo=Vector([min(v[a] for v in corners) for a in range(3)]);hi=Vector([max(v[a] for v in corners) for a in range(3)])
    center=(lo+hi)/2;s=length/max(hi-lo)
    pivot=bpy.data.objects.new('Fishtank '+filename+' '+str(idx),None);bpy.context.collection.objects.link(pivot);pivot.parent=root
    for o in imported:
        if o.parent not in imported:
            o.parent=pivot;o.location-=center
        if o.animation_data:o.animation_data_clear()
    pivot.scale=(s,s,s);pivot.location=bl(TX+dx,WY+yy,WZ+dz);pivot.rotation_euler.z=(math.pi/2 if idx%2 else -math.pi/2)
# Upholstered stools with a circular footrest and pedestal base.
for o in list(root.children_recursive):
    if o.name.startswith('Stool seat'):paint(o,wood)
for zz in [WZ-2.7,WZ-.9,WZ+.9,WZ+2.7]:
    cylinder('Stool weighted base',(WX+1.4,WY+.045,zz),.26,.09,structural)
    ring('Stool footrest',(WX+1.4,WY+.24,zz),.19,.025,brass)

# Mine: riveted, open cart; braced timber headframe and a real spoked pulley.
remove('Head wheel housing');remove('Head wheel');remove('Cart body')
for o in list(root.children_recursive):
    if o.name.startswith(('Head prop','Head beam','Sleeper')):paint(o,wood)
for dx in [-2.4,2.4]:
    beam('Headframe diagonal',(MX+dx,MY+.55,MZ-2),(MX+dx,MY+3.15,MZ+2),.13,wood)
    for dz in [-2,2]:
        box('Timber steel shoe',(MX+dx,MY+.17,MZ+dz),(.34,.34,.34),structural,.03)
        for yy in [.32,2.9]:cylinder('Timber bolt',(MX+dx,MY+yy,MZ+dz-.16),.045,.025,brass,axis='z')
ring('Hoist pulley',(MX,MY+3.9,MZ-.3),.53,.065,structural,axis='z')
cylinder('Hoist axle',(MX,MY+3.9,MZ-.3),.10,.48,brass,axis='z')
for i in range(8):
    a=i*math.tau/8;beam('Pulley spoke',(MX,MY+3.9,MZ-.3),(MX+.49*math.cos(a),MY+3.9+.49*math.sin(a),MZ-.3),.045,brass)
tube('Hoist cable',[(MX-.5,MY+3.9,MZ-.3),(MX-.5,MY+.65,MZ-.3)],.018,black)
box('Cart bed',(MX,MY+.4,MZ+3.3),(1.04,.1,1.48),structural,.04)
for dx in [-.5,.5]:box('Cart side',(MX+dx,MY+.68,MZ+3.3),(.075,.58,1.48),structural,.035)
for dz in [2.6,4]:box('Cart end',(MX,MY+.68,MZ+dz),(1.04,.58,.075),structural,.035)
for dx in [-.48,.48]:
    for dz in [2.83,3.77]:
        cylinder('Cart flanged wheel',(MX+dx,MY+.24,MZ+dz),.18,.12,black,axis='x')
        cylinder('Cart wheel cap',(MX+dx*1.11,MY+.24,MZ+dz),.075,.02,brass,axis='x')
    for dz in [2.7,3.05,3.4,3.75,3.93]:sphere('Cart rivet',(MX+dx*1.13,MY+.82,MZ+dz),.025,brass,segs=12)
# Rock reads as stone, with broad facets and a varied palette, not smooth balls.
rocks=[material('Basalt '+str(i),(.09+i*.016,.075+i*.014,.07+i*.014),0,0,.92) for i in range(4)]
for o in list(root.children_recursive):
    if o.name.startswith('Outcrop'):
        paint(o,random.choice(rocks))
        for p in o.data.polygons:p.use_smooth=False

# Calm island: open cedar pergola, layered joints and climbing greenery.
remove('Pergola rim')
for o in list(root.children_recursive):
    if o.name.startswith(('Pergola post','Pergola slat')):paint(o,wood)
for xx in [CX-3,CX+3]:
    box('Pergola cross rail',(xx,CY+3.08,CZ),(.20,.22,6.35),wood,.03)
    for zz in [CZ-3,CZ+3]:
        box('Pergola post shoe',(xx,CY+.13,zz),(.23,.26,.23),brass,.025)
        beam('Pergola knee brace',(xx,CY+2.5,zz),(xx,CY+3.02,zz+(.6 if zz<CZ else -.6)),.09,woodlight)
for zz in [CZ-3.15,CZ+3.15]:tube('Pergola edge lamp',[(CX-3.2,CY+3.24,zz),(CX+3.2,CY+3.24,zz)],.014,pink)
# Leafy climbers stay above head height and along existing posts.
for xx,zz in [(CX-3,CZ-3),(CX+3,CZ+3)]:
    tube('Climbing vine',[(xx+.09*math.sin(i*.8),CY+.3+i*.13,zz+.10*math.cos(i*.8)) for i in range(24)],.026,foliage)
    for i in range(22):
        a=i*.9
        sphere('Pergola leaf',(xx+.20*math.sin(a),CY+.45+i*.13,zz+.18*math.cos(a)),.14,foliagelight if i%3 else foliage,scale=(1,.35,1.7),segs=16)
for i in range(22):
    xx=CX-2.9+i*.27;zz=CZ-2.85+.12*math.sin(i)
    sphere('Canopy foliage',(xx,CY+3.28,zz),.20,foliage,scale=(1.4,.35,1),segs=16)
remove('Calm ring');ring('Calm circular inlay',(CX,CY+.005,CZ),2.1,.022,brass)
# Raceway guardrails gain bolted supports and rubber bumpers.
for sx in [-3.4,3.4]:
    for dz in [-2.65,-1.3,0,1.3,2.65]:
        cylinder('Barrier bolt',(sx+.125,RACE['y']+.52,RACE['z']+dz),.033,.025,brass,axis='x')
    box('Barrier lower rub strip',(sx,RACE['y']+.18,RACE['z']),(.25,.10,5.9),black,.035)
print('ENVIRONMENT_POLISH_COMPLETE')

# Finish the headframe with connected top members and restrained metal straps.
for dx in [-2.4,2.4]:
    box('Headframe top runner',(MX+dx,MY+3.42,MZ),(.24,.25,4.3),wood,.035)
    for dz in [-2,2]:box('Headframe joint strap',(MX+dx,MY+3.13,MZ+dz),(.31,.28,.31),structural,.022)
for dx in [-2,2]:beam('Headframe upper brace',(MX+dx,MY+3.4,MZ),(MX+dx*.7,MY+3.88,MZ),.12,woodlight)
# Manufactured lanterns replace bare light spheres.
for dx,dz in [(-4.6,-3.4),(4.6,3.4)]:
    for yy in [2.28,2.73]:cylinder('Lantern cap',(MX+dx,MY+yy,MZ+dz),.24,.075,structural)
    for i in range(4):
        a=i*math.tau/4
        tube('Lantern cage',[(MX+dx+.20*math.cos(a),MY+2.3,MZ+dz+.20*math.sin(a)),(MX+dx+.20*math.cos(a),MY+2.7,MZ+dz+.20*math.sin(a))],.015,brass)
# Reuse Fishtank's finished aquatic plants and driftwood as well as its fish.
remove('Aquatic leaf')
for idx,(filename,length,dx,dz) in enumerate([('broadleaf-plant',1.05,-.45,-2.7),('broadleaf-plant',1.25,-.4,.9),('broadleaf-plant',.95,-.4,2.7),('branching-driftwood',1.5,0,-.65)]):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(fish_dir/(filename+'.glb')))
    imported=set(bpy.data.objects)-before;bpy.context.view_layer.update()
    corners=[o.matrix_world@Vector(c) for o in imported if o.type=='MESH' for c in o.bound_box]
    lo=Vector([min(v[a] for v in corners) for a in range(3)]);hi=Vector([max(v[a] for v in corners) for a in range(3)])
    center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));scale=length/max(hi-lo)
    pivot=bpy.data.objects.new('Fishtank scenery '+str(idx),None);bpy.context.collection.objects.link(pivot);pivot.parent=root
    for o in imported:
        if o.parent not in imported:o.parent=pivot;o.location-=center
        if o.animation_data:o.animation_data_clear()
    pivot.location=bl(TX+dx,WY+.73,WZ+dz);pivot.scale=(scale,scale,scale);pivot.rotation_euler.z=math.pi/2

# Keep the mine equipment on the west side, out of the cabinet approach.
# Game offset (-3.5, 0, -1) converts to Blender (+3.5, +1, 0).
for o in root.children_recursive:
    if o.name.startswith(('Head prop','Head beam','Headframe','Timber','Hoist','Pulley','Rail','Sleeper','Cart')):
        o.location.x += 3.5
        o.location.y += 1.0
# Keep decorative lamps at the expanded perimeter, clear of cabinet fronts.
bpy.context.view_layer.update()
for o in root.children_recursive:
    if o.name.startswith(('Lamp post','Mine lamp','Lantern')):
        center=sum((o.matrix_world @ Vector(c) for c in o.bound_box),Vector())/8
        gx,gz=-center.x,-center.y
        o.location.x -= 2.2 if gx>MX else -2.2
        o.location.y -= 1.0 if gz>MZ else -1.0

exec(compile((OUT / 'source' / 'steampunk_island.py').read_text(), str(OUT / 'source' / 'steampunk_island.py'), 'exec'), globals())

# Replace the arrival arch and its across-the-path instruction panel with
# a compact welcome board at the right edge of the landing area.
for prefix in ['Welcome post','Welcome beam','Welcome title','Welcome brass post','Welcome inset post','Post fastening','Welcome sign','Welcome curved crown','Hint board','Hint line']:
    remove(prefix)
box('Welcome sideboard',(4.95,2.0,-3.25),(.16,2.2,2.5),structural,.09)
for zz in [-4.30,-2.20]:
    box('Welcome sideboard leg',(4.95,.5,zz),(.12,1,.12),structural,.025)
    box('Welcome sideboard shoe',(4.95,.08,zz),(.3,.16,.3),brass,.035)
for yy in [.99,3.01]:box('Welcome sideboard trim',(4.858,yy,-3.25),(.025,.025,2.30),brass,.008)
for name,label,yy,size,mat in [
    ('Brand','GOPHER CLOUD',2.56,.25,white),('Arcade','A R C A D E',2.22,.18,brass),
    ('Guide','Jump twice to fly',1.70,.19,white),('Guide small','Find your next game in the clouds',1.36,.095,white)]:
    text('Welcome sideboard '+name,label,(4.84,yy,-3.25),size,mat,yaw=-math.pi/2)

exec(compile((OUT / 'source' / 'island_flooring.py').read_text(), str(OUT / 'source' / 'island_flooring.py'), 'exec'), globals())
