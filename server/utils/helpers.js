/**
 * Shared helper functions for the Kural backend
 */

import mongoose from "mongoose";

/**
 * Role mapping from various names to standardized roles
 */
export const roleMap = new Map([
  ["Admin", "L0"],
  ["admin", "L0"],
  ["L0", "L0"],
  ["Assembly CIM", "L1"],
  ["AssemblyCIM", "L1"],
  ["CIM", "L1"],
  ["L1", "L1"],
  ["Assembly CI", "L2"],
  ["AssemblyCI", "L2"],
  ["CI", "L2"],
  ["L2", "L2"],
  ["Booth Agent", "BoothAgent"],
  ["BoothAgent", "BoothAgent"],
  ["War Room", "L9"],
  ["Command", "L9"],
  ["L9", "L9"],
]);

/**
 * Escape special regex characters in a string
 */
export function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a MongoDB query for AC identifier
 */
export function buildAcQuery(acIdentifier) {
  if (acIdentifier === undefined || acIdentifier === null) {
    return null;
  }

  const conditions = [];
  const seen = new Set();
  const addCondition = (condition) => {
    const key = JSON.stringify(condition);
    if (!seen.has(key)) {
      conditions.push(condition);
      seen.add(key);
    }
  };

  const identifierString =
    typeof acIdentifier === "string" ? acIdentifier.trim() : null;
  if (identifierString) {
    const regex = new RegExp(`^${escapeRegExp(identifierString)}$`, "i");
    addCondition({ aci_name: regex });
    addCondition({ ac_name: regex });
  }

  const numericIdentifier = Number(
    identifierString ?? (typeof acIdentifier === "number" ? acIdentifier : NaN),
  );
  if (Number.isFinite(numericIdentifier)) {
    addCondition({ aci_num: numericIdentifier });
    addCondition({ aci_id: numericIdentifier });
  }

  if (conditions.length === 0) {
    return null;
  }

  return { $or: conditions };
}

/**
 * Unwrap legacy field value format
 */
export function unwrapLegacyFieldValue(value) {
  const isLegacyObject =
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.prototype.hasOwnProperty.call(value, "value");

  if (isLegacyObject) {
    const actualValue = Object.prototype.hasOwnProperty.call(value, "value")
      ? value.value
      : undefined;
    return {
      actualValue,
      legacyVisible:
        typeof value.visible === "boolean" ? value.visible : undefined,
      wasLegacyFormat: true,
    };
  }

  return { actualValue: value, legacyVisible: undefined, wasLegacyFormat: false };
}

/**
 * Infer field type from a value
 */
export function inferFieldTypeFromValue(value) {
  if (value === null || value === undefined) {
    return "String";
  }
  if (value instanceof Date) {
    return "Date";
  }
  if (typeof value === "number") {
    return "Number";
  }
  if (typeof value === "boolean") {
    return "Boolean";
  }
  if (typeof value === "string") {
    const maybeDate = Date.parse(value);
    if (!Number.isNaN(maybeDate) && value.includes("-")) {
      return "Date";
    }
    return "String";
  }
  return "Object";
}

/**
 * Check if a value has meaningful content
 */
export function hasMeaningfulValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

/**
 * Sanitize survey title
 */
export function sanitizeTitle(title) {
  if (typeof title === "string" && title.trim()) {
    return title.trim();
  }
  return "Untitled Form";
}

/**
 * Sanitize survey description
 */
export function sanitizeDescription(description) {
  if (typeof description === "string") {
    return description.trim();
  }
  return "";
}

/**
 * Sanitize survey status
 */
export function sanitizeStatus(status) {
  return status === "Active" ? "Active" : "Draft";
}

/**
 * Sanitize assigned ACs array
 */
export function sanitizeAssignedACs(value) {
  const values = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  return values
    .map((item) => {
      const num = Number(item);
      return Number.isFinite(num) ? Math.trunc(num) : null;
    })
    .filter((item) => item !== null);
}

