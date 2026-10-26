/** Execute the actual legacy export click handlers with Node DOM/Worker shims.
 * The original worker executes in a real Node worker thread. This is NOT a browser test.
 */
import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {unzipSync} from 'fflate';
const nativeFetch=globalThis.fetch, nativeTimeout=globalThis.setTimeout;
globalThis.setTimeout=(fn,ms,...args)=>{const timer=nativeTimeout(fn,ms,...args);timer.unref();return timer;};
const script=readFileSync(new URL('../public/shared/open_in_blender.py',import.meta.url),'utf8');
globalThis.fetch=(url,...args)=>String(url).endsWith('open_in_blender.py')?Promise.resolve(new Response(script)):nativeFetch(url,...args);
const checks=[];
for(const id of ['loop-towers','pavilion']){
 const {makeModel}=await import(`../public/cases/${id}/model.js`),{solve}=await import(`../public/cases/${id}/solver.js`);
 const controls={},buttons=[];let downloaded,mode=id==='loop-towers'?'architecture':'concept';
 const host={appendChild:b=>buttons.push(b)};
 globalThis.document={body:{append(){}},getElementById:k=>controls[k],querySelector:s=>s==='[data-mode].selected'?{dataset:{mode}}:host,
  createElement:tag=>tag==='button'?{}:{style:{},click(){downloaded=nativeFetch(this.href).then(r=>r.arrayBuffer());},remove(){}}};
 globalThis.alert=message=>{throw Error(message)};
 const workerUrl=new URL(`../public/cases/${id}/worker.js`,import.meta.url).href;
 globalThis.Worker=class {
  constructor(){this.thread=new NodeWorker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:data=>parentPort.postMessage(data)};import(${JSON.stringify(workerUrl)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',e=>this.onerror?.(e));}
  postMessage(data){this.thread.postMessage(data);}
  terminate(){this.thread.terminate();}
 };
 await import(`../public/cases/${id}/blender-export.js?adapter-test`);
 assert.equal(buttons.length,1);const button=buttons[0];assert.equal(button.textContent,'Export Blender Package');
 for(const variant of [false,true]){
  const params=id==='loop-towers'?{load:variant?1.2:1,stiffness:1,thickness:variant?1.25:1,case:variant?'wind':'gravity'}:{pressure:variant?400:300,stiffness:1,thickness:variant?1.2:1,loadCase:variant?'Uplift':'Gravity'};
  for(const [k,v] of Object.entries(params))controls[k==='case'?'loadcase':k]={value:String(v)};
  Object.assign(controls,{quantity:{value:id==='loop-towers'?'displacement':'hierarchy'},deformed:{checked:variant},amplify:{value:'100'},scale:{value:variant?'15':'0'},web:{checked:true},floors:{checked:true},circulation:{checked:false},woven:{checked:true},branches:{checked:true},ghost:{checked:true}});
  const click=button.onclick();assert.equal(button.disabled,true);
  // Change UI while a real worker is in flight. The ZIP must retain click-time values.
  if(id==='loop-towers'){controls.thickness.value='1.7';controls.amplify.value='300';controls.floors.checked=false;}
  await click;assert.equal(button.disabled,false);assert.ok(downloaded,'No download triggered');
  const files=unzipSync(new Uint8Array(await downloaded)),parse=n=>JSON.parse(new TextDecoder().decode(files[n]));
  const meta=parse('metadata.json'),response=parse('response.json');assert.deepEqual(meta.state.parameters,params);
  if(id==='loop-towers'){assert.equal(meta.state.view.display_amplification,100);assert.equal(meta.state.view.floors,true);}
  assert.equal(meta.response.available,true);const model=makeModel(),expected=solve(model,params);
  assert.deepEqual(parse('solver_result.json'),expected);
  assert.deepEqual(parse('structural_model.json'),model);
  assert.equal(response.displacement_vectors_m.length,model.nodes.length);
  assert.ok(parse('visual_layers.json').items.length>0);
  checks.push({case:id,variant,parameters:params,actual_click_handler:true,download_zip:true,original_solver_result_exact:true,scope:'Node DOM/Worker shims; not browser'});
  console.log('PASS export handler',id,variant?'modified':'baseline');
 }
}
mkdirSync('test-output',{recursive:true});writeFileSync('test-output/blender-adapter-report.json',JSON.stringify(checks,null,2)+'\n');
