// Exercise real Vite module serving and production HTTP paths, without a browser.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {writeFileSync,mkdirSync} from 'node:fs';
const server=await createServer({server:{port:0}});
const report=[];
try{
 await server.listen();
 const base=`http://127.0.0.1:${server.httpServer.address().port}`;
 for(const route of ['/cases/bridge/BridgeCase.tsx','/cases/bridge/blender-export.mjs','/shared/blender-package.js','/shared/open_in_blender.py','/cases/loop-towers/entry.js','/cases/loop-towers/blender-export.js','/cases/pavilion/entry.js','/cases/pavilion/blender-export.js']){
  const r=await fetch(base+route),s=await r.text();assert.equal(r.status,200,route);
  assert.ok(!s.includes('../../public/shared/blender-package.js'),'Source may not import public directory');
  if(route.endsWith('BridgeCase.tsx'))assert.ok(s.includes('shared/blender-package.js'));
  report.push({route,status:r.status});
 }
 mkdirSync('test-output',{recursive:true});writeFileSync('test-output/blender-vite-report.json',JSON.stringify(report,null,2));
}finally{
 // Finish the static-import crawl before close cancels it; optimized-dependency
 // transforms can otherwise remain pending in Vite's client plugin container.
 try{await server.environments.client.waitForRequestsIdle();}
 finally{await server.close();}
}
console.log('PASS Vite dev: transformed Bridge module and all export adapters/assets served correctly; server closed. Not a browser smoke test.');
