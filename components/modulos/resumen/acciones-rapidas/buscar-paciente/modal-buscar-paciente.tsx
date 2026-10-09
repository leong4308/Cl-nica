'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import { cargarPacientes } from '@/lib/supabase/datos'
import { guardarModulo, leerModulo } from '@/lib/supabase/cache-modulos'
import { ModalMarco } from '../../../compartidos/modal-marco'
import { BuscadorPaciente } from './buscador-paciente'

type PropsModalBuscarPaciente = {
  onClose: () => void
  onSave: (value: string) => void
}

export function ModalBuscarPaciente({ onClose }: PropsModalBuscarPaciente) {
  const pacientesIniciales = leerModulo('Pacientes')
  const [pacientes, setPacientes] = useState<{ nombre: string; identificacion: string; pass: string; telefono: string; estado: string }[]>(
    () => (pacientesIniciales?.filas ?? []).map((fila) => ({
      nombre: fila[0] ?? '—',
      identificacion: fila[1] ?? '—',
      pass: '—',
      telefono: fila[2] ?? '—',
      estado: fila[4] ?? 'Activo',
    })),
  )
  useEffect(() => {
    let vigente = true
    cargarPacientes().then((resultado) => {
      if (!vigente || resultado.error) return
      setPacientes(resultado.filas.map((fila) => ({
        nombre: fila[0] ?? '—',
        identificacion: fila[1] ?? '—',
        pass: '—',
        telefono: fila[2] ?? '—',
        estado: fila[4] ?? 'Activo',
      })))
      guardarModulo('Pacientes', resultado.filas, resultado.error)
    })
    return () => { vigente = false }
  }, [])

  const [value, setValue] = useState('')
  const [resultadoActivo, setResultadoActivo] = useState(0)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(false)

  const normalizar = (texto: string) =>
    texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const resultados = pacientes
    .filter((paciente) => normalizar(`${paciente.nombre} ${paciente.identificacion} ${paciente.telefono}`).includes(normalizar(value)))
    .slice(0, 6)

  const seleccionarPaciente = (nombre: string) => {
    setValue(nombre)
    setPacienteSeleccionado(true)
  }

  const manejarTeclado = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setResultadoActivo((actual) => Math.min(actual + 1, resultados.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setResultadoActivo((actual) => Math.max(actual - 1, 0))
    }
    if (event.key === 'Enter' && resultados[resultadoActivo]) {
      event.preventDefault()
      seleccionarPaciente(resultados[resultadoActivo].nombre)
    }
  }

  return (
    <ModalMarco title="Buscar paciente" onClose={onClose}>
      <BuscadorPaciente
        value={value}
        onChange={(v) => {
          setValue(v)
          setPacienteSeleccionado(false)
          setResultadoActivo(0)
        }}
        resultados={resultados}
        resultadoActivo={resultadoActivo}
        seleccionado={pacienteSeleccionado}
        onTeclado={manejarTeclado}
        onSeleccionar={seleccionarPaciente}
      />
    </ModalMarco>
  )
}
