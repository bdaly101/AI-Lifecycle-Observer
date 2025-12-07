/**
 * Markdown Generator - Generates markdown reports using Handlebars templates
 */

import Handlebars from 'handlebars';
import { formatDate, formatDateTime } from '../utils/time.js';
import type {
  ImprovementSuggestion,
  ImprovementSeverity,
  ImprovementType,
  Alert,
  AlertSeverity,
  TrendDirection,
} from '../types/index.js';

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (date: Date | string | number) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  return formatDate(d);
});

Handlebars.registerHelper('formatDateTime', (date: Date | string | number) => {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : new Date(date);
  return formatDateTime(d);
});

Handlebars.registerHelper('severityEmoji', (severity: ImprovementSeverity | AlertSeverity) => {
  const emojis: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    urgent: '🔴',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  };
  return emojis[severity] || '⚪';
});

Handlebars.registerHelper('trendEmoji', (trend: TrendDirection) => {
  const emojis: Record<TrendDirection, string> = {
    improving: '📈',
    stable: '➡️',
    degrading: '📉',
  };
  return emojis[trend] || '➡️';
});

Handlebars.registerHelper('typeEmoji', (type: ImprovementType) => {
  const emojis: Record<ImprovementType, string> = {
    performance: '⚡',
    reliability: '🔧',
    usability: '✨',
    security: '🛡️',
    feature: '🎯',
    documentation: '📝',
    integration: '🔗',
  };
  return emojis[type] || '📋';
});

Handlebars.registerHelper('percentage', (value: number, decimals = 1) => {
  if (value == null || isNaN(value)) return 'N/A';
  return (value * 100).toFixed(typeof decimals === 'number' ? decimals : 1) + '%';
});

Handlebars.registerHelper('duration', (ms: number) => {
  if (ms == null || isNaN(ms)) return 'N/A';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
});

Handlebars.registerHelper('priorityLabel', (index: number) => {
  const labels = ['High', 'Medium', 'Low'];
  return labels[index] || 'Other';
});

Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
Handlebars.registerHelper('and', (a: unknown, b: unknown) => a && b);
Handlebars.registerHelper('or', (a: unknown, b: unknown) => a || b);
Handlebars.registerHelper('not', (a: unknown) => !a);

Handlebars.registerHelper('join', (arr: unknown[], separator: string) => {
  if (!Array.isArray(arr)) return '';
  return arr.join(typeof separator === 'string' ? separator : ', ');
});

Handlebars.registerHelper('length', (arr: unknown[]) => {
  return Array.isArray(arr) ? arr.length : 0;
});

Handlebars.registerHelper('ifEmpty', function (this: unknown, arr: unknown[], options: Handlebars.HelperOptions) {
  if (!arr || (Array.isArray(arr) && arr.length === 0)) {
    return options.fn(this);
  }
  return options.inverse(this);
});

/**
 * Future Improvements template
 */
export const FUTURE_IMPROVEMENTS_TEMPLATE = `# Future Improvements - {{projectName}}

> Auto-updated by Lifecycle Observer Agent
> Last Updated: {{formatDateTime lastUpdated}}

## 🚨 Urgent Issues

{{#if urgentIssues.length}}
| ID | Issue | Severity | Detected | Status |
|----|-------|----------|----------|--------|
{{#each urgentIssues}}
| {{id}} | {{title}} | {{severityEmoji severity}} {{severity}} | {{formatDate detectedAt}} | {{status}} |
{{/each}}
{{else}}
No urgent issues detected. ✅
{{/if}}

## 📈 Performance Improvements

{{#if performanceImprovements.length}}
{{#each performanceImprovements}}
- [ ] **[{{id}}]** {{title}}
  - Context: {{detectionContext}}
  - Suggested Action: {{suggestedAction}}
  - Est. Impact: {{estimatedImpact}} | Est. Effort: {{estimatedEffort}}

{{/each}}
{{else}}
No performance improvements suggested.
{{/if}}

## 🛡️ Security Improvements

{{#if securityImprovements.length}}
{{#each securityImprovements}}
- [ ] **[{{id}}]** {{title}}
  - {{description}}
  - Action: {{suggestedAction}}

{{/each}}
{{else}}
No security improvements suggested.
{{/if}}

## 🔧 Reliability Improvements

{{#if reliabilityImprovements.length}}
{{#each reliabilityImprovements}}
- [ ] **[{{id}}]** {{title}}
  - {{description}}
  - Action: {{suggestedAction}}

{{/each}}
{{else}}
No reliability improvements suggested.
{{/if}}

## ✨ Feature Suggestions

{{#if featureSuggestions.length}}
{{#each featureSuggestions}}
- [ ] **[{{id}}]** {{title}}
  - {{description}}

{{/each}}
{{else}}
No feature suggestions.
{{/if}}

## 📝 Documentation Improvements

{{#if documentationImprovements.length}}
{{#each documentationImprovements}}
- [ ] **[{{id}}]** {{title}}
  - {{description}}
  - Action: {{suggestedAction}}

{{/each}}
{{else}}
No documentation improvements suggested.
{{/if}}

## 🔗 Integration Improvements

{{#if integrationImprovements.length}}
{{#each integrationImprovements}}
- [ ] **[{{id}}]** {{title}}
  - {{description}}
  - Action: {{suggestedAction}}

{{/each}}
{{else}}
No integration improvements suggested.
{{/if}}

## 📊 Metrics Summary

| Metric | Current | Target | Trend |
|--------|---------|--------|-------|
| Success Rate | {{percentage metrics.successRate}} | 99% | {{trendEmoji metrics.successRateTrend}} |
| Avg Duration | {{duration metrics.avgDuration}} | {{duration metrics.targetDuration}} | {{trendEmoji metrics.durationTrend}} |
| Open Improvements | {{metrics.openImprovements}} | 0 | {{#if (gt metrics.openImprovements 0)}}📉{{else}}✅{{/if}} |
| Active Alerts | {{metrics.activeAlerts}} | 0 | {{#if (gt metrics.activeAlerts 0)}}📉{{else}}✅{{/if}} |

## 📝 Improvement History

{{#if recentlyResolved.length}}
{{#each recentlyResolved}}
- ✅ **[{{id}}]** {{title}} - Resolved {{formatDate statusUpdatedAt}}
{{/each}}
{{else}}
No recently resolved improvements.
{{/if}}

---
*Generated by Lifecycle Observer v{{version}}*
`;

