"""Full NeonFox arena floor; runtime supplies moving, flush color trails."""
NX,NY,NZ=NEONFOX['x'],NEONFOX['y'],NEONFOX['z']
beacon('Neonfox',NEONFOX,cyan,5.4)
remove('Neonfox floor finish');remove('Neonfox floor perimeter')
arena=material('NeonFox midnight arena',(.003,.006,.021),0,0,.65)
grid=material('NeonFox floor grid',(.035,.065,.15),0,.08,.6)
box('NeonFox arena floor',(NX,NY-.04,NZ),(12,.08,12),arena,.008)
for i in range(13):
    p=-5.4+i*.9
    box('NeonFox inlaid grid',(NX+p,NY+.001,NZ),(.014,.002,10.8),grid,0)
    box('NeonFox inlaid grid',(NX,NY+.001,NZ+p),(10.8,.002,.014),grid,0)
print('NEONFOX_ISLAND_COMPLETE')
