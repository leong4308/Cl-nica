export const pacientesModule = { name: 'Pacientes', routeKey: 'Pacientes' } as const
export { ModulePage as PacientesPage } from '../citas/module-page'

// La configuración de columnas y el rótulo de la acción principal viven en
// `citas/configuracion-modulos.ts`, que es donde los lee `module-page.tsx`.
