"""Max-Gear gyro-wedge display, based on maxgear/js/player.js drawShip.
The southern hangar display leaves the east-to-north cabinet approach open.
"""
remove('Workshop compass inlay');remove('Compass tick')
alloy=material('Hangar brushed titanium',(.30,.38,.44),.62,0,.43)
naval=material('Hangar midnight alloy',(.055,.095,.14),.46,0,.46)
aether=material('Ship aether cyan',(.07,.75,.91),.25,.8,.25)
ship_hull=material('Ship teal ceramic armor',(.09,.35,.43),.48,0,.32)
ship_glass=material('Ship porthole blue glass',(.12,.40,.58),.62,0,.13)
ship_gold=material('Ship gold edge alloy',(.73,.47,.15),.62,0,.31)
SX,SY,SZ=-18,RACE['y'],1.05
# Flush-looking raised maintenance pad: all machinery stays inside its blocker.
cylinder('Hangar docking dais',(SX,SY+.075,SZ),1.58,.15,naval)
ring('Hangar pad outer lip',(SX,SY+.16,SZ),1.49,.035,alloy)
for i in range(8):
    a=i*math.tau/8
    tube('Hangar landing light arc',[(SX+1.40*math.cos(a+j*.045),SY+.166,SZ+1.40*math.sin(a+j*.045)) for j in range(10)],.016,aether)
    x,z=SX+1.18*math.cos(a),SZ+1.18*math.sin(a)
    box('Hangar pad marker',(x,SY+.16,z),(.14,.014,.045),ship_gold,.004,yaw=-a)
# The game's arrow outline, extruded into a shallow faceted fuselage.
# Local nose points north. The tail notch and broad swept wings are preserved.
outline=[(0,-1.43),(1.13,1.0),(0,.47),(-1.13,1.0)]
verts=[bl(SX+x,SY+y,SZ+z) for y in [.80,1.11] for x,z in outline]
faces=[(0,3,2,1),(4,5,6,7)]+[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)]
me=bpy.data.meshes.new('Maxgear gyro-wedge hull');me.from_pydata(verts,[],faces);me.update()
o=bpy.data.objects.new('Maxgear gyro-wedge hull',me);bpy.context.collection.objects.link(o);finish(o,o.name,ship_hull)
mod=o.modifiers.new('Rounded armor edges','BEVEL');mod.width=.055;mod.segments=3
o.modifiers.new('Armor normals','WEIGHTED_NORMAL')
for yy,mat,r in [(1.125,ship_gold,.035),(.83,aether,.018)]:
    tube('Ship swept hull trim',[(SX+x,SY+yy,SZ+z) for x,z in outline],r,mat,True)
# Raised central spine and segmented wing armor stay subtle against the silhouette.
beam('Ship nose spine',(SX,SY+1.14,SZ-1.23),(SX,SY+1.18,SZ+.42),.065,alloy)
for side in [-1,1]:
    for i in range(4):
        z=-.21+i*.24;x=side*(.35+i*.13)
        beam('Ship wing armor seam',(SX+side*.13,SY+1.145,SZ+z-.24),(SX+x,SY+1.145,SZ+z+.12),.025,alloy)
    # Auxiliary barrels and underslung engine nacelles echo the game's upgrades.
    cylinder('Ship auxiliary barrel',(SX+side*.73,SY+1.09,SZ+.16),.065,.66,alloy,axis='z')
    cylinder('Ship engine nacelle',(SX+side*.73,SY+.84,SZ+.68),.17,.66,naval,axis='z')
    ring('Ship thruster collar',(SX+side*.73,SY+.84,SZ+1.025),.155,.028,ship_gold,axis='z')
    cylinder('Ship thruster core',(SX+side*.73,SY+.84,SZ+1.043),.12,.025,aether,axis='z')
    # Landing legs ground the ship without filling the display with scaffolding.
    beam('Ship landing strut',(SX+side*.64,SY+.84,SZ+.42),(SX+side*.76,SY+.25,SZ+.59),.065,alloy)
    box('Ship landing shoe',(SX+side*.76,SY+.205,SZ+.59),(.29,.08,.40),naval,.04)
beam('Ship nose landing strut',(SX,SY+.81,SZ-.74),(SX,SY+.24,SZ-.85),.065,alloy)
box('Ship nose landing shoe',(SX,SY+.205,SZ-.85),(.29,.08,.4),naval,.04)
sphere('Ship domed porthole',(SX,SY+1.15,SZ-.32),.32,ship_glass,scale=(1,.68,1),segs=24)
ring('Ship brass porthole rim',(SX,SY+1.15,SZ-.32),.325,.041,ship_gold)
for i in range(8):
    a=i*math.tau/8
    sphere('Ship porthole fastening',(SX+.326*math.cos(a),SY+1.186,SZ-.32+.326*math.sin(a)),.018,alloy,segs=8)
# Horizontal eight-tooth tail gear: the distinctive exposed gyro from drawShip.
ring('Ship tail gyro rim',(SX,SY+1.02,SZ+.78),.36,.065,ship_gold)
cylinder('Ship tail gyro hub',(SX,SY+1.02,SZ+.78),.095,.12,alloy)
for i in range(8):
    a=i*math.tau/8
    box('Ship tail gyro tooth',(SX+.43*math.cos(a),SY+1.02,SZ+.78+.43*math.sin(a)),(.16,.11,.13),ship_gold,.015,yaw=-a)
for i in range(4):
    a=i*math.pi/2
    beam('Ship tail gyro spoke',(SX,SY+1.025,SZ+.78),(SX+.32*math.cos(a),SY+1.025,SZ+.78+.32*math.sin(a)),.055,ship_gold)
# Compact diagnostics terminal at the far side of the pad, never in the lane.
CX,CZ=-20.15,2.48
box('Hangar console foot',(CX,SY+.09,CZ),(.65,.18,.57),naval,.055)
box('Hangar console column',(CX,SY+.55,CZ),(.30,.8,.29),alloy,.045)
box('Hangar console housing',(CX,SY+1.03,CZ),(.78,.59,.20),naval,.055)
box('Hangar console screen',(CX,SY+1.06,CZ-.111),(.63,.39,.018),ship_glass,.025)
for i,w in enumerate([.40,.26,.45]):
    box('Hangar console telemetry',(CX-.04,SY+1.17-i*.105,CZ-.125),(w,.018,.009),aether,.004)
text('Hangar console legend','GYRO / READY',(CX,SY+.83,CZ-.115),.073,white,yaw=math.pi)
# Thin perimeter conduits and service panels make the whole deck read as a hangar.
for z in [-3.72,3.72]:
    tube('Hangar deck conduit',[(-22.5,SY+.012,z),(-15.2,SY+.012,z)],.013,aether)
for x in [-22.85,-15.15]:
    for z in [-2.8,-1.8,-.8]:
        box('Hangar service hatch',(x,SY+.006,z),(.44,.012,.63),naval,.022)
        for dz in [-.18,0,.18]:box('Hangar hatch vent',(x,SY+.015,z+dz),(.28,.008,.035),alloy,.004)
print('MAXGEAR_SHIP_COMPLETE')
