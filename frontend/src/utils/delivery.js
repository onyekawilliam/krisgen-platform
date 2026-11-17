// Mirrors backend/utils/nigeria.js so the checkout can warn before the customer
// pays. The server applies the same rule and is the final word.
export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// "Ankpa", "ankpa town" and "Ankpa, Kogi" all match "Ankpa"; "Ankparu" does not.
export function townMatches(configuredTown, enteredTown) {
  const wanted = normalizeText(configuredTown);
  if (!wanted) return false;
  return ` ${normalizeText(enteredTown)} `.includes(` ${wanted} `);
}

// The pickup-only entry covering this state and town, if any.
export function blockedArea(areas, state, town) {
  return (areas || []).find((area) => area.state === state && townMatches(area.town, town)) || null;
}
