# Contributing to Cadence — YouTube Transcript & Bilingual Subtitles

Thank you for your interest in contributing to **Cadence**! 🎉

Whether you are fixing a bug, adding support for a new subtitle format, optimizing translation throughput, or improving documentation, your contributions are sincerely appreciated. This project is created and maintained by [Shakib Khan (`@ichshakib`)](https://github.com/ichshakib).

---

## Table of Contents

- [Project Architecture](#project-architecture)
- [Prerequisites](#prerequisites)
- [Local Setup & Getting Started](#local-setup--getting-started)
- [Development Workflow](#development-workflow)
- [Available Scripts](#available-scripts)
- [Coding Standards & Guidelines](#coding-standards--guidelines)
  - [Pure Vanilla CSS (No Tailwind / No External CSS Frameworks)](#pure-vanilla-css-no-tailwind--no-external-css-frameworks)
  - [YouTube Theme Adaptation](#youtube-theme-adaptation)
  - [Strict TypeScript Standards](#strict-typescript-standards)
  - [Manifest V3 & Isolation Rules](#manifest-v3--isolation-rules)
- [Testing & Quality Verification](#testing--quality-verification)
- [Pull Request Process](#pull-request-process)
- [Code of Conduct](#code-of-conduct)
- [Contact](#contact)

---

## Project Architecture

The repository is organized into two primary components:

```text
cadence/
├── chrome-extension/              # Manifest V3 Chrome Extension
│   ├── src/
│   │   ├── background/            # Service worker (Google Translate GTX batch translation)
│   │   ├── content/               # Content scripts & in-page UI
│   │   │   ├── hooks/             # YouTube theme observation hooks (useYouTubeTheme)
│   │   │   ├── views/             # React views (App, Transcript, TranscriptActionButton, VideoOverlay)
│   │   │   ├── main.tsx           # Content script entry point & DOM injection logic
│   │   │   ├── pageContext.ts     # MAIN world script (interfacing with ytInitialPlayerResponse)
│   │   │   ├── panelState.ts      # Shared visibility state between button & panel
│   │   │   ├── transcriptService.ts # Extraction, SRT/VTT parser, and translation pipeline
│   │   │   └── types.ts           # Shared TypeScript interfaces
│   │   ├── popup/                 # Browser toolbar action popup
│   │   └── sidepanel/             # Chrome side panel companion UI
│   ├── public/
│   │   ├── icons/                 # Extension icons (16, 32, 48, 128 px)
│   │   └── logo.svg               # Official Cadence vector logo
│   ├── manifest.config.ts         # Chrome Manifest V3 configuration (@crxjs/vite-plugin)
│   ├── vite.config.ts             # Vite build & CRX packaging configuration
│   └── package.json               # Extension dependencies and scripts
├── assets/                        # Official landing page assets
│   ├── css/style.css              # Landing page styling
│   ├── js/main.js                 # Landing page interactive transcript simulator
│   └── images/                    # Landing page media & favicon_io set
├── index.html                     # Standalone official landing page
├── .github/                       # CI/CD workflows and issue/PR templates
├── CODE_OF_CONDUCT.md             # Community standards
├── CONTRIBUTING.md                # This guide
├── LICENSE                        # MIT License
└── README.md                      # Project documentation
```

- **`chrome-extension/`**: The core Chrome extension powered by React 19, TypeScript, and Vite.
- **Standalone Showcase (`index.html`, `assets/`)**: A responsive landing page with an interactive live transcript demo.

---

## Prerequisites

Before starting development, ensure you have the following installed:

- **Node.js**: `v20.0.0` or higher
- **pnpm**: `v9.0.0` or higher (recommended package manager)
  ```bash
  npm install -g pnpm
  ```
- **Google Chrome** (or any Chromium-based browser such as Brave or Edge) with Developer Mode enabled.

---

## Local Setup & Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/ichshakib/cadence.git
cd cadence
```

### 2. Install Extension Dependencies

Navigate to the `chrome-extension` directory and install the project dependencies:

```bash
cd chrome-extension
pnpm install
```

### 3. Start Development Mode (HMR)

```bash
pnpm dev
```

Vite and the CRXJS plugin will compile the extension into `chrome-extension/dist` and watch for changes with Hot Module Replacement (HMR).

### 4. Load Unpacked Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **"Developer mode"** in the top-right corner.
3. Click **"Load unpacked"** in the top-left.
4. Select the `chrome-extension/dist` directory.
5. Navigate to any YouTube video (e.g. `https://www.youtube.com/watch?v=...`).
6. You will see the Cadence **"Transcript"** button in the action bar under the video!

---

## Available Scripts

From the `chrome-extension/` directory:

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Starts Vite in watch/development mode with HMR for content scripts and popup. |
| `pnpm build` | Runs TypeScript compiler (`tsc -b`) and Vite production build, creating `dist/` and packaging a ZIP in `release/`. |
| `pnpm preview` | Previews the built extension bundle. |

---

## Coding Standards & Guidelines

### Pure Vanilla CSS (No Tailwind / No External CSS Frameworks)

- Use Vanilla CSS for all UI components. Avoid introducing Tailwind CSS, bootstrap, or external utility frameworks.
- Use CSS custom properties (`--banner-bg`, `--banner-accent`, `--banner-text-primary`) defined in `App.css`.

### YouTube Theme Adaptation

- Cadence must look like a native YouTube component in both YouTube Light Theme and YouTube Dark Theme.
- Use the `useYouTubeTheme` hook and respect `[data-theme="light"]` and `[data-theme="dark"]` scopes.

### Strict TypeScript Standards

- TypeScript is configured with strict mode.
- Avoid using `any` wherever possible. Define explicit interfaces in `types.ts`.
- Ensure all imports use modern ESM and include `.ts` / `.tsx` extensions when needed.

### Manifest V3 & Isolation Rules

- **MAIN World vs ISOLATED World**: YouTube's `playerResponse` is accessed in the MAIN world via `pageContext.ts`. Communication between the MAIN world and the content script MUST occur strictly via `CustomEvents` (`CADENCE_REQUEST_PLAYER_DATA`, `CADENCE_FETCH_TRACK`).
- **No Simulated Clicks**: Cadence NEVER simulates clicks on YouTube's native buttons or causes native YouTube panels to flicker or open unexpectedly.

---

## Testing & Quality Verification

Before submitting a pull request:

1. **Verify TypeCheck & Build:**
   ```bash
   cd chrome-extension
   pnpm build
   ```
   Ensure the command exits with code `0` and generates zero warnings.

2. **Manual Test Scenarios:**
   - Test standard YouTube watch page (`/watch?v=...`).
   - Test video with creator closed captions vs auto-generated (ASR) captions.
   - Test video without captions by dragging & dropping an SRT/VTT file or pasting text.
   - Test SPA navigation: click another video recommendation and verify the panel updates cleanly.
   - Test switching translation languages and verify dual-row bilingual rendering.

---

## Pull Request Process

1. Fork the repository and create a new feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Commit your changes with meaningful Conventional Commits (e.g. `feat:`, `fix:`, `docs:`, `perf:`).
3. Ensure your branch is rebased onto the latest `main` branch:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
4. Push your branch to your fork:
   ```bash
   git push origin feat/your-feature-name
   ```
5. Open a Pull Request against `main`. Fill in the PR template completely with screenshots or testing instructions.

---

## Code of Conduct

Please note that this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By contributing, you are expected to uphold these standards.

---

## Contact

- **Author & Maintainer:** Shakib Khan ([@ichshakib](https://github.com/ichshakib))
- **Email:** [ichshakib@gmail.com](mailto:ichshakib@gmail.com)
- **GitHub Discussions:** [github.com/ichshakib/cadence/discussions](https://github.com/ichshakib/cadence/discussions)
- **Issue Tracker:** [github.com/ichshakib/cadence/issues](https://github.com/ichshakib/cadence/issues)
