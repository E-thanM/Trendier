# Trendier 👗

A modern fashion social platform for analyzing outfits, discovering trends, and connecting with fashion enthusiasts.

## 🚀 Quick Start

### Option 1: Deploy to Vercel + Supabase (Recommended for Self-Hosting)
See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete self-hosting guide.

### Option 2: Local Development
```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd trendier

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

### Option 3: Use Lovable (Original Development Environment)
Visit the [Lovable Project](https://lovable.dev/projects/6f80b55b-fee4-49fe-ab97-270c70876639) and start prompting.

## 📱 Features

- **Outfit Analysis**: AI-powered outfit rating and trend matching
- **Fashion Trends**: Browse and explore current fashion trends with 600+ hashtags
- **Social Feed**: Share outfits and engage with the community
- **Direct Messaging**: Connect with other fashion enthusiasts
- **User Profiles**: Showcase your style and preferences
- **Responsive Design**: Optimized for mobile and desktop

## 🏗️ Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- Shadcn/ui (component library)
- React Router (navigation)
- TanStack Query (data fetching)

**Backend:**
- Supabase (database, auth, storage)
- PostgreSQL (database)
- Row Level Security (RLS)
- Edge Functions (serverless API)

**AI:**
- Lovable AI API (outfit analysis)
- Gemini 2.5 Flash (vision model)

## 📁 Project Structure

```
trendier/
├── src/
│   ├── components/       # React components
│   ├── pages/           # Page components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   ├── integrations/    # Supabase client
│   └── index.css        # Global styles & design tokens
├── supabase/
│   ├── functions/       # Edge functions (backend API)
│   │   ├── analyze-outfit/   # AI outfit analysis
│   │   └── scrape-trends/    # Fashion trend scraper
│   └── migrations/      # Database schema & RLS policies
├── public/              # Static assets
├── DEPLOYMENT.md        # Self-hosting guide
├── vercel.json         # Vercel configuration
└── .env.example        # Environment variables template
```

## 🔧 Environment Variables

Required environment variables (see `.env.example`):

```env
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_URL="https://xxxxx.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_key"
```

## 🗄️ Database Schema

All backend code is exposed in the repository:

**Tables** (`supabase/migrations/`):
- `profiles` - User profiles and metadata
- `outfits` - User-uploaded outfit images
- `outfit_likes` - Like/reaction system
- `outfit_comments` - Comment system
- `trends` - Fashion trend data (600+ themes)
- `user_preferences` - User style preferences
- `conversations` & `messages` - Direct messaging

**Edge Functions** (`supabase/functions/`):
- `analyze-outfit` - AI-powered outfit analysis with vision model
- `scrape-trends` - Fashion trend data aggregation

All tables protected with Row Level Security (RLS) policies.

## 🛡️ Security

- ✅ Row Level Security enabled on all tables
- ✅ Anonymous authentication for seamless onboarding
- ✅ Input validation on edge functions (Zod schemas)
- ✅ JWT-based authentication
- ✅ Secure file storage with RLS policies

## 📦 Available Scripts

```bash
npm run dev          # Start development server (localhost:8080)
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🌐 Deployment

The app is split into two parts for independent hosting:

1. **Frontend** (Vercel/Netlify/etc): Static React app
2. **Backend** (Supabase): Database, auth, storage, edge functions

### Self-Hosting on Vercel + Supabase

**All backend functions are already exposed in this repository:**
- Database migrations: `supabase/migrations/*.sql`
- Edge functions: `supabase/functions/*/index.ts`
- Auth configuration: In migration files
- Storage policies: In migration files

**Complete deployment guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)

**Quick Steps:**
1. Create your own Supabase project
2. Run migrations to set up database
3. Deploy edge functions to your Supabase project
4. Deploy frontend to Vercel with environment variables
5. Configure auth redirect URLs

### Deploy via Lovable (Easiest)

Simply open [Lovable](https://lovable.dev/projects/6f80b55b-fee4-49fe-ab97-270c70876639) and click Share → Publish.

## 📱 Responsive Design

The app automatically adapts to different screen sizes:

- **Mobile View** (< 768px): 
  - Bottom navigation bar
  - Single-column layout
  - Touch-optimized interactions
  - Mobile-first card designs

- **Desktop View** (≥ 768px):
  - Sidebar navigation
  - Multi-column grid layouts
  - Hover interactions
  - Expanded content display

Vercel (or any static host) serves the built files, and CSS media queries handle responsive behavior automatically.

## 🔌 Backend API Endpoints

When self-hosting, your edge functions will be available at:

```
POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/analyze-outfit
POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/scrape-trends
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for API documentation and examples.

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

- **Self-hosting help**: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Supabase docs**: [supabase.com/docs](https://supabase.com/docs)
- **Vercel docs**: [vercel.com/docs](https://vercel.com/docs)
- **Lovable docs**: [docs.lovable.dev](https://docs.lovable.dev)
