/** Presentation and release-availability checks; no browser or mechanical execution. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('research/ResearchData.tsx');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const module={exports:{}};
new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);
const Data=module.exports.default;
const render=release=>renderToStaticMarkup(React.createElement(Data,{release,scopeUrl:'/repo/research/SCIENTIFIC_SCOPE.md'}));
const url='https://github.com/wlululu/cephalo-silk-structural-lab/releases/download/example/data.zip';
const cases=[
 {release:{status:'preparation_only',published_url:null},available:false},
 {release:{status:'preparation_only',published_url:url},available:false},
 {release:{status:'published',published_url:null},available:false},
 {release:{status:'published',published_url:url},available:true},
];
for(const c of cases){
 const html=render(c.release);
 assert.equal(html.includes('Download research data'),c.available);
 assert.ok(!/not yet published|publication status|preparation status|role="status"/i.test(html));
 assert.equal(html.includes(`href="${url}"`),c.available);
 assert.ok(html.includes('href="https://github.com/wlululu/cephalo-silk-structural-lab"'));
 assert.ok(html.includes('Research Data &amp; Source Code'));
 assert.ok(html.includes('/repo/research/SCIENTIFIC_SCOPE.md'));
 assert.ok(!/SHA-256|checksum|file-index|indexed files|Browse frozen|Filter downloads/.test(html));
}
const viewer=read('research/ResearchViewer.tsx');
assert.ok(!/FileBrowser|Browse frozen files|Filter downloads|r3-hash|SHA-256|CEPHALO-SILK/.test(viewer));
assert.ok(viewer.includes('await verifyBytes(bytes, files[p]?.sha256)'));
assert.ok(viewer.includes('modelHash = files[record.frozen_model_path].sha256'));
assert.ok(viewer.includes('adaptResponse(record, raw,'));
assert.ok(viewer.includes('<ResearchData release={releaseLocation}'));
for(const p of ['index.html','main.tsx','shared/Platform.tsx','README.md','docs/research/RELEASE_NOTES.md']){
 assert.ok(read(p).includes('3D Structural Studio'),p);
 assert.ok(!/Cephalo-Silk|CEPHALO-SILK/.test(read(p)),p);
}
for(const p of ['README.md','shared/Platform.tsx'])assert.ok(read(p).includes('From Bioinspired Images to Executable Structural Models'));
for(const c of ['loop-towers','pavilion']) assert.ok(read(`public/cases/${c}/entry.js`).includes('3D Structural Studio'));
const release=JSON.parse(read('public/research/release-location.json'));
assert.equal(release.status,'published');
assert.equal(release.published_url,"https://github.com/wlululu/cephalo-silk-structural-lab/releases/download/research-viewer-minimal-v1/cephalo-silk-research-data-minimal-v1.zip");
assert.ok(render(release).includes('Download research data'));
assert.ok(!render(release).includes('not yet published'));
assert.ok(viewer.includes('<h1>Structural Models &amp; Mechanics</h1>'));
assert.ok(viewer.includes('Explore image-informed 3D structural interpretations, compare their mechanical responses, and examine mechanics-guided material efficiency.'));
assert.ok(!viewer.includes('3D Structural Studio / Research Studies'));
assert.ok(!viewer.includes('Structural hypotheses and archived responses'));
const report={status:'PASS',release_availability_states:cases.length,checksum_display_removed:true,integrity_verification_retained:true,branding_consistent:true,mechanics_executed:false,browser_executed:false};
fs.mkdirSync(path.join(root,'test-output'),{recursive:true});fs.writeFileSync(path.join(root,'test-output/public-branding-report.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
