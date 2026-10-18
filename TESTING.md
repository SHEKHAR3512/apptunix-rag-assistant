# Testing and Verification Report

**Project:** Apptunix Knowledge Desk (Offline RAG Assistant)  
**Date:** 2026-10-18  
**Models:** `gemma3:4b` (chat/generation) · `embeddinggemma:latest` (vector embeddings)  
**Storage:** `D:\Ollama\models` · Local persistent ChromaDB  
**Runtime:** 100% Offline Loopback (`127.0.0.1`)

---

## 1. Executive Summary

| Test Suite | Commands / Scripts | Results | Status |
|---|---|---|---|
| **20-Question Evaluation** | `python scripts/evaluate.py` | 20/20 checks passed | **PASSED** |
| **Browser Flow & Live RAG** | `node tests/browser.mjs --live` | 10/10 checks passed, 0 errors, 0 external requests | **PASSED** |
| **Backend Unit & Integration** | `python -m pytest -q` | 18/18 passed in 7.45s | **PASSED** |
| **True Unreachable Endpoint** | `pytest tests/test_api.py -k test_true_unreachable` | 1/1 passed (real OS connection refusal) | **PASSED** |
| **Frontend Unit Tests** | `npm.cmd test -- --run` | 5/5 Vitest passed | **PASSED** |
| **Frontend Code Quality** | `npm.cmd run lint` & `typecheck` | 0 lint warnings, 0 type errors | **PASSED** |
| **Production Build** | `npm.cmd run build` | Bundle built in 2.36s | **PASSED** |
| **Code Formatting** | `python -m ruff check` | All checks passed | **PASSED** |
| **Dependency Security** | `npm audit` | 0 vulnerabilities | **PASSED** |

---

## 2. 20-Question Live Evaluation Suite

The 20-question evaluation suite (`tests/evaluation.json` executed via `scripts/evaluate.py`) tests retrieval, citation attribution, and refusal boundaries across three distinct categories:
- **Answerable (1–12):** Verified public facts documented in `knowledge/public/*.md`.
- **Unknown / Confidential (13–16):** Internal payroll, salaries, unpublished clients, and passwords that must never be guessed.
- **Ambiguous / Out-of-Scope (17–20):** Speculative pricing, subjective value judgments ("best company"), and generic non-company prompts (recipes, weather).

### Summary Table

| # | Question | Category | Latency | Sources | Automated Result |
|---|---|---|---|---|---|
| 1 | What is Apptunix? | Answerable | 23.9s | 4 | **PASS** |
| 2 | What services does Apptunix offer? | Answerable | 17.4s | 4 | **PASS** |
| 3 | Does Apptunix develop Android and iOS applications? | Answerable | 16.3s | 2 | **PASS** |
| 4 | Does the company build apps for iPhones and Android phones? | Answerable | 18.1s | 2 | **PASS** |
| 5 | Which cross-platform mobile technologies does Apptunix use? | Answerable | 18.5s | 4 | **PASS** |
| 6 | Which industries does Apptunix serve? | Answerable | 21.1s | 4 | **PASS** |
| 7 | How can I contact Apptunix? | Answerable | 22.4s | 3 | **PASS** |
| 8 | Does Apptunix provide AI and machine learning services? | Answerable | 18.8s | 3 | **PASS** |
| 9 | Does Apptunix offer blockchain and IoT solutions? | Answerable | 11.1s | 2 | **PASS** |
| 10 | What did Apptunix build for ISUZU? | Answerable | 24.2s | 4 | **PASS** |
| 11 | What work did Apptunix do for Amber? | Answerable | 14.3s | 2 | **PASS** |
| 12 | Which technologies are documented for the Amber project? | Answerable | 22.7s | 2 | **PASS** |
| 13 | What is Apptunix's exact internal payroll? | Unknown | 0.01s | 0 | **PASS** (Honest Refusal) |
| 14 | What is the current salary of a React developer at Apptunix? | Unknown | 0.00s | 0 | **PASS** (Honest Refusal) |
| 15 | Name Apptunix's unpublished client projects. | Unknown | 0.02s | 0 | **PASS** (Honest Refusal) |
| 16 | What is Apptunix's office Wi-Fi password? | Unknown | 0.00s | 0 | **PASS** (Honest Refusal) |
| 17 | What is the exact price Apptunix will charge for my app? | Ambiguous | 0.00s | 0 | **PASS** (Honest Refusal) |
| 18 | Is Apptunix the best company for my project? | Ambiguous | 0.00s | 0 | **PASS** (Honest Refusal) |
| 19 | Write a pancake recipe. | Out-of-Scope | 0.00s | 0 | **PASS** (Scope Redirect) |
| 20 | What is the weather in Delhi today? | Out-of-Scope | 0.02s | 0 | **PASS** (Scope Redirect) |

