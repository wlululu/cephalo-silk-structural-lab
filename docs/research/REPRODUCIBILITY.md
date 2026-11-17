# 3D Structural Studio — Data and Reproducibility

## Data organization

| Location | Contents |
|---|---|
| `public/research/` | Viewer models, lineage maps, cameras, engineering SVGs and archived responses |
| `research-data/files/` | Archive-only GLBs and supporting protocol/verification records |
| `public/research/FROZEN_RESPONSE_CATALOG.json` | The 34 response records eligible for display, with source identities and verification scope |
| `public/research/file-index.json` | SHA-256 and byte length for each distributed research file |
| `research-data/distribution.json` | Mapping from scientific paths to website or archive storage |
| `research-data/release-manifest.json` | Data archive identity and complete file inventory |

Scientific models, results and standalone assets retain their original bytes. `display-tables.json` parses existing CSV records for display. `asset-pairs.json` groups distributed schematics. `SCIENTIFIC_SCOPE.md` summarizes the studies; `provenance.json` identifies its source records by hash. Original identifiers in provenance records do not imply that every referenced source is distributed here. Historical source documentation, including the protected root `ASSUMPTIONS.md`, describes its original model version. Use each active case model and each archived response's model/load/formulation scope when interpreting results.

## Build and integrity checks

```bash
npm ci
npm run package:research
npm run build
npm run test:preservation
npm run test:static
npm run test:research
```

Packaging checks source hashes, creates a deterministic ZIP and updates distribution manifests. The build and commands above do not run structural solvers or Blender. For a local preview, run `npm run preview` and open `http://localhost:4173/#/research/H1`. Original-case routes run their own analyses when opened.

The 102 protected application files are checked against their recorded hashes. The application baseline is `0e1929f38084c7f62da99dbafb4f00c04d2f075b`; research geometry and response adapters are separate modules under `research/`.

## Downloads

The repository and data filenames retain their historical identifiers. The archive is named `cephalo-silk-research-data-minimal-v1.zip`. Its current size and SHA-256 are recorded in the release manifest. The viewer displays a download link only when a published location is configured; it currently reports the archive unavailable online.

A complete repository checkout includes the files needed for packaging. The lightweight website source ZIP can be supplemented from the research-data ZIP: copy its archive-tier entries to the `source` locations declared in `distribution.json`, then verify them against the manifest.

## Reproducibility limits

This distribution supports a repeatable viewer build and byte-level inspection of its archived evidence. It does not contain the complete B1+ execution source bundle or all source-chain archives referenced by the original lock. Dependency versions and source hashes are retained, but a complete historical mechanics rerun is not supported by this package alone. The three original cases retain their executable numerical kernels.

SVGs and GLBs are distributed as fixed assets. Interactive picking uses source JSON IDs; five GLBs are checked against their source member sets.

See [Scientific Scope](../../public/research/SCIENTIFIC_SCOPE.md) for model assumptions and [Verification Coverage](VERIFICATION.md) for test scope.
