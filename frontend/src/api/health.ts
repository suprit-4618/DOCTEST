import { apiClient } from './client';
import type { HealthCheckResponse } from '../types';

export async function fetchHealth(): Promise<HealthCheckResponse> {
  return apiClient<HealthCheckResponse>('/api/health');
}
