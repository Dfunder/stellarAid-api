export interface ApiSuccessResponse<T> {
  status: 'success';
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string | string[];
  data: null;
  errorCode: string;
  requestId?: string;
  timestamp: string;
  path: string;
}

export function successResponse<T>(
  data: T,
  message = 'Request successful',
): ApiSuccessResponse<T> {
  return { status: 'success', message, data };
}
