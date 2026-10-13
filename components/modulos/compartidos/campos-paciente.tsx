'use client'

export type DatosPacienteFormulario = {
  nombre: string
  telefono: string
  fechaNacimiento: string
  genero: string
  notasMedicas: string
}

export const DATOS_PACIENTE_INICIALES: DatosPacienteFormulario = {
  nombre: '',
  telefono: '',
  fechaNacimiento: '',
  genero: 'M',
  notasMedicas: '',
}

export function payloadPaciente(datos: DatosPacienteFormulario) {
  return {
    nombre: datos.nombre.trim(),
    telefono: datos.telefono.trim() || undefined,
    fechaNacimiento: datos.fechaNacimiento || undefined,
    genero: datos.genero || undefined,
    notasMedicas: datos.notasMedicas.trim() || undefined,
  }
}

type PropsCamposPaciente = {
  datos: DatosPacienteFormulario
  onChange: <K extends keyof DatosPacienteFormulario>(campo: K, valor: DatosPacienteFormulario[K]) => void
  prefijoId?: string
  autoFocusNombre?: boolean
  disabled?: boolean
}

const CAMPO =
  'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 disabled:bg-slate-50'
const ETIQUETA = 'text-xs font-semibold text-slate-600'

export function CamposPaciente({
  datos,
  onChange,
  prefijoId = 'paciente',
  autoFocusNombre = false,
  disabled = false,
}: PropsCamposPaciente) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={`${prefijoId}-nombre`} className={ETIQUETA}>
          Nombre completo <span className="text-rose-500">*</span>
        </label>
        <input
          id={`${prefijoId}-nombre`}
          type="text"
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
        <label htmlFor={`${prefijoId}-tel`} className={ETIQUETA}>
          Teléfono
        </label>
        <input
          id={`${prefijoId}-tel`}
          type="tel"
          disabled={disabled}
          placeholder="55 1234 5678"
          value={datos.telefono}
          onChange={(e) => onChange('telefono', e.target.value)}
          className={CAMPO}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefijoId}-fecha-nac`} className={ETIQUETA}>
            Fecha de nacimiento
          </label>
          <input
            id={`${prefijoId}-fecha-nac`}
            type="date"
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

      <div>
        <label htmlFor={`${prefijoId}-notas`} className={ETIQUETA}>
          Notas médicas o antecedentes
        </label>
        <textarea
          id={`${prefijoId}-notas`}
          rows={3}
          disabled={disabled}
          placeholder="Alergias, condiciones previas, etc."
          value={datos.notasMedicas}
          onChange={(e) => onChange('notasMedicas', e.target.value)}
          className={CAMPO}
        />
      </div>
    </div>
  )
}
