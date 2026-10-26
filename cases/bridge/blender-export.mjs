/** Export-only adapter: canonical geometry, semantic grouping, no model mutation. */
import {Group} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {geometry} from './geometry.mjs';
export async function bridgeGlb(model,result,view={}) {
 const g=geometry(model,result,{...view,mode:'hierarchy',deformed:false,ghost:false,region:'all',deck:true,nodes:false,loads:false,clearance:false},false);
 try {
  const groups=new Map();
  for(const child of [...g.children]){
   const key=child.userData.member!==undefined?'Structural_'+child.userData.system:'Visual_only';
   if(!groups.has(key)){const group=new Group();group.name=key;group.userData.scientific_role=key==='Visual_only'?'display only; no shell stiffness':'analytical members';groups.set(key,group);g.add(group);}
   groups.get(key).add(child);
  }
  g.updateMatrixWorld(true);
  return await new GLTFExporter().parseAsync(g,{binary:true});
 } finally {
  g.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});
 }
}
