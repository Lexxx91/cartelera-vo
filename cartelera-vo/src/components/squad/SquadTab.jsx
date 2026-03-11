import { useState, useEffect, useRef, useMemo } from 'react'
import FriendDetailSheet from '../amigos/FriendDetailSheet.jsx'
import FriendRequestSheet from '../amigos/FriendRequestSheet.jsx'
import InviteBlock from './InviteBlock.jsx'
import FriendRow from './FriendRow.jsx'
import RankingBlock from './RankingBlock.jsx'
import { useLeaderboard } from '../../hooks/useLeaderboard.js'
import { isPlanPast } from '../../utils.js'

// ─── Compatibility: how aligned are our movie tastes? ─────────────────────────
function calculateCompatibility(friendId, myVotes, friendVotes) {
  if (!myVotes || !friendVotes || !friendId) return null
  let common = 0, agreements = 0
  for (const movie of Object.keys(myVotes)) {
    const voters = friendVotes[movie] || []
    const friendVotedVoy = voters.some(v => v.userId === friendId)
    if (friendVotedVoy) {
      common++
      if (myVotes[movie] === 'voy') agreements++
    }
  }
  if (common < 3) return null
  return Math.round((agreements / common) * 100)
}

// ─── Cinema together: count confirmed past plans with this friend ─────────────
function getCinemaTogether(friendId, plans) {
  if (!plans || !friendId) return 0
  return plans.filter(p =>
    p.state === 'confirmed' &&
    p.chosen_session &&
    isPlanPast(p.chosen_session) &&
    (p.participants || []).includes(friendId)
  ).length
}

