"""Mining-company outpost and level timber bridge to the original Supermine.
Scenery occupies the sides; the central arrival lane leads to the arcade.
"""
AX,AY,AZ=ADVENTURE['x'],ADVENTURE['y'],ADVENTURE['z']
company_wall=material('Company ochre siding',(.42,.30,.16),0,0,.78)
company_trim=material('Company dark timber',(.16,.095,.047),0,0,.7)
company_roof=material('Company oxidized roof',(.12,.27,.25),.35,0,.55)
company_window=material('Company warm window',(.65,.43,.19),.08,.12,.36)
quartz=material('Adventure pale quartz',(.65,.77,.74),.18,0,.24)
amethyst=material('Adventure amethyst',(.36,.18,.49),.18,0,.28)
copper_ore=material('Adventure copper ore',(.38,.60,.45),.22,0,.32)
beacon('Adventure',ADVENTURE,gold,5.2)

# Solid scenic assay office west of the walking lane. Its roof is a true
# gable with thickness; siding, joinery and seams supply the small detail.
BX,BZ=AX-3,AZ+.5
box('Company stone footing',(BX,AY+.15,BZ),(4.2,.30,4.2),stone,.06)
box('Company office walls',(BX,AY+1.6,BZ),(3.9,2.9,3.9),company_wall,.045)
for side in [-1,1]:
    for i in range(12):
        yy=AY+.36+i*.225
        box('Company front siding',(BX,yy,BZ+side*1.96),(3.9,.022,.024),company_trim,.003)
        box('Company side siding',(BX+side*1.96,yy,BZ),(.024,.022,3.9),company_trim,.003)
    for dz in [-1.9,1.9]:
        box('Company corner timber',(BX+side*1.9,AY+1.64,BZ+dz),(.15,3.03,.15),company_trim,.018)
# Six cross-section vertices form the roof volume including triangular gables.
verts=[bl(BX+x,AY+y,BZ+z) for z in [-2.22,2.22] for x,y in [(-2.22,3.04),(2.22,3.04),(0,4.20)]]
mesh=bpy.data.meshes.new('Company gabled roof');mesh.from_pydata(verts,[],[(0,2,1),(3,4,5),(0,1,4,3),(0,3,5,2),(1,2,5,4)]);mesh.update()
o=bpy.data.objects.new('Company gabled roof',mesh);bpy.context.collection.objects.link(o);finish(o,o.name,company_roof)
for dz in [-2.24,2.24]:
    for side in [-1,1]:beam('Company gable fascia',(BX+side*2.24,AY+3.05,BZ+dz),(BX,AY+4.22,BZ+dz),.12,company_trim)
for dz in [-2.1+i*.42 for i in range(11)]:
    for side in [-1,1]:tube('Company standing roof seam',[(BX+side*2.21,AY+3.065,BZ+dz),(BX,AY+4.225,BZ+dz)],.015,company_roof)
beam('Company ridge cap',(BX,AY+4.24,BZ-2.25),(BX,AY+4.24,BZ+2.25),.10,bronze)
box('Company chimney',(BX-1,AY+3.75,BZ+1),( .42,1.3,.45),stone,.025)
box('Company chimney cap',(BX-1,AY+4.43,BZ+1),(.58,.12,.60),structural,.025)
# Front faces north, towards the bridge and hub. Door is decorative.
box('Company door frame',(BX,AY+1.12,BZ-1.99),(1.03,2.02,.13),company_trim,.025)
box('Company panel door',(BX,AY+1.08,BZ-2.065),(.79,1.80,.035),company_roof,.016)
for yy in [.63,1.42]:box('Company door inset',(BX,AY+yy,BZ-2.09),(.59,.53,.02),company_wall,.018)
sphere('Company door handle',(BX-.28,AY+1.05,BZ-2.13),.043,brass,segs=12)
for dx in [-1.28,1.28]:
    box('Company window frame',(BX+dx,AY+1.57,BZ-2.01),(.83,1.10,.12),company_trim,.02)
    box('Company window pane',(BX+dx,AY+1.57,BZ-2.078),(.67,.92,.025),company_window,.012)
    box('Company window mullion',(BX+dx,AY+1.57,BZ-2.10),(.045,.94,.027),company_trim,.004)
    box('Company window crossbar',(BX+dx,AY+1.57,BZ-2.10),(.68,.045,.027),company_trim,.004)
    box('Company window sill',(BX+dx,AY+1.01,BZ-2.10),(.94,.09,.26),company_trim,.015)
