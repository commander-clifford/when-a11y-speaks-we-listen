# A11y Chats 2.0.0

A local Chrome extension for inspecting raw image attributes and page/social metadata. It automatically inventories existing DOM image elements and explores eligible scrollable components within fixed limits. Missing, empty, whitespace-only and populated alt attributes remain distinct evidence for human review.

Review each webpage image beside its actual alt text without opening developer tools. This is the engineering-reviewed early local-install release for copywriters and other reviewers. Its working report uses native components; the reviewed [Adobe Spectrum sample](design-system/index.html) remains separate. Integration is paused.

**[Download Release 2](https://github.com/commander-clifford/a11y-chats/releases/download/v2.0.0/a11y-chats-2.0.0.zip)** · [Release notes](https://github.com/commander-clifford/a11y-chats/releases/tag/v2.0.0)

The ZIP contains only the installable extension. Unzip it, then use the resulting folder for Load unpacked. When installing from this source repository, use `extension/`. This is not a Chrome Web Store listing.

## Install locally

1. Open Chrome's Extensions page and enable Developer mode.
2. Choose **Load unpacked** and select this repository's `extension/` folder.
3. Open an HTTP/HTTPS website and click the A11y Chats toolbar action. The optional defaults are Ctrl+Shift+Y or Command+Shift+Y; Chrome's extension shortcut settings can change them.
4. Keep the source tab active during scanning. **Stop scan and show results** returns partial results. Source/component scroll positions are restored.
5. **Scan again** updates the existing report from its bound source tab. Closing the report deletes its session snapshot.

The extension needs no build or dependency installation. It was tested in Chrome 152 on macOS; the manifest's Chrome 102 minimum is an API floor, not a verified compatibility matrix. Bounds are 500 image records, 24 scroll steps, 12 seconds, 12 containers and ten retained report tabs. The time limit is cooperative when page scripts block execution.

Image previews may contact original image hosts without a referrer. Attribute inspection does not establish accessibility conformance or screen-reader speech. See the [feature contract](audit/FEATURE_CONTRACT.md).

## Contents and provenance

| Path | Purpose |
| --- | --- |
| `extension/` | Complete working native extension and necessary icons/styles. |
| `originals/` | Six unchanged local candidate source files. Cloud equivalence is unverified. |
| `archive/` | Nine local historical/assets references and nine unchanged public baseline files. |
| `tests/` | Reproducible backend, collector, original-defect and browser checks. |
| `design-system/` | Reviewed Spectrum sample, local bundle, exact dependencies, tokens and legal notices. |
| `audit/` | Sanitized review summaries, feature contract, source hashes and references. |

The six expected cloud filenames were identified, but **zero cloud source contents were recovered or verified**. The original fifteen local references remain unchanged, with nine additional files preserved from the existing public pre-engineering baseline in `archive/public-baseline/`. The original private local archive retains full provenance and detailed validation evidence. Public history is preserved; private local history, paths/project identifiers and browser/session diagnostics are excluded. See [sanitation notes](audit/EXPORT_NOTES.md).

## Release history

- [Release 1 — historical baseline](https://github.com/commander-clifford/a11y-chats/releases/tag/v1.0.0) points to the unchanged pre-engineering public commit. Its original manifest remains 0.1.9; `v1.0.0` labels the historical release, not a retroactive code change. It has known defects and is retained for comparison.
- [Release 2 — reviewed rebuild](https://github.com/commander-clifford/a11y-chats/releases/tag/v2.0.0) contains the completed bounded MVP, with extension/package metadata aligned at 2.0.0. The public root license and prior branch history are retained.

Future Spectrum report integration and grading are unassigned follow-ups. Neither is included or assigned a future release number.

## Checks and Spectrum build

Node.js 22+ is required; the recorded run used Node 26.4.0. Run `npm test`, `npm run check`, and `npm run test:original` without dependency installation. Browser tests use isolated temporary profiles and localhost fixtures. Set `CHROME_BIN` to your Chrome executable, or provide `google-chrome` on PATH, then run the relevant scripts in `tests/`.

For example, after configuring `CHROME_BIN`: `node tests/browser-working.mjs`, `node tests/report-browser.mjs`, `node tests/collector-browser.mjs`, or `node tests/design-browser.mjs`. Generated local evidence is ignored by Git. Review it before sharing.

The committed Spectrum bundle opens directly from `design-system/index.html`. To rebuild it: `npm ci --ignore-scripts`, then `npm run build:design`. Dependencies are pinned; there is no runtime CDN or font download. See [adoption notes](design-system/adoption.md).

## Readiness

The [engineering review](audit/ENGINEERING_REVIEW.md) documents resolved original defects separately from remaining release checks. The original P1 findings were fixed. Human assistive-technology validation, broader browser/site testing, Spectrum integration and distribution licensing remain open. The historical local readme references an absent MIT license file; the existing public same-project repository supplies an MIT notice, retained as an upstream reference in [license evidence](licenses/README.md). No new blanket license grant is asserted here. Spectrum and transitive legal notices are retained.
