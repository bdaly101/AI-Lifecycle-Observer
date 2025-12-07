# Troubleshooting Guide

Common issues and their solutions when using lifecycle-observer.

## Installation Issues

### Native Module Build Failures

**Problem**: Error building `better-sqlite3` native module.

```
npm ERR! gyp ERR! build error
npm ERR! gyp ERR! stack Error: `make` failed with exit code: 2
```

**Solutions**:

1. Ensure you have build tools installed:

   **macOS**:
   ```bash
   xcode-select --install
   ```

   **Ubuntu/Debian**:
   ```bash
   sudo apt-get install build-essential python3
   ```

   **Windows**:
   ```bash
   npm install --global windows-build-tools
   ```

2. Try rebuilding:
   ```bash
   npm rebuild better-sqlite3
   ```

3. Use a prebuilt binary:
   ```bash
   npm install better-sqlite3 --build-from-source=false
   ```

### Permission Errors

**Problem**: `EACCES` permission denied errors.

**Solution**: Don't use `sudo` with npm. Fix permissions instead:

```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

## Configuration Issues

### Config File Not Found

**Problem**: `Error: No configuration file found`

**Solutions**:

1. Create a configuration file:
   ```bash
   lifecycle-observer init
   ```

2. Specify config path:
   ```bash
   lifecycle-observer status --config /path/to/.lifecyclerc.json
   ```

3. Set environment variable:
   ```bash
   export LIFECYCLE_OBSERVER_CONFIG=/path/to/.lifecyclerc.json
   ```

### Environment Variable Not Set

**Problem**: `Error: Environment variable ANTHROPIC_API_KEY is not set`

**Solution**: Set the required environment variable:

```bash
export ANTHROPIC_API_KEY=your-api-key

# Or add to your shell profile
echo 'export ANTHROPIC_API_KEY=your-api-key' >> ~/.zshrc
```

### Invalid Configuration

**Problem**: `Error: Invalid configuration: ...`

**Common causes**:

1. **Missing required fields**:
   ```json
   {
     "projects": [
       {
         "name": "My Project"
         // Missing "path" field
       }
     ]
   }
   ```

2. **Invalid log level**:
   ```json
   {
     "logLevel": "verbose"  // Should be: silent, error, warn, info, debug, trace
   }
   ```

3. **Invalid threshold values**:
   ```json
   {
     "alerts": {
       "thresholds": {
         "failureRateThreshold": 1.5  // Should be between 0 and 1
       }
     }
   }
   ```

## Database Issues

### Database Locked

**Problem**: `SQLITE_BUSY: database is locked`

**Solutions**:

1. Check for other processes using the database:
   ```bash
   lsof ~/.lifecycle-observer/data.db
   ```

2. Kill stuck processes:
   ```bash
   pkill -f lifecycle-observer
   ```

3. Reset the database:
   ```bash
   rm ~/.lifecycle-observer/data.db
   lifecycle-observer status  # Will recreate
   ```

### Database Corruption

**Problem**: `SQLITE_CORRUPT: database disk image is malformed`

**Solution**: Reset the database:

```bash
# Backup if needed
cp ~/.lifecycle-observer/data.db ~/.lifecycle-observer/data.db.bak

