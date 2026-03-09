export const CINEMAS = [
  { id: "ocine", name: "OCine 7 Palmas Premium", address: "C.C. Siete Palmas, Av. Pintor Felo Monzón", emoji: "🎪" },
  { id: "arenas", name: "Yelmo Cine Las Arenas", address: "C.C. Las Arenas, Ctra. del Rincón", emoji: "🎭" },
  { id: "alisios", name: "Yelmo Premium Alisios", address: "C.C. Alisios, Calle Hermanos Domínguez", emoji: "🎬" },
]

export const GENRES = ["Acción","Comedia","Drama","Terror","Sci-Fi","Thriller","Animación","Documental","Romance","Fantasía"]

// Supabase REST API config (from env or fallback)
const SB_URL = import.meta.env.VITE_SUPABASE_URL || "https://iikxvjegaqspaweysgfg.supabase.co"
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

export const SUPABASE_URL = SB_URL
export const SUPABASE_ANON = SB_KEY
export const SB_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Prefer": "return=representation"
}

// Admin — only this email sees the admin panel
export const ADMIN_EMAIL = 'alejandroelbisnes@gmail.com'

// Plan states
export const PLAN_STATES = {
  PROPOSED: 'proposed',
  WAITING_THEM: 'waiting_them',
  PICK_AVAIL: 'pick_avail',
  WAITING_PICK: 'waiting_pick',
  PICK_THEIRS: 'pick_theirs',
  CONFIRMED: 'confirmed',
  NO_MATCH: 'no_match',
}
