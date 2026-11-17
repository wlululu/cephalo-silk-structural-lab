/** Release organization and static dependency checks only; no mechanics. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {researchRoot as root,researchIndex as index,distribution,researchFile} from '../scripts/research-files.mjs';
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const manifest=read('research-data/release-manifest.json'),catalog=read('public/research/download-catalog.json'),location=read('public/research/release-location.json');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.deepEqual(Object.keys(distribution.files).sort(),Object.keys(index).sort());
assert.equal(manifest.files.length,Object.keys(index).length);assert.equal(catalog.archive.sha256,manifest.archive.sha256);
assert.equal(hash(path.join(root,'release-assets',manifest.archive.name)),manifest.archive.sha256);
assert.equal(manifest.publication_status,location.status==='published'?'published':'not_published');
let website=0,archive=0;
for(const [p,r] of Object.entries(distribution.files)){
 assert.equal(hash(researchFile(p)),index[p].sha256,p);
 assert.equal(catalog.files[p].tier,r.tier,p);
 const served=path.join(root,'dist/research',p);
 if(r.tier==='website'){website++;assert.equal(hash(served),index[p].sha256,p);}
 else {archive++;assert.ok(!fs.existsSync(served),'Archive-only file leaked into website: '+p);}
}
for(const r of read('public/research/FROZEN_RESPONSE_CATALOG.json')){
 for(const k of ['path','frozen_model_path','verification_path'])if(r[k])assert.equal(distribution.files[r[k]].tier,'website',r[k]+' must work offline in website');
}
// Exact static linked schematics and startup files must never require the release server.
const viewer=fs.readFileSync(path.join(root,'research/ResearchViewer.tsx'),'utf8');
for(const m of viewer.matchAll(/"(S_[A-Za-z0-9_]+)"/g))assert.equal(distribution.files['phase2_scientific_assets_v1/schematics/'+m[1]+'.svg'].tier,'website',m[1]);
assert.ok(!viewer.includes('href="#research-archive-download"'),'Anchors must not change the case hash route');
if(location.status==='preparation_only')assert.equal(location.published_url,null,'Do not advertise an unpublished URL');
else {assert.equal(location.status,'published');assert.ok(/^https:\/\/github\.com\/wlululu\/cephalo-silk-structural-lab\/releases\/download\/[A-Za-z0-9._-]+\/cephalo-silk-research-data-minimal-v1\.zip$/.test(location.published_url));}
for(const p of ['research/GeometryView.tsx','research/CanvasProjection.ts','research/archive.mjs']){
 // Distribution changes must not introduce execution of old kernels.
 assert.ok(!/from\s+['"][^'"]*(solver|hybrid|frame-element|BridgeCase)/.test(fs.readFileSync(path.join(root,p),'utf8')),p);
}
const result={status:'PASS',website_files:website,archive_files:archive,archive_hash:manifest.archive.sha256,catalog_runtime_dependencies:'PASS',scientific_source_bytes:'UNCHANGED',mechanics_executed:false};
fs.mkdirSync(path.join(root,'test-output'),{recursive:true});fs.writeFileSync(path.join(root,'test-output/research-distribution-report.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
