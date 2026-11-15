import Pusher from "pusher-js";

const API = "http://localhost:8000/api";
const TRIP = 18;
const STOP = 83;
const OWNER = { email: "planner@example.com", password: "password123" };
const MEMBER = { email: "e2e.member.1794707981@lakbai.test", password: "password123" };

const send = async (method, path, body, token) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await res.json() };
};
const login = async (creds) => (await send("POST", "/login", creds)).body.token;

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
  auth: { headers: { Authorization: `Bearer ${member}` } },
});

const events = [];
const channel = pusher.subscribe(`private-itinerary.${TRIP}.tracking`);
channel.bind("pusher:subscription_succeeded", async () => {
  console.log("SUBSCRIBED as member");

  // Owner marks arrival at the first stop -> members should hear member.arrived.
  const arrive = await send("POST", `/itineraries/${TRIP}/stops/${STOP}/arrive`, {}, owner);
  console.log("ARRIVE", arrive.status);

  // Three rapid pings should yield one member.location (5s throttle per user).
  for (let i = 0; i < 3; i += 1) {
    const now = new Date().toISOString();
    const r = await send(
      "POST",
      `/itineraries/${TRIP}/tracking/points`,
      { points: [{ lat: 10.3161 + i * 0.0001, lng: 123.886, accuracy: 9, recorded_at: now }] },
      member,
    );
    console.log("PING", i, r.status, r.body?.data?.accepted);
  }
});

for (const name of ["member.location", "member.sharing", "member.presence", "member.arrived", "meetup.pinned"]) {
  channel.bind(name, (data) => {
    events.push(name);
    console.log("EVENT", name, JSON.stringify(data));
  });
}

setTimeout(() => {
  const locations = events.filter((e) => e === "member.location").length;
  console.log("RESULT", JSON.stringify({ locations, arrived: events.includes("member.arrived"), events }));
  pusher.disconnect();
  process.exit(0);
}, 9000);
