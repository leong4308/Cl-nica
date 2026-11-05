export const expedientesModule = { name: 'Expedientes', routeKey: 'Expedientes' } as const
export { ModulePage as ExpedientesPage } from '../citas/module-page'
export { BotonNuevoExpediente, ModalNuevoExpediente } from './nuevo-expediente'
export { ModalDetalleExpediente, type ExpedienteEditable } from './modal-detalle-expediente'
