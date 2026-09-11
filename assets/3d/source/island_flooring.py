"""Finished flooring for the five playable islands, with tops at collision height.
Ambient clouds remain clouds. Tiles share meshes by material to keep draw calls low.
"""
def flooring_mesh(name,cells,mat,bevel=.012):
    verts=[];faces=[]
    for x,y,z,w,h,d in cells:
        cx,cy,cz=bl(x,y,z);sx,sy,sz=bl_size(w,h,d);a=len(verts)
        verts.extend([(cx+ix*sx/2,cy+iy*sy/2,cz+iz*sz/2) for ix,iy,iz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
        faces.extend([tuple(a+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);finish(o,name,mat)
    if bevel:
        m=o.modifiers.new('Finished floor edges','BEVEL');m.width=bevel;m.segments=2
        o.modifiers.new('Floor normals','WEIGHTED_NORMAL')
    return o

limestone=[material('Arrival limestone '+str(i),(.59+i*.026,.55+i*.026,.44+i*.025),0,0,.68) for i in range(4)]
sea_tile=[material('Aquarium glazed tile '+str(i),(.10+i*.017,.30+i*.024,.30+i*.022),.08,0,.31) for i in range(4)]
quarry=[material('Mine slate '+str(i),(.19+i*.023,.19+i*.02,.18+i*.017),0,0,.78) for i in range(4)]
cedar=[material('Terrace cedar '+str(i),(.39+i*.025,.25+i*.022,.13+i*.016),0,0,.54) for i in range(4)]
workshop=[material('Workshop oak '+str(i),(.25+i*.024,.14+i*.017,.064+i*.009),0,0,.58) for i in range(4)]
grout=material('Recessed floor joints',(.065,.083,.08),0,0,.85)
# The earlier partial racing deck is replaced by full-width workshop flooring.
remove('Steamworks deck plank');remove('Steamworks deck edging')
for tag,d,palette,tile_w,tile_d in [
    ('Welcome',WELCOME,limestone,1.2,1.0),('Race',RACE,workshop,2.25,.32),
    ('Water',WATER,sea_tile,1.0,1.0),('Mine',MINE,quarry,1.6,1.0),
    ('Calm',CALM,cedar,2.25,.30)]:
    x,y,z,hx,hz=[d[k] for k in ['x','y','z','hx','hz']]
    # Full rectangular coverage agrees exactly with the playable area. The
    # broad cloud billows still show beyond and below the platform edges.
    flooring_mesh(tag+' floor foundation',[(x,y-.11,z,hx*2,.20,hz*2)],grout,.025)
    cols=math.ceil(hx*2/tile_w);rows=math.ceil(hz*2/tile_d)
    w=hx*2/cols;depth=hz*2/rows;groups=[[] for _ in palette]
    for row in range(rows):
        for col in range(cols):
            groups[(row*7+col*3+row//3)%len(groups)].append((x-hx+(col+.5)*w,y-.035,z-hz+(row+.5)*depth,w-.014,.07,depth-.014))
    for i,cells in enumerate(groups):flooring_mesh(tag+' floor finish '+str(i),cells,palette[i],.009)
    border=bronze if tag=='Race' else (brass if tag in ['Welcome','Calm'] else structural)
    flooring_mesh(tag+' floor perimeter',[
        (x-hx+.035,y-.045,z,.07,.09,hz*2),(x+hx-.035,y-.045,z,.07,.09,hz*2),
        (x,y-.045,z-hz+.035,hx*2-.14,.09,.07),(x,y-.045,z+hz-.035,hx*2-.14,.09,.07)],border,.008)
    # Prevent the sculpted cloud peaks poking through the newly finished floor.
    for o in root.children_recursive:
        if o.name==tag+' sculpted cloud':
            for v in o.data.vertices:
                v.co.z=min(v.co.z,y-.06)
print('ISLAND_FLOORING_COMPLETE')
