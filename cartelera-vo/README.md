# Cartelera VO — Deploy en Vercel

## Variables de entorno necesarias en Vercel

Cuando hagas el deploy, añade estas variables en Vercel → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://iikxvjegaqspaweysgfg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ANTHROPIC_KEY=sk-ant-...   ← tu API key de Anthropic
```

## Pasos para publicar

1. Sube esta carpeta a GitHub (repositorio nuevo)
2. Ve a vercel.com → New Project → importa el repo
3. Añade las variables de entorno
4. Deploy → en 2 min tienes la URL

## Tras el deploy

Ve a Supabase → Authentication → URL Configuration y añade:
- Site URL: https://tu-app.vercel.app
- Redirect URLs: https://tu-app.vercel.app

Y en Google Cloud Console → OAuth → Authorized redirect URIs añade:
- https://iikxvjegaqspaweysgfg.supabase.co/auth/v1/callback
