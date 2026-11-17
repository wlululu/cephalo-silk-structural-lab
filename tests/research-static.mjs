/** Read-only identity/schema tests. Never imports or executes a mechanical kernel. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {researchFile} from '../scripts/research-files.mjs';
import {
  ASSETS,
  validateModel,
  adaptResponse,
  verifyBytes,
  memberParent,
  nodeParent,
} from "../research/archive.mjs";
const root = path.resolve(import.meta.dirname, ".."),
  base = path.join(root, "public/research");
const read = (p) => JSON.parse(fs.readFileSync(path.join(base, p), "utf8"));
const hash = (b) => createHash("sha256").update(b).digest("hex");
const index = read("file-index.json");
let checks = 0;
const equal = (a, b, n) => {
  assert.deepEqual(a, b, n);
  checks++;
};
for (const [p, item] of Object.entries(index)) {
  const bytes = fs.readFileSync(researchFile(p));
  equal(hash(bytes), item.sha256, p);
  equal(bytes.length, item.bytes, p + " size");
}
const models = {},
  maps = {};
for (const h of ["H0", "H1", "H2", "H3"]) {
  models[h] = validateModel(h, read(ASSETS + `inputs/${h}.json`));
  maps[h] = read(ASSETS + `inputs/${h}_member_id_map.v1.json`);
  equal(maps[h].length, models[h].members.length, h + " map coverage");
  const parent = maps[h].filter((m) => m.h0_member_id !== null);
  equal(
    new Set(parent.map((m) => m.h0_member_id)).size,
    parent.length,
    h + " retained bijection",
  );
}
const selection = read(ASSETS + "inputs/selections.json");
const h0nodes = new Map(models.H0.nodes.map((n) => [n.id, n]));
const moved = models.H1.nodes
  .filter(
    (n) =>
      JSON.stringify(n.position) !== JSON.stringify(h0nodes.get(n.id).position),
  )
  .map((n) => n.id);
equal(moved, selection.H1_moved_nodes, "exact 70 moved nodes");
equal(moved.length, 70);
equal(
  models.H1.members
    .filter((m) => moved.includes(m.a) || moved.includes(m.b))
    .map((m) => m.id),
  selection.H1_changed_member_geometry,
);
equal(selection.H1_changed_member_geometry.length, 580);
equal(
  models.H1.nodes
    .find((n) => n.id === 59)
    .position.map((x, i) =>
      Number((x - h0nodes.get(59).position[i]).toFixed(8)),
    ),
  [0, 0.6, -0.75],
);
for (const h of ["H2", "H3"]) {
  const parents = new Set(maps[h].map((m) => m.h0_member_id));
  equal(
    models.H0.members.filter((m) => !parents.has(m.id)).map((m) => m.id),
    selection[h + "_removed_H0_members"],
  );
}
equal(selection.H2_removed_H0_members.length, 360);
equal(
  selection.crown_detail_H0_members.filter((id) =>
    selection.H2_removed_H0_members.includes(id),
  ).length,
  18,
);
equal(selection.H3_removed_H0_members.length, 496);
equal(
  maps.H3.filter((m) => m.h0_member_id === null).map((m) => m.member_id),
  selection.H3_added_members,
);
equal(selection.H3_added_members.length, 26);
equal(
  models.H3.members.filter((m) => m.behavior === "tension_only_cable").length,
  84,
);
equal(
  models.H3.members.filter((m) => m.behavior === "bilateral_frame").length,
  2601,
);
equal(
  models.H2.nodes,
  models.H0.nodes,
  "H2 coordinates and source nodes unchanged",
);
const nodeMap = read(ASSETS + "inputs/H3_node_id_map.v1.json");
equal(new Set(nodeMap.map((n) => n.h0_node_id)).size, 604);
for (const h of ["H2", "H3"])
  for (const m of models[h].members) {
    const parent = memberParent(h, m.id, maps);
    if (parent === null) continue;
    const p = models.H0.members.find((n) => n.id === parent);
    equal(
      [nodeParent(h, m.a, nodeMap), nodeParent(h, m.b, nodeMap)],
      [p.a, p.b],
      h + " exact endpoint lineage",
    );
  }
const v1 = read("evidence/H0_H3/models/H3/model.v1.json"),
  v11 = models.H3;
for (const key of ["nodes", "members", "supports", "loads", "materials"])
  equal(v1[key], v11[key], `H3 v1/v1.1 ${key}`);
const b1 = read(ASSETS + "exports/B1_inherited_source_register.json"),
  sections = read(ASSETS + "exports/B1_frozen_section_states.json");
equal(
  b1.nodes.map((n) => n.id),
  selection.B1_source_nodes,
);
equal(
  b1.members.map((m) => m.id),
  selection.B1_source_members,
);
equal(b1.nodes.length, 14);
equal(b1.members.length, 19);
equal(
  Math.max(...b1.nodes.map((n) => n.position[0])) -
    Math.min(...b1.nodes.map((n) => n.position[0])),
  36,
);
for (const n of b1.nodes)
  equal(
    n,
    models.H3.nodes.find((r) => r.id === n.id),
  );
for (const m of b1.members)
  equal(
    m,
    models.H3.members.find((r) => r.id === m.id),
  );
equal(
  sections.members
    .filter((m) => m.qualified_uniform_wall_m !== m.candidate_wall_m)
    .map((m) => m.member_id),
  [1520, 1538],
);
for (const id of [1520, 1538]) {
  const s = sections.members.find((m) => m.member_id === id);
  equal(
    [
      s.outer_diameter_m,
      s.original_H3_wall_m,
      s.qualified_uniform_wall_m,
      s.candidate_wall_m,
    ],
    [0.64, 0.028, 0.026404, 0.021404],
  );
}
const tables = read("display-tables.json");
equal(
  tables.supports.map((r) => Number(r.source_node_id)),
  [10, 12, 14, 16, 192, 194, 196, 198],
);
for (const r of tables.supports)
  equal(
    ["ux", "uy", "uz", "rx", "ry", "rz"].map((k) => Number(r[k])),
    Number(r.source_node_id) === 10
      ? [1, 1, 1, 1, 0, 0]
      : Number(r.source_node_id) === 16
        ? [0, 1, 1, 1, 0, 0]
        : [0, 1, 0, 1, 0, 0],
  );
const catalog = read("FROZEN_RESPONSE_CATALOG.json");
equal(catalog.length, 34);
for (const record of catalog) {
  const raw = read(record.path);
  equal(hash(fs.readFileSync(path.join(base, record.path))), record.sha256);
  const isH = record.id.startsWith("H");
  const scope = isH
    ? {
        hypothesis: record.id.split("_")[0],
        model: read(record.frozen_model_path),
        modelHash: record.frozen_model_sha256,
      }
    : {
        hypothesis: "B1",
        sectionState:
          record.request.role === "V2"
            ? "candidate"
            : record.request.alpha.n / record.request.alpha.d === 0.943
              ? "uniform"
              : "lower",
      };
  const adapted = adaptResponse(record, raw, scope);
  equal(adapted.kind, isH ? "H" : "B1");
  if (isH) {
    equal(
      adapted.fieldAllowed,
      record.display_policy === "verified archived field",
    );
    assert.throws(
      () => adaptResponse(record, { ...raw, model_sha256: "bad" }, scope),
      /hash mismatch/,
    );
    assert.throws(
      () => adaptResponse(record, { ...raw, state: "wrong" }, scope),
      /Load-state/,
    );
    assert.throws(
      () => adaptResponse(record, raw, { ...scope, hypothesis: "B1" }),
      /Model selection/,
    );
  } else {
    equal(
      adapted.sourceFields.map((n) => n.source),
      selection.B1_source_nodes,
    );
    equal(
      adapted.parents.map((m) => m.id),
      selection.B1_source_members,
    );
    for (const n of adapted.sourceFields) {
      equal(
        raw.model.nodes.find((q) => q.id === n.mesh).position,
        b1.nodes.find((q) => q.id === n.source).position,
      );
    }
    assert.throws(
      () => adaptResponse(record, { ...raw, engine: "unknown" }, scope),
      /Engine mismatch/,
    );
    assert.throws(
      () =>
        adaptResponse(
          record,
          { ...raw, request: { ...raw.request, case: "wrong" } },
          scope,
        ),
      /Request/,
    );
    assert.throws(
      () =>
        adaptResponse(record, raw, { ...scope, sectionState: "unregistered" }),
      /Section state/,
    );
  }
}
equal(
  catalog
    .filter((r) => r.archived_call_row?.response_status === "FAIL")
    .map((r) => r.request.slot),
  [2],
);
await assert.rejects(
  () => verifyBytes(new TextEncoder().encode("bad"), catalog[0].sha256),
  /SHA-256/,
);
checks++;
const cameras = read(ASSETS + "camera_presets.json");
for (const h of ["H1", "H2", "H3"])
  for (const view of ["overall_perspective", "overall_orthographic"])
    equal(
      cameras.presets[`H0_${view}`].camera,
      cameras.presets[`${h}_${view}`].camera,
    );
for (const h of ["H1", "H2"])
  equal(
    cameras.presets.H0_crown_detail.camera,
    cameras.presets[`${h}_crown_detail`].camera,
  );
equal(
  cameras.presets.H0_side_system_detail.camera,
  cameras.presets.H3_side_system_detail.camera,
);
// Import boundary: research source cannot reach original kernels, workers or live adapters.
for (const f of fs
  .readdirSync(path.join(root, "research"))
  .filter((f) => /\.(mjs|tsx)$/.test(f))) {
  const s = fs.readFileSync(path.join(root, "research", f), "utf8");
  assert.ok(
    !/new\s+(?:Worker|SharedWorker)|import\s.*(?:solver|hybrid|frame-element|BridgeCase|blender-export)/.test(
      s,
    ),
    f + " imports mechanics",
  );
}
const main = fs.readFileSync(path.join(root, "main.tsx"), "utf8");
assert.match(main, /active==='research'\?<ResearchViewer\/>/);
assert.match(main, /const BridgeCase=lazy/);
fs.mkdirSync(path.join(root, "test-output"), { recursive: true });
const report = {
  status: "PASS",
  checks,
  frozen_files: Object.keys(index).length,
  response_records: catalog.length,
  source_identity: true,
  fail_closed_tests: true,
  mechanics_executed: false,
  blender_executed: false,
};
fs.writeFileSync(
  path.join(root, "test-output/research-static-report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report);
