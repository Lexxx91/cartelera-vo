import { useState } from 'react'
import { CAMPAIGN_CATALOG } from '../../campaigns.js'

export default function AdminPanel({ overrides, onSaveOverride, loading }) {
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({})
  const [saving, setSaving] = useState(false)
  // Confirmation dialog state: { type, campaignId, conflictId, conflictName }
  const [confirm, setConfirm] = useState(null)

  if (loading) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center" }}>
        <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#ff3b3b", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
      </div>
    )
  }

  function getOverride(campaignId) {
    return overrides.find(o => o.id === campaignId) || null
  }

  function getStatus(campaignId) {
    const ov = getOverride(campaignId)
    if (!ov || ov.active === false) return 'inactive'
    // Modo instant: active + sin fechas
    if (!ov.start_date && !ov.end_date) return 'active'
    const today = new Date().toISOString().slice(0, 10)
    if (ov.start_date && ov.end_date) {
      if (today >= ov.start_date && today <= ov.end_date) return 'active'
      if (today < ov.start_date) return 'scheduled'
    }
    return 'inactive'
  }

  // Find which campaign is currently active (if any), excluding a given id
  function findActiveCampaignId(excludeId) {
    const today = new Date().toISOString().slice(0, 10)
    for (const c of CAMPAIGN_CATALOG) {
      if (c.id === excludeId) continue
      const ov = getOverride(c.id)
      if (!ov || ov.active === false) continue
      // Instant mode
      if (!ov.start_date && !ov.end_date) return c.id
      // Date mode
      if (ov.start_date && ov.end_date && today >= ov.start_date && today <= ov.end_date) return c.id
    }
    return null
  }

  // Check if dates overlap with another campaign's dates
  function findDateConflict(campaignId, startDate, endDate) {
    if (!startDate || !endDate) return null
    for (const c of CAMPAIGN_CATALOG) {
      if (c.id === campaignId) continue
      const ov = getOverride(c.id)
      if (!ov || ov.active === false) continue
      // Conflict with instant-mode campaign (always active)
      if (!ov.start_date && !ov.end_date) return c.id
      // Conflict with date-range campaign
      if (ov.start_date && ov.end_date) {
        if (startDate <= ov.end_date && endDate >= ov.start_date) return c.id
      }
    }
    return null
  }

  function getCampaignName(id) {
    return CAMPAIGN_CATALOG.find(c => c.id === id)?.name || id
  }

  function startEdit(campaign) {
    const ov = getOverride(campaign.id)
    setEditingId(campaign.id)
    setEditDraft({
      active: ov?.active ?? true,
      start_date: ov?.start_date || '',
      end_date: ov?.end_date || '',
    })
    setConfirm(null)
  }

  // ── Activar ahora (instant mode) ──
  function handleActivateNow(campaignId) {
    const conflictId = findActiveCampaignId(campaignId)
    if (conflictId) {
      setConfirm({
        type: 'activate_now',
        campaignId,
        conflictId,
        conflictName: getCampaignName(conflictId),
      })
    } else {
      doActivateNow(campaignId, null)
    }
  }

  async function doActivateNow(campaignId, deactivateId) {
    setSaving(true)
    if (deactivateId) {
      await onSaveOverride(deactivateId, { active: false, start_date: '', end_date: '' })
    }
    await onSaveOverride(campaignId, { active: true, start_date: '', end_date: '' })
    setSaving(false)
    setConfirm(null)
  }

  // ── Desactivar ──
  async function handleDeactivate(campaignId) {
    setSaving(true)
    await onSaveOverride(campaignId, { active: false, start_date: '', end_date: '' })
    setSaving(false)
  }

  // ── Guardar con fechas (desde editor) ──
  function handleSave(campaignId) {
    // If activating with dates, check for conflicts
    if (editDraft.active && editDraft.start_date && editDraft.end_date) {
      const conflictId = findDateConflict(campaignId, editDraft.start_date, editDraft.end_date)
      if (conflictId) {
        const ov = getOverride(conflictId)
        const conflictDates = (ov?.start_date && ov?.end_date)
          ? ` (${ov.start_date} → ${ov.end_date})`
          : ' (activa sin fechas)'
        setConfirm({
          type: 'save_with_conflict',
          campaignId,
          conflictId,
          conflictName: getCampaignName(conflictId) + conflictDates,
        })
        return
      }
    }
    doSave(campaignId, null)
  }

  async function doSave(campaignId, deactivateId) {
    setSaving(true)
    if (deactivateId) {
      await onSaveOverride(deactivateId, { active: false, start_date: '', end_date: '' })
    }
    await onSaveOverride(campaignId, editDraft)
    setSaving(false)
    setEditingId(null)
    setConfirm(null)
  }

  const statusConfig = {
    active: { label: 'Activa', color: '#34c759', bg: 'rgba(52,199,89,0.12)', emoji: '🟢' },
    scheduled: { label: 'Programada', color: '#ffd60a', bg: 'rgba(255,214,10,0.1)', emoji: '⏳' },
    inactive: { label: 'Inactiva', color: 'rgba(255,255,255,0.35)', bg: 'rgba(255,255,255,0.05)', emoji: '⚪' },
  }

  return (
    <div style={{ padding: "0 20px 40px" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 16px" }}>
        <span style={{ fontSize: 18 }}>⚡</span>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 400, fontFamily: "'Archivo Black',sans-serif", color: "#ff3b3b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Admin — Campañas
        </p>
      </div>

      {CAMPAIGN_CATALOG.map(campaign => {
        const status = getStatus(campaign.id)
        const sc = statusConfig[status]
        const isEditing = editingId === campaign.id
        const isActive = status === 'active'
        const ov = getOverride(campaign.id)
        const isInstant = isActive && (!ov?.start_date && !ov?.end_date)

        return (
          <div key={campaign.id} style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${isActive ? 'rgba(52,199,89,0.2)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 18,
            padding: 16,
            marginBottom: 12,
            transition: "all 0.2s",
          }}>
            {/* Top row: brand info + status */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Brand emoji circle */}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `rgba(${campaign.color === '#d4a748' ? '212,167,72' : '255,140,0'},0.12)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0,
              }}>
                {campaign.emoji}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>{campaign.name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: sc.color,
                    background: sc.bg,
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}>
                    {sc.emoji} {sc.label}{isInstant ? ' (manual)' : ''}
                  </span>
                  {ov?.start_date && ov?.end_date && (
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                      {ov.start_date} → {ov.end_date}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick action buttons (when NOT editing) */}
            {!isEditing && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {isActive ? (
                  <button onClick={() => handleDeactivate(campaign.id)} disabled={saving} style={{
                    flex: 1, padding: "9px 14px", borderRadius: 10,
                    background: "rgba(255,59,48,0.1)",
                    border: "1px solid rgba(255,59,48,0.25)",
                    color: "#ff3b3b",
                    fontSize: 12, fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: saving ? 0.5 : 1,
                  }}>
                    Desactivar
                  </button>
                ) : (
                  <button onClick={() => handleActivateNow(campaign.id)} disabled={saving} style={{
                    flex: 1, padding: "9px 14px", borderRadius: 10,
                    background: "rgba(52,199,89,0.12)",
                    border: "1px solid rgba(52,199,89,0.25)",
                    color: "#34c759",
                    fontSize: 12, fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: saving ? 0.5 : 1,
                  }}>
                    Activar ahora
                  </button>
                )}
                <button onClick={() => startEdit(campaign)} style={{
                  padding: "9px 14px", borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  Programar
                </button>
              </div>
            )}

            {/* Conflict confirmation (inline) */}
            {confirm && (confirm.campaignId === campaign.id || confirm.type === 'activate_now' && confirm.campaignId === campaign.id) && (
              <div style={{
                marginTop: 12, padding: "12px 14px", borderRadius: 12,
                background: "rgba(255,165,0,0.08)",
                border: "1px solid rgba(255,165,0,0.25)",
                animation: "fadeIn 0.2s ease",
              }}>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
                  ⚠️ <strong style={{ color: "#ffb347" }}>{confirm.conflictName}</strong> está activa. ¿Desactivarla y activar <strong style={{ color: "#fff" }}>{getCampaignName(campaign.id)}</strong>?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setConfirm(null)} style={{
                    flex: 1, padding: "9px 12px", borderRadius: 10,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    Cancelar
                  </button>
                  <button onClick={() => {
                    if (confirm.type === 'activate_now') {
                      doActivateNow(confirm.campaignId, confirm.conflictId)
                    } else {
                      doSave(confirm.campaignId, confirm.conflictId)
                    }
                  }} disabled={saving} style={{
                    flex: 2, padding: "9px 12px", borderRadius: 10,
                    background: "#ff8c00",
                    border: "none",
                    color: "#000",
                    fontSize: 12, fontWeight: 800,
                    cursor: saving ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: saving ? 0.5 : 1,
                  }}>
                    {saving ? "Cambiando..." : "Sí, cambiar"}
                  </button>
                </div>
              </div>
            )}

            {/* Edit panel (scheduled mode with dates) */}
            {isEditing && (
              <div style={{ marginTop: 16, animation: "fadeIn 0.3s ease" }}>
                {/* Active toggle */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  marginBottom: 10,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>Campaña activa</span>
                  <button onClick={() => setEditDraft(d => ({ ...d, active: !d.active }))} style={{
                    width: 48, height: 28, borderRadius: 14,
                    background: editDraft.active ? "#34c759" : "rgba(255,255,255,0.12)",
                    border: "none", cursor: "pointer",
                    position: "relative", transition: "background 0.2s",
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: "#fff",
                      position: "absolute", top: 3,
                      left: editDraft.active ? 23 : 3,
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }} />
                  </button>
                </div>

                {/* Date inputs */}
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                      Inicio
                    </label>
                    <input
                      type="date"
                      value={editDraft.start_date}
                      onChange={e => setEditDraft(d => ({ ...d, start_date: e.target.value }))}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 10,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff", fontSize: 13, fontFamily: "inherit",
                        boxSizing: "border-box",
                        colorScheme: "dark",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>
                      Fin
                    </label>
                    <input
                      type="date"
                      value={editDraft.end_date}
                      onChange={e => setEditDraft(d => ({ ...d, end_date: e.target.value }))}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 10,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff", fontSize: 13, fontFamily: "inherit",
                        boxSizing: "border-box",
                        colorScheme: "dark",
                      }}
                    />
                  </div>
                </div>

                <p style={{ margin: "0 0 12px", fontSize: 10, color: "rgba(255,255,255,0.2)", lineHeight: 1.4 }}>
                  💡 Deja las fechas vacías + activa para modo manual (sin límite de tiempo)
                </p>

                {/* Save / Cancel */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setEditingId(null); setConfirm(null) }} style={{
                    flex: 1, padding: "11px 16px", borderRadius: 10,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    Cancelar
                  </button>
                  <button onClick={() => handleSave(campaign.id)} disabled={saving} style={{
                    flex: 2, padding: "11px 16px", borderRadius: 10,
                    background: "#ff3b3b",
                    border: "none",
                    color: "#000",
                    fontSize: 13, fontWeight: 800,
                    cursor: saving ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    opacity: saving ? 0.5 : 1,
                  }}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </div>

                {/* Conflict warning for save (shows below buttons) */}
                {confirm && confirm.type === 'save_with_conflict' && confirm.campaignId === campaign.id && (
                  <div style={{
                    marginTop: 10, padding: "12px 14px", borderRadius: 12,
                    background: "rgba(255,165,0,0.08)",
                    border: "1px solid rgba(255,165,0,0.25)",
                    animation: "fadeIn 0.2s ease",
                  }}>
                    <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
                      ⚠️ Las fechas solapan con <strong style={{ color: "#ffb347" }}>{confirm.conflictName}</strong>. ¿Desactivarla y continuar?
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirm(null)} style={{
                        flex: 1, padding: "9px 12px", borderRadius: 10,
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
                        No
                      </button>
                      <button onClick={() => doSave(confirm.campaignId, confirm.conflictId)} disabled={saving} style={{
                        flex: 2, padding: "9px 12px", borderRadius: 10,
                        background: "#ff8c00",
                        border: "none",
                        color: "#000",
                        fontSize: 12, fontWeight: 800,
                        cursor: saving ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        opacity: saving ? 0.5 : 1,
                      }}>
                        {saving ? "Guardando..." : "Sí, desactivar y guardar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
