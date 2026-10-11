import type { BufferGeometry } from 'three';
import { Group, SphereGeometry } from 'three';

import {
  addBolt,
  addBox,
  addCylinder,
  addSolidBox,
  addSolidCylinder,
  addTorus,
  createMaterials,
  remapGeometry,
  type SceneMaterials,
  wireframePiece,
} from './geometry';
import { addGripper } from './gripper';
import { SHOULDER_HEIGHT } from './motion';

export interface RoArmModel {
  armYaw: Group;
  forearm: Group;
  gripperDrive: Group;
  gripperFollower: Group;
  root: Group;
  toolRoll: Group;
  upperArm: Group;
  wrist: Group;
}

function addBearingHousing(
  parent: Group,
  sceneMaterials: SceneMaterials,
  radius: number,
  halfWidth: number,
) {
  addCylinder(
    parent,
    sceneMaterials,
    radius * 0.34,
    halfWidth * 2.04,
    [0, 0, 0],
    [Math.PI / 2, 0, 0],
    32,
    2,
    true,
    'dark',
  );

  for (const side of [-1, 1]) {
    const faceZ = side * halfWidth;
    addCylinder(
      parent,
      sceneMaterials,
      radius,
      0.06,
      [0, 0, faceZ],
      [Math.PI / 2, 0, 0],
      32,
      2,
      true,
      'graphite',
    );
    addTorus(
      parent,
      sceneMaterials,
      radius * 0.82,
      0.014,
      [0, 0, faceZ + side * 0.032],
      [0, 0, 0],
      'shell',
    );
  }
}

function addJointRotor(
  parent: Group,
  sceneMaterials: SceneMaterials,
  radius: number,
  halfWidth: number,
  boltCount = 6,
) {
  for (const side of [-1, 1]) {
    const faceZ = side * (halfWidth + 0.045);
    addCylinder(
      parent,
      sceneMaterials,
      radius * 0.7,
      0.034,
      [0, 0, faceZ],
      [Math.PI / 2, 0, 0],
      32,
      1,
      true,
      'dark',
    );
    addTorus(
      parent,
      sceneMaterials,
      radius * 0.61,
      0.01,
      [0, 0, faceZ + side * 0.018],
      [0, 0, 0],
      'shell',
    );
    addCylinder(
      parent,
      sceneMaterials,
      radius * 0.44,
      0.038,
      [0, 0, faceZ + side * 0.018],
      [Math.PI / 2, 0, 0],
      28,
      1,
      true,
      'shell',
    );
    addTorus(
      parent,
      sceneMaterials,
      radius * 0.28,
      0.009,
      [0, 0, faceZ + side * 0.04],
      [0, 0, 0],
      'dark',
    );
    addCylinder(
      parent,
      sceneMaterials,
      radius * 0.15,
      0.042,
      [0, 0, faceZ + side * 0.04],
      [Math.PI / 2, 0, 0],
      16,
      1,
      true,
      'dark',
    );

    for (let index = 0; index < boltCount; index += 1) {
      const angle = (index / boltCount) * Math.PI * 2;
      addBolt(
        parent,
        sceneMaterials,
        [radius * 0.42 * Math.cos(angle), radius * 0.42 * Math.sin(angle), faceZ + side * 0.042],
        radius * 0.06,
        [Math.PI / 2, 0, 0],
        'dark',
      );
    }

    addBolt(
      parent,
      sceneMaterials,
      [0, radius * 0.57, faceZ + side * 0.045],
      radius * 0.045,
      [Math.PI / 2, 0, 0],
      'accent',
    );
  }
}

function addSphericalWristSocket(parent: Group, sceneMaterials: SceneMaterials) {
  const socketGeometry = new SphereGeometry(0.175, 32, 20);
  parent.add(wireframePiece(socketGeometry, sceneMaterials, true, 'graphite'));

  addCylinder(parent, sceneMaterials, 0.135, 0.18, [0, -0.085, 0], [0, 0, 0], 28, 2, true, 'dark');
  addTorus(parent, sceneMaterials, 0.14, 0.012, [0, -0.01, 0], [Math.PI / 2, 0, 0], 'accent');
}

