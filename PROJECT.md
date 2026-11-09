# Project: Unified Question Bank & Master Question Shooter (Tirador Maestro)

## Architecture
- **Data & Normalization Layer (`src/lib/bancoUnificado.js`)**:
  - Ingests the 4 question pools: `desgloses_filtrables.json` (3,535), `simulacros_textos.json` / `simulacrosCTO.json` (3,990), `evaluaciones_cto.json` (1,409), and `bancoPreguntas.json` (5,660).
  - Deduplication Engine: Two-stage deduplication combining exact cross-pool ID matches (1,956 merges) and normalized statement + options fingerprinting (221+ merges), eliminating the ~2,376 duplicate instances while preventing false clinical vignette collisions.
  - Metadata Fusion: Fuses official MIR convocatoria years, CTO failure flags (`fallada_o_blanca`), population difficulty percentage (normalized $0-100\%$) and P80 difficulty brackets (B1 $\ge 70\%$, B2 $50-69\%$, B3 $35-49\%$, B4 $< 35\%$), granular subject/theme/subtheme taxonomy, and complete `aliasIds` tracking.
  - Unified Bank API: `getPreguntas()`, `getPreguntaPorId(id)`, `filtrarPreguntas(filtros)`, `getCanonicalId(aliasId)`, `getStatsResumen()`.
- **Reactive State & Storage Layer (`src/hooks/usePreguntasStats.js`, `src/utils/tiradaStorage.js`)**:
  - Canonical ID resolver in `usePreguntasStats.js`: resolves any historical or alias ID to its canonical question ID.
  - Unified response recording in `mir_banco_preguntas_stats` avoiding double-counting.
  - Tirada export and event dispatching (`mir_tirada_saved`, `guardarTiradaParaChat`).
- **Presentation & Navigation Layer (`src/screens/TiradorMaestro.jsx`, `src/components/Navbar.jsx`, `src/App.jsx`)**:
  - `Navbar.jsx`: Unifies 3 previous tabs (`desgloses`, `quiz`, `adaptativo`) into 1 single tab: `{ id: 'preguntas', label: 'Tirador de Preguntas', Icon: IcoQuiz }`.
  - `App.jsx`: Renders `TiradorMaestro` for `tab === 'preguntas'`, and transparently forwards alias navigation from `'desgloses'`, `'quiz'` and `'adaptativo'` with preselected filter states.
  - `TiradorMaestro.jsx`: Unified master question screen supporting:
    - Mode Presets: Motor 1 (Mañana 75p), Motor 2 (Tarde 75p), Motor 3 (Mixto P80 con Pregunta Hermana), Modo Adaptativo (rentabilidad + cooldown), Tirada Libre.
    - Faceted Filters: Fuente (MIR, Simulacro, Evaluación, Test 2V, Todas), Horquilla P80 (B1, B2, B3, B4, Todas), Estado Personal (Vírgenes, Falladas, Acertadas, En Latencia, Todas), Asignatura, Tema, Subtema.
    - Tutor Mode vs Exam Mode, interactive question review, tirada export for pedagogical chat correction.

