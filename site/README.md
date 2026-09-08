# A11y Chats website

A static download and showcase page for GitHub Pages. Serve this directory as the site root. It needs no build, external font, analytics, or component runtime. Local scripts keep paragraph endings together and mark the current section in the sticky navigation. Locally packaged GSAP core and ScrollToPlugin animate section navigation, with instant navigation for reduced motion and real anchor links as the fallback. The release download and release-note links target version 2.0.0.

`typography.js` inserts a non-breaking space between each paragraph's final two words by editing its text nodes. Links, emphasis, and other inline markup remain intact. The same rule covers the report caption and installation prose. CSS `text-wrap: pretty` provides an additional progressive enhancement.

The current navigation link uses bold text and `aria-current="location"`. Hidden, accessibility-excluded bold labels reserve its width so active-state changes do not move the navigation. Header measurements keep anchor offsets accurate after responsive layout changes. GSAP's separate terms and upstream notices are recorded in [vendor/gsap/NOTICE.md](vendor/gsap/NOTICE.md).

## Design source

The website uses native HTML and locally owned layout styles. Its neutral surfaces, blue accent, border color, system font policy, spacing, and rounded actions draw from the repository’s selected Adobe Spectrum foundation in `design-system/`. The website does not embed Spectrum Web Components or imply that the current extension report has adopted them.

## Preview provenance

`assets/example-report.png` is a screenshot of the actual installed extension’s native report, cropped to its image-results section. A controlled report-session fixture supplied three image records with populated, empty, and missing alt attributes. Its URLs use the reserved `example.com` domain. Image requests were fulfilled locally with the generated editorial example photo; no source website was scanned or user browsing data included. The report HTML, JavaScript, and CSS were not changed for the capture.

The report PNG is 1152 × 636 pixels. `assets/editorial-example.png` is an AI-generated, 1254 × 1254-pixel editorial still life of a white mug and closed notebook, created for this illustrative example. It contains no customer content, people, logos, or visible text. The caption labels it as an example. Its displayed controls belong to the screenshot; the surrounding link opens the full-size image. `assets/icon.png` is the repository’s existing 128-pixel extension icon.

## Validation scope

Chrome checks covered loaded assets, the primary release link, paragraph wrapping, skip link and keyboard section navigation, current-section tracking during clicks and scrolling, responsive reflow, and reduced-motion behavior. Earlier foundation checks covered selected text/focus contrast pairs and forced-color focus. The page loads its executable code and imagery from its own origin. Desktop and narrow screenshots were visually reviewed against the selected foundation. These are bounded automated and visual checks, not human assistive-technology testing or a WCAG conformance claim.
