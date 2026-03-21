/* global __dirname */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const validPlatforms = new Set(["ios", "android", "all"]);
const platform = (process.argv[2] || "").trim();

if (!validPlatforms.has(platform)) {
  console.error("Usage: node scripts/ship.cjs <ios|android|all>");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const easConfigPath = path.join(root, "eas.json");
const easConfig = JSON.parse(fs.readFileSync(easConfigPath, "utf8"));

const submitConfig = easConfig.submit?.production ?? {};
const hasIosAutoSubmit = Boolean(submitConfig.ios?.ascAppId);
const hasAndroidAutoSubmit = Boolean(submitConfig.android);

function runEasBuild(targetPlatform, autoSubmit) {
  const args = [
    "build",
    "--platform",
    targetPlatform,
    "--profile",
    "production",
  ];

  if (autoSubmit) args.push("--auto-submit");

  console.log(
    ["Running:", "eas", ...args, autoSubmit ? "" : "(without auto-submit)"]
      .filter(Boolean)
      .join(" "),
  );

  const result = spawnSync("eas", args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });

  if (typeof result.status === "number") return result.status;
  return 1;
}

function buildSingle(targetPlatform) {
  const autoSubmit =
    targetPlatform === "ios" ? hasIosAutoSubmit : hasAndroidAutoSubmit;

  if (targetPlatform === "ios" && !autoSubmit) {
    console.log(
      "iOS auto-submit is not configured in eas.json. Building production without auto-submit.",
    );
  }

  return runEasBuild(targetPlatform, autoSubmit);
}

if (platform === "all") {
  const iosCode = buildSingle("ios");
  if (iosCode !== 0) process.exit(iosCode);

  const androidCode = buildSingle("android");
  process.exit(androidCode);
}

process.exit(buildSingle(platform));
