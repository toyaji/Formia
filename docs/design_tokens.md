# Design Tokens Specification: Formia

To achieve a "Premium, Alive, and Effortless" look (inspired by Araform), Formia uses a strict design token system.

## 1. Color System (Functional)

Tokens are named by their function, not their literal color.

| Token Name   | Description          | Default Value (Light) | Default Value (Dark) |
| :----------- | :------------------- | :-------------------- | :------------------- |
| `primary`    | Key brand color      | `#3B82F6`             | `#60A5FA`            |
| `background` | Workspace background | `#F6F9FF`             | `#0F172A`            |
| `surface`    | Card background      | `#FFFFFF`             | `#1E293B`            |
| `text-main`  | Primary text         | `#1E293B`             | `#F8FAFC`            |
| `text-muted` | Helper text          | `#64748B`             | `#94A3B8`            |
| `border`     | Subtle dividers      | `#E2E8F0`             | `#334155`            |

## 2. Glassmorphism & Effects

- **`glass-blur`**: `12px`
- **`glass-opacity`**: `0.7`
- **`shadow-premium`**: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`

## 3. Spacing & Radius

- **`radius-xl`**: `16px` (main containers)
- **`radius-md`**: `8px` (buttons, inputs)
- **`spacing-unit`**: `4px` (all gaps should be multiples of this)

## 4. Typography (Pretendard)

- **`font-sans`**: `'Pretendard', sans-serif`
- **`font-base`**: `16px`
- **`font-lg`**: `18px` (Labels)
- **`font-sm`**: `14px` (Helper text)

## 5. Implementation in Code

Tokens will be mapped to CSS Variables:

```css
:root {
  --f-primary: #4f46e5;
  --f-surface: rgba(255, 255, 255, 0.8);
  /* ... */
}
```

The AI Agent can request changes to these tokens by patching the `theme.tokens` section of the Form Factor.
