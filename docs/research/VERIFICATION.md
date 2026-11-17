# 3D Structural Studio — Verification Coverage

## Static and integrity checks

After packaging and building, run:

```bash
npm run test:preservation
npm run test:static
npm run test:research
npm run test:branding
```

These checks cover 102 protected files; H0–H3 source IDs and lineage; B1+ sections and restraints; all 34 response catalog records; unavailable-state adapters; schematic dependencies; HTTP paths, MIME types and download hashes; source/data ZIP contents; and five GLB source-ID sets. They do not execute structural solvers.

`python3 tests/blender-compatibility.py` checks mocked Blender API behavior. `node tests/blender-vite.mjs` checks HTTP module transformation. Neither verifies an actual Blender import/render or a complete live export.

## Mechanics and export regression

**`npm test` executes structural solvers.** It includes original-versus-integrated baseline and variant comparisons and Blender export-adapter fixtures. The existing suite uses 12 integration solver calls and 8 export-adapter calls. Its tolerances and scientific fixtures are independent of the static checks.

The preceding release candidate passed `npm test` once: **20 solver calls**, confirmed by V8 coverage, with all original acceptance criteria unchanged. Its automated Blender Export checks also passed. The browser review was **BLOCKED / INCOMPLETE** by unavailable WebGL after one Bridge baseline call and zero browser exports. That browser call was traced from source and actions rather than independently instrumented.

The current branding/interface revision has **not rerun those regressions**. Original case logic, kernels and frozen scientific data are unchanged. Presentation changes affect the application header/title, standalone case titles, navigation labels and research download interface. A research-only desktop review confirmed the H1/B1+ headings, identity labels, simplified data section and absence of visible checksums. Native WebGL, narrow-screen layout and original-case interaction/export checks remain outstanding. The preceding PASS remains evidence for its exact source candidate. The Pages workflow executes a separate mechanics regression before deployment.

## Browser verification

The research interface supports a Canvas projection fallback. Hardware WebGL rendering and picking have **not been verified for this version**. On a WebGL-capable browser, check:

- H0–H3 tube geometry, transparency, depth ordering and removed-member overlays.
- Matched orbit, pan, zoom and camera presets, with linked detail views.
- Node/member picking and exact local IDs, including H0 lineage and overlapping objects.
- H1 hidden-chord, H2 removed-brace and H3 hanger details against the engineering schematics.
- B1+ inherited geometry and new restraint annotations; only 1520/1538 change wall thickness, with unchanged 640 mm outer diameter.
- Archived record selection, load/engine/mesh labels and explicit unavailable states without stale responses.
- Narrow-screen layout, keyboard navigation, context recovery and console/network errors.

Original-case browser checks exercise live analysis and export behavior. Record the cases, parameters, browser and Blender versions used; distinguish observed results from untested behavior.

## Interpretation

These checks establish software/data consistency within their stated scope. Numerical agreement and computational screening do not establish physical engineering validation, code compliance or fabrication performance. Study-specific qualifications are described in [Scientific Scope](../../public/research/SCIENTIFIC_SCOPE.md).