function addRoverDetails(parent: Group, sceneMaterials: SceneMaterials) {
  const wheelWidth = 0.31082583097312066;
  const treadRadius = 0.273;
  const wheelCenters = [-0.0855, 0, 0.0855].flatMap((x) =>
    [-0.08726, 0.08726].map(
      (z) => [7.313548964073426 * x, 0.29154271064787995, -7.313548964073426 * z] as const,
    ),
  );

  addSolidBox(
    parent,
    sceneMaterials,
    [1.74, 0.34, 1.02],
    [0, 0.55, 0],
    0.05,
    [0, 0, 0],
    'graphite',
  );
  addSolidBox(parent, sceneMaterials, [1.86, 0.13, 1.12], [0, 0.77, 0], 0.025, [0, 0, 0], 'dark');
  addSolidBox(parent, sceneMaterials, [1.5, 0.36, 0.9], [0, 0.23, 0], 0.03, [0, 0, 0], 'dark');

  wheelCenters.forEach(([x, y, z], wheelIndex) => {
    const wheel = new Group();
    wheel.position.set(x, y, z);
    parent.add(wheel);

    addSolidCylinder(
      wheel,
      sceneMaterials,
      0.268,
      wheelWidth,
      [0, 0, 0],
      [Math.PI / 2, 0, 0],
      32,
      'rubber',
    );

    for (let treadIndex = 0; treadIndex < 20; treadIndex += 1) {
      const angle = (treadIndex / 20) * Math.PI * 2;
      addSolidBox(
        wheel,
        sceneMaterials,
        [0.076, 0.032, 0.96 * wheelWidth],
        [Math.cos(angle) * treadRadius, Math.sin(angle) * treadRadius, 0],
        0.006,
        [0, 0, angle - Math.PI / 2],
        'rubber',
      );
    }

    const outerFaceZ = Math.sign(z) * (0.55 * wheelWidth);
    addSolidCylinder(
      wheel,
      sceneMaterials,
      0.155,
      0.032,
      [0, 0, outerFaceZ],
      [Math.PI / 2, 0, 0],
      32,
      'graphite',
    );
    addTorus(
      wheel,
      sceneMaterials,
      0.176,
      0.012,
      [0, 0, outerFaceZ + Math.sign(z) * 0.018],
      [0, 0, 0],
      'graphite',
    );
    addSolidCylinder(
      wheel,
      sceneMaterials,
      0.102,
      0.036,
      [0, 0, outerFaceZ + Math.sign(z) * 0.022],
      [Math.PI / 2, 0, 0],
      28,
      'dark',
    );

    for (let boltIndex = 0; boltIndex < 6; boltIndex += 1) {
      const angle = (boltIndex / 6) * Math.PI * 2 + ((wheelIndex % 2) * Math.PI) / 6;
      addBolt(
        wheel,
        sceneMaterials,
        [0.073 * Math.cos(angle), 0.073 * Math.sin(angle), outerFaceZ + Math.sign(z) * 0.044],
        0.011,
        [Math.PI / 2, 0, 0],
        'graphite',
      );
    }

    addSolidCylinder(
      wheel,
      sceneMaterials,
      0.032,
      0.042,
      [0, 0, outerFaceZ + Math.sign(z) * 0.046],
      [Math.PI / 2, 0, 0],
      20,
      'graphite',
    );
  });

  for (const side of [-1, 1]) {
    addBox(
      parent,
      sceneMaterials,
      [1.68, 0.055, 0.055],
      [0, 0.715, side * 0.68],
      0.01,
      [0, 0, 0],
      true,
      'shell',
    );

    for (const x of [-0.79, -0.31, 0.31, 0.79]) {
      addBolt(parent, sceneMaterials, [x, 0.62, side * 0.515], 0.012, [Math.PI / 2, 0, 0], 'dark');
    }
  }

  for (const z of [-0.34, 0.34]) {
    const chassisRail = new Group();
    chassisRail.position.set(0, 0.755, z);
    parent.add(chassisRail);
    addBox(
      chassisRail,
      sceneMaterials,
      [1.54, 0.075, 0.105],
      [0, 0, 0],
      0.012,
      [0, 0, 0],
      false,
      'shell',
    );
    addBox(
      chassisRail,
      sceneMaterials,
      [1.45, 0.018, 0.025],
      [0, 0.046, 0],
      0.004,
      [0, 0, 0],
      true,
      'dark',
    );
  }

  for (const x of [-0.66, -0.33, 0, 0.33, 0.66]) {
    for (const z of [-0.46, 0.46]) {
      addBolt(parent, sceneMaterials, [x, 0.83, z], 0.018, [0, 0, 0], 'shell');
    }
  }
}

