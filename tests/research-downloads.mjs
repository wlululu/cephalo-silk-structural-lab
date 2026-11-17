/** Static HTTP and byte identity only; never opens a case or executes a solver. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {researchFile,distribution} from '../scripts/research-files.mjs';
import {createStaticServer} from '../scripts/serve-static.mjs';
const root=path.resolve(import.meta.dirname,'..'),base=path.join(root,'public/research');
const index=JSON.parse(fs.readFileSync(path.join(base,'file-index.json')));
const hash=b=>createHash('sha256').update(b).digest('hex');
const types={'.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf','.csv':'text/csv','.glb':'model/gltf-binary','.md':'text/plain'};
const report=[];
for(const prefix of ['/','/cephalo-silk-structural-lab/']){
 const server=await createStaticServer(path.join(root,'dist'),{prefix,port:0});
 const origin=`http://127.0.0.1:${server.address().port}${prefix}`;
 try{for(const [p,item] of Object.entries(index)){
  if(distribution.files[p].tier!=='website')continue;
  const res=await fetch(origin+'research/'+p);assert.equal(res.status,200,p);const expected=types[path.extname(p)];if(expected)assert.ok(res.headers.get('content-type').startsWith(expected),p+' MIME');assert.equal(hash(Buffer.from(await res.arrayBuffer())),item.sha256,p+' download hash');
 }assert.equal((await fetch(origin+'research/missing.json')).status,404);report.push({prefix,files:Object.values(distribution.files).filter(r=>r.tier==='website').length,hashes:'PASS',mime:'PASS',missing_file_404:'PASS'});
 }finally{await new Promise(r=>server.close(r));}
}
const archive=unzipSync(fs.readFileSync(path.join(root,'dist/downloads/cephalo-structural-lab.zip')));
for(const [p,item] of Object.entries(index)){
 if(distribution.files[p].tier==='website')assert.equal(hash(archive['cephalo-structural-lab/public/research/'+p]),item.sha256,'Website source ZIP '+p);
 else assert.ok(!archive['cephalo-structural-lab/research-data/files/'+p], 'Archive payload must not inflate website source ZIP');
}
const dataArchive=unzipSync(fs.readFileSync(path.join(root,'release-assets/cephalo-silk-research-data-minimal-v1.zip')));
for(const [p,item] of Object.entries(index))assert.equal(hash(dataArchive['research/'+p]),item.sha256,'Complete data ZIP '+p);
const glbs=Object.keys(index).filter(p=>p.startsWith('phase2_scientific_assets_v1/exports/')&&p.endsWith('.glb'));
for(const p of glbs){const b=fs.readFileSync(researchFile(p));assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);const length=b.readUInt32LE(12),g=JSON.parse(b.toString('utf8',20,20+length));let ids=[];for(const n of g.nodes){if(!n.extras?.original_member_ids)continue;const selected=n.extras.original_member_ids;const primitive=g.meshes[n.mesh].primitives[0];assert.equal(g.accessors[primitive.attributes.POSITION].count,selected.length*20,p+' ordered two-ring layout');ids.push(...selected);}
 assert.equal(new Set(ids).size,ids.length,p+' duplicate IDs');const hypothesis=p.match(/exports\/(H\d)\//)?.[1];const source=JSON.parse(fs.readFileSync(path.join(base,'phase2_scientific_assets_v1/'+(hypothesis?`inputs/${hypothesis}.json`:'exports/B1_inherited_source_register.json'))));assert.deepEqual(ids.toSorted((a,b)=>a-b),source.members.map(m=>m.id).toSorted((a,b)=>a-b),p+' complete original ID set');}
const result={status:'PASS',http:report,data_zip_entries_checked:Object.keys(index).length,website_source_entries_checked:Object.values(distribution.files).filter(r=>r.tier==='website').length,pure_export_glbs_checked:glbs.length,picking_uses:'JSON source IDs, not GLB vertex ordering',mechanics_executed:false};fs.writeFileSync(path.join(root,'test-output/research-downloads-report.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
