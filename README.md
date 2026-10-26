# CEPHALO-SILK / STRUCTURAL LAB

**IMAGE → GEOMETRY → RESPONSE**

**Live application:** https://wlululu.github.io/cephalo-silk-structural-lab/
**Source repository:** https://github.com/wlululu/cephalo-silk-structural-lab

A standalone browser research application containing three independent, existing structural cases:

- **01 Twin-Arch Web Bridge** — hybrid frame and tension-only cable/web system.
- **02 Loop Towers** — terraced towers, inclined crown, lower cradle and suspended web.
- **03 Woven-Wing Pavilion** — perimeter arches, branching supports and equivalent woven field with the original initial-tension/tangent-response assumptions. Prestress is not form-found.

**No ChatGPT account, OpenAI API key, ChatGPT hosting, private package registry, backend service, database, or Cloudflare account is required.** After installation and build, all rendering, analysis, model data and worker code run locally in the browser. No external runtime requests are needed.

This conversion changes deployment plumbing only. Geometry, authoritative model snapshots, material/section definitions, boundary conditions, mechanics formulations, prestress, solver implementations, baseline results and the completed physics-validation study are preserved. The interface retains the existing Cephalo-Silk title, layout, controls, appearance and case routes.

## Prerequisites

- Node.js **22.13 or later**; Node **24** is recommended and was tested. `.nvmrc` selects 24.
- npm, included with Node; npm 11.9.0 was tested. Use the committed `package-lock.json` for repeatable installs.
- A modern browser supporting ES modules and module workers. WebGL provides the normal rendering path; the existing software renderer remains available when WebGL is unavailable.
- Internet access to the public npm registry for initial dependency installation. **Python is not needed for installation, development, build or the standalone preservation tests.** Historical research scripts may separately require Python 3.
- Python 3 (standard library only) is required for the Blender API compatibility regression in `npm test` / `npm run test:blender`; Blender itself is not required for that mocked API check.

## Installation and local development

Clone this repository, or extract the standalone source bundle, then run in its root:

```bash
npm install
npm run dev
```

Open **http://localhost:5173/** (the server prints the equivalent `http://127.0.0.1:5173/`). Keep the terminal open; Ctrl+C stops it. For a lockfile-only installation use `npm ci`. No environment file or credentials are required.

Routes: `/#/bridge`, `/#/loop-towers`, `/#/pavilion`. Hash routing preserves the same navigation under a repository subpath and needs no server-side rewrites. Changing a control runs the existing analysis; the bridge's first nonlinear solve may take longer than the others.

## Production build and local preview

```bash
npm run build
npm run preview
```

Open **http://localhost:4173/**. The production output is **`dist/`**. It contains the app, local JavaScript/CSS, native case applications, solver workers, images, original research downloads, a copy of the preserved `validation/` directory, and `downloads/cephalo-structural-lab.zip` with the editable standalone source and records.

The build never regenerates models, reruns physics validation, or overwrites baseline files. The source download excludes `dist/`, `node_modules/`, local test output and Git metadata to avoid recursion; rebuild it with the same standard commands after extracting. The delivered release ZIP additionally includes a ready-built `dist/`.

Alternatively, run the prebuilt application using only Node (no npm install):

```bash
node scripts/serve-static.mjs
```

Open **http://localhost:8000/**. The optional existing Python server (`python3 scripts/serve-local.py`) serves the same folder. Use HTTP, not a double-clicked `file://` page: ES modules and analysis workers require an HTTP origin.

## GitHub Pages deployment

The application is publicly deployed at https://wlululu.github.io/cephalo-silk-structural-lab/ from this repository. The production build uses `base: './'`, so app assets, case routes, workers, and downloads resolve under the repository site path; no repository-name changes in the source are required.

For subsequent deployments:

1. In repository **Settings → Pages**, select **GitHub Actions** as the publishing source.
2. Push a reviewed change to `main`, or manually run **Deploy standalone lab to GitHub Pages** in the Actions tab.
3. The workflow runs `npm ci`, `npm run build`, and `npm test`, then publishes the generated `dist/` directory.
4. Open the live site above. The case routes remain `#/bridge`, `#/loop-towers`, and `#/pavilion`.

