# Railway Deployment Quick Start

Your app is ready to deploy on Railway. Follow these steps:

## Step 1: Create Railway Account
Go to https://railway.app and sign up (free)

## Step 2: Push to GitHub
Make sure your code is on GitHub (with or without the .env file - don't commit it!)

```bash
git add .
git commit -m "Ready for production"
git push origin main
```

## Step 3: Connect GitHub to Railway
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Select your `CircuitBot.AI` repository
5. Click "Deploy Now"

Railway will auto-detect Node.js and start building. Takes ~2-3 minutes.

## Step 4: Add Environment Variables
Once deployment is building:

1. Click your project → Settings tab
2. Find "Environment Variables"
3. Click "Add Variable" and add these three:

```
OPENAI_API_KEY = your-openai-key-here

DEFAULT_MODEL = gpt-4o-mini

ALLOWED_MODELS = gpt-4o-mini,gpt-4o,gpt-4.1-mini,gpt-4.1,gpt-5,gpt-5.1
```

4. Deployment will automatically restart with the new variables

## Step 5: Get Your Live URL
Once deployment is complete (green checkmark):

1. Go to the "Deployments" tab
2. You'll see a URL like: `https://your-app-xxxxx.railway.app`
3. That's your live site! 🎉

Click the URL to test it.

## Step 6: (Optional) Custom Domain
To use your own domain instead of railway.app:

1. In Railway project → Settings → Domains
2. Click "Generate Domain" or "Add Custom Domain"
3. Follow DNS instructions for your domain registrar
4. Takes 5-30 minutes to propagate

## That's it!
Your site is now live and accessible to the world.

### Monitoring
- View logs: Railway dashboard → Deployments → Logs
- Check API: `https://your-app-xxxxx.railway.app/api/models`
- View stats: `https://your-app-xxxxx.railway.app/api/visitor-stats`

### Updates
To update after making changes:
```bash
npm run build
git add .
git commit -m "update"
git push origin main
```
Railway will auto-redeploy!

---

**Issues?** Check:
- Environment variables are set (need OPENAI_API_KEY)
- Build logs in Railway dashboard
- Server logs to see errors
- Try redeploying manually in Railway dashboard
