import {
  AmbientLight,
  Color,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  SpotLight,
  Vector2,
} from 'three';

export function createLightRig() {
  const rig = new Group();
  const key = new SpotLight('#f2f5ee', 82, 0, 0.36, 0.72, 2);
  key.position.set(-3.4, 6.5, 6);

  const fill = new SpotLight('#98a493', 44, 0, 0.48, 0.88, 2);
  fill.position.set(5.8, 3.8, 2.8);

  const rim = new SpotLight('#dbe4d7', 58, 0, 0.42, 0.74, 2);
  rim.position.set(2.8, 2.4, -5);

  const accent = new PointLight('#cbff36', 7, 8, 2);
  accent.position.set(-3.2, 0.8, 1.5);

  const roverFill = new PointLight('#d7ddd3', 18, 7, 2);
  roverFill.position.set(2.5, 0.55, 4.6);

  rig.add(
    new AmbientLight('#dfe6dc', 0.42),
    new HemisphereLight('#cbd3c6', '#020302', 0.72),
    key,
    fill,
    rim,
    accent,
    roverFill,
  );
  return rig;
}

export function createGroundGrid() {
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    depthWrite: true,
    side: DoubleSide,
    transparent: true,
    uniforms: {
      uCheckerA: { value: new Color('#050605') },
      uCheckerB: { value: new Color('#171a16') },
      uCheckerSize: { value: 1 },
      uExtent: { value: 46 },
      uFadeDistance: { value: 34 },
      uLightColor: { value: new Color('#aeb6a6') },
      uLightIntensity: { value: 0.18 },
      uLightPosition: { value: new Vector2(1.7, 0.7) },
      uLightRadius: { value: 4.2 },
      uMajorGridSize: { value: 2.5 },
      uMajorLineColor: { value: new Color('#858b80') },
      uMinorGridSize: { value: 0.5 },
      uMinorLineColor: { value: new Color('#555a52') },
      uOpacity: { value: 0.86 },
      uPlaneY: { value: -1.462 },
      uRobotPosition: { value: new Vector2(1.7, 0) },
      uRobotScale: { value: 0.92 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      uniform float uExtent;
      uniform float uPlaneY;

      void main() {
        vec3 world = position.xzy * uExtent;
        world.xz += cameraPosition.xz;
        world.y = uPlaneY;
        vWorldPosition = world;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;

      uniform vec3 uCheckerA;
      uniform vec3 uCheckerB;
      uniform vec3 uMinorLineColor;
      uniform vec3 uMajorLineColor;
      uniform vec3 uLightColor;
      uniform vec2 uLightPosition;
      uniform float uMinorGridSize;
      uniform float uMajorGridSize;
      uniform float uCheckerSize;
      uniform float uFadeDistance;
      uniform float uOpacity;
      uniform float uLightIntensity;
      uniform float uLightRadius;
      uniform vec2 uRobotPosition;
      uniform float uRobotScale;

      float getGrid(float size, float width) {
        vec2 cell = vWorldPosition.xz / size;
        vec2 grid = abs(fract(cell - 0.5) - 0.5) / max(fwidth(cell), vec2(0.0001)) * width;
        float lineX = 1.0 - min(grid.x, 1.0);
        float lineY = 1.0 - min(grid.y, 1.0);
        return max(lineX, lineY) * (1.0 - min(lineX, lineY) * 0.5);
      }

      float contactPatch(vec2 point, vec2 center) {
        vec2 distanceFromWheel = (point - center) / vec2(0.29, 0.18);
        return 1.0 - smoothstep(0.28, 1.0, length(distanceFromWheel));
      }

      void main() {
        vec2 checkerCell = floor(vWorldPosition.xz / uCheckerSize);
        float checker = mod(checkerCell.x + checkerCell.y, 2.0);
        vec3 color = mix(uCheckerA, uCheckerB, checker);

        vec2 roverLocal = (vWorldPosition.xz - uRobotPosition) / max(uRobotScale, 0.001);
        float footprint = 1.0 - smoothstep(
          0.7,
          1.0,
          length(vec2(roverLocal.x / 0.98, roverLocal.y / 0.86))
        );
        float roverBackdrop =
          (1.0 - smoothstep(0.92, 1.3, abs(roverLocal.x))) *
          (1.0 - smoothstep(1.8, 2.7, abs(roverLocal.y + 1.1)));
        float wheelContact = 0.0;
        wheelContact = max(wheelContact, contactPatch(roverLocal, vec2(-0.625, -0.638)));
        wheelContact = max(wheelContact, contactPatch(roverLocal, vec2(0.0, -0.638)));
        wheelContact = max(wheelContact, contactPatch(roverLocal, vec2(0.625, -0.638)));
        wheelContact = max(wheelContact, contactPatch(roverLocal, vec2(-0.625, 0.638)));
        wheelContact = max(wheelContact, contactPatch(roverLocal, vec2(0.0, 0.638)));
        wheelContact = max(wheelContact, contactPatch(roverLocal, vec2(0.625, 0.638)));

        float minorGrid = getGrid(uMinorGridSize, 1.0);
        float majorGrid = getGrid(uMajorGridSize, 0.75);
        float gridVisibility = mix(1.0, 0.14, footprint) * mix(1.0, 0.08, roverBackdrop);
        color = mix(color, uMinorLineColor, minorGrid * 0.34 * gridVisibility);
        color = mix(color, uMajorLineColor, majorGrid * 0.76 * gridVisibility);
        color *= 1.0 - roverBackdrop * 0.1;
        color *= 1.0 - footprint * 0.18;
        color = mix(color, vec3(0.0), wheelContact * 0.68);

        float lightDistance = distance(vWorldPosition.xz, uLightPosition);
        float lightPool = exp(-pow(lightDistance / uLightRadius, 2.0)) * uLightIntensity;
        color += uLightColor * lightPool;

        float cameraDistance = distance(cameraPosition.xz, vWorldPosition.xz);
        float distanceFade = pow(1.0 - min(cameraDistance / uFadeDistance, 1.0), 2.6);
        float horizonAngle = abs(normalize(vWorldPosition - cameraPosition).y);
        float horizonFade = smoothstep(0.015, 0.3, horizonAngle);
        float alpha = distanceFade * horizonFade * uOpacity;

        if (alpha <= 0.002) discard;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}
