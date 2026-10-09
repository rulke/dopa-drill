# iOS: let the game be heard with the ringer switch off

The game's sound is a core part of it - the music layer is the reward for
getting problems right. On iOS, WKWebView puts Web Audio in the *ambient*
audio session category by default, which the hardware mute switch silences.
A player with the switch flipped (very common - it is the default state for
many people) gets a completely silent game with no way to fix it from the web
side. JavaScript cannot change the category; it has to be done natively.

Add this to the iOS project after `npx cap add ios`.

## 1. Set the category at launch

In `mobile/ios/App/App/AppDelegate.swift`, add `AVFoundation` and apply the
category before the web view starts:

```swift
import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // .playback ignores the ringer switch; .mixWithOthers keeps the game
        // from stopping whatever the player already had playing.
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // A failed session is not fatal: the game simply runs silent, which
            // is what it would have done anyway.
            print("audio session unavailable: \(error)")
        }
        return true
    }
}
```

The file ships with Capacitor's template already in place - this only adds the
`AVFoundation` import and the `do { ... }` block at the top of
`didFinishLaunchingWithOptions`, leaving the rest of the delegate untouched.

## 2. Reactivate after an interruption

iOS deactivates the session on a phone call, an alarm, or when another app
takes over audio. Web Audio does not come back on its own, and `audio.resume()`
in `app/js/main.js` only handles a *suspended* context. Add the reactivation to
the same delegate:

```swift
    func applicationDidBecomeActive(_ application: UIApplication) {
        try? AVAudioSession.sharedInstance().setActive(true)
    }
```

## 3. Check it on a device

The simulator does not model the mute switch, so this has to be a real device:

1. Flip the physical ringer switch to silent.
2. Launch the app and start a round.
3. Confirm the music and the key blips are audible.

## Android

No equivalent work is needed. Android has no hardware mute switch for media,
and the WebView's Web Audio output follows the media volume stream, which the
player controls with the volume keys as usual.
