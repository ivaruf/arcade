"""Check the self-contained static GLB export (standard Python only)."""
import json, math, struct
from pathlib import Path
path=Path(__file__).resolve().parent.parent/'cloud-world.glb'
b=path.read_bytes();magic,version,length=struct.unpack_from('<4sII',b)
assert (magic,version,length)==(b'glTF',2,len(b)), 'Invalid GLB header'
n,kind=struct.unpack_from('<II',b,12);assert kind==0x4E4F534A
d=json.loads(b[20:20+n]);start=20+n;size,kind=struct.unpack_from('<II',b,start);assert kind==0x004E4942
binary=memoryview(b)[start+8:start+8+size]
assert not d.get('animations'), 'Environment should be static'
assert all('uri' not in x for x in d.get('buffers',[])+d.get('images',[])), 'External resource'
names=[x.get('name','') for x in d['nodes']]
for tag in ['Welcome','Race','Water','Mine','Calm','Dam','Adventure']:assert tag+' sculpted cloud' in names
assert len([n for n in names if n.startswith('Fishtank ') and not n.startswith('Fishtank scenery')])==6
for name in ['Clear aquarium glazing','Smoked pavilion glazing']:
 m=next(m for m in d['materials'] if m['name']==name);assert m['alphaMode']=='BLEND'
for mesh in d['meshes']:
 for primitive in mesh['primitives']:
  acc=d['accessors'][primitive['attributes']['POSITION']];assert acc['componentType']==5126
  view=d['bufferViews'][acc['bufferView']];offset=view.get('byteOffset',0)+acc.get('byteOffset',0);stride=view.get('byteStride',12)
  for i in range(acc['count']):assert all(math.isfinite(v) for v in struct.unpack_from('<3f',binary,offset+i*stride))
print(f'Checked {len(d["meshes"])} meshes; seven islands, six fish, embedded resources, transparent glazing and finite positions. {len(b)/1048576:.1f} MiB.')
