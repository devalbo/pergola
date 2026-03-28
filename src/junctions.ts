import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import type { NamedScenePoint } from "./worker";

const JUNCTION_COL_RADIUS = 0.12;
const junctionMarkerMat = new MeshStandardMaterial({
  color: 0xe8b44a,
  emissive: 0x331800,
  emissiveIntensity: 0.4,
  roughness: 0.42,
  metalness: 0.12,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

const JUNCTIONS_VISIBLE_KEY = "pergola-junctions-visible";

export type JunctionSystem = {
  root: Group;
  addColumns: (points: NamedScenePoint[]) => void;
  clear: () => void;
  isVisible: () => boolean;
  toggle: () => void;
};

export function createJunctionSystem(): JunctionSystem {
  const root = new Group();
  root.name = "junctionMarkers";

  let visible = localStorage.getItem(JUNCTIONS_VISIBLE_KEY) !== "0";
  root.visible = visible;

  function clear(): void {
    root.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        const m = obj.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }
  }

  function addColumns(points: NamedScenePoint[]): void {
    clear();
    for (const p of points) {
      const x = p.position[0];
      const y = p.position[1];
      let zMin = p.zMin ?? p.position[2];
      let zMax = p.zMax ?? p.position[2];
      zMin = Math.min(zMin, 0);
      if (zMax - zMin < 0.5) zMax = zMin + 1;

      const height = zMax - zMin;
      const geo = new CylinderGeometry(JUNCTION_COL_RADIUS, JUNCTION_COL_RADIUS, height, 12);
      const mesh = new Mesh(geo, junctionMarkerMat.clone());
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, zMin + height / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.excludeFromFit = true;
      mesh.userData.partLabel = p.label;
      root.add(mesh);
    }
  }

  function toggle(): void {
    visible = !visible;
    root.visible = visible;
    localStorage.setItem(JUNCTIONS_VISIBLE_KEY, visible ? "1" : "0");
  }

  return {
    root,
    addColumns,
    clear,
    isVisible: () => visible,
    toggle,
  };
}
