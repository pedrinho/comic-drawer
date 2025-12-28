# Comic Drawer 🎨

A web-based application for creating comics! Draw panels, add dialogue, and let your creativity flow.

## Features

- ✏️ **Drawing Tools**: Pen, eraser, and text
- ✍️ **Vector Pen**: Draw smooth paths that can be selected, moved, resized, and rotated!
- 😀 **Emoji Tool**: Add emojis to your comics with a comprehensive emoji picker
- 🔷 **Shapes**: 12 different shapes (rectangle, circle, triangle, star, heart, diamond, hexagon, pentagon, heptagon, octagon, arrow, cross)
- ⬚ **Object Shapes**: Create editable shape objects that can be moved, resized, rotated, and deleted
- 💬 **Speech Balloons**: Add dialogue bubbles with text
- 🪣 **Fill Tool**: Fill shapes and areas with color
- 📐 **Panel Layout**: Customizable comic panel layouts
- ✏️ **Panel Management**: Rename panels by double-clicking, and reorder panels with up/down arrows
- 🎬 **Presentation Mode**: Present your comic like flipping a book with fullscreen panel display and navigation
- 💾 **Save & Load**: Save your comics in .cd format and load them later
- 📄 **Export to PDF**: Export your comic panels as a PDF file (each panel becomes one page)
- 🖱️ **Object Selection**: Select, move, resize (with dimensions display), rotate, and delete shape, text, and emoji objects with the select tool
- ✂️ **Scissor Tool**: Select and cut rectangular areas from the canvas to create movable image objects
- 🗑️ **Delete Objects**: Delete selected objects using the delete button or Delete/Backspace keys
- ↶ **Undo/Redo**: Undo and redo the last 10 actions (keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z)
- 🎨 **Beautiful UI**: Modern, kid-friendly interface

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
- HTML5 Canvas
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

Current coverage: **97.2%** (excluding Canvas drawing logic and DOM APIs)

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

This project is almost 100% developed by Cursor (AI pair programming assistant).

## Known Issues

- **Text Duplication After Editing**: After editing text and pressing Enter, the text may appear duplicated. The original text becomes part of the background and is not selectable. This is a known issue that needs to be addressed.
- **Object Duplication After Loading**: After loading a saved file, moving objects may cause duplication. The original appears as part of the background and is not selectable. This is a known issue that needs to be addressed.
- **Scissor Selection Visibility**: After selecting an area with the Scissor tool, the selection may initially appear blank/white. Moving the object usually resolves this, causing it to reappear correctly. This is a known rendering issue.

## Future Enhancements

- Layer support
- Cloud save
- Comic templates

## License

GPL-3.0
