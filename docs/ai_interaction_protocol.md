# AI Agent Interaction Protocol: Formia

The Formia Agent is not just a chatbot; it's a **Schema Co-Author**.

## 1. Interaction Lifecycle

1.  **User Prompt**: "Make the background look like a starry night and add a field for email."
2.  **Context Assembly**:
    - Current `form_factor.json`
    - Design System constraints (allowed tokens)
    - Available Block Types
3.  **Agent Reasoning**: Determines which parts of the schema need to change.
4.  **Schema Patch Generation**: Agent generates a sequence of JSON Patches.
5.  **Draft Preview**: The UI reflects changes in a "Draft" state (e.g., glowing borders).
6.  **Human Confirmation**: User accepts or adjusts the changes.

## 2. System Instructions (Prompt Principles)

The Agent should be instructed with:

- **Design Guidelines**: "Prefer minimalist, Araform-like layouts."
- **UX Best Practices**: "Always suggest labels and help text for accessibility."
- **Constraint Awareness**: "Only use defined theme tokens."

## 3. The "Side-by-Side" Sync

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Factor as Form Factor (Schema)
    participant Agent

    User->>Agent: "Add email field"
    Agent->>Factor: Apply JSON Patch (Draft)
    Factor->>UI: Update Canvas (Highlight New Field)
    User->>UI: Directly edit label
    UI->>Factor: Update Label
    Factor->>Agent: Context Updated
```

## 4. Multi-LLM Adaptability

- **Gemini**: excels at multimodal context (if we support image-to-form).
- **OpenAI/Claude**: excels at precise JSON adherence and code-like logic.
- **Unified Adapter**: All models must output the same JSON Patch format.
