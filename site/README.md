# A11y Chats website

A static download and showcase page for GitHub Pages. Serve this directory as the site root. It needs no build, JavaScript, external font, analytics, or component runtime. The release download and release-note links target version 2.0.0.

## Design source

The website uses native HTML and locally owned layout styles. Its neutral surfaces, blue accent, border color, system font policy, spacing, and rounded actions draw from the repository’s selected Adobe Spectrum foundation in `design-system/`. The website does not embed Spectrum Web Components or imply that the current extension report has adopted them.

## Preview provenance

`assets/example-report.png` is a screenshot of the actual installed extension’s native report, cropped to its image-results section. A controlled report-session fixture supplied three image records with populated, empty, and missing alt attributes. Its URLs use the reserved `example.com` domain. Image requests were fulfilled locally with the generated editorial example photo; no source website was scanned or user browsing data included. The report HTML, JavaScript, and CSS were not changed for the capture.

The report PNG is 1152 × 636 pixels. `assets/editorial-example.png` is an AI-generated, 1254 × 1254-pixel editorial still life of a white mug and closed notebook, created for this illustrative example. It contains no customer content, people, logos, or visible text. The caption labels it as an example. Its displayed controls belong to the screenshot; the surrounding link opens the full-size image. `assets/icon.png` is the repository’s existing 128-pixel extension icon.

## Validation scope

Local Chrome checks covered loaded assets, the primary release link, skip link and keyboard section navigation, 320-pixel reflow, selected text/focus contrast pairs, forced-color focus, and reduced-motion behavior. Rendering made no HTTP requests and produced no runtime or CSP errors. Desktop and narrow screenshots were visually reviewed against the selected foundation. These are bounded automated and visual checks, not human assistive-technology testing or a WCAG conformance claim.
