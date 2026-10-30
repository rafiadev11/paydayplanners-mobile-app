const WIDGET_TARGET = "PaydayWatchWidgets";

function configureWidgets(project, watchTargetId, sourceRoot) {
  const targets = project.pbxNativeTargetSection();
  const watch = targets[watchTargetId];
  const first = project.getFirstTarget();
  const objects = project.hash.project.objects;
  objects.PBXContainerItemProxy ||= {};
  objects.PBXTargetDependency ||= {};
  let target = Object.entries(targets).find(
    ([, value]) => value.name?.replaceAll('"', "") === WIDGET_TARGET,
  );
  if (!target) {
    const previousPhases = new Set(
      first.firstTarget.buildPhases.map((x) => x.value),
    );
    const added = project.addTarget(
      WIDGET_TARGET,
      "app_extension",
      WIDGET_TARGET,
    );
    target = [added.uuid, added.pbxNativeTarget];

    if (first.uuid !== watchTargetId) {
      // node-xcode embeds new extensions in the first (phone) target. Move this
      // product and its dependency into the watch app's PlugIns directory.
      const productFiles = new Set(
        Object.entries(project.pbxBuildFileSection())
          .filter(
            ([, file]) =>
              file.fileRef === added.pbxNativeTarget.productReference,
          )
          .map(([id]) => id),
      );
      for (const phase of Object.values(objects.PBXCopyFilesBuildPhase || {})) {
        if (phase.files)
          phase.files = phase.files.filter((x) => !productFiles.has(x.value));
      }
      first.firstTarget.buildPhases = first.firstTarget.buildPhases.filter(
        (ref) => {
          const phase = objects.PBXCopyFilesBuildPhase?.[ref.value];
          if (previousPhases.has(ref.value) || !phase || phase.files.length)
            return true;
          delete objects.PBXCopyFilesBuildPhase[ref.value];
          delete objects.PBXCopyFilesBuildPhase[`${ref.value}_comment`];
          return false;
        },
      );
      const widgetDependencies = first.firstTarget.dependencies.filter(
        (ref) => objects.PBXTargetDependency[ref.value]?.target === added.uuid,
      );
      first.firstTarget.dependencies = first.firstTarget.dependencies.filter(
        (ref) => !widgetDependencies.includes(ref),
      );
      watch.dependencies.push(...widgetDependencies);
      project.addBuildPhase(
        [`${WIDGET_TARGET}.appex`],
        "PBXCopyFilesBuildPhase",
        "Embed Watch Widgets",
        watchTargetId,
        "app_extension",
      );
    }
    project.addBuildPhase(
      [`${sourceRoot}/PaydayWatchWidgets.swift`],
      "PBXSourcesBuildPhase",
      "Sources",
      added.uuid,
    );
    project.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      added.uuid,
    );
  }

  // A clean standalone project may not have dependency sections when node-xcode
  // creates the target. Keep this explicit so direct target builds and archives
  // build the extension before copying it into the watch app.
  if (
    !watch.dependencies.some(
      (ref) => objects.PBXTargetDependency[ref.value]?.target === target[0],
    )
  ) {
    project.addTargetDependency(watchTargetId, [target[0]]);
  }

  const mainGroup = project.getFirstProject().firstProject.mainGroup;
  const widgetGroup = Object.entries(objects.PBXGroup).find(
    ([, value]) => value.name === WIDGET_TARGET,
  );
  if (!widgetGroup) {
    const group = project.addPbxGroup(
      [`${sourceRoot}/PaydayWatchWidgets.swift`, `${sourceRoot}/Info.plist`],
      WIDGET_TARGET,
    );
    // Omit absent paths rather than serializing the string "undefined".
    delete group.pbxGroup.path;
    objects.PBXGroup[mainGroup].children.push({
      value: group.uuid,
      comment: WIDGET_TARGET,
    });
  }

  const configs = project.pbxXCBuildConfigurationSection();
  const lists = project.pbxXCConfigurationList();
  const watchConfigs = lists[watch.buildConfigurationList].buildConfigurations;
  for (const ref of lists[target[1].buildConfigurationList]
    .buildConfigurations) {
    const current = configs[ref.value];
    const parent = watchConfigs
      .map((x) => configs[x.value])
      .find((x) => x.name === current.name).buildSettings;
    Object.assign(current.buildSettings, {
      SDKROOT: "watchos",
      SUPPORTED_PLATFORMS: '"watchos watchsimulator"',
      WATCHOS_DEPLOYMENT_TARGET: "10.0",
      TARGETED_DEVICE_FAMILY: "4",
      SWIFT_VERSION: "5.0",
      GENERATE_INFOPLIST_FILE: "YES",
      INFOPLIST_FILE: `${sourceRoot}/Info.plist`,
      INFOPLIST_KEY_CFBundleDisplayName: '"Payday Planner"',
      PRODUCT_BUNDLE_IDENTIFIER: `${parent.PRODUCT_BUNDLE_IDENTIFIER.replaceAll('"', "")}.widgets`,
      PRODUCT_NAME: WIDGET_TARGET,
      MARKETING_VERSION: parent.MARKETING_VERSION,
      CURRENT_PROJECT_VERSION: parent.CURRENT_PROJECT_VERSION,
      SKIP_INSTALL: "YES",
      APPLICATION_EXTENSION_API_ONLY: "YES",
      CODE_SIGN_STYLE: "Automatic",
      SWIFT_OPTIMIZATION_LEVEL: current.name === "Debug" ? '"-Onone"' : '"-O"',
    });
    if (parent.DEVELOPMENT_TEAM)
      current.buildSettings.DEVELOPMENT_TEAM = parent.DEVELOPMENT_TEAM;
  }
  return target;
}

module.exports = { configureWidgets, WIDGET_TARGET };
