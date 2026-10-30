/* global __dirname */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const xcode = require("xcode");
const { XML } = require("@expo/config-plugins");
const { configureWidgets } = require("../plugins/payday-watch-widgets.cjs");
const { configureProject } = require("../plugins/with-payday-watch.cjs");
const withPaydayWatch = require("../plugins/with-payday-watch.cjs");
const { prepareWearBuild } = require("./prepare-wear-build.cjs");
const root = path.resolve(__dirname, "..");

test("Wear shortcuts advertise platform complication types and require system binding permissions", async () => {
  const manifest = await XML.parseXMLAsync(
    fs.readFileSync(
      path.join(root, "watch/wear/app/src/main/AndroidManifest.xml"),
      "utf8",
    ),
  );
  const services = manifest.manifest.application[0].service;
  const complication = services.find(
    (x) => x.$["android:name"] === ".PaydayComplicationService",
  );
  assert.equal(
    complication.$["android:permission"],
    "com.google.android.wearable.permission.BIND_COMPLICATION_PROVIDER",
  );
  const metadata = Object.fromEntries(
    complication["meta-data"].map((x) => [
      x.$["android:name"],
      x.$["android:value"],
    ]),
  );
  // Android's manifest protocol calls monochrome images ICON, unlike the Kotlin enum.
  assert.deepEqual(
    metadata["android.support.wearable.complications.SUPPORTED_TYPES"]
      .split(",")
      .sort(),
    ["ICON", "LONG_TEXT", "SHORT_TEXT", "SMALL_IMAGE"],
  );
  assert.equal(
    metadata["android.support.wearable.complications.UPDATE_PERIOD_SECONDS"],
    "0",
  );
  const tile = services.find(
    (x) => x.$["android:name"] === ".PaydayTileService",
  );
  assert.equal(
    tile.$["android:permission"],
    "com.google.android.wearable.permission.BIND_TILE_PROVIDER",
  );
});

test("standalone Apple watch has an explicit widget dependency and embeds it once", () => {
  const project = xcode.project(
    path.join(root, "watch/apple/PaydayWatch.xcodeproj/project.pbxproj"),
  );
  project.parseSync();
  const watch = project.getFirstTarget();
  assert.equal(watch.firstTarget.dependencies.length, 1);
  configureWidgets(project, watch.uuid, "Widgets");
  configureWidgets(project, watch.uuid, "Widgets");
  const dependencies = watch.firstTarget.dependencies.map(
    (ref) => project.hash.project.objects.PBXTargetDependency[ref.value],
  );
  assert.equal(dependencies.length, 1);
  const widget = project.pbxNativeTargetSection()[dependencies[0].target];
  assert.equal(widget.name.replaceAll('"', ""), "PaydayWatchWidgets");
  const objects = project.hash.project.objects;
  const embedded = watch.firstTarget.buildPhases
    .map((ref) => objects.PBXCopyFilesBuildPhase[ref.value])
    .filter(Boolean)
    .flatMap((phase) => phase.files)
    .filter(
      (ref) =>
        project.pbxBuildFileSection()[ref.value].fileRef ===
        widget.productReference,
    );
  assert.equal(embedded.length, 1);
  const references = project.pbxFileReferenceSection();
  const resources = watch.firstTarget.buildPhases
    .map((ref) => objects.PBXResourcesBuildPhase[ref.value])
    .filter(Boolean)
    .flatMap((phase) => phase.files)
    .map((ref) => {
      const file = project.pbxBuildFileSection()[ref.value];
      return references[file.fileRef].path.replaceAll('"', "");
    });
  assert.ok(resources.includes("Assets.xcassets"));
});

