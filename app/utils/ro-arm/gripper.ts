import type { BufferGeometry } from 'three';
import { Group } from 'three';

import {
  addBolt,
  addBox,
  addCylinder,
  addTorus,
  addTube,
  createExtrudedPlate,
  type SceneMaterials,
  wireframePiece,
} from './geometry';
import { GRIPPER_OPEN_ANGLE } from './motion';

const GRIPPER_GEAR_PITCH_RADIUS = 0.115;

function addGear(parent: Group, sceneMaterials: SceneMaterials, toothPhase = 0) {
  const radius = GRIPPER_GEAR_PITCH_RADIUS;
  const thickness = 0.034;
  const toothRadius = radius + 0.018;
  const toothCount = 18;

  for (const z of [-0.083, 0.083]) {
    addCylinder(
      parent,
      sceneMaterials,
      radius,
      thickness,
      [0, 0, z],
      [Math.PI / 2, 0, 0],
      32,
      2,
      true,
    );
    for (let index = 0; index < toothCount; index += 1) {
      const angle = toothPhase + (index / toothCount) * Math.PI * 2;
      addBox(
        parent,
        sceneMaterials,
        [0.034, 0.019, 1.03 * thickness],
        [Math.cos(angle) * toothRadius, Math.sin(angle) * toothRadius, z],
        0,
        [0, 0, angle],
      );
    }
  }

  addCylinder(parent, sceneMaterials, 0.043, 0.205, [0, 0, 0], [Math.PI / 2, 0, 0], 20, 2, true);
  addBolt(parent, sceneMaterials, [0, 0, 0.12], 0.025);
}

function addFinger(
  parent: Group,
  sceneMaterials: SceneMaterials,
  plateGeometry: BufferGeometry,
  side: -1 | 1,
) {
  const pivot = new Group();
  pivot.position.set(GRIPPER_GEAR_PITCH_RADIUS * side, 0.42, 0);
  pivot.rotation.z = -GRIPPER_OPEN_ANGLE * side;
  parent.add(pivot);

  const mirrored = new Group();
  mirrored.scale.x = side;
  pivot.add(mirrored);
  addGear(mirrored, sceneMaterials, side === -1 ? Math.PI / 18 : 0);

  for (const z of [-0.083, 0.083]) {
    const plate = wireframePiece(plateGeometry, sceneMaterials, true);
    plate.position.z = z;
    mirrored.add(plate);
  }

  for (const [x, y] of [
    [0.015, 0.13],
    [0.065, 0.39],
    [0.025, 0.625],
  ] as const) {
    addCylinder(
      mirrored,
      sceneMaterials,
      0.019,
      0.205,
      [x, y, 0],
      [Math.PI / 2, 0, 0],
      14,
      2,
      true,
    );
    addBolt(mirrored, sceneMaterials, [x, y, 0.12], 0.021);
    addBolt(mirrored, sceneMaterials, [x, y, -0.12], 0.021, [Math.PI / 2, 0, Math.PI]);
  }

  addBox(mirrored, sceneMaterials, [0.205, 0.16, 0.205], [0.025, 0.645, 0], 0.014);
  addBox(mirrored, sceneMaterials, [0.045, 0.145, 0.235], [-0.086, 0.648, 0], 0.008);
  return pivot;
}

