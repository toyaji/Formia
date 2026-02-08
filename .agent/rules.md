# Formia Project Rules & Guidelines

Before starting any task in this codebase, the AI Agent must review the following documentation to ensure alignment with the project vision and technical constraints.

## 📂 Core Documentation

- **Architecture**: `docs/architecture.md` (BYOK, Tauri, History management)
- **Form Factor**: `docs/form_factor_schema.md` (JSON Schema definition)
- **UI/UX Design**: `docs/ui_ux_design.md` (Araform inspiration, 3-panel layout)
- **AI Protocol**: `docs/ai_interaction_protocol.md` (Single source of truth, JSON Patching)
- **Design Tokens**: `docs/design_tokens.md` (Pretendard font, color tokens)

## 🛠 Working Principles

1.  **Documentation First**: Never implement without ensuring the design docs are up to date and approved.
2.  **Schema-Driven**: All changes to the form must be initiated through the Form Factor schema.
3.  **Local-First**: Always assume data is stored locally and API keys are provided by the user (BYOK).
4.  **Araform Aesthetic**: Maintain a clean, modern, minimalist look with Pretendard font.
