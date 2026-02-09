## 1. Design Philosophy

Formia should feel **Premium, Alive, and Effortless**, strictly following the modern, clean aesthetics of **Araform**.

- **Minimalist & Content-First**: Extreme whitespace, light neutral backgrounds (`#F6F9FF`), and soft shadows.
- **Topography**: Use **Pretendard** as the primary font for superior legibility and modern feel.
- **Micro-interactions**: Hover effects for edit/copy/delete, smooth card transitions, and glowing highlights for AI-modified areas.

## 2. Layout Structure: 3-Panel Modular System

Inspired by Araform's builder, the workspace is split into three main regions:

### 2.1 Left Panel (Structure & Navigation)

- **Structure**:
  1.  **Start Page** (Fixed): "시작 페이지". Cannot be renamed, moved, or deleted.
  2.  **Question Pages**: Auto-numbered by default ("1페이지", "2페이지"...). **Customizable.** Users can double-click to rename these.
  3.  **Ending Pages**:
      - **Default End Page** (Fixed): "종료 페이지". Cannot be renamed, moved, or deleted.
      - **Early Exit Pages**: Customizable ("2 종료 페이지", "3 종료 페이지"...).
- **Ordering**: Strict relative order (Start -> Questions -> End). Drag-and-drop allowed within Question pages.
- **Collapsible**: To maximize canvas space.

### 2.2 Center Canvas (The WYSIWYG Builder)

- Each question/block is rendered as a clean white card on a soft gray background.
- **Inline Editing**: Users click text labels (titles, descriptions) directly on the canvas to edit, reducing sidebar dependency.
- Floating Action Buttons at the bottom for quick additions.

### 2.3 Right Panel (Contextual AI & Style)

- **Agent Chat Panel**: The AI sidebar for natural language interactions.
- **Style Editor**: Theme tokens, global styles (syncs to Form Factor).
- **Non-removable Headers**: Core header blocks and system pages (Start/Ending) cannot be deleted by the user or AI, ensuring the form structure remains valid.
- **Unified Header Editing**: Form titles are managed in the global header for constant availability during design.

## 3. Color Palette & Typography

- **Primary Action**: Clear blue (`#3B82F6`) for primary buttons and active states.
- **Backgrounds**: Workspace tint (`#F6F9FF`), Sidebar/Panels (White or subtle glass blur).
- **Typography Tokens**: Defined in `docs/design_tokens.md`.
