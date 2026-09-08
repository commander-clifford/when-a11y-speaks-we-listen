# Adobe Spectrum adoption foundation

Adobe Spectrum is the selected design foundation for A11y Chats. This directory implements a real, locally bundled Spectrum component sample. The working extension in `extension/` still uses its existing native report UI; the sample does not replace its collector, report storage, or production controls. This boundary keeps the engineering fixes usable while visual adoption is reviewed.

## Open and rebuild

Open `design-system/index.html` directly in current Chrome. The classic IIFE bundle works from a local file; there is no CDN, remote executable import, font download, or network data dependency. `?state=partial` (also `complete`, `scanning`, `stopped`, `error`, `empty`) selects a demonstration state. Run sample scan takes six seconds; Stop retains example results. All images are the existing extension icon, clearly labeled as local examples.

From the repository root:

```sh
npm ci --ignore-scripts
npm run build:design
```

The committed build is `design-system/dist/sample.js`. `dist/metafile.json` records the actual bundle dependency graph. `dist/package-evidence.json` records included package versions, declared licenses, format, and byte size. `sample.js.LEGAL.txt` retains bundled license notices. No new build output is placed inside the working extension.

## Selected components and version evidence

Registry `latest` was **1.12.2** when checked on September 8, 2026. The live documentation labels **1.12.3**, while the registry lists that line under prerelease tags. This sample pins the stable package manifests at 1.12.2. It uses the documented first-generation `sp-*` APIs; migration toward second-generation `swc-*` must be reviewed as a separate API change, not a silent package bump.

| Package | Exact version | Declared package license | Purpose |
| --- | --- | --- | --- |
| `@spectrum-web-components/theme` | 1.12.2 | ISC | Spectrum light / medium core tokens |
| `@spectrum-web-components/button` | 1.12.2 | Apache-2.0 | Scan, Stop, inspect, and dialog actions |
| `@spectrum-web-components/status-light` | 1.12.2 | Apache-2.0 | Text-labeled scan and alt states |
| `@spectrum-web-components/progress-circle` | 1.12.2 | Apache-2.0 | Labeled progress indicators |
| `esbuild` | 0.28.2 | MIT | Build-time local IIFE bundling |

Manifest evidence is in `package-lock.json` and the installed package manifests. The theme manifest declares ISC; the other selected components declare Apache-2.0. These per-package declarations are recorded without assuming one blanket license. Preserve supplied notices when distributing the bundle. No Adobe font or image license is assumed. The example icon comes from this repository's recovered asset set.

Official references: [Theme](https://opensource.adobe.com/spectrum-web-components/tools/theme/), [Core Tokens](https://opensource.adobe.com/spectrum-web-components/tools/core-tokens/), [Button](https://opensource.adobe.com/spectrum-web-components/components/button/), [Status Light](https://opensource.adobe.com/spectrum-web-components/components/status-light/), [Progress Circle](https://opensource.adobe.com/spectrum-web-components/components/progress-circle/), [Adobe source repository](https://github.com/adobe/spectrum-web-components), [esbuild API](https://esbuild.github.io/api/).

Only the selected element registration imports and light / medium core-token fragments are bundled. Button's own transitive dependencies are included where required; the entire component library and its all-theme bundle are not imported. The sample targets Chrome 120+ for modern component/platform behavior; this does not change the extension's separately declared browser baseline. Actual tested browser version belongs in the audit results.

## Semantic token ownership

`tokens.css` maps reusable `--a11y-*` aliases to actual `--spectrum-*` core tokens. `tokens.json` records the source files, vendor aliases, and observed light / medium values. UI surfaces use neutral gray tokens; accent is blue 900; semantic feedback uses green, orange, and red 900. Vendor button internals and colors are not restyled. Typography uses Spectrum sizes with an explicit **installed system font stack** override. Adobe Clean is not downloaded or implied.

The image cards, page-metadata disclosure, semantic definition lists, and native dialog are product compositions built using those tokens, not claimed as vendor components. Their layout remains locally owned. Numeric spacing in this sample follows the selected 8 / 12 / 16 / 24 / 32 / 40 px rhythm; narrow-screen rearrangement is product layout policy.

## Product and interaction contracts

- Put retained images near the top. Keep the current source compact. Full page/social metadata remains in a labeled native disclosure; the image dialog retains raw image attributes and review context.
- Preserve absent, empty, whitespace-only, and present alt as distinct source states. The three visible examples are illustrative. “Complete” refers to a bounded scan, never automatic accessibility conformance.
- Include Complete, Partial, Scanning, Stopped, Error, and Empty states. Partial/stopped results remain inspectable. State text explains the next step and the limits of discovery.
- Scan and Stop are labeled Spectrum buttons. Starting the sample moves focus to Stop; stopping restores focus to Scan. Completion restores focus only if it would otherwise remain on the now-hidden Stop control. State-selector changes leave focus on the selector.
- One polite live region announces scan transitions. Indeterminate progress does not imply a numerical completion estimate. Vendor status colors always have text labels.
- Image cards are named native articles. File, alt value, dimensions, and status remain readable content outside a dedicated Spectrum Inspect button. A native `dialog.showModal()` supplies modal top-layer behavior and an inert background; Escape and Close dismiss it. Focus starts at the dialog heading and returns to its opening control. Previous/Next changes evidence and announces position, without moving focus.
- Long values wrap, zoom/mobile layouts stack, and native focus indicators remain visible. The sample scopes Spectrum's `--spectrum-animation-duration-2000` to `0s` under reduced-motion preference so the indeterminate circle's shadow animations stop. Color/contrast, forced colors, focus across custom-element shadow DOM, and real screen-reader output still require integration checks. Choosing Spectrum does not certify the composed application.

## Staged migration

1. Review this built sample and recorded screenshots at desktop/mobile widths. Confirm that complete metadata stays accessible and image evidence appears promptly.
2. Move the chosen semantic aliases and locally bundled component subset into the packaged report. Keep external scripts local and preserve the report's existing CSP security boundary.
3. Connect UI actions to the existing session snapshot contract and rescan/Stop lifecycle. Preserve source URL, all image fields, warnings, limit reasons, and report cleanup behavior.
4. Re-run backend/collector tests, installed-extension browser checks, keyboard/modal checks, and assistive-technology testing on the integrated report. Inspect CSP and console output; validate vendor component styles under the final extension policy.
5. Remove replaced custom styles only after comparison confirms equivalent behavior. Keep a versioned local build and license evidence so the choice stays maintainable.

The sample permits inline **styles** for Web Components' generated shadow styles; executable code remains local with `script-src 'self'`. It includes no inline executable script, `eval`, or runtime remote module loader. Do not weaken the working extension's script policy to adopt it.

## Recorded validation

The completed local milestone produced a 312,096-byte bundle with thirteen required runtime packages and verified twenty-two token mappings. Chrome 152 checks passed the six sample states, keyboard/dialog behavior, Stop retention, 320px reflow, forced colors, reduced motion and zero remote HTTP requests/runtime errors. The final Empty/Error image-selection prompt fix passed a focused six-state check.

Raw local check results and screenshots are intentionally not included in this sanitized export. See the [sanitized design review](../audit/DESIGN_AUDIT.md) and [export boundary](../audit/EXPORT_NOTES.md). The included test scripts can generate new local evidence. Human assistive-technology validation and integration into the installed extension remain open.
