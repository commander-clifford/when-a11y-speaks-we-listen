# A11y Chats MVP feature contract

The product was originally named Image Alt Text Inspector. The user renamed it A11y Chats and authorized rebuilding the implementation from the source's design intent. The preserved code is evidence of intended outputs, not an architectural constraint.

| Capability | Working behavior |
| --- | --- |
| Activation | Chrome toolbar action or configurable Ctrl+Shift+Y / Command+Shift+Y shortcut. |
| Image inventory | Main-document `img` elements are collected regardless of viewport. Separate elements remain separate even when they share a URL and have different alt text. Reused virtual elements with changing sources can produce multiple observed records. |
| Offscreen components | Automatically explore eligible horizontal/vertical scroll containers using their initial extent, including RTL horizontal rails. Collect newly observed image elements/variants after each step. No generic site-control clicks. |
| Bounded discovery | Up to 500 image records, 24 scroll steps, 12 seconds elapsed, 12 component containers, and 25,000 candidate elements. A 300 ms sampling delay allows common scroll-driven loading. These are fixed MVP defaults; adjustable intensity is deferred. |
| Stop and restoration | A source-page Stop button ends exploration and returns records collected so far. Moving away from the source tab also ends exploration with a partial report. Original window and selected component offsets are restored. |
| Honest completion | Finished means the scoped traversal finished. Caps, user Stop, hidden source, scan errors, growing containers, truncated fields and payload limits are explained. No claim to discover all images on infinite/virtualized pages. |
| Alt evidence | Preserve raw alt and distinguish absent, empty, whitespace-only, and nonempty. Empty alt requires context and can be correct; it is not automatically a failure. |
| Image details | Source/current source, declared lazy source, source-set attribute, filename, dimensions, title, raw ARIA label/labelledby/hidden, raw role/hidden attribute, loading, decoding and fetch priority. |
| Page context | Actual source URL, declared metadata URL, canonical, page title, description fallback, language, robots, viewport, author, generator, capture time. |
| Social metadata | OG title/description/type/image; Twitter title/description/card/image, with image-src fallback. Social preview retained. |
| Viewer | Image cards with readable metadata and explicit Open details actions; native modal, larger preview, previous/next wrap, position status, Escape, focus containment and return. |
| Report lifecycle | Packaged report independent of source-page CSP; snapshots in local session memory, removed when their report tabs close and cleared by browser restart. Rescans reuse the report and retain prior results on failure. |

## Limits that remain intentional

- Main document only: no iframe documents, shadow roots, CSS backgrounds, standalone SVG, canvas, or image inputs.
- No arbitrary next-slide buttons, transformed-only carousels, closed details/hidden disclosures, or unmaterialized images absent from the DOM. Empty virtual containers need a recognized carousel/region marker to be explored.
- The fixed sampling interval can miss slow materialization. Two-dimensional containers are sampled along axes, not exhaustively across a grid. Page scripts can block the event loop and delay Stop or the deadline; 12 seconds is a cooperative elapsed-time limit.
- The entire document is not endlessly scrolled. Existing offscreen DOM images are still included. Scrolling a component into view may cause page scripts to load resources.
- Raw attributes do not determine computed accessible names, contextual adequacy, or what a particular screen reader speaks. Offscreen and hidden from assistive technology are different concepts.
- Image data/attributes longer than 8,000 characters are shortened and flagged. Reports retain a fitting prefix below 2 MiB when necessary and state omissions. At most ten report snapshots are retained; quota errors are actionable.
- Previews may make requests to image hosts. Host authorization, expiring URLs, source Blob lifetimes, and unsupported data formats can prevent previews; the textual source evidence remains available.

## Deferred rather than silently omitted

Adjustable discovery intensity, source-specific carousel adapters, richer accessible-name/context evidence, browser/screen-reader matrix validation, production packaging/licensing, and adoption of the selected Spectrum foundation into the working report are subsequent work. The design sample is reusable groundwork, not proof these items shipped.