/**
 * Dev Lifecycle Improvements template for cross-project insights
 */
export const LIFECYCLE_IMPROVEMENTS_TEMPLATE = `# Dev Lifecycle Improvements

> Auto-updated by Lifecycle Observer Agent
> Last Updated: {{formatDateTime lastUpdated}}

## 🌐 Lifecycle Overview

| Metric | Value |
|--------|-------|
| Total Projects | {{stats.totalProjects}} |
| Total Executions | {{stats.totalExecutions}} |
| Overall Success Rate | {{percentage stats.overallSuccessRate}} |
| Active Alerts | {{stats.activeAlerts}} |
| Open Improvements | {{stats.openImprovements}} |

## 🚨 Critical Issues Across Projects

{{#if criticalAlerts.length}}
| Project | Issue | Severity | Triggered |
|---------|-------|----------|-----------|
{{#each criticalAlerts}}
| {{project}} | {{title}} | {{severityEmoji severity}} {{severity}} | {{formatDate triggeredAt}} |
{{/each}}
{{else}}
No critical issues across projects. ✅
{{/if}}

## 📊 Tool Performance Summary

| Tool | Executions | Success Rate | Avg Duration | Status |
|------|------------|--------------|--------------|--------|
{{#each toolMetrics}}
| {{tool}} | {{executions}} | {{percentage successRate}} | {{duration avgDuration}} | {{#if (gt successRate 0.95)}}✅{{else if (gt successRate 0.80)}}🟡{{else}}🔴{{/if}} |
{{/each}}

## 🔄 Cross-Project Patterns

{{#if crossProjectPatterns.length}}
{{#each crossProjectPatterns}}
### {{typeEmoji type}} {{title}}

**Affected Projects:** {{join affectedProjects ", "}}  
**Description:** {{description}}  
**Suggested Action:** {{suggestedAction}}

---
{{/each}}
{{else}}
No cross-project patterns detected.
{{/if}}

## 📈 Trend Analysis

### Success Rate Trend (Last 7 Days)
{{#if successRateTrend}}
| Date | Success Rate |
|------|--------------|
{{#each successRateTrend}}
| {{date}} | {{percentage rate}} |
{{/each}}
{{else}}
No data available.
{{/if}}

### Improvement Resolution Rate
- **Detected this week:** {{weeklyStats.improvementsDetected}}
- **Resolved this week:** {{weeklyStats.improvementsResolved}}
- **Resolution rate:** {{percentage weeklyStats.resolutionRate}}

## 🛠️ Lifecycle-Wide Recommendations

{{#if recommendations.length}}
{{#each recommendations}}
{{@index}}. {{this}}
{{/each}}
{{else}}
No recommendations at this time.
{{/if}}

## 📁 Per-Project Status

{{#each projectStatuses}}
### {{name}}

| Metric | Value |
|--------|-------|
| Health Score | {{healthScore}}/100 |
| Success Rate | {{percentage successRate}} |
| Open Improvements | {{openImprovements}} |
| Active Alerts | {{activeAlerts}} |

{{#if topIssues.length}}
**Top Issues:**
{{#each topIssues}}
- {{severityEmoji severity}} {{title}}
{{/each}}
{{/if}}

---
{{/each}}

---
*Generated by Lifecycle Observer v{{version}}*
`;

/**
 * Urgent Issues template for dedicated urgent issue tracking
 */
