# Debugging Guide - API Errors & Subject Detection

## Issue Summary

You're experiencing two main issues:
1. **"Failed to fetch" errors** when calling the OpenAI API
2. **Incorrect subject detection** - getting "General Study" instead of "Social Media Management"

## Debugging Steps

### 1. Check API Route Availability

First, verify the OpenAI API route is working:

```bash
# Test the API route directly (while dev server is running)
curl -X POST http://localhost:3000/api/openai \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "test"}],
    "max_tokens": 50
  }'
```

**Expected Response:** JSON with OpenAI completion or simulated response
**If it fails:** The API route has an issue

### 2. Check Environment Variables

Verify your `.env.local` file has:
```
OPENAI_API_KEY=sk-...your-actual-key...
```

**Test in console:**
```javascript
// In browser dev tools
console.log('OPENAI_API_KEY configured:', !!process.env.OPENAI_API_KEY)
```

### 3. Debug Network Requests

Open browser dev tools → Network tab and look for:
- **Failed `/api/openai` requests** - Check status code and error message
- **CORS errors** - Look for cross-origin issues
- **Timeout errors** - OpenAI API taking too long

### 4. Test Subject Detection Logic

Add this temporary test in the browser console:

```javascript
// Test the enhanced subject detection
const message = "help me learn social media management and advertising"

// Simulate the pattern matching logic
const patterns = [
  { pattern: /social media|social networking|instagram|facebook|twitter|linkedin|tiktok|marketing/i, subject: 'Social Media Management' },
  { pattern: /advertising|ads|google ads|facebook ads|ppc|sem|marketing campaigns/i, subject: 'Digital Advertising' }
]

let extractedSubject = 'General Study'
for (const { pattern, subject } of patterns) {
  if (pattern.test(message)) {
    extractedSubject = subject
    console.log('Found match:', subject)
    break
  }
}

console.log('Final subject:', extractedSubject)
```

**Expected Output:** Should log "Found match: Social Media Management"

## Common Solutions

### Solution 1: API Route Issues

If the API route is failing, check:

**A. Server not running properly:**
```bash
# Stop and restart dev server
npm run dev
```

**B. Port conflicts:**
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000
```

**C. API key format:**
- Ensure API key starts with `sk-`
- No extra spaces or quotes
- Key is valid and has credits

### Solution 2: Network/CORS Issues

If you see CORS or network errors:

**A. Check if running on correct URL:**
- Use `http://localhost:3000` not `127.0.0.1:3000`
- Ensure no browser extensions blocking requests

**B. Firewall/antivirus blocking:**
- Temporarily disable firewall/antivirus
- Add exception for Node.js/Next.js

### Solution 3: Subject Detection Not Working

If the improved fallback logic isn't working:

**A. Check console logs:**
```
🎯 Fallback subject analysis: { ... }
```

**B. Verify patterns are matching:**
Your message "help me learn social media management and advertising" should match the pattern:
```javascript
/social media|social networking|instagram|facebook|twitter|linkedin|tiktok|marketing/i
```

**C. Check for caching issues:**
```javascript
// Clear the analysis cache in browser console
messageAnalysisCache.clear()
```

## Advanced Debugging

### Enable Detailed Logging

Add this to `src/lib/openaiClient.ts` for more detailed error info:

```typescript
export async function chatCompletion(params: {
  messages: unknown
  model?: string
  temperature?: number
  max_tokens?: number
}): Promise<ChatCompletionResponse> {
  console.log('🚀 Making OpenAI request:', { 
    url: '/api/openai',
    method: 'POST',
    body: { model: OPENAI_MODEL, ...params }
  })
  
  const res = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, ...params }),
  })
  
  console.log('📡 OpenAI response status:', res.status, res.statusText)
  
  if (!res.ok) {
    const errorText = await res.text()
    console.error('❌ OpenAI error response:', errorText)
    throw new Error(`OpenAI request failed: ${res.status} ${errorText}`)
  }
  
  const result = await res.json()
  console.log('✅ OpenAI success:', result)
  return result
}
```

### Check Server Logs

Look at your terminal/console where `npm run dev` is running for:
- **OpenAI API errors**
- **Server startup issues**
- **Database connection problems**

### Test Minimal Case

Create a simple test to isolate the issue:

```typescript
// Add this to a component and test
const testAPI = async () => {
  try {
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      })
    })
    
    if (!response.ok) {
      console.error('API Error:', response.status, await response.text())
      return
    }
    
    const result = await response.json()
    console.log('API Success:', result)
  } catch (error) {
    console.error('Fetch Error:', error)
  }
}
```

## Expected Behavior

After fixing the issues:

1. **API calls should work:** No more "Failed to fetch" errors
2. **Subject detection should work:** "help me learn social media management and advertising" should create a subject named "Social Media Management" or "Digital Advertising"
3. **Fallback should be robust:** Even if OpenAI API fails, the pattern matching should extract the correct subject

## When to Use Fallback vs API

- **API Available:** Precise subject analysis with confidence scores
- **API Unavailable:** Pattern-based extraction with good accuracy for common subjects
- **Both should work** for your use case without requiring OpenAI API

Let me know which specific issue you're seeing and I can help debug further! 