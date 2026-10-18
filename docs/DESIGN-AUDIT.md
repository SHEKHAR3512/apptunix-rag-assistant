# Design-with-intent audit and targeted repair

Mode sequence: Create → Audit → Repair. The installed SKILL.md and its art-direction,
visual-system, web, accessibility, browser-testing, critique and repair references
were read. No other design workflow or component kit was used.

## Baseline evidence

`design-before-edge/320.png`, `768.png`, `1280.png` and `report.json` are actual
browser captures, using Microsoft Edge with the package's capture script.
All three report no horizontal overflow, no console/page errors, and no small
target candidates. These diagnostics are not a complete accessibility audit.

## Findings recorded before repair

1. **High: misleading dependency status.** `/api/health` catches a Chroma native
   module error and reports that Ollama is disconnected. This sends users to the
   wrong recovery action. Separate model connectivity from database startup.
2. **Medium: desktop vertical composition.** At 1280×900 with the setup banner,
   the bottom of the suggestion row falls under the scroll boundary. Reduce
   welcome figure spacing and display size for shorter desktop heights.
3. **Medium: mobile reading size.** Suggestion descriptions and the independent-demo
   disclosure are unnecessarily small at 320px. Raise their sizes while keeping
   the scrollable welcome area and fixed composer usable.
4. **Low: processing visualization.** Three dots communicate activity but do not
   communicate retrieval. Use three linked nodes and activate the relevant node
   based on the actual backend search/write event.

## Repair scope

Preserve ink-blue sidebar, local-system card, custom iconography, two-line title,
native dialog behavior, model settings, all API flows, and reduced-motion support.
Apply only the four changes above, then capture matched widths and run flow tests.

## Contrast measurements

The package's check-contrast.js reports:
- Muted text #637087 on #f7f9fc: 4.74:1.
- White on action #285bd5: 5.92:1.
- Dark-theme secondary #a3b2c8 on #121b29: 8.04:1.

No real screen-reader or physical touch-device test has been performed.
