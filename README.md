<p align="center"><img src="public/img/logo.svg" width="72" alt="ClassPulse logo"></p>

# ClassPulse — Real-time Interactive Classroom

A minimal LMS-style web app where teachers ask questions and every student answers live from their phone.
Inspired by **Socrative** (Quick Question, Exit Ticket, quizzes, reports) and **Slido** (poll types, word cloud, upvoted Q&A with moderation, timers, leaderboard).
Solves 50 problem statements from the "Interactive Classroom" brief: see [PROBLEMS.md](PROBLEMS.md).

## Features
- 6 question types: Multiple choice, True/False, Poll, Rating, Word cloud, Open text
- Timers, auto-grading, points with speed bonus, leaderboard
- Exit Ticket preset and a question queue (teacher-paced quiz)
- Anonymous "I'm confused" button, pace feedback (too fast / too slow), emoji reactions
- Anonymous Q&A with upvotes, moderation, mark answered, delete
- Students tab (who answered / confused / waiting), CSV report
- White LMS-green theme with a dark/light toggle (text colors adapt), mobile-first student UI

## What's new in v4 — saved data, teacher accounts, multiple sessions
- **Nothing disappears any more.** Sessions, questions, answers, scores, Q&A and the question queue are stored in a database (or a JSON file locally) instead of server memory. A restart, a cold start on Vercel, or a page refresh no longer wipes a class.
- **Teacher sign-in (name + PIN).** Use the same name and PIN every time to see all your sessions on any device. No email needed.
- **Multiple sessions.** Create as many sessions as you like (title, class, date, from/to time). Each one gets its own room code, students see only that room, and its data is kept separately.
- **Come back later.** Re-open any old session from "My sessions": all questions, results, the queue and every student's progress (answered / correct / points) are still there. "End session" locks students out but keeps the data; "Reopen session" continues it.
- **Students join with room code + name.** Their identity is kept in the browser, so a refresh or reopened tab puts them straight back in the same class with their score.
- **Browser localStorage** is also used for: teacher login, last open session, question queue, unsent question draft, and the last screen shown (so the page never goes blank while reconnecting).
- Live updates use short polling (teacher every 2 s, students every 3 s) instead of Server-Sent Events, because serverless hosts cannot keep connections open.

> Why not *only* localStorage? localStorage lives inside one browser on one device. The teacher's laptop and the students' phones can never see each other's localStorage, so real-time sharing needs a shared store on the server. localStorage is used as the local backup and for auto-resume.


## v4.1 — MongoDB Atlas + per-student timing
- **MongoDB Atlas storage.** Put `MONGODB_URI` in `.env` (see `.env.example`) and run `npm install` once; the server picks MongoDB automatically. Without it, the JSON file / Redis fallback still works. `/api/health` shows `"storage":"mongodb"` when connected, or the reason if Atlas is unreachable.
- **Atlas checklist:** Network Access must allow the IP of the machine that runs the server (students' phones never talk to Atlas, only the server does). For deployment (Render/Vercel) add `MONGODB_URI` as an environment variable and allow `0.0.0.0/0` in Network Access.
- **Per-student tracking.** Teacher dashboard now shows when each student joined, the exact time of their last answer, seconds taken per question (total and average), plus an *Answer log* (Report tab) and the same data in the CSV.
- **Consistency fix.** A student's profile, latest answer and last-seen heartbeat are stored as separate fields, so a heartbeat can no longer overwrite a just-submitted answer. Counters use atomic `$inc`.
- **Copy student link / Copy code** buttons on the Overview page (`/student?code=12345` pre-fills the room code).


## v4.2 — QR join + Vercel + MongoDB checklist
- **QR code** on the teacher Overview page (small preview, *Show QR on screen* for the projector, *Download QR* as PNG). The QR contains only the student page URL, **not** the room code: a student scans, types the room code the teacher announced, then types their name. Wrong room codes are rejected, and more than 20 wrong guesses per minute from one IP are blocked (HTTP 429).
- The QR uses the address the teacher opened (your Vercel URL when deployed; the Wi-Fi address when running locally), so open the teacher page from the **deployed** URL before showing the QR.

### Deploy on Vercel with MongoDB Atlas
1. Push the folder to GitHub (`.env` is git-ignored, do **not** upload it) and import the repo in Vercel.
2. Vercel project → **Settings → Environment Variables**: add `MONGODB_URI` (the full `mongodb+srv://user:password@cluster0.xxxx.mongodb.net` string) and `MONGODB_DB` = `classpulse`. Apply to Production, then **Redeploy**.
3. Atlas → **Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0)**. Vercel has no fixed IP, so this is required.
4. Open `https://<your-app>.vercel.app/api/health`. It must show `"storage":"mongodb","ok":true`. If it shows an error, the message says why (usually Network Access or a wrong password).
5. Open `/teacher`, sign in, create a session, show the QR.

