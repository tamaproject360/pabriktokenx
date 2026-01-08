// Quota Management Types

export interface AuthFileItem {
  name: string;
  type?: string;
  provider?: string;
  email?: string;
  size?: number;
  modtime?: string;
  authIndex?: number;
  auth_index?: number;
  runtimeOnly?: boolean;
}

export type QuotaStatus = 'idle' | 'loading' | 'success' | 'error';

export interface QuotaStatusState {
  status: QuotaStatus;
  error?: string;
  errorStatus?: number;
}

// Antigravity Quota Types
export interface AntigravityQuotaGroup {
  id: string;
  label: string;
  models: string[];
  remainingFraction: number;
  resetTime?: string;
}

export interface AntigravityQuotaState extends QuotaStatusState {
  groups?: AntigravityQuotaGroup[];
}

// Codex Quota Types
export interface CodexQuotaWindow {
  id: string;
  label: string;
  labelKey?: string;
  usedPercent: number | null;
  resetLabel: string;
}

export interface CodexQuotaState extends QuotaStatusState {
  windows?: CodexQuotaWindow[];
  planType?: string | null;
}

// Gemini CLI Quota Types
export interface GeminiCliQuotaBucketState {
  id: string;
  label: string;
  modelIds?: string[];
  tokenType?: string | null;
  remainingFraction: number | null;
  remainingAmount?: number | null;
  resetTime?: string;
}

export interface GeminiCliQuotaState extends QuotaStatusState {
  buckets?: GeminiCliQuotaBucketState[];
}

// API Request/Response Types
export interface APICallRequest {
  authIndex: number;
  method: string;
  url: string;
  header?: Record<string, string>;
  data?: string;
}

export interface APICallResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  bodyText?: string;
}
