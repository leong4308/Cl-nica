'use client'

import { FormEvent, useState } from 'react'
import { HeartPulse, LockKeyhole, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cargarPerfilSesion } from '@/lib/supabase/sesion'
import type { PerfilSesion } from '@/lib/supabase/sesion'
import { BotonMostrarContrasena } from './mostrar-contrasena'
import { BotonOlvidoContrasena } from './olvido-contrasena'
import { BotonIngresar } from './ingresar'

interface LoginFormProps {
  onSuccess: (perfilDirecto?: PerfilSesion) => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-[#344054]">
            Correo electrónico
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b]" size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
