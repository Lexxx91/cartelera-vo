import { useState } from 'react'

const EMOJI_SCALE = [
  { emoji: "😴", label: "SUEÑO", value: 2 },
  { emoji: "😐", label: "MEH", value: 4 },
  { emoji: "😊", label: "BIEN", value: 6 },
  { emoji: "🔥", label: "ÑIOS", value: 8 },
  { emoji: "😍", label: "DE LOCOS", value: 10 },
]

export default function PostCineCard({ plan, friends, user, posterUrl, onRate }) {
  const [selected, setSelected] = useState(null)
  const [done, setDone] = useState(false)

  const partnerNames = (plan.participants || [])
    .filter(pid => pid !== user?.id)
    .map(pid => {
      const f = friends.find(fr => fr.id === pid)
      const pp = (plan.participantProfiles || []).find(p => p.id === pid)
      return (f?.nombre_display || f?.nombre || pp?.nombre_display || pp?.nombre || "Amigo").split(" ")[0]
    })

  function handleSelect(item) {
    setSelected(item.value)
    setTimeout(() => {
      onRate(plan, item.value)
      setDone(true)
    }, 600)
  }

  if (done) return null

  return (
    <div style={{
      margin:"0 20px 16px",borderRadius:20,overflow:"hidden",
      background:"linear-gradient(135deg, rgba(255,59,59,0.08) 0%, rgba(0,0,0,0.4) 100%)",
      border:"1px solid rgba(255,59,59,0.2)",
      animation:"fadeIn 0.5s ease",
    }}>
      <div style={{display:"flex",gap:14,padding:"16px 18px 12px",alignItems:"center"}}>
        {posterUrl && (
          <div style={{width:52,height:78,borderRadius:10,overflow:"hidden",flexShrink:0,background:"linear-gradient(145deg,#1a1a1a,#111)"}}>
            <img src={posterUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}} />
          </div>
        )}
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,color:"#ff3b3b",textTransform:"uppercase",letterSpacing:"0.06em"}}>
            ¿Qué tal estuvo, bro?
          </p>
          <p style={{margin:"0 0 4px",fontSize:16,fontWeight:400,fontFamily:"'Archivo Black',sans-serif",color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {plan.movie_title}
          </p>
          <p style={{margin:0,fontSize:11,color:"rgba(255,255,255,0.35)"}}>
            {plan.chosen_session?.day || plan.chosen_session?.date}
            {partnerNames.length > 0 && ` · con ${partnerNames.join(", ")}`}
          </p>
        </div>
      </div>

      <div style={{padding:"4px 18px 18px",display:"flex",justifyContent:"space-between",gap:4}}>
        {EMOJI_SCALE.map(item => {
          const isSelected = selected === item.value
          return (
            <button key={item.value} onClick={() => !selected && handleSelect(item)} style={{
              flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,
              padding:"10px 4px",borderRadius:14,
              background: isSelected ? "rgba(255,59,59,0.15)" : "rgba(255,255,255,0.04)",
              border: isSelected ? "1px solid rgba(255,59,59,0.3)" : "1px solid rgba(255,255,255,0.06)",
              cursor: selected ? "default" : "pointer",
              opacity: selected && !isSelected ? 0.3 : 1,
              transform: isSelected ? "scale(1.1)" : "scale(1)",
              transition:"all 0.3s ease",
              fontFamily:"inherit",
              WebkitTapHighlightColor:"transparent",
            }}>
              <span style={{fontSize:24,lineHeight:1}}>{item.emoji}</span>
              <span style={{fontSize:9,fontWeight:600,color: isSelected ? "#ff3b3b" : "rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.02em"}}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
