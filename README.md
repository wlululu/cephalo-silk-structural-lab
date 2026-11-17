# 3D Structural Studio

**From Bioinspired Images to Executable Structural Models**

3D Structural Studio is an interactive platform for exploring image-informed structural geometry, computational mechanics, and mechanics-guided design. It brings together three executable architectural models, comparative 3D interpretations, and a focused material-efficiency study.

## Explore the Studio

| Model or study | Open in the Studio | Explore |
|---|---|---|
| **Twin-Arch Web Bridge** | `#/bridge` | Frame-and-cable geometry, loading, and structural response |
| **Loop Towers** | `#/loop-towers` | Interconnected tower geometry and mechanics |
| **Woven-Wing Pavilion** | `#/pavilion` | Woven structural form and mechanical response |
| **H0–H3 Structural Models** | `#/research/H1` | Image-informed 3D interpretations, topology differences, and mechanical comparisons |
| **B1+ Design Study** | `#/research/B1` | Material allocation and response in an idealized deck subsystem |

The three original models support live parameter changes and mechanical analysis. H0–H3 and B1+ provide interactive views of documented models and their archived computational responses. The research viewers include matched perspectives, difference highlighting, structural schematics, and model downloads.

In the B1+ study, a targeted section change to two members produced a **2.7658% reduction in modeled steel-tube mass** within an idealized, gravity-aware 14-node, 19-member deck subsystem, subject to its documented screening criteria.

## Run Locally

Requires **Node.js 22.13+**.

```bash
npm ci
npm run package:research
npm run build
npm run preview
```

Open `http://localhost:4173/` in your browser. For development, use `npm run dev`. The application should be served over HTTP to support its modules and analysis workers.

## Blender Export and Rendering

The three original interactive cases provide an **Export Blender Package** button for creating editable 3D visualization assets.

1. Open **Bridge**, **Loop Towers**, or **Pavilion** in the Studio. Choose the desired model settings, then click **Export Blender Package** and extract the downloaded ZIP.
2. **Method 1 — Import the 3D model:** In Blender, select **File → Import → glTF 2.0 (.glb/.gltf)** and open `scene.glb` from the extracted package. Adjust materials, lighting, and camera as desired.
3. **Method 2 — Generate a Blender scene and render:** Open a terminal in the extracted package folder and run:

   ```bash
   blender -b --python open_in_blender.py -- "$PWD" --render
   ```

   The helper imports the model, arranges structural and visual layers, sets up materials, lighting, and camera, saves `<case>-studio.blend`, and renders `<case>-render.png` in the package folder. On macOS, use `/Applications/Blender.app/Contents/MacOS/Blender` in place of `blender` if needed. For a camera-turntable scene, replace `--render` with `--turntable`.

Each Blender package includes `scene.glb`, `structural_model.json`, `metadata.json`, `response.json`, and the Python helper, with additional visualization and response files where applicable. The geometry is exported in its undeformed configuration; numerical displacements are stored separately in the response data.

## Research Data and Reproducibility

The [GitHub repository](https://github.com/wlululu/cephalo-silk-structural-lab) contains the application source code. Structural models, mechanical responses, and engineering schematics are available through the corresponding Studio views.

Download the versioned [Research Data v1](https://github.com/wlululu/cephalo-silk-structural-lab/releases/download/research-viewer-minimal-v1/cephalo-silk-research-data-minimal-v1.zip).

For model assumptions, numerical verification, and data organization, see [Scientific Scope](public/research/SCIENTIFIC_SCOPE.md), [Data and Reproducibility](docs/research/REPRODUCIBILITY.md), and [Verification Coverage](docs/research/VERIFICATION.md). The studies use idealized structural models with explicitly documented loading, support, and analysis assumptions.

## Citation

When using the software or research data, cite **3D Structural Studio** and the [source repository](https://github.com/wlululu/cephalo-silk-structural-lab), including the relevant version and model or study identifiers.
