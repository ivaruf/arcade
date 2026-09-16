/** Seat surfaces match the generated cedar benches and aquarium stools. */
export const SEATS = [
  {name:'Welcome bench',x:-4.6,z:-1,y:.415,floor:0,yaw:Math.PI/2},
  {name:'Welcome bench',x:4.6,z:-.385,y:.415,floor:0,yaw:-Math.PI/2},
  ...[-2.2,2.2].map(x=>({name:'Garden bench',x,z:20.2,y:6.36,floor:6,yaw:Math.PI})),
  ...[-21.7,-19.9,-18.1,-16.3].map(z=>({name:'Aquarium stool',x:1.4,z,y:-1.82,floor:-2.5,yaw:-Math.PI/2})),
];
export function seatNear(position) {
  let best=null,distance=1.05;
  for(const seat of SEATS) {
    if(Math.abs(position.y-seat.floor)>.3)continue;
    const x=seat.x+Math.sin(seat.yaw)*.85,z=seat.z+Math.cos(seat.yaw)*.85;
    const d=Math.hypot(position.x-x,position.z-z);
    if(d<distance){distance=d;best=seat;}
  }
  return best;
}
