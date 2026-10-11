import type { Material, Object3D } from 'three';
import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  WireframeGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const geometries = new Set<BufferGeometry>();
const materials = new Set<Material>();

export type SurfaceFinish = 'accent' | 'dark' | 'graphite' | 'rubber' | 'shell';

export function createMaterials() {
  const result = {
    accent: new MeshStandardMaterial({
      color: '#b8e649',
      emissive: '#26350b',
      emissiveIntensity: 0.28,
      metalness: 0.28,
      roughness: 0.32,
    }),
    dark: new MeshStandardMaterial({
      color: '#454d45',
      metalness: 0.52,
      roughness: 0.38,
    }),
    ghost: new LineBasicMaterial({
      color: '#cbd4c8',
      depthTest: false,
      depthWrite: false,
      opacity: 0.008,
      transparent: true,
      toneMapped: false,
    }),
    graphite: new MeshStandardMaterial({
      color: '#707870',
      metalness: 0.5,
      roughness: 0.42,
    }),
    rubber: new MeshStandardMaterial({
      color: '#252b25',
      metalness: 0.08,
      roughness: 0.72,
    }),
    shell: new MeshStandardMaterial({
      color: '#c9cec8',
      metalness: 0.46,
      roughness: 0.34,
    }),
    silhouette: new LineBasicMaterial({
      color: '#e6ece5',
      depthTest: true,
      depthWrite: false,
      opacity: 0.18,
      transparent: true,
      toneMapped: false,
    }),
    topology: new LineBasicMaterial({
      color: '#c8d0c6',
      depthTest: true,
      depthWrite: false,
      opacity: 0.032,
      transparent: true,
      toneMapped: false,
    }),
    precision: new LineBasicMaterial({
      color: '#e2e9df',
      depthTest: true,
      depthWrite: false,
      opacity: 0.055,
      transparent: true,
      toneMapped: false,
    }),
  };

  Object.values(result).forEach((material) => materials.add(material));
  return result;
}

export type SceneMaterials = ReturnType<typeof createMaterials>;

export function disposeSceneResources() {
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  geometries.clear();
  materials.clear();
}

export function remapGeometry(
  source: BufferGeometry,
  map: (x: number, y: number, z: number) => [number, number, number],
  maximumEdgeLength: number,
  maximumIterations: number,
  filter?: (x: number, y: number, z: number) => boolean,
) {
  const sourceGeometry = source.index ? source.toNonIndexed() : source;
  const sourcePositions = sourceGeometry.getAttribute('position');
  const mappedPositions: number[] = [];

  for (let index = 0; index < sourcePositions.count; index += 3) {
    const centerX =
      (sourcePositions.getX(index) +
        sourcePositions.getX(index + 1) +
        sourcePositions.getX(index + 2)) /
      3;
    const centerY =
      (sourcePositions.getY(index) +
        sourcePositions.getY(index + 1) +
        sourcePositions.getY(index + 2)) /
      3;
    const centerZ =
      (sourcePositions.getZ(index) +
        sourcePositions.getZ(index + 1) +
        sourcePositions.getZ(index + 2)) /
      3;

    if (filter && !filter(centerX, centerY, centerZ)) continue;

    for (let vertex = 0; vertex < 3; vertex += 1) {
      const positionIndex = index + vertex;
      mappedPositions.push(
        ...map(
          sourcePositions.getX(positionIndex),
          sourcePositions.getY(positionIndex),
          sourcePositions.getZ(positionIndex),
        ),
      );
    }
  }

  let geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(mappedPositions, 3));

  const maximumEdgeLengthSquared = maximumEdgeLength * maximumEdgeLength;
  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const positions = geometry.getAttribute('position');
    const subdividedPositions: number[] = [];
    let changed = false;

    for (let index = 0; index < positions.count; index += 3) {
      const a = new Vector3().fromBufferAttribute(positions, index);
      const b = new Vector3().fromBufferAttribute(positions, index + 1);
      const c = new Vector3().fromBufferAttribute(positions, index + 2);
      const ab = a.distanceToSquared(b);
      const bc = b.distanceToSquared(c);
      const ac = a.distanceToSquared(c);

      const pushTriangle = (first: Vector3, second: Vector3, third: Vector3) => {
        subdividedPositions.push(
          first.x,
          first.y,
          first.z,
          second.x,
          second.y,
          second.z,
          third.x,
          third.y,
          third.z,
        );
      };

      if (
        ab > maximumEdgeLengthSquared ||
        bc > maximumEdgeLengthSquared ||
        ac > maximumEdgeLengthSquared
      ) {
        changed = true;
        if (ab >= bc && ab >= ac) {
          const midpoint = new Vector3().lerpVectors(a, b, 0.5);
          pushTriangle(a, midpoint, c);
          pushTriangle(midpoint, b, c);
        } else if (bc >= ab && bc >= ac) {
          const midpoint = new Vector3().lerpVectors(b, c, 0.5);
          pushTriangle(a, b, midpoint);
          pushTriangle(midpoint, c, a);
        } else {
          const midpoint = new Vector3().lerpVectors(a, c, 0.5);
          pushTriangle(a, b, midpoint);
          pushTriangle(midpoint, b, c);
        }
      } else {
        pushTriangle(a, b, c);
      }
    }

    if (!changed) break;
    geometry.dispose();
    geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(subdividedPositions, 3));
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometries.add(geometry);
  return geometry;
}