box('Company enamel nameboard',(BX,AY+2.64,BZ-2.04),(3.45,.61,.12),structural,.05)
text('Company name','CLOUD MINING CO.',(BX,AY+2.71,BZ-2.111),.225,white,yaw=math.pi)
text('Company assay label','ASSAY OFFICE  /  EST. 1984',(BX,AY+2.46,BZ-2.111),.087,brass,yaw=math.pi)
# Lanterns stay tucked against the office, away from the route.
for dx in [-1.82,1.82]:
    box('Company lantern bracket',(BX+dx,AY+2.34,BZ-2.14),(.06,.08,.34),structural,.01)
    box('Company lantern housing',(BX+dx,AY+2.07,BZ-2.28),(.21,.36,.21),bronze,.02)
    box('Company lantern light',(BX+dx,AY+2.08,BZ-2.39),(.14,.23,.018),company_window,.01)

# Mineral specimens: pointed hexagonal crystals embedded in rough ore beds.
def crystal(name,x,z,h,r,mat,lean):
    verts=[]
    for yy,rad in [(0,r*.8),(h*.70,r)]:
        verts.extend(bl(x+rad*math.cos(i*math.tau/6)+lean*yy,AY+.42+yy,z+rad*math.sin(i*math.tau/6)) for i in range(6))
    verts.append(bl(x+lean*h,AY+.42+h,z))
    faces=[tuple(range(5,-1,-1))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]+[(6+i,6+(i+1)%6,12) for i in range(6)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,mat)
for index,(x,z,mat,label) in enumerate([(24,15.4,amethyst,'AMETHYST'),(24,18.3,copper_ore,'COPPER ORE'),(16,14,quartz,'QUARTZ')]):
    cylinder('Adventure specimen plinth',(x,AY+.16,z),.82,.32,stone)
    sphere('Adventure specimen matrix',(x,AY+.38,z),.66,stone,scale=(1,.5,.85),segs=10)
    for i,(dx,dz,h,r) in enumerate([(0,0,1.12,.21),(-.31,.06,.70,.17),(.28,.13,.88,.18),(.1,-.30,.53,.15)]):
        crystal('Adventure '+label+' crystal',x+dx,z+dz,h,r,mat,(i-1.5)*.13)
    box('Adventure mineral plaque',(x,AY+.36,z-.74),(.94,.22,.06),structural,.025)
    text('Adventure mineral label',label,(x,AY+.36,z-.777),.105,brass,yaw=math.pi)
# Cargo on the rear side of the office, clear of the cabinet and bridge.
for x,z in [(16,21.3),(17.05,21.5)]:
    box('Company sample crate',(x,AY+.38,z),(.8,.76,.78),company_wall,.035)
    for xx in [-.31,.31]:box('Company crate strap',(x+xx,AY+.39,z),(.055,.79,.81),company_trim,.008)

# Level bridge: uninterrupted support under slightly separated timber boards.
# The runtime floor spans z=6..12 at y=-5.5; rails leave over 2 m clear width.
box('Mine bridge subdeck',(22,AY-.145,9),(2.4,.15,6.3),company_trim,.018)
for i in range(20):
    z=6+(i+.5)*.30
    box('Mine bridge plank',(22,AY-.035,z),(2.4,.07,.288),cedar[i%len(cedar)],.008)
    for x in [21.04,22.96]:
        cylinder('Mine bridge fastening',(x,AY+.004,z),.025,.008,structural)
for x in [20.85,23.15]:
    beam('Mine bridge stringer',(x,AY-.28,5.85),(x,AY-.28,12.15),.19,company_trim)
    for z in [6,7.5,9,10.5,12]:
        box('Mine bridge rail post',(x,AY+.52,z),(.14,1.32,.14),company_trim,.018)
        box('Mine bridge post cap',(x,AY+1.20,z),(.21,.09,.21),bronze,.018)
    for yy in [.45,1.12]:beam('Mine bridge guardrail',(x,AY+yy,6),(x,AY+yy,12),.095,company_trim)
    for z in [6,7.5,9,10.5]:
        beam('Mine bridge diagonal',(x,AY+.18,z),(x,AY+1.07,z+1.5),.07,company_trim)
print('ADVENTURE_ISLAND_COMPLETE')
