export default function Toast({ toasts }) {
  return (
    <div style={{ position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,display:"flex",flexDirection:"column",gap:8,minWidth:280,maxWidth:340,pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          borderRadius:14,padding:"13px 16px",
          background: t.type==="match" ? "rgba(255,59,59,0.15)" : t.type==="vote" ? "rgba(255,214,10,0.15)" : t.type==="join" ? "rgba(52,199,89,0.15)" : t.type==="friend" ? "rgba(100,149,237,0.15)" : "rgba(24,24,28,0.92)",
          border:`1px solid ${t.type==="match" ? "rgba(255,59,59,0.4)" : t.type==="vote" ? "rgba(255,214,10,0.4)" : t.type==="join" ? "rgba(52,199,89,0.4)" : t.type==="friend" ? "rgba(100,149,237,0.4)" : "rgba(255,255,255,0.08)"}`,
          backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
          animation:"slideDown 0.3s ease",display:"flex",alignItems:"center",gap:10,
          boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
        }}>
          <span style={{fontSize:18,flexShrink:0}}>{t.emoji}</span>
          <div>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:"#fff"}}>{t.title}</p>
            <p style={{margin:"2px 0 0",fontSize:12,color:"rgba(255,255,255,0.55)"}}>{t.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
