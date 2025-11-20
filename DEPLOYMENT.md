# Deployment Guide for CircuitBot.AI

Your site is ready to deploy! Here are your options:

## 🚀 Option 1: Vercel (Recommended - Easiest)

**Setup time: 5 minutes**

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login and deploy:**
   ```bash
   vercel
   ```

3. **Configure in Vercel Dashboard:**
   - Go to your project settings
   - Add Environment Variables:
     - `OPENAI_API_KEY` = your OpenAI key
     - `DEFAULT_MODEL` = gpt-4o-mini
     - `ALLOWED_MODELS` = gpt-4o-mini,gpt-4o,o1-mini

4. **Add this `vercel.json` file to root:**
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "installCommand": "npm install && npm install --prefix server",
     "devCommand": "npm run dev",
     "env": {
       "OPENAI_API_KEY": "@openai_api_key",
       "DEFAULT_MODEL": "gpt-4o-mini",
       "PORT": "3000"
     },
     "functions": {
       "server/index.js": {
         "maxDuration": 60
       }
     }
   }
   ```

**Pros:** Free tier, custom domains, automatic SSL, instant deploys
**Cons:** Limited free tier after certain usage

---

## 🚀 Option 2: Railway

**Setup time: 5 minutes**

1. **Go to:** https://railway.app
2. **Connect your GitHub repo** (or upload zip)
3. **Add environment variables** in Railway dashboard:
   - `OPENAI_API_KEY`
   - `DEFAULT_MODEL`
4. **Railway auto-detects Node.js app** and deploys
5. **Get your custom domain** from Railway dashboard

**Pros:** Generous free tier, simple interface, good for Node apps
**Cons:** Less integration than Vercel

---

## 🚀 Option 3: Heroku

**Setup time: 10 minutes**

1. **Create `Procfile` in root:**
   ```
   web: npm run install:server && node server/index.js
   ```

2. **Create `heroku.yml` in root:**
   ```yaml
   build:
     languages:
       - nodejs
   run:
     web: node server/index.js
   ```

3. **Install Heroku CLI** and deploy:
   ```bash
   heroku login
   heroku create your-app-name
   heroku config:set OPENAI_API_KEY=sk-xxx
   git push heroku main
   ```

**Pros:** Reliable, long track record
**Cons:** Free tier removed (now ~$5/month minimum)

---

## 🚀 Option 4: Your Own Server (VPS/Cloud)

Works on any Linux server (AWS, DigitalOcean, Linode, etc.)

1. **SSH into your server:**
   ```bash
   ssh user@your-ip
   ```

2. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone your repo:**
   ```bash
   git clone https://github.com/youruser/CircuitBot.AI.git
   cd CircuitBot.AI
   ```

4. **Create `.env` file:**
   ```bash
   nano .env
   ```
   Add your environment variables

5. **Install dependencies:**
   ```bash
   npm install
   npm install --prefix server
   npm run build
   ```

6. **Run with PM2 (process manager):**
   ```bash
   npm i -g pm2
   pm2 start "npm run start" --name circuitbot
   pm2 startup
   pm2 save
   ```

7. **Set up reverse proxy with Nginx:**
   ```bash
   sudo apt-get install nginx
   # Edit /etc/nginx/sites-available/default
   # Point to localhost:8787
   sudo systemctl restart nginx
   ```

8. **Add SSL with Certbot:**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

**Pros:** Full control, can run anything
**Cons:** More maintenance, you manage security/updates

---

## 📝 Pre-Deployment Checklist

- [ ] Build is successful: `npm run build`
- [ ] `.env` file created with all required variables
- [ ] `OPENAI_API_KEY` is set and valid
- [ ] Update `server/index.js` CORS with your domain
- [ ] Update Google Analytics ID in `src/main.jsx` (if using)
- [ ] Test locally: `npm run start`
- [ ] Check that `/api/models` endpoint works
- [ ] Verify your domain/DNS settings (if using custom domain)

---

## 🔒 Security Checklist

- [ ] Never commit `.env` file to git
- [ ] Use `.gitignore` to exclude sensitive files
- [ ] Enable HTTPS on your domain
- [ ] Keep OpenAI API key secure (rotate if exposed)
- [ ] Monitor API usage to prevent abuse
- [ ] Set up rate limiting (optional)
- [ ] Keep Node.js and dependencies updated

---

## 🆘 Troubleshooting

**"Cannot find module 'express'"**
- Run: `npm install --prefix server`

**"Port 8787 already in use"**
- Change PORT in .env to different port
- Or: `lsof -i :8787` to find and kill process

**"OPENAI_API_KEY not found"**
- Create .env file in root with your key
- Restart server after adding

**"dist folder not found"**
- Run: `npm run build`

**CORS errors in browser**
- Update allowed origins in `server/index.js`
- Restart server

---

## 📊 After Deployment

1. Test all features work
2. Check analytics at `/api/visitor-stats`
3. Monitor OpenAI API usage
4. Set up monitoring/alerts (optional)
5. Keep backups of your logs

---

## 🎯 Quick Start (Recommended)

**I recommend Railway or Vercel for simplicity:**

```bash
# 1. Build frontend
npm run build

# 2. Test production build locally
npm run start

# 3. Push to GitHub
git push origin main

# 4. Connect repo to Railway/Vercel (3 clicks)

# Done! Your site is live
```

Questions? Check server/index.js or ANALYTICS_SETUP.md
