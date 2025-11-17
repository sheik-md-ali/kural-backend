import API_BASE_URL, { api } from "./api";

export type SurveyStatus = "Draft" | "Active";

export interface SurveyQuestion {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  status: SurveyStatus;
  questions: SurveyQuestion[];
  assignedACs: number[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByRole?: string;
  metadata?: Record<string, unknown>;
}

export interface SurveyPayload {
  title: string;
  description?: string;
  status?: SurveyStatus;
  questions?: SurveyQuestion[];
  assignedACs?: number[];
  createdBy?: string;
  createdByRole?: string;
  metadata?: Record<string, unknown>;
}

function buildQueryString(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function fetchSurveys({
  role,
  assignedAC,
}: {
  role?: string | string[];
  assignedAC?: number | string | Array<number | string>;
} = {}): Promise<Survey[]> {
  const roleParam = Array.isArray(role) ? role.join(",") : role;

  const assignedParam = Array.isArray(assignedAC)
    ? assignedAC.join(",")
    : assignedAC !== undefined
      ? String(assignedAC)
      : undefined;

  const query = buildQueryString({
    role: roleParam,
    assignedAC: assignedParam,
  });

  return api.get(`/surveys${query}`);
}

export async function fetchSurvey(id: string): Promise<Survey> {
  return api.get(`/surveys/${id}`);
}

export async function createSurvey(payload: SurveyPayload): Promise<Survey> {
  return api.post("/surveys", payload);
}

export async function updateSurvey(id: string, payload: SurveyPayload): Promise<Survey> {
  return api.put(`/surveys/${id}`, payload);
}

export async function updateSurveyStatus(id: string, status: SurveyStatus): Promise<Survey> {
  return updateSurvey(id, { status });
}

export async function deleteSurvey(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/surveys/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok && response.status !== 204) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.message === "string"
        ? errorBody.message
        : "Failed to delete survey";
    throw new Error(message);
  }
}