export function wireframePiece(
  geometry: BufferGeometry,
  sceneMaterials: SceneMaterials,
  precision = false,
  finish: SurfaceFinish = 'shell',
) {
  geometries.add(geometry);
  const topology = new WireframeGeometry(geometry);
  const silhouette = new EdgesGeometry(geometry, 24);
  geometries.add(topology);
  geometries.add(silhouette);

  const group = new Group();
  const body = new Mesh(geometry, sceneMaterials[finish]);
  const ghost = new LineSegments(topology, sceneMaterials.ghost);
  const detail = new LineSegments(
    topology,
    precision ? sceneMaterials.precision : sceneMaterials.topology,
  );
  const outline = new LineSegments(silhouette, sceneMaterials.silhouette);
  body.renderOrder = 0;
  body.castShadow = true;
  body.receiveShadow = true;
  ghost.renderOrder = 1;
  detail.renderOrder = 2;
  outline.renderOrder = 3;
  group.add(body);
  if (finish === 'graphite') group.add(detail);
  else if (finish !== 'rubber') group.add(ghost, detail);
  group.add(outline);
  return group;
}

export function addBox(
  parent: Object3D,
  sceneMaterials: SceneMaterials,
  size: [number, number, number],
  position: [number, number, number],
  radius = 0,
  rotation: [number, number, number] = [0, 0, 0],
  precision = false,
  finish: SurfaceFinish = 'shell',
) {
  const geometry = radius
    ? new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius)
    : new BoxGeometry(...size, 3, 3, 3);
  const piece = wireframePiece(geometry, sceneMaterials, precision, finish);
  piece.position.set(...position);
  piece.rotation.set(...rotation);
  parent.add(piece);
  return piece;
}

export function addSolidBox(
  parent: Object3D,
  sceneMaterials: SceneMaterials,
  size: [number, number, number],
  position: [number, number, number],
  radius = 0,
  rotation: [number, number, number] = [0, 0, 0],
  finish: SurfaceFinish = 'shell',
) {
  const geometry = radius
    ? new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius)
    : new BoxGeometry(...size, 1, 1, 1);
  geometries.add(geometry);
  const piece = new Mesh(geometry, sceneMaterials[finish]);
  piece.position.set(...position);
  piece.rotation.set(...rotation);
  piece.castShadow = true;
  piece.receiveShadow = true;
  parent.add(piece);
  return piece;
}

export function addCylinder(
  parent: Object3D,
  sceneMaterials: SceneMaterials,
  radius: number,
  length: number,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  radialSegments = 24,
  heightSegments = 4,
  precision = false,
  finish: SurfaceFinish = 'shell',
) {
  const geometry = new CylinderGeometry(radius, radius, length, radialSegments, heightSegments);
  const piece = wireframePiece(geometry, sceneMaterials, precision, finish);
  piece.position.set(...position);
  piece.rotation.set(...rotation);
  parent.add(piece);
  return piece;
}

export function addSolidCylinder(
  parent: Object3D,
  sceneMaterials: SceneMaterials,
  radius: number,
  length: number,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  radialSegments = 32,
  finish: SurfaceFinish = 'shell',
) {
  const geometry = new CylinderGeometry(radius, radius, length, radialSegments, 1);
  geometries.add(geometry);
  const piece = new Mesh(geometry, sceneMaterials[finish]);
  piece.position.set(...position);
  piece.rotation.set(...rotation);
  piece.castShadow = true;
  piece.receiveShadow = true;
  parent.add(piece);
  return piece;
}

export function addTorus(
  parent: Object3D,
  sceneMaterials: SceneMaterials,
  radius: number,
  tube: number,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  finish: SurfaceFinish = 'dark',
) {
  const geometry = new TorusGeometry(radius, tube, 10, 32);
  const piece = wireframePiece(geometry, sceneMaterials, true, finish);
  piece.position.set(...position);
  piece.rotation.set(...rotation);
  parent.add(piece);
  return piece;
}

export function addBolt(
  parent: Object3D,
  sceneMaterials: SceneMaterials,
  position: [number, number, number],
  radius = 0.034,
  rotation: [number, number, number] = [Math.PI / 2, 0, 0],
  finish: SurfaceFinish = 'dark',
) {
  addCylinder(parent, sceneMaterials, radius, 0.026, position, rotation, 6, 1, true, finish);
}

export function createExtrudedPlate(
  outline: [number, number][],
  thickness: number,
  polygonHoles: [number, number][][] = [],
  circularHoles: [number, number, number][] = [],
  bevel = 0.006,
) {
  const shape = new Shape();
  outline.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  polygonHoles.forEach((holePoints) => {
    const hole = new Path();
    [...holePoints].reverse().forEach(([x, y], index) => {
      if (index === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    });
    hole.closePath();
    shape.holes.push(hole);
  });

  circularHoles.forEach(([x, y, radius]) => {
    const hole = new Path();
    hole.absarc(x, y, radius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  });

  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 16,
    depth: thickness,
    steps: 1,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.computeVertexNormals();
  return geometry;
}

export function addTube(
  parent: Object3D,
  sceneMaterials: SceneMaterials,
  points: [number, number, number][],
  radius: number,
  finish: SurfaceFinish = 'dark',
) {
  const curve = new CatmullRomCurve3(points.map((point) => new Vector3(...point)));
  const geometry = new TubeGeometry(curve, 24, radius, 7, false);
  parent.add(wireframePiece(geometry, sceneMaterials, true, finish));
}
