import { readdir, lstat, realpath, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { relative, isAbsolute, sep, join } from 'node:path'

const raiz = await realpath(fileURLToPath(new URL('../', import.meta.url)))
const opciones = process.argv.slice(2)
if (opciones.some(opcion => opcion !== '--ver')) throw Error('Usa pnpm limpiar o pnpm limpiar --ver.')
const soloVer = opciones.includes('--ver')
const resultados = new Set(['test-results', 'playwright-report', 'blob-report', 'coverage', '.nyc_output'])
const conservar = new Set(['.git', 'node_modules', '.next', '.pnpm-store', 'respaldos', 'pgsql'])
const resumen = { archivos: 0, carpetas: 0, omitidos: 0 }

function dentroDelProyecto(ruta) {
  const local = relative(raiz, ruta)
  return local !== '' && local !== '..' && !local.startsWith('..' + sep) && !isAbsolute(local)
}
async function retirar(ruta, carpeta = false) {
  // No seguir enlaces ni permitir que la limpieza alcance otros proyectos.
  if (!(await lstat(ruta)).isSymbolicLink() && dentroDelProyecto(await realpath(ruta))) {
    try {
      if (!soloVer) await rm(ruta, { recursive: carpeta, force: false })
      resumen[carpeta ? 'carpetas' : 'archivos']++
      console.log(`${soloVer ? 'Se eliminaría' : 'Eliminado'}: ${relative(raiz, ruta)}`)
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error
      resumen.omitidos++
      console.log(`Se conserva por estar en uso o protegido: ${relative(raiz, ruta)}`)
    }
  }
}
async function recorrer(directorio) {
  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name)
    if (entrada.isSymbolicLink()) continue
    if (entrada.isDirectory()) {
      if (directorio === raiz && resultados.has(entrada.name)) await retirar(ruta, true)
      else if (!conservar.has(entrada.name)) await recorrer(ruta)
    } else if (entrada.isFile() && (entrada.name.endsWith('.log') || entrada.name.endsWith('.tsbuildinfo') || entrada.name === '.eslintcache')) {
      await retirar(ruta)
    }
  }
}
await recorrer(raiz)
console.log(JSON.stringify({ modo: soloVer ? 'vista previa' : 'limpieza', ...resumen }))
