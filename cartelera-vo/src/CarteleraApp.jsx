import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'

const GRADIENTS = [
  ["#0f0c29","#302b63"],["#1a1a2e","#16213e"],["#0d1117","#1c2333"],
  ["#1e3a5f","#0d2137"],["#2d1b69","#11023e"],["#1a0a2e","#3d1168"],
  ["#0a1628","#1e3a5f"],["#162032","#0d2137"],
];
const TABS = [
  { id: "cartelera", label: "Cartelera", icon: "🎬" },
  { id: "grupo", label: "Mi Grupo", icon: "👥" },
  { id: "perfil", label: "Perfil", icon: "👤" },
  { id: "alertas", label: "Alertas", icon: "🔔" },
];

function getDayDates() {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() + i);
    const labels = ["Hoy","Mañana","Pasado"];
    return {
      label: i < 3 ? labels[i] : d.toLocaleDateString("es-ES", { weekday: "short" }),
      date: d,
      dateStr: d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
    };
  });
}

function generateGroupCode() {
  const words = ["PALM","CINE","FILM","SALA","OLAS","LUNA","STAR","VOSE","GRAN","ISLA"];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${w1}${num}`;
}

function generateUserId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

const AVATAR_EMOJIS = ["🦁","🐬","🦊","🐙","🦋","🐝","🦜","🐢","🦩","🐘","🦚","🐳"];

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────
// ─── SHARED GROUP STORAGE (Supabase — real backend, truly cross-user) ──────────
const SB_URL = "https://iikxvjegaqspaweysgfg.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpa3h2amVnYXFzcGF3ZXlzZ2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTMwMjcsImV4cCI6MjA4ODQ4OTAyN30.8Asky185LFqyCD1YEO8MTgLKmbeDmvglcFJFee94J_A";
const SB_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Prefer": "return=representation"
};

// Fetch group row (members + votes)
async function groupGet(code) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/grupos?code=eq.${encodeURIComponent(code)}&select=*`, {
      headers: SB_HEADERS
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0] || null;
  } catch { return null; }
}

// Create a new group row
async function groupCreate(code, memberObj) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/grupos`, {
      method: "POST",
      headers: SB_HEADERS,
      body: JSON.stringify({
        code,
        members: { [memberObj.id]: memberObj },
        votes: {}
      })
    });
    return res.ok;
  } catch { return false; }
}

// Update members object
async function groupUpdateMembers(code, members) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/grupos?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: SB_HEADERS,
      body: JSON.stringify({ members })
    });
    return res.ok;
  } catch { return false; }
}

// Update votes object
async function groupUpdateVotes(code, votes) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/grupos?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: SB_HEADERS,
      body: JSON.stringify({ votes })
    });
    return res.ok;
  } catch { return false; }
}


// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────
async function fetchMoviesFromClaude(cinema, date) {
  const dateLabel = date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: "Responde ÚNICAMENTE con JSON puro. Sin markdown. Sin backticks. Sin texto extra. Empieza con { directamente.",
      messages: [{
        role: "user",
        content: `Cartelera VO para "${cinema.name}" Las Palmas de Gran Canaria el ${dateLabel}.
Responde SOLO con JSON (sin \`\`\`, empieza con {):
{"movies":[{"title":"string","originalTitle":"string en inglés","genre":"string","duration":110,"rating":"7.8","letterboxd":"3.9","synopsis":"max 100 chars","showtimes":["17:30","20:00","22:15"],"language":"Inglés","director":"string","year":2025,"awards":"string","studio":"string"}]}
Incluye 4-5 películas de estreno reales 2024-2025 que actualmente estén en cartelera en España. Géneros variados. Letterboxd entre 3.2 y 4.5. El campo originalTitle debe ser el título original en inglés exacto para búsqueda en TMDB.`
      }],
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  const textBlock = data.content?.find(b => b.type === "text");
  if (!textBlock) throw new Error("Sin respuesta");
  let raw = textBlock.text.trim().replace(/^```[\w]*\n?/gm,"").replace(/```\s*$/gm,"").trim();
  const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("JSON no encontrado");
  const parsed = JSON.parse(raw.substring(s, e + 1));
  if (!Array.isArray(parsed.movies)) throw new Error("Sin array movies");
  return parsed.movies;
}

// ─────────────────────────────────────────────────────────────────────────────
// POSTER FETCHER — uses TMDB public image CDN via Claude AI for path lookup
// ─────────────────────────────────────────────────────────────────────────────
const posterCache = {};

async function fetchPoster(title, originalTitle, year, tmdbId) {
  const key = tmdbId ? `id:${tmdbId}` : (originalTitle || title) + (year || "");
  if (posterCache[key] !== undefined) return posterCache[key];

  // If we already have a tmdb_id from the movie data, build URL directly
  if (tmdbId) {
    // We still need the poster_path — use Claude to look it up
  }

  try {
    const query = originalTitle || title;
    const prompt = `Give me ONLY the TMDB poster_path for the movie "${query}" (${year || "recent"}). 
The poster_path looks like "/abc123xyz.jpg". 
Respond with ONLY the poster_path string starting with /, nothing else. 
If you don't know it exactly, respond with: null`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        system: "You are a movie database assistant. Respond with ONLY the requested data, no explanations.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text?.trim() || "null";
    
    if (raw === "null" || !raw.startsWith("/")) {
      posterCache[key] = null;
      return null;
    }
    
    const url = `https://image.tmdb.org/t/p/w342${raw}`;
    posterCache[key] = url;
    return url;
  } catch {
    posterCache[key] = null;
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px", borderRadius: 20, cursor: "pointer",
      border: active ? "none" : "1px solid rgba(255,255,255,0.13)",
      background: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.06)",
      color: active ? "#000" : "rgba(255,255,255,0.7)",
      fontSize: 13, fontFamily: "inherit", fontWeight: active ? 600 : 400,
      whiteSpace: "nowrap", transition: "all 0.2s ease",
    }}>{children}</button>
  );
}

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", animation: "pulse 1.5s ease-in-out infinite" }}>
      <div style={{ display: "flex", minHeight: 160 }}>
        <div style={{ width: 108, flexShrink: 0, background: "rgba(255,255,255,0.07)" }} />
        <div style={{ flex: 1, padding: "16px 14px" }}>
          <div style={{ height: 9, width: "40%", background: "rgba(255,255,255,0.08)", borderRadius: 5, marginBottom: 10 }} />
          <div style={{ height: 19, width: "80%", background: "rgba(255,255,255,0.11)", borderRadius: 7, marginBottom: 6 }} />
          <div style={{ height: 13, width: "55%", background: "rgba(255,255,255,0.06)", borderRadius: 5, marginBottom: 10 }} />
          <div style={{ height: 10, width: "35%", background: "rgba(255,255,255,0.05)", borderRadius: 5 }} />
        </div>
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", gap: 6 }}>
        {[1,2,3].map(i => <div key={i} style={{ height: 28, width: 58, background: "rgba(255,255,255,0.07)", borderRadius: 9 }} />)}
      </div>
    </div>
  );
}

