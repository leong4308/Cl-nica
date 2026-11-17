import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const raiz = fileURLToPath(new URL('../../', import.meta.url))

// La aplicación local supervisa su propio trabajador, sin ejecutar comandos en una shell.
export function iniciarAplicacionConAvisos(modo, argumentos = [], opciones = {}) {
  if (!['dev', 'start'].includes(modo)) throw Error('Usa dev o start.')
  const ejecutar = opciones.ejecutar ?? spawn, programar = opciones.programar ?? setTimeout, cancelar = opciones.cancelar ?? clearTimeout
  const avisar = opciones.avisar ?? console.error, plataforma = opciones.plataforma ?? process.platform
  let worker, workerTerminado = true, appTerminado = false, cerrando = false, reintento, limite, codigo = 0, resolver
  const terminado = new Promise(r => { resolver = r })
  const terminar = () => {
    if (cerrando && workerTerminado && appTerminado) { cancelar(limite); cancelar(reintento); resolver(codigo) }
  }
  function iniciarWorker() {
    if (cerrando) return
    workerTerminado = false
    const actual = worker = ejecutar(process.execPath, [fileURLToPath(new URL('../../scripts/notificaciones.mjs', import.meta.url))], { cwd: raiz, stdio: ['inherit', 'inherit', 'inherit', 'ipc'], windowsHide: true })
    let compartido = false, finalizado = false
    actual.on('message', m => { if (m?.tipo === 'trabajador-existente') compartido = true })
    const fin = () => {
      if (finalizado) return; finalizado = true; workerTerminado = true
      if (!cerrando) {
        if (!compartido) avisar('[Avisos] El trabajador se detuvo; se reintentará en 30 segundos. Consulta npm run notificaciones:estado.')
        reintento = programar(iniciarWorker, compartido ? 60_000 : 30_000); reintento?.unref?.()
      }
      terminar()
    }
    actual.once('exit', fin); actual.once('error', fin)
  }
  iniciarWorker()
  const app = ejecutar(process.execPath, [require.resolve('next/dist/bin/next'), modo, ...argumentos], { cwd: raiz, stdio: 'inherit', windowsHide: true })
  function detener() {
    if (cerrando) return; cerrando = true; cancelar(reintento)
    if (!workerTerminado) {
      if (worker.connected) worker.send({ tipo: 'detener-notificaciones' }, () => {})
      else worker.kill('SIGTERM')
      limite = programar(() => { if (!workerTerminado) worker.kill('SIGTERM') }, 35_000); limite?.unref?.()
    }
    if (!appTerminado) {
      // Next dev utiliza un proceso hijo en Windows. Solo se termina el árbol que acabamos de crear.
      if (plataforma === 'win32' && app.pid) ejecutar('taskkill', ['/PID', String(app.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).once('error', () => app.kill('SIGTERM'))
      else app.kill('SIGTERM')
    }
    terminar()
  }
  app.once('exit', c => { appTerminado = true; codigo = cerrando ? 0 : c ?? 1; detener(); terminar() })
  app.once('error', e => { avisar('[Aplicación] No se pudo iniciar Next. Código: ' + (e.code ?? 'INICIO')); appTerminado = true; codigo = 1; detener(); terminar() })
  return { detener, terminado }
}
