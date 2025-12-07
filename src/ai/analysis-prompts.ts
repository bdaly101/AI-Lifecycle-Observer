/**
 * AI Analysis Prompts - Prompts for AI-powered improvement detection
 */

/**
 * System prompt for execution analysis
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing software development tool executions and identifying improvement opportunities.

Your role is to analyze execution data from a dev lifecycle consisting of these AI-powered tools:
- ai-pr-dev: Pull request review automation
- ai-feature-builder: Feature implementation from requirements
- ai-test-generator: Automated test generation
- ai-docs-generator: Documentation generation
- ai-sql-dev: SQL migration and database development

Analyze the execution data and identify potential improvements in these categories:

1. **Performance**: Slow executions, duration trends, optimization opportunities
2. **Reliability**: Error patterns, failure rates, flaky behavior
3. **Usability**: Configuration friction, setup complexity, unclear errors
4. **Security**: Potential credential exposure, permission issues
5. **Integration**: Tool compatibility issues, workflow gaps

For each improvement, consider:
- Severity: How urgent is this? (low, medium, high, urgent)
- Impact: What's the benefit of fixing it? (low, medium, high)
- Effort: How hard is it to fix? (low, medium, high)
- Scope: Does it affect one tool, the lifecycle, or both?

Return your analysis as a JSON object with the structure shown in the user prompt.
Be specific and actionable in your suggestions.
Focus on patterns across multiple executions, not isolated incidents.`;

/**
 * User prompt template for execution analysis
 */
export const ANALYSIS_USER_PROMPT = `Analyze the following execution data and identify improvement opportunities.

## Execution Summary
{{executionSummary}}

## Recent Executions (Last {{executionCount}} executions)
{{recentExecutions}}

## Error Summary
{{errorSummary}}

## Tool Statistics
{{toolStats}}

## Current Open Improvements
{{openImprovements}}

---

Please analyze this data and return improvements as JSON:

\`\`\`json
{
  "improvements": [
    {
      "type": "performance|reliability|usability|security|integration",
      "severity": "low|medium|high|urgent",
      "scope": "tool|lifecycle|both",
      "title": "Brief, actionable title",
      "description": "Detailed description of the issue and its impact",
      "suggestedAction": "Specific steps to address this",
      "affectedTools": ["tool-names"],
      "estimatedImpact": "low|medium|high",
      "estimatedEffort": "low|medium|high",
      "tags": ["relevant", "tags"]
    }
  ],
  "summary": "Brief overall assessment of the dev lifecycle health"
}
\`\`\`

Guidelines:
- Only include improvements not already in the open improvements list
- Focus on patterns, not individual failures
- Be specific about which tools are affected
- Provide actionable suggestions`;

/**
 * Generate execution summary for AI analysis
 */
export function generateExecutionSummary(stats: {
  total: number;
  successful: number;
  failed: number;
  avgDuration: number;
  period: string;
}): string {
  const successRate = stats.total > 0 ? ((stats.successful / stats.total) * 100).toFixed(1) : '0';
  return `
Period: ${stats.period}
Total Executions: ${stats.total}
Successful: ${stats.successful} (${successRate}%)
Failed: ${stats.failed}
Average Duration: ${stats.avgDuration.toFixed(0)}ms`;
}

/**
 * Format execution record for AI analysis
 */
export function formatExecutionForAI(execution: {
  tool: string;
  command: string;
  project: string;
  duration: number;
  status: string;
  errorType?: string;
  errorMessage?: string;
  timestamp: Date;
}): string {
  const lines = [
    `- **${execution.tool}** \`${execution.command}\``,
    `  Project: ${execution.project}`,
    `  Status: ${execution.status}`,
    `  Duration: ${execution.duration}ms`,
    `  Time: ${execution.timestamp.toISOString()}`,
  ];

  if (execution.errorType) {
    lines.push(`  Error: ${execution.errorType}`);
    if (execution.errorMessage) {
      // Truncate long error messages
      const message = execution.errorMessage.substring(0, 200);
      lines.push(`  Message: ${message}${execution.errorMessage.length > 200 ? '...' : ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate error summary for AI analysis
 */
export function generateErrorSummary(
  errorCounts: Record<string, number>
): string {
  const entries = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
  
  if (entries.length === 0) {
    return 'No errors in the analyzed period.';
  }

  return entries
    .map(([type, count]) => `- ${type}: ${count} occurrences`)
    .join('\n');
}

/**
 * Generate tool statistics for AI analysis
 */
export function generateToolStats(
  stats: Array<{
    tool: string;
    executions: number;
    successRate: number;
    avgDuration: number;
  }>
): string {
  if (stats.length === 0) {
    return 'No tool statistics available.';
  }

  return stats
    .map(
      (s) =>
        `- **${s.tool}**: ${s.executions} executions, ${(s.successRate * 100).toFixed(1)}% success, ${s.avgDuration.toFixed(0)}ms avg`
    )
    .join('\n');
}

/**
 * Format open improvements for AI analysis
 */
export function formatOpenImprovements(
  improvements: Array<{
    type: string;
    severity: string;
    title: string;
    affectedTools: string[];
  }>
): string {
  if (improvements.length === 0) {
    return 'No open improvements currently tracked.';
  }

  return improvements
    .map(
      (i) =>
        `- [${i.severity.toUpperCase()}] ${i.title} (${i.type}) - Affects: ${i.affectedTools.join(', ')}`
    )
    .join('\n');
}

/**
 * Build the complete user prompt for AI analysis
 */
export function buildAnalysisPrompt(params: {
  executionSummary: string;
  executionCount: number;
  recentExecutions: string;
  errorSummary: string;
  toolStats: string;
  openImprovements: string;
}): string {
  return ANALYSIS_USER_PROMPT
    .replace('{{executionSummary}}', params.executionSummary)
    .replace('{{executionCount}}', params.executionCount.toString())
    .replace('{{recentExecutions}}', params.recentExecutions)
    .replace('{{errorSummary}}', params.errorSummary)
    .replace('{{toolStats}}', params.toolStats)
    .replace('{{openImprovements}}', params.openImprovements);
}

