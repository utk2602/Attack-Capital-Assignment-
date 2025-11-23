
const fetch = require("node-fetch");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  console.log("Starting E2E smoke test against", BASE);
  const createResp = await fetch(`${BASE}/api/sessions`, { method: "POST" });
  if (!createResp.ok) return console.error("Failed to create session", await createResp.text());
  const session = await createResp.json();
  const sessionId = session.id || session.sessionId || session.data?.id;
  console.log("Created session", sessionId);
  await fetch(`${BASE}/api/sessions/${sessionId}/start`, { method: "POST" }).catch((e) =>
    console.error(e)
  );
  console.log("Sent start");
  const dummy = Buffer.from("fake-audio");
  const uploadResp = await fetch(`${BASE}/api/sessions/${sessionId}/upload-chunk`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: dummy,
  });
  console.log("Upload chunk status", uploadResp.status);
  await fetch(`${BASE}/api/sessions/${sessionId}/stop`, { method: "POST" }).catch((e) =>
    console.error(e)
  );
  console.log("Sent stop");
  for (let i = 0; i < 20; i++) {
    const s = await fetch(`${BASE}/api/sessions/${sessionId}`);
    const j = await s.json();
    if (j?.summaryJSON) {
      console.log("Summary ready");
      console.log(JSON.stringify(j.summaryJSON, null, 2));
      return;
    }
    console.log("Waiting for summary...");
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.error("Summary did not appear in time");
}

main().catch((e) => console.error(e));
