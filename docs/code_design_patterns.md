# Code Design Patterns & Layers: Formia

To ensure high readability and maintainability, Formia follows a strict **Layered Architecture** and specialized design patterns.

## 1. Architectural Layers

### 1.1 UI Layer (React/Next.js)

- **Components**: Atomic UI parts (Buttons, Inputs, Cards).
- **Features**: Higher-level modules (BuilderCanvas, Sidebar, Header).
- **Hooks**: UI-specific logic (e.g., `useDragAndDrop`, `useInlineEdit`).

### 1.2 Domain Layer (Core Business Logic)

- **Form Factor Store**: The "Single Source of Truth" managed by Zustand.
- **Schema Engine**: Logic for validating and manipulating the Form Factor JSON.
- **Commands**: Encapsulated actions that can be undone/redone.

### 1.3 Infrastructure Layer (External Services)

- **AI Providers**: Adapters for Gemini, OpenAI, and Anthropic.
- **Persistence**: Tauri-specific file system and local storage adapters.
- **Protocol**: JSON Patch (RFC 6902) implementation.

## 2. Shared Design Patterns

### 2.1 Command Pattern (History Management)

Every change to the schema must be a `Command` object.

```typescript
interface Command {
  execute(): void;
  undo(): void;
  metadata: { author: "human" | "ai"; description: string };
}
```

### 2.2 Adapter Pattern (Multi-LLM Support)

Standardize different LLM responses into a unified Formia format.

```typescript
interface AIProvider {
  generatePatch(
    prompt: string,
    currentSchema: FormFactor,
  ): Promise<JsonPatch[]>;
}
```

### 2.3 Strategy Pattern (Block Rendering)

Different block types (text, choice, rating) are rendered using a strategy-based dynamic renderer.

### 2.4 Observer Pattern (State Sync)

Ensures that when the Form Factor changes (from Agent or UI), all relevant components re-render immediately.

### 2.5 Repository Pattern (Persistence Decoupling)

To ensure the core logic doesn't depend on the specific storage (Local FS vs. Remote API), we use the **Repository Pattern**.

- **Port (Interface)**: `FormRepository` defines how to load/save forms.
- **Adapter (Implementation)**:
  - `LocalFileRepository`: Uses Tauri's FS API (Current).
  - `RemoteApiRepository`: Uses Fetch/Axios to talk to a backend (Future).

```typescript
interface FormRepository {
  save(content: FormFactor): Promise<void>;
  load(id: string): Promise<FormFactor>;
  list(): Promise<FormInfo[]>;
}
```

## 3. Communication Rules

- **One-Way Data Flow**: Data flows from the Form Factor Store to the UI.
- **Explicit Patches**: The UI and Agent never "mutate" state directly; they emit Patches/Commands that the Store applies.
- **Dependency Inversion**: High-level modules (Builder) should not depend on low-level AI SDKs directly; use the `AIProvider` interface.

## 4. Folder Structure Convention

```
src/
  ├── app/          # Next.js App Router (UI Pages)
  ├── components/   # Atomic UI Components
  ├── features/     # Feature-specific logic (builder, ai-panel)
  ├── lib/
  │    ├── core/    # Domain Layer (Form Factor, Commands)
  │    ├── ai/      # Infrastructure Layer (LLM Adapters)
  │    └── utils/   # Shared helpers
  └── store/        # Zustand Store
```
