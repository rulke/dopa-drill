# Dopa Drill (多巴胺口算)

[中文](README.md) | **English** | [日本語](README.ja.md)

A math drill where the show and the music keep escalating with every problem you solve. **Runs in the browser and on phones and tablets** - installable to the home screen and playable offline.

▶ **Play online: <https://rulke.github.io/dopa-drill/>** (nothing to install)

The mascot "Dopakichi" carries the digits you type and celebrates every correct answer. The further you get, the busier the screen and the music become — the last problem ends in a full-on festival. Wrong answers never kill the momentum, and there is no game over.

## Highlights

- 58 calculation skills covering grades 1–6. Addition, subtraction, multiplication, division, mid-input column arithmetic, decimals, fractions, percentages and more
- "My level" mode: starts with a check-up and unlocks the next skills as you master them
- Grade-based play, review, and a skill tree screen
- Finish the set for 100 points. At an 80% first-try rate or better you can enter the timed Extra stage and chase scores beyond 100
- Music and sound effects are synthesized with the Web Audio API (no audio files)
- Works on phones (portrait), tablets and desktops. On desktop, number keys and Backspace work too; on touch screens there is an on-screen keypad
- Motion intensity is adjustable in the settings; muting is available
- Records stay on the device (localStorage); nothing is sent anywhere

## Interface languages

Chinese (default), English and Japanese. On first open, Japanese browsers get Japanese and everything else defaults to Chinese. Switch any time under Settings → Language; the choice is stored locally.

## Running locally

No build step needed. Serve `app/` statically.

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Open `http://localhost:8000/app/` in a browser. The app uses ES Modules, so opening the HTML file directly via `file://` will not work.

On Windows, `python -m http.server` may serve `.js` as `text/plain`, which blocks module loading. Use the bundled server instead:

```bash
node tools/serve.mjs 8000 app
```

## Installing on a phone or tablet

The game is a plain installable PWA with no build step. **It is already hosted on
GitHub Pages: open <https://rulke.github.io/dopa-drill/> to play, or install it
from there as a standalone app.** To host it yourself, serve `app/` from any static
host (GitHub Pages, Cloudflare Pages - HTTPS required).

- **Android / desktop Chrome**: an install entry appears in the address bar or
  the menu.
- **iOS Safari**: Share → Add to Home Screen. iOS ignores the manifest and uses
  the `apple-touch-icon` and `apple-mobile-web-app-*` meta tags instead.

Installed, it runs full screen with no address bar and works **entirely
offline**: `app/sw.js` precaches the 33 runtime files under `app/`, the five
subset fonts included. When you ship a release you **must bump `CACHE_VERSION`
in `sw.js`**, or devices keep serving the old cache. That is the one manual
step.

The clock in `app/js/core.js` stops while the page is hidden, so locking the
phone or switching apps does not run the timer on; Android's back button unwinds
one layer of UI at a time instead of closing the game.

### Native builds for the app stores

`mobile/` is a Capacitor shell whose `webDir` points at `../app`, so the same
game files are copied into the native project without a line of the game being
changed. Worth it for store distribution, or for iOS storage that the system
will not reclaim (iOS clears a PWA's local data after it has not been opened for
a while; an app container is not subject to that).

See [mobile/README.md](mobile/README.md) and
[mobile/IOS-AUDIO.md](mobile/IOS-AUDIO.md) - iOS silences Web Audio when the
ringer switch is off, and only native code can override that.

## Tests

Requires Node.js 20+.

```bash
node --test tests/*.test.mjs
```

## Layout

| Path | Contents |
| --- | --- |
| `app/` | The game (dependency-free ES Modules) |
| `app/js/i18n.js`, `app/js/lang/` | i18n core and the zh/en/ja packs |
| `app/manifest.webmanifest`, `app/sw.js` | PWA manifest and offline precache |
| `app/icons/` | Home screen icons, generated from `app/icon.svg` by `tools/build_icons.mjs` |
| `docs/SPEC.md` | Specification (Chinese); `SPEC.ja.md` is the Japanese original |
| `docs/curriculum.md` | Curriculum and skill tree design (Chinese); `curriculum.ja.md` is the Japanese original |
| `docs/DESIGN.md` | Detailed design for the next features (Chinese, not implemented yet): endless mode, the growth page and error attribution |
| `docs/dopakichi.svg` | The original Dopakichi artwork |
| `mobile/` | The Capacitor shell (not used by the web build) |
| `tests/` | Unit tests |
| `tools/build_fonts.mjs` | Regenerates the subset fonts after UI wording changes |
| `tools/build_icons.mjs` | Rasterises the icon sizes from `app/icon.svg` |
| `tools/check-i18n.mjs` | Audits the language packs for missing keys |
| `tools/serve.mjs` | Local static server with correct MIME types |

## UI strings and fonts

Chinese is the source language: the Chinese string literals in the code double as lookup keys, and `app/js/lang/ja.js` / `app/js/lang/en.js` provide the translations. After adding strings, run:

```bash
node tools/check-i18n.mjs   # verify the en/ja packs have no missing keys
node tools/build_fonts.mjs  # rebuild the Chinese font subsets (cd tools && npm i first)
```

## License

- Source code: MIT License
- The character "Dopakichi" and the names/logos "Dopa Drill / 多巴胺口算 / ドパドリル": excluded from the MIT grant. Free for non-commercial fan works
- Fonts (`app/fonts/`): SIL Open Font License 1.1

See [LICENSE](LICENSE) for details.
