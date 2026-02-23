# Testing Strategy: Formia

Formia requires a unique testing approach because it involves a **web client**, a local desktop environment (**Tauri**), a backend API, and a 3rd-party AI Agent integration (**BYOK**).

## 1. Multi-Tier Testing Architecture

### 1.1 UI & Design Logic (Web-based)

- **Tool**: Vitest + React Testing Library.
- **Goal**: Verify that the "Form Factor" (JSON) correctly renders UI components.
- **Strategy**: Since this is purely Next.js, Antigravity can run these tests locally and view the output in a virtual browser.

### 1.2 AI Agent Integration (BYOK Testing)

To test AI interactions without spending the user's actual API credits constantly:

- **Mock AI Provider**: A local mock service that returns pre-defined JSON Patches for common prompts (e.g., "Add email field").
- **E2E Agent Testing**: Once the core logic is stable, we use the user's provided **Test API Key** to verify real-world LLM reasoning.

### 1.3 Local Desktop Functionality (Tauri)

- **Tool**: Playwright with Tauri driver.
- **Goal**: Verify file system access (saving `.formia` files) and native window behavior.

### 1.4 Backend API Testing

- **Tool**: Vitest (or Jest) + Supertest.
- **Goal**: Verify API endpoints (`/api/forms`, `/api/responses`, `/api/auth`).
- **Strategy**:
  - **Unit Tests**: Service/Controller logic with mocked Prisma client.
  - **Integration Tests**: Full request-response cycle against test SQLite database.
  - **Auth Testing**: OAuth flow mocking via NextAuth.js test utilities.

### 1.5 Database Testing

- **Tool**: Prisma + SQLite (in-memory or file-based for tests).
- **Strategy**: Use Prisma migrations on a fresh test DB before each test suite. Seed with test fixtures from `tests/fixtures/`.

## 2. Agent Collaboration & Account Setup

To allow Antigravity (or any external agent) to test the full flow:

### 2.1 The ".env.test" Configuration

We will maintain a `.env.test` (git-ignored) file where the user can provide:

- `TEST_GEMINI_API_KEY`: A restricted key for testing purposes.
- `TEST_OPENAI_API_KEY`: An optional key for cross-model verification.

### 2.2 Shared Sandbox Forms

A set of reference `.formia` files in `tests/fixtures/` that represent various states (empty, complex, broken) to ensure the Agent can always "reset" to a known state.

## 3. Automated Verification Workflow

1.  **Schema Validation**: Every time the Agent produces a patch, a JSON Schema validator checks for structural integrity before applying it to the UI.
2.  **Snapshot Testing**: Compare the rendered HTML of the form card against a known "good" Araform-style baseline.
3.  **Visual Regression**: Antigravity can take screenshots of `localhost:3001` and compare them to ensure no design tokens were accidentally broken.

## 4. Testing Account / Secret Management

- **Security**: Test keys must NEVER be committed to the repository.
- **Guide**: `docs/testing_setup.md` will be created to guide new contributors on how to set up their own local test environment with their own keys.
- **Database**: Test database uses a separate SQLite file (`test.db`) that is gitignored and recreated on each test run.

---

_마지막 업데이트: 2026-02-11_