/**
 * Normalize survey questions
 */
export function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions
    .map((question, index) => {
      if (typeof question !== "object" || question === null) {
        return null;
      }

      const id =
        question.id && String(question.id).trim()
          ? String(question.id).trim()
          : new mongoose.Types.ObjectId().toString();

      const text =
        typeof question.text === "string" && question.text.trim()
          ? question.text.trim()
          : `Question ${index + 1}`;

      const type =
        typeof question.type === "string" && question.type.trim()
          ? question.type.trim()
          : "short-text";

      const normalized = {
        id,
        text,
        type,
        required: Boolean(question.required),
      };

      // Preserve masterQuestionId if it exists
      if (question.masterQuestionId !== undefined && question.masterQuestionId !== null) {
        const masterQuestionId = String(question.masterQuestionId).trim();
        if (masterQuestionId) {
          normalized.masterQuestionId = masterQuestionId;
        }
      }

      if (Array.isArray(question.options)) {
        const options = question.options
          .map((option) => (typeof option === "string" ? option.trim() : ""))
          .filter((option) => option);

        if (options.length > 0) {
          normalized.options = options;
        }
      }

      // Preserve optionMappings if they exist
      if (question.optionMappings !== undefined && question.optionMappings !== null) {
        if (Array.isArray(question.optionMappings)) {
          const optionMappings = question.optionMappings
            .map((mapping) => {
              if (
                typeof mapping === "object" &&
                mapping !== null &&
                typeof mapping.surveyOptionIndex === "number" &&
                typeof mapping.masterQuestionId === "string" &&
                mapping.masterQuestionId.trim() &&
                typeof mapping.masterOptionValue === "string" &&
                mapping.masterOptionValue.trim()
              ) {
                return {
                  surveyOptionIndex: mapping.surveyOptionIndex,
                  masterQuestionId: mapping.masterQuestionId.trim(),
                  masterOptionValue: mapping.masterOptionValue.trim(),
                };
              }
              return null;
            })
            .filter(Boolean);

          normalized.optionMappings = optionMappings;
        }
      }

      return normalized;
    })
    .filter(Boolean);
}

/**
 * Sanitize createdBy field
 */
export function sanitizeCreatedBy(createdBy) {
  if (typeof createdBy !== "string" || !createdBy.trim()) {
    return undefined;
  }

  if (!mongoose.Types.ObjectId.isValid(createdBy)) {
    return undefined;
  }

  return createdBy.trim();
}

/**
 * Sanitize createdByRole field
 */
export function sanitizeCreatedByRole(createdByRole) {
  if (typeof createdByRole !== "string") {
    return undefined;
  }
  const trimmed = createdByRole.trim();
  return trimmed || undefined;
}

/**
 * Master question types
 */
export const MASTER_QUESTION_TYPES = new Set([
  "short-answer",
  "long-answer",
  "multiple-choice",
  "checkboxes",
  "dropdown",
  "number",
  "date",
  "email",
  "phone",
  "rating",
]);

/**
 * Types that require answer options
 */
export const OPTION_REQUIRED_TYPES = new Set([
  "multiple-choice",
  "checkboxes",
  "dropdown",
  "rating",
]);

/**
 * Sanitize section name
 */
export function sanitizeSectionName(name) {
  if (typeof name !== "string") {
    return "";
  }
  return name.trim();
}

/**
 * Normalize answer options
 */
