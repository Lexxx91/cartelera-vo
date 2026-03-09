import { useState, useEffect } from 'react'

export default function FriendDetailSheet({
  friend, onGetFriendsOfFriend, onSendDirectRequest,
  onRemoveFriend, onClose, movies, myVotes, friendVotes,
  isDemoMode, getDemoMoviesInCommon,
}) {
  const [friendsOfFriend, setFriendsOfFriend] = useState([])
  const [moviesInCommon, setMoviesInCommon] = useState([])
  const [loadingFof, setLoadingFof] = useState(true)
  const [sendingTo, setSendingTo] = useState(null)
  const [sentTo, setSentTo] = useState(new Set())
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const friendName = friend.nombre_display || friend.nombre || "Amigo"
  const getPoster = (title) => (movies || []).find(m => m.title === title)?.poster

  // Load friends-of-friend on mount
  useEffect(() => {
    ;(async () => {
      setLoadingFof(true)
      const fof = await onGetFriendsOfFriend(friend.id)
      setFriendsOfFriend(fof || [])
      setLoadingFof(false)
    })()
  }, [friend.id])

  // Compute movies in common
  useEffect(() => {
    if (isDemoMode && getDemoMoviesInCommon) {
      setMoviesInCommon(getDemoMoviesInCommon(friend.id, myVotes || {}))
    } else if (!isDemoMode && friendVotes) {
      // Real mode: movies where I voted "voy" AND this friend also voted "voy"
      const common = []
      ;(movies || []).forEach(m => {
        const myVote = (myVotes || {})[m.title]
        const voters = friendVotes[m.title] || []
        const friendVoted = voters.some(v => v.userId === friend.id)
        if (myVote === 'voy' && friendVoted) {
          common.push(m)
        }
      })
      setMoviesInCommon(common)
    }
  }, [friend.id, myVotes, friendVotes, movies, isDemoMode])

  async function handleAddFriend(targetId) {
    setSendingTo(targetId)
    const result = await onSendDirectRequest(targetId)
    setSendingTo(null)
    if (result?.success) {
      setSentTo(prev => new Set([...prev, targetId]))
    }
  }

  function handleRemove() {
    onRemoveFriend(friend.friendshipId)
    onClose()
  }

  // Format "Amigos desde" date
  const sinceDate = friend.created_at
    ? new Date(friend.created_at).toLocaleDateString("es-ES", { month: "short", year: "numeric" })
    : null

  return (
    <div style={{position:"absolute",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.72)"}} />
      <div style={{position:"relative",background:"#111",borderRadius:"24px 24px 0 0",border:"1px solid rgba(255,255,255,0.08)",padding:"0 20px 44px",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"12px auto 20px"}} />

        {/* Friend profile header */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:72,height:72,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",border:"3px solid rgba(255,255,255,0.12)"}}>
            {friend.avatar_url ? (
              <img src={friend.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
            ) : (
              <span style={{fontSize:26,fontWeight:700,color:"#fff"}}>{friendName.charAt(0)}</span>
            )}
          </div>
          <p style={{margin:"0 0 4px",fontSize:20,fontWeight:900,fontFamily:"'Moniqa','DM Sans',sans-serif",color:"#fff"}}>{friendName}</p>
          {sinceDate && (
            <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.3)"}}>Amigos desde {sinceDate}</p>
          )}
        </div>

        {/* Friends of friend */}
        <div style={{marginBottom:24}}>
          <p style={{margin:"0 0 12px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em"}}>
            Amigos de {friendName.split(" ")[0]}
          </p>

          {loadingFof ? (
            <div style={{textAlign:"center",padding:"16px 0"}}>
              <div style={{width:20,height:20,border:"2px solid rgba(255,255,255,0.1)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.7s linear infinite",margin:"0 auto"}} />
            </div>
          ) : friendsOfFriend.length === 0 ? (
            <p style={{fontSize:13,color:"rgba(255,255,255,0.25)",textAlign:"center",padding:"12px 0"}}>
              No hay sugerencias disponibles
            </p>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {friendsOfFriend.map(fof => {
                const fofName = fof.nombre_display || fof.nombre || "Usuario"
                const alreadySent = sentTo.has(fof.id)
                const isSending = sendingTo === fof.id
                return (
                  <div key={fof.id} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"10px 14px"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",overflow:"hidden",background:"linear-gradient(135deg,#1a1a1a,#111)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"2px solid rgba(255,255,255,0.1)"}}>
                      {fof.avatar_url ? (
                        <img src={fof.avatar_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      ) : (
                        <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>{fofName.charAt(0)}</span>
                      )}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:14,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fofName}</p>
                    </div>
                    {alreadySent ? (
                      <span style={{fontSize:11,fontWeight:700,color:"#34c759",padding:"6px 12px",background:"rgba(52,199,89,0.1)",borderRadius:10}}>Enviada ✓</span>
                    ) : (
                      <button
                        onClick={() => handleAddFriend(fof.id)}
                        disabled={isSending}
                        style={{padding:"6px 14px",borderRadius:10,background:"rgba(52,199,89,0.12)",border:"1px solid rgba(52,199,89,0.25)",color:"#34c759",fontSize:12,fontWeight:700,cursor:isSending?"not-allowed":"pointer",fontFamily:"inherit",opacity:isSending?0.5:1}}
                      >
                        {isSending ? "..." : "Agregar"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Movies in common */}
        {moviesInCommon.length > 0 && (
          <div style={{marginBottom:24}}>
            <p style={{margin:"0 0 12px",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.1em"}}>
              En comun
            </p>
            <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
              {moviesInCommon.slice(0, 10).map(m => {
                const poster = getPoster(m.title)
                return (
                  <div key={m.title} style={{flexShrink:0,width:80}}>
                    <div style={{width:80,height:120,borderRadius:10,overflow:"hidden",background:"linear-gradient(145deg,#1a1a1a,#111)",marginBottom:4}}>
                      {poster ? (
                        <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      ) : (
                        <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:6}}>
                          <span style={{fontSize:9,color:"rgba(255,255,255,0.35)",textAlign:"center",lineHeight:1.2}}>{m.title}</span>
                        </div>
                      )}
                    </div>
                    <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.4)",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.title}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Remove friend */}
        <div style={{paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          {!showRemoveConfirm ? (
            <button onClick={() => setShowRemoveConfirm(true)} style={{width:"100%",padding:13,borderRadius:13,background:"transparent",border:"1px solid rgba(255,69,58,0.15)",color:"rgba(255,69,58,0.5)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Eliminar amigo
            </button>
          ) : (
            <div>
              <p style={{margin:"0 0 10px",fontSize:13,color:"rgba(255,255,255,0.5)",textAlign:"center"}}>
                Eliminar a {friendName.split(" ")[0]} de tus amigos?
              </p>
              <div style={{display:"flex",gap:10}}>
                <button onClick={() => setShowRemoveConfirm(false)} style={{flex:1,padding:12,borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.6)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  Cancelar
                </button>
                <button onClick={handleRemove} style={{flex:1,padding:12,borderRadius:12,background:"rgba(255,69,58,0.15)",border:"1px solid rgba(255,69,58,0.3)",color:"#ff453a",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
