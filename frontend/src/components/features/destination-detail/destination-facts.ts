import type { Destination } from "@/lib/types";

export interface TransportOption {
  mode: string;
  origin: string;
  price: string;
  duration: string;
}

export interface DestinationFacts {
  entrance_fee: string;
  visit_duration: string;
  opening_hours: string;
  activities: string[];
  transport: TransportOption[];
  extra_tips: string[];
}

interface CategoryFacts extends Omit<DestinationFacts, "transport" | "extra_tips"> {
  transportByRegion: Record<string, TransportOption[]>;
  fallbackTransport: TransportOption[];
  tip: string;
}

const CATEGORY_FACTS: Record<string, CategoryFacts> = {
  Waterfall: {
    entrance_fee: "₱100–₱500",
    visit_duration: "1–3 hours",
    opening_hours: "6:00 AM – 5:00 PM",
    activities: ["Swimming", "Photography", "Nature walk", "Cooling off"],
    transportByRegion: {
      "South Cebu": [
        { mode: "Bus", origin: "Cebu South Bus Terminal", price: "₱120–₱180", duration: "2.5–3.5 hours" },
        { mode: "Tricycle", origin: "Town proper to jump-off", price: "₱50–₱100", duration: "15–30 min" },
      ],
      "North Cebu": [
        { mode: "Bus", origin: "Cebu North Bus Terminal", price: "₱150–₱220", duration: "3–4 hours" },
      ],
    },
    fallbackTransport: [{ mode: "Local transit", origin: "Nearest town center", price: "₱50–₱150", duration: "20–60 min" }],
    tip: "Carry water and wear grippy footwear — trails around falls are slick.",
  },
  "Diving & Water Activities": {
    entrance_fee: "₱300–₱1,500",
    visit_duration: "2–4 hours",
    opening_hours: "6:00 AM – 4:00 PM",
    activities: ["Snorkeling", "Diving", "Boat tour", "Photography"],
    transportByRegion: {
      "South Cebu": [
        { mode: "Van", origin: "Cebu City (via south highway)", price: "₱250–₱350", duration: "2.5–3 hours" },
        { mode: "Bus", origin: "Cebu South Bus Terminal", price: "₱150–₱230", duration: "3–3.5 hours" },
      ],
      "North Cebu": [
        { mode: "Bus", origin: "Cebu North Bus Terminal", price: "₱160–₱200", duration: "3–3.5 hours" },
      ],
    },
    fallbackTransport: [{ mode: "Local transit", origin: "Nearest coastal town", price: "₱100–₱300", duration: "30–60 min" }],
    tip: "Bring reef-safe sunscreen and your own snorkel gear if you have it.",
  },
  Islands: {
    entrance_fee: "Free–₱500 (reef fee)",
    visit_duration: "Half to full day",
    opening_hours: "Always open",
    activities: ["Beach lounging", "Snorkeling", "Island hopping", "Sunset watching"],
    transportByRegion: {
      "North Cebu": [
        { mode: "Ferry", origin: "Hagnaya / Maya port", price: "₱100–₱250", duration: "30 min – 1 hr" },
        { mode: "Bus", origin: "Cebu North Bus Terminal", price: "₱160–₱200", duration: "3–3.5 hours" },
      ],
      "South Cebu": [
        { mode: "Boat", origin: "Nearest mainland port", price: "₱200–₱500", duration: "15–40 min" },
        { mode: "Bus", origin: "Cebu South Bus Terminal", price: "₱150–₱230", duration: "3–3.5 hours" },
      ],
    },
    fallbackTransport: [{ mode: "Local boat", origin: "Nearest port", price: "₱100–₱400", duration: "20–60 min" }],
    tip: "Pack cash — island stalls rarely accept cards.",
  },
  "Historical & Cultural": {
    entrance_fee: "₱0–₱100",
    visit_duration: "45–90 min",
    opening_hours: "8:00 AM – 6:00 PM",
    activities: ["Sightseeing", "History walk", "Photography"],
    transportByRegion: {
      "Metro Cebu": [
        { mode: "Taxi", origin: "Downtown Cebu City", price: "₱120–₱180", duration: "10–20 min" },
        { mode: "Jeepney", origin: "Colon / downtown routes", price: "₱15–₱25", duration: "15–30 min" },
      ],
      "South Cebu": [
        { mode: "Bus", origin: "Cebu South Bus Terminal", price: "₱100–₱160", duration: "1.5–2.5 hours" },
      ],
    },
    fallbackTransport: [{ mode: "Local transit", origin: "Nearest town center", price: "₱15–₱100", duration: "10–30 min" }],
    tip: "Visit on a weekday morning for significantly fewer crowds.",
  },
  "Religious Sites": {
    entrance_fee: "Free (donations welcome)",
    visit_duration: "1–2 hours",
    opening_hours: "6:00 AM – 7:00 PM",
    activities: ["Pilgrimage", "Photography", "Garden stroll"],
    transportByRegion: {
      "South Cebu": [
        { mode: "Bus", origin: "Cebu South Bus Terminal", price: "₱120–₱160", duration: "2–2.5 hours" },
        { mode: "Tricycle", origin: "Town proper to the shrine", price: "₱60–₱100", duration: "15–20 min" },
      ],
      "Metro Cebu": [
        { mode: "Taxi", origin: "Downtown Cebu City", price: "₱150–₱250", duration: "15–25 min" },
      ],
    },
    fallbackTransport: [{ mode: "Local transit", origin: "Nearest town center", price: "₱40–₱150", duration: "15–40 min" }],
    tip: "Dress modestly and keep voices low out of respect for worshippers.",
  },
  "Mountains & Hiking": {
    entrance_fee: "₱100–₱200 (guide)",
    visit_duration: "1–3 hours",
    opening_hours: "4:00 AM – 6:00 PM",
    activities: ["Hiking", "Photography", "Sunrise views"],
    transportByRegion: {
      "South Cebu": [
        { mode: "Bus", origin: "Cebu South Bus Terminal", price: "₱100–₱140", duration: "1.5–2.5 hours" },
        { mode: "Tricycle", origin: "Town proper to the jump-off", price: "₱80–₱120", duration: "20–40 min" },
      ],
    },
    fallbackTransport: [{ mode: "Local transit", origin: "Nearest town proper", price: "₱80–₱150", duration: "20–60 min" }],
    tip: "Start early (before sunrise) to beat the heat and the crowds.",
  },
  "Food & Restaurants": {
    entrance_fee: "Per dish",
    visit_duration: "30–90 min",
    opening_hours: "10:00 AM – 9:00 PM",
    activities: ["Dining", "Food tasting"],
    transportByRegion: {
      "Metro Cebu": [
        { mode: "Taxi", origin: "IT Park / Ayala area", price: "₱100–₱180", duration: "10–20 min" },
        { mode: "Jeepney", origin: "Nearby city routes", price: "₱15–₱25", duration: "10–25 min" },
      ],
    },
    fallbackTransport: [{ mode: "Local transit", origin: "Nearest city route", price: "₱15–₱150", duration: "10–30 min" }],
    tip: "Go slightly off-peak to avoid long queues at the counter.",
  },
  Beach: {
    entrance_fee: "Free",
    visit_duration: "1–3 hours",
    opening_hours: "Sunrise – sunset",
    activities: ["Swimming", "Sunbathing", "Sunset watching"],
    transportByRegion: {
      "Metro Cebu": [
        { mode: "Taxi", origin: "Mactan-Cebu International Airport", price: "₱200–₱350", duration: "15–30 min" },
        { mode: "MyBus", origin: "Parkmall / SM City", price: "₱50", duration: "30–45 min" },
      ],
    },
    fallbackTransport: [{ mode: "Local transit", origin: "Nearest town center", price: "₱30–₱200", duration: "15–45 min" }],
    tip: "Bring sunblock and a hat — shade on the sand can be scarce.",
  },
};

