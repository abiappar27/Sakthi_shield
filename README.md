# Sakhi Shield – working prototype (v1.1)
Run: `node server.js` (Node 16+, no install) → http://localhost:3000
- User app `/` : disguised calculator. PIN **1234** = real app, **0000** = duress (decoy Notes app + silent alert)
- Contact view `/guardian.html?role=contact` · Guardian view `/guardian.html`
Demo: open all three pages, tap SOS (5 s cancel window). Contact sees it instantly, guardians (anonymous, ~100 m blur) at 30 s, police tier (simulated) at 60 s.
Tests: `npm i && npm test` runs 19 end-to-end checks (server + both pages executed in jsdom).
Phone use: mic, GPS and crypto need HTTPS (e.g. `npx ngrok http 3000`). Speech trigger needs Chrome/Edge.
Hardware features (microphone, speech recognition, GPS, shake sensor) depend on browser and device permissions and are not covered by the automated tests.
Not production-ready: no authentication, evidence is hashed but not encrypted, police tier is simulated, alerts persist to data.json.
