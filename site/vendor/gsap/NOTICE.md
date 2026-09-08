# GSAP 3.15.0 — locally packaged motion library

This directory contains the unmodified official npm distribution files for GSAP core and ScrollToPlugin 3.15.0. Their original copyright, author, and license notices remain intact. No other plugins are included, and the website requests no remote executable code.

These files are governed by the [GSAP Standard “No Charge” License](https://gsap.com/standard-license/), not this repository’s MIT license. The license permits implementing GSAP in websites; this site uses it only for navigation motion and does not provide a visual animation-building tool. The package publishes its license as that URL and contains no standalone LICENSE file. The upstream notices are retained verbatim in each JavaScript file.

Source: [official npm package](https://www.npmjs.com/package/gsap/v/3.15.0), [upstream repository](https://github.com/greensock/GSAP), [ScrollToPlugin documentation](https://gsap.com/docs/v3/Plugins/ScrollToPlugin/).

To update deliberately, download the selected exact version with `npm pack gsap@VERSION --ignore-scripts`, verify the registry integrity, then replace only `dist/gsap.min.js` and `dist/ScrollToPlugin.min.js`. Review license changes, keep notices, and rerun navigation, reduced-motion, keyboard, interruption, history, and fallback checks.

For this version, tarball integrity (SHA-512, Base64):
`sha512-dMW4CWBTUK1AEEDeZc1g4xpPGIrSf9fJF960qbTZmN/QwZIWY5wgliS6JWl9/25fpTGJrMRtSjGtOmPnfjZB+A==`

- `gsap.min.js`: 72,927 bytes; SHA-256 `92bb9a96476f983d212a2bc4f54c889039c1696dd4461d40a736860938570fbb`.
- `ScrollToPlugin.min.js`: 4,059 bytes; SHA-256 `07cfd328e41012ae60b5614c2e58399fc13af8b1aec765febe770d4eb3e62fcd`.
