/**
 * Configuration module exports
 */

export { DEFAULT_CONFIG, DEFAULT_ALERT_THRESHOLDS } from './defaults.js';
export {
  lifecycleObserverConfigSchema,
  projectConfigSchema,
  aiConfigSchema,
  alertConfigSchema,
  reportingConfigSchema,
  databaseConfigSchema,
} from './schema.js';
export {
  loadConfig,
  loadConfigFile,
  findConfigFile,
  getConfigPath,
  configExists,
  expandPath,
  resolveEnvValue,
} from './loader.js';

