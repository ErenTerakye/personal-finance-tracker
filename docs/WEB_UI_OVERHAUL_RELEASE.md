# Web UI Overhaul Release Record

## Scope and workflow inventory

The July 2026 overhaul keeps the existing API and local SQLite model while replacing the browser information architecture with four user concepts:

- Overview (`/`): period narrative, unified cashflow story, six-month trend, ranked attention, recent activity, and progressively disclosed analysis/downloads.
- Activity (`/transactions`): immediate search, advanced filters, filter summary, add/edit/delete, staged CSV import, filtered export, and ledger review.
- Plan (`/budgets`): planned/spent/remaining/uncovered summary, sortable category pressure, contextual editing, import, and export.
- Automations (`/rules?tab=categories|recurring|preferences`): category aliases, recurring templates with apply preview, and ledger preferences.

Global flows are: navigation → route heading focus; create command → Activity form; destructive command → named confirmation → restored context; compact language/theme commands → immediate preference update.

## Design and architecture decisions

“Ledger editorial” uses warm paper and ink surfaces, cobalt interaction, jade positive state, vermilion destructive/negative state, amber attention, sparse rules, and tonal separation. Instrument Sans Variable is self-hosted for interface text; IBM Plex Mono Latin and Latin Extended subsets are self-hosted for figures. Semantic tokens and motion timings live in `shared/styles/tokens.css`; reusable shell and route integration styles remain inside the existing ordered cascade layers.

The dependency direction is unchanged: `app/` owns navigation and route continuity, features own workflows, `api/` owns transport, and `shared/` owns visual foundations. No state, animation, component, or CSS-in-JS framework was added.

## Responsive and motion notes

- Wide layouts use a persistent 16rem rail; compact layouts use a top app bar with inline language, theme, and create controls plus a four-route bottom navigation bar.
- Container queries collapse budget rows and existing tables/charts according to available content width.
- The global create command remains reachable without obscuring the last ledger row.
- View transitions remain limited to route/navigation continuity and are bypassed under reduced motion.

## Accessibility record

Implemented evidence includes semantic landmarks, skip link, visible focus, route focus routing, native dialogs/popovers, a single primary navigation pattern per viewport, roving ARIA tabs, keyboard chart inspection, accessible chart tables, explicit status text, 48px primary targets, English/Turkish copy, dark mode, forced-color rules, and reduced-motion handling.

Automated validation covers unit/integration tests, axe scans on every primary route at compact and wide widths, keyboard navigation/dialog/tab paths, responsive overflow, compact utility touch targets, theme and locale switching, and the packaged FastAPI/SQLite path. Manual release verification covers pointer and keyboard create/edit/filter/navigation flows, inline compact utilities, dark theme, Turkish labels, and responsive visual inspection.

Known limitation: automated tooling cannot prove VoiceOver/Safari or a physical coarse-touch device path in this development environment. Native semantics, focus behavior, touch-sized controls, and responsive browser emulation are verified; physical assistive-technology verification remains a release-device check.

## Performance and bundle evidence

The production bundle remains inside the repository gate. The release check records generated gzip totals from `npm run check:bundle`; self-hosted font files are separate cacheable assets and limited to the Latin/Turkish glyph ranges used by the product. Layout-stable metric blocks, reserved chart geometry, and font fallback metrics limit CLS risk. The shell is interactive independently of below-the-fold analysis.

## Retrospective

The redesign trades a dense equal-weight dashboard for a decision-first reading order and progressive disclosure. It demonstrates product hierarchy, modern platform primitives, local-first workflow depth, exact financial presentation, localization, accessibility, and responsive engineering without expanding backend scope or obscuring the repository’s portfolio-scale architecture.
