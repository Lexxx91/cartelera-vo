import { useState, useRef } from 'react'

export default function ProfileTab({ user, profile, onUpdateProfile, onUploadAvatar, onLogout, myVotes, movies, inviteeCount, pwa }) {
  const { canInstall, isInstalled, isIOS, isIOSChrome, promptInstall } = pwa || {}
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
    const url = `https://carteleravo.app?code=${inviteCode}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareCode() {
    const url = `https://carteleravo.app?code=${inviteCode}`
    if (navigator.share) {
      navigator.share({
        title: "VOSE — El cine como debe sonar",
        text: `Unite a VOSE! Descubre que pelis en version original hay en Las Palmas y organiza planes con amigos.`,
        url,
      }).catch(() => {})
    } else {
      copyCode()
    }
  }

  const getPoster = (title) => (movies || []).find(m => m.title === title)?.poster
  const watchedMovies = [...(profile?.watched || [])].reverse().slice(0, 20)

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 56px)",overflow:"hidden"}}>
      {/* Header with logout */}
      <div style={{padding:"18px 20px 14px",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h1 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:22,color:"#fff",letterSpacing:"0.02em",textTransform:"uppercase"}}>Perfil</h1>
        {!logoutConfirm ? (
          <button onClick={() => setLogoutConfirm(true)} style={{background:"none",border:"none",cursor:"pointer",padding:6,color:"rgba(255,255,255,0.3)",display:"flex",alignItems:"center"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <div style={{display:"flex",gap:6,alignItems:"center",animation:"fadeIn 0.2s ease"}}>
            <button onClick={() => setLogoutConfirm(false)} style={{padding:"5px 12px",borderRadius:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>No</button>
            <button onClick={onLogout} style={{padding:"5px 12px",borderRadius:8,background:"rgba(255,69,58,0.15)",border:"1px solid rgba(255,69,58,0.3)",color:"#ff453a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Salir</button>
          </div>
        )}
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

        {/* PWA Install Card */}
        {(() => {
          // Case 1: Already installed — subtle green indicator
          if (isInstalled) {
            return (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <div style={{
                  background:"rgba(52,199,89,0.06)",
                  border:"1px solid rgba(52,199,89,0.15)",
                  borderRadius:20,
                  padding:"14px 18px",
                  display:"flex",alignItems:"center",gap:10,
                }}>
                  <span style={{fontSize:18,lineHeight:1}}>✓</span>
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.45)",fontWeight:500}}>
                    VOSE instalada en tu dispositivo
                  </span>
                </div>
              </div>
            )
          }

          // Case 2: Android/Chrome — native install prompt
          if (canInstall) {
            return (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <div style={{
                  background:"rgba(255,255,255,0.06)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:20,padding:"20px 18px",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                    <div style={{
                      width:40,height:40,borderRadius:10,
                      background:"#000",border:"1px solid rgba(255,255,255,0.1)",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    }}>
                      <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:10,fontWeight:400}}>
                        <span style={{color:"#fff"}}>VO</span>
                        <span style={{color:"#ff3b3b"}}>SE</span>
                      </span>
                    </div>
                    <div>
                      <h3 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:16,color:"#fff",letterSpacing:"0.02em"}}>
                        Instalar VOSE
                      </h3>
                      <p style={{margin:"2px 0 0",fontSize:12,color:"rgba(255,255,255,0.4)"}}>
                        Accede mas rapido desde tu pantalla de inicio
                      </p>
                    </div>
                  </div>
                  <button onClick={promptInstall} style={{
                    width:"100%",padding:"13px 0",borderRadius:14,border:"none",
                    background:"#ff3b3b",color:"#fff",fontSize:15,fontWeight:700,
                    cursor:"pointer",fontFamily:"inherit",
                    WebkitTapHighlightColor:"transparent",
                    transition:"opacity 0.2s",
                  }}>
                    Instalar
                  </button>
                </div>
              </div>
            )
          }

          // Case 3: iOS Safari — manual tutorial steps
          if (isIOS) {
            return (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <div style={{
                  background:"rgba(255,255,255,0.06)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:20,padding:"20px 18px",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                    <div style={{
                      width:40,height:40,borderRadius:10,
                      background:"#000",border:"1px solid rgba(255,255,255,0.1)",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    }}>
                      <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:10,fontWeight:400}}>
                        <span style={{color:"#fff"}}>VO</span>
                        <span style={{color:"#ff3b3b"}}>SE</span>
                      </span>
                    </div>
                    <div>
                      <h3 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:16,color:"#fff",letterSpacing:"0.02em"}}>
                        Anadir VOSE a tu inicio
                      </h3>
                      <p style={{margin:"2px 0 0",fontSize:12,color:"rgba(255,255,255,0.4)"}}>
                        Accede mas rapido desde tu pantalla de inicio
                      </p>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[
                      { icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#ff3b3b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ), text: "Pulsa el boton Compartir" },
                      { icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="18" height="18" rx="2" stroke="#ff3b3b" strokeWidth="2"/>
                          <line x1="12" y1="8" x2="12" y2="16" stroke="#ff3b3b" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="8" y1="12" x2="16" y2="12" stroke="#ff3b3b" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      ), text: "Selecciona \"Anadir a pantalla de inicio\"" },
                      { icon: (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <polyline points="20,6 9,17 4,12" stroke="#ff3b3b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ), text: "Pulsa \"Anadir\"" },
                    ].map((step, i) => (
                      <div key={i} style={{
                        display:"flex",alignItems:"center",gap:12,
                        background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"10px 14px",
                      }}>
                        <div style={{
                          width:28,height:28,borderRadius:8,
                          background:"rgba(255,59,59,0.12)",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          flexShrink:0,
                        }}>
                          {step.icon}
                        </div>
                        <span style={{fontSize:13,color:"rgba(255,255,255,0.7)",lineHeight:1.3}}>{step.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          }

          // Case 4: iOS but NOT Safari (Chrome, Firefox, etc.) — must open in Safari
          if (isIOSChrome) {
            return (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <div style={{
                  background:"rgba(255,255,255,0.06)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:20,padding:"20px 18px",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                    <div style={{
                      width:40,height:40,borderRadius:10,
                      background:"#000",border:"1px solid rgba(255,255,255,0.1)",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    }}>
                      <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:10,fontWeight:400}}>
                        <span style={{color:"#fff"}}>VO</span>
                        <span style={{color:"#ff3b3b"}}>SE</span>
                      </span>
                    </div>
                    <div>
                      <h3 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:16,color:"#fff",letterSpacing:"0.02em"}}>
                        Instalar VOSE
                      </h3>
                      <p style={{margin:"2px 0 0",fontSize:12,color:"rgba(255,255,255,0.4)"}}>
                        Abre en Safari para instalar
                      </p>
                    </div>
                  </div>
                  <div style={{
                    background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 14px",
                    display:"flex",alignItems:"flex-start",gap:10,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,marginTop:1}}>
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                      <line x1="12" y1="8" x2="12" y2="12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="12" cy="15.5" r="0.75" fill="rgba(255,255,255,0.3)"/>
                    </svg>
                    <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>
                      En iPhone solo se puede instalar desde <strong style={{color:"rgba(255,255,255,0.75)"}}>Safari</strong>. Abre <strong style={{color:"rgba(255,255,255,0.75)"}}>carteleravo.app</strong> en Safari y ve a tu perfil.
                    </p>
                  </div>
                </div>
              </div>
            )
          }

          // Case 5: Desktop — don't show anything
          return null
        })()}

        {/* Credit card invite */}
        <div style={{padding:"0 20px",marginBottom:24}}>
          <div style={{
            background:"linear-gradient(135deg, #ff3b3b 0%, #cc2020 50%, #991515 100%)",
            borderRadius:20,
            minHeight:190,
            overflow:"hidden",
            position:"relative",
            padding:"22px 24px",
            display:"flex",
            flexDirection:"column",
            justifyContent:"space-between",
          }}>
            {/* Decorative circles */}
            <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}} />
            <div style={{position:"absolute",bottom:-40,left:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}} />
            <div style={{position:"absolute",top:60,right:40,width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}} />

            {/* Top row: VOSE logo + invitee count */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative",zIndex:1}}>
              <div>
                <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:22,fontWeight:400,color:"#fff",letterSpacing:"0.02em"}}>VO</span>
                <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:22,fontWeight:400,color:"rgba(255,255,255,0.45)",letterSpacing:"0.02em"}}>SE</span>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{margin:0,fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Amigos invitados</p>
                <p style={{margin:"2px 0 0",fontSize:28,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",lineHeight:1}}>{inviteeCount ?? 0}</p>
              </div>
            </div>

            {/* Center: Invite code */}
            <div style={{textAlign:"center",position:"relative",zIndex:1,margin:"16px 0"}}>
              <p style={{margin:0,fontSize:28,fontWeight:300,letterSpacing:"0.22em",color:"#fff",fontFamily:"'DM Sans',sans-serif"}}>{inviteCode}</p>
              <p style={{margin:"6px 0 0",fontSize:11,color:"rgba(255,255,255,0.5)"}}>Tu codigo de invitacion</p>
            </div>

            {/* Bottom: Copy + Share */}
            <div style={{display:"flex",gap:10,position:"relative",zIndex:1}}>
              <button onClick={copyCode} style={{flex:1,padding:11,borderRadius:12,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(10px)",transition:"all 0.2s"}}>
                {copied ? "Copiado ✓" : "Copiar enlace"}
              </button>
              <button onClick={shareCode} style={{flex:1,padding:11,borderRadius:12,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(10px)"}}>
                Compartir
              </button>
            </div>
          </div>
        </div>

        {/* Watch history — vertical list */}
        {watchedMovies.length > 0 && (
          <div style={{padding:"0 20px",marginBottom:20}}>
            <p style={{margin:"0 0 12px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Historial</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {watchedMovies.map((w, i) => {
                const poster = getPoster(w.title)
                return (
                  <div key={i} style={{display:"flex",gap:12,alignItems:"center",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:10}}>
                    {/* Poster thumbnail */}
                    <div style={{width:52,height:78,borderRadius:8,overflow:"hidden",flexShrink:0,background:"linear-gradient(145deg,#1a1a1a,#111)"}}>
                      {poster ? (
                        <img src={poster} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      ) : (
                        <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:4}}>
                          <span style={{fontSize:8,color:"rgba(255,255,255,0.3)",textAlign:"center",lineHeight:1.2}}>{w.title}</span>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:"0 0 3px",fontSize:14,fontWeight:600,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.title}</p>
                      {w.rating && (
                        <div style={{display:"flex",gap:2,marginBottom:4}}>
                          {[1,2,3,4,5].map(s => (
                            <span key={s} style={{fontSize:12,color:s<=w.rating?"#ffd60a":"rgba(255,255,255,0.1)"}}>★</span>
                          ))}
                        </div>
                      )}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                        {w.date && <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{w.date}</span>}
                        {w.time && <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>· {w.time}</span>}
                      </div>
                      {w.cinema && <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.25)"}}>📍 {w.cinema}</p>}
                      {w.with && w.with.length > 0 && (
                        <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.25)"}}>
                          con {w.with.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
