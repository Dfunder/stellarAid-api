/** #1104: shared API response/error envelopes. */
export interface ApiMeta {
  requestId?: string;
  timestamp?: string;
  pagination?: PageMeta;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  success: false;
  error: { statusCode: number; code: string; message: string; details?: unknown };
  meta?: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

/** #1103: pagination query/response primitives. */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PageQuery {
  page?: number;
  limit?: number;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Clamp untrusted page/limit input to safe values. */
export function normalizePageQuery(q: PageQuery = {}): { page: number; limit: number; skip: number } {
  const page = Math.max(DEFAULT_PAGE, Math.floor(Number(q.page)) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(q.limit)) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

export function buildPageMeta(total: number, page: number, limit: number): PageMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