## Code Layout
- `src/lib/bancoUnificado.js`: In-memory Unified Question Bank singleton and query API.
- `src/screens/TiradorMaestro.jsx`: Unified Master Question Shooter component.
- `src/components/Navbar.jsx`: Single navigation tab for questions.
- `src/App.jsx`: Master route handling and backward-compatible alias redirections.
- `src/hooks/usePreguntasStats.js`: Alias-aware stats tracking and canonical ID lookup.
- `src/utils/tiradaStorage.js`: Tirada persistence and export utilities.
- `tests/banco_unificado.test.mjs`: Unit tests for deduplication and metadata fusion.
- `tests/e2e_tirador_unificado.test.mjs`: E2E requirement tests (Tiers 1-4).
- `tests/run_all_tests.mjs`: Global test runner orchestrating all test suites.
- `TEST_INFRA.md`, `TEST_READY.md`: Test infrastructure documentation and acceptance signaling.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Raw Data Ingestion & Fingerprinting | Normalize statement and options text, compute stable fingerprints across the 4 data pools (14,594 raw questions) | M1 | Survey 1 / R2, R3 |
| 2 | Safe Multi-Stage Deduplication | Eliminate ~2,376 duplicate instances combining exact ID matches and verified text/options matches while preventing false collisions on clinical vignettes | M1 | Survey 1 / R2, R3 |
| 3 | Metadata Fusion Engine | Fuse official MIR year, CTO failure status, population difficulty % (P80 brackets B1-B4), granular taxonomy (subtema), and compile complete `aliasIds` list | M1 | Survey 1 / R3 |
| 4 | Unified Bank Query API | Export `getPreguntas`, `getPreguntaPorId`, `filtrarPreguntas`, `getCanonicalId`, `getStatsResumen` from `src/lib/bancoUnificado.js` | M1 | Survey 1 / R3 |
| 5 | Alias-Aware State & Storage Integration | Update `usePreguntasStats.js` and `tiradaStorage.js` so stats and history resolve transparently through `getCanonicalId` without double-counting | M1 | Survey 1, 3 / R3 |
| 6 | Master Question Shooter Component | Build `src/screens/TiradorMaestro.jsx` subsuming `Desgloses.jsx`, `BancoPreguntas.jsx`, and `EstudioAdaptativo.jsx` with full motor and filter support | M2 | Survey 2 / R1 |
| 7 | Faceted Filter Bar | Implement filters by Fuente (MIR, Simulacro, Evaluación, 2V), Horquilla P80 (B1-B4), Estado Personal (Vírgenes, Falladas, Acertadas, Latencia), and Asignatura/Tema | M2 | Survey 2 / R1 |
| 8 | Mode Presets & Tutor/Exam Modes | Support Motor 1, Motor 2, Motor 3 (sister questions + orphan quota), Modo Adaptativo, and Custom Tirada with Tutor and Exam modes | M2 | Survey 2 / R1 |
| 9 | Single Tab in Navbar | Update `Navbar.jsx` to replace 3 tabs with `{ id: 'preguntas', label: 'Tirador de Preguntas', Icon: IcoQuiz }` | M2 | Survey 2 / R1 |
| 10 | Backward-Compatible Alias Redirection | Update `App.jsx` to route `'desgloses'`, `'quiz'`, `'adaptativo'` to `TiradorMaestro` with appropriate preselected filters without breaking any external button | M2 | Survey 2 / R1 |
| 11 | Opaque-Box E2E Test Suite (Tiers 1-4) | Comprehensive requirement-driven test suite covering counts, deduplication, metadata, filters, navigation, and real workflows; publish `TEST_READY.md` | E2E Track | Survey 3 / R4 |
| 12 | Final E2E Pass & Adversarial Hardening | Pass 100% of E2E tests (Phase 1) + Tier 5 adversarial stress testing (Phase 2) + clean `npm run build` | M3 | Survey 3 / R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Unified Question Bank Engine & State Integration | Features 1, 2, 3, 4, 5: Ingest pools, multi-stage deduplication, metadata fusion, API export, alias-aware stats integration, and unit tests | none | DONE |
| M2 | Master Question Shooter & Navigation Unification | Features 6, 7, 8, 9, 10: Build `TiradorMaestro.jsx`, update `Navbar.jsx`, implement alias routing in `App.jsx`, preserve all incoming links | M1 | DONE |
| E2E | E2E Testing Suite & Infrastructure | Feature 11: Design and implement opaque-box tests (Tiers 1-4) in `tests/e2e_tirador_unificado.test.mjs`, publish `TEST_READY.md` | M1 & M2 contracts | DONE (TEST_READY) |
| M3 | Final Verification, Adversarial Hardening & Build | Feature 12: Pass 100% E2E tests, Tier 5 adversarial hardening, verify clean `npm run build` | M2, E2E | IN_PROGRESS |

## Interface Contracts

### `src/lib/bancoUnificado.js` API Contract
- `getPreguntas(options?: { fuente?: string, asignatura?: string, tema?: string, p80Bracket?: string, soloFalladas?: boolean })`:
  Returns array of canonical Question objects.
- `getPreguntaPorId(id: string)`:
  Returns canonical Question object matching `id` or any alias in `aliasIds`, or `null`.
- `getCanonicalId(id: string)`:
  Returns the canonical question ID string for any given `id` (or the `id` itself if already canonical).
- `filtrarPreguntas(filtros: { fuentes?: string[], asignatura?: string, tema?: string, subtema?: string, horquillaP80?: string[], estadoPersonal?: string, soloFalladas?: boolean })`:
  Returns filtered array of canonical Question objects.
- `getStatsResumen()`:
  Returns `{ totalRaw: 14594, totalCanonicas: number, totalDuplicadosEliminados: number, porFuente: { ... } }`.

### Canonical Question Object Schema
```javascript
{
  id: string,               // Canonical UUID or primary ID
  aliasIds: string[],       // Array of all merged IDs (UUIDs, cto_ids, etc.)
  enunciado: string,        // Normalized/cleaned question statement
  opciones: string[],       // Array of 4-5 options
  respuesta_correcta: number, // 0-indexed or 1-indexed integer matching options
  asignatura: string,       // Normalized official subject name
  tema: string,             // Specific theme (non-"General")
  subtema?: string,         // Granular subtheme if available
  año?: number,             // Official MIR year (e.g. 2015-2025) if applicable
  fuentes: string[],        // Array of source tags: ['mir', 'simulacro', 'evaluacion', 'test2v']
  fallada_cto?: boolean,    // True if student failed or left blank in CTO
  pct_pob?: number,         // Normalized population difficulty 0-100%
  horquilla_p80?: 'B1'|'B2'|'B3'|'B4', // P80 bracket
  explicacion?: string,     // Official commentary/explanation if available
  imagen?: string           // Image asset path/filename if applicable
}
```

### Navigation & Routing Contract in `App.jsx`
- Main tab: `tab === 'preguntas'` renders `<TiradorMaestro initialFiltros={bancoFiltros} onFiltrosConsumed={() => setBancoFiltros(null)} />`.
- Backward-compatible alias routing:
  - When `tab === 'desgloses'`: renders `TiradorMaestro` with preset `mode: 'desgloses'`.
  - When `tab === 'quiz'`: renders `TiradorMaestro` with preset `mode: 'custom'` and passes `initialFiltros` (e.g. `{ asignatura, soloFalladas: true, autoStart: true }`).
  - When `tab === 'adaptativo'`: renders `TiradorMaestro` with preset `mode: 'adaptativo'`.
- All callers using `setTab('quiz')` or `setTab('desgloses')` continue to work without modification.
