"""Supermine's tracked mining machine, based on supermine/js/vehicle.js.
A static upgraded rig with twin bits, cutting drum, cab and rear collector.
All scenery sits outside the southern approach and east-side arcade/bridge lane.
"""
for prefix in ['Head prop','Head beam','Headframe','Timber','Hoist','Pulley','Rail','Sleeper','Cart']:
    remove(prefix)
rig_steel=material('Supermine gunmetal',(.30,.35,.40),.65,0,.37)
rig_edge=material('Supermine machined edges',(.62,.68,.73),.78,0,.28)
rig_dark=material('Supermine track rubber',(.045,.055,.062),.15,0,.85)
rig_yellow=material('Supermine safety ochre',(.84,.48,.075),.30,0,.49)
rig_window=material('Supermine blue cab glass',(.07,.25,.31),.42,0,.18)
nugget_gold=material('Supermine native gold',(.94,.60,.11),.72,0,.27)
gem_green=material('Supermine emerald',(.025,.51,.21),.28,0,.22)
gem_purple=material('Supermine purple crystal',(.46,.15,.66),.26,0,.24)
worklight=material('Supermine worklight glass',(.95,.81,.46),.1,.6,.3)
rig_before=set(root.children_recursive)
RX,RY,RZ=17,MY,-1
# Track belts and visible road wheels, with cleats wrapping over their ends.
for side in [-1,1]:
    x=RX+side*1.30
    box('Supermine track belt',(x,RY+.49,RZ),(.57,.77,2.9),rig_dark,.25)
    for z in [-1.05,-.53,0,.53,1.05]:
        cylinder('Supermine road wheel',(x+side*.29,RY+.49,RZ+z),.29,.065,rig_steel,axis='x')
        cylinder('Supermine wheel hub',(x+side*.33,RY+.49,RZ+z),.115,.04,rig_yellow,axis='x')
    for i in range(11):
        for yy in [.11,.87]:
            box('Supermine track cleat',(x,RY+yy,RZ-1.19+i*.238),(.64,.085,.105),rig_steel,.012)
    for sign in [-1,1]:
        for i in range(5):
            a=-math.pi/2+i*math.pi/4
            box('Supermine track end cleat',(x,RY+.49+.34*math.sin(a),RZ+sign*(1.12+.34*math.cos(a))),(.64,.11,.10),rig_steel,.012)
box('Supermine chassis',(RX,RY+.96,RZ),(2.40,.61,2.8),rig_steel,.13)
for side in [-1,1]:
    box('Supermine track fender',(RX+side*1.3,RY+1.02,RZ),(.79,.14,3.0),rig_yellow,.055)
    box('Supermine side armor',(RX+side*1.21,RY+1.13,RZ),(.09,.46,1.94),rig_steel,.035)
    for z in [-.75,-.25,.25,.75]:
        cylinder('Supermine armor bolt',(RX+side*1.27,RY+1.13,RZ+z),.035,.03,rig_edge,axis='x')
# Front engine deck and raised operator cab, as in the game's overhead rig.
box('Supermine engine hood',(RX,RY+1.42,RZ-.65),(1.85,.35,1.11),rig_steel,.10)
for i in range(8):box('Supermine engine vent',(RX-.64+i*.18,RY+1.60,RZ-.65),(.055,.025,.74),rig_dark,.008)
box('Supermine cab',(RX,RY+1.84,RZ+.25),(1.58,1.13,1.34),rig_yellow,.095)
box('Supermine windshield',(RX,RY+1.99,RZ-.431),(1.34,.61,.022),rig_window,.045)
box('Supermine windshield center',(RX,RY+1.99,RZ-.452),(.055,.68,.035),rig_edge,.008)
for side in [-1,1]:
    box('Supermine side window',(RX+side*.802,RY+1.99,RZ+.22),(.025,.60,.99),rig_window,.04)
    box('Supermine cab door handle',(RX+side*.826,RY+1.58,RZ+.53),(.045,.045,.21),rig_edge,.012)