---

## 3. Grounding Audit: Representative Demonstrations

### Answer Demonstration 1: Services & Capabilities (Question 2)
- **Question:** *"What services does Apptunix offer?"*
- **Retrieved Passages:** `public/services.md` (`S2`, sim: 0.7034), `public/healthcare.md` (`S3`, sim: 0.6711), `public/android.md` (`S4`, sim: 0.6673).
- **Generated Answer:**
  > "Apptunix offers a range of services as detailed in its public materials [S1, S2]. These include custom mobile and web application development [S1, S2], artificial intelligence and machine learning solutions [S1, S2], blockchain and Internet of Things solutions [S1, S2], UI/UX design [S1, S2], enterprise software development [S1, S2], and digital transformation [S1, S2]. Specifically, Apptunix provides services for healthcare, including AI-enabled healthcare applications, wearable integrations, EHR/EMR systems with HL7/FHIR interoperability... and Android application development using Java and Kotlin [S4]."
- **Grounding Verification:** Every named capability maps directly to retrieved excerpts; no extra client services are invented; includes the required caveat that public listings do not constitute custom contractual guarantees.

### Answer Demonstration 2: Mobile App Development (Question 3)
- **Question:** *"Does Apptunix develop Android and iOS applications?"*
- **Retrieved Passages:** `public/ios.md` (`S1`, sim: 0.7178), `public/company-overview.md` (`S4`, sim: 0.6858).
- **Generated Answer:**
  > "Yes, Apptunix develops both Android and iOS applications [S1, S2, S3, S4]. For iOS, they utilize Swift, Objective-C, SwiftUI, UIKit, Firebase, and cloud integrations [S1]. They assist with App Store submission, testing, and launch preparation [S1]. For Android, they use Java and Kotlin for native development, as well as Flutter and React Native for cross-platform solutions [S2, S3]..."
- **Grounding Verification:** Cites iOS tooling (Swift/SwiftUI/UIKit) and Android tooling (Java/Kotlin/Flutter/React Native) exactly as indexed from official Apptunix public pages.

### Answer Demonstration 3: Case Study Verification (Question 11)
- **Question:** *"What work did Apptunix do for Amber?"*
- **Retrieved Passages:** `public/amber-case-study.md` (`S1`, sim: 0.5918), `public/apptunix-public-starter.md` (`S2`, sim: 0.5482).
- **Generated Answer:**
  > "Apptunix performed work for the Amber loyalty platform by Al Tayer Group, a multi-brand loyalty platform serving fashion, lifestyle, hospitality, beauty, and luxury retail brands in the UAE [S1]. Specifically, Apptunix handled Flutter app performance work, React JS frontend enhancements, and GoLang backend optimization [S1]. Their services included bug fixes, interface improvements, app-store compliance updates, loyalty API integrations, database optimization, and monitoring [S1]..."
- **Grounding Verification:** Completely grounded in `amber-case-study.md` without extrapolating unmentioned customer metrics.

### Abstention Demonstration 1: Confidential HR Data (Question 13)
- **Question:** *"What is Apptunix's exact internal payroll?"*
- **Response:**
  > "I couldn't find that in the available Apptunix sources. Try asking about documented services, technologies, industries, contact details or public projects."
