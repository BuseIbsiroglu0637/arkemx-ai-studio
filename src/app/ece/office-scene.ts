import * as THREE from "three";
import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";

/** Small, local scene: no remote assets or model downloads. Units are metres. */
export function createOfficeScene() {
  const room = new Group();
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  function material(color: number) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.75 }));
    return materials.get(color)!;
  }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, color: number) {
    const mesh = new Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.position.set(x, y, z); room.add(mesh); return mesh;
  }
  function cylinder(top: number, bottom: number, height: number, x: number, y: number, z: number, color: number) {
    const mesh = new Mesh(new THREE.CylinderGeometry(top, bottom, height, 20), material(color));
    mesh.position.set(x, y, z); room.add(mesh); return mesh;
  }
  // Warm wall, floor, window and a restrained city silhouette.
  box(5, 3.1, 0.08, 0, 1.1, -0.95, 0x34313e);
  box(5, 0.04, 5, 0, -0.02, 0, 0x73645d);
  box(1.65, 1.23, 0.06, -0.8, 1.43, -0.89, 0x1e242f);
  const sky = box(1.54, 1.12, 0.025, -0.8, 1.43, -0.85, 0x829aa7);
  (sky.material as THREE.MeshStandardMaterial).emissive.setHex(0x3c4b56);
  for (let i = 0; i < 8; i++) {
    const h = 0.17 + (i % 3) * 0.09;
    box(0.13, h, 0.025, -1.46 + i * 0.19, 0.91 + h / 2, -0.83, 0x52636c);
  }
  box(0.035, 1.15, 0.045, -0.8, 1.43, -0.79, 0x282c35);
  box(1.55, 0.035, 0.045, -0.8, 1.34, -0.79, 0x282c35);
  // Shelf, books and plant.
  box(0.85, 0.045, 0.25, 1, 1.26, -0.76, 0x9e8063);
  for (let i = 0; i < 5; i++) box(0.07, 0.24 + (i % 2) * 0.06, 0.14, 0.72 + i * 0.085, 1.41, -0.76, [0x79718c, 0xa18c70, 0x567673][i % 3]);
  cylinder(0.12, 0.09, 0.22, 1.22, 1.39, -0.72, 0xd4c3ab);
  for (let i = 0; i < 6; i++) {
    const leaf = new Mesh(new THREE.SphereGeometry(0.09, 10, 8), material(0x497b62));
    leaf.scale.set(0.55, 1.9, 0.6); leaf.rotation.z = (i - 2.5) * 0.27;
    leaf.position.set(1.22 + Math.sin(i * 2) * 0.09, 1.63 + (i % 2) * 0.06, -0.72); room.add(leaf);
  }
  // Upholstered chair; seat and back remain visible around the avatar.
  box(0.53, 0.11, 0.48, 0, 0.49, -0.015, 0x504963);
  box(0.55, 0.62, 0.1, 0, 0.84, -0.23, 0x504963);
  cylinder(0.035, 0.035, 0.44, 0, 0.23, -0.02, 0x282b32);
  box(0.65, 0.04, 0.08, 0, 0.04, -0.02, 0x282b32);
  // Desk in front of Ece. Open sides make the seated pose legible.
  box(1.9, 0.065, 0.82, 0, 0.86, 0.61, 0xbb9570);
  for (const x of [-0.82, 0.82]) box(0.055, 0.83, 0.68, x, 0.415, 0.61, 0x33343d);
  // Laptop, with the lid facing the seated avatar.
  box(0.46, 0.018, 0.29, -0.46, 0.906, 0.61, 0x9799a5);
  const lid = box(0.46, 0.29, 0.02, -0.46, 1.05, 0.75, 0x535564);
  lid.rotation.x = -0.16;
  box(0.09, 0.04, 0.005, -0.46, 1.05, 0.769, 0xc4b7dc);
  // Notebook, pen and ceramic mug.
  const book = box(0.25, 0.023, 0.21, 0.44, 0.909, 0.53, 0xe8ddcc); book.rotation.y = -0.16;
  const pen = box(0.012, 0.012, 0.16, 0.5, 0.927, 0.54, 0x51435c); pen.rotation.y = -0.3;
  cylinder(0.055, 0.045, 0.11, 0.72, 0.947, 0.72, 0xe9d9c8);
  const handle = new Mesh(new THREE.TorusGeometry(0.034, 0.009, 8, 16), material(0xe9d9c8));
  handle.position.set(0.785, 0.95, 0.72); room.add(handle);
  return room;
}