function StarRating({ value }) {
  const v = parseFloat(value) || 0;
  return (
    <span style={{ fontSize: 11, letterSpacing: 0.5 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= Math.round(v) ? "#ffd60a" : "rgba(255,255,255,0.2)" }}>★</span>
      ))}
      <span style={{ color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>{value}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999, display: "flex", flexDirection: "column", gap: 8, minWidth: 280, maxWidth: 340 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          borderRadius: 14, padding: "13px 16px",
          background: t.type === "vote" ? "rgba(255,214,10,0.15)" : t.type === "join" ? "rgba(52,199,89,0.15)" : "rgba(255,255,255,0.12)",
          border: `1px solid ${t.type === "vote" ? "rgba(255,214,10,0.4)" : t.type === "join" ? "rgba(52,199,89,0.4)" : "rgba(255,255,255,0.2)"}`,
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          animation: "slideDown 0.3s ease", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{t.emoji}</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>{t.title}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{t.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOVIE CARD
// ─────────────────────────────────────────────────────────────────────────────
function MovieCard({ movie, index, cinema, day, onWatched, isWatched, alerts, groupCode, groupMember, onVote, groupVotes }) {
  const [expanded, setExpanded] = useState(false);
  const [poster, setPoster] = useState(null);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [g0, g1] = GRADIENTS[index % GRADIENTS.length];

  useEffect(() => {
    fetchPoster(movie.title, movie.originalTitle, movie.year).then(url => {
      setPoster(url);
    });
  }, [movie.title]);

  const matchesAlert = alerts.some(a =>
    (a.type === "director" && movie.director?.toLowerCase().includes(a.value.toLowerCase())) ||
    (a.type === "genre" && movie.genre?.toLowerCase().includes(a.value.toLowerCase())) ||
    (a.type === "cinema" && cinema?.id === a.value)
  );

  const movieKey = `${movie.title}||${cinema?.id}||${day?.label}`;
  const myVote = groupVotes[movieKey]?.votes?.[groupMember?.id];
  const allVotes = groupVotes[movieKey]?.votes || {};
  const voterCount = Object.keys(allVotes).length;
  const voterList = groupVotes[movieKey]?.voterNames || {};

  return (
    <div style={{
      borderRadius: 20,
      background: `linear-gradient(145deg, ${g0}, ${g1})`,
      border: matchesAlert ? "1.5px solid rgba(255,214,10,0.5)" : "1px solid rgba(255,255,255,0.09)",
      overflow: "hidden",
      boxShadow: voterCount > 0 ? "0 0 28px rgba(255,214,10,0.1), 0 4px 24px rgba(0,0,0,0.5)" : "0 4px 24px rgba(0,0,0,0.45)",
      opacity: isWatched ? 0.65 : 1,
      transition: "transform 0.18s, box-shadow 0.18s",
      position: "relative",
    }}
    onMouseEnter={e => { if (!isWatched) e.currentTarget.style.transform = "scale(1.012)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {/* Main content row: poster + info */}
      <div onClick={() => setExpanded(!expanded)} style={{ cursor: "pointer", display: "flex", minHeight: 160 }}>

        {/* POSTER */}
        <div style={{ width: 108, flexShrink: 0, position: "relative", overflow: "hidden", background: "rgba(0,0,0,0.4)" }}>
          {poster ? (
            <>
              {!posterLoaded && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.5)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              )}
              <img
                src={poster}
                alt={movie.title}
                onLoad={() => setPosterLoaded(true)}
                style={{
                  width: "100%", height: "100%", objectFit: "cover",
                  display: posterLoaded ? "block" : "none",
                  transition: "opacity 0.3s ease",
                }}
              />
            </>
          ) : (
            <div style={{ width: "100%", height: "100%", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(0,0,0,0.25)" }}>
              <span style={{ fontSize: 28 }}>🎬</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "0 6px" }}>Sin póster</span>
            </div>
          )}
          {/* Gradient overlay on poster */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 60%, rgba(0,0,0,0.3))" }} />
        </div>

        {/* INFO */}
        <div style={{ flex: 1, padding: "16px 14px 14px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            {/* Badges top-right */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 5, marginBottom: 6 }}>
              {matchesAlert && <span style={{ background: "rgba(255,214,10,0.15)", border: "1px solid rgba(255,214,10,0.4)", borderRadius: 7, padding: "2px 7px", fontSize: 9, fontWeight: 700, color: "#ffd60a" }}>🔔</span>}
              {isWatched && <span style={{ background: "rgba(52,199,89,0.15)", border: "1px solid rgba(52,199,89,0.3)", borderRadius: 7, padding: "2px 7px", fontSize: 9, fontWeight: 700, color: "#34c759" }}>✓</span>}
            </div>

            {/* VO + studio */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.38)", textTransform: "uppercase" }}>VO · {movie.language || "EN"}</span>
              {movie.studio && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.07)", padding: "2px 5px", borderRadius: 4 }}>{movie.studio}</span>}
            </div>

            {/* Title */}
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.2 }}>{movie.title}</h3>
            {movie.originalTitle && movie.originalTitle !== movie.title && (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{movie.originalTitle}</p>
            )}

            {/* Genre + duration */}
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: 6 }}>{movie.genre}</span>
              {movie.duration && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{movie.duration} min</span>}
            </div>

            {/* Ratings */}
            <div style={{ display: "flex", gap: 10, marginTop: 7 }}>
              {movie.rating && <span style={{ fontSize: 11, fontWeight: 700, color: "#ffd60a" }}>★ {movie.rating}</span>}
              {movie.letterboxd && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>LB {movie.letterboxd}</span>}
            </div>
          </div>

          {/* Awards */}
          {movie.awards && (
            <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.4)", lineHeight: 1.3 }}>{movie.awards}</div>
          )}
        </div>
      </div>

      {/* Showtimes row */}
      <div style={{ padding: "0 14px 14px 14px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {(movie.showtimes || []).map((t, i) => (
            <span key={i} style={{ display: "inline-block", padding: "5px 12px", borderRadius: 9, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.02em" }}>{t}</span>
          ))}
        </div>

        {/* Expanded synopsis */}
        {expanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", animation: "fadeIn 0.2s ease" }}>
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "rgba(255,255,255,0.58)", lineHeight: 1.6 }}>{movie.synopsis}</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Dir. {movie.director} · {movie.year}</p>
          </div>
        )}

        {/* Group vote section */}
        {groupCode && groupMember && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {voterCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ display: "flex" }}>
                  {Object.values(voterList).slice(0, 5).map((name, i) => (
                    <div key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: `hsl(${i * 60}, 60%, 40%)`, border: "2px solid #09090b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, marginLeft: i > 0 ? -5 : 0 }}>
                      {name.charAt(0)}
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  {Object.values(voterList).slice(0,2).join(", ")}{voterCount > 2 ? ` +${voterCount-2}` : ""} {voterCount === 1 ? "quiere verla" : "quieren verla"}
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => onVote(movie, cinema, day, !myVote)} style={{
                flex: 1, borderRadius: 11, border: `1px solid ${myVote ? "rgba(255,214,10,0.5)" : "rgba(255,255,255,0.12)"}`,
                background: myVote ? "rgba(255,214,10,0.12)" : "rgba(255,255,255,0.06)",
                padding: "9px", cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: 700, color: myVote ? "#ffd60a" : "rgba(255,255,255,0.6)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5, transition: "all 0.2s",
              }}>
                {myVote ? "🎟️ Me apunto" : "🎟️ ¿Me apunto?"}
              </button>
              <button onClick={() => onWatched(movie)} style={{
                borderRadius: 11, border: `1px solid ${isWatched ? "rgba(52,199,89,0.35)" : "rgba(255,255,255,0.1)"}`,
                background: isWatched ? "rgba(52,199,89,0.1)" : "rgba(255,255,255,0.04)",
                padding: "9px 12px", cursor: "pointer", fontFamily: "inherit",
                fontSize: 11, color: isWatched ? "#34c759" : "rgba(255,255,255,0.4)", transition: "all 0.2s",
              }}>{isWatched ? "✓" : "Vista"}</button>
              <button onClick={() => setExpanded(!expanded)} style={{
                borderRadius: 11, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)",
                padding: "9px 11px", cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.3)",
                transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)",
              }}>▾</button>
            </div>
          </div>
        )}

        {!groupCode && (
          <div style={{ display: "flex", gap: 7, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <button onClick={() => onWatched(movie)} style={{
              flex: 1, borderRadius: 11, border: `1px solid ${isWatched ? "rgba(52,199,89,0.35)" : "rgba(255,255,255,0.1)"}`,
              background: isWatched ? "rgba(52,199,89,0.1)" : "rgba(255,255,255,0.04)", padding: "9px",
              cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
              color: isWatched ? "#34c759" : "rgba(255,255,255,0.5)", transition: "all 0.2s",
            }}>{isWatched ? "✓ Vista" : "✓ Marcar vista"}</button>
            <button onClick={() => setExpanded(!expanded)} style={{
              borderRadius: 11, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.04)",
              padding: "9px 13px", cursor: "pointer", fontSize: 13, color: "rgba(255,255,255,0.3)",
              transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)",
            }}>▾</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP TAB
// ─────────────────────────────────────────────────────────────────────────────
function GroupTab({ groupCode, groupMember, onCreateGroup, onJoinGroup, onLeaveGroup, groupData, groupVotes, onSwitchToCartelera }) {
  const [joinInput, setJoinInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState("main"); // main | create | join

  const [copiedLink, setCopiedLink] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(groupCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const [showInvite, setShowInvite] = useState(false);

  function copyInviteLink() {
    // Copy a clear invite message with the group code
    const msg = `🎬 ¡Únete a mi grupo de cine en Cartelera VO!\n\nPasos:\n1. Descarga el archivo cartelera-laspalmas.jsx\n2. Ábrelo en claude.ai (cuenta gratuita)\n3. Ve a la pestaña 👥 Mi Grupo\n4. Pulsa "Unirse a grupo" e introduce el código:\n\n👉 ${groupCode}\n\nNos vemos en el cine 🍿`;
    navigator.clipboard.writeText(msg).then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 3000); });
  }

  // Aggregate votes from groupVotes
  const allVotedMovies = Object.entries(groupVotes)
    .filter(([, v]) => Object.keys(v.votes || {}).length > 0)
    .sort((a, b) => Object.keys(b[1].votes).length - Object.keys(a[1].votes).length);

  const members = groupData?.members || {};

  if (!groupCode) {
    return (
      <div style={{ padding: "24px 20px 100px" }}>
        {view === "main" && (
          <>
            <div style={{ textAlign: "center", padding: "40px 0 32px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>Grupo de Cine</h2>
              <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, maxWidth: 260, marginLeft: "auto", marginRight: "auto" }}>
                Crea un grupo con tus amigos y vota las películas que queréis ver juntos
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onClick={() => setView("create")} style={{
                borderRadius: 18, padding: "18px", background: "linear-gradient(135deg, #1a1a2e, #302b63)",
                border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Crear grupo nuevo</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Genera un código y compártelo con tus amigos</div>
              </button>
              <button onClick={() => setView("join")} style={{
                borderRadius: 18, padding: "18px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔗</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Unirme a un grupo</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Introduce el código que te han compartido</div>
              </button>
            </div>
          </>
        )}

        {view === "create" && (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            <button onClick={() => setView("main")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 20, padding: 0 }}>← Volver</button>
            <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>Crear grupo</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "rgba(255,255,255,0.4)" }}>¿Cómo te llaman tus amigos?</p>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="Tu nombre o apodo..."
              style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: "#fff", fontFamily: "inherit", marginBottom: 14 }} />
            <button onClick={async () => {
              if (!nameInput.trim()) return;
              setCreating(true);
              await onCreateGroup(nameInput.trim());
              setCreating(false); setView("main");
            }} disabled={!nameInput.trim() || creating} style={{
              width: "100%", borderRadius: 14, padding: "15px",
              background: nameInput.trim() ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${nameInput.trim() ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
              color: nameInput.trim() ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 15, fontWeight: 700, cursor: nameInput.trim() ? "pointer" : "not-allowed", fontFamily: "inherit",
            }}>
              {creating ? "Creando..." : "Crear grupo ✨"}
            </button>
          </div>
        )}

        {view === "join" && (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            <button onClick={() => setView("main")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 20, padding: 0 }}>← Volver</button>
            <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>Unirme a un grupo</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "rgba(255,255,255,0.4)" }}>Introduce el código y tu nombre</p>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Tu nombre..." style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: "#fff", fontFamily: "inherit", marginBottom: 10 }} />
            <input value={joinInput} onChange={e => setJoinInput(e.target.value.toUpperCase())} placeholder="Código del grupo (ej: PALM421)" style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "14px 16px", fontSize: 15, color: "#fff", fontFamily: "inherit", letterSpacing: "0.1em", marginBottom: 14 }} />
            <button onClick={async () => {
              if (!joinInput.trim() || !nameInput.trim()) return;
              setJoining(true);
              await onJoinGroup(joinInput.trim(), nameInput.trim());
              setJoining(false); setView("main");
            }} disabled={!joinInput.trim() || !nameInput.trim() || joining} style={{
              width: "100%", borderRadius: 14, padding: "15px",
              background: (joinInput.trim() && nameInput.trim()) ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${(joinInput.trim() && nameInput.trim()) ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"}`,
              color: (joinInput.trim() && nameInput.trim()) ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>
              {joining ? "Uniéndome..." : "Unirme al grupo 🔗"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Group dashboard
  return (
    <div style={{ padding: "20px 20px 100px" }}>
      {/* Group header */}
      <div style={{ borderRadius: 22, background: "linear-gradient(145deg, #1a1a2e, #302b63)", border: "1px solid rgba(255,255,255,0.12)", padding: "22px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tu grupo de cine</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.04em", color: "#fff", wordBreak: "break-all", maxWidth: 180 }}>{groupCode}</span>
              <button onClick={copyCode} style={{
                background: copied ? "rgba(52,199,89,0.2)" : "rgba(255,255,255,0.1)", border: `1px solid ${copied ? "rgba(52,199,89,0.4)" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit",
                fontSize: 12, fontWeight: 700, color: copied ? "#34c759" : "#fff", transition: "all 0.2s",
              }}>
                {copied ? "✓ Copiado" : "Copiar código"}
              </button>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Comparte este código con tus amigos</p>
            {/* Invite button */}
            <button onClick={() => setShowInvite(!showInvite)} style={{
              marginTop: 12, width: "100%", borderRadius: 14, padding: "13px 16px",
              background: showInvite ? "rgba(255,214,10,0.08)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${showInvite ? "rgba(255,214,10,0.3)" : "rgba(255,255,255,0.1)"}`,
              cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center",
              gap: 10, transition: "all 0.2s",
            }}>
              <span style={{ fontSize: 18 }}>📨</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: showInvite ? "#ffd60a" : "#fff" }}>
                  ¿Cómo invito a mis amigos?
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                  Ver instrucciones paso a paso
                </div>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.3)", transition: "transform 0.2s", display: "inline-block", transform: showInvite ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
            </button>

            {/* Invite instructions panel */}
            {showInvite && (
              <div style={{ marginTop: 10, borderRadius: 14, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,214,10,0.15)", padding: "18px", animation: "fadeIn 0.2s ease" }}>
                <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Cómo unirse al grupo</p>
                
                {[
                  { n: "1", icon: "📥", title: "Comparte el archivo", desc: "Mándale el archivo cartelera-laspalmas.jsx a tu amigo" },
                  { n: "2", icon: "🌐", title: "Que lo abra en Claude", desc: "Tu amigo lo sube en claude.ai (cuenta gratuita)" },
                  { n: "3", icon: "👥", title: "Ir a pestaña Grupo", desc: 'Pulsa la pestaña "👥 Mi Grupo" en la app' },
                  { n: "4", icon: "🔑", title: "Introducir el código", desc: `Pulsa "Unirse" e introduce el código:` },
                ].map(step => (
                  <div key={step.n} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>{step.n}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{step.icon} {step.title}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{step.desc}</div>
                      {step.n === "4" && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 900, letterSpacing: "0.15em", color: "#fff", background: "rgba(255,255,255,0.08)", padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)" }}>{groupCode}</span>
                          <button onClick={copyInviteLink} style={{
                            borderRadius: 10, padding: "8px 14px", border: `1px solid ${copiedLink ? "rgba(52,199,89,0.4)" : "rgba(255,255,255,0.15)"}`,
                            background: copiedLink ? "rgba(52,199,89,0.15)" : "rgba(255,255,255,0.08)",
                            cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                            color: copiedLink ? "#34c759" : "#fff", transition: "all 0.2s", whiteSpace: "nowrap",
                          }}>
                            {copiedLink ? "✓ Copiado" : "📋 Copiar mensaje"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(255,214,10,0.06)", border: "1px solid rgba(255,214,10,0.15)", borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                    💡 <strong style={{ color: "rgba(255,255,255,0.65)" }}>¿Por qué necesita Claude?</strong> La app funciona dentro de claude.ai. Con cuenta gratuita es suficiente. Los datos del grupo se sincronizan automáticamente entre todos los miembros.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Members */}
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Miembros ({Object.keys(members).length})
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.values(members).map((m, i) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.07)",
                border: m.id === groupMember?.id ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "6px 12px",
              }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: `hsl(${i * 60}, 60%, 40%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: m.id === groupMember?.id ? "#fff" : "rgba(255,255,255,0.65)", fontWeight: m.id === groupMember?.id ? 700 : 400 }}>
                  {m.name} {m.id === groupMember?.id ? "(tú)" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Votes panel */}
      {allVotedMovies.length > 0 ? (
        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "18px", marginBottom: 14 }}>
          <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            🎟️ Películas votadas
          </p>
          {allVotedMovies.map(([key, data]) => {
            const [title, cinemaId, dayLabel] = key.split("||");
            const votes = Object.keys(data.votes || {}).length;
            const names = Object.values(data.voterNames || {});
            const totalMembers = Object.keys(members).length;
            const pct = totalMembers > 0 ? (votes / totalMembers) * 100 : 0;
            return (
              <div key={key} style={{ marginBottom: 14, padding: "14px", background: "rgba(255,255,255,0.04)", borderRadius: 14, border: votes === totalMembers && totalMembers > 1 ? "1px solid rgba(52,199,89,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                {votes === totalMembers && totalMembers > 1 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#34c759", marginBottom: 6 }}>🎉 ¡Todos de acuerdo!</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>{title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{CINEMAS.find(c => c.id === cinemaId)?.name || cinemaId} · {dayLabel}</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: votes > 0 ? "#ffd60a" : "rgba(255,255,255,0.3)" }}>{votes}/{totalMembers}</span>
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #ffd60a, #ff9f0a)", borderRadius: 2, transition: "width 0.5s ease" }} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {names.map((n, i) => (
                    <span key={i} style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.07)", padding: "3px 8px", borderRadius: 7 }}>{n}</span>
                  ))}
                </div>
                {data.showtimes && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {data.showtimes.map((t, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "32px 20px", background: "rgba(255,255,255,0.03)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎟️</div>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: 500, margin: "0 0 6px" }}>Aún no hay votos</p>
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, margin: 0 }}>Ve a la cartelera y pulsa "¿Me apunto?" en las películas que quieras ver</p>
        </div>
      )}

      <button onClick={() => onSwitchToCartelera()} style={{
        width: "100%", borderRadius: 14, padding: "14px",
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 12,
      }}>🎬 Ir a la cartelera</button>

      <button onClick={onLeaveGroup} style={{
        width: "100%", borderRadius: 14, padding: "14px",
        background: "rgba(255,69,58,0.07)", border: "1px solid rgba(255,69,58,0.18)",
        color: "rgba(255,69,58,0.7)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>Salir del grupo</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
function ProfileTab({ watched }) {
  const total = watched.length;
  const totalMin = watched.reduce((s, m) => s + (m.duration || 100), 0);
  const genreCounts = {}, directorCounts = {};
  watched.forEach(m => {
    if (m.genre) genreCounts[m.genre] = (genreCounts[m.genre] || 0) + 1;
    if (m.director) directorCounts[m.director] = (directorCounts[m.director] || 0) + 1;
  });
  const topGenres = Object.entries(genreCounts).sort((a,b) => b[1]-a[1]).slice(0,5);
  const topDirs = Object.entries(directorCounts).sort((a,b) => b[1]-a[1]).slice(0,3);
  const avg = watched.length ? (watched.reduce((s,m) => s + parseFloat(m.rating || 7),0) / watched.length).toFixed(1) : "—";
  const level = total >= 50 ? "Cinéfilo Absoluto VO" : total >= 20 ? "Cinéfilo Avanzado" : total >= 10 ? "Cinéfilo Regular" : total >= 5 ? "Cinéfilo Iniciado" : "Espectador VO";
  const nextLevel = total < 5 ? 5 : total < 10 ? 10 : total < 20 ? 20 : total < 50 ? 50 : null;
  const pct = nextLevel ? Math.round((total / nextLevel) * 100) : 100;

  return (
    <div style={{ padding: "20px 20px 100px" }}>
      <div style={{ borderRadius: 22, background: "linear-gradient(145deg, #1a1a2e, #16213e)", border: "1px solid rgba(255,255,255,0.1)", padding: "24px", marginBottom: 14, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg, #302b63, #0f0c29)", border: "2px solid rgba(255,255,255,0.12)", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🎬</div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>Perfil Cinéfilo</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "rgba(255,255,255,0.38)" }}>{level}</p>
        {nextLevel && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Siguiente nivel</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{total}/{nextLevel}</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #302b63, #9b59b6)", borderRadius: 2 }} />
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[{ l: "Películas", v: total }, { l: "Horas", v: `${Math.floor(totalMin/60)}h` }, { l: "Media", v: avg }].map(s => (
            <div key={s.l} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 8px" }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.04em" }}>{s.v}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {topGenres.length > 0 && (
        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "16px", marginBottom: 12 }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Géneros favoritos</p>
          {topGenres.map(([g, n], i) => (
            <div key={g} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < topGenres.length-1 ? 9 : 0 }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", width: 78, flexShrink: 0 }}>{g}</span>
              <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(n/topGenres[0][1])*100}%`, background: "linear-gradient(90deg, #302b63, #9b59b6)", borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", width: 14, textAlign: "right" }}>{n}</span>
            </div>
          ))}
        </div>
      )}

      {watched.length === 0 && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎞️</div>
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 15, fontWeight: 500, margin: "0 0 6px" }}>Aún no has marcado películas</p>
          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 13 }}>Marca películas como vistas desde la cartelera</p>
        </div>
      )}

      {watched.length > 0 && (
        <div style={{ borderRadius: 18, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "16px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Historial</p>
          {[...watched].reverse().map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < watched.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.28)" }}>{m.director} · {m.genre}</p>
              </div>
              <span style={{ fontSize: 11, color: "#ffd60a", fontWeight: 700 }}>★ {m.rating}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function AlertsTab({ alerts, onAdd, onRemove }) {
  const [type, setType] = useState("genre");
  const [value, setValue] = useState("");
  const [custom, setCustom] = useState("");
  const presets = { genre: GENRES, director: DIRECTORS_POOL.slice(0,8), cinema: CINEMAS.map(c => c.name) };
  const labels = { genre: "Género", director: "Director/a", cinema: "Cine" };
  const icons = { genre: "🎭", director: "🎬", cinema: "📍" };

  function add() {
    const v = type === "cinema" ? value : (value || custom).trim();
    if (!v) return;
    onAdd({ type, value: v, id: Date.now() });
    setValue(""); setCustom("");
  }

  return (
    <div style={{ padding: "20px 20px 100px" }}>
      <div style={{ borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "18px", marginBottom: 16 }}>
        <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Nueva alerta</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {Object.entries(labels).map(([t, l]) => (
            <button key={t} onClick={() => { setType(t); setValue(""); setCustom(""); }} style={{
              flex: 1, padding: "9px 6px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
              border: type === t ? "1.5px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: type === t ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
              fontSize: 12, fontWeight: 600, color: type === t ? "#fff" : "rgba(255,255,255,0.42)",
            }}>{icons[t]} {l}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
          {presets[type].slice(0,8).map(p => (
            <button key={p} onClick={() => setValue(p === value ? "" : p)} style={{
              padding: "6px 12px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit",
              border: value === p ? "1.5px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
              background: value === p ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
              fontSize: 12, color: value === p ? "#fff" : "rgba(255,255,255,0.52)",
            }}>{p}</button>
          ))}
        </div>
        {type !== "cinema" && (
          <input value={custom} onChange={e => setCustom(e.target.value)} placeholder={`O escribe un ${labels[type].toLowerCase()}…`}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 14px", fontSize: 13, color: "#fff", fontFamily: "inherit", marginBottom: 12 }} />
        )}
        <button onClick={add} disabled={!value && !custom.trim()} style={{
          width: "100%", borderRadius: 12, padding: "13px",
          background: (value || custom.trim()) ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${(value || custom.trim()) ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.07)"}`,
          color: (value || custom.trim()) ? "#fff" : "rgba(255,255,255,0.28)",
          fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>+ Crear alerta</button>
      </div>

      {alerts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Activas ({alerts.length})</p>
          {alerts.map(a => (
            <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 14, background: "rgba(255,214,10,0.06)", border: "1px solid rgba(255,214,10,0.18)", padding: "13px 16px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 15 }}>{icons[a.type]}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff" }}>{a.value}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.32)" }}>{labels[a.type]}</p>
                </div>
              </div>
              <button onClick={() => onRemove(a.id)} style={{ background: "rgba(255,69,58,0.12)", border: "1px solid rgba(255,69,58,0.25)", borderRadius: 9, padding: "5px 11px", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#ff453a", fontFamily: "inherit" }}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 15, fontWeight: 500, margin: "0 0 6px" }}>Sin alertas activas</p>
          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 13 }}>Las películas que coincidan se resaltarán en la cartelera</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARTELERA TAB
// ─────────────────────────────────────────────────────────────────────────────
function CartelleraTab({ alerts, watched, onWatched, groupCode, groupMember, groupVotes, onVote }) {
  const days = getDayDates();
  const [selDay, setSelDay] = useState(0);
  const [selCinema, setSelCinema] = useState(0);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nextSession, setNextSession] = useState(null);
  const [searchingNext, setSearchingNext] = useState(false);
  const cacheRef = useRef({});

  async function load(ci, di) {
    const key = `${ci}-${di}`;
    if (cacheRef.current[key]) { setMovies(cacheRef.current[key]); setError(null); return; }
    setLoading(true); setMovies([]); setError(null);
    try {
      const r = await fetchMoviesFromClaude(CINEMAS[ci], days[di].date);
      cacheRef.current[key] = r; setMovies(r); setLastUpdated(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function findNext() {
    setSearchingNext(true); setNextSession(null);
    for (let di = 0; di < days.length; di++) {
      for (let ci = 0; ci < CINEMAS.length; ci++) {
        try {
          const r = await fetchMoviesFromClaude(CINEMAS[ci], days[di].date);
          if (r?.length > 0) {
            const key = `${ci}-${di}`;
            cacheRef.current[key] = r;
            setNextSession({ day: days[di], cinema: CINEMAS[ci] });
            setSelCinema(ci); setSelDay(di); setMovies(r); setError(null);
            setSearchingNext(false); return;
          }
        } catch {}
      }
    }
    setSearchingNext(false);
  }

  useEffect(() => { load(0, 0); }, []);

  const filtered = movies.filter(m => !search ||
    m.title?.toLowerCase().includes(search.toLowerCase()) ||
    m.originalTitle?.toLowerCase().includes(search.toLowerCase()) ||
    m.genre?.toLowerCase().includes(search.toLowerCase())
  );

  const alertMatches = movies.filter(m => alerts.some(a =>
    (a.type === "director" && m.director?.toLowerCase().includes(a.value.toLowerCase())) ||
    (a.type === "genre" && m.genre?.toLowerCase().includes(a.value.toLowerCase()))
  )).length;

  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(9,9,11,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Las Palmas de GC</p>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em" }}>Cartelera VO</h1>
          </div>
          <div style={{ textAlign: "right" }}>
            {groupCode && <div style={{ background: "rgba(255,214,10,0.1)", border: "1px solid rgba(255,214,10,0.25)", borderRadius: 10, padding: "4px 10px", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "#ffd60a", fontWeight: 700 }}>👥 {groupCode}</span>
            </div>}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(52,199,89,0.1)", border: "1px solid rgba(52,199,89,0.2)", borderRadius: 12, padding: "4px 10px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34c759", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, color: "#34c759", fontWeight: 600 }}>En vivo</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.07)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", padding: "10px 14px", marginBottom: 13 }}>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.28)" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar película, género, director..."
            style={{ flex: 1, background: "none", border: "none", fontSize: 14, color: "#fff", fontFamily: "inherit" }} />
          {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 15 }}>✕</button>}
        </div>

        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none" }}>
          {days.map((d, i) => (
            <Pill key={i} active={selDay === i} onClick={() => { setSelDay(i); load(selCinema, i); }}>
              {d.label} <span style={{ marginLeft: 3, opacity: 0.5, fontSize: 11 }}>{d.dateStr}</span>
            </Pill>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 20px 4px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 8, minWidth: "max-content" }}>
          {CINEMAS.map((c, i) => (
            <button key={i} onClick={() => { setSelCinema(i); load(i, selDay); }} style={{
              padding: "10px 14px", borderRadius: 16, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              border: selCinema === i ? "1.5px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
              background: selCinema === i ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)", transition: "all 0.2s",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: selCinema === i ? "#fff" : "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>{c.emoji} {c.name}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.24)", whiteSpace: "nowrap", marginTop: 1 }}>{c.address}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "12px 20px 100px" }}>
        {alertMatches > 0 && (
          <div style={{ borderRadius: 14, background: "rgba(255,214,10,0.07)", border: "1px solid rgba(255,214,10,0.2)", padding: "11px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 9 }}>
            <span>🔔</span>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
              <span style={{ fontWeight: 700, color: "#ffd60a" }}>{alertMatches}</span> película{alertMatches !== 1 ? "s" : ""} coincide con tus alertas
            </p>
          </div>
        )}

        {!nextSession ? (
          <button onClick={findNext} disabled={searchingNext} style={{
            width: "100%", borderRadius: 14, padding: "13px 16px", marginBottom: 12,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit",
          }}>
            {searchingNext
              ? <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.12)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
              : <span style={{ fontSize: 16 }}>🔎</span>}
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: searchingNext ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.65)" }}>{searchingNext ? "Buscando próxima sesión…" : "Próxima sesión VO disponible"}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>Todos los cines y días</p>
            </div>
            {!searchingNext && <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.2)", fontSize: 16 }}>›</span>}
          </button>
        ) : (
          <div style={{ borderRadius: 14, background: "rgba(52,199,89,0.08)", border: "1px solid rgba(52,199,89,0.2)", padding: "12px 16px", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#34c759" }}>✓ {nextSession.day.label} · {nextSession.cinema.name}</p>
          </div>
        )}

        {error && (
          <div style={{ borderRadius: 14, background: "rgba(255,69,58,0.08)", border: "1px solid rgba(255,69,58,0.18)", padding: "14px 16px", marginBottom: 12 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#ff453a" }}>Error al cargar</p>
            <button onClick={() => load(selCinema, selDay)} style={{ background: "rgba(255,69,58,0.12)", border: "1px solid rgba(255,69,58,0.25)", color: "#ff453a", borderRadius: 9, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Reintentar</button>
          </div>
        )}

        {!loading && !error && movies.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.32)" }}><span style={{ color: "#fff", fontWeight: 700 }}>{filtered.length}</span> en VO</p>
            <button onClick={() => { delete cacheRef.current[`${selCinema}-${selDay}`]; load(selCinema, selDay); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.28)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>↻</button>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
              <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.32)" }}>Cargando VO…</span>
            </div>
            {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeIn 0.3s ease" }}>
            {filtered.map((m, i) => (
              <MovieCard key={i} movie={m} index={i}
                cinema={CINEMAS[selCinema]} day={days[selDay]}
                onWatched={onWatched}
                isWatched={watched.some(w => w.title === m.title)}
                alerts={alerts}
                groupCode={groupCode}
                groupMember={groupMember}
                onVote={onVote}
                groupVotes={groupVotes}
              />
            ))}
          </div>
        )}

        {!loading && !error && movies.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎞️</div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Sin sesiones VO este día</p>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function CarteleraApp({ user, onLogout }) {
  const [tab, setTab] = useState("cartelera");
  const [watched, setWatched] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [groupCode, setGroupCode] = useState(null);
  const [groupMember, setGroupMember] = useState(null); // { id, name }
  const [groupData, setGroupData] = useState(null); // { members: {}, createdAt }
  const [groupVotes, setGroupVotes] = useState({}); // { movieKey: { votes: {memberId: true}, voterNames: {}, showtimes } }
  const [toasts, setToasts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const pollRef = useRef(null);
  const prevVotesRef = useRef({});

  function addToast(t) {
    const id = Date.now();
    setToasts(ts => [...ts, { ...t, id }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 4000);
  }

  // Load personal data
  useEffect(() => {
    (async () => {
      if (!user) return;
      // Load profile from Supabase
      const { data: profile } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        if (profile.watched) setWatched(profile.watched);
        if (profile.alerts) setAlerts(profile.alerts);
      } else {
        // Create profile for new user
        await supabase.from("perfiles").insert({
          id: user.id,
          nombre: user.user_metadata?.full_name || user.email,
          watched: [],
          alerts: []
        });
      }

      // Load group from localStorage (group membership is device-bound)
      const gc = localStorage.getItem("vo-groupCode");
      const gm = localStorage.getItem("vo-groupMember");
      if (gc) setGroupCode(gc);
      if (gm) setGroupMember(JSON.parse(gm));
      setLoaded(true);
    })();
  }, [user]);

  // Poll group data every 4 seconds when in a group
  useEffect(() => {
    if (!groupCode) { clearInterval(pollRef.current); return; }

    async function poll() {
      const row = await groupGet(groupCode);
      if (!row) return;
      // Check for new members
      if (groupData && Object.keys(row.members || {}).length > Object.keys(groupData.members || {}).length) {
        const newMember = Object.values(row.members).find(m => !groupData.members?.[m.id]);
        if (newMember && newMember.id !== groupMember?.id) {
          addToast({ type: "join", emoji: "👋", title: `${newMember.name} se ha unido`, body: `Ahora sois ${Object.keys(row.members).length} en el grupo` });
        }
      }
      setGroupData(row);
      const votes = row.votes || {};
      Object.entries(votes).forEach(([key, voteData]) => {
        const prev = prevVotesRef.current[key] || {};
        const prevVoteIds = Object.keys(prev.votes || {});
        const newVoteIds = Object.keys(voteData.votes || {});
        newVoteIds.forEach(vid => {
          if (!prevVoteIds.includes(vid) && vid !== groupMember?.id) {
            const voterName = voteData.voterNames?.[vid] || "Alguien";
            const [title] = key.split("||");
            addToast({ type: "vote", emoji: "🎟️", title: `${voterName} quiere ver`, body: title });
          }
        });
      });
      prevVotesRef.current = votes;
      setGroupVotes(votes);
    }
    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => clearInterval(pollRef.current);
  }, [groupCode, groupMember?.id]);

  async function createGroup(name) {
    const code = generateGroupCode();
    const memberId = generateUserId();
    const member = { id: memberId, name, joinedAt: Date.now() };
    const ok = await groupCreate(code, member);
    if (!ok) { addToast({ type: "error", emoji: "❌", title: "Error al crear grupo", body: "Comprueba tu conexión e inténtalo de nuevo" }); return; }
    setGroupCode(code); setGroupMember(member);
    setGroupData({ members: { [memberId]: member }, votes: {} });
    setGroupVotes({});
    localStorage.setItem("vo-groupCode", code);
    localStorage.setItem("vo-groupMember", JSON.stringify(member));
    addToast({ type: "join", emoji: "✨", title: "¡Grupo creado!", body: `Código: ${code} — compártelo con tus amigos` });
  }

  async function joinGroup(code, name) {
    const row = await groupGet(code.trim().toUpperCase());
    if (!row) { addToast({ type: "error", emoji: "❌", title: "Grupo no encontrado", body: `No existe ningún grupo con el código ${code.trim().toUpperCase()}` }); return; }
    const memberId = generateUserId();
    const member = { id: memberId, name, joinedAt: Date.now() };
    const updatedMembers = { ...row.members, [memberId]: member };
    await groupUpdateMembers(code.trim().toUpperCase(), updatedMembers);
    setGroupCode(code.trim().toUpperCase());
    setGroupMember(member);
    setGroupData({ ...row, members: updatedMembers });
    setGroupVotes(row.votes || {});
    localStorage.setItem("vo-groupCode", code.trim().toUpperCase());
    localStorage.setItem("vo-groupMember", JSON.stringify(member));
    addToast({ type: "join", emoji: "🎉", title: `¡Unido al grupo ${code.trim().toUpperCase()}!`, body: `Hola ${name}, ya puedes votar películas` });
  }

  async function leaveGroup() {
    if (groupCode && groupMember && groupData) {
      const row = await groupGet(groupCode);
      if (row) {
        const updatedMembers = { ...row.members };
        delete updatedMembers[groupMember.id];
        await groupUpdateMembers(groupCode, updatedMembers);
      }
    }
    setGroupCode(null); setGroupMember(null); setGroupData(null); setGroupVotes({});
    localStorage.removeItem("vo-groupCode"); localStorage.removeItem("vo-groupMember");
  }

  async function handleVote(movie, cinema, day, voting) {
    if (!groupCode || !groupMember) return;
    const key = `${movie.title}||${cinema.id}||${day.label}`;
    const row = await groupGet(groupCode);
    const votes = row?.votes || {};
    if (!votes[key]) votes[key] = { votes: {}, voterNames: {}, showtimes: movie.showtimes, title: movie.title };
    if (voting) {
      votes[key].votes[groupMember.id] = true;
      votes[key].voterNames[groupMember.id] = groupMember.name;
    } else {
      delete votes[key].votes[groupMember.id];
      delete votes[key].voterNames[groupMember.id];
    }
    await groupUpdateVotes(groupCode, votes);
    setGroupVotes({ ...votes });
    prevVotesRef.current = votes;
    if (voting) addToast({ type: "vote", emoji: "🎟️", title: "Voto registrado", body: `El grupo verá tu intención para "${movie.title}"` });
  }

  function toggleWatched(movie) {
    setWatched(prev => {
      const exists = prev.some(m => m.title === movie.title);
      const next = exists ? prev.filter(m => m.title !== movie.title) : [...prev, movie];
      supabase.from("perfiles").update({ watched: next }).eq("id", user.id);
      return next;
    });
  }

  function addAlert(alert) {
    setAlerts(prev => {
      if (prev.some(a => a.type === alert.type && a.value === alert.value)) return prev;
      const next = [...prev, alert];
      supabase.from("perfiles").update({ alerts: next }).eq("id", user.id);
      return next;
    });
  }

  function removeAlert(id) {
    setAlerts(prev => { const next = prev.filter(a => a.id !== id); supabase.from("perfiles").update({ alerts: next }).eq("id", user.id); return next; });
  }

  const groupVoteCount = Object.values(groupVotes).filter(v => Object.keys(v.votes || {}).length > 0).length;

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 24, height: 24, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", fontFamily: "'SF Pro Display',-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif", color: "#fff", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{display:none} *{box-sizing:border-box}
        input::placeholder{color:rgba(255,255,255,0.26)} input:focus{outline:none}
      `}</style>

      {/* User bar */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 90,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'linear-gradient(to bottom, rgba(9,9,11,0.95), transparent)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user?.user_metadata?.avatar_url && (
            <img src={user.user_metadata.avatar_url} alt=""
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)' }} />
          )}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
            {user?.user_metadata?.full_name?.split(' ')[0] || 'Cinéfilo'}
          </span>
        </div>
        <button onClick={onLogout} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
          fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'inherit',
          transition: 'all 0.2s',
        }}>Salir</button>
      </div>
      <Toast toasts={toasts} />

      {/* Tab content */}
      <div style={{ paddingBottom: 80 }}>
        {tab === "cartelera" && (
          <CartelleraTab alerts={alerts} watched={watched} onWatched={toggleWatched}
            groupCode={groupCode} groupMember={groupMember} groupVotes={groupVotes} onVote={handleVote} />
        )}
        {tab === "grupo" && (
          <div>
            <div style={{ padding: "20px 20px 16px", position: "sticky", top: 0, background: "rgba(9,9,11,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 50 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em" }}>Mi Grupo</h1>
              {groupCode && <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Sincronización en tiempo real · cada 4s</p>}
            </div>
            <GroupTab groupCode={groupCode} groupMember={groupMember} onCreateGroup={createGroup}
              onJoinGroup={joinGroup} onLeaveGroup={leaveGroup} groupData={groupData} groupVotes={groupVotes}
              onSwitchToCartelera={() => setTab("cartelera")} />
          </div>
        )}
        {tab === "perfil" && (
          <div>
            <div style={{ padding: "20px 20px 16px", position: "sticky", top: 0, background: "rgba(9,9,11,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 50 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em" }}>Mi Perfil</h1>
            </div>
            <ProfileTab watched={watched} />
          </div>
        )}
        {tab === "alertas" && (
          <div>
            <div style={{ padding: "20px 20px 16px", position: "sticky", top: 0, background: "rgba(9,9,11,0.9)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 50 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em" }}>Alertas</h1>
            </div>
            <AlertsTab alerts={alerts} onAdd={addAlert} onRemove={removeAlert} />
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(9,9,11,0.94)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "10px 0 22px",
      }}>
        {TABS.map(t => {
          const badge = t.id === "grupo" && groupVoteCount > 0 ? groupVoteCount : t.id === "alertas" && alerts.length > 0 ? alerts.length : 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: "none", border: "none", cursor: "pointer", padding: "4px 16px",
              fontFamily: "inherit", position: "relative",
            }}>
              <span style={{ fontSize: 22, filter: tab === t.id ? "none" : "grayscale(1) opacity(0.45)" }}>{t.icon}</span>
              <span style={{ fontSize: 10, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? "#fff" : "rgba(255,255,255,0.3)", transition: "all 0.2s" }}>{t.label}</span>
              {badge > 0 && (
                <div style={{ position: "absolute", top: 2, right: 10, minWidth: 16, height: 16, borderRadius: 8, background: t.id === "grupo" ? "#ffd60a" : "#ff453a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#000", padding: "0 4px" }}>{badge}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
