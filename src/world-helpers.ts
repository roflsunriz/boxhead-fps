import * as THREE from "three";
import type { ObstacleBox } from "./types";

export function supportsRealtimeShadows(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  const extension = gl.getExtension("WEBGL_debug_renderer_info");
  const rendererName = extension ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : "";
  return !/swiftshader|llvmpipe|software/i.test(rendererName);
}

export function boxObstacle(x: number, z: number, w: number, h: number, d: number): ObstacleBox {
  return {
    min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
    max: new THREE.Vector3(x + w / 2, h, z + d / 2),
  };
}
