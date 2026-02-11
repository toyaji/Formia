# 🌌 Formia: The AI-Agentic Form Builder

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js 14](https://img.shields.io/badge/framework-Next.js%2014-black.svg)](https://nextjs.org/)
[![Tauri](https://img.shields.io/badge/desktop-Tauri%202.0-yellow.svg)](https://tauri.app/)

**Formia** is a next-generation, AI-first form builder designed to transform how we create, edit, and optimize surveys. Instead of tedious drag-and-drop interfaces, Formia utilizes an **AI Agent Side Panel** to build complex, high-conversion forms through natural conversation.

---

## ✨ Key Features

### 🤖 Agent-State Protocol

The heart of Formia. Interact with an AI Agent that understands your intent.

- **Natural Language Construction**: "Create a lead-gen form for a coffee shop."
- **Review Mode**: Every change proposed by the AI is presented as a JSON patch. You can accept or reject individual field updates, style changes, or entire pages.
- **Context Awareness**: The agent understands your current form structure and suggests improvements.

### 🍱 Modular Block System

A rich set of form blocks designed for maximum conversion.

- **Start & Ending Pages**: Custom landing and thank-you experiences.
- **Smart Blocks**: Text inputs, multiple choice, ratings, and more.
- **Logic & Branching**: Complex conditional flows handled intelligently by the agent.

### 🎨 Premium UI & Canvas

- **Modern Aesthetics**: Glassmorphism, smooth gradients, and micro-animations out of the box.
- **Live Preview**: Real-time rendering with a one-click **Mobile/Desktop toggle**.
- **Undo/Redo**: Full state history management via an in-memory command pattern.

### 🏠 Hybrid Desktop & Web

- **Web App**: Seamlessly build and publish from your browser (Next.js).
- **Desktop Client**: Native performance and offline-first capabilities powered by **Tauri**.

---

## 🛠 Tech Stack

| Layer        | Technologies                                        |
| :----------- | :-------------------------------------------------- |
| **Frontend** | Next.js 14 (App Router), React 18, Zustand          |
| **Styling**  | Vanilla CSS (Modern Design Tokens), Lucide Icons    |
| **Desktop**  | Tauri 2.0 (Rust)                                    |
| **Database** | PostgreSQL / SQLite with Prisma ORM                 |
| **Auth**     | Auth.js (NextAuth v5 beta)                          |
| **AI**       | Integrated Agent Interface (Gemini, OpenAI support) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Rust (for Tauri development)
- A Gemini API Key (for AI features)

### Local Setup

1. **Clone & Install**:

   ```bash
   git clone https://github.com/your-repo/formia.git
   cd formia
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env.local` and fill in your keys.

   ```bash
   cp .env.example .env.local
   ```

3. **Database Initialization**:

   ```bash
   npx prisma db push
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to start building!

---

## 🤝 Contributing to Formia

We love new contributors! Formia is architected to be easy to dive into, with a clear separation between the **Editor Layer** and **Service Layer**.

### For New Contributors

- **Browse the Docs**: Check out the [Documentation Index](docs/INDEX.md) for a deep dive into our architecture, schema, and design system.
- **Architecture**: We use a Port/Adapter pattern. The core editor is offline-independent and doesn't know about the database.
- **Review Mode**: If you're working on AI features, focus on `src/lib/utils/patchUtils.ts` and `src/store/useFormStore.ts`.

### Contribution Workflow

1. **Fork** the repo.
2. Create your **Feature Branch** (`git checkout -b feat/AmazingFeature`).
3. **Commit** your changes following [Conventional Commits](https://www.conventionalcommits.org/).
4. **Push** and open a **Pull Request**.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

_Built with ❤️ for the AI era._
