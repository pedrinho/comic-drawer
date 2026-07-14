# Comic Drawer 🎨

A web-based application for creating comics! Draw panels, add dialogue, and let your creativity flow.

## Features

- ✍️ **Vector Pen**: Draw smooth freehand strokes (via Fabric's `PencilBrush`) that become
  real objects — select, move, resize, and rotate them
- 🧽 **Eraser**: Wipe the raster layer clean
- 🔷 **Object Shapes**: 12 shapes (rectangle, circle, triangle, star, heart, diamond, hexagon,
  pentagon, heptagon, octagon, arrow, cross) as editable objects you can move, resize, rotate,
  recolor, duplicate, and delete
- 💬 **Text**: Place and edit text in place; the toolbar keeps font/size controls open while
  you type
- 😀 **Emoji Tool**: Drop emojis onto your comic with a searchable emoji picker
- 🪣 **Fill Tool**: Recolor a shape by clicking it, or flood-fill an empty area (bounded by the
  ink, grid, and shapes around it)
- ✂️ **Scissor Tool**: Cut a rectangular region into a movable image object
- 🖱️ **Object Selection**: Native select/move/resize (with rotation and a live size readout) plus on-canvas
  **⧉ duplicate**, **✕ delete**, and **⊕ merge / ⊖ un-merge** controls right on the object
- 📐 **Panel Layout**: Customizable comic panel grids
- 🗂️ **Panel Management**: Rename panels by double-clicking; add and reorder panels
- 🎬 **Presentation Mode**: Present your comic fullscreen, flipping through panels
- 💾 **Save & Load**: Save comics in `.cd` format and load them later
- 📄 **Export to PDF**: Export every panel as a page (rendered through Fabric for pixel parity
  with the editor)
- ↶ **Undo/Redo**: Undo/redo the last 10 actions per panel (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)
- 🎨 **Beautiful UI**: Modern, kid-friendly interface

> 💬 **Note on speech balloons:** the dedicated balloon tool has been retired in favor of the
> Text tool. Balloons in older `.cd` files still render, move, and export, but new ones aren't
> created.

## Canvas Architecture — Fabric.js Migration

The canvas core was migrated from a hand-rolled HTML5 Canvas 2D implementation to
[**Fabric.js**](http://fabricjs.com/). It's now a **single Fabric canvas** that renders the
whole scene:

- a **raster substrate** (the per-panel bitmap the eraser, fill fallback, and scissor paint on),
- the **panel grid**, and
- every **vector object** (pen paths, shapes, text, emoji, cut-out images) on top.

Every tool is Fabric-native, so selection, move, resize, and rotation come for free, and objects
carry their own on-canvas controls. The layer model (`ObjectLayer` / `TextLayer` + panel
`ImageData`) remains the source of truth for **save/load** and **presentation**, and PDF export
renders each panel through an offscreen Fabric `StaticCanvas` reusing the same converters — so
the export matches the editor exactly. The migration deleted the legacy canvas and roughly
2,750 lines of hand-rolled selection/rendering machinery (`Canvas.tsx` shrank from ~3,745 to
~980 lines).

See [`FABRIC_MIGRATION.md`](./FABRIC_MIGRATION.md) for the full migration notes.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open http://localhost:5173 in your browser

## Tech Stack

- React 18
- TypeScript
- Vite
- [Fabric.js](http://fabricjs.com/) (canvas engine) + HTML5 Canvas
- jsPDF (PDF export)
- Vitest (testing)

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

The migration is largely verified visually with **Playwright + headless Chromium** (Fabric's
pointer pipeline can't be driven in jsdom); unit tests cover the data-model converters
(`src/utils/fabric*.test.ts`) and enter/exit sync.

## Type Checking

Check TypeScript types without building:
```bash
npm run type-check
```

Watch mode for type checking:
```bash
npm run type-check:watch
```

The build process (`npm run build`) automatically runs type checking before building to catch errors early.

## Credits

This project is inspired by my sons, Pedro and Paulo ❤️ They love to paint comics and that's why I started to develop this project.

The app was originally built with **Cursor**, and the **Fabric.js migration** (single-canvas
rewrite, raster tools, export, undo/redo, and legacy teardown) was done with **Claude Code**
(Anthropic's agentic CLI) — AI pair-programming assistants.

## Future Enhancements

- Layer support
- Cloud save
- Comic templates

## License

GPL-3.0