const DEFAULT_CATEGORY_FACTS: CategoryFacts = {
  entrance_fee: "Varies",
  visit_duration: "1–2 hours",
  opening_hours: "Daytime",
  activities: ["Sightseeing", "Photography"],
  transportByRegion: {},
  fallbackTransport: [{ mode: "Local transit", origin: "Nearest town center", price: "₱20–₱200", duration: "10–40 min" }],
  tip: "Check the latest schedules and fees before heading out.",
};

const BY_NAME: Record<string, Omit<DestinationFacts, "extra_tips"> & { extraTips?: string[] }> = {
  "Kawasan Falls": {
    entrance_fee: "₱450–₱500",
    visit_duration: "3–5 hours",
    opening_hours: "6:00 AM – 6:00 PM",
    activities: ["Canyoneering", "Cliff Jumping", "Swimming", "Bamboo Rafting", "Photography"],
    transport: [
      { mode: "Bus", origin: "Cebu South Bus Terminal → Badian", price: "₱150–₱200", duration: "3–3.5 hours" },
      { mode: "Motorbike", origin: "Badian town to jump-off", price: "₱80–₱100", duration: "10–15 min" },
    ],
  },
  "Moalboal Sardine Run": {
    entrance_fee: "Free (beach access)",
    visit_duration: "1–3 hours",
    opening_hours: "Sunrise – sunset",
    activities: ["Snorkeling", "Sardine run watching", "Free diving", "Island hopping", "Sunset kayaking"],
    transport: [
      { mode: "Bus", origin: "Cebu South Bus Terminal → Moalboal", price: "₱160–₱200", duration: "3 hours" },
      { mode: "Van", origin: "Cebu City (shared shuttle)", price: "₱250", duration: "2.5 hours" },
    ],
  },
  "Oslob Whale Shark Watching": {
    entrance_fee: "₱1,500",
    visit_duration: "1–2 hours",
    opening_hours: "6:00 AM – 9:00 AM (viewing)",
    activities: ["Whale shark watching", "Snorkeling", "Boat tour", "Photography"],
    transport: [
      { mode: "Bus", origin: "Cebu South Bus Terminal → Oslob", price: "₱180–₱230", duration: "3.5 hours" },
      { mode: "Van", origin: "Cebu City (joined tour)", price: "₱300", duration: "3 hours" },
    ],
  },
  "Bantayan Island": {
    entrance_fee: "Free entry",
    visit_duration: "1–2 days",
    opening_hours: "Always open",
    activities: ["Beach lounging", "Island hopping", "Cycling", "Kayaking", "Fresh seafood"],
    transport: [
      { mode: "Ferry", origin: "Hagnaya Port", price: "₱250", duration: "1 hour" },
      { mode: "Bus", origin: "Cebu North Bus Terminal → Hagnaya", price: "₱170", duration: "3 hours" },
    ],
  },
  "Malapascua Island": {
    entrance_fee: "Free (₱400 dive/reef fee)",
    visit_duration: "1–3 days",
    opening_hours: "Always open",
    activities: ["Diving", "Thresher shark watching", "Snorkeling", "Beach swimming", "Sunset watching"],
    transport: [
      { mode: "Boat", origin: "Maya Port", price: "₱100", duration: "30 min" },
      { mode: "Bus", origin: "Cebu North Bus Terminal → Maya", price: "₱180", duration: "3.5 hours" },
    ],
  },
  "Fort San Pedro": {
    entrance_fee: "₱50",
    visit_duration: "30–45 min",
    opening_hours: "8:00 AM – 7:00 PM",
    activities: ["History walk", "Sightseeing", "Photography"],
    transport: [
      { mode: "Jeepney", origin: "Downtown Cebu City", price: "₱15–₱25", duration: "15–20 min" },
      { mode: "Taxi", origin: "Anywhere in Cebu City", price: "₱120–₱180", duration: "10–15 min" },
    ],
  },
  "Magellan's Cross": {
    entrance_fee: "Free",
    visit_duration: "15–30 min",
    opening_hours: "Always open (daylight)",
    activities: ["Sightseeing", "History walk", "Photography"],
    transport: [
      { mode: "Walk", origin: "Plaza Independencia", price: "Free", duration: "5 min" },
      { mode: "Taxi", origin: "Downtown Cebu City", price: "₱120–₱160", duration: "10 min" },
    ],
  },
  "Simala Shrine": {
    entrance_fee: "Free (donations welcome)",
    visit_duration: "1–2 hours",
    opening_hours: "6:00 AM – 7:00 PM",
    activities: ["Pilgrimage", "Photography", "Garden stroll", "Bell tower viewing"],
    transport: [
      { mode: "Bus", origin: "Cebu South Bus Terminal → Sibonga", price: "₱120–₱140", duration: "2 hours" },
      { mode: "Tricycle", origin: "Sibonga town to the shrine", price: "₱60–₱80", duration: "15 min" },
    ],
  },
  "Tumalog Falls": {
    entrance_fee: "₱100",
    visit_duration: "30–60 min",
    opening_hours: "6:00 AM – 5:00 PM",
    activities: ["Photography", "Nature walk", "Cooling off", "Swimming"],
    transport: [
      { mode: "Motorbike", origin: "Oslob town proper", price: "₱80–₱100", duration: "20 min" },
      { mode: "Bus", origin: "Cebu South Bus Terminal → Oslob", price: "₱180–₱230", duration: "3.5 hours" },
    ],
  },
  "Canyoneering at Badian": {
    entrance_fee: "₱2,500 (guided tour)",
    visit_duration: "4–6 hours",
    opening_hours: "8:00 AM – 4:00 PM",
    activities: ["Canyoneering", "Rappelling", "Cliff jumping", "Swimming", "Waterfall chasing"],
    transport: [
      { mode: "Van", origin: "Cebu City (tour with transfer)", price: "₱2,500 incl. guide", duration: "3 hours" },
      { mode: "Bus", origin: "Cebu South Bus Terminal → Badian", price: "₱150–₱200", duration: "3 hours" },
    ],
  },
  "Osmeña Peak": {
    entrance_fee: "₱100",
    visit_duration: "1–2 hours",
    opening_hours: "4:00 AM – 6:00 PM",
    activities: ["Sunrise hike", "Photography", "Hill trekking", "Picnic"],
    transport: [
      { mode: "Bus", origin: "Cebu South Bus Terminal → Dalaguete", price: "₱100–₱120", duration: "2 hours" },
      { mode: "Tricycle", origin: "Dalaguete to Mantalongon jump-off", price: "₱80–₱100", duration: "30 min" },
    ],
  },
  "Cebu Lechon (Zubuchon)": {
    entrance_fee: "Per dish",
    visit_duration: "45–60 min",
    opening_hours: "10:00 AM – 8:00 PM",
    activities: ["Dining", "Food tasting", "Takeaway lechon"],
    transport: [
      { mode: "Taxi", origin: "IT Park / Ayala area", price: "₱100–₱180", duration: "10–20 min" },
      { mode: "Jeepney", origin: "Nearby city routes", price: "₱15–₱25", duration: "10–20 min" },
    ],
  },
  "Carbon Market": {
    entrance_fee: "Free to browse",
    visit_duration: "1–2 hours",
    opening_hours: "4:00 AM – 8:00 PM",
    activities: ["Market stroll", "Street food tasting", "Dried fish shopping", "Souvenir hunting"],
    transport: [
      { mode: "Jeepney", origin: "Colon / downtown routes", price: "₱15", duration: "10–15 min" },
      { mode: "Taxi", origin: "Downtown Cebu City", price: "₱100–₱140", duration: "10 min" },
    ],
  },
  "Sumilon Island": {
    entrance_fee: "₱2,000 (day-trip fee)",
    visit_duration: "Half day",
    opening_hours: "8:00 AM – 4:00 PM",
    activities: ["Sandbar walking", "Snorkeling", "Island resort day trip", "Kayaking"],
    transport: [
      { mode: "Boat", origin: "Banks Beach resort (Oslob)", price: "₱500", duration: "15 min" },
      { mode: "Bus", origin: "Cebu South Bus Terminal → Oslob", price: "₱180–₱230", duration: "3.5 hours" },
    ],
  },
  "Cebu Taoist Temple": {
    entrance_fee: "Free",
    visit_duration: "45–60 min",
    opening_hours: "6:00 AM – 5:00 PM",
    activities: ["Temple stroll", "Climbing the 81 steps", "Photography", "City viewpoint"],
    transport: [
      { mode: "Taxi", origin: "Downtown Cebu City", price: "₱150–₱200", duration: "15 min" },
      { mode: "Jeepney", origin: "Route 06B to Beverly Hills", price: "₱20–₱25", duration: "25–35 min" },
    ],
  },
  "Mactan Newtown Beach": {
    entrance_fee: "Free",
    visit_duration: "1–3 hours",
    opening_hours: "Always open",
    activities: ["Sunset dining", "Boardwalk stroll", "Shopping", "Outdoor dining"],
    transport: [
      { mode: "Taxi", origin: "Mactan-Cebu International Airport", price: "₱200–₱300", duration: "15 min" },
      { mode: "MyBus", origin: "Parkmall / SM City", price: "₱50", duration: "30–45 min" },
    ],
  },
};

