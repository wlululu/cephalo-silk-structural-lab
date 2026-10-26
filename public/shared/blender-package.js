/** Visualization-only browser export, with no solver or browser runtime dependencies.
 * Structural connectivity/coordinates are copied verbatim from the live case model.
 * GLB tube tessellation is an export representation, NOT a replacement model.
 */
export const EXPORT_VERSION = '1.1.0';
const encoder = new TextEncoder();
const round4 = n => (n + 3) & ~3;
const json = data => JSON.stringify(data, (key,value) => ArrayBuffer.isView(value) && !(value instanceof DataView) ? Array.from(value) : value, 2) + '\n';
const M = {bridge: 'Twin-Arch Web Bridge', 'loop-towers': 'Loop Towers', pavilion: 'Woven-Wing Pavilion'};
const BASE_PARAMETERS = {bridge:{loadCase:'uniform',pressure:5,pointLoad:500,E:200,primaryScale:1,secondaryScale:1,selectedNode:13,nodeLoad:0,cablePrestress:80},'loop-towers':{stiffness:1,thickness:1,load:1,case:'gravity'},pavilion:{pressure:300,stiffness:1,thickness:1,loadCase:'Gravity'}};

function crc32(bytes) {
  let c = -1;
  for (const b of bytes) { c ^= b; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return (c ^ -1) >>> 0;
}
const u16 = (view, off, v) => view.setUint16(off, v, true);
const u32 = (view, off, v) => view.setUint32(off, v, true);
/** Uncompressed ZIP (STORE): deterministic, lossless, no package/CDN dependency. */
export function zipFiles(files) {
  const list = Object.entries(files).map(([name, value]) => {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name === '..') throw Error('Unsafe archive path ' + name);
    const data = value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : encoder.encode(value);
    return {name: encoder.encode(name), data, crc: crc32(data)};
  });
  const local = [], central = []; let offset = 0;
  for (const f of list) {
    if (f.name.length > 65535 || f.data.length > 0xffffffff) throw Error('ZIP64 is unsupported');
    const lh = new Uint8Array(30 + f.name.length), l = new DataView(lh.buffer);
    u32(l, 0, 0x04034b50); u16(l, 4, 20); u16(l, 6, 0x800); u32(l, 14, f.crc);
    u32(l, 18, f.data.length); u32(l, 22, f.data.length); u16(l, 26, f.name.length); lh.set(f.name, 30);
    const ch = new Uint8Array(46 + f.name.length), c = new DataView(ch.buffer);
    u32(c, 0, 0x02014b50); u16(c, 4, 20); u16(c, 6, 20); u16(c, 8, 0x800);
    u32(c, 16, f.crc); u32(c, 20, f.data.length); u32(c, 24, f.data.length); u16(c, 28, f.name.length);
    u32(c, 42, offset); ch.set(f.name, 46);
    local.push(lh, f.data); central.push(ch); offset += lh.length + f.data.length;
  }
  const n = central.reduce((s, b) => s + b.length, 0), end = new Uint8Array(22), v = new DataView(end.buffer);
  u32(v, 0, 0x06054b50); u16(v, 8, list.length); u16(v, 10, list.length); u32(v, 12, n); u32(v, 16, offset);
  return new Blob([...local, ...central, end], {type: 'application/zip'});
}

const lerp = (a, b, t) => a.map((x, j) => x * (1 - t) + b[j] * t);
const norm = a => {const d = Math.hypot(...a); if (!(d > 1e-10)) throw Error('Zero-length structural member'); return a.map(v => v / d);};
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function getEnds(model, m) {
  const ids = m.nodes ?? [m.a, m.b];
  if (ids.length !== 2 || ids.some(id => !Number.isInteger(id) || !model.nodes[id])) throw Error('Invalid connectivity ' + m.id);
  const a = model.nodes[ids[0]].position, b = model.nodes[ids[1]].position;
  if (!a || !b || a.length !== 3 || b.length !== 3 || [...a,...b].some(v => !Number.isFinite(v))) throw Error('Invalid node coordinates ' + m.id);
  return [ids, a, b];
}
export function radiusFor(caseId, model, member, parameters={}) {
  if (caseId === 'bridge') {
    const diameter = member.section?.outerDiameter;
    if (!(diameter > 0)) throw Error('Bridge outerDiameter missing for member ' + member.id);
    return [diameter / 2, 'model.section.outerDiameter'];
  }
  if (caseId === 'loop-towers') {
    const r = member.section === 'cable' ? .105 : member.section === 'core' ? .48 : member.section === 'ring' ? .29 : .14;
    return [r * (parameters.thickness ?? 1), 'existing UI visual cylinder radius; NOT section area'];
  }
  if (caseId === 'pavilion') {
    const s = model.sections[member.section];
    if (!s) throw Error('Missing pavilion section ' + member.section);
    const r = s.shape === 'CHS' ? s.diameter / 2 : Math.sqrt(s.area / Math.PI);
    return [r * (parameters.thickness ?? 1), s.shape === 'CHS' ? 'model.sections.diameter' : 'equivalent bundle area circular visual proxy (NOT individual fibers)'];
  }
  throw Error('Unknown case ID');
}
/** Pure glTF2 binary writer for the EXACT analytical member endpoints/topology.
 * Member triangles are grouped; per-member topology is separately preserved in structural_model.json.
 */
