# Storage & Retention Strategy for ScribeAI

## Overview

Recommended strategy for managing storage costs and performance for 1-hour recording sessions with high-frequency uploads.

---

## Storage Requirements Analysis

### Raw Audio Storage (Per 1-hour Session)

- **Chunk count**: 120 chunks (30s each)
- **Codec**: WebM Opus (client) + WAV PCM 16kHz mono (server processing)
- **Size estimates**:
  - WebM Opus: ~8-12 KB/chunk → **1.2 MB/hour**
  - WAV 16kHz: ~960 KB/chunk → **115 MB/hour**
  - Database metadata: ~2 KB/chunk → **240 KB/hour**

### Transcript & Summary Storage

- **Transcript text**: ~50-100 KB/hour (plain text)
- **Summary JSON**: ~5-10 KB (executive summary, action items, decisions)
- **Total**: ~100 KB/hour

---

## Recommended Retention Policy

### Tier 1: Hot Storage (Immediate Access)

**Duration**: 7 days  
**Contents**: Raw audio chunks (WebM), transcripts, summaries  
**Purpose**: User edits, re-processing, speaker correction  
**Cost**: High (SSD/local disk)

```
✅ Keep:
- Raw WebM chunks (storage/audio-chunks/)
- WAV temporary files (delete after transcription)
- Transcript text (PostgreSQL)
- Summary JSON (PostgreSQL)
```

### Tier 2: Warm Storage (Archive)

**Duration**: 30 days  
**Contents**: Compressed audio archives, transcripts  
**Purpose**: Compliance, audit trails, re-transcription  
**Cost**: Medium (S3 Standard or equivalent)

```
✅ Keep:
- Compressed ZIP archive of all WebM chunks
- Full transcript (TXT/SRT/VTT exports)
- Summary JSON
- Session metadata

❌ Delete:
- Individual WebM chunk files
- WAV temporary files
```

### Tier 3: Cold Storage (Long-term Archive)

**Duration**: 1+ years  
**Contents**: Transcripts only  
**Purpose**: Search history, compliance  
**Cost**: Low (S3 Glacier or database)

```
✅ Keep:
- Transcript text (searchable)
- Summary JSON
- Session metadata (startedAt, endedAt, userId)

❌ Delete:
- All audio files (raw and compressed)
```

### Deletion Policy

**After 1 year**: Delete all audio, keep transcripts indefinitely

---

## Compression Strategy

### 1. Immediate Post-Processing (After Session Ends)

**Trigger**: `stop-session` event  
**Actions**:

1. Delete WAV temporary files immediately
2. Validate all WebM chunks are intact
3. Create compressed archive: `session_<id>.zip`
4. Verify archive integrity
5. Move to warm storage (S3/cloud)
6. Delete local WebM chunks after successful upload

**Compression ratio**: 10-15% additional savings with ZIP

### 2. Archive Format

```
session_<sessionId>.zip
├── metadata.json (session details, summary)
├── transcript.txt
├── transcript.srt
├── chunks/
│   ├── 0000.webm
│   ├── 0001.webm
│   └── ...
```

### 3. Efficient Storage Pipeline

```
[Record] → [WebM Chunks] → [Transcribe] → [Archive ZIP] → [Cloud S3] → [Delete Local]
   |            ↓               ↓
   |        Upload to        Create WAV
   |        Server          (temp, delete)
   |            ↓
   |        Store in
   |      local disk
   |        (7 days)
```

---

## Cost Analysis (1000 hours/month)

### Without Retention Policy

- Raw audio: 115 GB × 1000 = **115 TB/month**
- Cost (S3 Standard @ $0.023/GB): **$2,645/month**

### With Retention Policy

**Hot (7 days)**:

- 115 GB × (7/30) = 27 GB → $0.62/month

**Warm (30 days - compressed)**:

- 1.2 GB × 1.15 (ZIP) × 1000 = 1.38 GB → $32/month

**Cold (1 year - transcripts only)**:

- 100 KB × 1000 × 12 = 1.2 GB → $0.004/month (Glacier)

**Total**: ~$33/month (98.8% savings)

---

## Implementation Checklist

### Phase 1: Immediate (7-day retention)

- [x] Store WebM chunks in local disk
- [ ] Implement cleanup job (delete after 7 days)
- [ ] Add session age tracking (createdAt + 7 days)

### Phase 2: Compression (30-day archive)

- [ ] Create post-session archiver worker
- [ ] Implement ZIP compression with metadata
- [ ] Upload to S3/cloud storage
- [ ] Verify and delete local chunks

### Phase 3: Cold Storage (1+ year)

- [ ] Transcript-only retention in PostgreSQL
- [ ] Delete archived audio after 1 year
- [ ] Implement search index for old transcripts

### Phase 4: Automation

- [ ] Cron job: Daily cleanup of expired sessions
- [ ] Monitoring: Disk usage alerts (>80% capacity)
- [ ] Metrics: Track storage costs per user/session

---

## Disk Space Planning

### Local Server Disk (Hot Storage)

- **Capacity**: 500 GB minimum
- **Buffer**: 20% free space
- **Max concurrent sessions**: ~3,500 hours (assuming 7-day retention)

### Cloud Storage (Warm + Cold)

- **S3 Standard**: 30-day archives
- **S3 Glacier**: Transcripts only (1+ year)
- **Lifecycle policies**: Auto-transition after retention periods

---

## Monitoring & Alerts

### Key Metrics

1. **Disk usage**: Alert at 80% capacity
2. **Archive success rate**: Track failed compressions
3. **Cleanup job status**: Daily execution logs
4. **S3 upload success**: Retry failed uploads

### Dashboard

```
📊 Storage Health
├── Hot: 45 GB / 500 GB (9%)
├── Warm (S3): 12 GB
├── Cold (Glacier): 1.2 GB
├── Sessions (7d): 1,234
└── Cleanup queue: 45 pending
```

---

## Recommended Tools

### Compression

- `archiver` (Node.js) - ZIP creation
- `tar` + `gzip` - Alternative for Unix systems

### Storage

- AWS S3 with lifecycle policies
- Cloudflare R2 (zero egress fees)
- Backblaze B2 (low-cost alternative)

### Cleanup

- `node-cron` - Scheduled cleanup jobs
- Bull queue - Async archival processing

---

## Sample Implementation

See `server/workers/retention.worker.ts` for:

- Automated cleanup after 7 days
- ZIP compression and S3 upload
- Database transcript retention

See `scripts/cleanup-old-sessions.js` for:

- Manual cleanup script
- Disk usage reporting
- Archive verification
