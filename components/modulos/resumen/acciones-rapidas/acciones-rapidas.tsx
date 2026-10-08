'use client'

import type { ClinicActions } from '../../compartidos/types'
import { BotonBuscarPaciente } from './buscar-paciente'
import { BotonNuevaCita } from './nueva-cita'
import { BotonRegistrarPaciente } from './registrar-paciente'
import { BotonVerResultadosPendientes } from './ver-resultados-pendientes'

/**
 * Los 4 botones de acciones rápidas, cada uno desde su carpeta:
 *  - `Buscar paciente` → `buscar-paciente/`
 *  - `Nueva cita`      → `nueva-cita/`
 *  - `Registrar paciente` → `registrar-paciente/`
 *  - `Ver resultados pendientes` → `ver-resultados-pendientes/`
 */
export function AccionesRapidas({ openModal }: ClinicActions) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BotonBuscarPaciente onAbrirModal={openModal} />
      <BotonNuevaCita onAbrirModal={openModal} />
      <BotonRegistrarPaciente onAbrirModal={openModal} />
      <BotonVerResultadosPendientes onAbrirModal={openModal} />
    </div>
  )
}
