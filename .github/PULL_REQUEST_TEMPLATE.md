## Summary
<!-- Provide a concise summary of the purpose and changes introduced in this pull request. -->

## Related Issues
<!-- Link relevant issues using keywords (e.g., "Fixes #12", "Closes #34"). -->

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change fixing an identified issue)
- [ ] ✨ New feature (non-breaking change adding new capability)
- [ ] 🎨 UI / UX refinement (visual styling, layout, or animations)
- [ ] ⚡ Performance optimization (parsing, memory, or translation speed)
- [ ] ♻️ Refactoring (code reorganization without functional alteration)
- [ ] 📝 Documentation update (README, guides, or docstrings)
- [ ] 🔧 Build / CI tooling update

## Component Scope
- [ ] **Content Script (`main.tsx`):** In-page injection, SPA navigation listeners, or DOM targeting
- [ ] **Transcript Panel (`Transcript.tsx`):** Transcript rows, search filter, language selection, or playback sync
- [ ] **Action Button (`TranscriptActionButton.tsx`):** Placement in YouTube action bar, tooltip, or toggle state
- [ ] **Video Player Subtitle Overlay (`VideoOverlay.tsx`):** Synced subtitle display on the YouTube player, positioning, or fullscreen styling
- [ ] **Extraction & Translation Service (`transcriptService.ts`):** Caption track detection, JSON/XML parsing, or translation batching
- [ ] **Page Context Script (`pageContext.ts`):** YouTube `playerResponse` interception in MAIN world
- [ ] **Background Service Worker (`src/background/`):** Google Translate GTX API messaging
- [ ] **Extension Configuration:** `manifest.config.ts`, permissions, or icons
- [ ] **Showcase Landing Page:** `index.html`, `assets/css/style.css`, or `assets/js/main.js`

## Compliance & Quality Checklist
- [ ] **Pure Vanilla CSS:** No Tailwind CSS or external CSS utility frameworks introduced.
- [ ] **Theme Adaptation:** Seamlessly adapts to YouTube Dark and Light themes via `useYouTubeTheme`.
- [ ] **Strict TypeScript:** No unhandled or implicit untyped `any`; proper interfaces maintained.
- [ ] **Privacy Preserving:** Processing remains client-side; no tracking or telemetry.
- [ ] **Build Verification:** Tested locally using `pnpm build` in `chrome-extension/` with 0 errors.
- [ ] **Extension Testing:** Manually verified on live YouTube watch pages via `chrome://extensions/` (Load unpacked).

## Screenshots / Screen Recordings
<!-- For UI or visual changes, attach screenshots or short video recordings demonstrating the result. -->

## Testing Instructions
<!-- Step-by-step instructions for maintainers to verify and test your changes:
1. Load unpacked extension from `chrome-extension/dist`.
2. Navigate to https://www.youtube.com/watch?v=...
3. Perform [action]
4. Verify [expected result]
-->
