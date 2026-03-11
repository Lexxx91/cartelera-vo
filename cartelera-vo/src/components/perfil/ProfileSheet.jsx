import { useState, useRef, useEffect } from 'react'
import AdminPanel from './AdminPanel.jsx'
import VocitoCard from '../VocitoCard.jsx'
import EventHistory from './EventHistory.jsx'
import WrappedScreen from './WrappedScreen.jsx'
import CinemaDNACard from '../social/CinemaDNACard.jsx'

export default function ProfileSheet({ open, onClose, user, profile, onUpdateProfile, onUploadAvatar, onLogout, myVotes, movies, inviteeCount, pwa, campaignOverrides, onSaveCampaignOverride, isAdmin, campaignsLoading, onConnectWhatsApp, onUnlinkWhatsApp, waLinking, waLinkError, onRetryWhatsApp, onToggleVocito, onToggleVocitoPref, vocitoState, pastPlans, friends }) {
  const { canInstall, isInstalled, isIOS, isIOSChrome, promptInstall } = pwa || {}
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.nombre_display || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Cinefilo")
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState(null)
  const [copiedSafariLink, setCopiedSafariLink] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const [showWrapped, setShowWrapped] = useState(false)
  const [closing, setClosing] = useState(false)
  const fileInputRef = useRef(null)

  // Sync display name when profile changes
  useEffect(() => {
    if (profile?.nombre_display) setDisplayName(profile.nombre_display)
  }, [profile?.nombre_display])

  // Reset logout confirm when sheet closes
  useEffect(() => {
    if (!open) setLogoutConfirm(false)
  }, [open])

  const currentYear = new Date().getFullYear()
  const hasYearPlans = (pastPlans || []).some(p => p.chosen_session?.date?.startsWith(String(currentYear)))

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url
  const email = user?.email
  const inviteCode = profile?.invite_code || "..."
  const voyCount = Object.values(myVotes || {}).filter(v => v === "voy").length
  const pasoCount = Object.values(myVotes || {}).filter(v => v === "paso").length
  const watchedCount = profile?.watched?.length || 0

  function handleClose() {
    setClosing(true)
    setTimeout(() => { setClosing(false); onClose() }, 300)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file || !onUploadAvatar) return
    setAvatarLoading(true)
    setAvatarMsg(null)
    try {
      const result = await onUploadAvatar(file)
      if (result?.error) setAvatarMsg({ type: 'error', text: result.error })
      else setAvatarMsg({ type: 'success', text: 'Foto actualizada' })
      setTimeout(() => setAvatarMsg(null), 3000)
    } catch {
      setAvatarMsg({ type: 'error', text: 'Error inesperado' })
      setTimeout(() => setAvatarMsg(null), 3000)
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function saveName() {
    const trimmed = displayName.trim()
    if (!trimmed || trimmed.length > 40) {
      setDisplayName(profile?.nombre_display || 'Cinefilo')
      setEditingName(false)
      return
    }
    setEditingName(false)
    setDisplayName(trimmed)
    if (onUpdateProfile) onUpdateProfile({ nombre_display: trimmed })
  }

  function copyCode() {
    const url = `https://cartelera-vo.vercel.app?code=${inviteCode}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareCode() {
    const url = `https://cartelera-vo.vercel.app?code=${inviteCode}`
    if (navigator.share) {
      navigator.share({
        title: "VOSE — Cine en VO con amigos",
        text: `¿Vamos pal cine? 🎬 Con VOSE haces swipe en la cartelera de VO de Las Palmas y cuando coincides con un amigo se monta el plan solo. Sin audios. Sin grupos muertos.`,
        url,
      }).catch(() => {})
    } else {
      copyCode()
    }
  }

  const getPoster = (title) => (movies || []).find(m => m.title === title)?.poster
  const watchedMovies = [...(profile?.watched || [])].reverse().slice(0, 20)

  if (!open) return null

  const slideClass = closing ? 'profileSheetOut' : 'profileSheetIn'

  return (
    <div style={{position:"fixed",inset:0,zIndex:200}}>
      <style>{`
        @keyframes profileSheetIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes profileSheetOut{from{transform:translateX(0)}to{transform:translateX(100%)}}
        @keyframes profileOverlayIn{from{opacity:0}to{opacity:1}}
        @keyframes profileOverlayOut{from{opacity:1}to{opacity:0}}
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position:"absolute",inset:0,
          background:"rgba(0,0,0,0.6)",
          backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
          animation: `${closing ? 'profileOverlayOut' : 'profileOverlayIn'} 0.3s ease forwards`,
        }}
      />

      {/* Sheet panel — slides from right */}
      <div style={{
        position:"absolute",top:0,right:0,bottom:0,
        width:"100%",maxWidth:430,
        background:"#0a0a0a",
        animation: `${slideClass} 0.3s cubic-bezier(0.32,0.72,0,1) forwards`,
        display:"flex",flexDirection:"column",
        overflow:"hidden",
      }}>
        {/* Header */}
        <div style={{padding:"18px 20px 14px",flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <button onClick={handleClose} style={{background:"none",border:"none",cursor:"pointer",padding:6,color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",fontSize:13,fontWeight:600}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <polyline points="15,18 9,12 15,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Cerrar
          </button>
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
        <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"0 0 40px",WebkitOverflowScrolling:"touch"}}>

          {/* Avatar + Identity */}
          <div style={{textAlign:"center",padding:"24px 20px 24px"}}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{display:"none"}} />
            <div onClick={() => !avatarLoading && fileInputRef.current?.click()}
              style={{position:"relative",width:80,height:80,margin:"0 auto 14px",cursor:"pointer"}}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{width:80,height:80,borderRadius:"50%",border:"3px solid rgba(255,255,255,0.12)",objectFit:"cover",opacity:avatarLoading?0.5:1,transition:"opacity 0.2s"}} />
              ) : (
                <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#1a1a1a,#111)",border:"3px solid rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:700,color:"rgba(255,255,255,0.8)",opacity:avatarLoading?0.5:1}}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div style={{position:"absolute",bottom:0,right:0,width:26,height:26,borderRadius:"50%",background:"rgba(255,59,59,0.9)",display:"flex",alignItems:"center",justifyContent:"center",border:"2.5px solid #0a0a0a"}}>
                {avatarLoading ? (
                  <div style={{width:10,height:10,border:"2px solid rgba(255,255,255,0.3)",borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="#fff" strokeWidth="2"/></svg>
                )}
              </div>
            </div>

            {avatarMsg && (
              <p style={{margin:"0 0 8px",fontSize:12,fontWeight:600,textAlign:"center",color:avatarMsg.type==='error'?'#ff453a':'#34c759',animation:"fadeIn 0.2s ease"}}>
                {avatarMsg.text}
              </p>
            )}

            {editingName ? (
              <div style={{display:"flex",gap:8,justifyContent:"center",alignItems:"center",marginBottom:4}}>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)} autoFocus
                  style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:12,padding:"10px 16px",fontSize:17,fontWeight:700,color:"#fff",fontFamily:"inherit",textAlign:"center",maxWidth:200}} />
                <button onClick={saveName} style={{background:"rgba(255,59,59,0.15)",border:"1px solid rgba(255,59,59,0.3)",borderRadius:10,padding:"10px 14px",color:"#ff3b3b",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:700}}>OK</button>
              </div>
            ) : (
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:4}}>
                <h2 style={{margin:0,fontSize:20,fontWeight:300,fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.12em"}}>{displayName}</h2>
                <button onClick={() => setEditingName(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:"rgba(255,255,255,0.3)"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            )}
            {email && <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.3)"}}>{email}</p>}
            <p style={{margin:"4px 0 0",fontSize:11,color:"rgba(255,255,255,0.2)"}}>En VOSE desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }) : '...'}</p>
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

          {/* ADN de Cine */}
          <CinemaDNACard
            profile={profile}
            user={user}
            myVotes={myVotes}
            friends={friends}
            plans={pastPlans}
            isDemoMode={user?.isDemo === true}
            movies={movies}
            onUpdateProfile={onUpdateProfile}
          />

          {/* Historial de eventos */}
          <div style={{padding:"0 20px",marginBottom:12}}>
            <button onClick={() => setShowHistorial(true)} style={{
              width:"100%",display:"flex",alignItems:"center",gap:14,
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:16,padding:"14px 16px",cursor:"pointer",fontFamily:"inherit",
              WebkitTapHighlightColor:"transparent",
            }}>
              <div style={{width:36,height:36,borderRadius:10,background:"rgba(255,59,59,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ff3b3b" strokeWidth="1.5"/><polyline points="12,6 12,12 16,14" stroke="#ff3b3b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{flex:1,textAlign:"left"}}>
                <p style={{margin:0,fontSize:14,fontWeight:600,color:"#fff"}}>Historial de eventos</p>
                <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.35)"}}>Tus planes pasados con amigos</p>
              </div>
              {(pastPlans || []).length > 0 && (
                <span style={{background:"rgba(255,59,59,0.15)",color:"#ff3b3b",fontSize:12,fontWeight:700,padding:"3px 8px",borderRadius:8,minWidth:22,textAlign:"center"}}>
                  {(pastPlans || []).length}
                </span>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="9,18 15,12 9,6" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          {/* VOSE Wrapped card */}
          {hasYearPlans && (
            <div style={{padding:"0 20px",marginBottom:20}}>
              <button onClick={() => setShowWrapped(true)} style={{
                width:"100%",padding:"18px 20px",borderRadius:20,border:"none",cursor:"pointer",
                background:"linear-gradient(135deg, #ff3b3b 0%, #cc2020 50%, #991515 100%)",
                fontFamily:"inherit",position:"relative",overflow:"hidden",
                WebkitTapHighlightColor:"transparent",textAlign:"left",
              }}>
                <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}} />
                <div style={{position:"absolute",bottom:-15,left:-10,width:50,height:50,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}} />
                <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",gap:14}}>
                  <span style={{fontSize:32}}>✨</span>
                  <div>
                    <p style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:18,color:"#fff",letterSpacing:"0.02em"}}>WRAPPED {currentYear}</p>
                    <p style={{margin:"4px 0 0",fontSize:12,color:"rgba(255,255,255,0.6)"}}>Descubre tu resumen del año</p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{marginLeft:"auto"}}><polyline points="9,18 15,12 9,6" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </button>
            </div>
          )}

          {/* PWA Install Card */}
          {(() => {
            if (isInstalled) return (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <div style={{background:"rgba(52,199,89,0.06)",border:"1px solid rgba(52,199,89,0.15)",borderRadius:20,padding:"14px 18px",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18,lineHeight:1}}>✓</span>
                  <span style={{fontSize:13,color:"rgba(255,255,255,0.45)",fontWeight:500}}>VOSE instalada en tu dispositivo</span>
                </div>
              </div>
            )

            if (canInstall) return (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"20px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                    <div style={{width:40,height:40,borderRadius:10,background:"#000",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:10,fontWeight:400}}><span style={{color:"#fff"}}>VO</span><span style={{color:"#ff3b3b"}}>SE</span></span>
                    </div>
                    <div>
                      <h3 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:16,color:"#fff",letterSpacing:"0.02em"}}>Instalar VOSE</h3>
                      <p style={{margin:"2px 0 0",fontSize:12,color:"rgba(255,255,255,0.4)"}}>Accede mas rapido desde tu inicio</p>
                    </div>
                  </div>
                  <button onClick={promptInstall} style={{width:"100%",padding:"13px 0",borderRadius:14,border:"none",background:"#ff3b3b",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Instalar</button>
                </div>
              </div>
            )

            if (isIOS) return (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"20px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                    <div style={{width:40,height:40,borderRadius:10,background:"#000",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:10,fontWeight:400}}><span style={{color:"#fff"}}>VO</span><span style={{color:"#ff3b3b"}}>SE</span></span>
                    </div>
                    <div>
                      <h3 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:16,color:"#fff",letterSpacing:"0.02em"}}>Anadir VOSE a tu inicio</h3>
                      <p style={{margin:"2px 0 0",fontSize:12,color:"rgba(255,255,255,0.4)"}}>Accede mas rapido desde tu pantalla de inicio</p>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[
                      { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="#ff3b3b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, text: "Pulsa el boton Compartir" },
                      { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="#ff3b3b" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="16" stroke="#ff3b3b" strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="#ff3b3b" strokeWidth="2" strokeLinecap="round"/></svg>, text: "\"Anadir a pantalla de inicio\"" },
                      { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="20,6 9,17 4,12" stroke="#ff3b3b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>, text: "Pulsa \"Anadir\"" },
                    ].map((step, i) => (
                      <div key={i} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"10px 14px"}}>
                        <div style={{width:28,height:28,borderRadius:8,background:"rgba(255,59,59,0.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{step.icon}</div>
                        <span style={{fontSize:13,color:"rgba(255,255,255,0.7)",lineHeight:1.3}}>{step.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )

            if (isIOSChrome) return (
              <div style={{padding:"0 20px",marginBottom:20}}>
                <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"20px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                    <div style={{width:40,height:40,borderRadius:10,background:"#000",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontFamily:"'Archivo Black',sans-serif",fontSize:10,fontWeight:400}}><span style={{color:"#fff"}}>VO</span><span style={{color:"#ff3b3b"}}>SE</span></span>
                    </div>
                    <div>
                      <h3 style={{margin:0,fontFamily:"'Archivo Black',sans-serif",fontWeight:400,fontSize:16,color:"#fff",letterSpacing:"0.02em"}}>Instalar VOSE</h3>
                      <p style={{margin:"2px 0 0",fontSize:12,color:"rgba(255,255,255,0.4)"}}>En iPhone se instala desde Safari</p>
                    </div>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText('https://cartelera-vo.vercel.app?returning=1'); setCopiedSafariLink(true); setTimeout(() => setCopiedSafariLink(false), 2000) }}
                    style={{width:"100%",padding:"13px 0",borderRadius:14,border:"none",background:copiedSafariLink?"rgba(52,199,89,0.15)":"#ff3b3b",color:copiedSafariLink?"#34c759":"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:12,transition:"all 0.3s ease"}}>
                    {copiedSafariLink ? "Enlace copiado" : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="#fff" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="#fff" strokeWidth="2"/></svg>Copiar enlace para Safari</>)}
                  </button>
                  <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.35)",textAlign:"center",lineHeight:1.5}}>Pega el enlace en Safari y sigue los pasos</p>
                </div>
              </div>
            )

            return null
          })()}

          {/* VOCITO */}
          <VocitoCard
            vocitoState={vocitoState}
            profile={profile}
            isLinked={!!profile?.whatsapp_jid}
            waLinking={waLinking}
            waLinkError={waLinkError}
            onConnect={onConnectWhatsApp}
            onUnlink={onUnlinkWhatsApp}
            onRetry={onRetryWhatsApp}
            onToggleVocito={onToggleVocito}
            onTogglePref={onToggleVocitoPref}
            isDemoMode={user?.isDemo === true}
          />

          {/* Invite credit card */}
          <div style={{padding:"0 20px",marginBottom:24}}>
            <div style={{
              background:"linear-gradient(135deg, #ff3b3b 0%, #cc2020 50%, #991515 100%)",
              borderRadius:20,minHeight:190,overflow:"hidden",position:"relative",padding:"22px 24px",
              display:"flex",flexDirection:"column",justifyContent:"space-between",
            }}>
              <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}} />
              <div style={{position:"absolute",bottom:-40,left:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,0.05)"}} />
              <div style={{position:"absolute",top:60,right:40,width:60,height:60,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}} />
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
              <div style={{textAlign:"center",position:"relative",zIndex:1,margin:"16px 0"}}>
                <p style={{margin:0,fontSize:28,fontWeight:300,letterSpacing:"0.22em",color:"#fff",fontFamily:"'DM Sans',sans-serif"}}>{inviteCode}</p>
                <p style={{margin:"6px 0 0",fontSize:11,color:"rgba(255,255,255,0.5)"}}>Tu codigo de invitacion</p>
              </div>
              <div style={{display:"flex",gap:10,position:"relative",zIndex:1}}>
                <button onClick={copyCode} style={{flex:1,padding:11,borderRadius:12,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(10px)",transition:"all 0.2s"}}>
                  {copied ? "Copiado" : "Copiar enlace"}
                </button>
                <button onClick={shareCode} style={{flex:1,padding:11,borderRadius:12,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(10px)"}}>
                  Compartir
                </button>
              </div>
            </div>
          </div>

          {/* Watch history */}
          {watchedMovies.length > 0 && (
            <div style={{padding:"0 20px",marginBottom:20}}>
              <p style={{margin:"0 0 12px",fontSize:12,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Historial</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {watchedMovies.map((w, i) => {
                  const poster = getPoster(w.title)
                  return (
                    <div key={i} style={{display:"flex",gap:12,alignItems:"center",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:10}}>
                      <div style={{width:52,height:78,borderRadius:8,overflow:"hidden",flexShrink:0,background:"linear-gradient(145deg,#1a1a1a,#111)"}}>
                        {poster ? <img src={poster} alt="" loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover"}} /> : (
                          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:4}}>
                            <span style={{fontSize:8,color:"rgba(255,255,255,0.3)",textAlign:"center",lineHeight:1.2}}>{w.title}</span>
                          </div>
                        )}
                      </div>
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
                        {w.with && w.with.length > 0 && <p style={{margin:"2px 0 0",fontSize:11,color:"rgba(255,255,255,0.25)"}}>con {w.with.join(", ")}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Admin panel */}
          {isAdmin && (
            <AdminPanel
              overrides={campaignOverrides || []}
              onSaveOverride={onSaveCampaignOverride}
              loading={campaignsLoading}
            />
          )}
        </div>
      </div>

      {/* Historial overlay */}
      {showHistorial && (
        <EventHistory
          pastPlans={pastPlans || []}
          friends={friends || []}
          user={user}
          movies={movies}
          onClose={() => setShowHistorial(false)}
          onShowWrapped={hasYearPlans ? () => { setShowHistorial(false); setShowWrapped(true) } : null}
        />
      )}

      {/* Wrapped overlay */}
      {showWrapped && (
        <WrappedScreen
          pastPlans={pastPlans || []}
          friends={friends || []}
          user={user}
          movies={movies}
          year={currentYear}
          onClose={() => setShowWrapped(false)}
        />
      )}
    </div>
  )
}
