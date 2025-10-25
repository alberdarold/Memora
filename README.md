# Memora - AI-Ready Screen Recording

Privacy-first screen recording with AI automation capabilities.

## Architecture
- Screenpipe: Background capture service
- Memora UI: Custom Electron interface
- Plugins: Extend functionality

## Setup
1. Install Screenpipe
2. Run `npm install` in memora-ui
3. Run `bun install` in each plugin directory

## Development

### Prerequisites
- Node.js 20.x or later
- Rust toolchain
- Bun
- Git

### Quick Start
1. Clone this repository
2. Install Screenpipe: `iwr get.screenpi.pe/cli.ps1 | iex`
3. Start Screenpipe: `screenpipe`
4. Install UI dependencies: `cd memora-ui && npm install`
5. Start development: `npm run start`

## Project Structure
```
Memora/
├── memora-ui/          # Electron + React frontend
├── memora-plugins/     # Screenpipe plugins
│   ├── ai-export/     # AI-ready data export
│   ├── search-plus/   # Enhanced search
│   └── event-capture/ # Keyboard/mouse events
├── memora-api/         # Optional API wrapper
├── docs/              # Documentation
└── tests/             # Test suites
```

## Features
- Continuous screen recording with OCR
- Privacy-first local storage
- AI-ready data export
- Advanced search capabilities
- Task timeline visualization
- Cross-platform support

## License
MIT