## v5 — fixes from the usability evaluation
- **Timer is compulsory.** The teacher must choose a timer before sending or queuing a question (red message otherwise). "No timer" is still possible but only as an explicit choice. Exit Ticket questions now run for 2 minutes.
- **One answer only.** After a student locks in an answer it cannot be changed (the server rejects a second answer). Students first pick an option, then press "Lock in my answer", which prevents mis-taps.
- **Explanation.** The teacher can add an optional explanation to a question. When time is up (the question closes by itself), students see the correct answer and the explanation.
- **Teacher replies in Q&A.** The teacher writes a reply; it appears under the student's question and the student gets a notification. Replying also marks the question answered.
- **Bulk import.** Queue tab → "Import many questions": Word (.docx), .csv, .txt or pasted text. See the format and the template download on that screen. A preview is shown before adding to the queue.
- **QR code joins the room directly.** The QR now contains `/student?code=ROOMCODE`, so a scan only asks for the student's name. Typing the room code still works. Open the teacher page from your deployed (Vercel) address so the QR uses that address.
- **Live wall.** Overview → "Live wall" shows student emoji reactions floating on the projector screen.
- **Faster updates.** Students and teacher poll every 1 second, so ending a session or sending a question reaches phones in about 1 second.
- **Usability fixes.** Darker green for better contrast, 44 px theme button, in-app "How it works" card.

## v6 — made for Gen Z
- **Points that feel good.** Correct = 100 + speed bonus (up to 400) + streak bonus (25 per extra right answer in a row, max 125). Wrong = +10 "for trying", so nobody is left at zero.
- **Celebration and encouragement.** A correct answer fires confetti and a "+points" pop-up with a hype line ("Nailed it", "W answer"). A wrong answer gets a gentle shake and an encouraging line, never a harsh message. Respects "reduce motion" settings.
- **Streaks, levels and badges.** Levels: Newbie, Rising star, Brainiac, Legend. Badges: First answer, On fire (3 in a row), Speedster, Sharpshooter, Rising star, Class leader. A toast appears when a new badge unlocks.
- **Leaderboard.** Podium for the top 3, the student's own row highlighted, animal avatars, streak flames, "rank #2 of 8" on the student's phone.
- **Teacher side.** After a question closes the teacher sees "xx% got it right" with a class-level message (and confetti when the class does well).

## Project structure
```
classpulse/
├── server.js          # Node HTTP API (no dependencies)
├── store.js           # storage: MongoDB, Upstash/Vercel KV, JSON file or memory
├── package.json
├── render.yaml        # one-click deploy blueprint for Render
├── PROBLEMS.md        # 50 problem statements mapped to features
└── public/
    ├── index.html  teacher.html  student.html
    ├── css/style.css
    ├── js/theme.js  teacher.js  student.js  import.js  fx.js
    └── img/logo.svg   # logo and favicon
```

## Run locally
Requires Node.js 18+. Run `npm install` once (only needed for the MongoDB driver).
```
node server.js
```
- Teacher: http://localhost:3000/teacher → sign in → Create session
- Students (same WiFi): open the "Students" URL printed in the terminal, enter room code + name
- Data is saved to `data/db.json` (ignored by git). Delete that file to start fresh.

## Deploy on Vercel (needs a free database, 3 minutes)
Vercel runs every request in a fresh function, so it has no memory or disk that lasts. That is why sessions used to vanish. Connect a free Redis database once:
1. Push this repo to GitHub and import it in Vercel (as before).
2. In the Vercel project: **Storage → Create / Connect Database → Upstash Redis (free)** → connect it to this project. Vercel adds the environment variables automatically (`KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`).
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the variables are picked up.
4. Open `/teacher`. If storage is missing you will see a yellow warning on the sessions screen; `/api/health` also shows `"storage":"redis"` when it is working.

Each poll costs one database command, so a big class for a long time uses the free quota faster. Check your Upstash plan limits if you run many large sessions.

## Deploy on Render (alternative)
Render runs a normal always-on Node server, so it works without a database while it is awake. On the free plan the disk is temporary, so for long-term storage use Upstash there as well (same two environment variables), or attach a Render disk and set `DATA_FILE=/var/data/db.json`.
Build command: `npm install`, start command: `node server.js`.

## Quick public link without deploying
`npx localtunnel --port 3000` gives a temporary link to your running laptop.

## Notes
- Teacher accounts are just name + PIN (case-insensitive name). If someone knows both, they can open that teacher's sessions. This is meant for classroom use, not for sensitive data.
- Session times are informational (shown to students and in the list). Sessions are not locked by the clock, so a class that runs late is never cut off. Use "End session" when the class is over.
- Storage layout and API are in `store.js` and `server.js` (both small and commented).
"# Interactive-ClassRoom-final-version" 
