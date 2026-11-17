import { iniciarAplicacionConAvisos } from '../lib/operacion/aplicacion-avisos.mjs'

console.log('Iniciando Clínica Nova y su trabajador de avisos. Los envíos requieren la configuración de .env.local.')
const servicio = iniciarAplicacionConAvisos(process.argv[2] ?? 'dev', process.argv.slice(3))
const detener = () => servicio.detener()
process.once('SIGINT', detener)
process.once('SIGTERM', detener)
process.exitCode = await servicio.terminado
process.removeListener('SIGINT', detener)
process.removeListener('SIGTERM', detener)
