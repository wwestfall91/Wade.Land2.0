# EleMENTAL

A responsive React and TypeScript starter for a story-driven game. XState coordinates the
application flow, Zustand holds the active game session, and Dexie persists three save slots in
IndexedDB.

## Visual direction

EleMENTAL uses a consistent late-1980s NES RPG language inspired by the sparse console presentation
of *Ultima IV*: a 4:3 playfield, limited navy/gold/cream palette, bitmap typography, square
double-line panels, hard pixel shadows, and compact party sprites.

- Reuse the `--nes-*` color tokens in `src/index.css`; do not introduce gradients or soft modern
  colors outside the established palette.
- Use `Press Start 2P` with uppercase, concise copy and generous line height.
- Keep panels square, high-contrast, and pixel-framed; avoid rounded cards, blur, and soft shadows.
- Render sprites with `image-rendering: pixelated` and scale them by whole-feeling increments.
- Show selection with the gold cursor, color inversion, and a strong keyboard focus treatment.

## Commands

- `npm run dev` — start the Vite development server
- `npm test` — run focused component and persistence tests
- `npm run build` — type-check and build for production
- `npm run lint` — run Oxlint
