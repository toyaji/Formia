## 1. Design Philosophy

Formia should feel **Premium, Alive, and Effortless**, strictly following the modern, clean aesthetics of **Araform**.

- **Minimalist & Content-First**: Extreme whitespace, light neutral backgrounds (`#F6F9FF`), and soft shadows.
- **Topography**: Use **Pretendard** as the primary font for superior legibility and modern feel.
- **Micro-interactions**: Hover effects for edit/copy/delete, smooth card transitions, and glowing highlights for AI-modified areas.

## 2. Layout Structure: 3-Panel Modular System

Inspired by Araform's builder, the workspace is split into three main regions:

### 2.1 Left Panel (Structure & Navigation)

- Vertical list showing the form flow (Start → Questions → End).
- Drag-and-drop support to reorder the form structure.
- Collapsible to maximize canvas space.

### 2.2 Center Canvas (The WYSIWYG Builder)

- Each question/block is rendered as a clean white card on a soft gray background.
- **Inline Editing**: Users click text labels (titles, descriptions) directly on the canvas to edit, reducing sidebar dependency.
- Floating Action Buttons at the bottom for quick additions.

### 2.3 Right Panel (Contextual AI & Style)

- **Agent Chat Panel**: The primary interface for AI conversation.
- **Design Tokens**: Configuration for colors, fonts, and global styles (syncs to Form Factor).

## 3. Color Palette & Typography

- **Primary Action**: Clear blue (`#3B82F6`) for primary buttons and active states.
- **Backgrounds**: Workspace tint (`#F6F9FF`), Sidebar/Panels (White or subtle glass blur).
- **Typography Tokens**: Defined in `docs/design_tokens.md`.
