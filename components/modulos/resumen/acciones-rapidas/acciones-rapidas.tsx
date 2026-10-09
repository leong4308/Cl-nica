'use client'

import type { ClinicActions } from '../../compartidos/types'
import { BotonBuscarPaciente } from './buscar-paciente'
import { BotonNuevaCita } from './nueva-cita'
import { BotonRegistrarPaciente } from './registrar-paciente'
import { BotonVerResultadosPendientes } from './ver-resultados-pendientes'

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
