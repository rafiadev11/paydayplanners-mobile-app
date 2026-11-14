/* global __dirname */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

function parseEasJson(output) {
  // EAS may print an environment-loading notice before its JSON document.
  const start = output.search(/^\s*[{[]/m);
  if (start < 0) throw new Error("EAS did not return a JSON document.");
  return JSON.parse(output.slice(start));
}

function verifyBuild(build, comparison, config, platform) {
  const hash = build?.fingerprint?.hash;
  if (
    build?.status !== "FINISHED" ||
    build?.platform?.toLowerCase() !== platform ||
    build?.app?.id !== config.extra?.eas?.projectId ||
    build?.updateChannel?.name !== "production" ||
    build?.distribution !== "STORE" ||
    build?.isForIosSimulator === true ||
    config.runtimeVersion?.policy !== "appVersion" ||
    build?.runtime?.version !== config.version ||
    !hash ||
    comparison?.fingerprint1?.hash !== hash ||
    comparison?.fingerprint2?.hash !== hash
  ) {
    throw new Error(
      `Cannot verify ${platform} OTA compatibility. Select the installed production build; native changes require a new runtime and native build.`,
    );
  }
}

function shipOta(platform, options, config, run) {
  if (!["ios", "android", "all"].includes(platform))
    throw new Error("Choose ios, android, or all.");
  const targets = platform === "all" ? ["ios", "android"] : [platform];
  for (const target of targets) {
    const id = options[`${target}-build`];
    if (!id)
      throw new Error(
        `Provide --${target}-build=<installed production EAS build ID>. Use --native only when a new native runtime is required.`,
      );
  }
  for (const target of targets) {
    const id = options[`${target}-build`];
    const build = run(["build:view", id, "--json"], true);
    const comparison = run(
      [
        "fingerprint:compare",
        "--build-id",
        id,
        "--environment",
        "production",
        "--json",
        "--non-interactive",
      ],
      true,
    );
    verifyBuild(build, comparison, config, target);
  }
  return run(
    [
      "update",
      "--platform",
      platform,
      "--channel",
      "production",
      "--environment",
      "production",
      "--message",
      options.message || "Production update",
      "--non-interactive",
    ],
    false,
  );
}

function main() {
  const platform = process.argv[2];
  const flags = process.argv.slice(3);
  if (flags.includes("--native")) {
    if (flags.length !== 1)
      throw new Error("Do not combine --native with OTA options.");
    require("./ship-native.cjs");
    return;
  }
  const options = {};
  for (const flag of flags) {
    const match = /^--(ios-build|android-build|message)=(.+)$/.exec(flag);
    if (!match) throw new Error(`Unknown option: ${flag}`);
    options[match[1]] = match[2];
  }
  const root = path.resolve(__dirname, "..");
  const config = JSON.parse(
    fs.readFileSync(path.join(root, "app.json"), "utf8"),
  ).expo;
  const run = (args, json) => {
    const result = spawnSync("eas", args, {
      cwd: root,
      encoding: "utf8",
      stdio: json ? ["ignore", "pipe", "inherit"] : "inherit",
      shell: false,
    });
    if (result.error || result.status !== 0)
      throw new Error(`EAS ${args[0]} failed; nothing further was published.`);
    return json ? parseEasJson(result.stdout) : undefined;
  };
  shipOta(platform, options, config, run);
}

module.exports = { verifyBuild, shipOta, parseEasJson };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
