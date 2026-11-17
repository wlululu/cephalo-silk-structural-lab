import React, { useEffect, useState } from "react";
import { assetUrl } from "../shared/assetUrl";
import index from "../public/research/file-index.json";
import delivery from "../public/research/download-catalog.json";
import releaseLocation from "../public/research/release-location.json";
import {
  ASSETS,
  adaptResponse,
  validateModel,
  verifyBytes,
  memberParent,
  nodeParent,
} from "./archive.mjs";
import GeometryView from "./GeometryView";
import ResearchData from "./ResearchData";
import "./research.css";
const files: any = index;
const url = (p: string) => assetUrl("research/" + p);
async function read(p: string) {
  const res = await fetch(url(p));
  if (!res.ok) throw Error(`Unavailable: ${p} (HTTP ${res.status})`);
  const bytes = await res.arrayBuffer();
  await verifyBytes(bytes, files[p]?.sha256);
  return JSON.parse(new TextDecoder().decode(bytes));
}
const path = (p: string) => ASSETS + p;
// Presentation-only: at most three decimals, without padding or negative zero.
// Source JSON, IDs, engineering thresholds and archived response precision remain unchanged.
const displayNumber = (value: number): string => String(Number(value.toFixed(3)));
const displayCoords = (values: number[]): string => values.map(displayNumber).join(", ");
function Download({ p, children }: any) {
  const record = (delivery.files as any)[p];
  if (record?.tier === "archive") return <span className="r3-archive-item">
    {children || p.split("/").pop()} · <button type="button" className="r3-archive-link" onClick={()=>document.getElementById('research-archive-download')?.scrollIntoView({block:'center'})}>Research data</button>
  </span>;
  return (
    <a
      href={url(p)}
      download
    >
      {children || p.split("/").pop()} ↗
    </a>
  );
}
function Asset({ id, caption }: any) {
  const p = path(
    `${id.startsWith("S_") ? "schematics" : "renders"}/${id}.${id.startsWith("S_") ? "svg" : "png"}`,
  );
  return (
    <figure>
      <a href={url(p)} target="_blank" rel="noreferrer">
        <img
          src={url(p)}
          alt={caption || id.replaceAll("_", " ")}
          loading="lazy"
        />
      </a>
      <figcaption>
        {caption || id.replaceAll("_", " ")}{" "}
        <Download p={p}>Download schematic</Download>
      </figcaption>
    </figure>
  );
}
function Inspector({
  data,
  selection,
  onSelect,
  hypothesis,
  sectionState,
}: any) {
  const sel = selection || {
    hypothesis: hypothesis === "B1" ? "B1" : hypothesis,
    kind: "node",
    id: hypothesis === "H1" ? 59 : hypothesis === "B1" ? 10 : 0,
  };
  const [typed, setTyped] = useState(String(sel.id));
  useEffect(() => setTyped(String(sel.id)), [sel.id]);
  const model = sel.hypothesis === "B1" ? data.b1 : data.models[sel.hypothesis];
  const row = (sel.kind === "node" ? model.nodes : model.members).find(
    (r: any) => r.id === sel.id,
  );
  const parent =
    sel.kind === "node"
      ? nodeParent(sel.hypothesis, sel.id, data.nodeMap)
      : memberParent(sel.hypothesis, sel.id, data.maps);
  const section =
    sel.hypothesis === "B1"
      ? data.sections.members.find((m: any) => m.member_id === sel.id)
      : null;
  const modelPath =
    sel.hypothesis === "B1"
      ? path("exports/B1_inherited_source_register.json")
      : path(`inputs/${sel.hypothesis}.json`);
  return (
    <section className="r3-panel inspector">
      <h2>Source inspector</h2>
      <div className="r3-inline-controls">
        <label>
          Model
          <select
            value={sel.hypothesis}
            onChange={(e) =>
              onSelect({ ...sel, hypothesis: e.target.value, ghost: false })
            }
          >
            {["H0", "H1", "H2", "H3", "B1"].map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
        <label>
          Object
          <select
            value={sel.kind}
            onChange={(e) => onSelect({ ...sel, kind: e.target.value })}
          >
            <option value="node">Node</option>
            <option value="member">Member</option>
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSelect({ ...sel, id: Number(typed), ghost: false });
          }}
        >
          <label>
            Exact ID
            <input
              aria-label="Exact ID"
              type="number"
              min="0"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
          <button type="submit">Inspect</button>
        </form>
      </div>
      <div aria-live="polite">
        <h3>
          {sel.hypothesis}:{sel.kind}:{sel.id}
          {sel.ghost ? " · comparison ghost (nonphysical)" : ""}
        </h3>
        {!row ? (
          <p className="r3-unavailable">
            Unavailable: this exact ID is absent from {sel.hypothesis}.
          </p>
        ) : (
          <>
            <dl>
              <dt>{sel.hypothesis === "B1" ? "H3 source identity" : "H0 lineage"}</dt>
              <dd>
                {parent ?? "New H3 hanger · no H0 member parent"}
                {sel.hypothesis === "B1"
                  ? " (B1 IDs are inherited H3 source IDs; H0 lineage below)"
                  : ""}
              </dd>
              {sel.hypothesis === "B1" && (
                <>
                  <dt>H0 parent via H3</dt>
                  <dd>
                    {sel.kind === "node"
                      ? nodeParent("H3", sel.id, data.nodeMap)
                      : memberParent("H3", sel.id, data.maps)}
                  </dd>
                </>
              )}
              {sel.kind === "node" ? (
                <>
                  <dt>Position (x, y, z), m</dt>
                  <dd>{displayCoords(row.position)}</dd>
                  {sel.hypothesis === "H1" && (
                    <>
                      <dt>H0 reference, m</dt>
                      <dd>
                        {data.models.H0.nodes
                          .find((n: any) => n.id === sel.id)
                          .position.map(displayNumber).join(", ")}
                      </dd>
                      <dt>Coordinate change, m</dt>
                      <dd>
                        {row.position
                          .map((v: number, i: number) =>
                            displayNumber(v - data.models.H0.nodes.find(
                              (n: any) => n.id === sel.id,
                            ).position[i]),
                          )
                          .join(", ")}{" "}
                        · geometry, not deformation
                      </dd>
                    </>
                  )}
                </>
              ) : (
                <>
                  <dt>Endpoints</dt>
                  <dd>
                    {row.a} → {row.b}
                  </dd>
                  <dt>Endpoint coordinates, m</dt>
                  <dd>
                    {[row.a, row.b]
                      .map((id) =>
                        model.nodes
                          .find((n: any) => n.id === id)
                          .position.map(displayNumber).join(", "),
                      )
                      .join(" → ")}
                  </dd>
                  <dt>Mechanical behavior</dt>
                  <dd>{row.behavior}</dd>
                  <dt>Role / display group</dt>
                  <dd>
                    {row.type} / {row.group}
                  </dd>
                  <dt>Section</dt>
                  <dd>
                    {section
                      ? `OD ${(section.outer_diameter_m * 1000).toFixed(0)} mm; H3 ${displayNumber(section.original_H3_wall_m * 1000)} mm; qualified U ${displayNumber(section.qualified_uniform_wall_m * 1000)} mm; candidate ${displayNumber(section.candidate_wall_m * 1000)} mm wall`
                      : `${row.section.shape}; OD ${displayNumber((row.section.outerDiameter ?? row.section.diameter) * 1000)} mm${row.section.wallThickness ? `; wall ${displayNumber(row.section.wallThickness * 1000)} mm` : ""}`}
                  </dd>
                </>
              )}
            </dl>
            <details>
              <summary>Original source object</summary>
              <pre>{JSON.stringify(row, null, 2)}</pre>
            </details>
          </>
        )}
        <Download p={modelPath}>Source model</Download>
        {sel.hypothesis === "H3" && (
          <p>
            Display v1.1 differs from numerical v1 only in metadata.{" "}
            <Download p={path("inputs/H3_metadata_erratum.json")}>
              Explicit erratum
            </Download>
          </p>
        )}
      </div>
    </section>
  );
}
function ArchivedResponse({ data, hypothesis, sectionState }: any) {
  const b1 = hypothesis === "B1";
  const available = data.catalog.filter((r: any) =>
    b1 ? r.id.startsWith("B1") : r.id.startsWith(hypothesis + "_"),
  );
  const initial = b1
    ? available.find(
        (r: any) =>
          r.request.role === (sectionState === "candidate" ? "V2" : "U") &&
          r.request.alpha.n / r.request.alpha.d === 0.943 &&
          r.request.engine === "OpenSees_Timoshenko" &&
          r.request.mesh === "refined" &&
          r.request.case === "LC-E",
      )?.id
    : `${hypothesis}_loaded`;
  const [id, setId] = useState(initial),
    [state, setState] = useState<any>({ status: "pending" });
  const record = available.find((r: any) => r.id === id);
  useEffect(() => {
    let alive = true;
    setState({ status: "pending", id });
    (async () => {
      try {
        if (!record)
          throw Error("No archived record for this selection");
        const raw = await read(record.path);
        let model, modelHash;
        if (!b1) {
          model = await read(record.frozen_model_path);
          modelHash = files[record.frozen_model_path].sha256;
        }
        const response = adaptResponse(record, raw, {
          hypothesis,
          model,
          modelHash,
          sectionState,
        });
        if (alive) setState({ status: "ready", id, response });
      } catch (e: any) {
        if (alive) setState({ status: "error", id, message: e.message });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, hypothesis, sectionState]);
  const ready = state.id === id && state.status === "ready";
  const r = ready ? state.response : null;
  const row = data.tables.h.find((r: any) => r.hypothesis === hypothesis);
  return (
    <section className="r3-panel r3-responses">
      <div className="r3-section-heading">
        <div>
          <p className="r3-eyebrow">COMPUTATIONAL RESPONSE</p>
          <h2>Archived responses</h2>
        </div>
        <span className="r3-badge">
          {b1 ? "Self-weight included" : "Self-weight excluded"}
        </span>
      </div>
      <p>
        {b1
          ? "Idealized 36 m H3-derived B1+; configuration-dependent self-weight and prescribed additional dead-load allowance."
          : "Full Bridge · prescribed 5 kPa pressure and authored prestress. No structural self-weight."}
      </p>
      <label>
        Archived model / load / engine / mesh
        <select
          aria-label="Archived record"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {available.map((r: any) => (
            <option key={r.id} value={r.id}>
              {b1
                ? `${r.id} · ${r.archived_call_row.configuration} · ${r.request.case} · ${r.request.engine} · ${r.request.mesh} · ${r.archived_call_row.response_status}`
                : r.id}
            </option>
          ))}
        </select>
      </label>
      <div aria-live="polite">
        {state.status === "pending" || state.id !== id ? (
          <p role="status">Loading archived response…</p>
        ) : state.status === "error" ? (
          <p className="r3-unavailable" role="alert">
            Unavailable: {state.message}. No previous response is displayed.
          </p>
        ) : (
          <>
            <dl>
              <dt>Model / section state</dt>
              <dd>
                {hypothesis}
                {b1 ? ` · ${sectionState} · α=0.943` : ""}
              </dd>
              <dt>Load</dt>
              <dd>{r.load}</dd>
              <dt>Engine / formulation</dt>
              <dd>
                {r.engine} · {r.formulation}
              </dd>
              <dt>Mesh</dt>
              <dd>{r.mesh}</dd>
              <dt>Units</dt>
              <dd>{r.units}</dd>
              <dt>Verification scope</dt>
              <dd>{record.display_policy}</dd>
            </dl>
            {b1 ? (
              <>
                <div className="r3-metrics">
                  <div>
                    <b>{Number(r.summary.D_mm).toFixed(6)}</b>
                    <span>total displacement · mm</span>
                  </div>
                  <div>
                    <b>{Number(r.summary.reserved_D_mm).toFixed(6)}</b>
                    <span>with reserves · mm</span>
                  </div>
                  <div>
                    <b>{r.summary.response_status}</b>
                    <span>archived response screen</span>
                  </div>
                </div>
                <p>
                  Frozen limit: 33.333333333… mm (12/360 m). Independent
                  full-system numerical verification is Euler–Bernoulli only.
                  Native Timoshenko has archived fixture, equilibrium and mesh
                  checks; no second independent full-system Timoshenko
                  implementation.
                </p>
                <details>
                  <summary>14 source nodes mapped through {r.mapper}</summary>
                  <table>
                    <thead>
                      <tr>
                        <th>H3 source</th>
                        <th>Mesh node</th>
                        <th>uₓ, uᵧ, u_z (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.sourceFields.map((n: any) => (
                        <tr key={n.source}>
                          <td>{n.source}</td>
                          <td>{n.mesh}</td>
                          <td>
                            {n.displacement
                              .map((v: number) => v.toExponential(5))
                              .join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    Beam subdivisions are mapped through parent_child; they are
                    not extra physical joints.
                  </p>
                </details>
              </>
            ) : (
              <>
                <div className="r3-metrics">
                  <div>
                    <b>{(r.summary.maxDeckDisplacement * 1000).toFixed(6)}</b>
                    <span>
                      {id.endsWith("_loaded")
                        ? "total deck displacement"
                        : "prestress-only deck summary"}{" "}
                      · mm
                    </span>
                  </div>
                  {id.endsWith("_loaded") && (
                    <div>
                      <b>{Number(row.load_increment_deck_mm).toFixed(6)}</b>
                      <span>archived pointwise P+U − P increment · mm</span>
                    </div>
                  )}
                </div>
                <p>
                  The increment is the maximum of corresponding
                  displacement-vector differences, not the difference of scalar
                  maxima.
                </p>
                {!r.fieldAllowed ? (
                  <p className="r3-unavailable">
                    Full native prestress/web-coordinate field: unavailable for
                    verified display. H0–H2 retain unresolved slack-patch
                    verification; this is a qualified archived summary only.
                  </p>
                ) : (
                  <p>
                    Loaded cross-engine verification passed within the recorded
                    model scope.{" "}
                    {hypothesis === "H3"
                      ? "H3 native prestress is separately verified."
                      : "Full native prestress/web-coordinate verification remains unresolved."}
                  </p>
                )}
                <p>
                  All four loaded hypotheses retain 78 Euler-screen exceedances.
                  Numerical verification does not qualify these hypotheses as
                  safe designs.
                </p>
              </>
            )}
            {record.model_version_note && (
              <p>
                {record.model_version_note}{" "}
                <Download p={path("inputs/H3_metadata_erratum.json")}>
                  Erratum
                </Download>
              </p>
            )}
          </>
        )}
      </div>
      {record && (
        <div className="r3-download-row">
          <Download p={record.path}>Exact raw response</Download>
          {record.frozen_model_path && (
            <Download p={record.frozen_model_path}>Numerical model</Download>
          )}
          {record.verification_path && (
            <Download p={record.verification_path}>
              Verification record
            </Download>
          )}
          <Download p="FROZEN_RESPONSE_CATALOG.json">Response catalog</Download>
        </div>
      )}
      <p className="r3-scope-note">
        Geometry is shown undeformed; responses correspond to the selected archived analysis.
      </p>
    </section>
  );
}
function Research({ data }: any) {
  const readH = () =>
    ["H0", "H1", "H2", "H3", "B1"].includes(location.hash.split("/")[2])
      ? location.hash.split("/")[2]
      : "H1";
  const [hypothesis, setHypothesis] = useState(readH),
    [preset, setPreset] = useState("crown_detail"),
    [physical, setPhysical] = useState(true),
    [difference, setDifference] = useState(false),
    [ghosts, setGhosts] = useState(true),
    [opacity, setOpacity] = useState(0.3),
    [sectionState, setSectionState] = useState("candidate"),
    [restraints, setRestraints] = useState(false),
    [context, setContext] = useState(false),
    [selection, setSelection] = useState<any>({
      hypothesis: "H1",
      kind: "node",
      id: 59,
    });
  useEffect(() => {
    const change = () => {
      const h = readH();
      setHypothesis(h);
      setPreset(
        h === "H3"
          ? "side_system_detail"
          : h === "H0"
            ? "overall_perspective"
            : "crown_detail",
      );
      setSelection({
        hypothesis: h,
        kind: h === "B1" ? "member" : "node",
        id: h === "B1" ? 1520 : h === "H1" ? 59 : 0,
      });
    };
    change();
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const b1 = hypothesis === "B1";
  const titles: any = {
    H0: "Reference structural model",
    H1: "Hidden-chord geometry",
    H2: "Internal bracing removal",
    H3: "Direct-hanger interpretation",
    B1: "Material efficiency with unchanged exterior geometry",
  };
  const descriptions: any = {
    H0: "762 nodes · 3,155 members. A preserved reference for controlled image-informed interpretations.",
    H1: "70 source nodes move; 580 incident members change geometry. Connectivity is retained. Crown node 59 moves +0.60 m vertically and −0.75 m transversely.",
    H2: "360 internal diagonal members are removed. The matched crown detail contains 18 removals. All 762 source-node coordinates are retained.",
    H3: "496 H0 web members are removed and 26 direct hangers are added. This is a system-level reinterpretation, without a one-to-one replacement map.",
    B1: "An idealized 36 m H3-derived grillage: 14 inherited source nodes and 19 physical frame members. Only terminal members 1520 and 1538 receive a section reduction.",
  };
  const detail =
    hypothesis === "H1"
      ? "S_H0_H1_crown_overlay"
      : hypothesis === "H2"
        ? "S_H0_H2_bracing_overlay"
        : hypothesis === "H3"
          ? "S_H0_H3_side_overlay"
          : "S_H0_overall_centerlines";
  return (
    <main className="research">
      <header className="r3-research-heading">
        <div>
          <h1>Structural Models &amp; Mechanics</h1>
          <p>
            Explore image-informed 3D structural interpretations, compare their mechanical responses, and examine mechanics-guided material efficiency.
          </p>
        </div>
      </header>
      <nav className="r3-research-tabs" aria-label="Research studies">
        {["H0", "H1", "H2", "H3", "B1"].map((h) => (
          <a
            href={`#/research/${h}`}
            aria-current={hypothesis === h ? "page" : undefined}
            key={h}
          >
            {h === "B1" ? "B1+ final26" : h}
            <small>
              {
                (
                  {
                    H0: "Reference",
                    H1: "Hidden chord",
                    H2: "Removed bracing",
                    H3: "Direct hangers",
                    B1: "Tube-mass reduction",
                  } as any
                )[h]
              }
            </small>
          </a>
        ))}
      </nav>
      <section className="r3-study-intro">
        <div>
          <h2>{titles[hypothesis]}</h2>
          <p>{descriptions[hypothesis]}</p>
        </div>
        <div className="r3-study-count">
          {b1
            ? "14 / 19"
            : `${data.models[hypothesis].nodes.length} / ${data.models[hypothesis].members.length.toLocaleString()}`}
          <small>source nodes / physical members</small>
        </div>
      </section>
      {b1 && (
        <div className="r3-result-banner">
          <b>2.7658%</b>
          <div>
            <strong>
              Modeled tube-mass reduction · FULL COMPUTATIONAL PASS
            </strong>
            <p>
              Gravity-aware, member-screened result within the frozen idealized
              B1+ scope. Governing displacement is unchanged within the declared
              numerical resolution.
            </p>
          </div>
        </div>
      )}
      <section id="research-geometry" className="r3-panel r3-geometry-panel">
        <div className="r3-toolbar">
          {!b1 ? (
            <label>
              Linked camera / region
              <select
                aria-label="Camera preset"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
              >
                <option value="overall_perspective">
                  Matched overall perspective
                </option>
                <option value="overall_orthographic">
                  Matched overall elevation
                </option>
                <option value="crown_detail">
                  Crown detail · exact registered subset
                </option>
                <option value="side_system_detail">
                  One-side system · negative source z
                </option>
              </select>
            </label>
          ) : (
            <>
              <label>
                Candidate comparison
                <select
                  aria-label="Section state"
                  value={sectionState}
                  onChange={(e) => setSectionState(e.target.value)}
                >
                  <option value="uniform">Qualified uniform</option>
                  <option value="candidate">
                    Candidate · 1520 / 1538 reduced
                  </option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={context}
                  onChange={(e) => setContext(e.target.checked)}
                />
                Full-H3 extraction context
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={restraints}
                  onChange={(e) => setRestraints(e.target.checked)}
                />
                New idealized restraints
              </label>
            </>
          )}
          <label>
            Geometry rendering
            <select
              value={physical ? "physical" : "schematic"}
              onChange={(e) => setPhysical(e.target.value === "physical")}
            >
              <option value="physical">Physical diameters</option>
              <option value="schematic">Schematic centerlines</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={difference}
              onChange={(e) => setDifference(e.target.checked)}
            />
            Difference only
          </label>
          {!b1 && (
            <label>
              <input
                type="checkbox"
                checked={ghosts}
                onChange={(e) => setGhosts(e.target.checked)}
              />
              Reference / removed ghosts
            </label>
          )}
          <label>
            Retained opacity
            <input
              type="range"
              aria-label="Retained opacity"
              min=".08"
              max="1"
              step=".02"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
          </label>
        </div>
        <GeometryView
          {...{
            data,
            hypothesis,
            preset,
            physical,
            difference,
            ghosts,
            opacity,
            sectionState,
            restraints,
            context,
            selection,
          }}
          onSelect={setSelection}
        />
        <div className="r3-legend">
          <span className="r3-retained">— Retained</span>
          <span className="r3-reference">— Reference / selected</span>
          <span className="r3-moved">— Moved geometry</span>
          <span className="r3-removed">┄ Removed ghost</span>
          <span className="r3-added">— Added hanger</span>
          <span className="r3-reduced">— Reduced wall</span>
        </div>
        <p className="r3-scope-note">
          {b1
            ? "Inherited centerlines and outer diameters are identical for qualified uniform and candidate. Restraint annotations are new idealized assumptions, not original H3 supports or hardware."
            : preset === "crown_detail"
              ? "The isolated crown subset is a detail view, not a new model. Hidden surroundings remain part of the full hypothesis. Ghosts never count as physical members."
              : preset === "side_system_detail"
                ? "Negative-source-z subset only; the accepted local elevation clips some far-end context. Crossings do not imply joints."
                : "Matched framing, projection and clipping are shared across both panels."}
        </p>
      </section>
      <div className="r3-detail-grid">
        <section className="r3-panel detail-panel">
          <div className="r3-section-heading">
            <h2>
              {b1
                ? "Terminal-member cross-section"
                : "Linked engineering detail"}
            </h2>
            <span className="r3-badge">Engineering schematic</span>
          </div>
          <Asset
            id={b1 ? "S_B1_terminal_section_overlay" : detail}
            caption={
              b1
                ? "Terminal members 1520 / 1538 · true-scale annular comparison"
                : titles[hypothesis]
            }
          />
          {b1 ? (
            <>
              <div className="r3-section-pair">
                <Asset
                  id="S_B1_terminal_section_uniform"
                  caption="Qualified uniform · wall 26.404 mm"
                />
                <Asset
                  id="S_B1_terminal_section_candidate"
                  caption="Candidate · wall 21.404 mm"
                />
              </div>
              <p>
                Unchanged OD: <strong>640 mm</strong>. Original H3 transverse
                wall: <strong>28.000 mm</strong>, a distinct third state.
                Longitudinal tubes retain OD 760 mm and wall 28.290 mm in both
                qualified states.
              </p>
            </>
          ) : (
            <>
              <div className="r3-detail-actions">
                {hypothesis === "H1" &&
                  [57, 58, 59].map((id) => (
                    <button
                      key={id}
                      onClick={() =>
                        setSelection({ hypothesis: "H1", kind: "node", id })
                      }
                    >
                      Inspect crown node {id}
                    </button>
                  ))}
                {hypothesis === "H2" && (
                  <button
                    onClick={() => {
                      setPreset("crown_detail");
                      setGhosts(true);
                      document.getElementById("research-geometry")?.scrollIntoView({block:"start"});
                    }}
                  >
                    Show 18 local removals
                  </button>
                )}
                {hypothesis === "H3" && (
                  <button
                    onClick={() =>
                      setSelection({
                        hypothesis: "H3",
                        kind: "member",
                        id: 2659,
                      })
                    }
                  >
                    Inspect first added hanger
                  </button>
                )}
              </div>
              <p>
                {hypothesis === "H1"
                  ? "True coordinates, no enlarged offsets. Orange indicates geometry change; it does not indicate a displacement or stress."
                  : hypothesis === "H3"
                    ? "H3 contains 2,601 frames and 84 mechanical tension-only cables: 26 new hangers plus 58 retained cables. Mechanical behavior is distinct from display group."
                    : "The vector schematic supplements the matched 3D view with readable identities and explicit line styles."}
              </p>
            </>
          )}
        </section>
        <Inspector
          {...{ data, selection, hypothesis, sectionState }}
          onSelect={setSelection}
        />
      </div>
      {!b1 && (
        <details className="r3-panel">
          <summary>Changed nodes and members</summary>
          {(hypothesis === "H1"
            ? ["H1_moved_nodes", "H1_changed_member_geometry"]
            : hypothesis === "H2"
              ? ["H2_removed_H0_members"]
              : hypothesis === "H3"
                ? ["H3_removed_H0_members", "H3_added_members"]
                : []
          ).map((k) => (
            <div key={k}>
              <h3>
                {k.replaceAll("_", " ")} · {data.selections[k].length}
              </h3>
              <div className="r3-id-list">
                {data.selections[k].map((id: number) => (
                  <button
                    key={id}
                    onClick={() =>
                      setSelection({
                        hypothesis: k.includes("removed") ? "H0" : hypothesis,
                        kind: k.includes("nodes") ? "node" : "member",
                        id,
                        ghost: k.includes("removed"),
                      })
                    }
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Download p={path("inputs/selections.json")}>
            Download changed IDs
          </Download>
        </details>
      )}
      {b1 && (
        <>
          <section className="r3-panel">
            <h2>Inheritance and idealized boundary assumptions</h2>
            <div className="r3-section-pair">
              <Asset
                id="S_B1_plan_inherited"
                caption="19 inherited physical members · source IDs"
              />
              <Asset
                id={
                  restraints
                    ? "S_B1_plan_idealized"
                    : "S_H3_B1_extraction_context"
                }
                caption={
                  restraints
                    ? "New B1+ restraints, enabled separately"
                    : "Extraction from full H3 · no new supports shown"
                }
              />
            </div>
            {restraints && (
              <>
                <h3>Individual constrained DOFs · 1 = restrained, 0 = free</h3>
                <table>
                  <thead>
                    <tr>
                      {[
                        "H3 source node",
                        "ux",
                        "uy",
                        "uz",
                        "rx",
                        "ry",
                        "rz",
                      ].map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.tables.supports.map((s: any) => (
                      <tr key={s.source_node_id}>
                        {[
                          "source_node_id",
                          "ux",
                          "uy",
                          "uz",
                          "rx",
                          "ry",
                          "rz",
                        ].map((k) => (
                          <td key={k}>{s[k]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <p>
              Eight new bearing nodes: 10, 12, 14, 16, 192, 194, 196, 198. The
              anti-roll, datum and guide constraints differ by node. Connection,
              bearing, anchorage, anti-roll hardware and global stability
              capacities remain unverified.
            </p>
            <div className="r3-download-row">
              <Download p={path("inputs/support_DOF_register.csv")}>
                Exact DOF table
              </Download>
              <Download
                p={path(
                  "inputs/selected_boundary_and_excluded_connections.csv",
                )}
              >
                Excluded connections
              </Download>
              <Download p={path("exports/B1_frozen_section_states.json")}>
                All three section states
              </Download>
              <Download p={path("exports/B1_inherited_source_register.json")}>
                14-node / 19-member register
              </Download>
            </div>
          </section>
          <section className="r3-panel">
            <h2>
              Material efficiency and local response
            </h2>
            <div className="r3-metrics">
              <div>
                <b>78,149.078684</b>
                <span>qualified uniform tube mass · kg</span>
              </div>
              <div>
                <b>75,987.635714</b>
                <span>candidate tube mass · kg</span>
              </div>
              <div>
                <b>2,161.442969</b>
                <span>modeled tube mass saved · kg</span>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Loaded terminal local response</th>
                  <th>Qualified uniform</th>
                  <th>Candidate</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Maximum downward displacement</td>
                  <td>6.833027 mm</td>
                  <td>8.001523 mm</td>
                  <td>+17.1007%</td>
                </tr>
                <tr>
                  <td>Conservative stress envelope</td>
                  <td>61.608804 MPa</td>
                  <td>72.119236 MPa</td>
                  <td>+17.0600%</td>
                </tr>
              </tbody>
            </table>
            <p>
              Applies to 1520 in both loads and 1538 in LC-U; see full
              parent-member records for the differently loaded 1538 in LC-E.
              Local increases remain within the frozen screens. The result does
              not establish a global optimum, full-Bridge savings, code
              compliance or physical engineering validation.
            </p>
            <details>
              <summary>Exact archived mass values</summary>
              <pre>{JSON.stringify(data.b1summary.mass, null, 2)}</pre>
            </details>
            <Download p="SCIENTIFIC_SCOPE.md">Findings and verification limits</Download>
          </section>
        </>
      )}
      <ArchivedResponse
        key={`${hypothesis}:${sectionState}`}
        {...{ data, hypothesis, sectionState }}
      />
      {b1 && (
        <details className="r3-panel">
          <summary>
            All 26 archived classifications · including the intentional
            lower-comparator FAIL
          </summary>
          <p>
            26 completed calls, no retries. 8 independent EB pairs, 12 mesh
            comparisons, 4 native EB/Timoshenko comparisons. The α=0.940 LC-E
            comparator fails the reserved displacement screen; α=0.943
            qualifies.
          </p>
          <table>
            <thead>
              <tr>
                <th>Slot / configuration</th>
                <th>Load / engine / mesh</th>
                <th>With reserves, mm</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.catalog
                .filter((r: any) => r.request)
                .map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <Download p={r.path}>
                        {r.request.slot} / {r.archived_call_row.configuration}
                      </Download>
                    </td>
                    <td>
                      {r.request.case} / {r.request.engine} / {r.request.mesh}
                    </td>
                    <td>
                      {Number(r.archived_call_row.reserved_D_mm).toFixed(6)}
                    </td>
                    <td>{r.archived_call_row.response_status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
      <section className="r3-panel r3-history">
        <h2>Study outcomes</h2>
        <table>
          <thead>
            <tr>
              <th>Study</th>
              <th>Recorded outcome</th>
              <th>Interpretation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>R6 human–AI proposal</td>
              <td>REJECTED</td>
              <td>Deck-wide bending increased; combined objective failed.</td>
            </tr>
            <tr>
              <td>R7 Stage S</td>
              <td>CLOSED · NO-GO</td>
              <td>
                No accepted sampled descent direction; not proof of global
                infeasibility.
              </td>
            </tr>
            <tr>
              <td>R8 Priority A</td>
              <td>Verified trade-offs · no combined PASS</td>
              <td>A1–A3 responses and all safeguard rows retained.</td>
            </tr>
            <tr>
              <td>Earlier B1+ Gate 2</td>
              <td>STOPPED · slot 64/66</td>
              <td>Mandatory shear-reference serviceability failure.</td>
            </tr>
            <tr>
              <td>Earlier shear-aware protocol</td>
              <td>INCONCLUSIVE · 14 calls</td>
              <td>Lower FAIL bracket absent; no candidate evaluated.</td>
            </tr>
            <tr>
              <td>B1+ final26</td>
              <td>FULL COMPUTATIONAL PASS</td>
              <td>
                Successful within the idealized, gravity-aware,
                member-screened scope.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          R6 is a human–AI proposal; R7, Priority A and B1+ are deterministic numerical studies. Their recorded outcomes include unsuccessful studies and local trade-offs.
          Numerical verification is distinct from physical engineering validation.
        </p>
      </section>
      <ResearchData release={releaseLocation} scopeUrl={url("SCIENTIFIC_SCOPE.md")} />
      <footer className="r3-research-footer">
        Computational research models · See scientific scope for assumptions and verification limits.
      </footer>
    </main>
  );
}
export default function ResearchViewer() {
  const [state, setState] = useState<any>({ status: "pending" });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const models: any = {},
          maps: any = {};
        await Promise.all(
          ["H0", "H1", "H2", "H3"].map(async (h) => {
            models[h] = validateModel(h, await read(path(`inputs/${h}.json`)));
            maps[h] = await read(path(`inputs/${h}_member_id_map.v1.json`));
          }),
        );
        const [
          catalog,
          cameras,
          selections,
          nodeMap,
          b1,
          sections,
          b1summary,
          tables,
        ] = await Promise.all(
          [
            "FROZEN_RESPONSE_CATALOG.json",
            path("camera_presets.json"),
            path("inputs/selections.json"),
            path("inputs/H3_node_id_map.v1.json"),
            path("exports/B1_inherited_source_register.json"),
            path("exports/B1_frozen_section_states.json"),
            path("inputs/B1_frozen_summary.json"),
            "display-tables.json",
          ].map(read),
        );
        if (alive)
          setState({
            status: "ready",
            data: {
              models,
              maps,
              catalog,
              cameras,
              selections,
              nodeMap,
              b1,
              sections,
              b1summary,
              tables,
            },
          });
      } catch (e: any) {
        if (alive) setState({ status: "error", message: e.message });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return state.status === "ready" ? (
    <Research data={state.data} />
  ) : (
    <main className="research">
      <h1>Structural Models &amp; Mechanics</h1>
      <p role={state.status === "error" ? "alert" : "status"}>
        {state.status === "error"
          ? `Unavailable: ${state.message}`
          : "Loading structural models and archived responses…"}
      </p>
    </main>
  );
}
