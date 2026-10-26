/** Isolated Pavilion Blender export adapter. Does not modify the case or solver. */
import {makeModel,surface,N} from './model.js';
import {solve} from './solver.js';
import {makeBlenderPackage,downloadBlenderPackage,snapshotResponse} from '../../shared/blender-package.js';
const $=id=>document.getElementById(id);
const button=typeof document==='undefined'?null:document.createElement('button');
if(button){button.id='exportBlenderPackage';button.type='button';button.textContent='Export Blender Package';
document.querySelector('.export').appendChild(button);
}
const model=makeModel();
export function wovenLayers(result,view){
 const items=[],stats={mesh:0,lines:0,points:0,vertices:0};
 const scale=view.display_amplification;
 const displacementAt=(u,v)=>{let x=Math.min(N-1,Math.floor(u*N)),y=Math.min(N-1,Math.floor(v*N)),a=u*N-x,b=v*N-y,ids=[x*(N+1)+y,(x+1)*(N+1)+y,x*(N+1)+y+1,(x+1)*(N+1)+y+1],w=[(1-a)*(1-b),a*(1-b),(1-a)*b,a*b];return [0,1,2].map(k=>ids.reduce((s,id,i)=>s+result.displacements[id][k]*w[i],0));};
 const point=(u,v)=>surface(u,v).map((p,i)=>p+scale*displacementAt(u,v)[i]);
 if(!view.woven) return {items,stats,notes:'Woven envelope unchecked: structural net remains complete in scene.glb'};
 if(view.mode==='concept' && view.quantity==='hierarchy'){
  const count=85,coords=[];
  const segment=(a,b)=>{coords.push(...point(...a),...point(...b));};
  for(let i=0;i<=count;i++)for(let j=0;j<count;j++){
   const u=i/count,v=j/count;
   segment([u,v],[u,(j+1)/count]);segment([v,u],[(j+1)/count,u]);
  }
  for(let i=0;i<count;i++)for(let j=0;j<count;j++){
   if((i+j)%2===0)segment([i/count,j/count],[(i+1)/count,(j+1)/count]);
   else segment([(i+1)/count,j/count],[i/count,(j+1)/count]);
  }
  items.push({name:'pavilion/fine_woven_envelope_source_85_samples',kind:'segments',vertices:coords,indices:Array.from({length:coords.length/3},(_,i)=>i),visible:true,opacity:.5,color:'#8aa8b8'});stats.lines++;stats.vertices+=coords.length/3;
  const vertices=[],indices=[];
  for(let i=0;i<=40;i++)for(let j=0;j<=40;j++)vertices.push(...point(i/40,j/40));
  for(let i=0;i<40;i++)for(let j=0;j<40;j++){let n=i*41+j;indices.push(n,n+41,n+42,n,n+42,n+1);}
  items.push({name:'pavilion/visual_translucent_envelope_no_shell_stiffness',kind:'mesh',vertices,indices,visible:true,opacity:.12,color:'#f1e9d4'});stats.mesh++;stats.vertices+=vertices.length/3;
 }else{
  const vertices=[];for(const m of model.members.filter(m=>m.section==='net'))for(const n of m.nodes)vertices.push(...model.nodes[n].position.map((p,i)=>p+scale*result.displacements[n][i]));
  items.push({name:'pavilion/coarse_analytical_net_display_lines',kind:'segments',vertices,indices:Array.from({length:vertices.length/3},(_,i)=>i),visible:true,opacity:.5,color:'#8aa8b8'});stats.lines++;stats.vertices+=vertices.length/3;
 }
 return {items,stats,notes:'Rendered net sampled from the SAME surface()/displacement interpolation and 85x85 / 40x40 densities as the frozen Pavilion application; visual fibers are not individual FE cable members.'};
}
if(button)button.onclick=async()=>{
 button.disabled=true;const label=button.textContent;button.textContent='Preparing Blender package…';
 try{
  const params={pressure:+$('pressure').value,stiffness:+$('stiffness').value,thickness:+$('thickness').value,loadCase:$('loadCase').value};
  let result=null;let analysisError=null;
  try{result=solve(model,params);}catch(error){analysisError=error.message;} // existing unchanged case solver, read-only fresh snapshot
  const mode=document.querySelector('[data-mode].selected')?.dataset.mode??'concept';
  const view={mode,quantity:$('quantity').value,display_amplification:+$('scale').value,woven:$('woven').checked,branches:$('branches').checked,ghost:$('ghost').checked};
  view.analysis_state='fresh original solver for parameters captured at export click';
  if(analysisError)view.analysis_error=analysisError;
  const valid=snapshotResponse('pavilion',model,result).available;
  const visualLayers=wovenLayers(valid?result:{displacements:model.nodes.map(()=>[0,0,0])},{...view,display_amplification:valid?view.display_amplification:0});
  if(!valid)visualLayers.notes+=' Response unavailable; display layers exported undeformed.';
  const activeModel={...model,activeParameters:params,activeLoad:{case:params.loadCase,pressure_Pa:params.pressure},parameter_application:'Baseline model retained. E times stiffness, CHS dimensions times thickness, equivalent net area times thickness squared.'};
  const pack=await makeBlenderPackage({caseId:'pavilion',model,result,parameters:params,view,visualLayers,parameterizedModel:activeModel,scriptUrl:'../../shared/open_in_blender.py'});
  downloadBlenderPackage(pack.zip,'pavilion');
 }catch(err){console.error(err);alert('Blender export failed: '+err.message);}
 finally{button.disabled=false;button.textContent=label;}
};
