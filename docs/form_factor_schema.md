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

The `pages` array must follow a strict order:

1.  **Start Page** (1, Fixed): Type `start`. Title fixed as "시작 페이지".
2.  **Default Pages** (0..N): Type `default`.
    - **No User Titles**: Identified purely by their sequential index (e.g., "1페이지", "2페이지").
    - Contains Question Blocks.
3.  **Ending Page** (1, Fixed): Type `ending`. Title fixed as "설문 종료".
    - Contains only Info/General Blocks.

```json
{
  "id": "uuid",
  "type": "start | default | ending",
  "title": "(optional, restricted for default pages)",
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
  "validation": {
    "required": true
  }
}
```

## 4. AI Interaction Strategy: JSON Patch

Agents emit **RFC 6902 JSON Patches**.

- **Page Addition**: Must check for Ending Page index and insert **before** it.
- **Page Naming**: AI must NOT assign custom titles to default pages. Use generic identifiers or let UI handle numbering.

### Example: "Add a Name Question"

```json
[
  { "op": "add", "path": "/pages/1/blocks/-", "value": { ... } }
]
```