function addGripperMount(
  parent: Group,
  sceneMaterials: SceneMaterials,
  mountGeometry: BufferGeometry,
) {
  const mount = wireframePiece(mountGeometry, sceneMaterials, true);
  mount.position.set(0, 0.36, -0.14);
  parent.add(mount);
  addBox(parent, sceneMaterials, [0.68, 0.07, 0.24], [0, 0.225, -0.035], 0.012);
  addBox(parent, sceneMaterials, [0.61, 0.075, 0.255], [0, 0.535, -0.025], 0.012);

  for (const side of [-1, 1]) {
    const rail = new Group();
    rail.position.set(0.315 * side, 0.37, -0.025);
    parent.add(rail);
    addBox(rail, sceneMaterials, [0.07, 0.31, 0.255], [0, 0, 0], 0.014);
    for (const y of [0.275, 0.37, 0.465]) {
      addBolt(rail, sceneMaterials, [0, y - 0.37, 0.145], 0.019);
    }
  }

  addBox(parent, sceneMaterials, [0.37, 0.345, 0.26], [0, 0.36, 0.115], 0.026);
  addBox(parent, sceneMaterials, [0.4, 0.052, 0.285], [0, 0.19, 0.115], 0.01);
  addBox(parent, sceneMaterials, [0.4, 0.052, 0.285], [0, 0.53, 0.115], 0.01);
  addBox(parent, sceneMaterials, [0.31, 0.055, 0.275], [0, 0.565, 0.115], 0.012);

  for (const side of [-1, 1]) {
    for (const y of [0.205, 0.515]) {
      addBolt(parent, sceneMaterials, [0.155 * side, y, 0.27], 0.019);
    }
  }

  addBox(
    parent,
    sceneMaterials,
    [0.17, 0.095, 0.075],
    [-0.19, 0.49, 0.24],
    0.012,
    [0, 0, 0],
    true,
    'dark',
  );
  addBolt(parent, sceneMaterials, [-0.19, 0.49, 0.285], 0.018);

  [-0.026, 0, 0.026].forEach((offset) => {
    addTube(
      parent,
      sceneMaterials,
      [
        [-0.18, 0.14, 0.035 + offset],
        [-0.265, 0.21, 0.085 + offset],
        [-0.295, 0.33, 0.145 + offset],
        [-0.265, 0.43, 0.205 + offset],
        [-0.205, 0.475, 0.24 + offset],
      ],
      0.008,
    );
  });

  addBox(
    parent,
    sceneMaterials,
    [0.095, 0.035, 0.085],
    [-0.29, 0.315, 0.145],
    0.008,
    [0, 0, 0],
    true,
    'dark',
  );
  addBox(
    parent,
    sceneMaterials,
    [0.09, 0.035, 0.085],
    [-0.26, 0.42, 0.205],
    0.008,
    [0, 0, 0],
    true,
    'dark',
  );
}

export function addGripper(parent: Group, sceneMaterials: SceneMaterials) {
  addBox(parent, sceneMaterials, [0.62, 0.055, 0.34], [0, 0.3, 0], 0, [0, 0, 0], false, 'dark');

  const fingerPlate = createExtrudedPlate(
    [
      [-0.11, -0.06],
      [0.12, -0.06],
      [0.17, 0.08],
      [0.18, 0.28],
      [0.15, 0.43],
      [0.07, 0.58],
      [-0.05, 0.58],
      [-0.095, 0.47],
      [-0.035, 0.34],
      [-0.025, 0.17],
      [-0.12, 0.09],
    ],
    0.034,
    [
      [
        [-0.04, 0.16],
        [0.055, 0.12],
        [0.105, 0.23],
        [0.09, 0.35],
        [0.035, 0.46],
        [-0.018, 0.43],
        [0.024, 0.31],
        [0.014, 0.21],
      ],
    ],
    [
      [0.055, 0.505, 0.021],
      [-0.058, 0.075, 0.019],
    ],
  );
  const mountPlate = createExtrudedPlate(
    [
      [-0.36, -0.15],
      [0.36, -0.15],
      [0.34, 0.105],
      [0.25, 0.19],
      [0.11, 0.16],
      [-0.11, 0.16],
      [-0.25, 0.19],
      [-0.34, 0.105],
    ],
    0.055,
    [],
    [
      [-0.27, -0.08, 0.023],
      [-0.18, -0.075, 0.015],
      [-0.09, -0.075, 0.026],
      [0, -0.075, 0.016],
      [0.09, -0.075, 0.026],
      [0.18, -0.075, 0.015],
      [0.27, -0.08, 0.023],
      [-0.245, 0.035, 0.016],
      [-0.135, 0.045, 0.028],
      [0, 0.04, 0.02],
      [0.135, 0.045, 0.028],
      [0.245, 0.035, 0.016],
      [-0.18, 0.125, 0.016],
      [0.18, 0.125, 0.016],
    ],
    0.004,
  );

  addGripperMount(parent, sceneMaterials, mountPlate);
  const gripperFollower = addFinger(parent, sceneMaterials, fingerPlate, -1);
  const gripperDrive = addFinger(parent, sceneMaterials, fingerPlate, 1);

  // A fixed rear actuator drives only the right-hand gear. The left-hand finger is constrained by
  // the equal-size meshed gear pair rather than being animated as a second independent mechanism.
  addCylinder(
    parent,
    sceneMaterials,
    0.092,
    0.095,
    [GRIPPER_GEAR_PITCH_RADIUS, 0.42, -0.2],
    [Math.PI / 2, 0, 0],
    28,
    2,
    true,
    'dark',
  );
  addTorus(
    parent,
    sceneMaterials,
    0.074,
    0.009,
    [GRIPPER_GEAR_PITCH_RADIUS, 0.42, -0.25],
    [0, 0, 0],
    'shell',
  );

  return { gripperDrive, gripperFollower };
}
