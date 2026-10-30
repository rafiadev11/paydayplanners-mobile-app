const fs = require("node:fs");
const path = require("node:path");
const { withXcodeProject } = require("@expo/config-plugins");
const TARGET = "PaydayWatch";

function configureProject(project, config, projectRoot, iosRoot) {
  const bundle = `${config.ios.bundleIdentifier}.watchkitapp`;
  const destination = path.join(iosRoot, TARGET);
  fs.mkdirSync(destination, { recursive: true });
  for (const folder of ["App", "Sources", "Assets.xcassets"]) {
    fs.cpSync(
      path.join(projectRoot, "watch/apple", folder),
      path.join(destination, folder),
      { recursive: true },
    );
  }
  const main = project.getFirstTarget();
  let target = Object.entries(project.pbxNativeTargetSection()).find(
    ([, value]) => value.name?.replaceAll('"', "") === TARGET,
  );
  if (!target) {
    const added = project.addTarget(TARGET, "watch2_app", TARGET, bundle);
    added.pbxNativeTarget.productType = '"com.apple.product-type.application"';
    target = [added.uuid, added.pbxNativeTarget];
    project.addBuildPhase(
      [
        `${TARGET}/Sources/WatchCore/WatchSummary.swift`,
        ...["PaydayWatchApp", "WatchStore", "SummaryView", "BillReminders"].map(
          (name) => `${TARGET}/App/${name}.swift`,
        ),
      ],
      "PBXSourcesBuildPhase",
      "Sources",
      added.uuid,
    );
    project.addBuildPhase(
      [`${TARGET}/Assets.xcassets`],
      "PBXResourcesBuildPhase",
      "Resources",
      added.uuid,
    );
    project.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      added.uuid,
    );
  }
  // node-xcode embeds watch2 apps but deliberately omits the target dependency.
  // Modern single-target watch apps must build before the phone copies them.
  project.hash.project.objects.PBXContainerItemProxy ||= {};
  const dependencies = (project.hash.project.objects.PBXTargetDependency ||=
    {});
  if (
    !main.firstTarget.dependencies.some(
      (ref) => dependencies[ref.value]?.target === target[0],
    )
  ) {
    project.addTargetDependency(main.uuid, [target[0]]);
  }
  const configs = project.pbxXCBuildConfigurationSection();
  const mainConfigs =
    project.pbxXCConfigurationList()[main.firstTarget.buildConfigurationList]
      .buildConfigurations;
  const watchConfigs =
    project.pbxXCConfigurationList()[target[1].buildConfigurationList]
      .buildConfigurations;
  for (const item of watchConfigs) {
    const current = configs[item.value];
    const phone = mainConfigs
      .map((x) => configs[x.value])
      .find((x) => x.name === current.name).buildSettings;
    Object.assign(current.buildSettings, {
      SDKROOT: "watchos",
      SUPPORTED_PLATFORMS: '"watchos watchsimulator"',
      WATCHOS_DEPLOYMENT_TARGET: "10.0",
      TARGETED_DEVICE_FAMILY: "4",
      SWIFT_VERSION: "5.0",
      GENERATE_INFOPLIST_FILE: "YES",
      INFOPLIST_FILE: `${TARGET}/App/Info.plist`,
      INFOPLIST_KEY_CFBundleDisplayName: '"Payday Planner"',
      INFOPLIST_KEY_WKApplication: "YES",
      INFOPLIST_KEY_WKCompanionAppBundleIdentifier: config.ios.bundleIdentifier,
      INFOPLIST_KEY_ITSAppUsesNonExemptEncryption: "NO",
      PRODUCT_BUNDLE_IDENTIFIER: bundle,
      PRODUCT_NAME: TARGET,
      SKIP_INSTALL: "YES",
      MARKETING_VERSION: config.version,
      CURRENT_PROJECT_VERSION:
        phone.CURRENT_PROJECT_VERSION || config.ios.buildNumber || "1",
      PAYDAY_API_BASE_URL: '"https://paydayplanners.com/api/v1"',
      ASSETCATALOG_COMPILER_APPICON_NAME: "AppIcon",
      CODE_SIGN_STYLE: "Automatic",
      '"CODE_SIGN_ENTITLEMENTS[sdk=watchsimulator*]"': `${TARGET}/App/Simulator.entitlements`,
      SWIFT_OPTIMIZATION_LEVEL: current.name === "Debug" ? '"-Onone"' : '"-O"',
      ENABLE_USER_SCRIPT_SANDBOXING: "NO",
    });
    if (phone.DEVELOPMENT_TEAM)
      current.buildSettings.DEVELOPMENT_TEAM = phone.DEVELOPMENT_TEAM;
  }
  return project;
}

function withPaydayWatch(config) {
  const eas = config.extra?.eas || {};
  const build = eas.build || {};
  const experimental = build.experimental || {};
  const ios = experimental.ios || {};
  const extensions = (ios.appExtensions || []).filter(
    (x) => x.targetName !== TARGET,
  );
  config.extra = {
    ...config.extra,
    eas: {
      ...eas,
      build: {
        ...build,
        experimental: {
          ...experimental,
          ios: {
            ...ios,
            appExtensions: [
              ...extensions,
              {
                targetName: TARGET,
                bundleIdentifier: `${config.ios.bundleIdentifier}.watchkitapp`,
                entitlements: {},
              },
            ],
          },
        },
      },
    },
  };
  return withXcodeProject(config, (mod) => {
    mod.modResults = configureProject(
      mod.modResults,
      mod,
      mod.modRequest.projectRoot,
      mod.modRequest.platformProjectRoot,
    );
    return mod;
  });
}
module.exports = withPaydayWatch;
module.exports.configureProject = configureProject;
