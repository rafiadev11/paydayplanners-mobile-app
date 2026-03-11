const fs = require("fs");
const path = require("path");

const ENDPOINT_KEYS = [
  "EXPO_PUBLIC_API_URL_IOS",
  "EXPO_PUBLIC_API_URL_ANDROID",
  "EXPO_PUBLIC_LEGAL_URL",
];

const LOCAL_ENDPOINTS = {
  EXPO_PUBLIC_API_URL_IOS: "http://localhost",
  EXPO_PUBLIC_API_URL_ANDROID: "http://10.0.2.2",
  EXPO_PUBLIC_LEGAL_URL: "http://localhost",
};

function parseDotEnv(content) {
  const map = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    map[key] = value;
  }
  return map;
}

function upsertKeys(content, updates) {
  const lines = content ? content.split(/\r?\n/) : [];
  const applied = new Set();
  const nextLines = lines.map((line) => {
    const separator = line.indexOf("=");
    if (separator <= 0) return line;
    const key = line.slice(0, separator).trim();
    if (!(key in updates)) return line;
    applied.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const key of Object.keys(updates)) {
    if (!applied.has(key)) nextLines.push(`${key}=${updates[key]}`);
  }

  return `${nextLines.join("\n").replace(/\s+$/, "")}\n`;
}

function assertHasEndpoints(map, filename) {
  const missing = ENDPOINT_KEYS.filter((key) => !`${map[key] || ""}`.trim());
  if (missing.length === 0) return;

  console.error(`Missing required endpoint keys in ${filename}:`);
  for (const key of missing) console.error(`- ${key}`);
  process.exit(1);
}

function logCurrentEndpoints(envLocalPath) {
  if (!fs.existsSync(envLocalPath)) {
    console.log(".env.local does not exist yet.");
    return;
  }

  const env = parseDotEnv(fs.readFileSync(envLocalPath, "utf8"));
  console.log("Current endpoint values in .env.local:");
  for (const key of ENDPOINT_KEYS) {
    console.log(`${key}=${env[key] || "(missing)"}`);
  }
}

const mode = (process.argv[2] || "").trim();
if (!["local", "prod", "status"].includes(mode)) {
  console.error("Usage: node scripts/switch-endpoints.cjs <local|prod|status>");
  process.exit(1);
}

const root = path.resolve(process.cwd());
const envLocalPath = path.join(root, ".env.local");
const envProdPath = path.join(root, ".env.production.local");

if (mode === "status") {
  logCurrentEndpoints(envLocalPath);
  process.exit(0);
}

let updates;
if (mode === "local") {
  updates = LOCAL_ENDPOINTS;
} else {
  if (!fs.existsSync(envProdPath)) {
    console.error("Missing .env.production.local.");
    process.exit(1);
  }

  const prodEnv = parseDotEnv(fs.readFileSync(envProdPath, "utf8"));
  assertHasEndpoints(prodEnv, ".env.production.local");
  updates = Object.fromEntries(ENDPOINT_KEYS.map((key) => [key, prodEnv[key]]));
}

const current = fs.existsSync(envLocalPath)
  ? fs.readFileSync(envLocalPath, "utf8")
  : "";
const next = upsertKeys(current, updates);
fs.writeFileSync(envLocalPath, next);

console.log(`Updated .env.local endpoint values (${mode}).`);
logCurrentEndpoints(envLocalPath);
