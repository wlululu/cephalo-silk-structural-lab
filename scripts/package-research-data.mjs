/** Byte packaging only. Never imports models, mechanical kernels or Blender. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
import {researchRoot as root,researchIndex as index,distribution,researchFile} from './research-files.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const name='cephalo-silk-research-data-minimal-v1.zip',entries={},manifest=[];
for(const [p,row] of Object.entries(index).sort(([a],[b])=>a.localeCompare(b))){
 const bytes=fs.readFileSync(researchFile(p));assert.equal(hash(bytes),row.sha256,p);assert.equal(bytes.length,row.bytes,p);
 entries['research/'+p]=[bytes,{mtime:new Date('2026-01-01T00:00:00Z')}];
 manifest.push({path:p,...row,...distribution.files[p],archive_path:'research/'+p});
}
entries['research/file-index.json']=[fs.readFileSync(path.join(root,'public/research/file-index.json')),{mtime:new Date('2026-01-01T00:00:00Z')}];
const bytes=zipSync(entries,{level:6});
const unzipped=unzipSync(bytes);for(const row of manifest)assert.equal(hash(unzipped[row.archive_path]),row.sha256,row.path);
fs.mkdirSync(path.join(root,'release-assets'),{recursive:true});fs.writeFileSync(path.join(root,'release-assets',name),bytes);
const counts={};for(const tier of ['website','archive']){const a=manifest.filter(r=>r.tier===tier);counts[tier]={files:a.length,bytes:a.reduce((s,r)=>s+r.bytes,0)};}
const location=JSON.parse(fs.readFileSync(path.join(root,'public/research/release-location.json')));
const release={schema:1,baseline:distribution.baseline,publication_status:location.status==='published'?'published':'not_published',archive:{name,bytes:bytes.length,sha256:hash(bytes)},counts,files:manifest};
fs.writeFileSync(path.join(root,'research-data/release-manifest.json'),JSON.stringify(release,null,2)+'\n');
fs.writeFileSync(path.join(root,'research-data/SHA256SUMS'),manifest.map(r=>`${r.sha256}  ${r.source}`).join('\n')+'\n');
const catalog={archive:release.archive,files:Object.fromEntries(manifest.map(r=>[r.path,{tier:r.tier,archive_path:r.archive_path}]))};
fs.writeFileSync(path.join(root,'public/research/download-catalog.json'),JSON.stringify(catalog,null,2)+'\n');
fs.writeFileSync(path.join(root,'release-assets/SHA256SUMS'),`${release.archive.sha256}  ${name}\n`);
console.log(JSON.stringify({status:'PASS',archive:release.archive,counts,source_bytes_unchanged:true,mechanics_executed:false},null,2));
