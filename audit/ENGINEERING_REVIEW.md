# Engineering review — sanitized summary

The completed rebuild is a viable bounded local MVP in the tested scope. It is not a broadly validated production release or an accessibility-conformance checker. This summary retains conclusions from the original local review; raw runs, screenshots, machine identifiers and original Git history remain in the local archive.

## Resolved original findings

| Original severity | Reproduced problem | Working resolution |
| --- | --- | --- |
| P1 | Six-file source package omitted required icons/CSS and failed to load. | Necessary local assets are included in `extension/`. |
| P1 | Broad text matching clicked arbitrary page controls, including a fixture's Delete table button. | Collector never invokes arbitrary site controls. |
| P1 | Blob report's inline script was blocked by restrictive source CSP. | Report runs as a packaged extension page with local scripts. |
| P1 | Continually growing page could scroll without a total bound. | Fixed image/step/time/container caps, Stop, partial retention and restoration. |
| P1 | Missing, empty and whitespace alt states collapsed. | Per-element raw values and four distinct states are preserved. |
| P2 | Load callback and timeout could each produce a report. | Single async result and source-tab scan guard. |
| P2 | Malformed percent escapes aborted the scan. | Defensive decoding preserves a usable filename. |
| P2 | Escaped links still allowed unsafe URL schemes. | HTTP/HTTPS link allowlist and constrained image schemes; page data rendered as text. |
| P2 | Weak target/error/message/storage lifecycle handling. | Validated source targets, exact report binding, bounded session snapshots and cleanup. |
| P2 | Shortcut overlapped DevTools; documentation and focus behavior drifted. | Configurable safer default, accurate contract, native modal/focus/forced-color refinements. |

These are original-source findings and completed fixes. Remaining release checks below are not automatically P1 defects. Automated escaping probes are limited evidence, not a complete XSS proof.

## Recorded validation

- Seven original-defect probes and actual unpacked original-extension ordinary/CSP fixtures reproduced the identified failures.
- Eleven backend behavior tests passed, including rescan authorization, session size/report count caps, error handling, restart association and close/rescan races.
- Fifteen real-DOM Chrome collector scenarios passed: offscreen/per-element capture; horizontal lazy, virtualized and RTL rails; vertical components; growth/caps; Stop and hidden-source interruption; restoration and cleanup.
- Actual installed working extension passed normal and restrictive-CSP fixtures, metadata/alt summaries, malicious-string/scheme checks, keyboard dialog interaction and focus return, 320px reflow, forced colors, reduced motion, errors and report-session deletion.
- Additional packaged report fixtures passed raw ARIA/lazy metadata, empty/error/partial states and failed-rescan retention.
- The separate Spectrum sample passed ten independent visual/browser check categories and the final six-state prompt check. Its twenty-two token mappings and eight selected contrast pairs were verified.
- The actual HBO Max public homepage run recorded 106 image elements: 76 with alt text, 30 empty, zero missing or whitespace-only. Two small-overflow horizontal containers, four steps and 1.223 seconds; source scrolling restored. Consent remained untouched and no newly materialized images were observed. This covered the signed-out initial public DOM, not a signed-in catalog or exhaustive content discovery.

Recorded environment: Chrome 152.0.7977.76, Node 26.4.0, macOS. This export preserves runnable checks and summarized results, not all original raw evidence. Only the export's backend/integrity checks are re-run during upload preparation; browser outcomes above belong to the completed local milestone.

## Security and remaining release checks

Working permissions are only `activeTab`, `scripting` and `storage`. Executable code is local. There is no analysis API, telemetry, broad host permission, or storage.sync use. Image previews can contact source hosts; session storage is not a secure vault.

1. Verify cloud equivalence if the historical cloud uploads must be authoritative. Six local candidates are preserved; cloud contents were not recovered.
2. Perform human VoiceOver/NVDA, speech-input and real zoom/text-scaling validation. Automated semantics/focus checks do not substitute for it.
3. Test broader Chrome versions, site/carousel patterns and source navigation/restart cases. The declared Chrome minimum is not a tested matrix.
4. Confirm original ownership/license terms before broader distribution; retain Spectrum/transitive notices and prepare accurate publication disclosures.
5. Decide when to integrate the reviewed Spectrum sample into the live report. Integration remains paused; it requires fresh installed-extension regressions and human accessibility validation.