# Remove and recreate
rm ~/.lifecycle-observer/data.db
lifecycle-observer status
```

### Migration Errors

**Problem**: Database migration fails.

**Solution**: Reset the database (see above) or check logs:

```bash
lifecycle-observer status --verbose
```

## CLI Issues

### Command Not Found

**Problem**: `lifecycle-observer: command not found`

**Solutions**:

1. Install globally:
   ```bash
   npm install -g lifecycle-observer
   ```

2. Use npx:
   ```bash
   npx lifecycle-observer status
   ```

3. Check PATH:
   ```bash
   npm bin -g
   # Add the output to your PATH
   ```

### No Output

**Problem**: Command runs but produces no output.

**Solutions**:

1. Check if observer is enabled:
   ```json
   {
     "enabled": true
   }
   ```

2. Use verbose mode:
   ```bash
   lifecycle-observer status --verbose
   ```

3. Use JSON output:
   ```bash
   lifecycle-observer status --json
   ```

### Slow Performance

**Problem**: Commands take a long time to execute.

**Solutions**:

1. Reduce data retention:
   ```json
   {
     "database": {
       "retentionDays": 30
     }
   }
   ```

2. Disable AI analysis:
   ```json
   {
     "ai": {
       "enabled": false
     }
   }
   ```

3. Reduce projects monitored.

## Integration Issues

### Executions Not Being Tracked

**Problem**: Tool executions aren't appearing in metrics.

**Checklist**:

1. **Observer enabled?**
   ```bash
   echo $LIFECYCLE_OBSERVER_ENABLED  # Should not be "false"
   ```

2. **Project configured?**
   ```json
   {
     "projects": [
       {
         "name": "My Project",
         "path": "/path/to/project",
         "enabled": true,
         "tools": ["ai-test-generator"]
       }
     ]
   }
   ```

3. **Wrapper applied?**
   ```typescript
   import { wrapTool } from 'lifecycle-observer';
   
   export const myFunction = wrapTool('ai-test-generator', 'command', originalFunction);
   ```

4. **Database accessible?**
   ```bash
   ls -la ~/.lifecycle-observer/data.db
   ```

### Wrapper Errors

**Problem**: Error when using `wrapTool()`.

**Common causes**:

1. **Wrong tool name**:
   ```typescript
   // Wrong
   wrapTool('test-generator', ...)
   
   // Correct
   wrapTool('ai-test-generator', ...)
   ```

2. **Function signature mismatch**:
   ```typescript
   // Ensure your function returns a Promise
   const fn = async (options) => { ... };
   wrapTool('ai-test-generator', 'generate', fn);
   ```

### Test Failures

**Problem**: Tests fail when using lifecycle-observer.

**Solution**: Disable tracking in tests:

```typescript
const wrapped = wrapTool('tool', 'cmd', fn, {
  enabled: false  // Disable in tests
});
```

Or set environment variable:

```bash
LIFECYCLE_OBSERVER_ENABLED=false npm test
```

## Alert Issues

### Alerts Not Triggering

**Problem**: Expected alerts are not being triggered.

**Checklist**:

1. **Alerts enabled?**
   ```json
   {
     "alerts": {
       "enabled": true
     }
   }
   ```

2. **Thresholds configured?**
   ```json
   {
     "alerts": {
       "thresholds": {
         "consecutiveFailures": 3
       }
     }
   }
   ```

3. **Channels enabled?**
   ```json
   {
     "alerts": {
       "channels": {
         "console": true
       }
     }
   }
   ```

4. **Check cooldown** - alerts have a default cooldown of 60 minutes.

### Too Many Alerts

**Problem**: Getting flooded with alerts.

**Solutions**:

1. Increase thresholds:
   ```json
   {
     "alerts": {
       "thresholds": {
         "consecutiveFailures": 5,
         "failureRateThreshold": 0.50
       }
     }
   }
   ```

2. Suppress noisy alerts:
   ```bash
   lifecycle-observer alerts suppress <id> --until "2024-12-08"
   ```

### GitHub Issues Not Created

**Problem**: GitHub alerts enabled but issues not being created.

**Checklist**:

1. **Token set?**
   ```bash
   echo $GITHUB_TOKEN
   ```

2. **Token has permissions?** - Needs `repo` scope for private repos.

3. **GitHub CLI authenticated?**
   ```bash
   gh auth status
   ```

4. **Configuration correct?**
   ```json
   {
     "alerts": {
       "channels": {
         "github": {
           "enabled": true,
           "token": "env:GITHUB_TOKEN",
           "createIssues": true
         }
       }
     }
   }
   ```

## Report Issues

### Reports Not Generating

**Problem**: FUTURE-IMPROVEMENTS.md not being updated.

**Checklist**:

1. **Reporting enabled?**
   ```json
   {
     "reporting": {
       "enabled": true,
       "autoUpdateFiles": true
     }
   }
   ```

2. **Project path writable?**
   ```bash
   touch /path/to/project/FUTURE-IMPROVEMENTS.md
   ```

3. **Manual generation**:
   ```bash
   lifecycle-observer report --project my-project
   ```

### Empty Reports

**Problem**: Reports generated but contain no data.

**Solutions**:

1. Check for executions:
   ```bash
   lifecycle-observer metrics
   ```

2. Check for improvements:
   ```bash
   lifecycle-observer status
   ```

3. Run in verbose mode:
   ```bash
   lifecycle-observer report --verbose
   ```

## Debug Mode

Enable debug logging for detailed information:

```bash
# Via CLI
lifecycle-observer status --verbose

# Via config
{
  "logLevel": "debug"
}

# Via environment
DEBUG=lifecycle-observer:* lifecycle-observer status
```

## Getting Help

If you're still having issues:

1. Check the [GitHub Issues](https://github.com/bdaly101/AI-Lifecycle-Observer/issues)
2. Create a new issue with:
   - Error message
   - Configuration (redact sensitive values)
   - Node.js version (`node --version`)
   - OS and version
   - Steps to reproduce

## FAQ

### Q: How much overhead does the observer add?

**A**: Typically 5-10ms per execution. Most operations are async and don't block your tool's main execution.

### Q: Can I use this with tools not in the lifecycle suite?

**A**: Yes! Use the generic `wrapTool()` function with any tool name. However, only the five lifecycle tools have pre-built integration helpers with typed metrics.

### Q: How do I completely disable the observer?

**A**: Set the environment variable:
```bash
export LIFECYCLE_OBSERVER_ENABLED=false
```

### Q: Where is data stored?

**A**: By default in `~/.lifecycle-observer/`:
- `data.db` - SQLite database
- `alerts/` - Alert history files
- `logs/` - Log files (if file logging enabled)

### Q: How do I migrate data to a new machine?

**A**: Copy the entire `~/.lifecycle-observer/` directory to the new machine.

### Q: Can multiple projects share one observer?

**A**: Yes! Configure all projects in one `.lifecyclerc.json` and they'll share the same database and reports.

