import { api } from "./api";

export interface MobileAppResponseAnswer {
  id: string;
  questionId?: string;
  prompt: string;
  type?: string;
  isRequired?: boolean;
  value: unknown;
  raw?: Record<string, unknown> | unknown;
}

export interface MobileAppResponse {
  id: string;
  respondentName?: string | null;
  phoneNumber?: string | null;
  voterId?: string | null;
  status?: string | null;
  submittedAt?: string | null;
  metadata?: Record<string, unknown>;
  answers: MobileAppResponseAnswer[];
  raw?: Record<string, unknown>;
}

export interface MobileAppResponsesResponse {
  responses: MobileAppResponse[];
  pagination?: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  total?: number;
}

interface FetchParams {
  limit?: number;
  cursor?: string | null;
  search?: string;
}

export async function fetchMobileAppResponses(params: FetchParams = {}): Promise<MobileAppResponsesResponse> {
  const query = new URLSearchParams();

  if (typeof params.limit === "number") {
    query.append("limit", params.limit.toString());
  }

  if (params.cursor) {
    query.append("cursor", params.cursor);
  }

  if (params.search && params.search.trim()) {
    query.append("search", params.search.trim());
  }

  const queryString = query.toString();
  return api.get(`/mobile-app-responses${queryString ? `?${queryString}` : ""}`);
}