const EXTRA_TIPS: Record<string, string[]> = {
  "Kawasan Falls": [
    "Wear quick-dry clothes and water shoes for the falls trail.",
    "Book canyoneering for the morning — early slots are cooler.",
  ],
  "Moalboal Sardine Run": [
    "Snorkel in the morning when the water is calmest.",
    "Stay in Panagsama Beach village to be steps from the sardines.",
  ],
  "Oslob Whale Shark Watching": [
    "Respect the 30-minute viewing limit.",
    "Bring cash — fees are paid on site before boarding.",
  ],
  "Bantayan Island": [
    "Rent a motorbike or pushbike to reach Santa Fe's best beaches.",
    "Try grilled seafood at the night market near the church.",
  ],
  "Malapascua Island": [
    "Dive at dawn to catch thresher sharks at Monad Shoal.",
    "Book dive slots a day ahead in peak season.",
  ],
  "Fort San Pedro": [
    "Pair it with Plaza Independencia right next door.",
    "Bring water — shade is limited around midday.",
  ],
  "Magellan's Cross": [
    "Ignore unsolicited 'city tour' offers near the chapel.",
    "The Basilica del Sto. Niño is a two-minute walk away.",
  ],
  "Simala Shrine": [
    "Dress modestly out of respect for the pilgrimage site.",
    "Friar evenings can get busy — go at sunrise for quiet.",
  ],
  "Tumalog Falls": [
    "Hire a habal-habal up the steep access road.",
    "Combine with the whale shark viewing in the same morning.",
  ],
  "Canyoneering at Badian": [
    "Wear secured footwear and keep your phone in a dry bag.",
    "Choose the 4-hour canyon if it's your first time.",
  ],
  "Osmeña Peak": [
    "Start before sunrise for the best light and cooler air.",
    "A local guide at Mantalongon is recommended for first-timers.",
  ],
  "Cebu Lechon (Zubuchon)": [
    "Arrive near lunchtime for the freshest roast.",
    "The crackling lechon belly is the crowd favorite.",
  ],
  "Carbon Market": [
    "Go before 7 AM for the liveliest market energy.",
    "Keep valuables in front pockets and haggle lightly.",
  ],
  "Sumilon Island": [
    "The reef fee covers the sandbar — book day visits ahead.",
    "Bring reef-safe sunscreen and your own snorkel set.",
  ],
  "Cebu Taoist Temple": [
    "Walk up the 81 steps and enjoy the city views from the top.",
    "Check opening days around Chinese holidays before visiting.",
  ],
  "Mactan Newtown Beach": [
    "Go around sunset for the boardwalk lights.",
    "Perfect for dinner-and-stroll — no swim gear needed.",
  ],
};

