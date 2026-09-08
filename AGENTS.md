# A11y Chats release repository

- Only `extension/` is the loadable extension. Spectrum integration remains paused; `design-system/` is a separate reviewed sample.
- Keep `originals/` and `archive/` unchanged. Verify their hashes against `audit/provenance.json`. These are local candidates, not cloud-verified copies.
- Preserve the image/page metadata and bounded-discovery contracts in `audit/FEATURE_CONTRACT.md`.
- Keep executable extension code local; retain Stop, partial results, per-element identity, alt distinctions and scroll restoration.
- Run the checks relevant to changes. Do not describe automated checks as human assistive-technology validation.
- Generated browser results may contain local paths, source URLs and session identifiers; keep them untracked and review before sharing.
- The public repository is `commander-clifford/a11y-chats`. Preserve its history and released tags. Never push private local diagnostic history or machine/session evidence.
- User authorization covers Release 1 at the public pre-engineering baseline, Release 2 at the reviewed rebuild, and a separate GitHub Pages download site. Further publication or features require user direction; no future release numbers are assigned.
- Do not assign an unverified license to original code. Preserve bundled third-party legal notices.
