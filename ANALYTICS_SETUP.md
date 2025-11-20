# Visitor Tracking Setup Guide

Your CircuitBot.AI website now has visitor tracking enabled! Here's what was added:

## 🔧 What's Included

### 1. **Server-Side Visitor Logging** (Automatic)
   - Every request to your server is logged with:
     - Timestamp
     - Page/endpoint visited
     - IP address
     - User agent
   - Logs are saved to: `server/uploads/logs/visits-YYYY-MM-DD.log`
   - API calls are tracked separately in: `server/uploads/logs/api-usage.log`

### 2. **Google Analytics** (Recommended - Requires Setup)
   - Added to your frontend for detailed user behavior tracking
   - Track page views, user interactions, events, etc.
   - Get demographic insights, device info, traffic sources
   
   **Setup steps:**
   1. Go to https://analytics.google.com
   2. Sign in with your Google account
   3. Create a new property for your domain
   4. Copy your **Measurement ID** (looks like: `G-XXXXXXXXXX`)
   5. Replace `G-XXXXX` in `src/main.jsx` line 10 with your actual ID
   6. Deploy your site and wait 24-48 hours for data to appear

### 3. **Analytics Dashboard** (On Your Server)
   - New `/api/visitor-stats` endpoint available
   - Returns JSON with:
     - Total visits
     - Unique visitors (by IP)
     - Daily breakdown
     - Top pages visited
   
   **Access it:**
   - Frontend: Import the `Analytics.jsx` component into your app
   - Direct: `GET http://localhost:8787/api/visitor-stats` (local)
   - Direct: `GET https://yourdomain.com/api/visitor-stats` (production)

## 📊 Example Analytics Response

```json
{
  "totalVisits": 156,
  "uniqueVisitors": 42,
  "dailyBreakdown": {
    "2025-11-20": 45,
    "2025-11-19": 55,
    "2025-11-18": 56
  },
  "topPages": {
    "/": 89,
    "/api/models": 34,
    "/api/tts-preview": 22
  }
}
```

## 🚀 For Production Deployment

1. **Update CORS** in `server/index.js`:
   ```javascript
   app.use(cors({ origin: ["https://yourdomain.com", "https://www.yourdomain.com"] }));
   ```

2. **Update Google Analytics ID** in `src/main.jsx`

3. **Secure the stats endpoint** (optional - add authentication):
   ```javascript
   app.get("/api/visitor-stats", requireAuth, (req, res) => { ... });
   ```

4. **Logs persist** - They're stored in `server/uploads/logs/` directory

## 📈 Recommended Metrics to Track

- **Google Analytics** - User behavior, traffic sources, engagement
- **Server Logs** - Raw request data, API usage patterns
- **Custom Events** - Add tracking to important user actions:
  ```javascript
  if (window.gtag) {
    window.gtag('event', 'chat_sent', {
      message_length: text.length,
      model: selectedModel
    });
  }
  ```

## 🔒 Privacy Considerations

- You're collecting basic visitor data (IP, user agent)
- Ensure your privacy policy mentions this
- Consider GDPR compliance if you have EU users
- Don't track sensitive personal information

## 💡 Next Steps

1. Set up Google Analytics (takes 5 min)
2. Deploy to production
3. Monitor traffic for the first week
4. Add custom event tracking as needed

---

Questions? Check the Analytics.jsx component or server/index.js for implementation details.
