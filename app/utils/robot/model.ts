import type { BufferGeometry, Material, Object3D } from 'three';
import { BackSide, Color, EdgesGeometry, Mesh, MeshBasicMaterial, ShaderMaterial } from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function loadRobot() {
  const { scene: root } = await new GLTFLoader().loadAsync('/models/robot/robot.glb');
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const outlines: { mesh: Mesh; edges: LineSegments2; silhouette: Mesh }[] = [];
  const ink = new LineMaterial({ color: '#b3472f', linewidth: 1.35, toneMapped: false });
  const silhouette = new ShaderMaterial({
    side: BackSide,
    uniforms: { color: { value: new Color('#b3472f') } },
    vertexShader: `void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * 0.008, 1.0);
    }`,
    fragmentShader: `uniform vec3 color;
      void main() { gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  materials.add(ink);
  materials.add(silhouette);

  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    const original = Array.isArray(object.material) ? object.material : [object.material];
    original.forEach((material) => materials.add(material));
    const name = original[0]?.name ?? '';
    const isSeam = name === 'Copper seams' || name === 'Optic light';
    // Depth-only faces hide rear lines without writing color or alpha into the canvas.
    const surface = new MeshBasicMaterial({
      color: '#b3472f',
      colorWrite: isSeam,
      toneMapped: false,
      polygonOffset: !isSeam,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    object.material = surface;
    // Finish the depth pass for every surface before drawing any visible strokes.
    object.renderOrder = isSeam ? 0 : -1;
    materials.add(surface);

    if (!isSeam) {
      const edges = new EdgesGeometry(object.geometry, 38);
      const geometry = new LineSegmentsGeometry().setPositions(
        new Float32Array(edges.getAttribute('position').array),
      );
      edges.dispose();
      geometries.add(geometry);
      outlines.push({
        mesh: object,
        edges: new LineSegments2(geometry, ink),
        silhouette: new Mesh(object.geometry, silhouette),
      });
    }
  });
  // Attach after traversal so the new children are never processed as source meshes.
  outlines.forEach(({ mesh, edges, silhouette }) => mesh.add(edges, silhouette));

  const dispose = () => {
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  };
  const neck = root.getObjectByName('NeckPivot');
  const head = root.getObjectByName('HeadPivot');
  if (!neck || !head) {
    dispose();
    throw new Error('Robot asset is missing its neck or head pivot.');
  }

  root.position.y = -1.45;
  return { root, neck, head, dispose };
}

export type RobotModel = Awaited<ReturnType<typeof loadRobot>>;

export function aimRobot(model: RobotModel, x: number, y: number, delta: number, reduced: boolean) {
  const amount = reduced ? 1 : 1 - Math.exp(-9 * Math.min(delta, 0.05));
  const rotate = (joint: Object3D, pitch: number, yaw: number, roll: number) => {
    joint.rotation.x += (pitch - joint.rotation.x) * amount;
    joint.rotation.y += (yaw - joint.rotation.y) * amount;
    joint.rotation.z += (roll - joint.rotation.z) * amount;
  };
  // Split the gaze across the base of the neck and the skull socket; never translate either joint.
  // Allow upward gaze (~45° combined), while keeping the chin clear of the collar on descent.
  rotate(model.neck, y * (y < 0 ? 0.14 : 0.08), x * 0.2, -x * 0.025);
  rotate(model.head, y * (y < 0 ? 0.64 : 0.25), x * 0.48, -x * 0.02);
}