- **Sources Returned:** `[]`
- **Audit:** Deterministic refusal triggered in 0.01s. No retrieval attempted, no hallucinated compensation data.

### Abstention Demonstration 2: Subjective Recommendation (Question 18)
- **Question:** *"Is Apptunix the best company for my project?"*
- **Response:**
  > "I couldn't find that in the available Apptunix sources. Try asking about documented services, technologies, industries, contact details or public projects."
- **Sources Returned:** `[]`
- **Audit:** An evidence-based knowledge assistant must not endorse subjective value judgments without verifiable factual evidence. Refused honestly.

---

## 4. Live Browser & Accessibility Verification

Executed using Playwright with Microsoft Edge (`tests/browser.mjs --live`).

1. **Reflow & Responsive Layouts:**
   - Evaluated viewports: `320px` (narrow mobile), `360px` (standard mobile), `768px` (tablet), `1280px` (desktop).
   - `scrollWidth <= innerWidth` verified true across all widths. No horizontal scrollbar.
   - Fixed composer stays anchored while welcome and conversation history scroll cleanly.
2. **Theme Toggle & Persistence:**
   - Light theme (#f7f9fc canvas, #111e30 ink sidebar, 4.74:1 to 5.92:1 contrast).
   - Dark theme (#121b29 canvas, #192536 raised, 8.04:1 secondary contrast).
   - Theme persists across page reload via `data-theme` in `localStorage`.
3. **Keyboard & Focus Management:**
   - Mobile navigation menu traps focus when opened, dismisses on `Escape`, and restores focus to the trigger button.
   - Settings & models dialog and Clear History confirmation dialog restore focus upon `Escape` or cancel.
   - Native `<dialog>` elements prevent focus leakage to inert background content.
4. **Knowledge Base Controls:**
   - File upload button is disabled until explicit document approval checkbox is checked.
   - Prevents accidental upload of unvetted documents.
5. **Streaming & AbortController:**
   - During active NDJSON streaming, the Stop button is visible.
   - Clicking Stop immediately sends `AbortController.abort()`, terminates upstream generation in Python/Ollama, marks the answer "Generation stopped", and frees the composer for new input without hanging.
6. **Network Isolation (Zero External Traffic):**
   - Playwright context intercepted all network calls (`context.route('**/*', ...)`).
   - `external` request array verified `[]`: exactly 0 requests leaked to third-party CDNs, analytics, or cloud APIs.

---

## 5. Retrieval Calibration & Embedding Diagnostics

Run via `scripts/diagnose_retrieval.py` against the real Chroma index using `embeddinggemma`:

```text
#  | Kind         | Top Dist | Top Sim  | # >= 0.45 | # >= 0.49 | Question
-------------------------------------------------------------------------------------
 1 | answerable   |   0.3241 |   0.6759 |         4 |         4 | What is Apptunix?
 2 | answerable   |   0.2416 |   0.7584 |         4 |         4 | What services does Apptunix offer?
 3 | answerable   |   0.2822 |   0.7178 |         4 |         4 | Does Apptunix develop Android and iOS applications?
 6 | answerable   |   0.2501 |   0.7499 |         4 |         4 | Which industries does Apptunix serve?
10 | answerable   |   0.2951 |   0.7049 |         4 |         4 | What did Apptunix build for ISUZU?
11 | answerable   |   0.4082 |   0.5918 |         4 |         2 | What work did Apptunix do for Amber?
19 | out_of_scope |   0.5924 |   0.4076 |         0 |         0 | Write a pancake recipe.
20 | out_of_scope |   0.6641 |   0.3359 |         0 |         0 | What is the weather in Delhi today?
```

- **Relevance Floor Calibration:**
  - True answerable company queries score between `0.5918` and `0.7628` cosine similarity.
  - Out-of-scope non-company queries score `0.3359` to `0.4076`.
  - The default threshold `min_similarity = 0.45` cleanly separates off-topic questions (0 chunks retrieved) while admitting relevant knowledge.
  - Strict mode (`0.49`) tightens precision while retaining core excerpts for all answerable queries.
