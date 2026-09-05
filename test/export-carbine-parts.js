import { writeFile } from "node:fs/promises";
import { evaluate, outputDirectory, withReviewPage } from "./capture-model-review.js";

await withReviewPage(async ({ cdp, navigate, errors, browserVersion }) => {
  await navigate("view=reference");
  const manifest = await evaluate(
    cdp,
    `(() => {
    const model = window.__carbineModel;
    const runtime = model?.userData.sculptRuntime;
    if (!runtime?.nodes) throw new Error('Carbine sculpt runtime missing');
    const countGeometry = root => {
      let meshes = 0, triangles = 0, unnamedMeshes = 0;
      root.traverse(object => {
        if (!object.isMesh) return;
        meshes++;
        if (!object.name) unnamedMeshes++;
        triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3
          * (object.isInstancedMesh ? object.count : 1);
      });
      return { meshes, triangles, unnamedMeshes };
    };
    const total = countGeometry(model);
    if (!total.meshes || !total.triangles) throw new Error('Carbine geometry missing');
    return {
      model: model.name,
      parts: Object.entries(runtime.nodes).map(([name, node]) => ({
        name, kind: 'part', module: name, ...countGeometry(node)
      })),
      unnamedMeshes: total.unnamedMeshes,
      integralMeshes: total.meshes,
      triangles: total.triangles,
    };
  })()`
  );
  if (errors.length) throw new Error(JSON.stringify(errors));
  await writeFile(`${outputDirectory}/parts.json`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(
    `${outputDirectory}/parts-evidence.json`,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        browserVersion,
        errors,
        meshes: manifest.integralMeshes,
        triangles: manifest.triangles,
        parts: manifest.parts.length,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
});
console.log("カービン部品manifestと計測結果を保存しました。");
