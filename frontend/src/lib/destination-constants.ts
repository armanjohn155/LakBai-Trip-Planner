export const DESTINATION_CATEGORIES = [
  "Beach",
  "Waterfall",
  "Mountains & Hiking",
  "Historical & Cultural",
  "Religious Sites",
  "Food & Restaurants",
  "Diving & Water Activities",
  "Nature & Eco-Tourism",
  "Islands",
] as const;

export const DESTINATION_REGIONS = ["Metro Cebu", "North Cebu", "South Cebu"] as const;

export const MUNICIPALITY_SUGGESTIONS = [
  "Cebu City",
  "Badian",
  "Bantayan",
  "Moalboal",
  "Oslob",
  "Dalaguete",
  "Lapu-Lapu City",
  "Mandaue City",
  "Talisay City",
  "Carcar City",
  "Argao",
  "Alcoy",
  "Santander",
  "Aloguinsan",
  "Toledo City",
  "Balamban",
  "Liloan",
  "Consolacion",
] as const;

/** Rough bounding box around Cebu used to warn admins about stray coordinates. */
export const CEBU_BOUNDS = {
  minLat: 9.4,
  maxLat: 11.4,
  minLng: 123.2,
  maxLng: 124.3,
} as const;
