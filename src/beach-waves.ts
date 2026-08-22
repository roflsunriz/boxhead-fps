import * as THREE from "three";

export interface BeachWaveSummary {
  elapsed: number;
  heightRange: number;
  sampleY: number;
  leadBreakerZ: number;
  vertexCount: number;
}

export interface BeachWaveSystem {
  group: THREE.Group;
  update(dt: number): void;
  debugSummary(): BeachWaveSummary;
}

interface WaveSpec {
  dirX: number;
  dirZ: number;
  amplitude: number;
  wavelength: number;
  speed: number;
  steepness: number;
}

const WAVE_SPECS: readonly WaveSpec[] = [
  { dirX: 0, dirZ: 1, amplitude: 0.46, wavelength: 18, speed: 2.4, steepness: 0.65 },
  { dirX: 0.45, dirZ: 0.89, amplitude: 0.24, wavelength: 11, speed: 1.8, steepness: 0.45 },
  { dirX: -0.78, dirZ: 0.62, amplitude: 0.12, wavelength: 6.5, speed: 1.35, steepness: 0.25 },
];

export function createBeachWaveSystem(): BeachWaveSystem {
  const group = new THREE.Group();
  const waterUnderlay = new THREE.Mesh(
    new THREE.PlaneGeometry(430, 190),
    new THREE.MeshBasicMaterial({ color: 0x0a465b, side: THREE.DoubleSide })
  );
  waterUnderlay.rotation.x = -Math.PI / 2;
  waterUnderlay.position.set(0, 0.06, -111);
  group.add(waterUnderlay);

  const oceanGeo = new THREE.PlaneGeometry(430, 190, 96, 40);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x187c9e,
    transparent: true,
    opacity: 0.94,
    roughness: 0.18,
    metalness: 0.18,
    emissive: 0x062b42,
    emissiveIntensity: 0.48,
    fog: false,
    side: THREE.DoubleSide,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.position.set(0, 0.3, -111);
  ocean.receiveShadow = true;
  group.add(ocean);
  const position = oceanGeo.getAttribute("position") as THREE.BufferAttribute;
  const oceanBase = Float32Array.from(position.array);

  const wetSand = new THREE.Mesh(
    new THREE.PlaneGeometry(430, 8),
    new THREE.MeshStandardMaterial({ color: 0xb3945c, roughness: 0.85 })
  );
  wetSand.rotation.x = -Math.PI / 2;
  wetSand.position.set(0, 0.02, -11.5);
  group.add(wetSand);

  const shoreFoamMat = new THREE.MeshBasicMaterial({
    color: 0xf5fbfa,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shoreFoam = new THREE.Mesh(new THREE.PlaneGeometry(430, 3), shoreFoamMat);
  shoreFoam.rotation.x = -Math.PI / 2;
  shoreFoam.position.set(0, 0.85, -15.4);
  group.add(shoreFoam);

  const breakers: Array<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>> = [];
  for (let band = 0; band < 4; band++) {
    const geo = new THREE.PlaneGeometry(430, 1.1, 96, 1);
    geo.rotateX(-Math.PI / 2);
    const attr = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      const x = attr.getX(i);
      attr.setZ(i, attr.getZ(i) + Math.sin(x * 0.07 + band * 1.9) * 0.55 + Math.sin(x * 0.17) * 0.18);
    }
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf5ffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const breaker = new THREE.Mesh(geo, mat);
    breaker.position.y = 0.5;
    group.add(breaker);
    breakers.push(breaker);
  }

  let elapsed = 0;
  let normalFrame = 0;
  let minHeight = 0;
  let maxHeight = 0;
  let sampleY = 0;

  function updateOcean(): void {
    const arr = position.array as Float32Array;
    minHeight = Infinity;
    maxHeight = -Infinity;
    for (let i = 0; i < arr.length; i += 3) {
      const baseX = oceanBase[i];
      const baseZ = oceanBase[i + 2];
      const shore = THREE.MathUtils.smoothstep(baseZ, 48, 95);
      let x = baseX;
      let z = baseZ;
      let y = 0;
      for (const [waveIndex, wave] of WAVE_SPECS.entries()) {
        const k = (Math.PI * 2) / wave.wavelength;
        const phase = k * (wave.dirX * baseX + wave.dirZ * baseZ) - wave.speed * elapsed;
        const amplitude = wave.amplitude * (waveIndex === 0 ? 1 + shore * 0.45 : 1);
        const horizontal = wave.steepness * amplitude * Math.cos(phase);
        x += wave.dirX * horizontal;
        z += wave.dirZ * horizontal;
        y += amplitude * Math.sin(phase);
        if (waveIndex === 0) {
          const crest = Math.max(0, Math.sin(phase));
          y += crest * crest * shore * 0.3;
        }
      }
      arr[i] = x;
      arr[i + 1] = y;
      arr[i + 2] = z;
      minHeight = Math.min(minHeight, y);
      maxHeight = Math.max(maxHeight, y);
    }
    sampleY = arr[Math.floor(position.count / 2) * 3 + 1];
    position.needsUpdate = true;
    if (normalFrame++ % 2 === 0) oceanGeo.computeVertexNormals();
  }

  function updateFoam(): void {
    shoreFoam.position.z = -15.4 + Math.sin(elapsed * 0.85) * 1.25;
    shoreFoamMat.opacity = 0.42 + Math.sin(elapsed * 0.85 + 1.2) * 0.18;
    breakers.forEach((breaker, i) => {
      const progress = (elapsed * 0.13 + i / breakers.length) % 1;
      const crest = Math.sin(progress * Math.PI);
      breaker.position.z = -31 + progress * 15.6;
      breaker.position.y = 1.05 + crest * 0.65;
      breaker.scale.z = 0.7 + progress * 1.4;
      breaker.material.opacity = Math.pow(crest, 1.4) * 0.78;
    });
  }

  function update(dt: number): void {
    elapsed += dt;
    updateOcean();
    updateFoam();
  }

  update(0);
  return {
    group,
    update,
    debugSummary() {
      return {
        elapsed,
        heightRange: maxHeight - minHeight,
        sampleY,
        leadBreakerZ: breakers[0].position.z,
        vertexCount: position.count,
      };
    },
  };
}
