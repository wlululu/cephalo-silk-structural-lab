import * as THREE from "three";
/** Geometry-only fallback. Projects the same source endpoints with the same camera.
 * Stroke widths are projected physical diameters, never a minimum-radius inflation.
 * Painter ordering is illustrative; this is not a surface or mechanics calculation.
 */
export class CanvasProjection {
  domElement = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private ratio = 1;
  private viewport = [0, 0, 1, 1];
  private color = "#f7f9fb";
  constructor() {
    const c = this.domElement.getContext("2d");
    if (!c) throw Error("Neither WebGL nor Canvas 2D is available");
    this.ctx = c;
  }
  setPixelRatio(r: number) {
    this.ratio = r;
  }
  setClearColor(c: string) {
    this.color = c;
  }
  setSize(w: number, h: number) {
    if (
      this.domElement.width !== Math.round(w * this.ratio) ||
      this.domElement.height !== Math.round(h * this.ratio)
    ) {
      this.domElement.width = Math.round(w * this.ratio);
      this.domElement.height = Math.round(h * this.ratio);
    }
  }
  setScissorTest(_v: boolean) {}
  setScissor(_x: number, _y: number, _w: number, _h: number) {}
  setViewport(x: number, y: number, w: number, h: number) {
    this.viewport = [x, y, w, h];
  }
  render(scene: THREE.Scene, camera: THREE.Camera) {
    camera.updateMatrixWorld();
    const [vx, vy, w, h] = this.viewport,
      c = this.ctx;
    c.save();
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    c.beginPath();
    c.rect(vx, vy, w, h);
    c.clip();
    c.fillStyle = this.color;
    c.fillRect(vx, vy, w, h);
    const project = (p: THREE.Vector3) => {
      const q = p.clone().project(camera);
      return {
        x: vx + ((q.x + 1) * w) / 2,
        y: vy + ((1 - q.y) * h) / 2,
        z: q.z,
      };
    };
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const strokes: any[] = [];
    for (const obj of scene.children as any[]) {
      if (!obj.userData.items) continue;
      const mat = obj.material;
      for (const it of obj.userData.items) {
        const a = project(it.a),
          b = project(it.b);
        if ((a.z < -1 && b.z < -1) || (a.z > 1 && b.z > 1)) continue;
        const mid = it.a.clone().add(it.b).multiplyScalar(0.5);
        const diameter = it.m.section.outerDiameter ?? it.m.section.diameter;
        const p = project(mid),
          edge = project(mid.clone().addScaledVector(right, diameter));
        strokes.push({
          a,
          b,
          width: obj.isInstancedMesh
            ? Math.hypot(edge.x - p.x, edge.y - p.y)
            : 1.25,
          color: "#" + mat.color.getHexString(),
          opacity: mat.opacity,
          ghost: it.ghost,
        });
      }
    }
    strokes.sort((a, b) => b.a.z + b.b.z - a.a.z - a.b.z);
    for (const s of strokes) {
      c.globalAlpha = s.opacity;
      c.strokeStyle = s.color;
      c.lineWidth = s.width;
      c.setLineDash(s.ghost ? [5, 4] : []);
      c.beginPath();
      c.moveTo(s.a.x, s.a.y);
      c.lineTo(s.b.x, s.b.y);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.setLineDash([]);
    for (const obj of scene.children as any[]) {
      if (obj.userData.nodes) {
        const pos = obj.geometry.attributes.position,
          colors = obj.geometry.attributes.color;
        c.globalAlpha = obj.material.opacity;
        for (let i = 0; i < pos.count; i++) {
          const p = project(new THREE.Vector3().fromBufferAttribute(pos, i));
          if (p.z < -1 || p.z > 1) continue;
          c.fillStyle =
            "#" +
            new THREE.Color().fromBufferAttribute(colors, i).getHexString();
          c.beginPath();
          c.arc(p.x, p.y, obj.material.size / 2, 0, Math.PI * 2);
          c.fill();
        }
      } else if (obj.isMesh && !obj.isInstancedMesh) {
        const p = project(obj.position);
        c.strokeStyle = "#a46518";
        c.globalAlpha = 1;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(p.x, p.y - 6);
        c.lineTo(p.x - 6, p.y + 5);
        c.lineTo(p.x + 6, p.y + 5);
        c.closePath();
        c.stroke();
      }
    }
    c.restore();
  }
  dispose() {}
}
