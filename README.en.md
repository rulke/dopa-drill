# Dopa Drill (多巴胺口算)

A math drill where the show and the music keep escalating with every problem you solve. Runs entirely in the browser.

The mascot "Dopakichi" carries the digits you type and celebrates every correct answer. The further you get, the busier the screen and the music become — the last problem ends in a full-on festival. Wrong answers never kill the momentum, and there is no game over.

## Highlights

- 58 calculation skills covering grades 1–6. Addition, subtraction, multiplication, division, mid-input column arithmetic, decimals, fractions, percentages and more
- "My level" mode: starts with a check-up and unlocks the next skills as you master them
- Grade-based play, review, and a skill tree screen
- Finish the set for 100 points. At an 80% first-try rate or better you can enter the timed Extra stage and chase scores beyond 100
- Music and sound effects are synthesized with the Web Audio API (no audio files)
- Works on phones (portrait) and desktops. On desktop, number keys and Backspace work too
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
| `docs/SPEC.md` | Specification (Chinese); `SPEC.ja.md` is the Japanese original |
| `docs/curriculum.md` | Curriculum and skill tree design (Chinese); `curriculum.ja.md` is the Japanese original |
| `docs/dopakichi.svg` | The original Dopakichi artwork |
| `tests/` | Unit tests |
| `tools/build_fonts.mjs` | Regenerates the subset fonts after UI wording changes |
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
- The character "Dopakichi" and the names/logos "Dopa Drill / 多巴胺口算 / ドパドリル": excluded from the MIT grant. Free for non-commercial fan works (below)
- Fonts (`app/fonts/`): SIL Open Font License 1.1

See [LICENSE](LICENSE) for details.

### Derivative works

Non-commercial use needs no permission or contact.

- Allowed: fan art, comics, novels, animation, videos, social media posts, and publishing non-commercial forks or modified versions of this game
- Play videos and streams: free, including on platforms with ad revenue or tipping
- Permission required: selling goods or works, use in paid products/services/advertising, using the character or name for other products, services or brands, or presenting it as official
- Forbidden: uses that violate public order and morals or harm the reputation of the character or this project

When publishing, make it clear that your work is unofficial. If translations of LICENSE differ from the English text, the English text prevails.
