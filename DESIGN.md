---
schema_version: 1
product: "Apptunix Knowledge Desk"
audience: "Developers and prospective clients exploring documented company capabilities"
primary_task: "Ask a question and inspect its supporting source passage locally"
mode: "repair"
facts:
  - "Independent demo, not official Apptunix support"
  - "React, custom CSS, native animation; no component kit or external runtime fonts"
  - "design-with-intent is the only design methodology"
assumptions:
  - "Desktop reading is primary; mobile retains all controls"
preserve:
  - "Local model/retrieval architecture, source dates and honest system status"
  - "Ink-blue navigation and restrained blue action system"
direction:
  summary: "An evidence desk: calm reading canvas, compact archive, visible question-to-source path"
  rationale: "Inspecting evidence deserves equal clarity to reading a generated answer"
token_source: "frontend/src/styles/tokens.css"
responsive_rules:
  - "320–760px: focus-managed off-canvas navigation, two-column suggestions, fixed composer"
  - "761–1100px: compact sidebar, two-column suggestions"
  - "1101px+: persistent sidebar, four suggestions, constrained reading measure"
required_states:
  - "Welcome, searching, writing, complete, stopped, empty index, model failure, upload approval, indexing, partial failure"
references:
  - "User brief and official public company content"
  - "Installed design-with-intent Create, Audit and Repair workflows"
rejected_options:
  - "Editorial company brochure: hides repeat questions and source inspection"
  - "Decorative neon orb: competes with reading without explaining retrieval"
verification:
  performed:
    - "Rendered desktop/mobile screenshots inspected across light/dark themes"
    - "No horizontal overflow at 320, 360, 768, 1280"
    - "Keyboard menu/dialog focus, themes, history and error recovery tested in Edge"
    - "Contrast: light muted 4.74:1; action text 5.92:1; dark muted 8.04:1"
    - "Playwright live browser suite passed: real streaming RAG, expandable citation modals, Stop generation abort, 0 external requests"
    - "20/20 live Q&A evaluation harness passed using real local gemma3:4b and embeddinggemma"
    - "18 backend pytest tests passed including true unreachable local endpoint error recovery"
    - "Frontend Vitest (5/5), TypeScript typecheck, ESLint (0 errors) and production build verified"
  not_performed:
    - "Physical mobile devices and real screen-reader software"
    - "Formal WCAG conformance or human usability study"
---

# Design decisions

Initialized with `npx design-with-intent`, installed for Codex, and generated the
Create brief. Read its full SKILL.md and art direction, visual systems, web,
browser testing, accessibility, critique, records and repair references. Invoked
Audit and Repair prompts after implementation. The CLI prepares agent guidance;
it does not automatically generate or certify the design.

## Directions considered in Create

| Axis | Editorial company guide | Evidence workspace (chosen) |
| --- | --- | --- |
| First impression | Company narrative | Question and supporting evidence |
| Composition | Wide introduction and topic chapters | Archive sidebar, centered reading area, nearby composer |
| Type | Large narrative sections | Clear display, compact navigation, quiet metadata |
| Signature | Capability map | Friendly node assistant and question → sources → answer path |
| Tradeoff | More introduction, slower repeat use | Faster questions and source inspection |

## Visual system

- Local typography: Segoe UI Variable / Segoe UI / Arial; Cascadia Code / Consolas
  for IDs. Display 34–54px, body 14px with generous line height. No font CDN.
- Ink navigation #111e30; paper #f7f9fc; raised white; text #18283f;
  secondary #637087; action #285bd5. Dark canvas #121b29, raised #192536,
  text #e5ebf5 and action #8daeff.
- 264px sidebar, 76px header, 920px content maximum. Source chips are subordinate
  to the answer. Prompt cards receive more space than utility actions.
- CSS/SVG assistant greets pointer entry through Web Animations API. The live
  retrieval map reacts to real backend events; no fabricated percentages.
- 180–220ms transitions and short message entrances. System and user reduced-motion
  settings suppress animation. Status always has a text label.
- Source dialogs preserve complete passages, collection dates and optional original
  website links. Native dialogs provide keyboard containment and Escape dismissal.

## Audit and Repair

See `docs/DESIGN-AUDIT.md`. Repairs reduced desktop vertical crowding, enlarged
mobile descriptions, separated database/model errors and replaced generic dots
with a retrieval-node indicator. Browser tests caught and fixed focus restoration
under React StrictMode. The established composition and API behavior were preserved.

Evidence: `docs/design-before-edge`, `docs/design-after`, `docs/browser`.
The mobile welcome deliberately scrolls above the fixed composer; all questions
remain reachable without shrinking the entire page into a single viewport.
