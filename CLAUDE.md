# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
- `npm run dev` - Start the development server with custom WebSocket integration
- `npm run build` - Build the Next.js application
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint to check code quality

## Code Style Guidelines
- **Imports**: Use absolute imports with `@/` prefix (e.g., `import { Component } from '@/components/Component'`)
- **Typing**: Use TypeScript interfaces for data models, always define explicit return types
- **Components**: Use functional components with React hooks, client components marked with 'use client'
- **Naming**:
  - PascalCase for components, interfaces, and classes
  - camelCase for variables, functions, and methods
  - snake_case for filenames is discouraged
- **Error Handling**: Use try/catch blocks for WebSocket communication, log errors to console
- **Socket Events**: Follow the pattern of emitting/listening to specific named events
- **Architecture**: Keep game logic in `/src/game` directory, UI components in `/src/components`
- **CSS**: Use TailwindCSS utility classes for styling

Always run `npm run lint` before committing changes.