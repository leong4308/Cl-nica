'use client'
import { CampoTelefono } from '../../compartidos/campo-telefono'
import { EstadoSistema } from './estado-sistema'

import { useEffect, useState } from 'react'
import { Download, KeyRound, LifeBuoy, Loader2, RefreshCw, Settings, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { ModalMarco } from '../../compartidos/modal-marco'
import { AvisoClinico, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO_CLINICO, DatoClinico, ETIQUETA_CLINICA, PanelClinico } from '../../compartidos/editor-clinico'
import { createClient } from '@/lib/supabase/client'
import { ETIQUETA_ROL, type RolUsuario } from '@/lib/supabase/tipos-rol'
import { aplicarPreferencias, opcionesInicio, type PreferenciasUsuario } from '@/lib/cuenta/preferencias'
import type { DatosPersonalesPaciente } from '@/lib/cuenta/validacion'
import type { SeccionCuenta } from '@/lib/cuenta/menu'

type Cuenta = { paciente?: DatosPersonalesPaciente | null; nombre: string; correo: string; telefono: string; rol: RolUsuario; especialidad: string | null; creado: string; preferencias: PreferenciasUsuario; sesion: { jwtVerificado: boolean; expira: number | null }; soporte?: { nombre: string; telefono?: string; correo_contacto?: string } | null }
const SECCIONES = [
  { id: 'Perfil', titulo: 'Mi perfil', icon: UserRound },
  { id: 'Configuración', titulo: 'Configuración', icon: Settings },
  { id: 'Cambiar contraseña', titulo: 'Cambiar contraseña', icon: KeyRound },
  { id: 'Preferencias', titulo: 'Preferencias', icon: SlidersHorizontal },
  { id: 'Ayuda', titulo: 'Ayuda y soporte', icon: LifeBuoy },
] as const
const PREGUNTAS = [
  ['¿Cómo edito un paciente?', 'En Pacientes, pulsa el lápiz de la fila. También puedes abrir su ficha y elegir “Editar información”. Guarda los cambios antes de cerrar.'],
  ['¿Qué PDF puedo adjuntar?', 'Expedientes y órdenes médicas permiten PDF de hasta 2 MB por archivo. Laboratorio permite un PDF de hasta 10 MB por estudio. En pacientes no se adjuntan PDF.'],
  ['¿Se conserva la sesión al recargar?', 'Sí. La sesión se restaura al abrir la página y se renueva mientras sea válida. Usa “Cerrar sesión” para salir de este navegador.'],
  ['¿Cómo cambio mi contraseña?', 'Abre “Cambiar contraseña”, escribe la contraseña actual y confirma una nueva. Si tu cuenta requiere verificación adicional, solicita e introduce el código.'],
  ['¿Por qué no veo una opción?', 'Los módulos y las acciones dependen de tu rol. Si necesitas otro permiso, comunícate con el administrador de la clínica.'],
]

const PREGUNTAS_PACIENTE = [
  ['¿Dónde veo mi próxima cita?', 'En Mi inicio aparece tu próxima cita. En Mis citas puedes revisar tus visitas y sus detalles.'],
  ['¿Cómo confirmo, cambio o cancelo una cita?', 'Abre Mis citas y sus detalles. Pulsa Sí asistiré para confirmar o Cancelar mi cita y confirma la cancelación. En Ver horarios libres, elige un día y toca un turno para reagendar y confirmar tu asistencia. También puedes escribir /citas al bot de Telegram. Solo puedes reagendar si faltan más de dos horas para tu cita actual; después puedes confirmar asistencia o cancelar.'],
  ['¿Dónde consulto mis resultados?', 'Abre Mis resultados. Los estudios terminados aparecen como disponibles; puedes consultar el resultado y su PDF cuando exista.'],
  ['¿Cómo activo los recordatorios?', 'Abre la campana para activar el sonido y vincular tu Telegram. Inicia el bot y regresa al portal para confirmar tu cuenta.'],
  ['¿Cómo actualizo mis datos?', 'Abre Mis datos → Editar mis datos para actualizar tu nombre, teléfono, nacimiento, género y contacto de emergencia. Para cambiar el correo de acceso o corregir información clínica, contacta con recepción.'],
  ['¿Cómo cambio mi contraseña?', 'Abre Cambiar contraseña desde el menú de tu cuenta y sigue las indicaciones.'],
]
export function ModalCuenta({ inicial, onClose }: { inicial: SeccionCuenta; onClose: () => void }) {
  const [seccion, setSeccion] = useState<SeccionCuenta>(inicial)
  const [cuenta, setCuenta] = useState<Cuenta | null>(null)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [paciente, setPaciente] = useState<DatosPersonalesPaciente | null>(null)
  const [conflictoPerfil, setConflictoPerfil] = useState(false)
  const [preferencias, setPreferencias] = useState<PreferenciasUsuario | null>(null)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [codigo, setCodigo] = useState('')
  const [requiereCodigo, setRequiereCodigo] = useState(false)
  const [mostrarClaves, setMostrarClaves] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [incidencia, setIncidencia] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/cuenta', { signal: controller.signal }).then(async (res) => { const datos = await res.json(); if (!res.ok) throw Error(datos.error); return datos.cuenta as Cuenta })
      .then((datos) => { setCuenta(datos); setNombre(datos.nombre); setTelefono(datos.telefono); setPreferencias(datos.preferencias); setPaciente(datos.paciente ?? null); setConflictoPerfil(false); setError(null); setErrorCarga(null) })
      .catch((err) => { if (!controller.signal.aborted) setErrorCarga(err.message || 'No se pudo cargar tu cuenta.') })
    return () => controller.abort()
  }, [revision])
  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (guardando || !cuenta) return
    setError(null); setMensaje('')
    if (seccion === 'Cambiar contraseña' && (nueva !== confirmacion || nueva.length < 8 || nueva === actual)) { setError('La nueva contraseña debe tener al menos 8 caracteres, ser diferente y coincidir con la confirmación.'); return }
    setGuardando(true)
    try {
      const contrasena = seccion === 'Cambiar contraseña'
      const cuerpo = contrasena ? { actual, nueva, confirmacion, codigo } : seccion === 'Perfil' ? { accion: 'perfil', nombre, telefono, ...(cuenta.rol === 'paciente' ? paciente : {}) } : { accion: 'preferencias', preferencias }
      const res = await fetch(contrasena ? '/api/cuenta/contrasena' : '/api/cuenta', { method: contrasena ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      const datos = await res.json()
      if (!res.ok) { if (seccion === 'Perfil' && res.status === 409) setConflictoPerfil(true); if (datos.requiereCodigo) setRequiereCodigo(true); throw Error(datos.error || 'No se pudo guardar.') }
      if (contrasena) { setActual(''); setNueva(''); setConfirmacion(''); setCodigo(''); setRequiereCodigo(false); setMensaje('Contraseña actualizada correctamente.') }
      else {
        if (seccion === 'Perfil') { setCuenta(prev => prev ? { ...prev, nombre: datos.nombre ?? nombre.trim(), telefono: datos.telefono ?? telefono.trim(), paciente: datos.paciente ?? prev.paciente } : prev); if (datos.paciente) setPaciente(datos.paciente); setConflictoPerfil(false) }
        if (seccion === 'Preferencias' && datos.preferencias) { aplicarPreferencias(datos.preferencias); setCuenta((prev) => prev ? { ...prev, preferencias: datos.preferencias } : prev) }
        setMensaje(seccion === 'Perfil' ? 'Tu perfil se actualizó correctamente.' : 'Tus preferencias se guardaron.')
        window.dispatchEvent(new Event('cuenta-actualizada'))
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.') }
    finally { setGuardando(false) }
  }
  async function accionSesion(accion: 'renovar' | 'otras' | 'codigo') {
    if (guardando) return
    setGuardando(true); setError(null); setMensaje('')
    try {
      const auth = createClient().auth
      const { error } = accion === 'renovar' ? await auth.refreshSession() : accion === 'otras' ? await auth.signOut({ scope: 'others' }) : await auth.reauthenticate()
      if (error) throw Error('No se pudo completar la solicitud. Inténtalo de nuevo.')
      if (accion === 'renovar') setRevision((v) => v + 1)
      setMensaje(accion === 'renovar' ? 'Tu sesión se renovó correctamente.' : accion === 'otras' ? 'Se cerraron las otras sesiones de tu cuenta.' : 'Revisa tu correo e introduce el código de verificación.')
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo completar la solicitud.') }
    finally { setGuardando(false) }
  }
  function descargarReporte() {
    const texto = `Clínica Nova · Reporte de soporte\nFecha: ${new Date().toISOString()}\nNavegador: ${navigator.userAgent}\nPantalla: ${window.innerWidth} × ${window.innerHeight}\n\nDescripción:\n${incidencia.trim()}\n`
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }))
    const enlace = document.createElement('a'); enlace.href = url; enlace.download = 'clinica-nova-soporte.txt'; enlace.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const titulo = SECCIONES.find((s) => s.id === seccion)?.titulo ?? 'Mi cuenta'
  const conFormulario = ['Perfil', 'Preferencias', 'Cambiar contraseña'].includes(seccion)
  return <ModalMarco title={titulo} ancho="max-w-5xl" contenidoFijo onClose={() => { if (!guardando) onClose() }} footer={<div className="flex flex-wrap items-center justify-between gap-3"><button type="button" className={BOTON_SECUNDARIO} onClick={onClose} disabled={guardando}>Cerrar</button>{conFormulario && <button type="submit" form="form-cuenta" className={BOTON_PRIMARIO} disabled={guardando || !cuenta || Boolean(errorCarga)}>{guardando && <Loader2 size={16} className="animate-spin" />}{guardando ? 'Guardando...' : seccion === 'Perfil' ? 'Guardar perfil' : seccion === 'Preferencias' ? 'Guardar preferencias' : 'Actualizar contraseña'}</button>}</div>}>
    <div className="grid min-w-0 gap-5 md:grid-cols-[210px_minmax(0,1fr)]">
      <nav aria-label="Opciones de cuenta" className="flex gap-2 overflow-x-auto md:flex-col">{SECCIONES.map(({ id, titulo, icon: Icon }) => <button key={id} type="button" disabled={guardando} aria-current={seccion === id ? 'page' : undefined} onClick={() => { setSeccion(id); setError(null); setMensaje('') }} className={'flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ' + (seccion === id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50')}><Icon size={17} className="shrink-0" />{titulo}</button>)}</nav>
      <div className="min-w-0"><AvisoClinico mensaje={errorCarga || error} />{conflictoPerfil && seccion === 'Perfil' && <button type="button" className={BOTON_SECUNDARIO + ' mb-4'} disabled={guardando} onClick={() => setRevision(v => v + 1)}>Descartar mis cambios y cargar datos actuales</button>}{errorCarga && <button type="button" className={BOTON_SECUNDARIO} onClick={() => setRevision((v) => v + 1)}>Volver a intentar</button>}{mensaje && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{mensaje}</p>}
      {!cuenta ? !errorCarga && <p role="status" className="py-12 text-center text-sm text-slate-500">Cargando tu cuenta...</p> : <>
        {seccion === 'Perfil' && <PanelClinico icon={UserRound} titulo="Información personal" ayuda={cuenta.rol === 'paciente' ? 'Actualiza tus datos personales y de contacto. Se guardan en tu ficha de paciente.' : 'Mantén actualizados tu nombre y tu teléfono.'}>
          <form id="form-cuenta" onSubmit={guardar}><fieldset disabled={guardando} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2"><label className={ETIQUETA_CLINICA}>Nombre completo<input className={CAMPO_CLINICO} value={nombre} onChange={e => setNombre(e.target.value)} minLength={3} maxLength={200} required autoComplete="name" /></label><label className={ETIQUETA_CLINICA}>Teléfono<CampoTelefono className={CAMPO_CLINICO} value={telefono} onValueChange={valor => setTelefono(valor)} autoComplete="tel" /></label></div>
            {cuenta.rol === 'paciente' && paciente && <>
              <div className="grid gap-4 sm:grid-cols-2"><label className={ETIQUETA_CLINICA}>Fecha de nacimiento<input type="date" className={CAMPO_CLINICO} min="1900-01-01" max={new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date())} value={paciente.fechaNacimiento} onChange={e => setPaciente({ ...paciente, fechaNacimiento: e.target.value })} autoComplete="bday" /></label><label className={ETIQUETA_CLINICA}>Género<select aria-label="Género" className={CAMPO_CLINICO} value={paciente.genero} onChange={e => setPaciente({ ...paciente, genero: e.target.value })}><option value="">Sin especificar</option><option value="F">Femenino</option><option value="M">Masculino</option><option value="O">Otro</option></select></label></div>
              <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4"><h4 className="text-sm font-semibold text-slate-800">Contacto de emergencia</h4><p className="mt-1 text-xs leading-relaxed text-slate-500">Persona a quien la clínica puede llamar si es necesario. Estos datos no cambian su cuenta ni la tuya.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className={ETIQUETA_CLINICA}>Nombre del contacto de emergencia<input className={CAMPO_CLINICO} minLength={3} maxLength={200} value={paciente.contactoEmergencia} onChange={e => setPaciente({ ...paciente, contactoEmergencia: e.target.value })} placeholder="Nombre completo de tu contacto" /></label><label className={ETIQUETA_CLINICA}>Teléfono de emergencia<CampoTelefono className={CAMPO_CLINICO} value={paciente.telefonoEmergencia} onValueChange={valor => setPaciente({ ...paciente, telefonoEmergencia: valor })} placeholder="Número para contactar a esta persona" /></label></div></section>
            </>}
            <label className={ETIQUETA_CLINICA}>Correo de acceso<input type="email" className={CAMPO_CLINICO + ' bg-slate-50'} value={cuenta.correo} readOnly />{cuenta.rol === 'paciente' && <span className="mt-2 block text-xs font-normal leading-relaxed text-slate-500">Para cambiarlo, contacta con recepción. El nuevo correo debe verificarse para conservar el acceso a tu cuenta.</span>}</label>
            <dl className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2"><DatoClinico etiqueta="Rol" valor={ETIQUETA_ROL[cuenta.rol]} />{cuenta.especialidad && <DatoClinico etiqueta="Especialidad" valor={cuenta.especialidad} />}</dl>
          </fieldset></form>
        </PanelClinico>}
        {seccion === 'Configuración' && <div className="space-y-5">{cuenta.rol === 'admin' && <EstadoSistema />}<PanelClinico icon={ShieldCheck} titulo="Sesión y seguridad" ayuda="Administra el acceso a tu cuenta."><dl className="mb-5 space-y-4"><DatoClinico etiqueta="Cuenta" valor={cuenta.correo} /><DatoClinico etiqueta="Autenticación" valor={cuenta.rol === 'paciente' ? 'Sesión protegida' : cuenta.sesion.jwtVerificado ? 'JWT verificado · sesión activa' : 'Sesión activa'} /><DatoClinico etiqueta="Vigencia del acceso actual" valor={cuenta.sesion.expira ? new Date(cuenta.sesion.expira * 1000).toLocaleString('es-MX') : 'Renovación automática'} /></dl><p className="mb-4 text-sm leading-relaxed text-slate-500">La sesión se restaura al recargar y el acceso se renueva automáticamente mientras tu sesión siga vigente.</p><div className="flex flex-wrap gap-3"><button type="button" className={BOTON_PRIMARIO} disabled={guardando} onClick={() => accionSesion('renovar')}><RefreshCw size={16} />Renovar sesión</button><button type="button" className={BOTON_SECUNDARIO} disabled={guardando} onClick={() => accionSesion('otras')}>Cerrar otras sesiones</button></div></PanelClinico><PanelClinico icon={KeyRound} titulo="Contraseña de acceso"><p className="mb-4 text-sm text-slate-500">Puedes actualizar tu contraseña verificando la actual.</p><button type="button" className={BOTON_SECUNDARIO} disabled={guardando} onClick={() => { setSeccion('Cambiar contraseña'); setMensaje('') }}>Cambiar contraseña</button></PanelClinico></div>}
        {seccion === 'Cambiar contraseña' && <PanelClinico icon={KeyRound} titulo="Actualizar contraseña" ayuda="Elige una nueva contraseña de entre 8 y 128 caracteres."><form id="form-cuenta" onSubmit={guardar}><fieldset disabled={guardando} className="space-y-4"><label className={ETIQUETA_CLINICA}>Contraseña actual<input type={mostrarClaves ? 'text' : 'password'} className={CAMPO_CLINICO} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required /></label><label className={ETIQUETA_CLINICA}>Nueva contraseña<input type={mostrarClaves ? 'text' : 'password'} className={CAMPO_CLINICO} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label><label className={ETIQUETA_CLINICA}>Confirmar nueva contraseña<input type={mostrarClaves ? 'text' : 'password'} className={CAMPO_CLINICO} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required /></label><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={mostrarClaves} onChange={(e) => setMostrarClaves(e.target.checked)} className="accent-blue-600" />Mostrar contraseñas</label>{requiereCodigo && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><button type="button" className={BOTON_SECUNDARIO} onClick={() => accionSesion('codigo')}>Enviar código de verificación</button><label className={ETIQUETA_CLINICA + ' mt-4'}>Código de verificación<input className={CAMPO_CLINICO} value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="one-time-code" /></label></div>}</fieldset></form></PanelClinico>}
        {seccion === 'Preferencias' && preferencias && <PanelClinico icon={SlidersHorizontal} titulo="Tu experiencia en Clínica Nova" ayuda="Las preferencias se guardan en tu cuenta y se aplican al iniciar sesión."><form id="form-cuenta" onSubmit={guardar}><fieldset disabled={guardando} className="space-y-4">{[{ campo: 'textoGrande', titulo: 'Texto más grande', ayuda: 'Aumenta el tamaño de los textos que se adaptan a la pantalla.' }, { campo: 'altoContraste', titulo: 'Mayor contraste', ayuda: 'Oscurece los textos secundarios y refuerza los bordes.' }, { campo: 'reducirAnimaciones', titulo: 'Reducir animaciones', ayuda: 'Reduce las transiciones y los efectos de movimiento.' }].map(({ campo, titulo, ayuda }) => <label key={campo} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4"><span><span className="block text-sm font-semibold text-slate-800">{titulo}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{ayuda}</span></span><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-blue-600" checked={preferencias[campo as 'textoGrande' | 'altoContraste' | 'reducirAnimaciones']} onChange={(e) => setPreferencias({ ...preferencias, [campo]: e.target.checked })} /></label>)}<label className={ETIQUETA_CLINICA}>Página al iniciar sesión<select className={CAMPO_CLINICO} value={preferencias.paginaInicio} onChange={(e) => setPreferencias({ ...preferencias, paginaInicio: e.target.value })}>{opcionesInicio(cuenta.rol).map((pagina) => <option key={pagina}>{pagina}</option>)}</select></label></fieldset></form></PanelClinico>}
        {seccion === 'Ayuda' && <div className="space-y-5"><PanelClinico icon={LifeBuoy} titulo="Preguntas frecuentes"><label className={ETIQUETA_CLINICA}>Buscar ayuda<input type="search" className={CAMPO_CLINICO} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Paciente, PDF, sesión..." /></label><div className="mt-4 space-y-2">{(cuenta.rol === 'paciente' ? PREGUNTAS_PACIENTE : PREGUNTAS).filter(([pregunta, respuesta]) => `${pregunta} ${respuesta}`.toLowerCase().includes(busqueda.toLowerCase())).map(([pregunta, respuesta]) => <details key={pregunta} className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">{pregunta}</summary><p className="mt-3 text-sm leading-relaxed text-slate-600">{respuesta}</p></details>)}</div></PanelClinico><PanelClinico icon={LifeBuoy} titulo="Contacto y reporte de un problema"><p className="mb-3 text-sm text-slate-500">{cuenta.soporte?.nombre || 'Contacta al administrador de tu clínica.'}</p><div className="mb-4 flex flex-wrap gap-3">{cuenta.soporte?.telefono && <a className={BOTON_SECUNDARIO} href={`tel:${cuenta.soporte.telefono.replace(/[^+\d]/g, '')}`}>Llamar a la clínica</a>}{cuenta.soporte?.correo_contacto && <a className={BOTON_SECUNDARIO} href={`mailto:${encodeURIComponent(cuenta.soporte.correo_contacto)}?subject=Soporte%20Cl%C3%ADnica%20Nova`}>Escribir a la clínica</a>}</div><label className={ETIQUETA_CLINICA}>Describe el problema<textarea rows={3} className={CAMPO_CLINICO + ' resize-y'} value={incidencia} onChange={(e) => setIncidencia(e.target.value)} placeholder="Qué intentabas hacer y qué ocurrió..." /></label><button type="button" className={BOTON_SECUNDARIO + ' mt-3'} disabled={!incidencia.trim()} onClick={descargarReporte}><Download size={16} />Descargar reporte para soporte</button></PanelClinico></div>}
      </>}
      </div>
    </div>
  </ModalMarco>
}
