# Session Synchronizer Chrome Extension

This Chrome extension allows users to synchronize sessions for a specific website among all users who have installed the extension.

## How It Works

The extension shares cookies and session data for a configured domain between all users who have installed this extension and configured it for the same domain.

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the directory containing this extension
5. The extension should now appear in your Chrome toolbar

## Usage

1. Click on the extension icon in the Chrome toolbar
2. Enter the domain of the website you want to synchronize (e.g., "example.com")
3. Toggle the "Enable Synchronization" switch to ON
4. Click "Save Settings"
5. Now, when you or any other user with the extension visits the website, your session data will be shared

## Important Notes

- All users need to have the extension installed and configured for the same domain
- The extension uses Chrome's sync storage, which has limitations on the amount of data that can be stored (max 100KB)
- For security reasons, be careful about which websites you choose to synchronize, as session data may contain sensitive information

## Features

- Synchronizes cookies for a specified domain
- Updates session data in real-time when changes are detected
- Simple user interface to configure which domain to synchronize

## Directory Structure

```
session-synchronizer/
├── manifest.json       # Extension configuration
├── background.js       # Background script for session handling
├── popup.html          # User interface
├── popup.js            # UI interaction logic
└── images/             # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Creating Icons

You need to create and add icon files in the `images` directory with sizes 16x16, 48x48, and 128x128 pixels. 