export function normalizeAnswerOptions(questionType, rawOptions) {
  if (!OPTION_REQUIRED_TYPES.has(questionType)) {
    return [];
  }

  if (!Array.isArray(rawOptions)) {
    return [];
  }

  const normalizedOptions = rawOptions
    .map((option, index) => {
      if (typeof option === "string") {
        const trimmed = option.trim();
        if (!trimmed) {
          return null;
        }
        return {
          label: trimmed,
          value: trimmed,
          order: index,
          isDefault: false,
        };
      }

      if (typeof option === "object" && option !== null) {
        const label =
          typeof option.label === "string" && option.label.trim()
            ? option.label.trim()
            : typeof option.value === "string" && option.value.trim()
              ? option.value.trim()
              : "";
        const value =
          typeof option.value === "string" && option.value.trim()
            ? option.value.trim()
            : label;

        if (!label && !value) {
          return null;
        }

        const order =
          typeof option.order === "number" && Number.isFinite(option.order)
            ? option.order
            : index;

        return {
          label: label || value,
          value: value || label,
          order,
          isDefault: Boolean(option.isDefault),
        };
      }

      return null;
    })
    .filter(Boolean);

  const seenValues = new Set();
  return normalizedOptions.filter((option) => {
    const key = option.value.toLowerCase();
    if (seenValues.has(key)) {
      return false;
    }
    seenValues.add(key);
    return true;
  });
}

/**
 * Normalize a master question
 */
export function normalizeMasterQuestion(question, fallbackOrder = 0) {
  if (typeof question !== "object" || question === null) {
    throw new Error("Invalid question payload");
  }

  const prompt =
    typeof question.prompt === "string" && question.prompt.trim()
      ? question.prompt.trim()
      : typeof question.text === "string" && question.text.trim()
        ? question.text.trim()
        : "";

  if (!prompt) {
    throw new Error("Question prompt is required");
  }

  const typeInput =
    typeof question.type === "string" && question.type.trim()
      ? question.type.trim().toLowerCase()
      : "short-answer";
  const normalizedType = MASTER_QUESTION_TYPES.has(typeInput)
    ? typeInput
    : "short-answer";

  const helperText =
    typeof question.helperText === "string" && question.helperText.trim()
      ? question.helperText.trim()
      : undefined;

  const order =
    typeof question.order === "number" && Number.isFinite(question.order)
      ? question.order
      : fallbackOrder;

  const options = OPTION_REQUIRED_TYPES.has(normalizedType)
    ? normalizeAnswerOptions(
        normalizedType,
        question.options ?? question.answers ?? [],
      )
    : [];

  if (OPTION_REQUIRED_TYPES.has(normalizedType) && options.length === 0) {
    throw new Error(
      "This question type requires at least one answer option",
    );
  }

  return {
    prompt,
    type: normalizedType,
    isRequired: Boolean(question.isRequired ?? question.required ?? false),
    isVisible: question.isVisible !== undefined ? Boolean(question.isVisible) : true,
    helperText,
    order,
    options,
  };
}

/**
 * Format master question for API response
 */
export function formatMasterQuestionResponse(questionDoc) {
  if (!questionDoc) {
    return null;
  }

  const question =
    typeof questionDoc.toObject === "function"
      ? questionDoc.toObject({ versionKey: false })
      : questionDoc;

  const formattedOptions =
    OPTION_REQUIRED_TYPES.has(question.type) && Array.isArray(question.options)
      ? [...question.options]
          .sort((a, b) => {
            const orderDiff = (a.order ?? 0) - (b.order ?? 0);
            if (orderDiff !== 0) {
              return orderDiff;
            }
            return String(a.label ?? "").localeCompare(String(b.label ?? ""));
          })
          .map((option) => ({
            id: option._id?.toString?.() ?? option._id ?? undefined,
            label: option.label,
            value: option.value,
            order: option.order ?? 0,
            isDefault: Boolean(option.isDefault),
          }))
      : [];

  return {
    id: question._id?.toString?.() ?? question._id ?? undefined,
    prompt: question.prompt,
    type: question.type,
    isRequired: Boolean(question.isRequired),
    helperText: question.helperText,
    order: question.order ?? 0,
    isVisible: question.isVisible !== undefined ? Boolean(question.isVisible) : true,
    options: formattedOptions,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}