function addArmDetails(parent: Group, sceneMaterials: SceneMaterials) {
  addBox(
    parent,
    sceneMaterials,
    [0.76, 0.035, 0.64],
    [0.02, 0.075, 0],
    0,
    [0, 0, 0],
    false,
    'dark',
  );
  addBox(parent, sceneMaterials, [0.62, 0.026, 0.55], [0.01, 0.175, 0]);

  for (const x of [-0.27, 0.27]) {
    for (const z of [-0.235, 0.235]) {
      addCylinder(parent, sceneMaterials, 0.024, 0.18, [x, 0.145, z], [0, 0, 0], 12, 3, true);
    }
  }

  addBox(parent, sceneMaterials, [0.38, 0.31, 0.36], [0.01, 0.42, 0], 0.035);
  addBox(parent, sceneMaterials, [0.16, 0.06, 0.12], [0.2, 0.22, 0.2]);
  addBox(parent, sceneMaterials, [0.13, 0.055, 0.1], [-0.22, 0.22, 0.18]);

  [0.625, 0.68, 0.735].forEach((y, index) => {
    addCylinder(
      parent,
      sceneMaterials,
      0.23 - index * 0.016,
      0.035,
      [0.01, y, 0],
      [0, 0, 0],
      32,
      1,
      true,
    );
  });
}

function addUpperArmDetails(parent: Group, sceneMaterials: SceneMaterials) {
  const upperArmLength = 1.75;
  for (const x of [-0.13, 0.13]) {
    for (const z of [-0.17, 0.17]) {
      addBox(
        parent,
        sceneMaterials,
        [0.035, 0.78 * upperArmLength, 0.026],
        [x, 0.51 * upperArmLength, z],
      );
    }
  }

  for (const fraction of [0.18, 0.5, 0.82]) {
    for (const side of [-1, 1]) {
      addCylinder(
        parent,
        sceneMaterials,
        0.031,
        0.034,
        [0.13 * side, upperArmLength * fraction, 0.2],
        [Math.PI / 2, 0, 0],
        18,
        2,
        true,
      );
      addBolt(parent, sceneMaterials, [0.13 * side, upperArmLength * fraction, 0.228], 0.026);
    }
  }
}

function addShoulderJoint(parent: Group, sceneMaterials: SceneMaterials) {
  addBox(parent, sceneMaterials, [0.44, 0.12, 0.56], [0, -0.2, 0], 0.025, [0, 0, 0], false, 'dark');

  for (const z of [-0.205, 0.205]) {
    addBox(parent, sceneMaterials, [0.36, 0.34, 0.085], [0, -0.035, z], 0.035);
    addBolt(parent, sceneMaterials, [0, -0.17, z + Math.sign(z) * 0.052], 0.026);
  }

  addBearingHousing(parent, sceneMaterials, 0.19, 0.255);
}

function addElbowJoint(parent: Group, sceneMaterials: SceneMaterials) {
  addBox(parent, sceneMaterials, [0.3, 0.11, 0.4], [0, -0.105, 0], 0.025, [0, 0, 0], false, 'dark');

  for (const z of [-0.165, 0.165]) {
    addBox(parent, sceneMaterials, [0.32, 0.31, 0.07], [0, 0.055, z], 0.035);
    addBolt(parent, sceneMaterials, [0, -0.065, z + Math.sign(z) * 0.045], 0.023);
  }

  addBearingHousing(parent, sceneMaterials, 0.175, 0.205);
}

