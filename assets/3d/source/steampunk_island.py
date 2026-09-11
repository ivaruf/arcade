"""Maxgear's floating steam workshop. Runs after the environment finishing pass.
Game coordinates; cabinet positions and the central approach remain clear.
"""
copper=material('Hammered copper',(.43,.18,.075),.24,0,.38)
iron=material('Blackened engine iron',(.045,.055,.06),.22,0,.56)
bronze=material('Machined bronze',(.46,.31,.105),.24,0,.34)
patina=material('Copper verdigris',(.07,.23,.18),.15,0,.7)
amber=material('Warm pressure lamp',(.95,.42,.065),.1,.7,.25)
RX,RY,RZ=RACE['x'],RACE['y'],RACE['z']
for name in ['Race chevron','Race barrier','Barrier stripe','Barrier bolt','Barrier lower rub strip','Race inset landing light']:
    remove(name)
# Timber planks and a heavy perimeter frame, flush with the collision surface.
for i in range(19):
    box('Steamworks deck plank',(0,RY-.065,RZ-3.6+i*.4),(8.2,.1,.375),wood if i%3 else woodlight,.018)
for x in [-4.12,4.12]:box('Steamworks deck edging',(x,RY-.015,RZ),(.14,.13,7.65),iron,.025)
for z in [RZ-3.8,RZ+3.8]:box('Steamworks deck edging',(0,RY-.015,z),(8.38,.13,.14),iron,.025)
for x in [-3.95,3.95]:
    for i in range(13):cylinder('Deck rivet',(x,RY+.016,RZ-3.5+i*.58),.034,.025,bronze)
ring('Workshop compass inlay',(0,RY-.004,RZ+1.15),1.42,.025,bronze)
for i in range(12):
    a=i*math.tau/12
    o=box('Compass tick',(1.25*math.cos(a),RY+.003,RZ+1.15+1.25*math.sin(a)),(.12,.016,.028),bronze,.005);o.rotation_euler.z=-a
# The engine occupies the back centre, between (not in front of) the machines.
BZ=RZ-3.05
box('Boiler foundation',(0,RY+.12,BZ),(1.55,.24,1.45),iron,.09)
cylinder('Copper boiler',(0,RY+1.04,BZ),.58,1.55,copper)
for yy in [.30,.62,1.55,1.83]:ring('Boiler band',(0,RY+yy,BZ),.59,.052,bronze)
sphere('Boiler crown',(0,RY+1.78,BZ),.58,copper,scale=(1,.4,1),segs=24)
cylinder('Chimney collar',(0,RY+2.03,BZ),.25,.18,iron)
cylinder('Chimney',(0,RY+2.68,BZ),.17,1.25,copper)
for yy in [2.12,2.7,3.29]:ring('Chimney band',(0,RY+yy,BZ),.18,.03,bronze)
cylinder('Chimney cap',(0,RY+3.36,BZ),.28,.09,iron)
# Gauge faces point into the approach, toward game +Z.
cylinder('Pressure gauge housing',(.20,RY+1.45,BZ+.57),.20,.10,bronze,axis='z')
cylinder('Pressure gauge dial',(.20,RY+1.45,BZ+.63),.165,.015,white,axis='z')
for i in range(9):
    a=math.radians(30+i*30)
    beam('Gauge graduation',(.20+.13*math.cos(a),RY+1.45+.13*math.sin(a),BZ+.646),(.20+.15*math.cos(a),RY+1.45+.15*math.sin(a),BZ+.646),.012,black)
beam('Gauge needle',(.20,RY+1.45,BZ+.655),(.10,RY+1.53,BZ+.655),.014,pink)
ring('Furnace door',(0,RY+.68,BZ+.57),.28,.042,iron,axis='z')
cylinder('Furnace glow',(0,RY+.68,BZ+.575),.24,.02,amber,axis='z')
for dx in [-.15,-.075,0,.075,.15]:box('Furnace grille',(dx,RY+.68,BZ+.6),(.026,.39,.04),iron,.005)
for i in range(16):
    a=i*math.tau/16
    for yy in [.4,1.72]:sphere('Boiler rivet',(.59*math.cos(a),RY+yy,BZ+.59*math.sin(a)),.026,bronze,segs=12)
# Rounded copper services hug the perimeter. Flanges, valves and sockets give
# the pipes real joints; no overhead crossbeam through the cabinet view.
for side in [-1,1]:
    x=side*3.87
    tube('Copper perimeter pipe',[(x,RY+.18,RZ+3.3),(x,RY+.5,RZ+3.3),(x,RY+.62,RZ+3.17),(x,RY+.62,RZ-2.8),(x,RY+.5,RZ-2.95),(x,RY+.18,RZ-2.95)],.07,copper)
    for dz in [-2.5,-.7,1.1,2.8]:
        cylinder('Pipe footing',(x,RY+.10,RZ+dz),.15,.20,iron)
        ring('Pipe flange',(x,RY+.62,RZ+dz),.115,.025,bronze,axis='z')
    ring('Valve wheel',(x,RY+.97,RZ+1.2),.23,.03,patina,axis='x')
    for a in [0,math.pi/2]:
        beam('Valve spoke',(x,RY+.97-.2*math.cos(a),RZ+1.2-.2*math.sin(a)),(x,RY+.97+.2*math.cos(a),RZ+1.2+.2*math.sin(a)),.025,bronze)
# A pair of exposed flywheels hangs under the deck, visible during flight.
def cog(name,x,y,z,r,teeth):
    ring(name+' rim',(x,y,z),r*.79,r*.12,bronze,axis='z')
    cylinder(name+' hub',(x,y,z),r*.18,.18,iron,axis='z')
    for i in range(teeth):
        a=i*math.tau/teeth
        o=box(name+' tooth',(x+math.cos(a)*r*.94,y+math.sin(a)*r*.94,z),(r*.23,r*.18,.16),bronze,.012);o.rotation_euler.y=-a
    for i in range(6):
        a=i*math.tau/6
        beam(name+' spoke',(x,y,z),(x+r*.71*math.cos(a),y+r*.71*math.sin(a),z),r*.07,copper)
cog('Main flywheel',-1.1,RY-1.05,RZ+3.72,.90,16)
cog('Companion cog',.38,RY-.76,RZ+3.72,.57,12)
for x in [-1.1,.38]:beam('Engine hanger',(x,RY-.1,RZ+3.75),(x,RY-1.1,RZ+3.75),.12,iron)
# Trim the existing beacon to match the workshop rather than a neon racetrack.
for o in root.children_recursive:
    if o.name.startswith('Race mast base'):paint(o,iron)
    elif o.name.startswith('Race mast light'):paint(o,amber)
    elif o.name.startswith('Race mast'):paint(o,copper)
print('MAXGEAR_STEAMPUNK_COMPLETE')
