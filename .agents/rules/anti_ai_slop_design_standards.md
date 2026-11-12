# Anti-AI-Slop Web Design & UI Engineering Standards (Hallmark Protocol)

This rule permanently governs all frontend design, styling, and user interface development across all projects and conversations. Inspired by Hassan El Mghari's **Hallmark (`nutlope/hallmark`)**, its goal is to completely eradicate generic, predictable "AI slop" and enforce human-crafted, professional, and accessible UI engineering.

---

## 1. Zero Tolerance for "AI Slop" Tropes

Whenever generating, styling, or refactoring web interfaces, you are strictly forbidden from producing the following standard AI clichés:

- **Banned Neon Gradients**: Do NOT use default violet-to-indigo, cyan-to-purple, or hot-pink/rose gradients (`from-purple-600 to-indigo-600`, `from-pink-500 to-amber-500`, etc.) on buttons, cards, or hero text unless explicitly mandated by the user.
- **Banned Emoji & Icon Spam**: Never inject decorative sparkles (`✨`, `🌟`), rockets (`🚀`), coffee cups (`☕`, `🍵`), chocolate (`🍫`), or party poppers (`🎉`) into professional headers, buttons, cards, or notifications.
- **Banned Bubble & Glowing Card Stacks**: Avoid repetitive floating containers with glowing colored borders (`border-purple-500/20`, neon box-shadows, bouncy pill bubbles) and cookie-cutter 3-column feature grids that scream "generic AI landing page."
- **Banned Typographic Monotony**: Never rely on unstyled default sans-serif without distinct typographic hierarchy. Avoid uniform font weights and flat line-heights.

---

## 2. The Hallmark "Floor": Foundational Design Rules

Every UI implementation must uphold these non-negotiable architectural baselines:

### A. Color Palette Discipline
- **Intentional, Opinionated Palettes**: Select tailored color harmonies reflecting the domain (e.g., editorial terracotta `#EA580C` & forest green `#16A34A` on slate/linen; technical monochrome with single amber or copper accent; architectural warm neutral).
- **Surface Hierarchy**: Use subtle, layered neutral surfaces (`#0E1117` canvas -> `#161B22` card -> `#21262D` border) rather than aggressive saturation.
- **Functional Semantics**: Colors must communicate function:
  - **Emerald / Forest Green**: Success, completed status, verified state.
  - **Red / Crimson**: Destructive actions, critical errors, incorrect answers.
  - **Amber / Honey**: Warnings, review needed, pending status.
  - **Neutral / Accent**: Structural navigation and primary user actions.

### B. Typographic Distinction
- Establish strong hierarchy: High-contrast headings paired with readable body copy.
- Use tabular/monospaced numbers (`font-mono`) for timers, metrics, financial figures, and raw data.
- Use refined uppercase micro-copy with letter-spacing (`tracking-wider text-[11px] font-semibold`) for status badges and section headers.
- Maintain comfortable line-heights (`leading-relaxed` for prose, `leading-tight` for large display headings).

### C. Spacing, Layout & Viewports
- Follow a strict 4px/8px spatial scale (`gap-2`, `gap-3`, `gap-4`, `p-4`, `p-6`, `p-8`).
- Never allow text collisions or overflow: always pair flex layouts with `min-w-0` and `truncate` where applicable.
- Ensure all interactive elements have comfortable touch targets (minimum $40\times40\text{px}$ or $44\times44\text{px}$ on mobile).
- Ensure mobile responsiveness through responsive grid columns (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) and responsive drawers/navbars.

### D. Accessibility & Contrast
- Meet WCAG AA contrast standards ($\ge 4.5:1$ for normal text, $\ge 3:1$ for large text/icons).
- Never use low-contrast text (e.g., light gray `#94a3b8` on white or dark gray `#334155` on black).
- Include proper keyboard navigation, visible focus rings, and screen-reader labels (`aria-label`, `role="button"`).

---

## 3. Safe Redesign Protocol

When refactoring or redesigning an existing UI:
1. **Preserve All Functionality**: Never drop form inputs, state bindings, route links, modal toggles, or event listeners during visual enhancements.
2. **Preserve Data Bindings**: Ensure dynamic properties, conditional formatting, and error boundary states remain 100% wired up.
3. **Verify Build**: Always run the project's build or typecheck command (`npm run build`, `tsc`, `vite build`) to confirm zero compilation or TypeScript errors.