The workflow uses GitHub-provided permissions (`contents: read`, `pages: write`, and `id-token: write`) and requires no personal access token or OpenAI secret. Visitors to the public application do not need an account. A fork or organization mirror can use the same relative-path build with its own GitHub Pages settings.

Any conventional static host can serve the **contents of `dist/`** at `/` or a directory such as `/cephalo-structural-lab/`. Use a trailing slash on directory URLs, serve `.js` and `.mjs` as JavaScript, and allow same-origin workers and iframe documents. Do not route missing module URLs to an HTML fallback. No SPA rewrite rules, server functions, API routes or host-specific headers are needed.

Deployment reference: [Vite static deployment documentation](https://vite.dev/guide/static-deploy).

## Architecture

| Location | Responsibility |
|---|---|
| `main.tsx` | Platform root, hash routing and case lifecycle |
| `shared/Platform.tsx` | Header and case navigation |
| `shared/CaseToolbar.tsx` | Bridge representation selector |
| `shared/ConceptCard.tsx` | Bridge concept thumbnail and enlargement dialog |
| `public/shared/lab.css` | Shared typography, viewport, experiment-panel, control, legend and metric styling |
| `public/shared/integration.js` | Shared DOM adapter for the two existing plain-JavaScript applications; retains their control IDs and native event handlers |
| `public/shared/renderer.js` | Optional software rendering of the existing Three scenes when WebGL is unavailable |
| `cases/bridge/` | Bridge React view, model generator, geometry builder and original software renderer |
| `public/cases/bridge/` | Bridge worker, solver, default model and preserved data/exports |
| `public/cases/loop-towers/` | Independent native tower application, geometry/model generator, worker, solver and assets |
| `public/cases/pavilion/` | Independent native pavilion application, geometry/model generator, solver and assets |
| `validation/` | Full original baseline snapshots and integration-preservation report |
| `public/downloads/` | Exact original source ZIPs and separately supplied model files |
| `dist/downloads/cephalo-structural-lab.zip` | Standalone editable source archive, generated by the build (no recursive `dist/`) |
| `tests/integration.mjs` | Original-versus-standalone full numerical checks; new output goes to `test-output/` |
| `reproducibility/` | Preserved-file hashes and standalone verification evidence |
| `scripts/serve-static.mjs` | Optional Node-only static HTTP server, also used to test subpath deployment |
| `.github/workflows/pages.yml` | Build, preservation tests and GitHub Pages deployment |

Routes are `/#/bridge`, `/#/loop-towers` and `/#/pavilion`. The compact case selector opens directly on a working case rather than an intermediate landing screen.

The bridge mounts as an independent React component. The other two retain their native JavaScript applications in same-origin iframe documents. This is deliberate: their different Three.js versions, event bindings, solver workers, global IDs and state remain isolated. The shared stylesheet and adapter give them the same interface. No universal structural-model or solver API is imposed.

**Switching case starts a fresh experiment at that case's own defaults.** Leaving the bridge unmounts its view and terminates its worker. Removing either native-case iframe discards its document, animation loop and workers. Browser back/forward works with the case routes. Export Model/Results JSON before leaving a case to retain a particular experiment. There is no new import or autosave feature.

## Authoritative structural representations

The following supplied JSON files are retained **byte-for-byte**. Each exactly matches the output of its unchanged default model generator. None of the visualization meshes or GLB/STL files replaces the structural model.

| Case | Authoritative default snapshot | Runtime generator / geometry | Analysis implementation |
|---|---|---|---|
| Bridge | `public/cases/bridge/model.json` | `cases/bridge/model.mjs:createModel`; `cases/bridge/geometry.mjs`; `cases/bridge/BridgeView.tsx` | `public/cases/bridge/worker.mjs` → `solver.mjs`, `hybrid.mjs`, `frame-element.mjs` |
| Loop Towers | `public/cases/loop-towers/model.json` | `public/cases/loop-towers/model.js:makeModel` and rendering geometry in `app.js` | `worker.js` → `solver.js` in the same folder |
| Pavilion | `public/cases/pavilion/model.json` | `public/cases/pavilion/model.js:makeModel`, `surface`; rendering geometry in `app.js` | `public/cases/pavilion/solver.js:solve`, called by `app.js` |

The running applications generate their model objects in the same way as the originals; they do not reload the default JSON when a control changes. For a changed experiment, the **current model object plus its active parameters** is authoritative. Use the existing Model JSON and Results JSON export controls to record it. Preserve each case's original export conventions:

- **Bridge:** `createModel(settings)` applies material, section and load parameters before solving. Model JSON contains the active model. Result JSON contains model and results. Displacements include prestress equilibration.
- **Loop Towers:** the solver receives a baseline model plus parameters. The model export already scales E, areas and loads; do not apply the multipliers twice. Result exports retain active parameters and element state.
- **Pavilion:** model exports retain baseline definitions and `activeParameters`/`activeLoad`; parameters must be applied once. Results retain the original solver's response conventions.

### Preserved data and exports

Bridge `model.json`, `baseline-results.json`, GLB, STL, `ASSUMPTIONS.md`, README and all supplied validation JSON files remain in `public/cases/bridge/`. Its live Model JSON, Results JSON, GLB and STL exporters remain available. Geometry exports use undeformed coordinates and the original units/conventions.

Loop Towers retains `model.json`, `model.js`, `solver.js`, `worker.js`, README and vendored Three.js files, along with its live model/result exports. No separate GLB/STL or precomputed result file was supplied in that project; none is fabricated.

Pavilion retains `model.json`, `baseline-results.json`, `model.js`, `solver.js`, README and vendored Three.js files, along with its live model/result exports. No GLB/STL was supplied; none is fabricated.

All three complete original archives are also retained under `public/downloads/`. This includes original standalone builds, source, tests and any auxiliary files not used by the integrated runtime. The separately attached `building_model.json` and `pavilion_model.json` were verified identical to the matching project snapshots and are retained there too. Original concept attachments are shown from `original-concept.png`; the projects' own `reference.png` assets are also preserved.

## Interface and experiments

Every case provides Geometry, Structure and Response modes; Perspective, Front, Side, Top and Fit model/reset-camera controls; orbit, zoom and pan; an Original Concept thumbnail with enlargement; structural hierarchy; four response slots; and right-side experiment sections:

1. Loading
2. Material & Sections
3. Deformation / Analysis
4. Reset / Export

Existing case-specific features remain, including the bridge's node loads, region highlights, clearance and export controls; the towers' circulation display, tension-only member inspection, animation and two lateral loading directions; and the pavilion's load vectors, actual/amplified displacement and model notes. A pavilion member-number inspector reads the existing member and axial-force arrays.

Pavilion peak axial force remains its third metric. No new utilization or capacity calculation was invented. Residuals remain visible. The bridge reports convergence only after its existing solver returns successfully; that solver throws on failed equilibrium. A shared visual slot does not imply that different cases' quantities are physically interchangeable.

## Modify one case independently

- **Bridge geometry:** edit only `cases/bridge/model.mjs` for structural coordinates/connectivity and `cases/bridge/geometry.mjs` for visualization. Preserve/update that case's snapshot and documented expectations intentionally. Solver changes belong only in `public/cases/bridge/`.
- **Tower lateral loading:** edit only its `model.js`, `app.js` and local controls as appropriate. The bridge and pavilion do not import these files.
- **Pavilion refinement:** edit only `public/cases/pavilion/`. Its equivalent mechanical mesh and fine visual weave remain distinct.
- **Platform appearance:** edit `shared/` and `public/shared/lab.css`/`integration.js`. These files must not contain mechanics parameters or model definitions.

`cases/loop-towers/README.md` and `cases/pavilion/README.md` point to their deliberately retained native source locations. Avoid creating a second copy of their runtime geometry or solver.

## Standalone verification and preserved baselines

After building:

```bash
npm test
```

This runs:

- `npm run test:preservation`: SHA-256 comparison of all 102 protected scientific/data/worker/rendering/style/validation files against the integrated source snapshot.
- `npm run test:integration`: extracts the original source archives using Node, compares full generated models and full baseline results, then checks a representative parameter change against each original solver. Comparisons use the same solver-module histories. It writes only `test-output/integration-report.json`.
- `npm run test:static`: serves the same `dist/` at `/` and `/cephalo-structural-lab/`; checks asset paths, JavaScript MIME types, exact public-file bytes, native-case downloads, the source archive, preserved validation records and real 404 responses for missing modules. It writes `test-output/static-report.json`.

| Case / baseline metric | Preserved value |
|---|---:|
| Bridge maximum deck displacement | 36.74593686122058 mm |
| Bridge maximum all-node displacement | 76.8779380859019 mm |
| Bridge total vertical reaction | 8,400 kN |
| Loop Towers maximum displacement | 23.095865369389422 mm |
| Woven-Wing Pavilion maximum displacement | 139.4686375173227 mm |

All full baseline and representative control-change result objects matched exactly in the tested Node runtime. This checks conversion equivalence, not renewed mechanics validity. Minor floating-point differences across JavaScript engines do not change the preserved files. Existing mechanics assumptions, limitations and physics-study findings continue to apply without reinterpretation.

The completed study remains at `validation/physics/`, including every individual run, CSV summary, JSON results and report. Existing historical test/study scripts and source manifests are preserved as research records; they are not build dependencies and may describe pre-conversion paths or files. Do not run them with overwrite options to validate this deployment conversion. The supported conversion tests above write to a separate directory.

`reproducibility/` contains the conversion verification evidence. `CONVERSION_NOTES.md` explicitly lists removed/replaced infrastructure and dependencies, every modified/added/deleted file, tested commands, browser coverage and limitations. The original `INTEGRATION_NOTES.md` and original case READMEs remain historical records.


### Optional Blender visualization export

Each case provides **Export Blender Package** in its Reset / Export controls. The downloaded ZIP contains `scene.glb`, the authoritative structural nodes/member model, active UI parameters, optional current unchanged-solver response, Blender's setup script (`open_in_blender.py`), metadata and explanations. The Bridge uses the existing exact Three.js geometry factory. Loop Towers and Pavilion have small standalone export adapters that reuse their original model and solver modules; they also include separately labeled visual surfaces and fine Pavilion woven display lines (not FE elements). Nonstructural Tower planting and circulation decorations are not exported.

#### Method 1 — Direct Import in Blender (Quick Start)

1. In Bridge, Loop Towers or Pavilion, click **Export Blender Package**, then extract the downloaded ZIP.
2. Open Blender and choose **File → Import → glTF 2.0 (.glb/.gltf)**.
3. Select `scene.glb` in the extracted folder and click **Import glTF 2.0**.
4. Inspect the model in the 3D viewport. Drag with the middle mouse button to rotate, scroll to zoom, and use Shift + middle mouse button to pan; the viewport navigation controls provide alternatives.

Direct GLB import does **not** automatically reproduce the standardized camera, materials, lighting, background or import audit. Separately captured visualization layers in JSON are reconstructed by the automated helper below, not by direct GLB import.

#### Method 2 — Automated Import and Rendering (Recommended for Reproducibility)

Extract the ZIP, open Terminal, and change into the extracted package folder. Run the included `open_in_blender.py` using Blender's background mode. No separate Python installation or scripting experience is needed for this workflow; Blender runs the script with its bundled Python.

**Blender available as `blender` on your PATH** (Bash/Zsh): replace the example folder path with your extracted folder, keeping the quotation marks.

```bash
cd "/absolute/path/to/extracted package"
blender --background --factory-startup --python-exit-code 1 --python "./open_in_blender.py" -- "." --render
```

**Standard macOS installation in `/Applications/Blender.app`:** replace the example Downloads folder name if yours differs. Quotes preserve spaces and parentheses in paths.

```bash
cd "$HOME/Downloads/cephalo-silk-bridge-blender (1)"
"/Applications/Blender.app/Contents/MacOS/Blender" --background --factory-startup --python-exit-code 1 --python "./open_in_blender.py" -- "." --render
```

The `-- "."` argument tells the helper to read the package in the current folder; `--render` requests a PNG. Keep the extracted files together. After the command finishes successfully, open `<case>-studio.blend` using Blender's **File → Open**. The same package folder contains:

- `<case>-studio.blend`: the imported model and standardized scene, ready to inspect or adjust.
- `<case>-render.png`: the **3000 × 2100** Cycles render (64 samples by default).
- `blender-import-report.json`: the structural member coverage, groups, scale and endpoint-coordinate audit.

Here `<case>` is `bridge`, `loop-towers` or `pavilion`; for example, `bridge-studio.blend` and `bridge-render.png`. Re-running the command writes the same output names.

#### Package contents and scientific scope

| File | Purpose |
|---|---|
| `scene.glb` | Undeformed exported geometry for direct glTF import. |
| `structural_model.json` | Authoritative structural nodes, member connectivity and model definitions. |
| `metadata.json` | Case identity, captured parameters/view, structural group counts, provenance and response availability. |
| `response.json` | Response availability/status and, when available, unamplified nodal displacement vectors in metres. Check availability before using numerical values. |
| `open_in_blender.py` | Corrected import, geometry-audit, scene-setup and rendering helper. |

Additional files may include `solver_result.json` for a valid original-solver result, `solver_attempt.json` for an invalid attempt, and `visual_layers.json` for separately captured display geometry. Analytical members represent the structural model; display-only surfaces, woven strokes and other visualization geometry are not additional finite elements and must not be interpreted as contributing stiffness.

The export captures the model/parameters at the instant the button is clicked. Bridge includes only its matching completed response. Towers and Pavilion run their unchanged original solver for the captured parameters. Unavailable, invalid or nonconverged results are explicitly unavailable; an invalid raw attempt is named `solver_attempt.json`. Structural GLB geometry remains undeformed, and response vectors are stored in metres without display amplification. Display surfaces are separated from analytical members.

The helper sets up a perspective camera, neutral materials and lighting, and checks every imported structural member ID and endpoint against the source model. **Blender 4.5.3 LTS and 5.2.2 LTS were actually validated for all three baseline cases**, including imports, geometry audits, saved scenes and real PNG renders. Blender 4.5 uses a white compositor background; Blender 5.2 uses the compatibility path's opaque light-gray world background. Background brightness and illumination are not guaranteed to match across versions. Blender rendering and the import audit are visualization/geometry checks, **not mechanical validation**; numerical responses remain separate from the undeformed geometry.

Original solvers, model definitions, workers and 102 provenance-protected files remain unchanged. Full baseline/modified packages can be regenerated with `node scripts/create-blender-examples.mjs test-output/blender-examples --variants`. Tests: `node tests/blender-package.mjs`, `npm test` and `npm run build`. The optional `--turntable` setting adds camera motion only, not a simulated dynamic response; this option and Blender 6 were not included in the 4.5/5.2 compatibility validation.

Additional export checks: `node tests/blender-adapters.mjs` (actual legacy click handlers with Node DOM/Worker shims) and `node tests/blender-vite.mjs` (real Vite HTTP/module serving). These are not browser smoke tests. Local browser exports for all three cases, at baseline and modified parameters, passed the independent six-ZIP audit dated October 25, 2026 (`Cephalo_Silk_Six_Browser_Blender_Exports_Audit.md`, retained in the review evidence). The audit verifies package integrity, geometry counts, parameters and unamplified vectors against each included solver response. It does not establish camera/inspection/deformation behavior, responsive layout, other downloads, clean browser console/network logs, or complete pending/stale/failed-solve handling. Those checks and postdeployment smoke tests require separate sign-off. No remote deployment was performed during integration review.

For Blender 5.x, Cycles is selected directly and the removed legacy compositor is bypassed; Blender 4.x retains its existing alpha-over-white compositor. Geometry and import audits are unchanged. In addition to the Linux runs of both validated versions, the same compatibility script was tested by the user on macOS Blender 5.2.2 LTS for all three cases (imports, audits, scene saves and renders).

`npm run test:blender` runs the Python compatibility regression and all three export checks, and `npm test` includes this suite so the existing GitHub Pages workflow enforces it before deployment. The Python test exercises the actual helper's presentation code against strict version-specific API doubles; it is not a Blender import or render test. A successful CI run does not replace interactive browser acceptance checks. Pushing to `main` triggers the Pages workflow; obtain deployment approval before that push.