export const URGENT_ISSUES_TEMPLATE = `# Urgent Issues

> Auto-updated by Lifecycle Observer Agent
> Last Updated: {{formatDateTime lastUpdated}}

## 🚨 Active Critical Alerts

{{#if criticalAlerts.length}}
{{#each criticalAlerts}}
### {{severityEmoji severity}} {{title}}

- **ID:** {{id}}
- **Category:** {{category}}
- **Project:** {{project}}
- **Triggered:** {{formatDateTime triggeredAt}}
- **Status:** {{status}}

**Message:**  
{{message}}

{{#if relatedExecutions.length}}
**Related Executions:** {{join relatedExecutions ", "}}
{{/if}}

---
{{/each}}
{{else}}
No critical alerts active. ✅
{{/if}}

## ⚠️ Active Warnings

{{#if warnings.length}}
| ID | Issue | Project | Triggered | Age |
|----|-------|---------|-----------|-----|
{{#each warnings}}
| {{id}} | {{title}} | {{project}} | {{formatDateTime triggeredAt}} | {{age}} |
{{/each}}
{{else}}
No active warnings.
{{/if}}

## 🔴 Urgent Improvements

{{#if urgentImprovements.length}}
{{#each urgentImprovements}}
### {{typeEmoji type}} {{title}}

- **ID:** {{id}}
- **Affected Tools:** {{join affectedTools ", "}}
- **Detected:** {{formatDateTime detectedAt}}

**Description:**  
{{description}}

**Suggested Action:**  
{{suggestedAction}}

---
{{/each}}
{{else}}
No urgent improvements pending.
{{/if}}

## 📅 Recently Resolved

{{#if recentlyResolved.length}}
| ID | Issue | Resolved | Resolution |
|----|-------|----------|------------|
{{#each recentlyResolved}}
| {{id}} | {{title}} | {{formatDate resolvedAt}} | {{resolution}} |
{{/each}}
{{else}}
No recent resolutions.
{{/if}}

---
*Generated by Lifecycle Observer v{{version}}*
`;

/**
 * Data for Future Improvements template
 */
export interface FutureImprovementsData {
  projectName: string;
  lastUpdated: Date;
  urgentIssues: ImprovementSuggestion[];
  performanceImprovements: ImprovementSuggestion[];
  securityImprovements: ImprovementSuggestion[];
  reliabilityImprovements: ImprovementSuggestion[];
  featureSuggestions: ImprovementSuggestion[];
  documentationImprovements: ImprovementSuggestion[];
  integrationImprovements: ImprovementSuggestion[];
  metrics: {
    successRate: number;
    successRateTrend: TrendDirection;
    avgDuration: number;
    targetDuration: number;
    durationTrend: TrendDirection;
    openImprovements: number;
    activeAlerts: number;
  };
  recentlyResolved: ImprovementSuggestion[];
  version: string;
}

/**
 * Data for Lifecycle Improvements template
 */
export interface LifecycleImprovementsData {
  lastUpdated: Date;
  stats: {
    totalProjects: number;
    totalExecutions: number;
    overallSuccessRate: number;
    activeAlerts: number;
    openImprovements: number;
  };
  criticalAlerts: Alert[];
  toolMetrics: Array<{
    tool: string;
    executions: number;
    successRate: number;
    avgDuration: number;
  }>;
  crossProjectPatterns: ImprovementSuggestion[];
  successRateTrend: Array<{ date: string; rate: number }>;
  weeklyStats: {
    improvementsDetected: number;
    improvementsResolved: number;
    resolutionRate: number;
  };
  recommendations: string[];
  projectStatuses: Array<{
    name: string;
    healthScore: number;
    successRate: number;
    openImprovements: number;
    activeAlerts: number;
    topIssues: ImprovementSuggestion[];
  }>;
  version: string;
}

/**
 * Data for Urgent Issues template
 */
export interface UrgentIssuesData {
  lastUpdated: Date;
  criticalAlerts: Array<Alert & { age?: string }>;
  warnings: Array<Alert & { age?: string }>;
  urgentImprovements: ImprovementSuggestion[];
  recentlyResolved: Array<{
    id: string;
    title: string;
    resolvedAt: Date;
    resolution: string;
  }>;
  version: string;
}

// Compile templates
const futureImprovementsTemplate = Handlebars.compile(FUTURE_IMPROVEMENTS_TEMPLATE);
const lifecycleImprovementsTemplate = Handlebars.compile(LIFECYCLE_IMPROVEMENTS_TEMPLATE);
const urgentIssuesTemplate = Handlebars.compile(URGENT_ISSUES_TEMPLATE);

/**
 * Generate Future Improvements markdown
 */
export function generateFutureImprovements(data: FutureImprovementsData): string {
  return futureImprovementsTemplate(data);
}

/**
 * Generate Lifecycle Improvements markdown
 */
export function generateLifecycleImprovements(data: LifecycleImprovementsData): string {
  return lifecycleImprovementsTemplate(data);
}

/**
 * Generate Urgent Issues markdown
 */
export function generateUrgentIssues(data: UrgentIssuesData): string {
  return urgentIssuesTemplate(data);
}

/**
 * Get the version from package.json
 */
export function getVersion(): string {
  // For now, return a static version. In production, read from package.json
  return '1.0.0';
}

/**
 * Calculate age string from a date
 */
export function calculateAge(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMinutes > 0) return `${diffMinutes}m`;
  return '<1m';
}

