'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { FlaskConical, HeartPulse, LockKeyhole, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cargarPerfilSesion } from '@/lib/supabase/sesion'
import type { PerfilSesion } from '@/lib/supabase/sesion'
import { BotonMostrarContrasena } from './mostrar-contrasena'
import { BotonOlvidoContrasena } from './olvido-contrasena'
import { BotonIngresar } from './ingresar'

interface LoginFormProps {
  onSuccess: (perfilDirecto?: PerfilSesion) => void
}

type AccesosPrueba = { habilitado: boolean; clave: string; cuentas: { rol: string; etiqueta: string; nombre: string; correo: string }[] }

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [accesos, setAccesos] = useState<AccesosPrueba | null>(null)
  const credencialesEditadas = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/accesos-prueba', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => res.ok ? await res.json() as AccesosPrueba : null)
      .then((datos) => {
        if (controller.signal.aborted || !datos?.habilitado || !datos.cuentas?.length) return
        setAccesos(datos)
        if (!credencialesEditadas.current) {
          setEmail(datos.cuentas[0].correo)
          setPassword(datos.clave)
        }
      })
      .catch(() => { /* El ingreso manual sigue disponible si no se pueden cargar los accesos. */ })
    return () => controller.abort()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    credencialesEditadas.current = true
    setError('')

    if (!email || !password) {
      setError('Ingresa tu correo y contraseña para continuar.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        setLoading(false)
        const message = signInError.message.toLowerCase()
        setError(
          message.includes('confirm')
            ? 'Confirma tu correo electrónico antes de iniciar sesión.'
            : message.includes('rate')
            ? 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
            : message.includes('invalid login')
            ? 'Correo o contraseña incorrectos.'
            : 'No se pudo iniciar sesión. Verifica tus credenciales.'
        )
        return
      }

      // Cargar perfil real desde la base de datos
      const perfil = await cargarPerfilSesion()
      setLoading(false)
      onSuccess(perfil)
    } catch {
      setLoading(false)
      setError('Error al conectar con el servidor. Verifica tu conexión.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-10 text-[#0b1b33]">
      <section className="w-full max-w-md rounded-[24px] border border-[#e2e8f0] bg-white p-7 shadow-[0_20px_60px_rgba(15,35,70,0.10)] sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#1a56db] text-white shadow-sm">
            <HeartPulse size={22} />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Clínica Nova</p>
            <p className="text-[10px] font-medium tracking-[.18em] text-[#64748b]">SISTEMA MÉDICO</p>
          </div>
        </div>

        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-[#0e9f6e]">Bienvenido</p>
          <h2 className="text-3xl font-semibold tracking-tight text-[#0b1b33]">Inicia sesión</h2>
          <p className="mt-2 text-sm text-[#64748b]">Accede a tu panel clínico con tus credenciales.</p>

          {accesos && (
            <section aria-label="Accesos de prueba por rol" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-slate-700">
              <p className="mb-1 flex items-center gap-2 font-semibold text-blue-900"><FlaskConical size={16} />Credenciales de prueba</p>
              <p className="mb-3 leading-relaxed text-slate-600">Selecciona un rol para rellenar sus datos y pulsa Ingresar.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {accesos.cuentas.map((cuenta) => (
                  <button
                    key={cuenta.correo}
                    type="button"
                    disabled={loading}
                    aria-label={`Usar cuenta de ${cuenta.etiqueta.toLocaleLowerCase('es')}`}
                    aria-pressed={email === cuenta.correo && password === accesos.clave}
                    onClick={() => {
                      credencialesEditadas.current = true
                      setEmail(cuenta.correo)
                      setPassword(accesos.clave)
                      setShowPassword(false)
                      setError('')
                    }}
                    className={'min-w-0 rounded-lg border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 ' + (cuenta.rol === 'paciente' ? 'sm:col-span-2 ' : '') + (email === cuenta.correo && password === accesos.clave ? 'border-blue-500 bg-blue-100 text-blue-900 shadow-xs' : 'border-blue-200 bg-white hover:border-blue-400')}
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-blue-700">{cuenta.etiqueta}</span>
                    <span title={cuenta.correo} className="mt-1 block truncate text-[11px]">{cuenta.correo}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 leading-relaxed">Contraseña de prueba: <code className="rounded border border-blue-200 bg-white px-1.5 py-0.5 font-semibold text-slate-900">{accesos.clave}</code></p>
            </section>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#344054]">
            Correo electrónico
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b]" size={18} />
              <input
                type="email"
                disabled={loading}
                value={email}
                onFocus={() => { credencialesEditadas.current = true }}
                onChange={(event) => { credencialesEditadas.current = true; setEmail(event.target.value) }}
                placeholder="tu@correo.com"
                autoComplete="email"
                className="h-12 w-full rounded-xl border border-[#d6e0ef] bg-[#f8fbff] pl-11 pr-4 text-xs font-medium outline-hidden transition focus:border-[#1a56db] focus:ring-4 focus:ring-[#1a56db]/10"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#344054]">
            Contraseña
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b]" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                disabled={loading}
                value={password}
                onFocus={() => { credencialesEditadas.current = true }}
                onChange={(event) => { credencialesEditadas.current = true; setPassword(event.target.value) }}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                className="h-12 w-full rounded-xl border border-[#d6e0ef] bg-[#f8fbff] pl-11 pr-12 text-xs font-medium outline-hidden transition focus:border-[#1a56db] focus:ring-4 focus:ring-[#1a56db]/10"
              />
              <BotonMostrarContrasena visible={showPassword} onAlternar={() => setShowPassword((value) => !value)} />
            </div>
          </label>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-[#64748b]">
              <input type="checkbox" className="size-4 accent-[#1a56db]" defaultChecked /> Recordarme
            </label>
            <BotonOlvidoContrasena onAvisar={setError} />
          </div>

          {error && <p role="alert" className="rounded-xl bg-[#fff1f0] px-4 py-2.5 text-xs text-[#b42318]">{error}</p>}
          <BotonIngresar cargando={loading} />
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-[#64748b]">
          Clínica Nova • Sistema de Gestión Hospitalaria Integral
        </p>
      </section>
    </main>
  )
}

export default LoginForm
