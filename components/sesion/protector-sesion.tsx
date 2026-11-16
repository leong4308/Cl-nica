'use client'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cerrarSesion, esSalidaExplicita } from '@/lib/supabase/sesion'

const INACTIVIDAD=15*60*1000
type Estado={id:string;bloqueada:boolean;ultimaActividad:string;servidorAhora:string;usuarioId:string;correo:string;nombre:string}
export function ProtectorSesion({children}:{children:ReactNode}) {
 const ruta=usePathname(),[listo,setListo]=useState(false),[bloqueada,setBloqueada]=useState(false),[motivo,setMotivo]=useState<'inactividad'|'acceso'>('inactividad')
 const [cuenta,setCuenta]=useState<Estado|null>(null),[clave,setClave]=useState(''),[error,setError]=useState(''),[aviso,setAviso]=useState(''),[ocupado,setOcupado]=useState(false)
 const estadoRef=useRef<Estado|null>(null),bloqueoRef=useRef(false),ultima=useRef(Date.now()),revision=useRef(0),montado=useRef(true),ultimoEnvio=useRef(0),ultimaRevision=useRef(0),vencimiento=useRef(0),avisado=useRef(0)
 const establecerBloqueo=useCallback((valor:boolean)=>{bloqueoRef.current=valor;setBloqueada(valor)},[])
 const comprobar=useCallback(async(accion?:'actividad'|'bloquear')=>{
  const actual=++revision.current
  try {
   const sesion=(await createClient().auth.getSession()).data.session
   if(!sesion){if(estadoRef.current&&!esSalidaExplicita()){setMotivo('acceso');establecerBloqueo(true)}if(montado.current)setListo(true);return}
   vencimiento.current=(sesion.expires_at??0)*1000
   const r=await fetch('/api/sesion',accion?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accion})}:{cache:'no-store'}),b=await r.json()
   if(!r.ok)throw Error(b.error||'No se pudo verificar tu acceso.')
   if(!montado.current||actual!==revision.current)return
   if(typeof b.usuarioId!=='string'||typeof b.bloqueada!=='boolean'||!Number.isFinite(Date.parse(b.ultimaActividad)))throw Error('No se pudo verificar el estado de la sesión.')
   if(estadoRef.current&&estadoRef.current.usuarioId!==b.usuarioId){window.location.replace('/');return}
   const antes=bloqueoRef.current,desfase=Date.parse(b.servidorAhora)-Date.now()
   ultima.current=estadoRef.current?Math.max(ultima.current,Date.parse(b.ultimaActividad)-desfase):Date.parse(b.ultimaActividad)-desfase
   estadoRef.current=b;setCuenta(b);setMotivo('inactividad');establecerBloqueo(b.bloqueada);setListo(true);setError('')
   if(antes&&!b.bloqueada){window.dispatchEvent(new Event('datos-actualizados'));window.dispatchEvent(new Event('cuenta-actualizada'))}
  }catch(e){if(montado.current&&actual===revision.current){setError(e instanceof Error?e.message:'No se pudo conectar.');if(estadoRef.current)setAviso('No se pudo comprobar tu sesión. Revisa la conexión o renueva el acceso.')}}
 },[establecerBloqueo])
 useEffect(()=>{
  if(ruta!=='/')return
  montado.current=true;void comprobar()
  const bloquear=()=>{if(!estadoRef.current||bloqueoRef.current)return;setMotivo('inactividad');establecerBloqueo(true);setAviso('');void comprobar('bloquear')}
  const actividad=()=>{
   if(!estadoRef.current||bloqueoRef.current||document.hidden)return
   if(Date.now()-ultima.current>=INACTIVIDAD){bloquear();return}
   ultima.current=Date.now()
   if(Date.now()-ultimoEnvio.current>30_000){ultimoEnvio.current=Date.now();try{localStorage.setItem('clinica-actividad',String(ultima.current))}catch{};void comprobar('actividad')}
  }
  const sincronizar=(e:StorageEvent)=>{if(e.key==='clinica-actividad'&&estadoRef.current&&!bloqueoRef.current){const t=Number(e.newValue);if(t>ultima.current&&t<=Date.now())ultima.current=t}}
  const foco=()=>{if(estadoRef.current)void comprobar()}
  const acceso=()=>{if(estadoRef.current){setMotivo('acceso');establecerBloqueo(true)}}
  const {data:{subscription}}=createClient().auth.onAuthStateChange((evento)=>{
   if(evento==='TOKEN_REFRESHED'&&estadoRef.current&&!bloqueoRef.current){avisado.current=vencimiento.current;setAviso('Tu sesión se renovó sin salir de la aplicación. Puedes continuar o renovarla ahora.')}
   if(evento==='SIGNED_OUT'&&estadoRef.current&&!esSalidaExplicita()){acceso();return}
   if(evento==='SIGNED_IN'||evento==='TOKEN_REFRESHED'||evento==='USER_UPDATED')setTimeout(()=>{if(montado.current)void comprobar()},0)
  })
  const timer=window.setInterval(()=>{
   if(!estadoRef.current||bloqueoRef.current)return
   if(Date.now()-ultima.current>=INACTIVIDAD){bloquear();return}
   if(vencimiento.current&&Date.now()>=vencimiento.current-60_000&&avisado.current!==vencimiento.current){avisado.current=vencimiento.current;setAviso('Es momento de renovar tu acceso. Puedes hacerlo sin cerrar la aplicación.')}
   if(!document.hidden&&Date.now()-ultimaRevision.current>60_000){ultimaRevision.current=Date.now();void comprobar()}
  },1000)
  for(const e of ['pointerdown','pointermove','keydown','wheel','touchstart'])window.addEventListener(e,actividad,{passive:true})
  window.addEventListener('storage',sincronizar);window.addEventListener('focus',foco);window.addEventListener('sesion-requiere-acceso',acceso)
  return()=>{montado.current=false;++revision.current;subscription.unsubscribe();window.clearInterval(timer);for(const e of ['pointerdown','pointermove','keydown','wheel','touchstart'])window.removeEventListener(e,actividad);window.removeEventListener('storage',sincronizar);window.removeEventListener('focus',foco);window.removeEventListener('sesion-requiere-acceso',acceso)}
 },[ruta,comprobar,establecerBloqueo])
 async function renovar(){setOcupado(true);try{const r=await createClient().auth.refreshSession();if(r.error)throw Error('No se pudo renovar tu acceso. Verifica tu conexión o tu contraseña.');await comprobar();setAviso('Tu sesión está renovada. Puedes continuar en la aplicación.')}catch(e){setAviso(e instanceof Error?e.message:'No se pudo renovar el acceso.')}finally{setOcupado(false)}}
 async function desbloquear(e:React.FormEvent){e.preventDefault();if(!cuenta)return;setOcupado(true);setError('');try{const r=await createClient().auth.signInWithPassword({email:cuenta.correo,password:clave});if(r.error)throw Error('No se pudo verificar la contraseña. Inténtalo de nuevo.');if(r.data.user.id!==cuenta.usuarioId){await cerrarSesion();window.location.replace('/');return}setClave('');await comprobar()}catch(e){setError(e instanceof Error?e.message:'No se pudo verificar tu acceso.')}finally{setOcupado(false)}}
 if(ruta!=='/')return children
 if(!listo)return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="max-w-md text-center"><ShieldCheck className="mx-auto text-blue-700" size={30}/><p className="mt-4 text-sm text-slate-600">{error||'Verificando tu acceso...'}</p>{error&&<button type="button" className="mt-4 text-sm font-semibold text-blue-700" onClick={()=>{void comprobar()}}>Volver a comprobar</button>}</div></main>
 return <><div inert={bloqueada} aria-hidden={bloqueada||undefined} className={bloqueada?'invisible pointer-events-none select-none':''}>{children}</div>
  {aviso&&!bloqueada&&<aside role="status" aria-live="polite" className="fixed bottom-5 left-5 right-5 z-[90] mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-white p-4 text-sm text-slate-700 shadow-lg"><ShieldCheck className="shrink-0 text-blue-700" size={21}/><p className="min-w-0 flex-1">{aviso}</p><button type="button" disabled={ocupado} onClick={()=>{void renovar()}} className="rounded-xl bg-blue-700 px-4 py-2 font-medium text-white">{ocupado?'Renovando...':'Renovar sesión'}</button><button type="button" onClick={()=>setAviso('')} className="px-2 py-2 text-xs text-slate-500">Entendido</button></aside>}
  {bloqueada&&<main role="dialog" aria-modal="true" aria-labelledby="titulo-bloqueo" className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto bg-[#102a46] p-5"><section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9"><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-700">Clínica Nova</p><span className="mt-7 inline-flex rounded-2xl bg-blue-50 p-4 text-blue-700"><LockKeyhole size={26}/></span><h2 id="titulo-bloqueo" className="mt-5 text-2xl font-semibold text-slate-900">{motivo==='inactividad'?'Sesión bloqueada':'Verifica tu acceso'}</h2><p className="mt-3 text-sm leading-relaxed text-slate-500">{motivo==='inactividad'?'Han pasado 15 minutos sin actividad. Verifica tu contraseña para continuar de forma segura.':'Tu acceso necesita verificarse. La aplicación conserva tu trabajo mientras vuelves a identificarte.'}</p><form onSubmit={desbloquear} className="mt-6 space-y-4"><label className="block text-sm font-medium text-slate-700">Cuenta<input type="email" value={cuenta?.correo??''} readOnly autoComplete="username" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500"/></label><label className="block text-sm font-medium text-slate-700">Contraseña<input type="password" autoFocus required autoComplete="current-password" value={clave} onChange={e=>setClave(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm"/></label>{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}<button type="submit" disabled={ocupado} className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{ocupado?'Verificando...':'Desbloquear y continuar'}</button><button type="button" disabled={ocupado} onClick={()=>{void cerrarSesion().then(()=>window.location.replace('/')).catch(()=>setError('No se pudo cerrar la sesión. Inténtalo de nuevo.'))}} className="w-full px-4 py-2 text-sm text-slate-500">Cerrar sesión</button></form></section></main>}
 </>
}