export default function SquadTab({
  user, profile, friends, pendingIn, pendingOut,
  onAcceptFriend, onRemoveFriend,
  isDemoMode, movies,
  onGetFriendsOfFriend, onSendDirectRequest,
  friendVotes, myVotesForCommon, getDemoMoviesInCommon,
  onDiscoverUsers,
  onConnectWhatsApp, onUnlinkWhatsApp, waLinking, waLinkError, onRetryWhatsApp, whatsappLinked,
  plans, activeCampaign, onEnterCode,
}) {
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [discoverPeople, setDiscoverPeople] = useState([])
  const [discoverSentTo, setDiscoverSentTo] = useState(new Set())
  const [discoverSending, setDiscoverSending] = useState(null)
  const [discoverSearch, setDiscoverSearch] = useState('')
  const [showRequestSheet, setShowRequestSheet] = useState(false)
  const [subTab, setSubTab] = useState("amigos")
  const sheetShownForRef = useRef(new Set())

  const gameType = activeCampaign?.game_type || 'breakout'
  const campaignId = activeCampaign?.id || null
  const { leaderboard } = useLeaderboard(gameType, campaignId)

  // Auto-show friend request sheet on new requests
  useEffect(() => {
    if (pendingIn.length > 0) {
      const hasNew = pendingIn.some(r => !sheetShownForRef.current.has(r.friendshipId))
      if (hasNew) {
        setShowRequestSheet(true)
        pendingIn.forEach(r => sheetShownForRef.current.add(r.friendshipId))
      }
    }
  }, [pendingIn])

  // Load discoverable users
  useEffect(() => {
    if (onDiscoverUsers) {
      onDiscoverUsers().then(result => {
        if (Array.isArray(result)) setDiscoverPeople(result)
        else setDiscoverPeople(result?.data || [])
      })
    }
  }, [friends.length])

  // Pre-compute cinema-together counts for all friends
  const cinemaCounts = useMemo(() => {
    const counts = {}
    for (const f of friends) {
      counts[f.id] = getCinemaTogether(f.id, plans)
    }
    return counts
  }, [friends, plans])

  // Pre-compute compatibility for all friends
  const compatScores = useMemo(() => {
    const scores = {}
    for (const f of friends) {
      scores[f.id] = calculateCompatibility(f.id, myVotesForCommon, friendVotes)
    }
    return scores
  }, [friends, myVotesForCommon, friendVotes])

  // Sort friends: most cinema together first, then by compatibility
  const sortedFriends = useMemo(() => {
    return [...friends].sort((a, b) => {
      const cineDiff = (cinemaCounts[b.id] || 0) - (cinemaCounts[a.id] || 0)
      if (cineDiff !== 0) return cineDiff
      const compatDiff = (compatScores[b.id] ?? -1) - (compatScores[a.id] ?? -1)
      return compatDiff
    })
  }, [friends, cinemaCounts, compatScores])

  const pendingTotal = pendingIn.length + pendingOut.length

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {selectedFriend && (
        <FriendDetailSheet
          friend={selectedFriend}
          onGetFriendsOfFriend={onGetFriendsOfFriend}
          onSendDirectRequest={onSendDirectRequest}
          onRemoveFriend={onRemoveFriend}
          onClose={() => setSelectedFriend(null)}
          movies={movies}
          myVotes={myVotesForCommon}
          friendVotes={friendVotes}
          isDemoMode={isDemoMode}
          getDemoMoviesInCommon={getDemoMoviesInCommon}
        />
      )}

      {showRequestSheet && pendingIn.length > 0 && (
        <FriendRequestSheet
          requests={pendingIn}
          onAccept={onAcceptFriend}
          onReject={onRemoveFriend}
          onClose={() => setShowRequestSheet(false)}
        />
      )}

      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"0 0 100px",minHeight:0}}>

        {/* Header */}
        <div style={{padding:"18px 20px 14px",flexShrink:0}}>
          <h1 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:22,color:"#fff",letterSpacing:"0.02em",textTransform:"uppercase"}}>Squad</h1>
        </div>

        {/* Invite block */}
        <InviteBlock
          inviteCode={profile?.invite_code}
          hasFriends={friends.length > 0}
          onEnterCode={onEnterCode}
        />

        {/* Ranking — only show if there's data */}
        {leaderboard.length > 0 && (
          <RankingBlock
            leaderboard={leaderboard}
            userId={user?.id}
            friends={friends}
            campaign={activeCampaign ? {
              name: activeCampaign.name || activeCampaign.title,
              days_left: activeCampaign.end_date
                ? Math.max(0, Math.ceil((new Date(activeCampaign.end_date) - Date.now()) / 86400000))
                : null,
            } : null}
          />
        )}

        {/* Sub-tab bar */}
        <div style={{
          display:"flex",gap:0,
          borderTop:"1px solid rgba(255,255,255,0.06)",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
          background:"#000",
          position:"sticky",top:0,zIndex:10,
        }}>
          {[
            { id: "amigos", label: "Amigos", count: friends.length },
            { id: "personas", label: "Personas en VOSE" },
            { id: "pendientes", label: "Pendientes", count: pendingTotal },
          ].map(tab => (
            <button key={tab.id} onClick={() => setSubTab(tab.id)} style={{
              flex:1,padding:"12px 0",background:"none",border:"none",
              borderBottom:subTab===tab.id?"2px solid #ff3b3b":"2px solid transparent",
              color:subTab===tab.id?"#fff":"rgba(255,255,255,0.35)",
              fontSize:11,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",
              textTransform:"uppercase",letterSpacing:"0.04em",
              cursor:"pointer",transition:"all 0.2s",position:"relative",
              WebkitTapHighlightColor:"transparent",
            }}>
              {tab.label}
              {tab.id === "pendientes" && pendingIn.length > 0 && (
                <span style={{position:"absolute",top:6,right:"15%",width:16,height:16,borderRadius:"50%",background:"#ff3b3b",color:"#fff",fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {pendingIn.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sub-tab: Amigos */}
        {subTab === "amigos" && (
          <div style={{padding:"16px 20px"}}>
            {friends.length === 0 ? (
              <div style={{textAlign:"center",padding:"32px 24px 20px",animation:"fadeIn 0.6s ease"}}>
                <p style={{fontSize:32,margin:"0 0 10px"}}>🤷</p>
                <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>
                  Comparte tu código para añadir amigos.
                </p>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {sortedFriends.map(f => (
                  <FriendRow
                    key={f.id}
                    friend={f}
                    cinemaTogether={cinemaCounts[f.id] || 0}
                    compatibility={compatScores[f.id]}
                    onClick={() => setSelectedFriend(f)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sub-tab: Personas en VOSE */}
        {subTab === "personas" && (
          <div style={{padding:"16px 20px"}}>
            <div style={{position:"relative",marginBottom:12}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
                <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                <path d="M16 16l4.5 4.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input value={discoverSearch} onChange={e => setDiscoverSearch(e.target.value)} placeholder="Buscar personas..."
                style={{width:"100%",padding:"10px 12px 10px 34px",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:13,fontWeight:500,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}} />
            </div>
            {discoverPeople.length === 0 ? (
              <div style={{textAlign:"center",padding:"32px 16px"}}>
                <p style={{fontSize:32,margin:"0 0 10px"}}>🔍</p>
                <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>No hay personas nuevas por descubrir ahora mismo.</p>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {discoverPeople
                  .filter(u => {
                    if (!discoverSearch.trim()) return true
                    const q = discoverSearch.toLowerCase()
                    return (u.nombre_display || u.nombre || "").toLowerCase().includes(q)
                  })
                  .sort((a, b) => (discoverSentTo.has(a.id)?1:0) - (discoverSentTo.has(b.id)?1:0))
                  .map(person => {
                    const personName = person.nombre_display || person.nombre || "Usuario"
                    const alreadySent = discoverSentTo.has(person.id)
                    const isSending = discoverSending === person.id
                    return (
                      <div key={person.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"10px 14px"}}>
                        <div style={{width:40,height:40,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"2px solid rgba(255,255,255,0.1)"}}>
                          {person.avatar_url ? <img src={person.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,0.7)"}}>{personName.charAt(0)}</span>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{margin:0,fontSize:14,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{personName}</p>
                          {person.invited_by_name && <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.25)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Invitado de {person.invited_by_name}</p>}
                        </div>
                        {alreadySent ? (
                          <span style={{fontSize:11,fontWeight:700,color:"#ff3b3b",padding:"6px 12px",background:"rgba(255,59,59,0.1)",borderRadius:10}}>Enviada</span>
                        ) : (
                          <button onClick={async () => {
                            setDiscoverSending(person.id)
                            const result = await onSendDirectRequest(person.id)
                            setDiscoverSending(null)
                            if (result?.success) setDiscoverSentTo(prev => new Set([...prev, person.id]))
                          }} disabled={isSending}
                            style={{padding:"6px 14px",borderRadius:10,background:"rgba(255,59,59,0.12)",border:"1px solid rgba(255,59,59,0.25)",color:"#ff3b3b",fontSize:12,fontWeight:700,cursor:isSending?"not-allowed":"pointer",fontFamily:"inherit",opacity:isSending?0.5:1}}>
                            {isSending ? "..." : "Agregar"}
                          </button>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* Sub-tab: Pendientes */}
        {subTab === "pendientes" && (
          <div style={{padding:"16px 20px"}}>
            {pendingTotal === 0 ? (
              <div style={{textAlign:"center",padding:"32px 16px"}}>
                <p style={{fontSize:32,margin:"0 0 10px"}}>✨</p>
                <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.4)",lineHeight:1.5}}>No hay solicitudes pendientes.</p>
              </div>
            ) : (
              <>
                {pendingIn.length > 0 && (
                  <div style={{marginBottom:20}}>
                    <p style={{margin:"0 0 10px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(52,199,89,0.8)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Recibidas</p>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {pendingIn.map(req => {
                        const name = req.nombre_display || req.nombre || "Usuario"
                        return (
                          <div key={req.friendshipId} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(52,199,89,0.06)",border:"1px solid rgba(52,199,89,0.15)",borderRadius:14,padding:"10px 14px",animation:"fadeIn 0.3s ease"}}>
                            <div style={{width:40,height:40,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {req.avatar_url ? <img src={req.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:15,fontWeight:700,color:"#fff"}}>{name.charAt(0)}</span>}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{margin:0,fontSize:14,fontWeight:600,color:"#fff"}}>{name}</p>
                              <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.3)"}}>Quiere ser tu amigo</p>
                            </div>
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={() => onAcceptFriend(req.friendshipId)} style={{padding:"7px 14px",borderRadius:10,background:"rgba(52,199,89,0.15)",border:"1px solid rgba(52,199,89,0.3)",color:"#34c759",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Aceptar</button>
                              <button onClick={() => onRemoveFriend(req.friendshipId)} style={{padding:"7px 10px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {pendingOut.length > 0 && (
                  <div>
                    <p style={{margin:"0 0 10px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Enviadas</p>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {pendingOut.map(req => {
                        const name = req.nombre_display || req.nombre || "Usuario"
                        return (
                          <div key={req.friendshipId} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"10px 14px"}}>
                            <div style={{width:36,height:36,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {req.avatar_url ? <img src={req.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{name.charAt(0)}</span>}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{margin:0,fontSize:14,fontWeight:600,color:"rgba(255,255,255,0.6)"}}>{name}</p>
                            </div>
                            <span style={{fontSize:11,color:"rgba(255,255,255,0.25)",padding:"4px 10px",background:"rgba(255,255,255,0.04)",borderRadius:8}}>pendiente</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
