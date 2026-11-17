# Application Architecture

The platform provides a shared navigation shell while preserving each case's model and numerical conventions.

| Component | Implementation |
|---|---|
| Twin-Arch Web Bridge | React case component and its original worker/solver modules |
| Loop Towers and Woven-Wing Pavilion | Independent native applications in same-origin frames |
| Research Studies | Separate geometry views and read-only archived-response adapters |
| Shared interface | Navigation, asset paths and presentation controls |

Case isolation preserves the original Three.js versions, event handlers and solver state. Switching cases starts a new experiment at that case's defaults. Export model/results before leaving a case to retain its active state.

The default structural snapshots are `public/cases/{bridge,loop-towers,pavilion}/model.json`. Active experiments use each case's generated model and parameters. Visualization meshes are not substitutes for those structural definitions. Research views use their own cataloged frozen model identities and do not start original-case analyses.

The 102-file preservation manifest and archived validation records document source identity. Historical records describe the versions they tested; they do not certify subsequent changes. See [Verification Coverage](docs/research/VERIFICATION.md) for the current test scope and outstanding checks.