function addWristDetails(parent: Group, sceneMaterials: SceneMaterials) {
  addCylinder(parent, sceneMaterials, 0.1, 0.3, [0, 0.14, 0], [0, 0, 0], 28, 2, true, 'dark');
  addCylinder(
    parent,
    sceneMaterials,
    0.145,
    0.065,
    [0, 0.285, 0],
    [0, 0, 0],
    28,
    2,
    true,
    'graphite',
  );
  addTorus(parent, sceneMaterials, 0.105, 0.012, [0, 0.322, 0], [Math.PI / 2, 0, 0], 'accent');
}

export function buildRoArmModel(armSource: BufferGeometry[]): RoArmModel {
  const sceneMaterials = createMaterials();
  const scale = 7.313548964073426;
  const upperArmLength = 1.75;
  const forearmLength = 1.52;
  const armScale = (scale + upperArmLength / 0.236815132922094 + forearmLength / 0.21599) / 3;
  const [armBase, armUpper, armForearm] = armSource;

  if (!armBase || !armUpper || !armForearm) {
    throw new Error('The RoArm model is incomplete.');
  }

  const armGeometry = {
    base: remapGeometry(armBase, (x, y, z) => [scale * x, scale * z, scale * y], 0.085, 2),
    forearm: remapGeometry(
      armForearm,
      (x, y, z) => [z * armScale, -y * (forearmLength / 0.21599), x * armScale],
      0.07,
      1,
      (_x, y) => -y <= 0.21599,
    ),
    upper: remapGeometry(
      armUpper,
      (x, y, z) => [z * armScale, x * (upperArmLength / 0.236815132922094), y * armScale],
      0.085,
      2,
    ),
  };

  const root = new Group();
  root.position.set(1.7, -1.45, 0);
  root.scale.setScalar(0.92);

  const rover = new Group();
  addRoverDetails(rover, sceneMaterials);
  root.add(rover);

  const armYaw = new Group();
  armYaw.add(wireframePiece(armGeometry.base, sceneMaterials, true, 'dark'));
  addArmDetails(armYaw, sceneMaterials);
  root.add(armYaw);

  const shoulderBase = new Group();
  shoulderBase.position.set(0, SHOULDER_HEIGHT, 0);
  addShoulderJoint(shoulderBase, sceneMaterials);
  armYaw.add(shoulderBase);

  const upperArm = new Group();
  upperArm.position.set(0, SHOULDER_HEIGHT, 0);
  upperArm.rotation.z = -0.58;
  upperArm.add(wireframePiece(armGeometry.upper, sceneMaterials));
  addJointRotor(upperArm, sceneMaterials, 0.19, 0.255);
  addUpperArmDetails(upperArm, sceneMaterials);
  armYaw.add(upperArm);

  const elbow = new Group();
  elbow.position.set(0, upperArmLength, 0);
  addElbowJoint(elbow, sceneMaterials);
  upperArm.add(elbow);

  const forearm = new Group();
  forearm.rotation.z = 1.3;
  forearm.add(wireframePiece(armGeometry.forearm, sceneMaterials));
  addJointRotor(forearm, sceneMaterials, 0.175, 0.205);
  elbow.add(forearm);

  const wristBearing = new Group();
  wristBearing.position.set(0, forearmLength, 0);
  addSphericalWristSocket(wristBearing, sceneMaterials);
  forearm.add(wristBearing);

  const wrist = new Group();
  wrist.position.set(0, forearmLength, 0);
  wrist.rotation.z = -0.58;
  addWristDetails(wrist, sceneMaterials);
  const toolRoll = new Group();
  const { gripperDrive, gripperFollower } = addGripper(toolRoll, sceneMaterials);
  wrist.add(toolRoll);
  forearm.add(wrist);

  return {
    armYaw,
    forearm,
    gripperDrive,
    gripperFollower,
    root,
    toolRoll,
    upperArm,
    wrist,
  };
}