export function structuralGlb({caseId, model, parameters={}}) {
  const groups = new Map(), radii = {};
  const palette = {tower:[.57,.68,.75,1],crown:[.36,.75,.79,1],sweep:[.46,.73,.78,1],transfer:[.76,.69,.53,1],web:[.66,.52,.36,1],arch:[.45,.81,.83,1],net:[.59,.72,.78,1],trunk:[.77,.84,.87,1],branch:[.67,.77,.83,1],primary_arch:[.45,.81,.83,1],arch_internal:[.7,.89,.82,1],deck_system:[.61,.7,.76,1],cable_web:[.78,.67,.53,1],end_support:[.61,.72,.82,1]};
  for (const m of model.members) {
    const [ids,a,b] = getEnds(model,m), [r,reason] = radiusFor(caseId,model,m,parameters);
    if (!Number.isFinite(r) || r <= 0) throw Error('Invalid member radius ' + m.id);
    const key = String(m.system ?? m.group ?? m.section ?? m.type ?? 'members');
    if (!groups.has(key)) groups.set(key,{positions:[],indices:[],ids:[], color:palette[key] || [.64,.76,.82,1]});
    const group=groups.get(key), v=norm(sub(b,a)), axis=norm(cross(v,Math.abs(v[1])<.9?[0,1,0]:[1,0,0])),axis2=cross(v,axis), base=group.positions.length/3;
    const segments=10; // only surface tessellation; endpoints are not simplified
    for(let i=0;i<2;i++)for(let s=0;s<segments;s++){
      const angle=2*Math.PI*s/segments,p=i?b:a;
      for(let k=0;k<3;k++)group.positions.push(p[k]+r*(axis[k]*Math.cos(angle)+axis2[k]*Math.sin(angle)));
    }
    for(let s=0;s<segments;s++){const t=(s+1)%segments;group.indices.push(base+s,base+t,base+segments+s,base+t,base+segments+t,base+segments+s);}
    group.ids.push(m.id);radii[m.id]={r_m:r,source:reason};
  }
  const buffers=[],bufferViews=[],accessors=[],materials=[],meshes=[],nodes=[],groupCounts={};let offset=0;
  function append(typed,target){const data=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength),out=new Uint8Array(round4(data.length));out.set(data);const id=bufferViews.length;bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.length,target});buffers.push(out);offset+=out.length;return id;}
  function accessor(data,componentType,type,target){const view=append(data,target),count=data.length/(type==='VEC3'?3:1),obj={bufferView:view,componentType,count,type};if(type==='VEC3'){
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i++) {lo[i%3]=Math.min(lo[i%3],data[i]);hi[i%3]=Math.max(hi[i%3],data[i]);}obj.min=lo;obj.max=hi;
  } const id=accessors.length;accessors.push(obj);return id;}
  for(const [key,g] of groups){const p=Float32Array.from(g.positions),index=Uint32Array.from(g.indices);
    const pa=accessor(p,5126,'VEC3',34962),ia=accessor(index,5125,'SCALAR',34963);
    const mat=materials.length;materials.push({name:'Visualization '+key,pbrMetallicRoughness:{baseColorFactor:g.color,metallicFactor:.12,roughnessFactor:.7},doubleSided:true});
    const mid=meshes.length;meshes.push({name:`structural_${key}`,primitives:[{attributes:{POSITION:pa},indices:ia,material:mat,mode:4}]});
    nodes.push({name:`Structural_${key}`,mesh:mid,extras:{original_member_ids:g.ids}});groupCounts[key]=g.ids.length;
  }
  const doc={asset:{version:'2.0',generator:'Cephalo-Silk Structural Lab / structural model export'},scene:0,scenes:[{name:M[caseId],nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,bufferViews,accessors,buffers:[{byteLength:offset}],extras:{source:'authoritative nodes and members; radius is visualization only',case_id:caseId}};
  const j=encoder.encode(JSON.stringify(doc)),js=new Uint8Array(round4(j.length));js.fill(0x20);js.set(j);
  const total=12+8+js.length+8+offset,glb=new Uint8Array(total),dv=new DataView(glb.buffer);
  u32(dv,0,0x46546c67);u32(dv,4,2);u32(dv,8,total);u32(dv,12,js.length);u32(dv,16,0x4e4f534a);glb.set(js,20);
  u32(dv,20+js.length,offset);u32(dv,24+js.length,0x004e4942);let o=28+js.length;for(const b of buffers){glb.set(b,o);o+=b.length;}
  return {glb,groupCounts,radii,triangleCount:Array.from(groups.values()).reduce((n,g)=>n+g.indices.length/3,0)};
}

/** Snapshot real Three.js display buffers; excludes lights, helpers, instanced structural members.
 * The snapshot uses the existing scene's CURRENT state (potentially visibly amplified).
 */
export function captureVisualLayers(objects, {maxVertices=2_000_000}={}) {
  const items=[],stats={mesh:0,lines:0,points:0,vertices:0};
  for(const {name,object} of objects){if(!object)continue;object.updateWorldMatrix?.(true,true);
    object.traverse(o=>{
      if (!o.geometry || o.isInstancedMesh || (!o.isMesh && !o.isLine && !o.isLineSegments))return;
      const a=o.geometry.getAttribute('position');if(!a)return;
      stats.vertices+=a.count;if(stats.vertices>maxVertices)throw Error('Visual snapshot exceeds vertex safety limit');
      const vertices=[];for(let i=0;i<a.count;i++){const p=new o.position.constructor(a.getX(i),a.getY(i),a.getZ(i));p.applyMatrix4(o.matrixWorld);vertices.push(...p.toArray());}
      const idx=o.geometry.index ? Array.from(o.geometry.index.array) : Array.from({length:a.count},(_,i)=>i);
      const kind=o.isMesh?'mesh':o.isLineSegments?'segments':'line',item={name:`${name}/${o.name || o.type}`,kind,vertices,indices:idx,visible:o.visible && object.visible,opacity:o.material?.opacity??1,color:'#'+(o.material?.color?.getHexString?.() ?? '90a4ae')};
      items.push(item);stats[kind==='mesh'?'mesh':'lines']++;
    });
  }
  return {items,stats,notes:'Captured from display buffers, not analytical finite-element mesh. Per-object visibility is recorded. Mesh triangles and line endpoints are unmodified.'};
}

export function snapshotResponse(caseId,model,result){
  if(!result)return {available:false,status:'unavailable',reason:'No current solver result available at export time'};
  if(result.converged===false)return {available:false,status:'unconverged',reason:'Original solver did not converge; response is not valid'};
  if(!Number.isFinite(result.relativeResidual)||result.relativeResidual>1e-6)return {available:false,status:'invalid',reason:'Missing, nonfinite or excessive solver residual'};
  let disp;
  if(caseId==='bridge')disp=result.nodes?.map(n=>n.displacement);
  if(caseId==='loop-towers')disp=model.nodes.map((_,i)=>result.u?Array.from(result.u.slice(i*3,i*3+3)):null);
  if(caseId==='pavilion')disp=result.displacements;
  const valid=Array.isArray(disp)&&disp.length===model.nodes.length&&disp.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite));
  return valid?{available:true,status:'valid',displacement_vectors_m:disp,source:'current case solver, actual unamplified response; NOT animation frames',solver_summary:{converged:result.converged,relativeResidual:result.relativeResidual,maxDisplacement:result.maxDisplacement}}:{available:false,reason:'Solver displacements missing or invalid'};
}
export function validateModel(model){
  if(!Array.isArray(model.nodes)||!Array.isArray(model.members))throw Error('Missing structural nodes/members');
  const groups={};for(const m of model.members){getEnds(model,m);const k=String(m.system??m.group??m.section??m.type??'members');groups[k]=(groups[k]||0)+1;}
  return {nodeCount:model.nodes.length,memberCount:model.members.length,groupCounts:groups};
}

