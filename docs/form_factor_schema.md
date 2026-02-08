# Form Factor Specification: Draft v1

The "Form Factor" is the core JSON object that represents a form's lifecycle.

## 1. Top-Level Structure

```json
{
  "version": "1.0",
  "metadata": {
    "title": "Untitled Form",
    "description": "",
    "createdAt": "ISO-TIMESTAMP",
    "updatedAt": "ISO-TIMESTAMP"
  },
  "theme": {
    "primaryColor": "#4F46E5",
    "background": "glassmorphic",
    "typography": "Inter"
  },
  "blocks": [],
  "logic": []
}
```

## 2. Block Definition (Expanded)

```json
{
  "id": "uuid",
  "type": "text | choice | rating | date | file | section",
  "content": {
    "label": "Question Text",
    "placeholder": "Type here...",
    "helperText": "Additional info",
    "tooltip": ""
  },
  "validation": {
    "required": true,
    "pattern": "^[0-9]+$",
    "min": 0,
    "max": 100,
    "customError": "Please enter a valid age."
  },
  "options": [{ "id": "opt1", "label": "Option A", "value": "a" }],
  "style": {
    "layout": "default | compact | wide",
    "variant": "outline | ghost | solid",
    "customCss": {}
  }
}
```

## 3. Theme & Design Tokens

Instead of hardcoded colors, the Factor uses a token-based system inspired by Figma or Tailwind.

```json
{
  "theme": {
    "tokens": {
      "primary": "var(--formia-blue)",
      "surface": "rgba(255, 255, 255, 0.8)",
      "radius": "12px",
      "blur": "10px"
    },
    "font": {
      "family": "Inter, sans-serif",
      "size": "16px"
    }
  }
}
```

## 4. AI Interaction Strategy: JSON Patch

To minimize tokens and ensure atomic updates, the Agent should emit **JSON Patches** (RFC 6902) rather than the whole schema.

### Example: "Add a field for Name"

**Agent Output:**

```json
[
  {
    "op": "add",
    "path": "/blocks/-",
    "value": { "id": "uuid-name", "type": "text", "label": "Name?" }
  }
]
```

## 5. Persistence & Local-First

- **File-per-Form**: Each form is saved as a `.formia` file (UTF-8 JSON).
- **Auto-Save**: The app monitors the in-memory Factor and debounces writes to disk.
- **Git Compatibility**: Since it's plain JSON, users can version control their forms easily.
