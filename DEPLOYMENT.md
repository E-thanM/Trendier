# Trendier - Self-Hosting Deployment Guide

## Architecture Overview

Trendier is a full-stack application with:
- **Frontend**: React + Vite (can be hosted on Vercel, Netlify, etc.)
- **Backend**: Supabase (Database, Auth, Storage, Edge Functions)

## Deploying to Vercel + Supabase

### Prerequisites
1. GitHub account
2. Vercel account (free tier works)
3. Supabase account (free tier works)

---

## Step 1: Set Up Your Own Supabase Project

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project"
3. Choose organization, name your project, set database password
4. Wait for project to be provisioned (~2 minutes)

### 1.2 Get Your Project Credentials
Once your project is ready:
1. Go to Project Settings > API
2. Copy these values (you'll need them later):
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - Project ID (e.g., `xxxxx`)
   - Anon/Public Key (starts with `eyJhbGc...`)

### 1.3 Run Database Migrations
You need to apply the database schema to your new project:

**Option A: Using Supabase CLI (Recommended)**
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# Push migrations
supabase db push
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase Dashboard > SQL Editor
2. Copy each SQL file from `supabase/migrations/` folder
3. Run them in order (sorted by filename timestamp)

### 1.4 Deploy Edge Functions
Your backend has two edge functions that need to be deployed:

```bash
# Deploy analyze-outfit function
supabase functions deploy analyze-outfit

# Deploy scrape-trends function  
supabase functions deploy scrape-trends
```

### 1.5 Configure Secrets
Your edge functions need the LOVABLE_API_KEY secret:

```bash
# Set the secret (you'll need a Lovable AI API key)
supabase secrets set LOVABLE_API_KEY=your_lovable_api_key_here
```

### 1.6 Set Up Storage Bucket
1. Go to Storage in Supabase Dashboard
2. Create a new bucket named `outfits`
3. Make it public (for user outfit images)

### 1.7 Configure Authentication
1. Go to Authentication > Providers
2. Enable Email provider
3. Go to Authentication > Settings
4. Enable "Confirm email" if you want email verification
5. Or disable it for easier testing (⚠️ not recommended for production)

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Push Code to GitHub
```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/trendier.git
git push -u origin main
```

### 2.2 Import to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### 2.3 Add Environment Variables
In Vercel project settings, add these environment variables:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...your_anon_key
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_ID
```

Replace with YOUR actual Supabase credentials from Step 1.2.

### 2.4 Deploy
Click "Deploy" and wait ~2 minutes for your site to go live!

---

## Step 3: Configure Supabase for Your Vercel Domain

### 3.1 Add Redirect URLs
1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add your Vercel domain to "Site URL":
   - `https://your-app.vercel.app`
3. Add to "Redirect URLs":
   - `https://your-app.vercel.app/**`
   - `http://localhost:8080/**` (for local development)

---

## Local Development Setup

### 1. Clone Your Repository
```bash
git clone https://github.com/YOUR_USERNAME/trendier.git
cd trendier
npm install
```

### 2. Create `.env` File
Create a `.env` file in the root directory:

```env
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key"
VITE_SUPABASE_URL="https://your_project_id.supabase.co"
```

### 3. Run Development Server
```bash
npm run dev
```

Your app will be available at `http://localhost:8080`

### 4. Develop Edge Functions Locally (Optional)
```bash
# Start Supabase local development
supabase start

# Serve functions locally
supabase functions serve

# In another terminal, run your frontend
npm run dev
```

---

## Responsive Design

The app is already fully responsive with:
- **Mobile View** (< 768px): Bottom navigation, mobile-optimized cards
- **Desktop View** (≥ 768px): Sidebar navigation, multi-column layouts

Vercel automatically serves the built static files and all responsive CSS works out of the box.

---

## Backend API Endpoints

Your Supabase edge functions are available at:

```
POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/analyze-outfit
POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/scrape-trends
```

### analyze-outfit
Analyzes outfit images against fashion trends.

**Request:**
```json
{
  "imageUrl": "https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/outfits/image.jpg",
  "targetStyle": "streetwear"
}
```

**Response:**
```json
{
  "rating": 8.5,
  "trendMatchScore": 75,
  "feedback": "Great streetwear look...",
  "matchingTrends": ["oversized-fits", "neutral-tones"]
}
```

### scrape-trends
Fetches current fashion trends (authenticated).

**Request:**
```json
{}
```

**Response:**
```json
{
  "trends": [
    {
      "id": "trend-id",
      "name": "Y2K Fashion",
      "category": "aesthetics",
      "popularity": 85
    }
  ]
}
```

---

## Database Schema

All tables and RLS policies are in `supabase/migrations/`. Key tables:

- `profiles` - User profiles
- `outfits` - User-uploaded outfit images
- `outfit_likes` - Outfit likes/reactions
- `outfit_comments` - Comments on outfits
- `trends` - Fashion trends
- `user_preferences` - User style preferences
- `conversations` - Direct messages
- `messages` - DM messages
- `conversation_participants` - DM participants

---

## Security Notes

🔒 **Row Level Security (RLS)** is enabled on all tables with proper policies

🔑 **Authentication** is required for most operations

🖼️ **Storage** bucket is public for outfit images (social platform)

⚡ **Edge Functions** are protected with JWT tokens (except scrape-trends which requires authentication)

---

## Troubleshooting

### "Failed to fetch" errors
- Check that VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are correctly set
- Verify your Supabase project is active

### Authentication not working
- Verify redirect URLs are configured in Supabase Auth settings
- Check that email confirmation is disabled for testing

### Edge functions failing
- Ensure functions are deployed: `supabase functions deploy`
- Check secrets are set: `supabase secrets list`
- View logs: `supabase functions logs <function-name>`

### Images not uploading
- Verify `outfits` storage bucket exists and is public
- Check RLS policies on `storage.objects`

---

## Cost Estimates

### Supabase Free Tier (Perfect for Starting)
- 500MB database space
- 1GB file storage
- 2GB bandwidth
- 50,000 monthly active users
- 500,000 Edge Function invocations

### Vercel Free Tier
- 100GB bandwidth
- Unlimited sites
- Automatic HTTPS

Both services offer generous free tiers suitable for launching your app! 🚀

---

## Support

For issues specific to:
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **This project**: Open an issue on GitHub
