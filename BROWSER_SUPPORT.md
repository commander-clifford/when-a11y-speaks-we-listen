# Browser support

The published download is currently verified in **desktop Chrome on macOS**. Other browsers are assessed below; this is not a universal compatibility claim. The existing [2.0.0 ZIP](https://github.com/commander-clifford/a11y-chats/releases/download/v2.0.0/a11y-chats-2.0.0.zip), release tags, and release assets have not been replaced.

## Current status

| Browser | Evidence and status | Practical next step |
| --- | --- | --- |
| Chrome | Verified in Chrome 152 on macOS with the installed extension, normal and restrictive-CSP pages, image/alt states, report details, keyboard behavior, and session cleanup. | Use the existing ZIP and the Chrome installation steps below. Other operating systems and historical Chrome versions are not a verified matrix. |
| Microsoft Edge | Compatible in principle with the extension's Chromium APIs and Manifest V3 format; no Edge runtime was available for testing. | Try the same unpacked extension in a current desktop Edge, then verify real scans before relying on it. No Edge-specific release or verified support claim is made. |
| Firefox | The published package's service-worker-only background manifest is not a Firefox package. Firefox has equivalent core APIs, but needs a different background declaration and validation. A bounded Firefox 154 probe did not reach extension installation; no runtime pass is claimed. | A temporary development port is separate from a signed installable release. See the Firefox notes below. |
| Safari | API compatibility appears plausible, but the extension has not been packaged or tested in Safari. Safari 26.6.2 was available; the local Xcode/conversion toolchain was not. | Plan a separate Safari packaging and runtime-validation step. The Chrome ZIP is not a Safari installer. |
| Other Chromium browsers | Shared Chromium APIs are evidence of possible compatibility, not verification in Brave, Opera, Vivaldi, or another browser. | Test each target browser/version and its extension-installation policies before claiming support. |

Assessment date: 8 September 2026. Mobile browsers are outside this desktop assessment. A work-managed browser may require IT approval for developer-mode or unpacked extensions.

## Chrome installation

1. Download and extract the existing ZIP. Keep the extracted folder on your computer.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the folder containing `manifest.json`. If using this repository instead, select `extension/`.
4. Open an HTTP or HTTPS webpage and activate A11y Chats from the toolbar. Keep the source tab active while scanning.

The current source raises `minimum_chrome_version` from 102 to 112. Chrome 111 and earlier allowed only 1 MB of session storage, while this extension can retain a report approaching 2 MB. Chrome 112 raised the browser quota to 10 MB. This corrects an overly broad source-level minimum without changing the published ZIP or claiming that every intervening version was tested. Total session capacity remains bounded; large reports can still exhaust it. [Chrome storage documentation](https://developer.chrome.com/docs/extensions/reference/api/storage)

## Edge trial installation — not yet verified

Microsoft documents Chrome extension APIs and manifest keys as code-compatible with Edge and explicitly requires sideload testing before publication. The extension uses `action`, `commands`, `runtime`, `scripting`, `storage`, and `tabs`, all listed in Edge's supported API families; it does not use native messaging or a Chrome-specific update URL. This supports a small testing path, not a guarantee. [Microsoft porting guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension), [supported APIs](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support)

For an evaluation in a current desktop Edge, open `edge://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted ZIP folder containing `manifest.json`. Verify the toolbar action, actual alt states, Stop, rescan, detail navigation, and report cleanup on representative work pages. Browser-owned pages and other protected destinations cannot be inspected. [Microsoft sideloading instructions](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading)

## Firefox porting notes

Firefox uses a background script/event page rather than this package's `background.service_worker`. A separate Firefox manifest can declare `background.scripts: ["background.js"]`; changing that declaration alone does not prove the complete inspection workflow. Keep the current Chrome manifest separate rather than introducing an untested shared manifest. The current collector returns plain serializable data and the report derives its extension origin from `runtime.getURL`, which avoids a hardcoded Chrome extension origin. [Mozilla background documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)

Firefox temporary add-on loading is useful for development, but ends when Firefox restarts. A normal distributable package requires a deliberate extension identifier, current data-collection declarations, signing, and further runtime validation. Do not rename the Chrome ZIP to an XPI or present a temporary debugging install as a finished Firefox release. [Temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/), [signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)

## Safari porting notes

Apple supports the extension's general WebExtension model, including `chrome.*` and Promise APIs, Manifest V3, and session storage in sufficiently recent Safari versions. That is an API assessment, not a Safari test result. The next step is packaging, website-permission checks, scan/rescan and storage-lifecycle validation, then actual report and keyboard checks. [Apple compatibility guidance](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)

The installed environment has Command Line Tools but lacks Xcode and the Safari converter/packager. Apple also documents newer temporary-loading and App Store Connect packaging paths; availability of temporary loading in the installed Safari version has not been verified. App Store distribution requires an owner-controlled Apple Developer account and app identifiers; distribution outside the Mac App Store requires the appropriate signing/notarization path. No account, certificate, app identifier, or signing operation has been created for this assessment. [Safari packaging](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari), [development testing](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension), [App Store Connect packaging](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect), [distribution](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)
