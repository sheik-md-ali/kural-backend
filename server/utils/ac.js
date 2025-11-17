/**
 * Utility helpers for working with Assembly Constituency identifiers.
 */

function toNumeric(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Resolve the assigned AC for a user document/session payload.
 * Accepts multiple possible field names and normalises to a number.
 */
export function resolveAssignedACFromUser(user) {
  if (!user) {
    return null;
  }

  const candidates = [
    user.assignedAC,
    user.aci_id,
    user.ac_id,
    user.acNumber,
    user.aciNumber,
  ];

  for (const candidate of candidates) {
    const numericValue = toNumeric(candidate);
    if (numericValue !== null) {
      return numericValue;
    }
  }

  return null;
}

/**
 * Resolve a human readable AC/ACI name for the given user payload.
 */
export function resolveAciNameFromUser(user) {
  if (!user) {
    return null;
  }

  return (
    user.aciName ??
    user.aci_name ??
    user.ac_name ??
    user.acName ??
    null
  );
}


