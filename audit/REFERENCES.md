# Primary references used in the review

Checked September 8, 2026. These establish requirements and explain risks; implementation outcomes are recorded separately in test evidence.

- [Chrome: local extension loading](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
- [Chrome: activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) and [permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome: content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome: service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome: messaging/security boundaries](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Chrome: storage/session lifecycle and quotas](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Chrome: extension CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [W3C CSP: local-scheme documents inherit policy](https://www.w3.org/TR/CSP3/#security-inherit-csp)
- [Chrome: DevTools keyboard shortcuts](https://developer.chrome.com/docs/devtools/shortcuts) and [extension commands](https://developer.chrome.com/docs/extensions/reference/api/commands)
- [W3C: decorative images](https://www.w3.org/WAI/tutorials/images/decorative/) and [alt decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/)
- [W3C: WCAG 2.2](https://www.w3.org/TR/WCAG22/), [focus visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), [Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html)
- [W3C APG: modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- [W3C: forced-colors behavior](https://www.w3.org/TR/css-color-adjust-1/#forced-colors-properties)
- [Chrome DevTools Protocol: isolated extension test APIs](https://chromedevtools.github.io/devtools-protocol/tot/Extensions/)
- [Spectrum Web Components](https://opensource.adobe.com/spectrum-web-components/) and [theme](https://opensource.adobe.com/spectrum-web-components/tools/theme/)

Review inference: raw attributes and automated focus checks cannot establish a universal screen-reader or accessibility-conformance verdict. That limitation follows from the distinction between attribute evidence, accessible-name computation, context and actual assistive-technology behavior.
