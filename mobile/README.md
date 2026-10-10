# Native shell (Capacitor)

Wraps the web game in a native container so it can be shipped through the App
Store and Google Play. **The game code is not touched**: `webDir` points at
`../app`, so the same files that serve the PWA are copied into the app bundle.

## What this buys over the PWA

The PWA (see the root README) already installs to the home screen, plays
offline and survives a locked phone. The native shell adds three things that are
only available to an app in a store:

- **Distribution.** Discoverable in the stores, no "add to home screen" step.
- **Durable storage.** iOS reclaims a PWA's local storage after seven days of
  not being opened, which would wipe the streak, the skill tree and the
  trophies. An app container is not subject to that.
- **Audio that respects the product.** The mute switch silences Web Audio in a
  web view unless a native audio session says otherwise - see
  [IOS-AUDIO.md](IOS-AUDIO.md).

## Requirements

| Target | Needs | Available on |
|---|---|---|
| Android | JDK 17-21, Android SDK, Gradle (bundled) | Windows, macOS, Linux |
| iOS | macOS, Xcode 15+, CocoaPods | **macOS only** |

The iOS half cannot be built anywhere but a Mac. Android builds fine on
Windows.

**Watch the JDK version on Android.** Gradle 8.14 rejects Java 25 with
`Unsupported class file major version 69`, and Android Studio ships a Java 25
JBR, so `JAVA_HOME` pointing at the Studio default fails the build. Point it at
a JDK 21 instead:

```bash
export JAVA_HOME="$HOME/.jdks/jdk-21.0.12.1+1"   # or any JDK 17-21
```

`mobile/android/local.properties` must point at the SDK, and Gradle wants
forward slashes (`sdk.dir=C:/Users/you/AppData/Local/Android/Sdk`); the
backslash-escaped form some generators write fails with an unhelpful
"Illegal character in path" error. Neither file is committed - both are
per-machine.

## Setup

```bash
cd mobile
npm install
npx cap add android      # generates mobile/android
npx cap add ios          # generates mobile/ios - macOS only
```

Then apply the native audio fix in [IOS-AUDIO.md](IOS-AUDIO.md).

## The edit-build loop

The Android and iOS projects contain **generated copies** of `app/`. Editing
those copies is a dead end - the next sync overwrites them. The direction is
always:

```
app/  ->  npx cap sync  ->  mobile/android, mobile/ios
```

So after any change to the game, build the APK with **one command**:

```bash
cd mobile
npm run apk              # cap sync android && gradlew assembleDebug
```

### Do not call gradlew on its own

`./gradlew assembleDebug` reads the copy of the web files that is *inside* the
Android project, not `app/` itself. Skip the sync and Gradle sees no changed
inputs, decides the APK is up to date, and hands you the previous release's
files wearing a current version number. Nothing in the native build reports
this - it looks like a successful build. It has happened once: a released APK
was missing three fixes that were already in `app/`.

Two guards exist now:

- `npm run apk` always syncs first, so the correct build is also the easy one.
- `tools/package_release.py` unzips the APK, compares every `assets/public/`
  file against `app/` byte for byte, and **refuses to package** on any
  difference. That check is what caught the one above.

### Installing over an older build

Uninstall the previous app before installing a new APK. Android will happily
update in place, but the WebView keeps its own cached copy of the assets, and a
leftover cache is hard to tell apart from a stale APK when you are looking at
the screen.

## Platform-specific code

The game detects the shell and changes one behaviour:

```js
const nativeShell = !!globalThis.Capacitor;   // app/js/main.js
```

The service worker is **not registered** inside the shell. Capacitor serves the
files from the app bundle, so a worker would only add a second cache that
outlives an update and serves the previous build. Everything else - the clock,
the back button, the safe-area padding - is the same code the browser runs.

## Status

Verified from this machine:

- `npx cap config` resolves `webDir` to the repository's `app/` directory and
  picks up the app id and name.
- `npx cap add android` generates the platform project and copies the game into
  `android/app/src/main/assets/public` - all 41 files, fonts and icons included.
- `./gradlew assembleDebug` **succeeds**: a 4.5 MB `app-debug.apk` containing
  the whole game.

Not verified:

- The iOS build. It needs a Mac and this machine is Windows, so `IOS-AUDIO.md`
  is written from the API contract rather than from a run.
- Anything on a real device: the APK has not been installed or played. The
  install-and-play check is the next step on a machine with a device attached.