export async function makeBlenderPackage({caseId,model,result,parameters={},view={},visualLayers=null,parameterizedModel=null,scriptUrl,glb=null,sourceCommit='69b90ad5ba0a8b17a016edb4466cf2964be12c18'}){
  if(!M[caseId])throw Error('Invalid case');
  const analysis=validateModel(model),response=snapshotResponse(caseId,model,result),built=glb?null:structuralGlb({caseId,model,parameters});
  const bytes=glb instanceof ArrayBuffer?new Uint8Array(glb):glb instanceof Uint8Array?glb:built.glb;
  if(String.fromCharCode(...bytes.subarray(0,4))!=='glTF')throw Error('Invalid GLB signature');
  const scriptResponse=await fetch(scriptUrl);if(!scriptResponse.ok)throw Error('Blender setup script unavailable: '+scriptResponse.status);
  const script=await scriptResponse.text();
  const metadata={schema:'cephalo-silk/blender-package/1.1',exporter_version:EXPORT_VERSION,case_id:caseId,case_name:M[caseId],source_repo:'https://github.com/wlululu/cephalo-silk-structural-lab',source_commit:sourceCommit,
    scientific_baseline:'b6eeff872ccd62ddab8563cd2de6dcaf3a749340',units:model.units??{length:'m'},axes:model.axes??'Y up',coordinate_mapping:'unchanged; right-handed, Y up; Blender glTF importer handles axes',
    export_type:glb?'existing canonical Bridge renderer geometry GLB':'member-endpoint analytical geometry as triangulated GLB; render layers separately archived',
    state:{parameters,view,modified:Object.entries(parameters).some(([k,v])=>k in BASE_PARAMETERS[caseId]&&BASE_PARAMETERS[caseId][k]!==v)},
    structural:analysis,structural_groups_in_glb:built?.groupCounts??analysis.groupCounts,member_radius_source:built?.radii??'BridgeView uses model.section.outerDiameter directly',
    response:{available:response.available,status:response.status,source:response.source??response.reason,mesh_deformation:'scene.glb is undeformed. response.json stores actual unamplified displacement. Legacy adapters run the unchanged original solver for the click-time parameter snapshot; Bridge reuses its matching completed result.'},
    visual:{included:!!visualLayers||!!glb,stats:visualLayers?.stats??null,notes:'Rendered mesh layers and line/network positions are display only; no shell elements or additional analytical cables are implied.'},
    limitations:['Human-reviewed one-image reconstruction is nonunique.','Export meshes are for publication visualization; they do not alter or validate structural mechanics.','No independent Blender import test is implied by browser ZIP generation.']};
  const readme=`# ${M[caseId]} — Blender Package\n\nImport scene.glb using Blender File → Import → glTF 2.0, or run open_in_blender.py from Blender with: blender -b --python open_in_blender.py -- <absolute path to extracted package> --render\n\n- Structural nodes/members and current parameters: structural_model.json / metadata.json.\n- Computed nodal displacement: response.json (if currently available), in metres and NEVER display-amplified.
- Optional solver_result.json is an unchanged snapshot from the existing case solver. Invalid/unconverged attempts use solver_attempt.json and are not valid responses. For Towers, active_model.json has E/areas/loads already scaled (do not apply modifiers twice). For Pavilion, it retains baseline definitions with activeParameters; apply the documented modifiers once.\n- Separate visual mesh and web/line layers: visual_layers.json (if present).\n- The Python helper imports scene.glb, material/collection/camera/light setup, and the recorded visual meshes/lines, which are kept separate from the analytical model.\n- Animation is optional and purely a camera turntable; NOT transient mechanics.\n- Geometry and render embellishments are not new structural elements.\n\nSource version: ${sourceCommit}. No engineering safety or code-compliance claims.\n`;
  const files={'scene.glb':bytes,'structural_model.json':json(model),'metadata.json':json(metadata),'response.json':json(response),'open_in_blender.py':script,'README.md':readme};
  if(visualLayers)files['visual_layers.json']=json(visualLayers);
  if(parameterizedModel)files['active_model.json']=json(parameterizedModel);
  if(result)files[response.available?'solver_result.json':'solver_attempt.json']=json(result);
  return {zip:zipFiles(files),metadata,files};
}

export function downloadBlenderPackage(zip,caseId){const a=document.createElement('a'),url=URL.createObjectURL(zip);a.href=url;a.download=`cephalo-silk-${caseId}-blender.zip`;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