const slugCache = new Map<string, string>();

function slugify(name: string): string {
  const cached = slugCache.get(name);
  if (cached) return cached;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  slugCache.set(name, slug);
  return slug || "destination";
}

export function galleryImages(destination: Destination): string[] {
  const base = destination.image_url ? destination.image_url : `https://picsum.photos/seed/${slugify(destination.name)}/640/480`;
  const slug = slugify(destination.name);
  return [base, `https://picsum.photos/seed/${slug}-detail-1/900/600`, `https://picsum.photos/seed/${slug}-detail-2/900/600`];
}

const REGION_KEY = (destination: Destination): "Metro Cebu" | "North Cebu" | "South Cebu" => {
  const region = destination.region;
  return region === "Metro Cebu" || region === "North Cebu" || region === "South Cebu" ? region : "North Cebu";
};

export function getDestinationFacts(destination: Destination): DestinationFacts {
  const named = BY_NAME[destination.name];
  if (named) {
    return {
      entrance_fee: named.entrance_fee,
      visit_duration: named.visit_duration,
      opening_hours: named.opening_hours,
      activities: named.activities,
      transport: named.transport ?? [],
      extra_tips: EXTRA_TIPS[destination.name] ?? [],
    };
  }

  const fallback = CATEGORY_FACTS[destination.category] ?? DEFAULT_CATEGORY_FACTS;
  return {
    entrance_fee: fallback.entrance_fee,
    visit_duration: fallback.visit_duration,
    opening_hours: fallback.opening_hours,
    activities: fallback.activities,
    transport: fallback.transportByRegion[REGION_KEY(destination)] ?? fallback.fallbackTransport,
    extra_tips: [fallback.tip],
  };
}