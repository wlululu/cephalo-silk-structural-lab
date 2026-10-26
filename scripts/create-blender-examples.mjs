/** Reproducible full packages using original models/solvers and the UI export adapters.
 * This is offline generation, NOT a browser download test. No scientific files are written.
 */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createModel,defaults as bridgeDefaults} from '../cases/bridge/model.mjs';
import {makeModel as towers,defaults as towerDefaults} from '../public/cases/loop-towers/model.js';
import {makeModel as pavilion} from '../public/cases/pavilion/model.js';
import {solve as solveBridge} from '../public/cases/bridge/solver.mjs';
import {solve as solveTower} from '../public/cases/loop-towers/solver.js';
import {solve as solvePavilion} from '../public/cases/pavilion/solver.js';
import {bridgeGlb} from '../cases/bridge/blender-export.mjs';
import {makeVisuals} from '../public/cases/loop-towers/blender-export.js';
import {wovenLayers} from '../public/cases/pavilion/blender-export.js';
import {makeBlenderPackage} from '../public/shared/blender-package.js';
// GLTFExporter uses FileReader in browsers. Node's Blob supplies the same bytes.
if(!globalThis.FileReader)globalThis.FileReader=class {
 readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}
 readAsDataURL(blob){blob.arrayBuffer().then(value=>{this.result='data:'+blob.type+';base64,'+Buffer.from(value).toString('base64');this.onloadend?.();});}
};
const root=resolve(import.meta.dirname,'..'),output=resolve(process.argv[2]||join(root,'test-output','blender-examples'));
const variants=process.argv.includes('--variants');
mkdirSync(output,{recursive:true});
const scriptUrl='data:text/plain;base64,'+readFileSync(join(root,'public/shared/open_in_blender.py')).toString('base64');
const configs=[
 {id:'bridge',make:createModel,solve:solveBridge,base:{...bridgeDefaults,selectedNode:13},variant:{primaryScale:1.25}},
 {id:'loop-towers',make:towers,solve:solveTower,base:towerDefaults,variant:{thickness:1.25,case:'wind',load:1.2}},
 {id:'pavilion',make:pavilion,solve:solvePavilion,base:{pressure:300,stiffness:1,thickness:1,loadCase:'Gravity'},variant:{thickness:1.2,pressure:400,loadCase:'Uplift'}}
];
const report=[];
for(const c of configs)for(const variant of variants?[false,true]:[false]){
 const parameters={...c.base,...(variant?c.variant:{})};
 const model=c.make(parameters),before=JSON.stringify(model),result=c.solve(model,parameters);
 const afterSolve=JSON.stringify(model);
 let glb=null,visualLayers=null,parameterizedModel=null;
 const view={baseline:!variant,mode:c.id==='loop-towers'?'architecture':'concept',quantity:'hierarchy',deformed:false,display_amplification:0,floors:true,woven:true,branches:true,analysis_state:'offline original-solver execution; not a browser capture'};
 if(c.id==='bridge')glb=await bridgeGlb(model,result,view);
 if(c.id==='loop-towers'){
  visualLayers=makeVisuals(result,view);
  parameterizedModel=structuredClone(model);parameterizedModel.parameters={...parameters};
  for(const v of Object.values(parameterizedModel.materials))v.E*=parameters.stiffness;
  for(const v of Object.values(parameterizedModel.sections))v.area*=parameters.thickness**2;
  parameterizedModel.loads=model.loads.filter(l=>l.case==='gravity'||l.case===parameters.case).map(l=>({...l,force:l.force.map(v=>v*parameters.load)}));
  parameterizedModel.parameter_application='Parameters already applied to E, section areas and active nodal loads; do not apply twice.';
 }
 if(c.id==='pavilion'){
  visualLayers=wovenLayers(result,view);
  parameterizedModel={...model,activeParameters:parameters,activeLoad:{case:parameters.loadCase,pressure_Pa:parameters.pressure},parameter_application:'Baseline model retained. E times stiffness, CHS dimensions times thickness, equivalent net area times thickness squared.'};
 }
 const {zip,metadata,files}=await makeBlenderPackage({caseId:c.id,model,result,parameters,view,visualLayers,parameterizedModel,glb,scriptUrl});
 assert.equal(JSON.stringify(model),afterSolve,'Export mutated model');
 assert.equal(before,afterSolve,'Original solver mutated model');
 assert.equal(metadata.response.available,true,'Response must be converged and complete');
 const label=c.id+(variant?'-modified':'');
 const dir=join(output,label);mkdirSync(dir,{recursive:true});
 for(const [name,value] of Object.entries(files))writeFileSync(join(dir,name),value);
 writeFileSync(join(output,`cephalo-silk-${label}-blender.zip`),Buffer.from(await zip.arrayBuffer()));
 report.push({case:c.id,variant,parameters,...metadata.structural,response:metadata.response,max_displacement_m:result.maxDisplacement,max_deck_displacement_m:result.maxDeckDisplacement,relative_residual:result.relativeResidual,model_unchanged:true});
 console.log('PASS full package',label,JSON.stringify(report.at(-1)));
 writeFileSync(join(output,'generation-report.json'),JSON.stringify(report,null,2)+'\n');
}
