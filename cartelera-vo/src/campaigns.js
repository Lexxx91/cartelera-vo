// ─── Campaign System ────────────────────────────────────────────────────────
// Centralized campaign definitions + resolution logic.
// Used by BrickBreaker, SnakeGame, AdminPanel, and CartelleraTab.

// ─── Campaign data (game configs + assets) ──────────────────────────────────
export const CAMPAIGNS = [
  {
    id: 'gofio-lapina',
    gameType: 'breakout',
    startDate: '2026-03-09',
    endDate: '2026-04-10',
    brickImage: '/brands/gofio-lapina.png',
    multiHitImage: '/brands/gofio-lapina-fuerte.png',
    brickCols: 9,
    imageCrop: { sx: 160, sy: 10, sw: 680, sh: 980 },
    dustColors: ['#d4a748', '#c9953a', '#e8c87a', '#b8862d', '#f0d88f'],
    ball: {
      type: 'stone',
      colors: { center: '#a89880', mid: '#8c7a68', edge: '#6b5d50', rim: '#4a3f35' },
      trail: 'rgba(140,130,115,0.2)',
    },
  },
  {
    id: 'clipper',
    gameType: 'breakout',
    startDate: '2026-04-11',
    endDate: '2026-05-10',
    brickImage: '/brands/clipper-naranja.png',
    multiHitImage: '/brands/clipper-fresa.png',
    brickCols: 9,
    imageCrop: { sx: 270, sy: 0, sw: 660, sh: 1200 },
    dustColors: ['#ff8c00', '#ff6b35', '#ffa559', '#e85d26', '#ffb380'],
    ball: {
      type: 'stone',
      colors: { center: '#ffb347', mid: '#ff8c00', edge: '#e67300', rim: '#cc5500' },
      trail: 'rgba(255,140,0,0.2)',
    },
  },
  {
    id: 'chorizo-teror',
    gameType: 'snake',
    startDate: '2026-05-11',
    endDate: '2026-06-10',
  },
]

// ─── Campaign catalog (UI metadata for AdminPanel) ──────────────────────────
export const CAMPAIGN_CATALOG = [
  {
    id: 'gofio-lapina',
    name: 'Gofio La Piña',
    brand: 'La Piña',
    emoji: '🌾',
    color: '#d4a748',
    preview: '/brands/gofio-lapina.png',
    gameType: 'breakout',
  },
  {
    id: 'clipper',
    name: 'Clipper',
    brand: 'Clipper',
    emoji: '🥤',
    color: '#ff8c00',
    preview: '/brands/clipper-naranja.png',
    gameType: 'breakout',
  },
  {
    id: 'chorizo-teror',
    name: 'Chorizo de Teror',
    brand: 'Teror',
    emoji: '🌭',
    color: '#8B2500',
    preview: null,
    gameType: 'snake',
  },
]

// ─── Active campaign resolution ─────────────────────────────────────────────
export function getActiveCampaign(overrides = []) {
  const today = new Date().toISOString().slice(0, 10)
  return CAMPAIGNS.find(c => {
    const ov = overrides.find(o => o.id === c.id)
    if (ov && ov.active === false) return false
    if (ov && ov.active === true && !ov.start_date && !ov.end_date) return true
    const start = ov?.start_date || c.startDate
    const end = ov?.end_date || c.endDate
    return today >= start && today <= end
  }) || null
}
