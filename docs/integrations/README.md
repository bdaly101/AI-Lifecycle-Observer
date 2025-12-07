# Lifecycle Observer Integration Guide

This guide explains how to integrate the lifecycle-observer into your AI dev lifecycle tools.

## Quick Start

### 1. Install the package

```bash
npm install lifecycle-observer
```

### 2. Initialize configuration

```bash
lifecycle-observer init
```

This creates a `.lifecyclerc.json` configuration file. Edit it to add your projects and tools.

### 3. Wrap your tool functions

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
```

## Tool-Specific Integrations

### AI-PR-Dev

```typescript
import { createPRDevIntegration } from 'lifecycle-observer';

const wrappedReview = createPRDevIntegration('review', async (event) => {
  // Your PR review logic
  const review = await performReview(event.pull_request);
  return {
    success: true,
    filesReviewed: review.files.length,
    commentsAdded: review.comments.length,
    tokensUsed: review.tokensUsed,
    issuesFound: review.issues.length,
  };
});

webhooks.on('pull_request.opened', wrappedReview);
```

**Captured Metrics:**
- `filesReviewed` - Number of files reviewed
- `commentsAdded` - Number of comments added
- `tokensUsed` - AI tokens consumed
- `issuesFound` - Issues identified
- `suggestionsMade` - Suggestions made

### AI-Feature-Builder

```typescript
import { createFeatureBuilderIntegration } from 'lifecycle-observer';

const wrappedImplement = createFeatureBuilderIntegration('implement', async (options) => {
  const result = await implementFeature(options);
  return {
    success: true,
    filesCreated: result.newFiles.length,
    filesModified: result.modifiedFiles.length,
    testsGenerated: result.tests.length,
    linesAdded: result.stats.linesAdded,
  };
});

export const implement = wrappedImplement;
```

**Captured Metrics:**
- `filesCreated` - New files created
- `filesModified` - Existing files modified
- `testsGenerated` - Tests generated
- `linesAdded` - Lines of code added
- `tokensUsed` - AI tokens consumed

### AI-Test-Generator

```typescript
import { createTestGeneratorIntegration } from 'lifecycle-observer';

const wrappedGenerate = createTestGeneratorIntegration('generate', async (options) => {
  const result = await generateTests(options);
  return {
    success: true,
    testsGenerated: result.tests.length,
    testFilesCreated: result.newFiles.length,
    coverageIncrease: result.coverageDelta,
    todosAdded: result.todos.length,
  };
});

export const generate = wrappedGenerate;
```

**Captured Metrics:**
- `testsGenerated` - Number of tests generated
- `coverageIncrease` - Coverage improvement percentage
- `testFilesCreated` - New test files created
- `todosAdded` - TODOs for future tests
- `tokensUsed` - AI tokens consumed

### AI-Docs-Generator

```typescript
import { createDocsGeneratorIntegration } from 'lifecycle-observer';

const wrappedGenerate = createDocsGeneratorIntegration('generate', async (options) => {
  const result = await generateDocs(options);
  return {
    success: true,
    docsUpdated: result.updatedFiles.length,
    jsdocsAdded: result.jsdocCount,
    sectionsGenerated: result.sections.length,
  };
});

export const generate = wrappedGenerate;
```

**Captured Metrics:**
- `docsUpdated` - Documentation files updated
- `jsdocsAdded` - JSDoc comments added
- `sectionsGenerated` - Documentation sections generated
- `readmesUpdated` - README files updated
- `tokensUsed` - AI tokens consumed

### AI-SQL-Dev

```typescript
import { createSQLDevIntegration } from 'lifecycle-observer';

const wrappedGenerate = createSQLDevIntegration('generate', async (options) => {
  const result = await generateRLS(options);
  return {
    success: true,
    policiesGenerated: result.policies.length,
    tablesAnalyzed: result.tables.length,
    migrationsCreated: result.migrations.length,
  };
});

export const generate = wrappedGenerate;
```

**Captured Metrics:**
- `policiesGenerated` - RLS policies generated
- `tablesAnalyzed` - Database tables analyzed
- `migrationsCreated` - Migration files created
- `securityRulesAdded` - Security rules added
- `tokensUsed` - AI tokens consumed

## Advanced Usage

### Manual Execution Tracking

For more control over execution tracking:

```typescript
import { createTrackedExecution } from 'lifecycle-observer';

async function myToolFunction() {
  const { handle, complete, fail, recordMetric } = await createTrackedExecution(
    'ai-test-generator',
    'generate'
  );

  try {
    // Do work...
    recordMetric('testsGenerated', 5);
    recordMetric('coverageIncrease', 0.15);
    
    complete();
  } catch (error) {
    fail(error);
    throw error;
  }
}
```

### Decorator Pattern (TypeScript)

```typescript
import { tracked } from 'lifecycle-observer';

class TestGenerator {
  @tracked('ai-test-generator', 'generate')
  async generate(options: GenerateOptions): Promise<GenerateResult> {
    // Implementation
  }
}
```

### Pre/Post Execution Hooks

```typescript
import { wrapTool } from 'lifecycle-observer';

const wrapped = wrapTool('ai-test-generator', 'generate', myFunction, {
  preExecution: async (handle) => {
    console.log('Starting execution:', handle.command);
  },
  postExecution: async (record) => {
    console.log('Completed:', record.status, record.duration);
  },
});
```

### Custom Error Categorization

```typescript
import { wrapTool } from 'lifecycle-observer';

const wrapped = wrapTool('ai-test-generator', 'generate', myFunction, {
  categorizeError: (error) => {
    if (error.message.includes('rate limit')) return 'rate_limit';
    if (error.message.includes('API')) return 'api_error';
    return 'unknown';
  },
});
```

## Verifying Integration

Check that the observer is properly configured:

```typescript
import { verifyIntegration, formatIntegrationStatus } from 'lifecycle-observer';

const status = await verifyIntegration();

if (!status.ready) {
  console.error('Observer not ready:', status.message);
} else {
  console.log('Observer ready!');
  console.log('Enabled tools:', status.tools);
  console.log('Enabled projects:', status.projects);
}

// Or print formatted status:
console.log(formatIntegrationStatus(status));
```

## Disabling the Observer

### Via Environment Variable

```bash
export LIFECYCLE_OBSERVER_ENABLED=false
```

### Via Wrap Options

```typescript
const wrapped = wrapTool('ai-test-generator', 'generate', myFunction, {
  enabled: false, // Disable tracking for this wrapper
});
```

### Via Configuration

```json
{
  "enabled": false
}
```

## Peer Dependencies

Lifecycle-observer requires:
- Node.js >= 20.0.0
- TypeScript >= 5.0 (for TypeScript projects)

If using better-sqlite3, ensure you have the native build dependencies installed.

## Troubleshooting

### Observer not tracking executions

1. Check configuration exists: `lifecycle-observer status`
2. Verify database is initialized: Check `~/.lifecycle-observer/data.db`
3. Ensure `enabled: true` in configuration

### Performance concerns

- Observer adds ~5-10ms overhead per execution
- Database writes are async where possible
- Use `enabled: false` in performance-critical paths

### Database errors

1. Reset the database: `npm run db:reset`
2. Check file permissions on data directory
3. Ensure SQLite native module is properly installed

