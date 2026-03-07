// cartelera-scraper/scraper.js
// Scrapes Sensacine for VO/VOSE showtimes in Las Palmas
// Fetches the next 14 days and upserts into Supabase

const SUPABASE_URL = "https://iikxvjegaqspaweysgfg.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const CINEMAS = [
  { id: "ocine",   name: "OCine 7 Palmas Premium",  url: "https://www.sensacine.com/cines/cine/G01MW/" },
  { id: "alisios", name: "Yelmo Premium Alisios",    url: "https://www.sensacine.com/cines/cine/E0972/" },
  { id: "arenas",  name: "Yelmo Cine Las Arenas",    url: "https://www.sensacine.com/cines/cine/E0754/" },
];

function getNextDays(n) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseMoviesForDate(html, cinemaId, date) {
  const movies = [];
  const parts = html.split(/<div[^>]+class="[^"]*movie-card-theater[^"]*"/);

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];

    const titleMatch = block.match(/class="meta-title[^"]*"[^>]*>\s*<a[^>]*>\s*([^<]+?)\s*<\/a>/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    const hasVOSE = /Versión Original|V\.O\.S\.E\.|En V\.O\b/i.test(block);
    if (!hasVOSE) continue;

    const origMatch = block.match(/Título original[^<]*<[^>]+>\s*([^<]+)/);
    const originalTitle = origMatch ? origMatch[1].trim() : title;

    const genreMatch = block.match(/class="[^"]*genre[^"]*"[^>]*>\s*([^<]+)/);
    const genre = genreMatch ? genreMatch[1].trim() : "";

    const durMatch = block.match(/(\d+)h\s*(\d+)/);
    const duration = durMatch ? `${parseInt(durMatch[1])*60 + parseInt(durMatch[2])} min` : "";

    const ratingMatch = block.match(/class="[^"]*stareval-note[^"]*"[^>]*>\s*([\d,]+)/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(",", ".")) : null;

    const posterMatch = block.match(/src="(https:\/\/[^"]+(?:acsta|sensacine)[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/);
    const poster = posterMatch ? posterMatch[1] : null;

    const voseTimes = [];
    const voTimes = [];

    const versionSections = block.split(/class="showtimes-version[^"]*"/);
    for (const section of versionSections.slice(1)) {
      const isVOSE = /Versión Original Subtitulada|V\.O\.S\.E\.|VOSE/i.test(section);
      const isVO = /Versión Original(?! Sub)|En V\.O\b(?!\.S)/i.test(section);
      if (!isVOSE && !isVO) continue;
      const times = [...section.matchAll(/(\d{1,2}:\d{2})(?=\D)/g)].map(m => m[1]).slice(0,10);
      if (isVOSE) voseTimes.push(...times);
      else voTimes.push(...times);
    }

    // Fallback: all times from block
    if (voseTimes.length === 0 && voTimes.length === 0) {
      const allT = [...block.matchAll(/(\d{1,2}:\d{2})(?=[^0-9])/g)].map(m => m[1]).slice(0,10);
      voseTimes.push(...allT);
    }

    let version = "VOSE";
    if (voTimes.length > 0 && voseTimes.length === 0) version = "VO";
    if (voTimes.length > 0 && voseTimes.length > 0) version = "VO/VOSE";

    const allTimes = [...new Set([...voseTimes, ...voTimes])].sort();

    movies.push({
      cinema_id: cinemaId, date, title, original_title: originalTitle,
      genre, duration, rating_media: rating, poster, version,
      showtimes: allTimes, updated_at: new Date().toISOString(),
    });

    console.log(`  ✓ ${title} (${version}) [${allTimes.join(", ")}]`);
  }
  return movies;
}

async function saveToSupabase(movies) {
  if (!SUPABASE_KEY) { console.error("❌ SUPABASE_KEY not set"); process.exit(1); }
  if (movies.length === 0) { console.log("  Nothing to save"); return; }

  for (let i = 0; i < movies.length; i += 50) {
    const batch = movies.slice(i, i + 50);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cartelera`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "resolution=merge-duplicates,return=minimal",
        "on-conflict": "cinema_id,date,title",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) console.error(`  Supabase error: ${await res.text()}`);
    else console.log(`  💾 Saved ${batch.length} records`);
  }
}

async function main() {
  console.log(`\n🎬 Cartelera VO Scraper — ${new Date().toLocaleDateString("es-ES")}\n`);
  const days = getNextDays(14);
  console.log(`📅 Scraping ${days.length} days: ${days[0]} → ${days[days.length-1]}\n`);

  const allMovies = [];

  for (const cinema of CINEMAS) {
    console.log(`\n📍 ${cinema.name}`);
    for (const date of days) {
      try {
        const html = await fetchPage(`${cinema.url}?shwt_date=${date}`);
        if (!html.includes('movie-card-theater')) {
          process.stdout.write('.');
          await new Promise(r => setTimeout(r, 600));
          continue;
        }
        const movies = parseMoviesForDate(html, cinema.id, date);
        if (movies.length > 0) {
          allMovies.push(...movies);
          console.log(`\n  📅 ${date}: ${movies.length} movies`);
        } else {
          process.stdout.write('.');
        }
      } catch(e) {
        console.error(`\n  ❌ ${date}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 700));
    }
    console.log('\n');
  }

  console.log(`\n💾 Total: ${allMovies.length} VO/VOSE records`);
  await saveToSupabase(allMovies);
  console.log("\n✅ Done!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
Cartelera de cines en tiempo real Las Palmas - Claude
