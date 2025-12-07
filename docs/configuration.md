# Configuration Reference

Complete reference for the `.lifecyclerc.json` configuration file.

## Configuration File Locations

The observer searches for configuration in the following order:

1. Path specified via `--config` CLI option
2. `LIFECYCLE_OBSERVER_CONFIG` environment variable
3. `.lifecyclerc.json` in current directory
4. `.lifecyclerc` in current directory
5. `lifecycle.config.json` in current directory
6. Parent directories (walking up to root)

## Full Configuration Schema

```json
{
  "enabled": true,
  "projectsDir": "~/Dev/shared",
  "dataDir": "~/.lifecycle-observer",
  "logLevel": "info",
  
  "projects": [],
  "ai": {},
  "alerts": {},
  "reporting": {},
  "database": {}
}
```

## Top-Level Options

### `enabled`

**Type**: `boolean`  
**Default**: `true`

Enable or disable the lifecycle observer globally.

```json
{
  "enabled": true
}
```

### `projectsDir`

**Type**: `string`  
**Default**: `"~/Dev/shared"`

Base directory containing your projects. Supports `~` for home directory.

```json
{
  "projectsDir": "~/Dev/my-projects"
}
```

### `dataDir`

**Type**: `string`  
**Default**: `"~/.lifecycle-observer"`

Directory for storing observer data (database, logs, etc.).

```json
{
  "dataDir": "~/.lifecycle-observer"
}
```

### `logLevel`

**Type**: `string`  
**Default**: `"info"`  
**Options**: `"silent"`, `"error"`, `"warn"`, `"info"`, `"debug"`, `"trace"`

Logging verbosity level.

```json
{
  "logLevel": "debug"
}
```

## Projects Configuration

### `projects`

**Type**: `ProjectConfig[]`

Array of project configurations to monitor.

```json
{
  "projects": [
    {
      "name": "AI-Test-Generator",
      "path": "~/Dev/shared/AI-Test-Generator",
      "enabled": true,
      "tools": ["ai-test-generator"],
      "branch": "main"
    }
  ]
}
```

### Project Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `name` | string | Yes | - | Display name for the project |
| `path` | string | Yes | - | Absolute path to project root |
| `enabled` | boolean | No | `true` | Whether to monitor this project |
| `tools` | string[] | No | `[]` | Tools used in this project |
| `branch` | string | No | `"main"` | Default branch to monitor |

### Valid Tool Names

- `ai-pr-dev`
- `ai-feature-builder`
- `ai-test-generator`
- `ai-docs-generator`
- `ai-sql-dev`

## AI Configuration

### `ai`

Configuration for AI-powered analysis.

```json
{
  "ai": {
    "enabled": true,
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250929",
    "apiKey": "env:ANTHROPIC_API_KEY",
    "maxTokens": 4096,
    "temperature": 0.3,
    "analyzeEveryNExecutions": 10
  }
}
```

### AI Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable AI analysis |
| `provider` | string | `"anthropic"` | AI provider (only anthropic supported) |
| `model` | string | `"claude-sonnet-4-20250929"` | Model to use |
| `apiKey` | string | - | API key or `env:VAR_NAME` reference |
| `maxTokens` | number | `4096` | Maximum tokens per request |
| `temperature` | number | `0.3` | Response randomness (0-1) |
| `analyzeEveryNExecutions` | number | `10` | Run AI analysis every N executions |

### Environment Variable Reference

Use `env:VARIABLE_NAME` to reference environment variables:

```json
{
  "ai": {
    "apiKey": "env:ANTHROPIC_API_KEY"
  }
}
```

## Alerts Configuration

### `alerts`

Configuration for alert detection and notification.

```json
{
  "alerts": {
    "enabled": true,
    "thresholds": {
      "consecutiveFailures": 3,
      "failureRateThreshold": 0.30,
      "failureRateWindow": 86400000,
      "avgDurationMultiplier": 3,
      "timeoutThreshold": 300000,
      "secretsDetected": true,
      "permissionEscalation": true,
      "unprotectedBranchPush": true,
      "apiFailureRateThreshold": 0.50,
      "apiFailureRateWindow": 3600000,
      "rateLimitHits": 5,
      "gitOperationFailures": 5,
      "gitOperationWindow": 3600000,
      "coverageDropThreshold": 0.05,
      "minimumCoverage": 0.70
    },
    "channels": {
      "console": true,
      "file": true,
      "github": {
        "enabled": false,
        "token": "env:GITHUB_TOKEN",
        "createIssues": true,
        "issueLabels": ["lifecycle-alert", "automated"]
      }
    },
    "escalation": {
      "enabled": false,
      "criticalDelayMinutes": 15,
      "escalateTo": []
    }
  }
}
```

