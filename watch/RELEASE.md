# Watch release builds

Both companions use the existing Payday Planner store listings and EAS project.
Build commands prepare artifacts; they do not publish a release.

## Apple Watch

Run `npm run watch:release:apple` from the mobile repository. The production
iPhone archive embeds `PaydayWatch.app`. Expo prebuild runs
`plugins/with-payday-watch.cjs`, which recreates the target, copies its sources
and icon, and declares its signing identity to EAS.

- iPhone: `com.paydayplanners.app`
- Watch: `com.paydayplanners.app.watchkitapp`
- App Store Connect app: `6760873815`
- Minimum watchOS: 10

The Apple Developer Account Holder must accept outstanding program agreements.
The watch identifier requires its own distribution provisioning profile under
the same team as the iPhone app. EAS manages this through the declared app
extension. Do not create a separate App Store Connect listing.

Before uploading, check that the marketing version is still open for new builds
in App Store Connect. Once that version has been approved for release, use
`npm run version:set -- <next-version>` before rebuilding; incrementing only the
build number is insufficient (Apple errors 90062 and 90186). Confirm processing
finishes in TestFlight: a successful EAS submission confirms upload, not that
Apple accepted the build for testing.

## Wear OS

Run `npm run watch:release:wear`. The custom EAS workflow stages `watch/wear`
as the Android project on a clean worker, injects the existing app's upload key,
assigns the next remote Android version code, and creates a signed AAB.
Phone and watch builds share the remote version counter to avoid collisions.
The watch package is `com.paydayplanners.app`; minimum Android API is 30.

The staging script refuses to overwrite an existing local `android` directory.
Unsigned and debug-signed release bundles are rejected by Gradle.

In the existing Google Play app, enable the Wear OS form factor and its dedicated
release track. After reviewing a specific successful Wear build, use
`npm run watch:submit:wear -- --id <wear-build-id>` to upload a draft to
`wear:internal`. Always specify the Wear build ID: the same EAS project also
contains phone builds. Initial form-factor setup or first upload may require
Play Console. Supply the watch screenshots and complete applicable store checks
before rollout.

The Wear internal track is enabled with the existing QA Testers email list.
After a draft upload, review and publish it in that track to make it installable;
an uploaded draft alone is not available to testers. The tester opt-in link is
`https://play.google.com/apps/internaltest/4698015175701444894`.

## Validation and beta prerequisites

- Distribute the updated Android **phone** app as well as the Wear app. The Wear
  AAB does not update the phone app, and older phone releases lack Account →
  Connect your watch. Build the phone with the `production` profile and submit
  its specific build ID to the phone `internal` track. The phone tester opt-in
  link is `https://play.google.com/apps/internaltest/4701638953584211108`; the
  Wear track has a separate opt-in link above. Confirm both are installable.
- `npm run version:check`
- `npm run watch:test:release`
- Run Wear unit tests and lint from `watch/wear` with Java 17.
- Inspect the iOS archive for an embedded Watch app with matching version/build
  numbers, companion identifier, icon, and valid distribution signatures.
- Verify the AAB package, version code, watch hardware requirement and upload
  certificate before submission.
- Both release apps point to `https://paydayplanners.com/api/v1`.
- Deploy the watch API and enable `WATCH_COMPANION_ENABLED` in the backend before
  inviting testers; production deployment is separate from building artifacts.
- Test pairing, summary refresh, logout/revocation, offline state, and bill
  reminders on physical Apple Watch and Wear OS devices using release builds.

Neither simulator success nor an unsigned archive establishes store readiness.
Keep signing keys and provisioning profiles out of source control.