box('Supermine cab roof',(RX,RY+2.45,RZ+.24),(1.8,.15,1.56),rig_steel,.08)
cylinder('Supermine amber beacon',(RX,RY+2.62,RZ+.25),.12,.21,rig_yellow)
for side in [-1,1]:
    box('Supermine headlamp housing',(RX+side*.65,RY+2.38,RZ-.57),(.29,.21,.17),rig_dark,.045)
    box('Supermine headlamp lens',(RX+side*.65,RY+2.38,RZ-.665),(.22,.14,.025),worklight,.035)
    cylinder('Supermine exhaust stack',(RX+side*.95,RY+1.95,RZ+.83),.09,1.16,rig_steel)
    cylinder('Supermine exhaust cap',(RX+side*.95,RY+2.57,RZ+.83),.14,.08,rig_dark)
# Hydraulic arms hold the transverse cutting drum ahead of the tracks.
for side in [-1,1]:
    beam('Supermine cutter arm',(RX+side*.93,RY+.93,RZ-.8),(RX+side*1.18,RY+.64,RZ-1.92),.16,rig_steel)
    beam('Supermine hydraulic ram',(RX+side*1.03,RY+1.24,RZ-.66),(RX+side*1.22,RY+.77,RZ-1.69),.08,rig_edge)
    tube('Supermine hydraulic hose',[(RX+side*.90,RY+1.20,RZ-.82),(RX+side*1.09,RY+1.28,RZ-1.22),(RX+side*1.15,RY+.85,RZ-1.76)],.025,rig_dark)
cylinder('Supermine cutter drum',(RX,RY+.73,RZ-1.94),.38,3.58,rig_steel,axis='x')
for i in range(15):
    for j in range(4):
        a=j*math.tau/4+i*.35
        box('Supermine cutter tooth',(RX-1.64+i*.234,RY+.73+.39*math.sin(a),RZ-1.94+.39*math.cos(a)),(.115,.15,.15),rig_edge,.018)
# Conical drill heads and helical cutting ridges point toward the rock face.
for dx in [-.87,.87]:
    cylinder('Supermine drill collar',(RX+dx,RY+.79,RZ-2.20),.32,.22,rig_yellow,axis='z')
    bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.31,radius2=.025,depth=.72,location=bl(RX+dx,RY+.79,RZ-2.64),rotation=(-math.pi/2,0,0))
    o=bpy.context.object;finish(o,'Supermine conical drill bit',rig_steel)
    for phase in [0,math.pi]:
        pts=[]
        for i in range(45):
            t=i/44;r=.31*(1-t)+.025*t;a=t*math.tau*2.3+phase
            pts.append((RX+dx+r*math.cos(a),RY+.79+r*math.sin(a),RZ-2.28-.72*t))
        tube('Supermine spiral cutting ridge',pts,.028,rig_edge)
# Rear hopper and collection conveyor, with restrained hazard chevrons.
box('Supermine hopper bed',(RX,RY+.96,RZ+1.67),(1.75,.15,1.07),rig_dark,.045)
for side in [-1,1]:box('Supermine hopper side',(RX+side*.87,RY+1.21,RZ+1.67),(.10,.49,1.12),rig_steel,.035)
box('Supermine hopper rear',(RX,RY+1.21,RZ+2.18),(1.75,.49,.10),rig_steel,.035)
box('Supermine collector belt',(RX,RY+.63,RZ+2.52),(1.53,.16,.92),rig_dark,.035)
for i in range(6):box('Supermine conveyor slat',(RX,RY+.72,RZ+2.17+i*.14),(1.44,.055,.04),rig_yellow,.007)
for side in [-1,1]:beam('Supermine conveyor rail',(RX+side*.82,RY+.76,RZ+2.04),(RX+side*.82,RY+.76,RZ+3.0),.10,rig_steel)
box('Supermine fleet plate',(RX,RY+1.05,RZ-1.42),(1.18,.25,.045),rig_dark,.025)
text('Supermine fleet lettering','SM-01',(RX,RY+1.05,RZ-1.45),.17,white,yaw=math.pi)
# Low excavated face behind the drill tips, studded with visible gold seams.
for i in range(7):
    x=15.45+i*.48
    sphere('Supermine cut rock',(x,MY+.50,-4.65),.65,rock,scale=(.62,.85,.65),segs=10)
    box('Supermine exposed gold seam',(x+.08,MY+.58,-4.19),(.07,.63,.045),nugget_gold,.012,yaw=.14*(i%3-1))

rig_parts=set(root.children_recursive)-rig_before

