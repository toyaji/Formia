# Formia UX & UI Rules

## 1. Tooltip & Hover Interaction

### Custom CSS Tooltip Utility

To avoid the slow response time (1-2s delay) of native browser tooltips (`title` attribute), Formia uses a custom CSS-based tooltip utility.

#### Usage

Add the `.f-tooltip-container` utility class and the `data-tooltip` attribute to any element (or its wrapper if the element is disabled).

```html
<!-- Example: Enabled Element -->
<button class="f-tooltip-container" data-tooltip="Click to save changes">
  Save
</button>

<!-- Example: Disabled Element (Wrapper Required) -->
<div class="f-tooltip-container" data-tooltip="Login required">
  <button disabled>Cloud Save</button>
</div>
```

#### Style Specifications

- **Background**: `var(--f-text-main)` (Dark/Neutral)
- **Text**: White, `0.75rem`
- **Animation**: 150ms fade-in/out with a slight `5px` vertical translation.
- **Trigger**: Instant on hover.

---

## 2. Global Design Tokens

Refer to `src/styles/tokens.css` for consistent styling.

- **Primary**: `#3b82f6` (System Blue)
- **Surface**: `#ffffff`
- **Background**: `#f6f9ff` (Soft Blue-Gray)
- **Radius**: `var(--f-radius-md)` (8px) for standard components.

---

## 3. AI Interaction States

- **Validation**: While checking API key status, the UI should remain stable without flashing placeholders. Use `isValidating` states.
- **Empty State**: Always show the welcome message ("안녕하세요! ...") to provide a conversational starting point.
- **Inhibited Actions**: If an action is blocked (e.g., missing API key), the trigger button must be disabled and provide a clear tooltip explanation on hover.
