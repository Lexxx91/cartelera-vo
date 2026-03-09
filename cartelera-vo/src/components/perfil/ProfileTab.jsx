import { useState, useRef } from 'react'

export default function ProfileTab({ user, profile, onUpdateProfile, onUploadAvatar, onLogout, myVotes, movies }) {
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.nombre_display || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Cinefilo")
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = useRef(null)

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url
  const email = user?.email
  const inviteCode = profile?.invite_code || "..."
  const voyCount = Object.values(myVotes || {}).filter(v => v === "voy").length
  const pasoCount = Object.values(myVotes || {}).filter(v => v === "paso").length
  const watchedCount = profile?.watched?.length || 0

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file || !onUploadAvatar) return
    setAvatarLoading(true)
    try {
      await onUploadAvatar(file)
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function saveName() {
    setEditingName(false)
    if (onUpdateProfile) onUpdateProfile({ nombre_display: displayName })
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareCode() {
    if (navigator.share) {
      navigator.share({
        title: "VOSE — El cine como debe sonar",
        text: `Unite a VOSE! Descubre que pelis en version original hay en Las Palmas y organiza planes con amigos.\n\nTu codigo: ${inviteCode}\nEntra en: carteleravo.app`,
      }).catch(() => {})
    } else {
      copyCode()
    }
  }

  const getPoster = (title) => (movies || []).find(m => m.title === title)?.poster
  const watchedMovies = [...(profile?.watched || [])].reverse().slice(0, 15)

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 56px)",overflow:"hidden"}}>
      {/* Header — landing style */}
      <div style={{padding:"18px 20px 10px",flexShrink:0}}>
        <h1 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:28,lineHeight:0.95,letterSpacing:"-0.01em",textTransform:"uppercase"}}>
          <span style={{WebkitTextStroke:"1.5px #fff",color:"transparent"}}>PER</span><span style={{color:"#ff3b3b",WebkitTextStroke:"none"}}>FIL</span>
        </h1>
      </div>

      {/* Scrollable content */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"0 0 100px"}}>

        {/* Avatar + Identity */}
        <div style={{textAlign:"center",padding:"20px 20px 24px"}}>
          {/* Hidden file input */}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{display:"none"}} />

          {/* Clickable avatar */}
          <div onClick={() => !avatarLoading && fileInputRef.current?.click()}
            style={{position:"relative",width:96,height:96,margin:"0 auto 16px",cursor:"pointer"}}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="" style={{width:96,height:96,borderRadius:"50%",border:"3px solid rgba(255,255,255,0.12)",objectFit:"cover",opacity:avatarLoading?0.5:1,transition:"opacity 0.2s"}} />
            ) : (
              <div style={{width:96,height:96,borderRadius:"50%",background:"linear-gradient(135deg,#1a1a1a,#111)",border:"3px solid rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:700,color:"rgba(255,255,255,0.8)",opacity:avatarLoading?0.5:1,transition:"opacity 0.2s"}}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Camera badge */}
            <div style={{position:"absolute",bottom:2,right:2,width:28,height:28,borderRadius:"50%",background:"rgba(255,59,59,0.9)",display:"flex",alignItems:"center",justifyContent:"center",border:"2.5px solid #111"}}>
              {avatarLoading ? (
                <div style={{width:12,height:12,border:"2px solid rgba(255,255,255,0.3)",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke="#fff" strokeWidth="2"/>
                </svg>
              )}
            </div>
          </div>

          {/* Display name */}
          {editingName ? (
            <div style={{display:"flex",gap:8,justifyContent:"center",alignItems:"center",marginBottom:4}}>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} autoFocus
                style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:12,padding:"10px 16px",fontSize:17,fontWeight:700,color:"#fff",fontFamily:"inherit",textAlign:"center",maxWidth:200}} />
              <button onClick={saveName} style={{background:"rgba(255,59,59,0.15)",border:"1px solid rgba(255,59,59,0.3)",borderRadius:10,padding:"10px 14px",color:"#ff3b3b",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700}}>OK</button>
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:4}}>
              <h2 style={{margin:0,fontSize:22,fontWeight:300,fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.12em"}}>{displayName}</h2>
              <button onClick={() => setEditingName(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:"rgba(255,255,255,0.3)"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}
          {email && <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.3)"}}>{email}</p>}
        </div>

        {/* Stats card */}
        <div style={{padding:"0 20px",marginBottom:20}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,overflow:"hidden"}}>
            {[
              { label: "VOY", value: voyCount, color: "#ff3b3b" },
              { label: "PASO", value: pasoCount, color: "#ff453a" },
              { label: "VISTAS", value: watchedCount, color: "#ff3b3b" },
            ].map((stat, i) => (
              <div key={stat.label} style={{padding:"18px 12px",textAlign:"center",borderRight:i<2?"1px solid rgba(255,255,255,0.06)":"none"}}>
                <div style={{fontSize:28,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:stat.color,letterSpacing:"-0.02em",lineHeight:1}}>{stat.value}</div>
                <div style={{fontSize:10,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.08em",marginTop:6}}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite code */}
        <div style={{padding:"0 20px",marginBottom:20}}>
          <p style={{margin:"0 0 10px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Tu codigo de invitacion</p>
          <div style={{background:"rgba(255,59,59,0.04)",border:"1px solid rgba(255,59,59,0.15)",borderRadius:20,padding:"20px",textAlign:"center"}}>
            <div style={{fontSize:30,fontWeight:300,letterSpacing:"0.18em",color:"#fff",fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>{inviteCode}</div>
            <p style={{margin:"0 0 16px",fontSize:12,color:"rgba(255,255,255,0.3)",lineHeight:1.5}}>Comparte este codigo para invitar amigos a VO<span style={{color:"#ff3b3b",fontWeight:700}}>SE</span></p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={copyCode} style={{flex:1,padding:13,borderRadius:14,background:copied?"rgba(255,59,59,0.12)":"rgba(255,255,255,0.06)",border:`1px solid ${copied?"rgba(255,59,59,0.25)":"rgba(255,255,255,0.1)"}`,color:copied?"#ff3b3b":"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>
                {copied ? "Copiado ✓" : "Copiar"}
              </button>
              <button onClick={shareCode} style={{flex:1,padding:13,borderRadius:14,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                Compartir
              </button>
            </div>
          </div>
        </div>

        {/* Watch history — horizontal poster scroll */}
        {watchedMovies.length > 0 && (
          <div style={{marginBottom:20}}>
            <p style={{margin:"0 0 10px",padding:"0 20px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Historial</p>
            <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 20px",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
              {watchedMovies.map((w, i) => {
                const poster = getPoster(w.title)
                return (
                  <div key={i} style={{flexShrink:0,width:100}}>
                    <div style={{width:100,height:150,borderRadius:8,overflow:"hidden",background:"linear-gradient(145deg,#1a1a1a,#111)",marginBottom:6,position:"relative"}}>
                      {poster ? (
                        <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      ) : (
                        <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:8}}>
                          <span style={{fontSize:10,color:"rgba(255,255,255,0.35)",textAlign:"center",lineHeight:1.3}}>{w.title}</span>
                        </div>
                      )}
                      {/* Gradient overlay */}
                      <div style={{position:"absolute",inset:0,background:"linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%)"}} />
                      <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"6px 8px"}}>
                        <p style={{margin:0,fontSize:9,fontWeight:700,color:"#fff",lineHeight:1.2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{w.title}</p>
                      </div>
                    </div>
                    {w.rating && <div style={{fontSize:10,color:"#ffd60a",fontWeight:700,textAlign:"center"}}>★ {w.rating}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Logout */}
        <div style={{padding:"0 20px"}}>
          {!logoutConfirm ? (
            <button onClick={() => setLogoutConfirm(true)} style={{width:"100%",borderRadius:14,padding:"14px",background:"rgba(255,69,58,0.06)",border:"1px solid rgba(255,69,58,0.15)",color:"rgba(255,69,58,0.6)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",boxSizing:"border-box"}}>
              Cerrar sesion
            </button>
          ) : (
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,padding:16}}>
              <p style={{margin:"0 0 12px",fontSize:14,color:"rgba(255,255,255,0.6)",textAlign:"center"}}>Seguro que quieres salir?</p>
              <div style={{display:"flex",gap:10}}>
                <button onClick={() => setLogoutConfirm(false)} style={{flex:1,borderRadius:12,padding:"12px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.6)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancelar</button>
                <button onClick={onLogout} style={{flex:1,borderRadius:12,padding:"12px",background:"rgba(255,69,58,0.15)",border:"1px solid rgba(255,69,58,0.3)",color:"#ff453a",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Salir</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
