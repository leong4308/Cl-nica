export const pacientesModule = { name: 'Pacientes', routeKey: 'Pacientes' } as const
export { ModulePage as PacientesPage } from '../citas/module-page'

// La configuración y acciones específicas viven en compartidos/data.ts mientras se conecta la base de datos.
