'use client'
import { CampoTelefono } from '@/components/modulos/compartidos/campo-telefono'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, HeartPulse, MailCheck, ShieldCheck, UserRound } from 'lucide-react'
import { fechaClinica } from '@/lib/agenda/modelo'
import { datosPersonalesRegistro, validarRegistroPaciente, type FormularioRegistro } from '@/lib/cuenta/registro'

const CAMPO = 'mt-1.5 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:opacity-50'
const ETIQUETA = 'block text-sm font-medium text-slate-700'
const BOTON = 'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50'
const INICIAL: FormularioRegistro = { nombre: '', correo: '', telefono: '', fechaNacimiento: '', genero: '', contactoEmergencia: '', telefonoEmergencia: '', nueva: '', confirmacion: '' }

export default function Registrarse() {
  const [datos, setDatos] = useState<FormularioRegistro>(INICIAL), [paso, setPaso] = useState(1)
  const [error, setError] = useState(''), [guardando, setGuardando] = useState(false), [mostrar, setMostrar] = useState(false)
  const [resultado, setResultado] = useState<{ requiereConfirmacion: boolean } | null>(null)
  const cambiar = (campo: keyof FormularioRegistro, valor: string) => setDatos(d => ({ ...d, [campo]: valor }))
  async function continuar(e: React.FormEvent) {
    e.preventDefault(); if (guardando) return; setError('')
    try {
      if (paso === 1) { datosPersonalesRegistro(datos); setPaso(2); return }
      validarRegistroPaciente(datos)
    } catch (e) { setError((e as Error).message); return }
    setGuardando(true)
    try {
      const r = await fetch('/api/auth/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }), b = await r.json()
      if (!r.ok) throw Error(b.error || 'No se pudo completar el registro.')
      setResultado({ requiereConfirmacion: b.requiereConfirmacion !== false }); setDatos(d => ({ ...d, nueva: '', confirmacion: '' }))
    } catch (e) { setError((e as Error).message || 'No se pudo conectar. Inténtalo nuevamente.') }
    finally { setGuardando(false) }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-7 text-slate-900 sm:py-10">
    <section className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,35,70,0.08)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-8"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-blue-600 text-white"><HeartPulse size={23} /></span><div><p className="text-lg font-semibold">Clínica Nova</p><p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600">Portal del paciente</p></div></div><a href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"><ArrowLeft size={15} />Volver al inicio</a></header>
      <div className="p-6 sm:p-8">
        {resultado ? <div className="mx-auto max-w-lg py-4 text-center"><span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">{resultado.requiereConfirmacion ? <MailCheck size={30} /> : <Check size={30} />}</span><h1 className="mt-5 text-2xl font-semibold">{resultado.requiereConfirmacion ? 'Revisa tu correo' : 'Tu cuenta de paciente está lista'}</h1><p role="status" className="mt-3 text-sm leading-relaxed text-slate-600">{resultado.requiereConfirmacion ? <>Revisa <strong className="break-all text-slate-900">{datos.correo.trim().toLowerCase()}</strong>. Si esta dirección aún no tiene cuenta, recibirás un enlace para confirmar tu correo. Revisa también la carpeta de correo no deseado.</> : 'Tu cuenta y tus datos personales quedaron registrados. Ya puedes entrar a tu portal.'}</p>{resultado.requiereConfirmacion && <p className="mt-4 text-xs leading-relaxed text-slate-500">Si ya tienes cuenta, utiliza tu contraseña habitual o recupérala desde el inicio de sesión. Si recepción ya creó tu ficha, solicita tu invitación.</p>}<a className={BOTON + ' mt-6'} href="/">{resultado.requiereConfirmacion ? 'Ir a iniciar sesión' : 'Entrar a mi portal'}<ArrowRight size={16} /></a></div> : <>
          <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Tu primera visita empieza aquí</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Crea tu cuenta de paciente</h1><p className="mt-2 text-sm text-slate-500">Completa tus datos para consultar tus citas y dar seguimiento a tu atención.</p></div>
          <ol aria-label="Pasos del registro" className="mb-6 grid grid-cols-2 gap-3">{['Datos personales', 'Datos de acceso'].map((titulo, i) => <li key={titulo} aria-current={paso === i + 1 ? 'step' : undefined} className={'flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium ' + (paso === i + 1 ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-100 text-slate-400')}><span className={'flex size-6 shrink-0 items-center justify-center rounded-full ' + (paso === i + 1 ? 'bg-blue-600 text-white' : 'bg-slate-100')}>{paso > i + 1 ? <Check size={14} /> : i + 1}</span>{titulo}</li>)}</ol>
          <form onSubmit={continuar}>
            <fieldset disabled={guardando}><legend className="sr-only">{paso === 1 ? 'Datos personales' : 'Datos de acceso'}</legend>
              {paso === 1 ? <div className="grid gap-4 sm:grid-cols-2">
                <label className={ETIQUETA + ' sm:col-span-2'}>Nombre completo<input className={CAMPO} autoComplete="name" required minLength={3} maxLength={200} value={datos.nombre} onChange={e => cambiar('nombre', e.target.value)} placeholder="Nombre y apellidos" /></label>
                <label className={ETIQUETA}>Teléfono<CampoTelefono className={CAMPO} autoComplete="tel" required value={datos.telefono} onValueChange={valor => cambiar('telefono', valor)} placeholder="9611234567" /></label>
                <label className={ETIQUETA}>Fecha de nacimiento<input type="date" className={CAMPO} autoComplete="bday" required min="1900-01-01" max={fechaClinica()} value={datos.fechaNacimiento} onChange={e => cambiar('fechaNacimiento', e.target.value)} /></label>
                <label className={ETIQUETA}>Género<select className={CAMPO} required value={datos.genero} onChange={e => cambiar('genero', e.target.value)}><option value="">Selecciona una opción</option><option value="M">Masculino</option><option value="F">Femenino</option><option value="O">Otro</option></select></label>
                <div className="hidden sm:block" />
                <label className={ETIQUETA}>Contacto de emergencia<input className={CAMPO} required minLength={3} maxLength={200} value={datos.contactoEmergencia} onChange={e => cambiar('contactoEmergencia', e.target.value)} placeholder="Nombre completo" /></label>
                <label className={ETIQUETA}>Teléfono de emergencia<CampoTelefono className={CAMPO} required value={datos.telefonoEmergencia} onValueChange={valor => cambiar('telefonoEmergencia', valor)} placeholder="9611234567" /></label>
              </div> : <div className="space-y-4">
                <label className={ETIQUETA}>Correo electrónico<input type="email" className={CAMPO} autoComplete="email" required maxLength={150} value={datos.correo} onChange={e => cambiar('correo', e.target.value)} placeholder="tu@correo.com" /></label>
                <div className="grid gap-4 sm:grid-cols-2"><label className={ETIQUETA}>Contraseña<input type={mostrar ? 'text' : 'password'} className={CAMPO} autoComplete="new-password" required minLength={12} maxLength={128} value={datos.nueva} onChange={e => cambiar('nueva', e.target.value)} /></label><label className={ETIQUETA}>Confirmar contraseña<input type={mostrar ? 'text' : 'password'} className={CAMPO} autoComplete="new-password" required minLength={12} maxLength={128} value={datos.confirmacion} onChange={e => cambiar('confirmacion', e.target.value)} /></label></div>
                <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-relaxed text-slate-500">De 12 a 128 caracteres, con mayúsculas, minúsculas y números.</p><label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={mostrar} onChange={e => setMostrar(e.target.checked)} />Mostrar contraseñas</label></div>
                <p className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800"><ShieldCheck size={17} className="mt-0.5 shrink-0" />Usa un correo al que tengas acceso. Tendrás que confirmarlo antes de iniciar sesión.</p>
              </div>}
            </fieldset>
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><p className="text-xs text-slate-500">Todos los campos son obligatorios.</p><div className="flex gap-2">{paso === 2 && <button type="button" disabled={guardando} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 disabled:opacity-50" onClick={() => { setPaso(1); setError('') }}>Anterior</button>}<button disabled={guardando} className={BOTON}>{paso === 1 ? <>Continuar<ArrowRight size={16} /></> : guardando ? 'Creando cuenta…' : <><UserRound size={16} />Crear mi cuenta</>}</button></div></div>
          </form>
          <p className="mt-5 text-center text-xs text-slate-500">¿Ya tienes cuenta? <a className="font-semibold text-blue-700" href="/">Inicia sesión</a></p>
        </>}
      </div>
    </section>
  </main>
}
