/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const xcode = require("xcode");
const { configureProject } = require("../plugins/with-payday-watch.cjs");
const { prepareWearBuild } = require("./prepare-wear-build.cjs");
const root = path.resolve(__dirname, "..");

test("prebuild embeds one modern watch target and declares matching release identity", () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "payday-watch-project-"),
  );
  try {
    const fixture = path.join(temporary, "project.pbxproj");
    const source = fs.readFileSync(
      path.join(root, "watch/apple/PaydayWatch.xcodeproj/project.pbxproj"),
      "utf8",
    );
    // node-xcode requires trailing commas in PBX arrays, unlike Xcode itself.
    fs.writeFileSync(
      fixture,
      source.replace(/=\s*\(([^()\n]*[^,()\n])\)/g, "= ($1,)"),
    );
    const project = xcode.project(fixture);
    project.parseSync();
    const grouped = {};
    for (const [id, value] of Object.entries(project.hash.project.objects)) {
      if (value?.isa) {
        for (const field of [
          "targets",
          "buildConfigurations",
          "children",
          "buildPhases",
          "buildRules",
          "dependencies",
          "files",
        ]) {
          if (Array.isArray(value[field]))
            value[field] = value[field].map((x) =>
              typeof x === "string" ? { value: x, comment: x } : x,
            );
        }
        (grouped[value.isa] ||= {})[id] = value;
        grouped[value.isa][`${id}_comment`] = value.name || value.isa;
      }
    }
    project.hash.project.objects = grouped;
    project.getFirstTarget().firstTarget.name = "Phone";
    const config = {
      ios: { bundleIdentifier: "com.example.phone", buildNumber: "42" },
      version: "2.3.4",
    };
    configureProject(project, config, root, temporary);
    configureProject(project, config, root, temporary);
    const targets = Object.values(project.pbxNativeTargetSection()).filter(
      (x) => x.name?.replaceAll('"', "") === "PaydayWatch",
    );
    assert.equal(targets.length, 1);
    const dependencies = project.getFirstTarget().firstTarget.dependencies;
    assert.equal(dependencies.length, 1);
    const dependency =
      project.hash.project.objects.PBXTargetDependency[dependencies[0].value];
    const dependencyTarget =
      project.pbxNativeTargetSection()[dependency.target];
    assert.equal(dependencyTarget.name.replaceAll('"', ""), "PaydayWatch");
    assert.equal(
      targets[0].productType,
      '"com.apple.product-type.application"',
    );
    const phases = Object.values(
      project.hash.project.objects.PBXCopyFilesBuildPhase,
    ).filter((x) => x.isa);
    assert.equal(phases.length, 1);
    assert.equal(phases[0].dstSubfolderSpec, 16);
    assert.equal(phases[0].dstPath, '"$(CONTENTS_FOLDER_PATH)/Watch"');
    const configs =
      project.pbxXCConfigurationList()[targets[0].buildConfigurationList]
        .buildConfigurations;
    for (const { value } of configs) {
      const settings =
        project.pbxXCBuildConfigurationSection()[value].buildSettings;
      assert.equal(
        settings.PRODUCT_BUNDLE_IDENTIFIER,
        "com.example.phone.watchkitapp",
      );
      assert.equal(
        settings.INFOPLIST_KEY_WKCompanionAppBundleIdentifier,
        "com.example.phone",
      );
      assert.equal(settings.MARKETING_VERSION, "2.3.4");
      assert.equal(settings.SKIP_INSTALL, "YES");
      assert.ok(
        settings.PAYDAY_API_BASE_URL.includes("https://paydayplanners.com/"),
      );
    }
    assert.ok(
      fs.existsSync(path.join(temporary, "PaydayWatch/App/WatchStore.swift")),
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("Wear build staging excludes local build state and never replaces a phone project", () => {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "payday-wear-project-"),
  );
  try {
    const source = path.join(temporary, "watch/wear");
    fs.mkdirSync(path.join(source, "app/build"), { recursive: true });
    fs.mkdirSync(path.join(temporary, "watch/contracts"), { recursive: true });
    fs.writeFileSync(path.join(source, "gradlew"), "#!/bin/sh\n");
    fs.writeFileSync(path.join(source, "app/build.gradle"), "// native watch");
    fs.writeFileSync(path.join(source, "local.properties"), "sdk.dir=private");
    fs.writeFileSync(
      path.join(source, "app/build/local-secret"),
      "not for upload",
    );
    prepareWearBuild(temporary);
    assert.ok(fs.existsSync(path.join(temporary, "android/app/build.gradle")));
    assert.ok(!fs.existsSync(path.join(temporary, "android/app/build")));
    assert.ok(!fs.existsSync(path.join(temporary, "android/local.properties")));
    assert.throws(() => prepareWearBuild(temporary), /Refusing to replace/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
