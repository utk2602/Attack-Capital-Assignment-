# Quality Assurance & UAT Checklist

## User Acceptance Testing (UAT)

### 1. Authentication

- [ ] User can sign up with email/password.
- [ ] User can sign in.
- [ ] User cannot access protected routes (e.g., `/history`) without login.
- [ ] User can sign out.

### 2. Recording & Transcription

- [ ] **Start Recording**: Clicking "Start" requests microphone permissions and begins recording.
- [ ] **Real-time Updates**: Transcript chunks appear within 5-10 seconds of speech.
- [ ] **Pause/Resume**:
  - [ ] Clicking "Pause" stops sending chunks.
  - [ ] Clicking "Resume" continues from where it left off.
- [ ] **Stop Recording**: Clicking "Stop" finalizes the session and triggers summary generation.
- [ ] **Long Session**: Recording for >5 minutes works without disconnection.

### 3. Session Management

- [ ] **History List**: New session appears in the history list immediately.
- [ ] **Session Detail**: Clicking a session shows the full transcript.
- [ ] **Summary**: AI summary appears after processing is complete.
- [ ] **Confidence**: Low confidence segments are marked with yellow/red indicators.

### 4. Export & Data

- [ ] **Export SRT**: Downloaded file has correct timestamps and formatting.
- [ ] **Export JSON**: Downloaded file contains all metadata.
- [ ] **Data Persistence**: Refreshing the page preserves the session history.

### 5. UI/UX

- [ ] **Dark Mode**: Toggling dark mode works and persists.
- [ ] **Responsiveness**: App looks good on mobile and desktop.
- [ ] **Error Handling**: Network disconnection shows a toast/alert.

## Final QA Run (30 Minutes)

1. **Clean Install**: Delete `node_modules` and `.next`, run `npm install && npm run dev`.
2. **Fresh DB**: Reset database (`npx prisma migrate reset`).
3. **Browser Test**: Open Chrome and Firefox.
4. **Scenario**:
   - Login as `tester@example.com`.
   - Record a 2-minute monologue.
   - Pause for 10 seconds.
   - Record 1 minute of "dialogue" (change voice pitch).
   - Stop.
   - Verify transcript accuracy and speaker labels.
   - Export as PDF/Markdown.
   - Check "Admin" cost dashboard (if enabled).