test("EAS declares both watch signing identities once and preserves other extensions", () => {
  const config = {
    name: "Payday Planner",
    slug: "payday-planner",
    version: "2.3.4",
    ios: { bundleIdentifier: "com.example.phone" },
    extra: {
      eas: {
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: "Share",
                  bundleIdentifier: "com.example.phone.share",
                  entitlements: {},
                },
              ],
            },
          },
        },
      },
    },
  };
  const result = withPaydayWatch(withPaydayWatch(config));
  const extensions = result.extra.eas.build.experimental.ios.appExtensions;
  assert.deepEqual(
    extensions.map((x) => [x.targetName, x.bundleIdentifier]),
    [
      ["Share", "com.example.phone.share"],
      ["PaydayWatch", "com.example.phone.watchkitapp"],
      ["PaydayWatchWidgets", "com.example.phone.watchkitapp.widgets"],
    ],
  );
});

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
      } else {
        grouped[id] = value;
      }
    }
    project.hash.project.objects = grouped;
    // Use the standalone watch app as a minimal phone fixture, removing its
    // widget target so the plugin must create and embed the complete hierarchy.
    for (const [id, target] of Object.entries(
      project.pbxNativeTargetSection(),
    )) {
      if (target.name?.replaceAll('"', "") === "PaydayWatchWidgets") {
        delete project.pbxNativeTargetSection()[id];
        delete project.pbxNativeTargetSection()[`${id}_comment`];
        const rootProject = project.getFirstProject().firstProject;
        rootProject.targets = rootProject.targets.filter(
          (ref) => ref.value !== id,
        );
      }
    }
    project.getFirstTarget().firstTarget.dependencies = [];
    for (const ref of project.getFirstTarget().firstTarget.buildPhases) {
      if (grouped.PBXCopyFilesBuildPhase?.[ref.value]) {
        delete grouped.PBXCopyFilesBuildPhase[ref.value];
        delete grouped.PBXCopyFilesBuildPhase[`${ref.value}_comment`];
      }
    }
    project.getFirstTarget().firstTarget.buildPhases = project
      .getFirstTarget()
      .firstTarget.buildPhases.filter(
        (ref) => grouped.PBXSourcesBuildPhase?.[ref.value],
      );
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
    assert.equal(phases.length, 2);
    const phone = project.getFirstTarget().firstTarget;
    const phoneCopies = phone.buildPhases
      .map(
        (ref) => project.hash.project.objects.PBXCopyFilesBuildPhase[ref.value],
      )
      .filter(Boolean);
    assert.equal(phoneCopies.length, 1);
    assert.equal(phoneCopies[0].dstSubfolderSpec, 16);
    assert.equal(phoneCopies[0].dstPath, '"$(CONTENTS_FOLDER_PATH)/Watch"');
    const widgets = Object.entries(project.pbxNativeTargetSection()).filter(
      ([, x]) => x.name?.replaceAll('"', "") === "PaydayWatchWidgets",
    );
    assert.equal(widgets.length, 1);
    const [widgetID, widget] = widgets[0];
    assert.equal(widget.productType, '"com.apple.product-type.app-extension"');
    assert.equal(targets[0].dependencies.length, 1);
    assert.equal(
      project.hash.project.objects.PBXTargetDependency[
        targets[0].dependencies[0].value
      ].target,
      widgetID,
    );
    const widgetCopies = targets[0].buildPhases
      .map(
        (ref) => project.hash.project.objects.PBXCopyFilesBuildPhase[ref.value],
      )
      .filter(Boolean);
    assert.equal(widgetCopies.length, 1);
    assert.equal(widgetCopies[0].dstSubfolderSpec, 13);
    assert.equal(widgetCopies[0].files.length, 1);
    const embedded =
      project.pbxBuildFileSection()[widgetCopies[0].files[0].value];
    assert.equal(embedded.fileRef, widget.productReference);
    for (const { value } of project.pbxXCConfigurationList()[
      widget.buildConfigurationList
    ].buildConfigurations) {
      const settings =
        project.pbxXCBuildConfigurationSection()[value].buildSettings;
      assert.equal(
        settings.PRODUCT_BUNDLE_IDENTIFIER,
        "com.example.phone.watchkitapp.widgets",
      );
      assert.equal(settings.SDKROOT, "watchos");
      assert.equal(settings.MARKETING_VERSION, "2.3.4");
      assert.equal(String(settings.CURRENT_PROJECT_VERSION), "1");
      assert.equal(settings.APPLICATION_EXTENSION_API_ONLY, "YES");
    }
    assert.ok(
      fs.existsSync(
        path.join(temporary, "PaydayWatchWidgets/PaydayWatchWidgets.swift"),
      ),
    );
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
