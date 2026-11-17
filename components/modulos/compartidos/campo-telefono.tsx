'use client'
import type { InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'onPaste' | 'maxLength' | 'minLength' | 'pattern' | 'inputMode'> & { value: string; onValueChange: (valor: string) => void }

/** Teléfono nacional: conserva ceros iniciales y nunca recorta un número pegado. */
export function CampoTelefono({ value, onValueChange, ...props }: Props) {
  return <input placeholder="10 dígitos" {...props} type="tel" inputMode="numeric" minLength={10} maxLength={10} pattern="[0-9]{10}" title="Escribe los 10 dígitos del teléfono, sin prefijo de país." value={value}
    onChange={e => { e.currentTarget.setCustomValidity(''); onValueChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 10)) }}
    onPaste={e => {
      e.preventDefault()
      const texto = e.clipboardData.getData('text'), digitos = texto.replace(/[^0-9]/g, '')
      const input = e.currentTarget, inicio = input.selectionStart ?? value.length, fin = input.selectionEnd ?? inicio
      const siguiente = value.slice(0, inicio) + digitos + value.slice(fin)
      if (!/^[0-9\s().-]+$/.test(texto) || siguiente.length > 10) {
        input.setCustomValidity('Pega un teléfono nacional de hasta 10 dígitos, sin prefijo de país.'); input.reportValidity(); return
      }
      input.setCustomValidity(''); onValueChange(siguiente)
    }} />
}
