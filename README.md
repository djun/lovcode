<p align="center">
  <img src="docs/assets/logo.svg" width="120" alt="Lovcode Logo">
</p>

<h1 align="center">Lovcode</h1>

<p align="center">A desktop companion app for AI coding tools. Browse Claude Code chat history, manage configurations, commands, skills, and more.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-blue" alt="Tauri">
  <img src="https://img.shields.io/badge/React-19-blue" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.8-blue" alt="TypeScript">
</p>

![Gallery](docs/assets/gallery.png)

## Features

- **Chat History Viewer** - Browse and search conversation history across all projects
- **Commands Manager** - View and manage slash commands (`~/.claude/commands/`)
- **MCP Servers** - Configure and monitor MCP server integrations
- **Skills** - Manage reusable skill templates
- **Hooks** - Configure automation triggers
- **Sub-Agents** - Manage AI agents with custom models
- **Marketplace** - Browse and install community templates

## Installation

```bash
# Install dependencies
pnpm install

# Run development
pnpm tauri dev

# Build for distribution
pnpm tauri build
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Rust, Tauri 2
- **UI Components**: shadcn/ui

## License

MIT
