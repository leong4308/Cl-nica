'use client'

import type { ClinicActions } from '../../compartidos/types'
import { BotonBuscarPaciente } from './buscar-paciente'
import { BotonNuevaCita } from './nueva-cita'
import { BotonRegistrarPaciente } from './registrar-paciente'
import { BotonVerResultadosPendientes } from './ver-resultados-pendientes'

export function AccionesRapidas({ openModal, rol }: ClinicActions) {
  const esMedico = rol === 'medico'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BotonBuscarPaciente onAbrirModal={openModal} />
      {!esMedico && <BotonNuevaCita onAbrirModal={openModal} />}
      {!esMedico && <BotonRegistrarPaciente onAbrirModal={openModal} />}
      <BotonVerResultadosPendientes onAbrirModal={openModal} />
    </div>
  )
}
