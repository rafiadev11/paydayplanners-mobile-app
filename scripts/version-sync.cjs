const fs = require("fs");
const path = require("path");

const root = path.resolve(process.cwd());
const appJsonPath = path.join(root, "app.json");
const packageJsonPath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function isSemverLike(value) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value);
}

function printUsage() {
  console.log(`
Usage:
  npm run version:set -- <version>
  npm run version:check

Examples:
  npm run version:set -- 1.0.3
  npm run version:check
`);
}

function getPackageLockRootVersion(packageLock) {
  const rootPackageVersion = packageLock?.packages?.[""]?.version;

  if (typeof rootPackageVersion === "string" && rootPackageVersion.trim()) {
    return rootPackageVersion.trim();
  }

  return typeof packageLock?.version === "string"
    ? packageLock.version.trim()
    : "";
}

const command = (process.argv[2] || "").trim();

if (!command || command === "--help" || command === "-h") {
  printUsage();
  process.exit(0);
}

if (
  !fs.existsSync(appJsonPath) ||
  !fs.existsSync(packageJsonPath) ||
  !fs.existsSync(packageLockPath)
) {
  console.error(
    "Could not find app.json, package.json, and/or package-lock.json in this project.",
  );
  process.exit(1);
}

const appJson = readJson(appJsonPath);
const packageJson = readJson(packageJsonPath);
const packageLock = readJson(packageLockPath);

if (!appJson.expo || typeof appJson.expo !== "object") {
  console.error('app.json is missing the "expo" object.');
  process.exit(1);
}

const appVersion = String(appJson.expo.version || "").trim();
const packageVersion = String(packageJson.version || "").trim();
const packageLockVersion = getPackageLockRootVersion(packageLock);

if (command === "check") {
  const failures = [];

  if (!appVersion || !packageVersion || !packageLockVersion) {
    failures.push(
      "Missing version in app.json, package.json, and/or package-lock.json.",
    );
  }

  if (appVersion !== packageVersion) {
    failures.push(
      `Version mismatch: app.json=${appVersion}, package.json=${packageVersion}`,
    );
  }

  if (appVersion !== packageLockVersion) {
    failures.push(
      `Version mismatch: app.json=${appVersion}, package-lock.json=${packageLockVersion}`,
    );
  }

  if (failures.length > 0) {
    console.error("Version check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Versions match: ${appVersion}`);
  process.exit(0);
}

if (command === "set") {
  const nextVersion = (process.argv[3] || "").trim();

  if (!nextVersion) {
    console.error("Missing version value.");
    printUsage();
    process.exit(1);
  }

  if (!isSemverLike(nextVersion)) {
    console.error(
      `Invalid version "${nextVersion}". Use a SemVer value like 1.0.3.`,
    );
    process.exit(1);
  }

  const prevAppVersion = appVersion || "(unset)";
  const prevPackageVersion = packageVersion || "(unset)";
  const prevPackageLockVersion = packageLockVersion || "(unset)";

  appJson.expo.version = nextVersion;
  packageJson.version = nextVersion;
  packageLock.version = nextVersion;

  if (!packageLock.packages) {
    packageLock.packages = {};
  }

  if (!packageLock.packages[""]) {
    packageLock.packages[""] = {};
  }

  packageLock.packages[""].version = nextVersion;

  writeJson(appJsonPath, appJson);
  writeJson(packageJsonPath, packageJson);
  writeJson(packageLockPath, packageLock);

  console.log(`app.json: ${prevAppVersion} -> ${nextVersion}`);
  console.log(`package.json: ${prevPackageVersion} -> ${nextVersion}`);
  console.log(`package-lock.json: ${prevPackageLockVersion} -> ${nextVersion}`);
  process.exit(0);
}

console.error(`Unknown command "${command}".`);
printUsage();
process.exit(1);
