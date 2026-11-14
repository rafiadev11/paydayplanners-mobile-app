const { test } = require("node:test");
const assert = require("node:assert/strict");
const { shipOta, verifyBuild, parseEasJson } = require("./ship.cjs");

test("reads EAS JSON with environment notices but rejects malformed metadata", () => {
  const metadata = { fingerprint1: { hash: "native" } };
  assert.deepEqual(parseEasJson(JSON.stringify(metadata)), metadata);
  assert.deepEqual(
    parseEasJson(
      'Environment variables loaded from the "production" environment on EAS.\n\n' +
        JSON.stringify(metadata, null, 2),
    ),
    metadata,
  );
  assert.throws(() => parseEasJson("EAS request failed"));
  assert.throws(() => parseEasJson('Notice\n{"fingerprint1":'));
  assert.throws(() => parseEasJson("{}\nUnexpected trailing output"));
});
const config = {
  version: "1.1.5",
  runtimeVersion: { policy: "appVersion" },
  extra: { eas: { projectId: "project" } },
};
const build = {
  status: "FINISHED",
  platform: "IOS",
  app: { id: "project" },
  updateChannel: { name: "production" },
  distribution: "STORE",
  runtime: { version: "1.1.5" },
  fingerprint: { hash: "native" },
};
const comparison = {
  fingerprint1: { hash: "native" },
  fingerprint2: { hash: "native" },
};

test("requires explicit installed build evidence before any release action", () => {
  assert.throws(
    () => shipOta("all", {}, config, () => assert.fail("must not run")),
    /installed production/,
  );
});
test("refuses mismatched native fingerprints and missing runtime metadata", () => {
  for (const bad of [
    { ...build, runtime: null },
    { ...build, runtime: { version: "1.1.4" } },
    { ...build, platform: "ANDROID" },
    { ...build, status: "ERRORED" },
    { ...build, updateChannel: { name: "preview" } },
    { ...build, app: { id: "other" } },
    { ...build, isForIosSimulator: true },
    { ...build, fingerprint: null },
  ])
    assert.throws(() => verifyBuild(bad, comparison, config, "ios"));
  assert.throws(() =>
    verifyBuild(
      build,
      { ...comparison, fingerprint2: { hash: "changed-native-code" } },
      config,
      "ios",
    ),
  );
  assert.throws(() => verifyBuild(build, {}, config, "ios"));
});
test("preflights both platforms before publishing either platform", () => {
  const calls = [];
  assert.throws(() =>
    shipOta(
      "all",
      { "ios-build": "ios", "android-build": "android" },
      config,
      (args) => {
        calls.push(args[0]);
        if (args[0] === "build:view")
          return {
            ...build,
            platform: args[1].toUpperCase(),
            runtime: { version: args[1] === "android" ? "old" : "1.1.5" },
          };
        return comparison;
      },
    ),
  );
  assert.equal(calls.includes("update"), false);
});
test("publishes OTA only after matching production build and fingerprint checks", () => {
  const calls = [];
  shipOta(
    "ios",
    { "ios-build": "installed", message: "Cost reductions" },
    config,
    (args) => {
      calls.push(args);
      if (args[0] === "build:view") return build;
      if (args[0] === "fingerprint:compare") return comparison;
    },
  );
  assert.deepEqual(
    calls.map((args) => args[0]),
    ["build:view", "fingerprint:compare", "update"],
  );
  assert.ok(calls[2].includes("production"));
  assert.ok(calls[2].includes("Cost reductions"));
  assert.equal(
    calls.some((args) => args[0] === "build"),
    false,
  );
});
