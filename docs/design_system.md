# Formia Design System: Icons

This document defines the icon design system for Formia, inspired by modern interactive form builders like Araform and Typeform.

## 1. Icon Philosophy

Formia uses **symbolic graphic icons** instead of plain text or standard generic icons to provide a premium, intuitive user experience. Icons are designed to be recognizable at a glance, representing the core function of each question type.

## 2. Visual Style

- **Type**: Minimalist line-art.
- **Color**: Professional Blue (`#3B82F6`).
- **Background**: Pure white or transparent.
- **Consistency**: All icons follow the same stroke width and geometric style to ensure a cohesive look across the sidebar and editor.

## 3. Question Type Icons

The following icons are mapped to each `BlockType` in `BLOCK_METADATA`:

| Block Type  | Icon Symbol Description               | File Path                     |
| :---------- | :------------------------------------ | :---------------------------- |
| `text`      | Horizontal line with a text cursor    | `/assets/icons/text.png`      |
| `textarea`  | Multiple horizontal lines (paragraph) | `/assets/icons/textarea.png`  |
| `choice`    | Bulleted list / Radio button list     | `/assets/icons/choice.png`    |
| `rating`    | Five-pointed star                     | `/assets/icons/rating.png`    |
| `date`      | Calendar grid                         | `/assets/icons/date.png`      |
| `file`      | Paperclip (attachment)                | `/assets/icons/file.png`      |
| `info`      | Lowercase 'i' in a circle             | `/assets/icons/info.png`      |
| `statement` | Document / Sheet of paper             | `/assets/icons/statement.png` |

## 4. Implementation Details

- **Storage**: Icons are stored in `public/assets/icons/` as high-quality PNGs.
- **Metadata**: Mapped via `BLOCK_METADATA` in `src/lib/constants/blocks.ts`.
- **Rendering**: The `BlockRenderer` and `Sidebar` components check if an icon value starts with `/` to determine whether to render it as an `<img>` tag or fallback to text.

## 5. Maintenance & Expansion

When adding new block types:

1. Generate or design a symbolic icon following the minimalist blue line-art style.
2. Save to `public/assets/icons/` (standard naming: `type.png`).
3. Update `BLOCK_METADATA` and ensure the rendering logic handles the new path.
