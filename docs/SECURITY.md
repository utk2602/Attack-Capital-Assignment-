# Security Considerations

## Security Checklist

### 1. Authentication & Authorization

- [x] **Secure Session Management**: Use HTTP-only, Secure cookies for session tokens to prevent XSS attacks.
- [x] **Role-Based Access Control (RBAC)**: Ensure users can only access their own recordings. Verify `userId` on every API call.
- [ ] **Rate Limiting**: Implement rate limiting on API routes (e.g., `express-rate-limit` or Next.js middleware) to prevent abuse and DoS attacks.

### 2. Data Protection

- [ ] **Encryption at Rest**: Encrypt sensitive fields in the database (e.g., transcripts, summaries) if they contain PII.
- [ ] **Encryption in Transit**: Enforce HTTPS for all client-server communication.
- [ ] **Storage Security**: Use signed URLs (e.g., AWS S3 Presigned URLs) for accessing audio files instead of public buckets. Set short expiration times.

### 3. API Key Management

- [x] **Server-Side Only**: Never expose `GEMINI_API_KEY` or database credentials in client-side code. Use Next.js API routes or the backend server as a proxy.
- [ ] **Key Rotation**: Regularly rotate API keys and secrets.
- [ ] **Usage Quotas**: Set usage quotas on the Google Cloud Console to prevent billing surprises if keys are compromised.

### 4. Input Validation

- [x] **Sanitization**: Validate and sanitize all user inputs (Zod schemas) to prevent SQL injection and NoSQL injection.
- [ ] **File Validation**: Strictly validate uploaded file types (MIME checks) and sizes to prevent malicious file uploads.

### 5. Infrastructure

- [ ] **Environment Variables**: Store secrets in `.env` files, never in version control. Use a secrets manager in production.
- [ ] **Dependency Scanning**: Regularly run `npm audit` or use GitHub Dependabot to identify vulnerable dependencies.
