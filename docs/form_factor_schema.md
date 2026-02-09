# Form Factor Specification: v2.0.0

The "Form Factor" is the core JSON object that represents a form's lifecycle.

## 1. Top-Level Structure

```json
{
  "version": "2.0.0",
  "metadata": {
    "title": "Untitled Form",
    "description": "",
    "createdAt": "ISO-TIMESTAMP",
    "updatedAt": "ISO-TIMESTAMP"
  },
  "theme": {
    "mode": "light | dark | system",
    "tokens": {
      "primary": "#3B82F6",
      "background": "#FFFFFF",
      "surface": "#F6F9FF",
      "radius": "8px"
    }
  },
  "pages": [],
  "settings": {
    "submitButtonLabel": "제출하기",
    "successMessage": "성공적으로 제출되었습니다."
  }
}
```

## 2. Page & Ordering Rules

The `pages` array must follow a strict order and naming convention:

1.  **Start Page** (Required, 1 Fixed):
    - Type: `start`.
    - Title: **"시작 페이지"** (Mandatory, Fixed).
    - Constraints: Cannot be deleted, moved, or renamed.
2.  **Default Pages** (0..N):
    - Type: `default`.
    - Title: **"N페이지"** (Mandatory sequential naming: 1페이지, 2페이지) unless explicitly user-defined.
    - Usage: Primary question pages.
3.  **Ending Pages** (Min 1):
    - **Primary Ending Page** (Required, 1 Fixed):
      - Position: Historically at the end of the schema.
      - Type: `ending`.
      - Title: **"종료 페이지"** (Mandatory, Fixed).
      - Constraints: Cannot be deleted, moved, or renamed.
    - **Additional Ending Pages** (Optional, for early exit):
      - Type: `ending`.
      - Title: **"N 종료 페이지"** (Mandatory sequential naming: 2 종료 페이지, 3 종료 페이지).
    - **Content Rule**: All ending page content (messages, images, etc.) MUST be implemented using blocks (typically `info` blocks). The `page.title` and `page.description` are for structural identification only.

```json
{
  "id": "uuid",
  "type": "start | default | ending",
  "title": "Required string (following convention)",
  "blocks": []
}
```

## 3. Block Definition

```json
{
  "id": "uuid",
  "type": "text | choice | rating | date | file | info | textarea",
  "content": {
    "label": "Question Text",
    "placeholder": "Type here...",
    "options": ["Option 1", "Option 2"],
    "maxRating": 5,
    "body": "Markdown content"
  },
  validation?: {
    required: boolean;
    pattern?: string;
  };
  style?: Record<string, any>;
  removable?: boolean; // Defaults to true. Set to false for core headers.
}
```

## 4. AI Interaction Strategy: JSON Patch

Agents emit **RFC 6902 JSON Patches**.

- **Start/Ending Page Headers**: The primary header blocks for start and ending pages are now unified using the `statement` block type and are non-removable (`removable: false`) to ensure a consistent user experience.
- **Editable Form Name**: The form's global name (metadata.title) is editable directly in the top header.
- **Page Naming**: AI must generate mandatory `title` fields. It should use the default naming convention ("N페이지" or "N 종료 페이지") unless the user explicitly requests a specific title.

### Example: "Add a Name Question"

```json
[
  { "op": "add", "path": "/pages/1/blocks/-", "value": { ... } }
]
```
