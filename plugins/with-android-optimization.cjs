const { withAppBuildGradle } = require("@expo/config-plugins");

// SDK 55's generated default includes -dontoptimize. Persist the optimising
// rules across local and EAS prebuilds, alongside expo-build-properties.
module.exports = function withAndroidOptimization(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (
      !contents.includes("proguard-android-optimize.txt") &&
      !contents.includes("proguard-android.txt")
    ) {
      throw new Error(
        "Android ProGuard template changed; review release optimisation settings.",
      );
    }
    config.modResults.contents = contents.replaceAll(
      "proguard-android.txt",
      "proguard-android-optimize.txt",
    );
    return config;
  });
};
