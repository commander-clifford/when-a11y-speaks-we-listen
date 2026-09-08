# Image Alt Text Inspector Chrome Extension

## Overview

The Image Alt Text Inspector is a Chrome extension that scrapes images from the currently open webpage, collects their alt text, and opens a styled results view in a new tab. This build includes the newer visual presentation layer plus page-level metadata such as title, description, canonical URL, Open Graph, and Twitter tags.

This is useful for accessibility reviews, SEO audits, and quick image inventory checks.

## Included in this build

- Expands hidden or collapsed content before scraping
- Scrolls to trigger lazy-loaded media
- Waits for images to finish loading
- Captures all page images
- Displays alt text, filename, and source URL for each image
- Surfaces page metadata including title, description, canonical, OG, and Twitter tags
- Uses packaged CSS for the updated visual layout

## Installation

1. Unzip this package.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the `image-alt-text-inspector` folder.

## Usage

- Open any page you want to inspect.
- Click the extension icon.
- Or use:
  - **Ctrl+Shift+I** on Windows/Linux
  - **Command+Shift+I** on macOS
- A new tab opens with the image audit view.

## Files

- `manifest.json`
- `background.js`
- `contentScript.js`
- `styles/inspector.css`
- `icons/`

## Notes

- This package reflects the latest uploaded script variant that includes the visual/meta changes.
- If you want, a follow-up package can include the legacy script variants too.
