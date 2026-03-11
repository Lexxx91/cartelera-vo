import { useState } from 'react'

function PodiumPlace({ entry, rank, isUser }) {
  const heights = { 1: 80, 2: 60, 3: 48 }
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" }
  const borderColors = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" }
  // Stagger order per spec: 2nd → 1st → 3rd
  const staggerDelay = { 1: 100, 2: 0, 3: 200 }
  const name = entry?.nombre || entry?.nombre_display || "—"

  return (
    <div style={{
      display:"flex",flexDirection:"column",alignItems:"center",gap:6,
      flex:1,
      animation: rank === 1
        ? `podiumHero 0.6s cubic-bezier(0.34,1.56,0.64,1) ${staggerDelay[rank]}ms both`
        : `podiumFade 0.5s ease ${staggerDelay[rank]}ms both`,
    }}>
      <span style={{fontSize: rank === 1 ? 28 : 22, animation: rank === 1 ? "medalBounce 0.4s ease 0.4s both" : undefined}}>{medals[rank]}</span>
      <div style={{
        width: rank === 1 ? 52 : 44, height: rank === 1 ? 52 : 44,
        borderRadius:"50%",overflow:"hidden",
        background:"linear-gradient(135deg,#1a1a1a,#111)",
        display:"flex",alignItems:"center",justifyContent:"center",
        border: `2px solid ${borderColors[rank]}`,
        boxShadow: rank === 1
          ? "0 0 16px rgba(255,215,0,0.3)"
          : isUser ? "0 0 12px rgba(255,59,59,0.4)" : "none",
        animation: rank === 1 ? "goldGlow 2s ease-in-out infinite" : undefined,
      }}>
        {entry?.avatar_url
          ? <img src={entry.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
          : <span style={{fontSize: rank === 1 ? 18 : 15,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{name.charAt(0)}</span>
        }
      </div>
      <p style={{margin:0,fontSize:11,fontWeight:600,color: isUser ? "#ff3b3b" : "#fff",textAlign:"center",maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
        {isUser ? "Tú" : name.split(" ")[0]}
      </p>
      <p style={{margin:0,fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:700}}>
        {entry?.score?.toLocaleString() || "0"}
      </p>
      <div style={{
        width:"100%",height: heights[rank],borderRadius:"8px 8px 0 0",
        background: `linear-gradient(180deg, ${borderColors[rank]}22, ${borderColors[rank]}08)`,
        border: `1px solid ${borderColors[rank]}33`,
        borderBottom:"none",
        animation: `barGrow 0.5s ease ${staggerDelay[rank] + 200}ms both`,
        transformOrigin:"bottom",
      }} />
    </div>
  )
}

export default function RankingBlock({ leaderboard, userId, friends, campaign }) {
  const [showSquad, setShowSquad] = useState(false)

  if (!leaderboard || leaderboard.length === 0) return null

  const top3 = leaderboard.slice(0, 3)
  const rest = leaderboard.slice(3)
  const friendIds = new Set((friends || []).map(f => f.id))
  const userRank = leaderboard.findIndex(e => e.user_id === userId)

  // Squad members in the ranking
  const squadInRanking = leaderboard
    .map((e, i) => ({...e, rank: i + 1}))
    .filter(e => e.user_id === userId || friendIds.has(e.user_id))

  const isCampaign = !!campaign

  return (
    <div style={{
      margin:"0 20px 16px",borderRadius:20,overflow:"hidden",
      background: isCampaign
        ? "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(0,0,0,0.4) 100%)"
        : "rgba(255,255,255,0.02)",
      border: isCampaign
        ? "1px solid rgba(201,168,76,0.2)"
        : "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Header */}
      <div style={{padding:"16px 18px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>{isCampaign ? "🔥" : "🏆"}</span>
          <span style={{
            fontFamily:"'Archivo Black',sans-serif",fontSize:13,fontWeight:400,
            color: isCampaign ? "#c9a84c" : "#fff",textTransform:"uppercase",letterSpacing:"0.06em",
          }}>
            {isCampaign ? `Ranking — ${campaign.name}` : "Ranking Bricks"}
          </span>
        </div>
        {isCampaign && campaign.days_left != null && (
          <p style={{margin:"4px 0 0",fontSize:11,color:"rgba(201,168,76,0.5)"}}>
            Termina en {campaign.days_left} {campaign.days_left === 1 ? "día" : "días"}
          </p>
        )}
      </div>

      {/* Podium — order: 2nd, 1st, 3rd */}
      {top3.length >= 3 && (
        <div style={{display:"flex",alignItems:"flex-end",padding:"0 18px 0",gap:8}}>
          <PodiumPlace entry={top3[1]} rank={2} isUser={top3[1]?.user_id === userId} />
          <PodiumPlace entry={top3[0]} rank={1} isUser={top3[0]?.user_id === userId} />
          <PodiumPlace entry={top3[2]} rank={3} isUser={top3[2]?.user_id === userId} />
        </div>
      )}

      {/* Rest of ranking */}
      {rest.length > 0 && (
        <div style={{padding:"12px 18px 4px"}}>
          <p style={{margin:"0 0 8px",fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.2)",textTransform:"uppercase",letterSpacing:"0.06em"}}>
            Ranking completo
          </p>
          <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
            {rest.map((entry, i) => {
              const rank = i + 4
              const isMe = entry.user_id === userId
              const isFriend = friendIds.has(entry.user_id)
              const eName = entry.nombre || entry.nombre_display || "Usuario"
              return (
                <div key={entry.user_id} style={{
                  display:"flex",alignItems:"center",gap:10,padding:"6px 8px",borderRadius:10,
                  background: isMe ? "rgba(255,59,59,0.08)" : isFriend ? "rgba(255,255,255,0.03)" : "transparent",
                }}>
                  <span style={{width:24,fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.25)",textAlign:"right"}}>
                    {rank}
                  </span>
                  <div style={{
                    width:28,height:28,borderRadius:"50%",overflow:"hidden",flexShrink:0,
                    background:"linear-gradient(135deg,#1a1a1a,#111)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    border: isMe ? "1px solid rgba(255,59,59,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  }}>
                    {entry.avatar_url
                      ? <img src={entry.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      : <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>{eName.charAt(0)}</span>
                    }
                  </div>
                  <span style={{flex:1,fontSize:12,fontWeight:isMe?700:500,color: isMe ? "#ff3b3b" : "#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {isMe ? "Tú" : eName.split(" ")[0]}
                    {isMe && " ★"}
                  </span>
                  <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.3)"}}>
                    {entry.score?.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Squad in ranking — collapsible */}
      {squadInRanking.length > 1 && (
        <div style={{padding:"8px 18px 16px"}}>
          <button onClick={() => setShowSquad(!showSquad)} style={{
            display:"flex",alignItems:"center",gap:6,width:"100%",
            padding:"8px 0",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",
            WebkitTapHighlightColor:"transparent",
          }}>
            <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.2)",textTransform:"uppercase",letterSpacing:"0.06em"}}>
              Tu squad en el ranking
            </span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{transform:showSquad?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
              <path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {showSquad && (
            <div style={{display:"flex",flexDirection:"column",gap:4,animation:"fadeIn 0.3s ease"}}>
              {squadInRanking.map(entry => {
                const isMe = entry.user_id === userId
                const eName = entry.nombre || entry.nombre_display || "Usuario"
                return (
                  <div key={entry.user_id} style={{display:"flex",alignItems:"center",gap:10,padding:"4px 8px"}}>
                    <span style={{width:28,fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.25)"}}>
                      #{entry.rank}
                    </span>
                    <div style={{
                      width:24,height:24,borderRadius:"50%",overflow:"hidden",flexShrink:0,
                      background:"linear-gradient(135deg,#1a1a1a,#111)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                    }}>
                      {entry.avatar_url
                        ? <img src={entry.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                        : <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>{eName.charAt(0)}</span>
                      }
                    </div>
                    <span style={{flex:1,fontSize:12,fontWeight:isMe?700:500,color: isMe ? "#ff3b3b" : "#fff"}}>
                      {isMe ? "Tú" : eName.split(" ")[0]}
                    </span>
                    <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.3)"}}>
                      {entry.score?.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes podiumFade {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes podiumHero {
          0% { opacity: 0; transform: translateY(20px) scale(0.9); }
          70% { opacity: 1; transform: translateY(-4px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes goldGlow {
          0%, 100% { box-shadow: 0 0 12px rgba(255,215,0,0.2); }
          50% { box-shadow: 0 0 20px rgba(255,215,0,0.45); }
        }
        @keyframes medalBounce {
          0% { transform: scale(0.5) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes barGrow {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
