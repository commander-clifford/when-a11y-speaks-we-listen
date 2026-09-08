# Release 2 packaging validation

Release preparation changes the completed working extension's manifest version from 0.2.0 to 2.0.0; its other runtime files are unchanged. Root package and lockfile versions are also 2.0.0. Spectrum report integration and feature additions remain paused.

Fresh release checks passed: eleven backend tests; integrity of all twenty-four archived reference files, including six local candidate originals and nine public pre-engineering files; JavaScript syntax; minimal manifest permissions; and referenced asset availability. Browser/visual outcomes summarized in `ENGINEERING_REVIEW.md` belong to the completed implementation milestone and are not represented as new human testing.

The installable `a11y-chats-2.0.0.zip` contains exactly ten extension files with `manifest.json` at its root. ZIP checks verified CRC, byte-for-byte member equality with `extension/`, syntax of three JavaScript files, local asset references and version coherence. It excludes originals, archives, audit records, site files, the separate design catalog and dependencies.

- ZIP size: 20,234 bytes.
- SHA-256: `f0de364f3b1e78757ed0992e2edcde4d2fc6c5bb2b75a6e5dd9538a1e811a42c`.

The private local repository and complete diagnostic evidence remain unchanged outside this release checkout. Only sanitized summaries and safe sources are added to the existing public history.
