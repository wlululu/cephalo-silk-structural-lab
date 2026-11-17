import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CanvasProjection } from "./CanvasProjection";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { classifyMember, memberParent } from "./archive.mjs";
let webglAvailable: boolean | undefined;
const COLORS = {
  retained: "#87949f",
  reference: "#2563ae",
  moved: "#ce7019",
  removed: "#c5494c",
  added: "#008a80",
  reduced: "#854ac3",
  selected: "#1559cd",
};
const xyz = (p: number[]) => new THREE.Vector3(p[0], -p[2], p[1]);
export default function GeometryView({
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
  onSelect,
}: any) {
  const host = useRef<HTMLDivElement>(null),
    saved = useRef<any>(null);
  const [error, setError] = useState("");
  const [focusedSide, setFocusedSide] = useState(1),
    [reset, setReset] = useState(0);
  const navigation = useRef<any>(null);
  const b1 = hypothesis === "B1",
    labels = b1
      ? context
        ? ["Full H3 · extraction context", "B1+ · inherited subsystem"]
        : ["B1+ · qualified uniform", `B1+ · ${sectionState}`]
      : ["H0 · reference", `${hypothesis} · hypothesis`];
  useEffect(() => {
    const el = host.current!;
    setError("");
    let renderer: any;
    try {
      if (webglAvailable === undefined) {
        const gl = document.createElement("canvas").getContext("webgl2");
        webglAvailable = !!gl;
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      }
      if (!webglAvailable) throw Error("WebGL unavailable");
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (e) {
      try {
        renderer = new CanvasProjection();
        setError(
          "Canvas projection fallback active: matched source coordinates and projected physical diameters. Accepted vector details remain available below.",
        );
      } catch (e) {
        setError(
          "3D rendering unavailable. Use the accepted vector details and exact-ID inspector below.",
        );
        return;
      }
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor("#f7f9fb");
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Matched 3D geometry comparison. Drag to orbit, wheel to zoom, shift-drag to pan. Use the ID inspector for keyboard selection.",
    );
    renderer.domElement.setAttribute("role", "img");
    const key = b1
      ? context
        ? "H3_B1_extraction_context"
        : "B1_uniform_perspective"
      : `H0_${preset}`;
    const cp = data.cameras.presets[key].camera;
    const matrix = new THREE.Matrix4().set(
      ...(cp.matrix_world.flat() as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]),
    );
    const camera: any =
      cp.type === "PERSP"
        ? new THREE.PerspectiveCamera(40, 0.8, 0.1, 1500)
        : new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1500);
    camera.up.set(0, 0, 1);
    matrix.decompose(camera.position, camera.quaternion, camera.scale);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.fromArray(cp.target);
    controls.enableDamping = false;
    controls.update();
    if (saved.current?.key === key && saved.current?.reset === reset) {
      camera.position.copy(saved.current.position);
      camera.quaternion.copy(saved.current.quaternion);
      camera.zoom = saved.current.zoom;
      controls.target.copy(saved.current.target);
      controls.update();
    }
    const scenes = [new THREE.Scene(), new THREE.Scene()],
      pickables: any[][] = [[], []],
      disposables: any[] = [];
    const restraintLabels:any[]=[];
    const refModel = data.models.H0;
    const subset = (model: any, name: string, m: any) => {
      if (b1) return true;
      if (preset === "crown_detail")
        return data.selections.crown_detail_H0_members.includes(
          memberParent(name, m.id, data.maps),
        );
      if (preset === "side_system_detail") {
        const ns = new Map(model.nodes.map((n: any) => [n.id, n]));
        return (
          (ns.get(m.a) as any).position[2] < 0 &&
          (ns.get(m.b) as any).position[2] < 0 &&
          (m.behavior === "tension_only_cable" ||
            m.system === "primary_arch" ||
            m.type === "deck")
        );
      }
      return true;
    };
    const build = (side: number) => {
      const scene = scenes[side];
      scene.add(new THREE.AmbientLight(0xffffff, 2.0));
      const light = new THREE.DirectionalLight(0xffffff, 2.2);
      light.position.set(30, -60, 120);
      scene.add(light);
      const name = b1
        ? context && side === 0
          ? "H3"
          : "B1"
        : side === 0
          ? "H0"
          : hypothesis;
      const model = name === "B1" ? data.b1 : data.models[name];
      const nodeMap = new Map(model.nodes.map((n: any) => [n.id, n]));
      const groups = new Map<string, any[]>();
      const push = (m: any, nodes: any, status: string, ghost = false) => {
        if (difference && status === "retained") return;
        if (
          b1 &&
          difference &&
          !(context && side === 0) &&
          !data.selections.B1_changed_members.includes(m.id)
        )
          return;
        const selected =
          selection?.hypothesis === name &&
          selection?.kind === "member" &&
          selection?.id === m.id &&
          !ghost;
        const color = selected
          ? COLORS.selected
          : COLORS[status as keyof typeof COLORS];
        const alpha = ghost ? 0.72 : status === "retained" ? opacity : 1;
        const k = `${color}|${alpha}|${ghost}`;
        if (!groups.has(k)) groups.set(k, []);
        groups
          .get(k)!
          .push({
            m,
            a: xyz(nodes.get(m.a).position),
            b: xyz(nodes.get(m.b).position),
            name: ghost ? "H0" : name,
            ghost,
            status,
          });
      };
      for (const m of model.members) {
        if (!subset(model, name, m)) continue;
        let status = b1
          ? context && side === 0
            ? data.selections.B1_source_members.includes(m.id)
              ? "reference"
              : "retained"
            : data.selections.B1_changed_members.includes(m.id)
              ? sectionState === "candidate" && side === 1
                ? "reduced"
                : "reference"
              : "retained"
          : classifyMember(name, m.id, hypothesis, data.selections, data.maps);
        push(m, nodeMap, status);
      }
      if (!b1 && side === 1 && ghosts) {
        const ids =
          hypothesis === "H1"
            ? data.selections.H1_changed_member_geometry
            : hypothesis === "H2"
              ? data.selections.H2_removed_H0_members
              : hypothesis === "H3"
                ? data.selections.H3_removed_H0_members
                : [];
        const rn = new Map(refModel.nodes.map((n: any) => [n.id, n]));
        for (const m of refModel.members)
          if (ids.includes(m.id) && subset(refModel, "H0", m))
            push(m, rn, hypothesis === "H1" ? "reference" : "removed", true);
      }
      for (const [key, items] of groups) {
        const [color, a, ghost] = key.split("|");
        const alpha = Number(a);
        if (physical && ghost === "false") {
          const g = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false),
            mat = new THREE.MeshStandardMaterial({
              color,
              roughness: 0.75,
              transparent: alpha < 1,
              opacity: alpha,
              depthWrite: alpha === 1,
            });
          const mesh = new THREE.InstancedMesh(g, mat, items.length);
          const dummy = new THREE.Object3D();
          items.forEach((it, i) => {
            const dir = it.b.clone().sub(it.a);
            const diameter =
              it.m.section.outerDiameter ?? it.m.section.diameter;
            if (!Number.isFinite(diameter))
              throw Error("Unknown physical diameter");
            dummy.position.copy(it.a).add(it.b).multiplyScalar(0.5);
            dummy.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              dir.clone().normalize(),
            );
            dummy.scale.set(diameter / 2, dir.length(), diameter / 2);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
          });
          mesh.userData.items = items;
          scene.add(mesh);
          pickables[side].push(mesh);
          disposables.push(g, mat);
        } else {
          const positions = items.flatMap((it) => [
            ...it.a.toArray(),
            ...it.b.toArray(),
          ]);
          const g = new THREE.BufferGeometry();
          g.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3),
          );
          const mat =
            ghost === "true"
              ? new THREE.LineDashedMaterial({
                  color,
                  transparent: true,
                  opacity: alpha,
                  dashSize: 0.35,
                  gapSize: 0.2,
                  depthTest: false,
                })
              : new THREE.LineBasicMaterial({
                  color,
                  transparent: alpha < 1,
                  opacity: alpha,
                });
          const lines = new THREE.LineSegments(g, mat);
          lines.computeLineDistances();
          lines.userData.items = items;
          scene.add(lines);
          pickables[side].push(lines);
          disposables.push(g, mat);
        }
      }
      // Source nodes only: no numerical subdivisions or inferred crossing joints.
      const activeMembers = model.members.filter((m: any) =>
        subset(model, name, m),
      );
      const used = new Set((difference ? [...groups.values()].flat().filter((it:any)=>!it.ghost).map((it:any)=>it.m) : activeMembers).flatMap((m: any) => [m.a, m.b]));
      const nodes = model.nodes.filter(
        (n: any) =>
          used.has(n.id) &&
          (!b1 ||
            name === "B1" ||
            data.selections.B1_source_nodes.includes(n.id)),
      );
      const g = new THREE.BufferGeometry().setFromPoints(
        nodes.map((n: any) => xyz(n.position)),
      );
      const colors = nodes.flatMap((n: any) =>
        new THREE.Color(
          selection?.hypothesis === name &&
          selection?.kind === "node" &&
          selection?.id === n.id
            ? COLORS.selected
            : COLORS.reference,
        ).toArray(),
      );
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size: b1 ? 6 : 3,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
      });
      const pts = new THREE.Points(g, mat);
      pts.userData.nodes = nodes;
      pts.userData.name = name;
      scene.add(pts);
      pickables[side].unshift(pts);
      disposables.push(g, mat);
      if (b1 && restraints && name === "B1")
        for (const s of data.tables.supports) {
          const n = nodeMap.get(Number(s.source_node_id)) as any;
          const point = xyz(n.position);
          const label=document.createElement('span');
          label.className='r3-restraint-label';
          label.textContent=`${s.source_node_id}: ${['ux','uy','uz','rx','ry','rz'].filter(d=>s[d]==='1').join(' ')}`;
          label.title='New idealized B1+ constrained DOFs; annotation, not hardware';
          el.appendChild(label);
          restraintLabels.push({label,point,side,offset:n.position[2]<0?-24:12});
        }
    };
    try {
      build(0);
      build(1);
    } catch (e: any) {
      setError(e.message);
    }
    const render = () => {
      const w = el.clientWidth,
        h = el.clientHeight,
        half = w < 650 ? w : w / 2;
      renderer.setSize(w, h, false);
      const aspect = half / h;
      if (camera.isPerspectiveCamera) {
        camera.aspect = aspect;
        camera.fov =
          (2 *
            Math.atan(cp.sensor_width_mm / (2 * cp.lens_mm * aspect)) *
            180) /
          Math.PI;
      } else {
        const width = cp.ortho_scale;
        camera.left = -width / 2;
        camera.right = width / 2;
        camera.top = width / (2 * aspect);
        camera.bottom = -width / (2 * aspect);
      }
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      renderer.setScissorTest(true);
      for (const side of w < 650 ? [focusedSide] : [0, 1]) {
        const left = w < 650 ? 0 : side * half;
        renderer.setViewport(left, 0, half, h);
        renderer.setScissor(left, 0, half, h);
        renderer.render(scenes[side], camera);
      }
      for(const item of restraintLabels){
        const p=item.point.clone().project(camera),visible=(w>=650||item.side===focusedSide)&&Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1;
        item.label.style.display=visible?'block':'none';
        item.label.style.left=`${(w<650?0:item.side*half)+(p.x+1)*half/2}px`;
        item.label.style.top=`${(1-p.y)*h/2+item.offset}px`;
      }
      saved.current = {
        key,
        reset,
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        zoom: camera.zoom,
        target: controls.target.clone(),
      };
      el.dataset.projection = cp.type;
      el.dataset.camera = JSON.stringify([
        camera.position.toArray(),
        controls.target.toArray(),
        camera.zoom,
      ]);
    };
    navigation.current = {
      zoom: (factor: number) => {
        camera.zoom *= factor;
        render();
      },
      pan: (dx: number, dy: number) => {
        const v = new THREE.Vector3(dx, dy, 0).applyQuaternion(
          camera.quaternion,
        );
        camera.position.add(v);
        controls.target.add(v);
        controls.update();
        render();
      },
    };
    const observer = new ResizeObserver(render);
    observer.observe(el);
    controls.addEventListener("change", render);
    render();
    let down = [0, 0];
    const pointerDown = (e: PointerEvent) => {
      down = [e.clientX, e.clientY];
    };
    const pick = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
      const rect = el.getBoundingClientRect();
      const narrow = rect.width < 650,
        half = narrow ? rect.width : rect.width / 2,
        side = narrow ? focusedSide : e.clientX - rect.left < half ? 0 : 1;
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left - (narrow ? 0 : side * half)) / half) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const ray = new THREE.Raycaster();
      ray.params.Line.threshold = preset === "crown_detail" ? 0.12 : 0.45;
      ray.params.Points.threshold = preset === "crown_detail" ? 0.12 : 0.45;
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(pickables[side], false);
      const hit = hits.find(item=>item.object.userData.nodes) || hits[0];
      if (!hit) return;
      const obj: any = hit.object;
      if (obj.userData.nodes) {
        const n = obj.userData.nodes[hit.index!];
        onSelect({ hypothesis: obj.userData.name, kind: "node", id: n.id });
      } else {
        const it =
          obj.userData.items[hit.instanceId ?? Math.floor(hit.index! / 2)];
        if (it)
          onSelect({
            hypothesis: it.name,
            kind: "member",
            id: it.m.id,
            ghost: it.ghost,
          });
      }
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pick);
    return () => {
      observer.disconnect();
      controls.dispose();
      disposables.forEach((o) => o.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      restraintLabels.forEach(item=>item.label.remove());
    };
  }, [
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
    focusedSide,
    reset,
  ]);
  return (
    <div className="r3-geometry-wrap" data-focused-side={focusedSide}>
      <div className="r3-camera-actions">
        <button onClick={() => setReset((n) => n + 1)}>
          Reset matched camera
        </button>
        <button
          aria-label="Zoom in both views"
          onClick={() => navigation.current?.zoom(1.2)}
        >
          Zoom +
        </button>
        <button
          aria-label="Zoom out both views"
          onClick={() => navigation.current?.zoom(1 / 1.2)}
        >
          Zoom −
        </button>
        <button
          aria-label="Pan left both views"
          onClick={() => navigation.current?.pan(-1, 0)}
        >
          ← Pan
        </button>
        <button
          aria-label="Pan right both views"
          onClick={() => navigation.current?.pan(1, 0)}
        >
          Pan →
        </button>
        <label className="r3-focus-select">
          Narrow-screen focus
          <select
            value={focusedSide}
            onChange={(e) => setFocusedSide(Number(e.target.value))}
          >
            <option value={0}>Reference</option>
            <option value={1}>Hypothesis / candidate</option>
          </select>
        </label>
      </div>
      <div className="r3-viewport-labels">
        <strong>{labels[0]}</strong>
        <strong>{labels[1]}</strong>
      </div>
      <div
        ref={host}
        className="r3-geometry-canvas"
        data-testid="geometry-view"
      />
      {error && (
        <p className="r3-render-note" role="status">
          {error}
        </p>
      )}
      <div className="r3-view-caption">
        One linked camera ·{" "}
        {physical
          ? "Physical exterior diameters (thin cables may be subpixel)"
          : "Schematic centerlines (screen-space strokes)"}{" "}
        · undeformed geometry · source-node dots are annotations{b1 && restraints ? " · restraint labels list new constrained DOFs" : ""}
      </div>
    </div>
  );
}
