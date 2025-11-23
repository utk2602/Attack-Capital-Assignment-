# Troubleshooting Guide

## Common Issues and Solutions

### 1. "Daily session limit exceeded"

**Error:**

```
Session start failed: Daily session limit (10) exceeded. Try again in 24 hours.
```

**Cause:** You've hit the rate limit for session creation.

**Solutions:**

#### Option A: Clean up old sessions (Recommended for development)

```bash
# Clean sessions older than 1 hour
npm run cleanup:old

# Clean ALL sessions (use with caution!)
npm run cleanup:all

# Clean sessions for specific user
npm run cleanup:user <userId>
```

#### Option B: Increase rate limits temporarily

Edit `server/utils/rateLimiter.ts`:

```typescript
const MAX_SESSIONS_PER_DAY = 100; // Increase this value
```

#### Option C: Wait 24 hours

The limit resets after 24 hours from the first session.

---

### 2. "Socket.io disconnected immediately"

**Error:**

```
[Auth] Invalid token for socket abc123
Socket disconnected: server namespace disconnect
```

**Cause:** Authentication failed (usually missing or invalid cookies).

**Solutions:**

1. **Verify you're signed in:**
   - Open browser DevTools → Application → Cookies
   - Check if auth cookies exist for `localhost:3000`

2. **Clear cookies and sign in again:**

   ```javascript
   // In browser console
   document.cookie.split(";").forEach((c) => {
     document.cookie = c
       .replace(/^ +/, "")
       .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   ```

   Then refresh and sign in.

3. **Check Socket.io configuration:**
   ```typescript
   // In useSocket.ts - ensure this is set
   withCredentials: true;
   ```

---

### 3. "No session ID, chunk not sent"

**Error:**

```
No session ID, chunk not sent
```

**Cause:** Session creation failed, but audio recording started anyway.

**Solutions:**

1. **Check session creation response:**

   ```javascript
   const sessionId = await startSession(userId, title);
   if (!sessionId) {
     console.error("Failed to create session!");
     return; // Don't start recording
   }
   ```

2. **Verify rate limits aren't exceeded**
   - Check server logs for rate limit errors
   - Run cleanup script if needed

3. **Check network connection:**
   - Open DevTools → Network → WS (WebSocket)
   - Verify Socket.io connection is active

---

### 4. "Session start timed out"

**Error:**

```
Session start timed out
```

**Cause:** Server didn't respond within 5 seconds.

**Solutions:**

1. **Check server is running:**

   ```bash
   # Should show process on port 3000
   Get-NetTCPConnection -LocalPort 3000
   ```

2. **Check server logs:**

   ```bash
   # Look for errors in terminal running npm run dev
   ```

3. **Verify database connection:**

   ```bash
   npx prisma studio
   # Should open without errors
   ```

4. **Restart server:**
   ```bash
   npm run dev
   ```

---

### 5. "Prisma Client Not Found"

**Error:**

```
Property 'recordingSession' does not exist on type 'PrismaClient'
```

**Cause:** Prisma Client needs regeneration.

**Solution:**

```bash
npx prisma generate
```

---

### 6. "Port 3000 already in use"

**Error:**

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**

```powershell
# Windows PowerShell
$port = 3000
$process = Get-NetTCPConnection -LocalPort $port | Select-Object -ExpandProperty OwningProcess -Unique
Stop-Process -Id $process -Force
```

---

### 7. "Transcript not appearing"

**Cause:** Client not subscribed to session room.

**Solutions:**

1. **Verify room subscription:**

   ```javascript
   // Check browser console for:
   [Socket] abc123 joined room: session:xyz
   ```

2. **Manually join room:**

   ```javascript
   socket.emit("join", `session:${sessionId}`);
   ```

3. **Check TranscriptView is rendered:**
   ```tsx
   {
     sessionId && <TranscriptView sessionId={sessionId} />;
   }
   ```

---

### 8. "Gemini API 404 Error"

**Error:**

```
models/gemini-1.5-pro is not found for API version v1beta
```

**Cause:** Incorrect model name.

**Solution:**
Edit `server/processors/summary.ts`:

```typescript
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash", // Use "flash" not "pro"
});
```

---

### 9. "TypeScript compilation errors"

**Solutions:**

1. **Clear build cache:**

   ```bash
   Remove-Item -Recurse -Force .next, node_modules/.cache
   ```

2. **Reinstall dependencies:**

   ```bash
   Remove-Item -Recurse -Force node_modules
   npm install
   ```

3. **Check TypeScript version:**
   ```bash
   npx tsc --version
   ```

---

### 10. "Database connection failed"

**Error:**

```
Can't reach database server at `localhost:5432`
```

**Solutions:**

1. **Check PostgreSQL is running:**

   ```bash
   # Check if postgres is running
   Get-Process postgres
   ```

2. **Verify DATABASE_URL:**

   ```bash
   # Check .env file
   cat .env | Select-String DATABASE_URL
   ```

3. **Test connection:**
   ```bash
   npx prisma db pull
   ```

---

## Debugging Commands

### View Logs

```bash
# Server logs (in terminal running npm run dev)

# Browser logs
# Open DevTools → Console

# Database logs
npx prisma studio
```

### Check Database State

```bash
# Count sessions
npx prisma studio
# Or use psql:
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "RecordingSession";'
```

### Monitor Socket.io

```javascript
// In browser console
socket.on("connect", () => console.log("Connected:", socket.id));
socket.on("disconnect", (reason) => console.log("Disconnected:", reason));
socket.on("connect_error", (error) => console.error("Error:", error));
```

### Test API Endpoints

```bash
# Get session data
curl http://localhost:3000/api/sessions/SESSION_ID

# Test auth
curl http://localhost:3000/api/auth/get-session -H "Cookie: your-cookie"
```

---

## Prevention Tips

### Development

1. **Use cleanup scripts regularly:**

   ```bash
   npm run cleanup:old
   ```

2. **Monitor rate limits:**

   ```bash
   # Check active sessions count in server logs
   [RateLimit] Active sessions for user123: 2
   ```

3. **Test with short recordings:**
   - Start recording
   - Wait 5 seconds
   - Stop immediately
   - Verify everything works before long tests

### Production

1. **Set appropriate rate limits:**

   ```typescript
   const MAX_SESSIONS_PER_DAY = 50; // Based on your use case
   ```

2. **Implement monitoring:**
   - Track session creation failures
   - Alert on high error rates
   - Monitor API costs

3. **Add graceful degradation:**
   - Show user-friendly error messages
   - Offer alternatives (e.g., "Try again later")
   - Save work locally when possible

---

## Getting Help

1. **Check server logs first**
2. **Check browser console**
3. **Verify database state**
4. **Review recent code changes**
5. **Test with minimal example**

## Quick Reset (Nuclear Option)

If everything is broken:

```bash
# 1. Stop server
Get-Process -Name node | Stop-Process -Force

# 2. Clean database
npm run cleanup:all

# 3. Clear caches
Remove-Item -Recurse -Force .next, node_modules/.cache

# 4. Regenerate Prisma
npx prisma generate

# 5. Restart
npm run dev
```

Then refresh browser with Ctrl+Shift+R (hard refresh).
