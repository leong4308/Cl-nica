'use client'

import { FormEvent, useState } from 'react'
import { Eye, EyeOff, HeartPulse, LockKeyhole, Mail, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LoginFormProps {
  onSuccess: () => void
}

const DEMO_EMAIL = 'admin@admin.com'
const DEMO_PASSWORD = '123456'

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
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
    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setLoading(false)
      const message = signInError.message.toLowerCase()
      setError(message.includes('confirm')
        ? 'Confirma tu correo electrónico para continuar.'
        : message.includes('rate')
          ? 'Demasiados intentos. Espera unos minutos y vuelve a intentar.'
          : 'Correo o contraseña incorrectos.')
      return
    }

    setLoading(false)
    onSuccess()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-10 text-[#0b1b33]">
      <section className="w-full max-w-md rounded-[24px] border border-[#e2e8f0] bg-white p-7 shadow-[0_20px_60px_rgba(15,35,70,0.10)] sm:p-10">
        <div className="mb-9 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#1a56db] text-white shadow-sm"><HeartPulse size={22} /></div>
          <div><p className="text-lg font-semibold tracking-tight">Clínica Nova</p><p className="text-[10px] font-medium tracking-[.18em] text-[#64748b]">SISTEMA MÉDICO</p></div>
        </div>
          <div className="mb-8"><p className="mb-2 text-sm font-medium text-[#0e9f6e]">Bienvenido de nuevo</p><h2 className="text-3xl font-semibold tracking-tight text-[#0b1b33]">Inicia sesión</h2><p className="mt-2 text-sm text-[#64748b]">Accede a tu panel de gestión clínica.</p><div className="mt-5 rounded-xl border border-[#c9d8f5] bg-[#e8f0ff] px-4 py-3 text-xs text-[#344054]"><p className="font-semibold text-[#1a56db]">Acceso de administrador</p><p className="mt-1">Usuario administrador: <span className="font-medium">{DEMO_EMAIL}</span></p><p>Contraseña: <span className="font-medium">{DEMO_PASSWORD}</span></p></div></div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm font-medium text-[#344054]">Correo electrónico<div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b]" size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@clinicanova.com" className="h-12 w-full rounded-xl border border-[#d6e0ef] bg-[#f8fbff] pl-11 pr-4 outline-none transition focus:border-[#1a56db] focus:ring-4 focus:ring-[#1a56db]/10" /></div></label>
            <label className="flex flex-col gap-2 text-sm font-medium text-[#344054]">Contraseña<div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b]" size={18} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingresa tu contraseña" className="h-12 w-full rounded-xl border border-[#d6e0ef] bg-[#f8fbff] pl-11 pr-12 outline-none transition focus:border-[#1a56db] focus:ring-4 focus:ring-[#1a56db]/10" /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#64748b] hover:bg-[#e8f0ff]"><span className="sr-only">{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</span>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            <div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2 text-[#64748b]"><input type="checkbox" className="size-4 accent-[#1a56db]" /> Recordarme</label><button type="button" onClick={() => setError('Solicita el restablecimiento al administrador del sistema.')} className="font-medium text-[#1a56db] hover:underline">¿Olvidaste tu contraseña?</button></div>
            {error && <p role="alert" className="rounded-xl bg-[#fff1f0] px-4 py-3 text-sm text-[#b42318]">{error}</p>}
            <button type="submit" disabled={loading} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1a56db] font-semibold text-white transition hover:bg-[#1347bb] disabled:cursor-wait disabled:opacity-70">{loading ? 'Verificando...' : 'Ingresar'}{!loading && <ArrowRight size={18} />}</button>
          </form>
          <p className="mt-8 text-center text-xs leading-5 text-[#64748b]">Al ingresar aceptas las políticas de privacidad y términos de uso de Clínica Nova.</p>
      </section>
    </main>
  )
}

export default LoginForm
