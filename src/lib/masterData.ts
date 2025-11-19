import { api } from "./api";

export type MasterQuestionType =
  | "short-answer"
  | "long-answer"
  | "multiple-choice"
  | "checkboxes"
  | "dropdown"
  | "number"
  | "date"
  | "email"
  | "phone"
  | "rating";

export interface MasterAnswerOption {
  id?: string;
  label: string;
  value: string;
  order: number;
  isDefault: boolean;
}

export interface MasterQuestion {
  id: string;
  prompt: string;
  type: MasterQuestionType;
  isRequired: boolean;
  isVisible: boolean;
  helperText?: string;
  order: number;
  options: MasterAnswerOption[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MasterSection {
  id: string;
  name: string;
  description?: string;
  order: number;
  aci_id: number[];
  aci_name: string[];
  isVisible: boolean;
  createdAt?: string;
  updatedAt?: string;
  questions: MasterQuestion[];
}

interface SectionResponse {
  section: MasterSection;
}

interface QuestionResponse {
  question: MasterQuestion;
  section: MasterSection;
}

export async function fetchMasterSections(): Promise<MasterSection[]> {
  const response = await api.get("/master-data/sections");
  return response.sections ?? [];
}

export async function createMasterSection(
  payload: Pick<MasterSection, "name" | "description"> & Partial<Pick<MasterSection, "order" | "aci_id" | "aci_name" | "isVisible">> & {
    questions?: Array<Partial<MasterQuestion>>;
  },
): Promise<MasterSection> {
  const response: SectionResponse = await api.post("/master-data/sections", payload);
  return response.section;
}

export async function updateMasterSection(
  sectionId: string,
  payload: Partial<Pick<MasterSection, "name" | "description" | "order" | "aci_id" | "aci_name" | "isVisible" | "questions">>,
): Promise<MasterSection> {
  const response: SectionResponse = await api.put(`/master-data/sections/${sectionId}`, payload);
  return response.section;
}

export async function deleteMasterSection(sectionId: string): Promise<void> {
  await api.delete(`/master-data/sections/${sectionId}`);
}

export async function addMasterQuestion(
  sectionId: string,
  payload: {
    prompt: string;
    type: MasterQuestionType;
    isRequired?: boolean;
    helperText?: string;
    options?: string[];
  },
): Promise<QuestionResponse> {
  const response: QuestionResponse = await api.post(
    `/master-data/sections/${sectionId}/questions`,
    payload,
  );
  return response;
}

export async function updateMasterQuestion(
  sectionId: string,
  questionId: string,
  payload: {
    prompt?: string;
    type?: MasterQuestionType;
    isRequired?: boolean;
    isVisible?: boolean;
    helperText?: string;
    order?: number;
    options?: string[];
  },
): Promise<QuestionResponse> {
  const response: QuestionResponse = await api.put(
    `/master-data/sections/${sectionId}/questions/${questionId}`,
    payload,
  );
  return response;
}

export async function deleteMasterQuestion(sectionId: string, questionId: string): Promise<MasterSection> {
  const response: SectionResponse = await api.delete(
    `/master-data/sections/${sectionId}/questions/${questionId}`,
  );
  return response.section;
}


