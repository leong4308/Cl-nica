import { Bed, Search, UserPlus } from 'lucide-react'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/components/modulos/compartidos/editor-clinico'
export function AccionesRapidasEnfermero({onNavegar,onIngreso}:{onNavegar:(seccion:string)=>void;onIngreso:()=>void}) {
 return <div className="flex flex-wrap gap-2"><button type="button" className={BOTON_PRIMARIO} onClick={onIngreso}><UserPlus size={16}/>Registrar ingreso urgente</button><button type="button" className={BOTON_SECUNDARIO} onClick={()=>onNavegar('Internación')}><Bed size={16}/>Mapa de camas</button><button type="button" className={BOTON_SECUNDARIO} onClick={()=>onNavegar('Pacientes')}><Search size={16}/>Buscar paciente asignado</button></div>
}
