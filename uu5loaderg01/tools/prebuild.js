function checkSystemJsVersion() {
  const expectedVersion = "6.11.0";
  let pkg = require("../package.json");
  if (pkg.devDependencies.systemjs !== expectedVersion) {
    console.warn(`\u001b[33mWARN\u001b[39m Detected change of systemjs version. Make sure to:
1. Copy node_modules/systemjs/dist/system.js to src/systemjs-fixes/system.js.
2. Reapply changes that were present in previous src/systemjs-fixes/system.js (comments marked as CHANGED).
3. Update expected version of systemjs in tools/prebuild.js.
`);
  }
}

checkSystemJsVersion();
