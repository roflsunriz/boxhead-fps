const tag = process.argv[2] ?? "";
const identifier = String.raw`(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)`;
const semverTag = new RegExp(
  String.raw`^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(${identifier}(?:\.${identifier})*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$`
);

if (!semverTag.test(tag)) {
  console.error(`Invalid release tag: "${tag}". Expected SemVer such as v1.2.3 or v1.2.3-rc.1.`);
  process.exit(1);
}

console.log(`Validated semantic version tag: ${tag}`);
