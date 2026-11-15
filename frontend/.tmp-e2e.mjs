import Pusher from "pusher-js";

const API = "http://localhost:8000/api";
const TRIP = 18;
const OWNER = { email: "planner@example.com", password: "password123" };
const MEMBER = { email: "e2e.member.1794707981@lakbai.test", password: "password123" };

const post = async (path, body, token) => {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
};
const patch = async (path, body, token) => {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
};
const login = async (creds) => (await post("/login", creds)).token;

const owner = await login(OWNER);
const member = await login(MEMBER);

const pusher = new Pusher("lakbai-local-key", {
  wsHost: "localhost",
  wsPort: 6001,
  wssPort: 6001,
  forceTLS: false,
  enabledTransports: ["ws"],
  cluster: "mt1",
  authEndpoint: `${API}/broadcasting/auth`,
  auth: { headers: { Authorization: `Bearer ${owner}` } },
});

const received = [];
const channel = pusher.subscribe(`private-itinerary.${TRIP}.tracking`);

channel.bind("pusher:subscription_succeeded", async () => {
  console.log("SUBSCRIBED");
  await patch(`/itineraries/${TRIP}/tracking/sharing`, { enabled: true }, member);
  const now = new Date().toISOString();
  await post(
    `/itineraries/${TRIP}/tracking/points`,
    { points: [{ lat: 10.3161, lng: 123.886, accuracy: 9, recorded_at: now }] },
    member,
  );
  await post(
    `/itineraries/${TRIP}/tracking/meetup`,
    { lat: 10.317, lng: 123.887, note: "E2E meetup" },
    owner,
  );
});
channel.bind("pusher:subscription_error", (err) => {
  console.log("SUBSCRIPTION_ERROR", JSON.stringify(err));
});

for (const name of ["member.location", "member.sharing", "member.presence", "member.arrived", "meetup.pinned"]) {
  channel.bind(name, (data) => {
    received.push({ name, data });
    console.log("EVENT", name, JSON.stringify(data));
  });
}

setTimeout(() => {
  console.log("RESULT", JSON.stringify({ events: received.map((e) => e.name) }));
  pusher.disconnect();
  process.exit(0);
}, 8000);
