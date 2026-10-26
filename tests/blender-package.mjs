import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
function unzipStore(data){
 const view=new DataView(data.buffer,data.byteOffset,data.byteLength),files={};let offset=0;
 while(offset<data.length){if(view.getUint32(offset,true)!==0x04034b50)break;
  const method=view.getUint16(offset+8,true),size=view.getUint32(offset+18,true),nameSize=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
  assert.equal(method,0,'STORE method expected');const name=new TextDecoder().decode(data.slice(offset+30,offset+30+nameSize));
  files[name]=data.slice(offset+30+nameSize+extra,offset+30+nameSize+extra+size);
  offset+=30+nameSize+extra+size;
 }return files;
}
import {createModel, defaults as bridgeDefaults} from '../cases/bridge/model.mjs';
import {makeModel as towers, defaults as towerDefaults} from '../public/cases/loop-towers/model.js';
import {makeModel as pavilion} from '../public/cases/pavilion/model.js';
import {structuralGlb, validateModel, makeBlenderPackage, snapshotResponse, getEnds} from '../public/shared/blender-package.js';

const cases=[['bridge',createModel(),bridgeDefaults],['loop-towers',towers(),towerDefaults],['pavilion',pavilion(),{pressure:300,thickness:1,stiffness:1,loadCase:'Gravity'}]];
const getDoc=bytes=>{
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert.equal(dv.getUint32(0,true),0x46546c67);
 assert.equal(dv.getUint32(4,true),2);
 assert.equal(dv.getUint32(8,true),bytes.length);
 const len=dv.getUint32(12,true);
 return JSON.parse(new TextDecoder().decode(bytes.slice(20,20+len)));
};
const sourceScript=readFileSync(new URL('../public/shared/open_in_blender.py',import.meta.url),'utf8');
globalThis.fetch=async()=>({ok:true,text:async()=>sourceScript});
for(const [id,model,baseParams] of cases){
 const before=JSON.stringify(model),topo=validateModel(model);
 const archivedPath=new URL(`../public/cases/${id}/model.json`,import.meta.url);
 if(existsSync(archivedPath)){
  const archived=JSON.parse(readFileSync(archivedPath,'utf8'));
  assert.deepEqual(model.nodes,archived.nodes,id+' source node list must match archived model');
  assert.equal(model.members.length,archived.members.length);
  if(id==='bridge'){
   // Historic bridge JSON uses slightly different last-bit computed moments of
   // inertia, but all endpoints/connectivity/member classifications/diameters
   // must remain identical. Solver preservation is checked by existing tests.
   for(let k=0;k<model.members.length;k++){
    const a=model.members[k],b=archived.members[k];
    assert.deepEqual([a.id,a.a,a.b,a.system,a.type,a.region,a.material,a.behavior,a.section.outerDiameter],
      [b.id,b.a,b.b,b.system,b.type,b.region,b.material,b.behavior,b.section.outerDiameter]);
    for(const prop of Object.keys(a.section)){
     if(typeof a.section[prop]==='number')assert.ok(Math.abs(a.section[prop]-b.section[prop])<1e-12,'section differs more than FP tolerance');
     else assert.deepEqual(a.section[prop],b.section[prop]);
    }
   }
  }else assert.deepEqual(model.members,archived.members,id+' source members must match archived model');
  console.log('PASS archived authoritative model comparison:',id);
 }else console.log('SKIP archived model file comparison (isolated test fixture):',id);
 const expected={};for(const m of model.members){const [ids,a,b]=getEnds(model,m);assert.equal(ids.length,2);assert.ok(a.every(Number.isFinite));assert.ok(b.every(Number.isFinite));const key=String(m.system??m.group??m.section??m.type??'members');expected[key]=(expected[key]||0)+1;}
 assert.deepEqual(topo.groupCounts,expected);
 const baseline=structuralGlb({caseId:id,model,parameters:baseParams});
 assert.deepEqual(baseline.groupCounts,expected);
 assert.equal(baseline.triangleCount,model.members.length*20,'Each member should be 10 radial quads = 20 triangles');
 const doc=getDoc(baseline.glb);
 assert.equal(doc.meshes.length,Object.keys(expected).length);
 assert.equal(doc.accessors.length,doc.meshes.length*2);
 assert.equal(doc.nodes.length,doc.meshes.length);
 assert.ok(doc.accessors.every(a=>!a.min||a.min.every(Number.isFinite)));
 // Read every member cylinder back from GLB and compare both ring centers/radii
 // against the original source node coordinates and export radius definitions.
 const viewGLB=new DataView(baseline.glb.buffer,baseline.glb.byteOffset,baseline.glb.byteLength);
 const binaryStart=28+viewGLB.getUint32(12,true);
 const membersById=new Map(model.members.map(m=>[m.id,m]));
 for(const item of doc.nodes){
  const ids=item.extras.original_member_ids;
  const accessor=doc.accessors[doc.meshes[item.mesh].primitives[0].attributes.POSITION];
  const start=binaryStart+doc.bufferViews[accessor.bufferView].byteOffset;
  assert.equal(accessor.count,ids.length*20);
  for(let k=0;k<ids.length;k++){
   const m=membersById.get(ids[k]);assert.ok(m,'Unexpected member exported');
   const [,a,b]=getEnds(model,m),radius=baseline.radii[ids[k]].r_m;
   for(let end=0;end<2;end++){
    const center=end?b:a,mean=[0,0,0];
    for(let j=0;j<10;j++){
     const ix=(k*20+end*10+j)*3;
     const xyz=[0,1,2].map(t=>viewGLB.getFloat32(start+(ix+t)*4,true));
     const distance=Math.hypot(...xyz.map((v,t)=>v-center[t]));
     assert.ok(Math.abs(distance-radius)<2e-5,id+' radius mismatch: member '+ids[k]);
     for(let t=0;t<3;t++)mean[t]+=xyz[t]/10;
    }
    assert.ok(Math.hypot(...mean.map((v,t)=>v-center[t]))<2e-5,id+' endpoint mismatch: member '+ids[k]);
   }
  }
 }
 const modified=id==='bridge'?{...baseParams,primaryScale:1.25}:id==='loop-towers'?{...baseParams,thickness:1.25,stiffness:1.2,load:1.3,case:'wind'}:{...baseParams,thickness:1.2,pressure:400,loadCase:'Uplift'};
 const after=structuralGlb({caseId:id,model,parameters:modified});
 assert.deepEqual(after.groupCounts,expected);
 if(id!=='bridge')assert.notDeepEqual(after.radii,baseline.radii,'Changed thickness must alter visual member radii');
 else assert.deepEqual(after.radii,baseline.radii,'Bridge geometry is controlled by the regenerated live model, NOT duplicate post-scaling');
 const displacement=model.nodes.map((_,i)=>[i*1e-7,0,0]);
 const result=id==='bridge'?{nodes:displacement.map(displacement=>({displacement})),maxDisplacement:1e-4,relativeResidual:1e-9,converged:true}:id==='loop-towers'?{u:Float64Array.from(displacement.flat()),maxDisplacement:1e-4,relativeResidual:1e-9,converged:true}: {displacements:displacement,maxDisplacement:1e-4,relativeResidual:1e-9,converged:true};
 assert.equal(snapshotResponse(id,model,result).available,true);
 const {zip,metadata}=await makeBlenderPackage({caseId:id,model,result,parameters:modified,view:{deformed:false},scriptUrl:'open_in_blender.py'});
 const unzipped=unzipStore(new Uint8Array(await zip.arrayBuffer()));
 assert.equal(new TextDecoder().decode(unzipped['open_in_blender.py']),sourceScript,id+' ZIP must embed the exact canonical Blender helper');
 assert.deepEqual(Object.keys(unzipped).sort(),['README.md','metadata.json','open_in_blender.py','response.json','scene.glb','structural_model.json','solver_result.json'].sort());
 const contents=JSON.parse(new TextDecoder().decode(unzipped['structural_model.json']));
 assert.deepEqual(contents.nodes,model.nodes);
 assert.deepEqual(contents.members,model.members);
 assert.equal(JSON.parse(new TextDecoder().decode(unzipped['response.json'])).displacement_vectors_m.length,model.nodes.length);
 assert.deepEqual(getDoc(unzipped['scene.glb']).nodes.map(n=>n.name),doc.nodes.map(n=>n.name));
 if(id==='loop-towers')assert.ok(Array.isArray(JSON.parse(new TextDecoder().decode(unzipped['solver_result.json'])).u),'Typed solver arrays must be serialized as ordinary arrays');
 assert.equal(metadata.structural.memberCount,model.members.length);
 assert.equal(metadata.state.modified,true,'Changed UI parameters must be recorded in metadata');
 assert.equal(JSON.stringify(model),before,'Export MUST NOT mutate model');
 console.log('PASS',id,'nodes',model.nodes.length,'members',model.members.length,'groups',JSON.stringify(expected),'zip-bytes',zip.size);
}
const changedBridge=createModel({primaryScale:1.25});
assert.equal(changedBridge.nodes.length,cases[0][1].nodes.length);
assert.equal(changedBridge.members.length,cases[0][1].members.length);
const changedBridgeGlb=structuralGlb({caseId:'bridge',model:changedBridge,parameters:changedBridge.settings});
assert.ok(changedBridgeGlb.radii[0].r_m>structuralGlb({caseId:'bridge',model:cases[0][1]}).radii[0].r_m,'Bridge section changes must come from regenerated source model');
console.log('PASS all three: topology/group counts, GLB endpoint coordinates and radii, changed parameters, response vectors, ZIP/GLB, model immutability');

