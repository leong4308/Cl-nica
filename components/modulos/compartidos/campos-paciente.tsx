'use client'
import { CampoTelefono } from './campo-telefono'
import { fechaClinica } from '@/lib/agenda/modelo'

export type DatosPacienteFormulario = {
  nombre: string
  correo: string
  telefono: string
  fechaNacimiento: string
  genero: string
  notasMedicas: string
}

export const DATOS_PACIENTE_INICIALES: DatosPacienteFormulario = {
  nombre: '',
  correo: '',
  telefono: '',
  fechaNacimiento: '',
  genero: 'M',
  notasMedicas: '',
}

export function payloadPaciente(datos: DatosPacienteFormulario) {
  return {
    nombre: datos.nombre.trim(),
    correo: datos.correo.trim().toLowerCase() || undefined,
    telefono: datos.telefono.trim() || undefined,
    fechaNacimiento: datos.fechaNacimiento || undefined,
    genero: datos.genero || undefined,
    notasMedicas: datos.notasMedicas.trim() || undefined,
  }
}

type PropsCamposPaciente = {
  soloAdministrativo?: boolean
  datos: DatosPacienteFormulario
  onChange: <K extends keyof DatosPacienteFormulario>(campo: K, valor: DatosPacienteFormulario[K]) => void
  prefijoId?: string
  autoFocusNombre?: boolean
  disabled?: boolean
}

const CAMPO =
  'mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:opacity-50 disabled:bg-slate-50'
const ETIQUETA = 'text-sm font-semibold text-slate-700'

export function CamposPaciente({
  datos,
  onChange,
  prefijoId = 'paciente',
  autoFocusNombre = false,
  disabled = false,
  soloAdministrativo = false,
}: PropsCamposPaciente) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div>
        <label htmlFor={`${prefijoId}-nombre`} className={ETIQUETA}>
          Nombre completo <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${prefijoId}-nombre`}
          type="text"
          minLength={3}
          maxLength={200}
          required
          disabled={disabled}
          autoFocus={autoFocusNombre}
          placeholder="Ej. Juan Pérez González"
          value={datos.nombre}
          onChange={(e) => onChange('nombre', e.target.value)}
          className={CAMPO}
        />
      </div>

      <div>
        <label htmlFor={`${prefijoId}-correo`} className={ETIQUETA}>Correo electrónico</label>
        <input id={`${prefijoId}-correo`} type="email" autoComplete="email" maxLength={150} disabled={disabled} placeholder="correo@ejemplo.com" value={datos.correo} onChange={e => onChange('correo', e.target.value)} className={CAMPO} />
        <p className="mt-2 text-xs leading-relaxed text-slate-500">Opcional. Permite invitar al paciente a su portal y enviarle avisos de citas.</p>
      </div>
      <div>
        <label htmlFor={`${prefijoId}-tel`} className={ETIQUETA}>
          Teléfono
        </label>
        <CampoTelefono
          id={`${prefijoId}-tel`}
          disabled={disabled}
          placeholder="5512345678"
          value={datos.telefono}
          onValueChange={valor => onChange('telefono', valor)}
          className={CAMPO}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefijoId}-fecha-nac`} className={ETIQUETA}>
            Fecha de nacimiento
          </label>
          <input
            id={`${prefijoId}-fecha-nac`}
            type="date"
            min="1900-01-01"
            max={fechaClinica()}
            disabled={disabled}
            value={datos.fechaNacimiento}
            onChange={(e) => onChange('fechaNacimiento', e.target.value)}
            className={CAMPO}
          />
        </div>
        <div>
          <label htmlFor={`${prefijoId}-genero`} className={ETIQUETA}>
            Género
          </label>
          <select
            id={`${prefijoId}-genero`}
            disabled={disabled}
            value={datos.genero}
            onChange={(e) => onChange('genero', e.target.value)}
            className={CAMPO}
          >
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="O">Otro</option>
          </select>
        </div>
      </div>

      {!soloAdministrativo && <div>
        <label htmlFor={`${prefijoId}-notas`} className={ETIQUETA}>
          Notas médicas o antecedentes
        </label>
        <textarea
          id={`${prefijoId}-notas`}
          rows={3}
          maxLength={8000}
          disabled={disabled}
          placeholder="Alergias, condiciones previas, etc."
          value={datos.notasMedicas}
          onChange={(e) => onChange('notasMedicas', e.target.value)}
          className={CAMPO + ' resize-y leading-relaxed'}
        />
      </div>}
    </div>
  )
}
