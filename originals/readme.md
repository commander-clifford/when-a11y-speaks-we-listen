# Image Alt Text Inspector Chrome Extension

## Overview

The Image Alt Text Inspector is a Chrome extension that scrapes images within `<article>` tags from the currently open webpage, including their alt text, and displays them on a new page. This tool is especially useful for web developers, SEO specialists, and accessibility auditors to quickly assess and inspect the usage of images and their alternative texts on web pages.

## Features

- **Targeted Image Scraping**: Extracts images that are specifically children of `<article>` tags, ensuring relevance to the main content.
- **Alt Text Display**: Collects and displays the alt text of each image, aiding in accessibility and SEO audits.
- **Clickable Image Cards + Modal Viewer**: Each image card opens into a centered modal with blurred backdrop, larger image preview, readable metadata, and previous/next carousel navigation.
- **Easy Activation**: Can be activated via a simple click on the extension icon or a keyboard shortcut (CMD+SHIFT+I for macOS, CTRL+SHIFT+I for Windows/Linux).
- **Lazy-loaded Image Handling**: Scrolls through the entire page to trigger the loading of lazy-loaded images before scraping.

## Installation

1. **Download the Extension**: Clone this repository or download it as a ZIP file and extract it to a preferred location on your local machine.
2. **Load the Extension in Chrome**:
    - Open Chrome and navigate to `chrome://extensions/`.
    - Enable Developer Mode by toggling the switch in the upper right corner.
    - Click "Load unpacked" and select the folder containing the extension files.
3. **Verify Installation**: Ensure that the "Image Alt Text Inspector" extension is visible in your Chrome extensions list and is enabled.

## Usage

### Via Extension Icon

- Navigate to the webpage you want to inspect.
- Click on the "Image Alt Text Inspector" extension icon in the Chrome toolbar.
- A new tab will open, displaying all images from the page along with their alt text and metadata. Click any image card to open the larger modal viewer.

### Using Keyboard Shortcut

- Ensure you're focused on the browser window.
- Activate the extension by pressing CMD+SHIFT+I (macOS) or CTRL+SHIFT+I (Windows/Linux).
- A new tab will display the images and their alt text details as described above.

## Customization

You can customize the keyboard shortcut by navigating to `chrome://extensions/shortcuts` in Chrome and modifying the shortcut for the "Image Alt Text Inspector" extension.

## Support

For any issues, questions, or suggestions, please open an issue in the GitHub repository for this extension. Your feedback helps make this tool better for everyone.

## Contributing

Contributions are welcome! If you have improvements or bug fixes, please open a pull request or issue. Ensure your changes are well-documented and follow the existing code style.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.
