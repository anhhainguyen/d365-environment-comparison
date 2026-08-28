# Chrome Web Store — Listing Copy

Paste-ready text for the Developer Dashboard. Keep this consistent with
`privacy.html` — Google explicitly warns that discrepancies between the dashboard
disclosures, the privacy policy, and actual extension behaviour can result in
suspension of all items owned by the publisher.

---

## Store listing tab

### Item name
```
D365 Environment Comparison
```

### Summary (132 char limit)
```
Compare Dynamics 365 Finance & Operations data entities and records between two environments, directly in your browser.
```
(118 characters)

### Category
```
Developer Tools
```

### Language
```
English (United States)
```

### Detailed description

```
D365 Environment Comparison helps Dynamics 365 Finance & Operations
consultants, developers, and administrators answer a question that is
otherwise slow and error-prone: what is actually different between two
environments?

Point the extension at a Source and a Target environment, and it lists the
data entities available in each, groups them by application module, and
highlights what exists in one environment but not the other. From there you
can drill into an individual entity and compare the underlying OData records
field by field.

FEATURES

• Compare available data entities between a source and target environment
• Group entities by application module for easier review
• Browse and search the full entity list, then compare a single entity on demand
• Compare OData-backed entity records and see field-level differences
• Configurable row limit so large entities stay responsive
• Export a standalone HTML comparison report you can share or archive
• Full-page mode for working with wide comparison tables

HOW IT WORKS

The extension uses your existing, already-authenticated D365 browser session.
Open both environments in the same Chrome profile, sign in as you normally
would, then run the comparison. There is no separate login, no bearer token to
paste, and no credentials for the extension to store.

All comparison work happens locally in your browser. No environment data is
ever sent to the developer or to any third party.

REQUIREMENTS

• Access to two D365 Finance & Operations environments
• Both environments open and signed in within the same Chrome profile
• Permission to read the data entities you want to compare

PRIVACY

This extension does not collect, sell, or transmit your data. Environment
profiles and preferences are stored locally in your browser only. See the
privacy policy for full details.
```

---

## Privacy practices tab

### Single purpose description

```
This extension has a single purpose: to compare Microsoft Dynamics 365
Finance & Operations data entities and records between two user-selected
environments, and to present those differences to the user inside the browser.
```

### Permission justifications

**`storage`**
```
Used to save the user's environment profiles (a display name and environment
base URL), which profiles are currently selected as Source and Target, and
preferences such as the row limit. It also caches a snapshot of the most
recent comparison so results remain visible when the popup is closed and
reopened. All of this is stored locally via chrome.storage.local and is never
transmitted anywhere.
```

**`scripting`**
```
Used to inject the extension's content script into an already-open D365 tab
when that script is not yet present, for example when the tab was loaded
before the extension was installed or updated. The content script performs the
entity and record requests inside the D365 page so the user's existing
authenticated session is used. Injection is limited to the D365 hosts declared
in host permissions.
```

**Host permission — `https://*.operations.dynamics.com/*`**
```
This is the standard hostname pattern for Dynamics 365 Finance & Operations
environments, including sandbox environments. The extension must read data
entity metadata and OData records from the two environments the user selects
in order to compare them. Access is limited to F&O hosts; no other sites are
accessed.
```

**Host permission — `https://*.cloudax.dynamics.com/*`**
```
This is the alternative hostname pattern used by many Dynamics 365 Finance &
Operations environments. It is required for the same reason as the
operations.dynamics.com pattern: reading entity metadata and OData records
from the user's selected environments so they can be compared.
```

**Remote code**
```
No, I am not using remote code.
```
All JavaScript, CSS, and font files are bundled in the package. The extension
loads nothing from an external server.

### Data usage — what to check

Chrome asks you to declare which categories of data you collect. Based on what
this extension actually does:

| Category | Declare | Reason |
|---|---|---|
| Personally identifiable information | **No** | Not collected |
| Health information | **No** | — |
| Financial and payment information | **No** | Not collected by the extension. D365 records the user compares may contain business financial data, but it is only read and displayed locally, never collected or transmitted. |
| Authentication information | **No** | The extension relies on the browser's existing session cookies. It never reads, stores, or transmits credentials. |
| Personal communications | **No** | — |
| Location | **No** | — |
| Web history | **No** | Tab URLs are matched against the selected environment hostnames to find the right tab. Browsing history is not collected or stored. |
| User activity | **No** | No analytics, no telemetry |
| Website content | **No** | Entity metadata and records are read and rendered locally, and are not collected or transmitted to the developer. |

Then certify all three:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

> If in doubt on any row, prefer the more conservative answer. Under-disclosing
> is treated far more seriously than over-disclosing.

---

## Assets checklist

| Asset | Required | Spec | Status |
|---|---|---|---|
| Store icon | Yes | 128x128 PNG | Have (`icons/icon128.png`) |
| Screenshot | Yes, min 1 | 1280x800 or 640x400 | Only a draft empty state — replace |
| Small promo tile | No | 440x280 | Not created |
| Marquee promo tile | No | 1400x560 | Not created |
| Privacy policy URL | **Yes** | Public URL | **Not yet hosted** |

### Suggested screenshots

1. Entity list loaded, showing module grouping and status badges
2. A single entity comparison with field-level differences visible
3. Module comparison view with source-only / target-only counts
4. The generated HTML report

Blur or use demo data for any customer-identifying values before uploading.
