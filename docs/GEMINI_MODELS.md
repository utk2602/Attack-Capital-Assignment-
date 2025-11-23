# Gemini API Model Names Reference

## Free Tier Models (Your API Key)

For free Gemini API keys, use these model names:

### ✅ **Correct Model Names:**

```typescript
// For transcription and general tasks
"gemini-1.5-flash";

// For more complex tasks (if available in your region)
"gemini-1.5-pro";

// Legacy models (if others don't work)
"gemini-pro";
```

### ❌ **WRONG Model Names (Will Fail):**

```typescript
"gemini-1.5-flash-latest"; // ❌ -latest suffix not supported in v1beta
"models/gemini-1.5-flash"; // ❌ models/ prefix not needed
"gemini-1.5-flash-001"; // ❌ Versioned names may not work
```

## Current Configuration

The app is now set to use:

- **Transcription**: `gemini-1.5-flash`
- **Summary**: `gemini-1.5-flash`

## Testing Model Names

If you still get 404 errors, try these alternatives in order:

### Option 1: Environment Variable (Recommended)

```bash
# Add to .env file
GEMINI_MODEL=gemini-1.5-flash
```

### Option 2: Try Different Models

Edit `src/lib/gemini.ts` line 42:

```typescript
// Try these in order until one works:
this.model = "gemini-1.5-flash"; // Try first
this.model = "gemini-pro"; // If flash fails
this.model = "gemini-1.5-pro"; // If you have pro access
```

## Verify Your Model Access

Run this test to see which models your API key can access:

```bash
# Create test file: test-gemini.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    // Try each model
    const models = [
      "gemini-1.5-flash",
      "gemini-1.5-pro",
      "gemini-pro",
      "gemini-1.0-pro"
    ];

    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        console.log(`✅ ${modelName} - WORKS`);
      } catch (error) {
        console.log(`❌ ${modelName} - ${error.message}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
```

```bash
# Run test
node test-gemini.js
```

## Common Issues

### Issue: "404 Not Found"

**Cause:** Model name doesn't match what your API key can access
**Solution:** Try `"gemini-pro"` instead of `"gemini-1.5-flash"`

### Issue: "API version v1beta"

**Cause:** Some regions/keys use v1 instead of v1beta
**Solution:** Model names should work the same, but ensure no prefix/suffix

### Issue: "Rate limit exceeded"

**Cause:** Free tier has strict rate limits
**Solution:**

- Wait 60 seconds between requests
- Add delays in code
- Upgrade to paid tier

## Current Fix Applied

I've changed all model references to:

```typescript
"gemini-1.5-flash"; // No -latest suffix
```

This should work with free tier API keys.

## If Still Not Working

Try the legacy model:

1. Open `src/lib/gemini.ts`
2. Change line 42 to: `this.model = "gemini-pro";`
3. Restart server: `npm run dev`

The `gemini-pro` model has been available since 2023 and should work with any API key.
