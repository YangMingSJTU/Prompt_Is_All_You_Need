import type {
  ScanProvider,
  ScanSourceConfig,
  ScanTarget
} from '../../shared/types';
import type { PlatformPathContext } from './platformPaths';
import { areScanSourcesValid } from './settingsService';

export interface ResolvedScanRequest {
  target: ScanTarget;
  providers: ScanProvider[];
  scanSources: ScanSourceConfig[];
}

export function resolveScanRequest(
  request: unknown,
  savedSources: ScanSourceConfig[],
  pathContext: PlatformPathContext
): ResolvedScanRequest {
  if (!request || typeof request !== 'object') {
    throw new Error('Invalid scan request');
  }
  const candidate = request as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(candidate, 'scanSources')) {
    throw new Error('Scan paths must be configured through settings');
  }
  if (candidate.target !== 'spells') {
    throw new Error('Invalid scan target');
  }
  if (
    !Array.isArray(candidate.providers) ||
    candidate.providers.length === 0 ||
    candidate.providers.some((provider) => provider !== 'claude' && provider !== 'codex')
  ) {
    throw new Error('Invalid scan providers');
  }
  if (!areScanSourcesValid(savedSources, pathContext)) {
    throw new Error('Saved scan source configuration is invalid');
  }

  const providers = [...new Set(candidate.providers)] as ScanProvider[];
  return {
    target: candidate.target,
    providers,
    scanSources: savedSources.filter(
      (source) =>
        source.enabled &&
        source.target === candidate.target &&
        providers.includes(source.provider)
    )
  };
}