### Threshold Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `consecutiveFailures` | number | `3` | Failures in a row to trigger alert |
| `failureRateThreshold` | number | `0.30` | Failure rate (0-1) to trigger alert |
| `failureRateWindow` | number | `86400000` | Window for failure rate (ms) |
| `avgDurationMultiplier` | number | `3` | Duration multiplier for performance alert |
| `timeoutThreshold` | number | `300000` | Execution timeout (ms) |
| `secretsDetected` | boolean | `true` | Alert on secrets in output |
| `rateLimitHits` | number | `5` | Rate limit hits to trigger alert |
| `coverageDropThreshold` | number | `0.05` | Coverage drop (0-1) to trigger alert |
| `minimumCoverage` | number | `0.70` | Minimum coverage requirement |

### Channel Configuration

#### Console Channel

```json
{
  "channels": {
    "console": true
  }
}
```

#### File Channel

```json
{
  "channels": {
    "file": true
  }
}
```

Writes alerts to `~/.lifecycle-observer/alerts/alerts.md`.

#### GitHub Channel

```json
{
  "channels": {
    "github": {
      "enabled": true,
      "token": "env:GITHUB_TOKEN",
      "createIssues": true,
      "issueLabels": ["lifecycle-alert", "automated"]
    }
  }
}
```

## Reporting Configuration

### `reporting`

Configuration for report generation.

```json
{
  "reporting": {
    "enabled": true,
    "autoUpdateFiles": true,
    "updateFrequency": "immediate",
    "futureImprovementsFilename": "FUTURE-IMPROVEMENTS.md",
    "includeMetrics": true,
    "includeHistory": true
  }
}
```

### Reporting Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable report generation |
| `autoUpdateFiles` | boolean | `true` | Auto-update .md files |
| `updateFrequency` | string | `"immediate"` | When to update (`immediate`, `daily`, `weekly`) |
| `futureImprovementsFilename` | string | `"FUTURE-IMPROVEMENTS.md"` | Per-project report filename |
| `includeMetrics` | boolean | `true` | Include metrics in reports |
| `includeHistory` | boolean | `true` | Include historical data |

## Database Configuration

### `database`

Configuration for SQLite database.

```json
{
  "database": {
    "path": "~/.lifecycle-observer/data.db",
    "retentionDays": 90,
    "aggregationIntervals": ["hourly", "daily", "weekly"]
  }
}
```

### Database Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `path` | string | `"~/.lifecycle-observer/data.db"` | Database file path |
| `retentionDays` | number | `90` | Days to retain execution data |
| `aggregationIntervals` | string[] | `["hourly", "daily", "weekly"]` | Aggregation periods |

## Example Configurations

### Minimal Configuration

```json
{
  "enabled": true,
  "projects": [
    {
      "name": "My Project",
      "path": "~/Dev/my-project",
      "tools": ["ai-test-generator"]
    }
  ]
}
```

### Production Configuration

```json
{
  "enabled": true,
  "projectsDir": "~/Dev/production",
  "dataDir": "/var/lib/lifecycle-observer",
  "logLevel": "warn",
  
  "projects": [
    {
      "name": "Backend API",
      "path": "~/Dev/production/backend",
      "enabled": true,
      "tools": ["ai-pr-dev", "ai-test-generator"]
    },
    {
      "name": "Frontend App",
      "path": "~/Dev/production/frontend",
      "enabled": true,
      "tools": ["ai-pr-dev", "ai-docs-generator"]
    }
  ],
  
  "ai": {
    "enabled": true,
    "provider": "anthropic",
    "apiKey": "env:ANTHROPIC_API_KEY",
    "analyzeEveryNExecutions": 5
  },
  
  "alerts": {
    "enabled": true,
    "thresholds": {
      "consecutiveFailures": 2,
      "failureRateThreshold": 0.20
    },
    "channels": {
      "console": true,
      "file": true,
      "github": {
        "enabled": true,
        "token": "env:GITHUB_TOKEN",
        "createIssues": true
      }
    }
  },
  
  "database": {
    "retentionDays": 180
  }
}
```

### Development Configuration

```json
{
  "enabled": true,
  "logLevel": "debug",
  
  "projects": [
    {
      "name": "Dev Project",
      "path": ".",
      "tools": ["ai-test-generator"]
    }
  ],
  
  "ai": {
    "enabled": false
  },
  
  "alerts": {
    "enabled": true,
    "channels": {
      "console": true,
      "file": false
    }
  }
}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `LIFECYCLE_OBSERVER_CONFIG` | Config file path | `/path/to/.lifecyclerc.json` |
| `LIFECYCLE_OBSERVER_ENABLED` | Enable/disable globally | `true`, `false` |
| `ANTHROPIC_API_KEY` | Anthropic API key | `sk-ant-...` |
| `GITHUB_TOKEN` | GitHub personal access token | `ghp_...` |

## Validation

The configuration is validated on load. Invalid configurations will cause the observer to exit with an error message describing the issue.

Common validation errors:

- Missing required `name` or `path` in project
- Invalid `logLevel` value
- Invalid threshold values (e.g., negative numbers)
- Missing environment variables referenced with `env:`