# Rich irregular piles, with deterministic geometry independent of other islands.
rng=random.Random(714)
def gem(name,x,y,z,r,h,mat):
    verts=[]
    for yy,rad in [(0,r*.62),(h*.24,r),(h*.76,r*.74)]:
        for i in range(6):
            a=i*math.tau/6;verts.append(bl(x+rad*math.cos(a),y+yy,z+rad*math.sin(a)))
    verts.append(bl(x+.09*h,y+h,z))
    faces=[tuple(range(5,-1,-1))]
    for level in range(2):
        faces.extend((level*6+i,level*6+(i+1)%6,(level+1)*6+(i+1)%6,(level+1)*6+i) for i in range(6))
    faces.extend((12+i,12+(i+1)%6,18) for i in range(6))
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,name,mat)
for label,x,z,mat in [('Gold',22,-4.5,nugget_gold),('Emerald',25.7,3.6,gem_green),('Amethyst',18,4.65,gem_purple)]:
    sphere('Supermine '+label+' ore bed',(x,MY+.27,z),1,rock,scale=(1.08,.36,.87),segs=12)
    for i in range(24):
        a=rng.random()*math.tau;rad=.9*math.sqrt(rng.random());xx=x+rad*math.cos(a);zz=z+rad*.8*math.sin(a)
        yy=MY+.23+.38*(1-rad/.9)
        if label=='Gold':
            sphere('Supermine gold nugget',(xx,yy,zz),rng.uniform(.14,.27),mat,scale=(1.2,.85,1),segs=8)
        else:gem('Supermine '+label+' shard',xx,yy,zz,rng.uniform(.12,.20),rng.uniform(.35,.83),mat)
    if label=='Gold':
        for row in range(3):
            for col in range(3-row):box('Supermine stacked bullion',(x-.45+col*.32+row*.16,MY+.75+row*.14,z),(.29,.13,.52),mat,.035)
    else:gem('Supermine '+label+' centerpiece',x,MY+.4,z,.30,1.28,mat)
# Short cart siding and open-topped loaded ore wagon, beside the southern entry.
for x in [13.85,14.55]:box('Supermine cart rail',(x,MY+.035,4.2),(.055,.07,2.35),rig_edge,.01)
for i in range(7):box('Supermine cart sleeper',(14.2,MY+.018,3.17+i*.34),(1.04,.035,.13),timber,.008)
box('Supermine ore wagon bed',(14.2,MY+.38,4.2),(1.05,.12,1.24),rig_steel,.025)
for side in [-1,1]:
    box('Supermine ore wagon side',(14.2+side*.52,MY+.65,4.2),(.075,.54,1.28),rig_yellow,.025)
    box('Supermine ore wagon end',(14.2,MY+.65,4.2+side*.60),(1.05,.54,.075),rig_yellow,.025)
    for dz in [-.42,.42]:cylinder('Supermine ore wagon wheel',(14.2+side*.57,MY+.22,4.2+dz),.19,.11,rig_dark,axis='x')
for i in range(12):sphere('Supermine wagon gold',(14.2+rng.uniform(-.35,.35),MY+.79,4.2+rng.uniform(-.43,.43)),.15,nugget_gold,segs=8)
for i in range(8):sphere('Supermine hopper ore',(RX+rng.uniform(-.6,.6),MY+1.13,RZ+1.68+rng.uniform(-.35,.35)),.14,nugget_gold,segs=8)
# Compact work-light towers illuminate the worksite visually without adding lights.
for x,z in [(13.2,-.9),(20,-4.7)]:
    box('Supermine worklight foot',(x,MY+.09,z),(.48,.18,.48),rig_steel,.04)
    cylinder('Supermine worklight mast',(x,MY+1.26,z),.055,2.4,rig_edge)
    box('Supermine worklight housing',(x,MY+2.45,z),(.66,.33,.24),rig_yellow,.06)
    box('Supermine worklight lens',(x,MY+2.45,z+.13),(.53,.22,.025),worklight,.035)
print('SUPERMINE_ISLAND_COMPLETE')

# Park the rig lengthwise along the north edge, opening a direct central route.
# Move the cut face with its bits; keep ore piles and the wagon in place.
from mathutils import Matrix
bpy.context.view_layer.update()
move=(Matrix.Translation(Vector(bl(17.5,MY,-3.7)))
      @ Matrix.Rotation(-math.pi/2,4,'Z')
      @ Matrix.Translation(-Vector(bl(17,MY,-1))))
rig_parts.update(o for o in root.children_recursive if o.name.startswith('Supermine hopper ore'))
for o in rig_parts:o.matrix_world=move @ o.matrix_world
