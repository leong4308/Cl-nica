const escapar = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c])
export function configuracionCorreo(env = process.env) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !env.APP_URL) return null
  try {
    const url = new URL(env.APP_URL)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) return null
    if (url.username || url.password || url.search || url.hash || /[\r\n]/.test(env.EMAIL_FROM) || !/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/.test(env.EMAIL_FROM)) return null
    return { clave: env.RESEND_API_KEY, remitente: env.EMAIL_FROM, appUrl: url.origin }
  } catch { return null }
}
function marco(titulo, contenido, enlace, boton) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f3f6fb;font-family:Arial,sans-serif;color:#17324f"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:560px;background:white;border:1px solid #e1e8f2;border-radius:18px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 28px 20px;border-bottom:1px solid #eaf0f8"><span style="font-size:20px;font-weight:bold;color:#1555e8">Clínica Nova</span><p style="margin:8px 0 0;color:#6b7e96;font-size:13px">Tu atención, cerca de ti</p></td></tr><tr><td style="padding:28px"><h1 style="font-size:23px;line-height:1.3;margin:0 0 20px">${escapar(titulo)}</h1>${contenido}<p style="margin:28px 0"><a href="${escapar(enlace)}" style="display:inline-block;background:#1555e8;color:white;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px">${escapar(boton)}</a></p><p style="font-size:12px;line-height:1.6;color:#71839a">Este correo es automático. Para ayuda con tu atención, comunícate con recepción.</p></td></tr></table></td></tr></table></body></html>`
}
export function correoInvitacion(nombre, enlace) {
  const texto = `Hola, ${nombre}.\n\nLa clínica te invita a activar tu portal de paciente. Elige tu propia contraseña para consultar tus citas y resultados.\n\n${enlace}\n\nEl enlace vence en 24 horas y solo puede usarse una vez. Si no esperabas esta invitación, puedes ignorarla.\n\nClínica Nova`
  return { subject:'Activa tu portal de paciente · Clínica Nova', text:texto, html:marco('Tu portal de paciente está listo',`<p style="line-height:1.7">Hola, <strong>${escapar(nombre)}</strong>.</p><p style="line-height:1.7">Te invitamos a consultar tus citas y resultados desde tu cuenta personal. Para comenzar, elige tu propia contraseña.</p><p style="font-size:13px;line-height:1.7;color:#61758e">El enlace vence en 24 horas y solo puede usarse una vez. Si no esperabas esta invitación, puedes ignorarla.</p>`,enlace,'Activar mi cuenta') }
}
export function correoCambioAcceso(nombre, correo, enlace) {
  return { subject:'Confirma tu nuevo correo de acceso · Clínica Nova',text:`Hola, ${nombre}.\n\nLa clínica solicitó usar ${correo} como tu correo de acceso. Confírmalo desde este enlace:\n\n${enlace}\n\nEl enlace vence en 24 horas. Hasta que lo confirmes, tu correo actual y tu contraseña se conservan. Si no solicitaste el cambio, no confirmes el enlace y comunícate con recepción.`,html:marco('Confirma tu nuevo correo',`<p style="line-height:1.7">Hola, <strong>${escapar(nombre)}</strong>.</p><p style="line-height:1.7">La clínica solicitó actualizar tu correo de acceso a:</p><p style="padding:16px;background:#eef4ff;border-radius:10px;color:#1555e8;word-break:break-all">${escapar(correo)}</p><p style="line-height:1.7">Confirma que esta dirección te pertenece. Tu contraseña y tus datos clínicos se conservarán.</p><p style="font-size:13px;line-height:1.7;color:#61758e">El enlace vence en 24 horas. Hasta que lo confirmes, podrás seguir entrando con tu correo actual. Si no solicitaste el cambio, no confirmes el enlace y comunícate con recepción.</p>`,enlace,'Confirmar mi nuevo correo') }
}
export function correoCita(envio, appUrl) {
  const c=envio.cita
  const fecha=new Date(c.inicio).toLocaleDateString('es-MX',{timeZone:'America/Mexico_City',weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const hora=d=>new Date(d).toLocaleTimeString('es-MX',{timeZone:'America/Mexico_City',hour:'2-digit',minute:'2-digit',hour12:true})
  const horario=`${hora(c.inicio)} – ${hora(c.fin)}`
  const estado=({pendiente:'Pendiente de confirmar',confirmada:'Confirmada',cancelada_paciente:'Cancelada',cancelada_medico:'Cancelada',atendida:'Atendida',no_asistio:'Inasistencia registrada'})[c.estado]??'Actualizada'
  const recordatorio=envio.tipo.startsWith('recordatorio_')
  const titulo=recordatorio?'Se acerca tu cita':envio.titulo
  const filas=[['Médico',c.medico],['Clínica',c.clinica],['Dirección',c.direccion||'Consulta la ubicación con recepción'],['Estado',estado],['Referencia',`Cita #${c.id}`]]
  if(c.consultorio)filas.splice(2,0,['Consultorio',c.consultorio])
  const contenido=`<p style="line-height:1.7">Hola, <strong>${escapar(c.paciente)}</strong>.</p><div style="padding:20px;background:#eef4ff;border-radius:12px;margin:20px 0"><p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#1555e8">${escapar(fecha)}</p><p style="margin:0;font-size:26px;font-weight:bold;color:#17324f">${escapar(horario)}</p><p style="margin:8px 0 0;font-size:12px;color:#61758e">Hora de Ciudad de México</p></div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas.map(([k,v])=>`<tr><td style="padding:9px 12px 9px 0;color:#61758e;font-size:13px;vertical-align:top">${escapar(k)}</td><td style="padding:9px 0;font-size:14px;line-height:1.5">${escapar(v)}</td></tr>`).join('')}</table><p style="font-size:13px;line-height:1.7;color:#61758e">Confirma tu asistencia o revisa tus opciones en la aplicación. Los cambios de horario requieren más de dos horas de anticipación. Puedes desactivar los avisos por correo desde Notificaciones.</p>`
  return { subject:`${titulo} · Clínica Nova`,text:`${titulo}\n\nHola, ${c.paciente}.\n${fecha}\n${horario} (hora de Ciudad de México)\n\n${filas.map(([k,v])=>`${k}: ${v}`).join('\n')}\n\nRevisa tus citas: ${appUrl}\nPuedes desactivar los avisos por correo desde Notificaciones.`,html:marco(titulo,contenido,appUrl,'Consultar mis citas') }
}
export function correoAviso(envio, appUrl) {
  if (envio.cita) return correoCita(envio, appUrl)
  return { subject: `${envio.titulo} · Clínica Nova`, text: `${envio.titulo}\n\n${envio.mensaje}\n\nRevisa tu cuenta: ${appUrl}\nPuedes desactivar los avisos desde Notificaciones.`, html: marco(envio.titulo, `<p style="line-height:1.8;white-space:pre-wrap">${escapar(envio.mensaje)}</p>`, appUrl, 'Abrir mi cuenta') }
}
export async function enviarCorreo(config, destino, contenido, clave, fetcher=fetch) {
  let r
  try { r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.clave}`,'Content-Type':'application/json','Idempotency-Key':clave},body:JSON.stringify({from:config.remitente,to:[destino],...contenido}),signal:AbortSignal.timeout(20000)}) }
  catch { throw Object.assign(Error('No se pudo contactar al servicio de correo.'),{codigo:'RED',permanente:false}) }
  if(!r.ok) throw Object.assign(Error('El proveedor no aceptó el correo.'),{codigo:`HTTP_${r.status}`,permanente:[400,401,403,404,409,422].includes(r.status),espera:Math.min(3600,Math.max(60,Number(r.headers?.get('retry-after'))||60))})
  let b
  try { b=await r.json() } catch { throw Object.assign(Error('No se pudo comprobar el envío.'),{codigo:'RESPUESTA',permanente:false}) }
  if(typeof b.id!=='string')throw Object.assign(Error('No se pudo comprobar el envío.'),{codigo:'RESPUESTA',permanente:false})
  return b.id
}
export async function entregarCorreos(db, config, fetcher=fetch) {
  if(!config)return 0
  const pendientes=await db.correo('reclamar');let enviados=0
  for(const e of pendientes){
    const datos={id:e.id,arrendamiento:e.arrendamiento}
    const vigente=await db.correo('vigente',datos)
    if(!vigente){await db.correo('omitir',datos);continue}
    try { const id=await enviarCorreo(config,vigente.correo,correoAviso(vigente,config.appUrl),`clinica-cita-${e.id}`,fetcher);await db.correo('enviado',{...datos,proveedorId:id});enviados++ }
    catch(error){await db.correo('error',{...datos,codigo:error.codigo??'OPERACION',permanente:error.permanente??false,espera:error.espera??60})}
  }
  return enviados
}
