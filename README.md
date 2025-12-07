# AI-Lifecycle-Observer

A self-learning observer agent that monitors AI dev lifecycle tools, tracks execution metrics, detects improvement opportunities, and manages urgent issue alerts.

## Features

- **Execution Tracking** - Automatically track tool executions with metrics and context
- **Improvement Detection** - Rule-based and AI-powered detection of improvement opportunities
- **Alert Management** - Urgent issue detection with configurable thresholds and notifications
- **Reporting** - Generate FUTURE-IMPROVEMENTS.md and DEV-LIFECYCLE-IMPROVEMENTS.md reports
- **CLI Interface** - Full command-line interface for status, metrics, alerts, and more
- **Tool Integrations** - Pre-built helpers for all lifecycle tools

## Supported Tools

- **AI-PR-Dev** - Automated PR review and feedback
- **AI-Feature-Builder** - Feature implementation from specs
- **AI-Test-Generator** - Automated test generation
- **AI-Docs-Generator** - Documentation generation
- **AI-SQL-Dev** - RLS policy and migration generation

## Quick Start

### Installation

```bash
npm install lifecycle-observer
```

### Initialize Configuration

```bash
lifecycle-observer init
```

This creates a `.lifecyclerc.json` configuration file.

### Check Status

```bash
lifecycle-observer status
```

### Start Observer

```bash
# Single observation pass
lifecycle-observer observe

# Continuous daemon mode
lifecycle-observer observe --daemon
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize configuration |
| `status` | Show current health status |
| `metrics` | View execution metrics |
| `alerts` | Manage alerts |
| `report` | Generate improvement reports |
| `observe` | Start the observer |

### Global Options

```bash
lifecycle-observer [command] --verbose    # Enable debug output
lifecycle-observer [command] --json       # Output as JSON
lifecycle-observer [command] --config <path>  # Custom config path
```

### Examples

```bash
# View metrics for the last week
lifecycle-observer metrics --period weekly

# Export metrics to CSV
lifecycle-observer metrics --export csv

# Filter metrics by tool
lifecycle-observer metrics --tool ai-pr-dev

# List active alerts
lifecycle-observer alerts

# Acknowledge an alert
lifecycle-observer alerts ack <alert-id>

# Resolve an alert
lifecycle-observer alerts resolve <alert-id> --resolution "Fixed the issue"

# Generate reports (dry-run)
lifecycle-observer report --dry-run

# Generate report for specific project
lifecycle-observer report --project ai-test-generator
```

## Integrating with Your Tools

### Basic Wrapper

```typescript
import { wrapTool } from 'lifecycle-observer';

const wrappedGenerate = wrapTool('ai-test-generator', 'generate', async (options) => {
  // Your existing logic
  const result = await generateTests(options);
  return {
    testsGenerated: result.tests.length,
    ...result,
  };
}, {
  captureMetrics: ['testsGenerated']
});

export const generate = wrappedGenerate;
```

### Tool-Specific Helper

```typescript
import { createTestGeneratorIntegration } from 'lifecycle-observer';

const wrappedGenerate = createTestGeneratorIntegration('generate', async (options) => {
  const result = await generateTests(options);
  return {
    success: true,
    testsGenerated: result.tests.length,
    coverageIncrease: result.coverageDelta,
  };
});
```

See [Integration Guide](docs/integrations/README.md) for detailed examples for each tool.

## Configuration

Create `.lifecyclerc.json` in your project root:

```json
{
  "enabled": true,
  "projectsDir": "~/Dev/shared",
  "dataDir": "~/.lifecycle-observer",
  "logLevel": "info",
  
  "projects": [
    {
      "name": "AI-Test-Generator",
      "path": "~/Dev/shared/AI-Test-Generator",
      "enabled": true,
      "tools": ["ai-test-generator"]
    }
  ],
  
  "ai": {
    "enabled": true,
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250929",
    "apiKey": "env:ANTHROPIC_API_KEY"
  },
  
  "alerts": {
    "enabled": true,
    "thresholds": {
      "consecutiveFailures": 3,
      "failureRateThreshold": 0.30
    }
  },
  
  "reporting": {
    "enabled": true,
    "autoUpdateFiles": true
  }
}
```

See [Configuration Reference](docs/configuration.md) for all options.

## Alert Categories

| Category | Severity | Trigger |
|----------|----------|---------|
| Security Breach | Critical | Secret detected in output |
| Tool Failure | Critical | 3+ consecutive failures |
| API Exhaustion | High | Rate limit hit 5+ times |
| Performance Degradation | Medium | 3x normal duration |
| Coverage Drop | Medium | Test coverage drops >5% |

## Improvement Types

- **Performance** - Duration or efficiency improvements
- **Reliability** - Failure rate or stability improvements
- **Security** - Security-related improvements
- **Feature** - New feature suggestions
- **Documentation** - Documentation improvements
- **Integration** - Cross-tool integration improvements

## Reports

The observer generates two types of reports:

### FUTURE-IMPROVEMENTS.md (Per Project)

```markdown
# Future Improvements - Project Name

## Urgent Issues
...

## Performance Improvements
...

## Security Improvements
...

## Metrics Summary
- Success Rate: 95%
- Avg Duration: 1.5s
- Open Improvements: 3
```

### DEV-LIFECYCLE-IMPROVEMENTS.md (Lifecycle-Wide)

```markdown
# Dev Lifecycle Improvements

## Overall Health Score: 92/100

## Tool Performance
...

## Cross-Project Patterns
...

## AI Recommendations
...
```

## Architecture

```
lifecycle-observer/
├── src/
│   ├── cli/           # CLI commands
│   ├── collectors/    # Execution & metric collection
│   ├── core/          # Detection & alert logic
│   ├── database/      # SQLite storage
│   ├── reporters/     # Report generation
│   ├── integrations/  # Tool integration helpers
│   └── types/         # TypeScript types
├── docs/
│   ├── configuration.md
│   ├── troubleshooting.md
│   └── integrations/
└── __tests__/
    ├── unit/
    └── integration/
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build

# Run CLI locally
npm run cli -- status
```

## Requirements

- Node.js >= 20.0.0
- SQLite (via better-sqlite3)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | API key for Claude AI analysis |
| `GITHUB_TOKEN` | Token for GitHub issue creation |
| `LIFECYCLE_OBSERVER_ENABLED` | Set to `false` to disable tracking |
| `LIFECYCLE_OBSERVER_CONFIG` | Path to config file |

## Troubleshooting

See [Troubleshooting Guide](docs/troubleshooting.md) for common issues.

## License

MIT

## Author

Brendan Daly

