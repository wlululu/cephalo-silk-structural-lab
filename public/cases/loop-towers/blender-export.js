/** Isolated Loop Towers Blender export. Read-only model + the ORIGINAL worker solver.
 * Visual envelope reproduces existing renderer's parametric cylinder and box-loop
 * sampling, distinct from its 2,208-member structural lattice.
 */
import * as THREE from 'three';
import {makeModel,towerCenter,floorRadius,upper,lower} from './model.js';
import {makeBlenderPackage,downloadBlenderPackage,captureVisualLayers,snapshotResponse} from '../../shared/blender-package.js';
const $=id=>document.getElementById(id);
const button=typeof document==='undefined'?null:document.createElement('button');
if(button){button.id='exportBlenderPackage';button.type='button';button.textContent='Export Blender Package';
document.querySelector('.downloads').appendChild(button);
}
const model=makeModel();
function solveCurrent(params){
 return new Promise((resolve,reject)=>{
  const w=new Worker('./worker.js',{type:'module'});
  const timeout=setTimeout(()=>{w.terminate();reject(Error('Existing analysis worker timed out'))},60000);
  w.onmessage=e=>{if(e.data.id!==1)return;clearTimeout(timeout);w.terminate();if(e.data.error)reject(Error(e.data.error));else resolve(e.data.result);};
  w.onerror=e=>{clearTimeout(timeout);w.terminate();reject(Error('Existing solver worker failed'))};
  w.postMessage({id:1,model,params});
 });
}
export function makeVisuals(result,view){
 const floorGroup=new THREE.Group(),ringGroup=new THREE.Group(),coreGroup=new THREE.Group();
 const mats={floor:new THREE.MeshStandardMaterial({color:0xd0d3c8}),glass:new THREE.MeshStandardMaterial({color:0x375b65}),core:new THREE.MeshStandardMaterial({color:0x81959a}),ring:new THREE.MeshStandardMaterial({color:0x3e6774})};
 const cylinder=new THREE.CylinderGeometry(1,1,1,48),box=new THREE.BoxGeometry(1,1,1);
 const rawDisp=n=>new THREE.Vector3(...result.u.slice(n*3,n*3+3));
 function rowDisp(row){const v=new THREE.Vector3();for(const id of row)v.add(rawDisp(id));return v.multiplyScalar(1/row.length);}
 function towerDisp(s,y){const rows=model.towerNodes[s],f=Math.max(0,Math.min(12,y/(s<0?140:152)*12)),lo=Math.min(11,Math.floor(f));return rowDisp(rows[lo]).lerp(rowDisp(rows[lo+1]),f-lo);}
 function ringDisp(name,t){const rows=model.rings[name],f=t*(name==='crown'?rows.length:rows.length-1),i=Math.floor(f),j=i+1;
  const lo=name==='crown'?i%rows.length:Math.min(i,rows.length-1),hi=name==='crown'?j%rows.length:Math.min(j,rows.length-1);
  return rowDisp(rows[lo]).lerp(rowDisp(rows[hi]),f-Math.floor(f));
 }
 const amp=view.deformed?view.display_amplification:0;
 const put=(geo,mat,p,scale,container,offset=new THREE.Vector3())=>{const o=new THREE.Mesh(geo,mat);o.position.set(...p);o.position.addScaledVector(offset,amp);o.scale.set(...scale);container.add(o);return o;};
 for(const s of [-1,1]){
  const H=s<0?140:152;
  for(let l=0;l<=Math.floor(H/3.8);l++){
   const y=l*3.8+1,c=towerCenter(s,y),r=floorRadius(s,y),d=towerDisp(s,y);
   put(cylinder,mats.floor,c,[r[0],.58,r[1]],floorGroup,d);
   if(y+3.8<H){const h=y+1.9;put(cylinder,mats.glass,[c[0],h,c[2]],[r[0]-1.1,3.1,r[1]-1],floorGroup,towerDisp(s,h));}
   const pts=Array.from({length:65},(_,i)=>{const t=i/64*Math.PI*2;return new THREE.Vector3(c[0]+r[0]*.99*Math.cos(t),y+.95,c[2]+r[1]*.99*Math.sin(t)).addScaledVector(d,amp)});
   floorGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xaac3c8})));
  }
  for(let l=0;l<12;l++){
   const y0=l*H/12,y1=(l+1)*H/12,c=towerCenter(s,(y0+y1)/2);
   put(box,mats.core,c,[8.5,H/12,7],coreGroup,towerDisp(s,c[1]));
  }
 }
 function smoothLoop(name,fn,n,closed){
  const positions=[],indices=[],mapping=[],count=closed?n:n+1;
  for(let i=0;i<count;i++){
   const t=i/n*(closed?Math.PI*2:Math.PI),p=fn(t),q=fn(t+.0001),dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy);
   for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){positions.push(p[0]-dy/L*a*1.35,p[1]+dx/L*a*1.35,p[2]+b*2.2);mapping.push(i/n);}
  }
  for(let i=0;i<(closed?count:count-1);i++)for(let j=0;j<4;j++){
   let a=i*4+j,b=i*4+(j+1)%4,c=((i+1)%count)*4+j,d=((i+1)%count)*4+(j+1)%4;
   indices.push(a,b,d,a,d,c);
  }
  const g=new THREE.BufferGeometry(),coords=Float32Array.from(positions);
  for(let i=0;i<coords.length;i+=3){const d=ringDisp(name,mapping[i/3]);coords[i]+=d.x*amp;coords[i+1]+=d.y*amp;coords[i+2]+=d.z*amp;}
  g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));g.setIndex(indices);g.computeVertexNormals();ringGroup.add(new THREE.Mesh(g,mats.ring));
  for(const a of [-1,1])for(const b of [-1,1]){
   const pts=[];for(let i=0;i<=n;i++){
    const t=i/n*(closed?Math.PI*2:Math.PI),p=fn(t),q=fn(t+.0001),dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy),d=ringDisp(name,i/n);
    pts.push(new THREE.Vector3(p[0]-dy/L*a*1.35,p[1]+dx/L*a*1.35,p[2]+b*2.2).addScaledVector(d,amp));
   }
   ringGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xc7dadd})));
  }
 }
 smoothLoop('crown',upper,192,true);smoothLoop('sweep',lower,160,false);
 // Architectural/structural visibility labels correspond to the original mode switch.
 floorGroup.visible=view.floors&&view.mode==='architecture';ringGroup.visible=view.mode==='architecture';coreGroup.visible=view.mode==='architecture';
 const visuals=captureVisualLayers([{name:'tower_floor_plates_and_facades',object:floorGroup},{name:'tower_core_visual_boxes',object:coreGroup},{name:'parametric_upper_and_lower_loop_envelopes',object:ringGroup}]);
 visuals.notes='Actual renderer parametric functions (towerCenter/floorRadius/upper/lower) and cylinder/box-loop sampling, recomputed in this independent adapter using current original-worker displacement. Occupied-floor vegetation and decorative circulation paths are NOT included; these are nonstructural architectural display only. Frozen app.js is unchanged.';
 for(const group of [floorGroup,ringGroup,coreGroup])group.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});
 return visuals;
}
if(button)button.onclick=async()=>{
 button.disabled=true;const label=button.textContent;button.textContent='Preparing Blender package…';
 try{
  const params={load:+$('load').value,stiffness:+$('stiffness').value,thickness:+$('thickness').value,case:$('loadcase').value};
  const view={mode:document.querySelector('[data-mode].selected')?.dataset.mode??'architecture',quantity:$('quantity').value,deformed:$('deformed').checked,display_amplification:+$('amplify').value,web:$('web').checked,floors:$('floors').checked,circulation:$('circulation').checked,animation_phase:'not captured: source animation is a visual-only phase-dependent multiplier'};
  let result=null;
  try{result=await solveCurrent(params);}catch(error){view.analysis_error=error.message;}
  view.analysis_state='fresh original-worker solve for parameters captured at export click';
  const valid=snapshotResponse('loop-towers',model,result).available;
  const visualLayers=makeVisuals(valid?result:{u:new Array(model.nodes.length*3).fill(0)},{...view,deformed:valid&&view.deformed});
  if(!valid)visualLayers.notes+=' Response unavailable; display layers exported undeformed.';
  const activeModel=structuredClone(model);activeModel.parameters={...params};
  for(const v of Object.values(activeModel.materials))v.E*=params.stiffness;
  for(const v of Object.values(activeModel.sections))v.area*=params.thickness**2;
  activeModel.loads=model.loads.filter(l=>l.case==='gravity'||l.case===params.case).map(l=>({...l,force:l.force.map(v=>v*params.load)}));
  activeModel.parameter_application='Parameters already applied to E, section areas and active nodal loads; do not apply twice.';
  const pack=await makeBlenderPackage({caseId:'loop-towers',model,result,parameters:params,view,visualLayers,parameterizedModel:activeModel,scriptUrl:'../../shared/open_in_blender.py'});
  downloadBlenderPackage(pack.zip,'loop-towers');
 }catch(err){console.error(err);alert('Blender export failed: '+err.message);}
 finally{button.disabled=false;button.textContent=label;}
};
