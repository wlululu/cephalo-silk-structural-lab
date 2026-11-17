/** Frozen-record adapters. No numerical solver or response interpolation. */
export const ASSETS = "phase2_scientific_assets_v1/";
export const expectedCounts = {
  H0: [762, 3155],
  H1: [762, 3155],
  H2: [762, 2795],
  H3: [604, 2685],
};
const requireThat = (ok, reason) => {
  if (!ok) throw new Error(reason);
};
export async function verifyBytes(bytes, expected) {
  requireThat(
    typeof expected === "string",
    "File is not in the approved index",
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  requireThat(hash === expected, "SHA-256 mismatch; archived data unavailable");
  return hash;
}
export function validateModel(name, model) {
  requireThat(model.units?.length === "m", "Unknown coordinate units");
  requireThat(
    model.nodes.length === expectedCounts[name][0] &&
      model.members.length === expectedCounts[name][1],
    "Model topology count mismatch",
  );
  const nodes = new Map(model.nodes.map((n) => [n.id, n]));
  requireThat(nodes.size === model.nodes.length, "Duplicate node identity");
  requireThat(
    new Set(model.members.map((m) => m.id)).size === model.members.length,
    "Duplicate member identity",
  );
  for (const m of model.members)
    requireThat(nodes.has(m.a) && nodes.has(m.b), "Missing endpoint");
  return model;
}
export function memberParent(name, id, maps) {
  return name === "B1"
    ? id
    : (maps[name].find((r) => r.member_id === id)?.h0_member_id ?? null);
}
export function nodeParent(name, id, nodeMap) {
  return name === "H3"
    ? (nodeMap.find((r) => r.node_id === id)?.h0_node_id ?? null)
    : id;
}
export function adaptResponse(
  record,
  raw,
  { hypothesis, model, modelHash, sectionState },
) {
  requireThat(record && raw, "No whitelisted record");
  if (record.id.startsWith("H")) {
    requireThat(
      record.id.split("_")[0] === hypothesis,
      "Model selection does not match archive",
    );
    requireThat(
      modelHash === record.frozen_model_sha256 &&
        raw.model_sha256 === modelHash,
      "Response model hash mismatch",
    );
    requireThat(
      raw.engine === "Original unchanged JS" && raw.completed === true,
      "Unexpected engine or incomplete record",
    );
    requireThat(raw.state === record.id.split("_")[1], "Load-state mismatch");
    const field = raw.result.nodes,
      ids = new Set(model.nodes.map((n) => n.id));
    requireThat(
      field.length === ids.size &&
        new Set(field.map((n) => n.node)).size === ids.size &&
        field.every(
          (n) =>
            ids.has(n.node) &&
            n.displacement.length === 3 &&
            n.displacement.every(Number.isFinite),
        ),
      "Node field identity/units schema mismatch",
    );
    return {
      kind: "H",
      engine: raw.engine,
      formulation: raw.result.solver,
      mesh: `${model.nodes.length} source nodes / ${model.members.length} physical members`,
      load:
        raw.state === "loaded"
          ? "5 kPa pressure + authored prestress"
          : "Authored prestress only",
      units: record.units,
      summary: raw.result,
      fieldAllowed: record.display_policy === "verified archived field",
      field,
      modelHash,
    };
  }
  const req = record.request;
  requireThat(
    JSON.stringify(raw.request) === JSON.stringify(req),
    "Request / load / mesh mismatch",
  );
  requireThat(raw.engine === req.engine, "Engine mismatch");
  const role =
    req.role === "V2"
      ? "candidate"
      : req.alpha.n / req.alpha.d === 0.943
        ? "uniform"
        : "lower";
  requireThat(role === sectionState, "Section state does not match archive");
  const meta = raw.model.metadata;
  requireThat(
    meta.kind === "B1" && meta.case === req.case && meta.mesh === req.mesh,
    "Embedded model scope mismatch",
  );
  requireThat(
    meta.parents.length === 19 &&
      new Set(meta.parents.map((p) => p.id)).size === 19,
    "Physical parent identity mismatch",
  );
  const source = meta.node_identity.filter((n) => n.source_node_id !== null);
  requireThat(
    source.length === 14 &&
      new Set(source.map((n) => n.source_node_id)).size === 14,
    "Source node map mismatch",
  );
  const nodes = new Map(raw.nodes.map((n) => [n.node, n]));
  requireThat(
    nodes.size === raw.model.nodes.length &&
      meta.node_identity.length === nodes.size,
    "Mesh-node count mismatch",
  );
  for (const n of meta.node_identity)
    requireThat(nodes.has(n.canonical), "Canonical node missing");
  const parentIDs = new Set(meta.parents.map((p) => p.id));
  const children = new Map(raw.members.map((m) => [m.member, m]));
  requireThat(
    children.size === raw.model.members.length &&
      meta.parent_child.length === children.size,
    "Mesh-member count mismatch",
  );
  for (const link of meta.parent_child)
    requireThat(
      children.has(link.child) && parentIDs.has(link.parent),
      "Parent-child map mismatch",
    );
  requireThat(
    raw.nodes.every(
      (n) =>
        n.displacement.length === 3 && n.displacement.every(Number.isFinite),
    ),
    "Invalid archived node units/schema",
  );
  const sourceFields = source.map((n) => ({
    source: n.source_node_id,
    mesh: n.canonical,
    ...nodes.get(n.canonical),
  }));
  return {
    kind: "B1",
    engine: raw.engine,
    formulation: req.engine.includes("Timoshenko")
      ? "Timoshenko"
      : "Euler–Bernoulli",
    mesh: `${req.mesh}: ${raw.model.nodes.length} mesh nodes / ${raw.model.members.length} beam subdivisions; 14 source nodes / 19 physical members`,
    load: req.case,
    units: "coordinates/displacements m; rotations rad; force N; moments N m",
    summary: record.archived_call_row,
    sourceFields,
    parents: meta.parents,
    parentChild: meta.parent_child,
    mapper: meta.engine_mapper,
    fieldAllowed: true,
    modelHash: record.sha256 + " (embedded model in raw record)",
  };
}
export function classifyMember(name, id, comparison, selections, maps) {
  const parent = memberParent(name, id, maps);
  if (
    comparison === "H1" &&
    selections.H1_changed_member_geometry.includes(parent)
  )
    return name === "H0" ? "reference" : "moved";
  if (
    comparison === "H2" &&
    name === "H0" &&
    selections.H2_removed_H0_members.includes(id)
  )
    return "removed";
  if (comparison === "H3") {
    if (name === "H0" && selections.H3_removed_H0_members.includes(id))
      return "removed";
    if (name === "H3" && parent === null) return "added";
  }
  return "retained";
}
