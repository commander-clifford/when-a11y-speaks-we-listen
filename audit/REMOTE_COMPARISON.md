# Existing public repository comparison

Read-only inspection on September 8, 2026 found an existing public repository at [commander-clifford/a11y-chats](https://github.com/commander-clifford/a11y-chats). Its default branch is `main`, observed at commit `5d967b90127ee598bcb264de443f3e2a151543b9`.

It is the same product lineage: its README, background script and manifest are byte-for-byte matches for the preserved local baseline. Its content script differs in metadata layout sizing, and its CSS uses a different dark styling/layout. That historical commit's manifest identifies Image Alt Text Inspector 0.1.9. The reviewed local milestone was A11y Chats 0.2.0, with metadata aligned to 2.0.0 for Release 2. The historical public commit lacks the rebuilt bounded collector, packaged report and regression suite.

The public repository includes an MIT license, copied as a notice reference in `licenses/original-public-repository.LICENSE`. This observation narrows the source/license investigation but does not establish equivalence to the inaccessible cloud uploads or automatically establish rights for every local variant and asset.

After this comparison, the user explicitly chose to update the existing public repository and requested two releases. Release 1 preserves this baseline at `v1.0.0`; Release 2 adds the reviewed rebuild as `v2.0.0`. No separate private repository is part of the selected delivery.
