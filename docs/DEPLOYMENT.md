# Deployment & Operations Guide

## Gemini API Integration

### Getting an API Key

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **"Get API key"**.
3. Create a key in a new or existing Google Cloud project.
4. **Security Best Practice**:
   - Restrict the API key to specific APIs (Generative Language API).
   - Never commit the key to Git.
   - Store it in `.env` as `GEMINI_API_KEY`.

### Rate Limits

- **Free Tier**: 15 RPM (Requests Per Minute), 32,000 TPM (Tokens Per Minute), 1,500 RPD (Requests Per Day).
- **Pay-as-you-go**: Higher limits.
- **Handling**: ScribeAI implements a queue system (`simple-queue.ts`) to throttle requests. If you hit rate limits, increase the delay between chunk processing or implement exponential backoff.

## Cost Optimization

Transcription costs can scale quickly. Here are strategies to minimize them:

1. **Batching**: Instead of sending every 5-second chunk immediately, buffer 3-4 chunks on the server and send a 20-second request. This reduces the number of API calls and overhead.
2. **Sampling**: For non-critical "gist" summaries, you might skip every other chunk or process only the first 10 minutes (not recommended for full transcription).
3. **Prompt Engineering**: Use shorter, concise prompts to save input tokens.
4. **Model Selection**: Use `gemini-1.5-flash` for faster, cheaper, lower-quality transcription, and `gemini-1.5-pro` for high-accuracy final summaries.

## Deployment Plan

### Frontend (Next.js) -> Vercel

1. Push code to GitHub.
2. Import project in Vercel.
3. Set Environment Variables:
   - `NEXT_PUBLIC_SOCKET_URL`: URL of your backend (e.g., `https://scribe-backend.onrender.com`)
   - `NEXT_PUBLIC_API_URL`: Same as above or internal API.
4. Deploy.

### Backend (Node.js/Socket.io) -> Render / Heroku

1. Create a Web Service.
2. Connect GitHub repo.
3. Build Command: `npm install && npm run build` (ensure `server/tsconfig.json` is used).
4. Start Command: `npm start` (runs `server/server.ts`).
5. Set Environment Variables:
   - `GEMINI_API_KEY`: Your key.
   - `DATABASE_URL`: Connection string to your PostgreSQL DB.
   - `CORS_ORIGIN`: Your Vercel frontend URL (e.g., `https://scribe-ai.vercel.app`).

### Database -> Supabase / Neon / Railway

1. Provision a PostgreSQL database.
2. Get the connection string (`postgres://...`).
3. Run migrations: `npx prisma migrate deploy`.
