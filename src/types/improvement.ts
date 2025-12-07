/**
 * Improvement suggestion types for the lifecycle observer
 */

import type { LifecycleTool } from './execution.js';

/**
 * Categories of improvements
 */
export type ImprovementType =
  | 'performance'
  | 'reliability'
  | 'usability'
  | 'security'
  | 'feature'
  | 'documentation'
  | 'integration';

/**
 * Severity levels for improvements
 */
export type ImprovementSeverity = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Scope of the improvement
 */
export type ImprovementScope = 'tool' | 'lifecycle' | 'both';

/**
 * Current status of an improvement
 */
export type ImprovementStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'deferred';

/**
 * How the improvement was detected
 */
export type DetectionMethod = 'rule' | 'ai' | 'manual';

/**
 * Estimated impact or effort levels
 */
export type EstimationLevel = 'low' | 'medium' | 'high';

/**
 * A suggested improvement identified by the observer
 */
export interface ImprovementSuggestion {
  /** Unique identifier */
  id: string;
  /** Category of improvement */
  type: ImprovementType;
  /** How urgent/important */
  severity: ImprovementSeverity;
  /** Whether it affects a tool, lifecycle, or both */
  scope: ImprovementScope;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Recommended action to take */
  suggestedAction: string;
  /** Tools affected by this improvement */
  affectedTools: LifecycleTool[];
  /** Projects affected by this improvement */
  affectedProjects: string[];
  /** When the improvement was detected */
  detectedAt: Date;
  /** How it was detected */
  detectedBy: DetectionMethod;
  /** Context that triggered the detection */
  detectionContext?: string;
  /** Current status */
  status: ImprovementStatus;
  /** When status was last updated */
  statusUpdatedAt?: Date;
  /** Resolution details if resolved */
  resolution?: string;
  /** IDs of related improvements */
  relatedImprovements?: string[];
  /** Expected impact if implemented */
  estimatedImpact?: EstimationLevel;
  /** Expected effort to implement */
  estimatedEffort?: EstimationLevel;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Filter options for querying improvements
 */
export interface ImprovementFilter {
  /** Filter by tools */
  tools?: LifecycleTool[];
  /** Filter by projects */
  projects?: string[];
  /** Filter by types */
  types?: ImprovementType[];
  /** Filter by severities */
  severities?: ImprovementSeverity[];
  /** Filter by statuses */
  statuses?: ImprovementStatus[];
  /** Filter by scope */
  scope?: ImprovementScope;
  /** Filter by detection method */
  detectedBy?: DetectionMethod[];
  /** Start of date range */
  since?: Date;
  /** End of date range */
  until?: Date;
  /** Filter by tags */
  tags?: string[];
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Data required to create a new improvement
 */
export interface CreateImprovementData {
  type: ImprovementType;
  severity: ImprovementSeverity;
  scope: ImprovementScope;
  title: string;
  description: string;
  suggestedAction: string;
  affectedTools: LifecycleTool[];
  affectedProjects: string[];
  detectedBy: DetectionMethod;
  detectionContext?: string;
  relatedImprovements?: string[];
  estimatedImpact?: EstimationLevel;
  estimatedEffort?: EstimationLevel;
  tags?: string[];
}

/**
 * Data for updating an improvement
 */
export interface UpdateImprovementData {
  status?: ImprovementStatus;
  resolution?: string;
  estimatedImpact?: EstimationLevel;
  estimatedEffort?: EstimationLevel;
  tags?: string[];
}

/**
 * Summary of improvements for a project
 */
export interface ImprovementSummary {
  /** Project name */
  project: string;
  /** Total improvements */
  total: number;
  /** Open improvements */
  open: number;
  /** In-progress improvements */
  inProgress: number;
  /** Resolved improvements */
  resolved: number;
  /** Dismissed improvements */
  dismissed: number;
  /** Count by severity */
  bySeverity: Record<ImprovementSeverity, number>;
  /** Count by type */
  byType: Record<ImprovementType, number>;
}

