// Nigeria's 36 states and the Federal Capital Territory, in the spelling shown to
// customers. Delivery is chosen by state and town, so these need to be exact.
const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const aliases = {
  fct: "FCT (Abuja)",
  abuja: "FCT (Abuja)",
  "fct abuja": "FCT (Abuja)",
  "federal capital territory": "FCT (Abuja)",
};

// Lower case, letters and digits only, single spaces: "Ankpa, Kogi!" -> "ankpa kogi".
function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Accepts "Kogi", "kogi", "Kogi State" and the usual spellings of Abuja, and
// returns the exact name from the list, or null when it is not a Nigerian state.
function canonicalState(input) {
  if (typeof input !== "string") return null; // never accept lists or objects that merely print like a name
  const text = normalizeText(input).replace(/ state$/, "");
  if (!text) return null;
  if (aliases[text]) return aliases[text];
  return NIGERIAN_STATES.find((state) => normalizeText(state) === text) || null;
}

// Whether the town someone typed is the configured town. "Ankpa", "ankpa town"
// and "Ankpa, Kogi" all match "Ankpa"; "Ankparu" does not.
function townMatches(configuredTown, enteredTown) {
  const wanted = normalizeText(configuredTown);
  if (!wanted) return false;
  return ` ${normalizeText(enteredTown)} `.includes(` ${wanted} `);
}

// The pickup-only entry that covers this state and town, if any.
function blockedArea(areas, state, town) {
  return (areas || []).find((area) => area.state === state && townMatches(area.town, town)) || null;
}

module.exports = { NIGERIAN_STATES, canonicalState, townMatches, blockedArea, normalizeText };
