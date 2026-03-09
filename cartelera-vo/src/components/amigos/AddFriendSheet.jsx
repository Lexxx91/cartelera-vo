import { useState } from 'react'

export default function AddFriendSheet({ myInviteCode, onSendRequest, onClose }) {
  const [tab, setTab] = useState("share") // 'share' | 'add'
  const [codeInput, setCodeInput] = useState("")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  async function handleSend() {
    if (!codeInput.trim()) return
    setSending(true)
    setResult(null)
    const res = await onSendRequest(codeInput.trim())
    setSending(false)
    if (res.error) {
      setResult({ type: "error", msg: res.error })
    } else {
      setResult({ type: "success", msg: `Solicitud enviada a ${res.name}` })
      setCodeInput("")
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(myInviteCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareCode() {
    if (navigator.share) {
      navigator.share({
        title: "Cartelera VO",
        text: `Agregame en Cartelera VO! Mi codigo: ${myInviteCode}`,
      }).catch(() => {})
    } else {
      copyCode()
    }
  }

  return (
    <div style={{position:"absolute",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.72)"}} />
      <div style={{position:"relative",background:"#111",borderRadius:"24px 24px 0 0",border:"1px solid rgba(255,255,255,0.08)",padding:"0 20px 44px",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{width:36,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"12px auto 20px"}} />

        {/* Tab switch */}
        <div style={{display:"flex",gap:0,background:"rgba(255,255,255,0.05)",borderRadius:12,padding:3,marginBottom:20}}>
          {[["share","Mi codigo"],["add","Agregar amigo"]].map(([id,label]) => (
            <button key={id} onClick={()=>{setTab(id);setResult(null)}} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:tab===id?700:400,background:tab===id?"rgba(255,255,255,0.12)":"transparent",color:tab===id?"#fff":"rgba(255,255,255,0.4)",transition:"all 0.2s"}}>
              {label}
            </button>
          ))}
        </div>

        {tab === "share" && (
          <>
            <div style={{textAlign:"center",marginBottom:24}}>
              <p style={{margin:"0 0 6px",fontSize:12,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Tu codigo de amigo</p>
              <div style={{fontSize:32,fontWeight:900,letterSpacing:"0.12em",color:"#fff",marginBottom:16,fontFamily:"monospace"}}>{myInviteCode}</div>
              <p style={{margin:0,fontSize:13,color:"rgba(255,255,255,0.35)",lineHeight:1.6}}>Comparte este codigo con tus amigos para que te agreguen</p>
            </div>

            <div style={{display:"flex",gap:10}}>
              <button onClick={copyCode} style={{flex:1,padding:14,borderRadius:14,background:copied?"rgba(52,199,89,0.15)":"rgba(255,255,255,0.07)",border:`1px solid ${copied?"rgba(52,199,89,0.3)":"rgba(255,255,255,0.12)"}`,color:copied?"#34c759":"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>
                {copied ? "Copiado!" : "Copiar"}
              </button>
              <button onClick={shareCode} style={{flex:1,padding:14,borderRadius:14,background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                Compartir
              </button>
            </div>
          </>
        )}

        {tab === "add" && (
          <>
            <p style={{margin:"0 0 6px",fontSize:14,fontWeight:700,color:"#fff"}}>Codigo de tu amigo</p>
            <p style={{margin:"0 0 16px",fontSize:13,color:"rgba(255,255,255,0.35)",lineHeight:1.6}}>Introduce el codigo que te ha compartido tu amigo</p>

            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Ej: A3B2C1"
              maxLength={8}
              style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:14,padding:"14px 16px",fontSize:18,color:"#fff",fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:14,boxSizing:"border-box",textAlign:"center"}}
            />

            {result && (
              <div style={{borderRadius:12,padding:"12px 14px",marginBottom:14,background:result.type==="error"?"rgba(255,69,58,0.08)":"rgba(52,199,89,0.08)",border:`1px solid ${result.type==="error"?"rgba(255,69,58,0.2)":"rgba(52,199,89,0.2)"}`}}>
                <p style={{margin:0,fontSize:13,fontWeight:600,color:result.type==="error"?"#ff453a":"#34c759"}}>{result.msg}</p>
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={!codeInput.trim() || sending}
              style={{width:"100%",borderRadius:14,padding:"15px",background:(codeInput.trim()&&!sending)?"#fff":"rgba(255,255,255,0.07)",border:"none",color:(codeInput.trim()&&!sending)?"#000":"rgba(255,255,255,0.3)",fontSize:15,fontWeight:700,cursor:(codeInput.trim()&&!sending)?"pointer":"not-allowed",fontFamily:"inherit"}}
            >
              {sending ? "Enviando..." : "Enviar solicitud"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
