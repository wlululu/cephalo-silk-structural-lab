/** Public dependency closure and packaging only; no numerical execution. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {unzipSync} from 'fflate';
import {researchRoot as root,researchIndex as index,distribution} from '../scripts/research-files.mjs';
const A='phase2_scientific_assets_v1/';
const required=['FROZEN_RESPONSE_CATALOG.json','display-tables.json','SCIENTIFIC_SCOPE.md','asset-pairs.json','provenance.json',A+'camera_presets.json',A+'inputs/selections.json',A+'inputs/H3_metadata_erratum.json',A+'inputs/H3_node_id_map.v1.json',A+'inputs/B1_frozen_summary.json',A+'inputs/support_DOF_register.csv',A+'inputs/selected_boundary_and_excluded_connections.csv',A+'exports/B1_frozen_section_states.json',A+'exports/B1_inherited_source_register.json'];
for(const h of ['H0','H1','H2','H3']) required.push(A+`inputs/${h}.json`,A+`inputs/${h}_member_id_map.v1.json`);
const viewer=fs.readFileSync(path.join(root,'research/ResearchViewer.tsx'),'utf8');
for(const m of viewer.matchAll(/<Download p="([^"]+)"/g))if(!['file-index.json','download-catalog.json'].includes(m[1]))required.push(m[1]);
for(const p of required){assert.ok(index[p],p);assert.equal(distribution.files[p].tier,'website',p);}
const pairs=JSON.parse(fs.readFileSync(path.join(root,'public/research/asset-pairs.json')));
for(const group of Object.values(pairs.groups))for(const name of group)assert.equal(distribution.files[A+'schematics/'+name+'.svg'].tier,'website');
const forbidden=/(PROJECT_HANDOFF|TRANSFER_INSTRUCTIONS|RESEARCHER_ACCEPTANCE|PHASE[345]_|earlier_B1_history|original_case_exports|legacy_reference|researcher_approval|Decision_Sheet|preparation\.log)/i;
for(const p of Object.keys(index))assert.ok(!forbidden.test(p),'Internal or redundant public entry: '+p);
const archive=unzipSync(fs.readFileSync(path.join(root,'dist/downloads/cephalo-structural-lab.zip')));
for(const p of Object.keys(archive))assert.ok(!forbidden.test(p),'Internal entry in website source ZIP: '+p);
// Detect non-English CJK script in public text, without treating scientific symbols as prose.
let textFiles=0;
for(const [p,b] of Object.entries(archive))if(/\.(md|tsx|html|svg|csv|json)$/.test(p)){
 const t=new TextDecoder().decode(b);assert.ok(!/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(t),'Non-English script: '+p);textFiles++;
}
const report={status:'PASS',required_viewer_paths:required.length,public_index_files:Object.keys(index).length,website_source_text_files_scanned:textFiles,internal_artifact_exclusion:'PASS',schematic_pair_closure:'PASS',language_check:'CJK script scan; English prose also reviewed',mechanics_executed:false};
fs.writeFileSync(path.join(root,'test-output/research-public-scope-report.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