// Fail closed: incomplete/nonconverged solver state must never look usable.
for(const [id,model,params] of cases){
 const vectors=model.nodes.map(()=>[.001,-.002,.003]);
 const result={converged:true,relativeResidual:1e-9,...(id==='bridge'?{nodes:vectors.map(displacement=>({displacement}))}:id==='loop-towers'?{u:vectors.flat()}:{displacements:vectors})};
 assert.equal(snapshotResponse(id,model,null).available,false);
 for(const invalid of [{...result,converged:false},{...result,relativeResidual:NaN},{...result,relativeResidual:1},{...result,relativeResidual:undefined}]){
  const pack=await makeBlenderPackage({caseId:id,model,result:invalid,parameters:params,scriptUrl:'open_in_blender.py'});
  assert.equal(pack.metadata.response.available,false);
  assert.ok(!('solver_result.json' in pack.files));
  assert.ok('solver_attempt.json' in pack.files);
 }
 const a=await makeBlenderPackage({caseId:id,model,result,parameters:params,view:{scale:1},scriptUrl:'open_in_blender.py'});
 const b=await makeBlenderPackage({caseId:id,model,result,parameters:params,view:{scale:300},scriptUrl:'open_in_blender.py'});
 assert.equal(a.files['response.json'],b.files['response.json'],'Display scale must not amplify solver response');
 assert.deepEqual(a.files['scene.glb'],b.files['scene.glb'],'Structural geometry must remain undeformed');
 console.log('PASS response guards and display-scale isolation:',id);
}
