"""Dam Break's miniature reservoir. Static scenery, not a second game simulation.
All dimensions use game coordinates; the western walking lane leads from arrival to the cabinet.
"""
DX,DY,DZ=DAM['x']+2,DAM['y'],DAM['z']-1.7
concrete=material('Dam weathered concrete',(.46,.48,.44),0,0,.8)
capstone=material('Dam pale coping',(.67,.65,.54),0,0,.66)
basin=material('Reservoir deep blue',(.025,.19,.25),.05,0,.19)
waterlight=material('Reservoir sunlit ripples',(.15,.44,.46),.03,0,.27)
moss=material('Dam moss',(.13,.24,.10),0,0,.9)
gate=material('Dam gate steel',(.07,.15,.17),.2,0,.45)
beacon('Dam',DAM,cyan,5.0)
box('Dam diorama foundation',(DX,DY+.09,DZ),(6.6,.18,5.7),stone,.10)
# Raised reservoir behind the dam. Opaque blue water makes the retained
# volume readable from a distance, with its surface below the wall coping.
box('Reservoir bed',(DX,DY+.27,DZ-1.65),(5.95,.18,2.72),stone,.05)
box('Reservoir retained water',(DX,DY+.88,DZ-1.67),(5.64,1.04,2.45),basin,.025)
for dx in [-2.99,2.99]:
    box('Reservoir retaining bank',(DX+dx,DY+.88,DZ-1.65),(.32,1.4,2.98),concrete,.065)
    box('Reservoir bank coping',(DX+dx,DY+1.62,DZ-1.65),(.39,.12,3.05),capstone,.025)
box('Reservoir back wall',(DX,DY+.88,DZ-2.98),(6.25,1.4,.28),concrete,.06)
box('Reservoir back coping',(DX,DY+1.62,DZ-2.98),(6.30,.12,.36),capstone,.025)
# Soft arcs on the water surface, not large emissive patches.
for i in range(6):
    cx=DX-1.95+(i%3)*1.7;cz=DZ-2.45+(i//3)*1.1
    tube('Reservoir ripple',[(cx+.43*math.cos(a*.15),DY+1.407,cz+.20*math.sin(a*.15)) for a in range(13)],.008,waterlight)
# Segmented, slightly bowed dam wall and a continuous walkway along its crown.
for i in range(10):
    dx=-2.79+i*.62;zz=DZ-.40+.16*(1-(dx/3.1)**2)
    box('Dam wall segment',(DX+dx,DY+.97,zz),(.61,1.58,.53),concrete,.025)
    box('Dam crown walkway',(DX+dx,DY+1.81,zz),(.625,.15,.77),capstone,.018)
    if i in [0,2,4,6,8,9]:
        tube('Dam handrail post',[(DX+dx,DY+1.88,zz+.33),(DX+dx,DY+2.18,zz+.33)],.016,gate)
tube('Dam crown handrail',[(DX-2.95+i*.59,DY+2.18,DZ-.4+.16*(1-((-2.95+i*.59)/3.1)**2)+.33) for i in range(11)],.018,gate)
# Buttresses on the downstream face make this read as a heavy retaining wall.
for dx in [-2.6,-1.3,0,1.3,2.6]:
    for step in range(4):
        h=.30+step*.32
        box('Dam stepped buttress',(DX+dx,DY+.18+h/2,DZ+.20-step*.11),(.22,h,.30),concrete,.025)
# Three closed spillway gates: the reservoir is visibly held back.
for dx in [-1.85,0,1.85]:
    box('Spillway gate recess',(DX+dx,DY+.95,DZ+.06),(.66,.91,.035),black,.03)
    box('Spillway gate',(DX+dx,DY+.95,DZ+.088),(.54,.78,.035),gate,.02)
    for yy in [.69,.91,1.13]:box('Gate reinforcing rib',(DX+dx,DY+yy,DZ+.116),(.57,.055,.035),chrome,.007)
    cylinder('Gate lifting screw',(DX+dx,DY+1.66,DZ+.1),.025,.53,chrome)
    ring('Gate handwheel',(DX+dx,DY+1.94,DZ+.10),.115,.018,bronze)
# Lower channel and a little stilling pool show the difference in water level.
box('Downstream channel',(DX-.15,DY+.27,DZ+1.46),(2.9,.18,2.2),concrete,.07)
box('Downstream water',(DX-.15,DY+.376,DZ+1.46),(2.62,.03,2.0),basin,.025)
for dx in [-1.64,1.34]:box('Channel side',(DX+dx,DY+.46,DZ+1.46),(.13,.37,2.18),capstone,.025)
for i in range(4):box('Stilling block',(DX-1.15+i*.65,DY+.44,DZ+2.16),(.22,.14,.3),concrete,.025)
# Small service hut and a copper roof, tucked beside the downstream channel.
box('Dam control hut',(DX+2.35,DY+.80,DZ+1.63),(1.12,1.24,1.15),capstone,.055)
box('Control hut roof',(DX+2.35,DY+1.47,DZ+1.63),(1.28,.12,1.31),patina,.045)
box('Control hut door',(DX+2.35,DY+.69,DZ+2.218),(.37,.85,.022),gate,.018)
box('Control hut window',(DX+1.78,DY+1.04,DZ+1.65),(.024,.35,.50),basin,.02)
for dx,dz in [(-2.7,1.1),(-2.65,2.3),(2.5,-2.5)]:
    sphere('Reservoir bank stone',(DX+dx,DY+.29,DZ+dz),.26,stone,scale=(1.3,.55,1),segs=14)
    sphere('Reservoir moss',(DX+dx+.09,DY+.36,DZ+dz),.16,moss,scale=(1.3,.20,1),segs=12)
print('DAM_ISLAND_COMPLETE')
