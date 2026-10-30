const fs = require("node:fs");
const path = require("node:path");

function prepareWearBuild(root) {
  const destination = path.join(root, "android");
  if (fs.existsSync(destination))
    throw new Error(
      "Refusing to replace an existing android directory. Use a clean EAS build checkout.",
    );
  fs.cpSync(path.join(root, "watch/wear"), destination, {
    recursive: true,
    filter: (source) =>
      !["build", ".gradle", "local.properties"].includes(path.basename(source)),
  });
  fs.chmodSync(path.join(destination, "gradlew"), 0o755);
  fs.cpSync(path.join(root, "watch/contracts"), path.join(root, "contracts"), {
    recursive: true,
  });
}
if (require.main === module) prepareWearBuild(process.cwd());
module.exports = { prepareWearBuild };
