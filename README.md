# D365 Environment Compare

Chrome extension for comparing Microsoft Dynamics 365 Finance & Operations data entities and records across environments.

## Features

- Compare available entities between a source and target environment
- Group entities by application module
- Compare selected OData-backed entity records
- Export an HTML comparison report
- Reuse the current authenticated D365 browser session

## Local Development

1. Open Chrome and go to `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select this folder

## Building the Store Package

```powershell
pwsh -File .\build-package.ps1
```

This validates `manifest.json`, checks icon dimensions, warns about remote
resource references, and writes `dist/d365-env-comparison-<version>.zip`
containing only the files Chrome needs. Upload that zip in the
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## Files

- `manifest.json`: Chrome extension manifest
- `popup.html`: extension UI
- `popup.js`: compare logic
- `content.js`: fetches data from the active D365 tab using the browser session
- `background.js`: opens the full-page view
- `build-package.ps1`: validates and packages the extension for store upload
- `icons/`: Chrome extension icons
- `fonts/`: bundled Inter and JetBrains Mono woff2 subsets (no external font requests)
- `privacy.html`: privacy policy page for Chrome Web Store submission

## Privacy

The extension reads data from user-selected D365 environments only to perform comparisons inside the browser. It stores saved profiles and selections locally in the browser.

See `privacy.html` for the full privacy policy. The Chrome Web Store requires a
**publicly reachable** privacy policy URL — publish `privacy.html` via GitHub
Pages (or equivalent) and enter that URL in the Developer Dashboard.

## License

This project is provided as-is unless a separate license is added.