'use client'
import { useState } from 'react'
import { AvisoClinico, BOTON_SECUNDARIO } from '../../compartidos/editor-clinico'
export function EstadoSistema() {
  const [estado,setEstado]=useState<{baseActualizada:boolean;accesosPrueba:boolean}|null>(null),[error,setError]=useState<string|null>(null),[cargando,setCargando]=useState(false)
  async function consultar(){setCargando(true);setError(null);try{const r=await fetch('/api/sistema/estado',{cache:'no-store'}),body=await r.json();if(!r.ok)throw Error(body.error);setEstado(body)}catch(e){setError(e instanceof Error?e.message:'No se pudo consultar el estado.')}finally{setCargando(false)}}
  return <section className="space-y-3 rounded-2xl border border-slate-200 p-5"><h3 className="text-sm font-semibold text-slate-900">Estado del sistema</h3><p className="text-sm text-slate-500">Comprueba que la actualización de seguridad esté instalada.</p><AvisoClinico mensaje={error}/>{estado&&<div role="status" className="space-y-2 text-sm"><p className={estado.baseActualizada?'text-emerald-700':'text-amber-700'}>{estado.baseActualizada?'Base de datos actualizada.':'Falta instalar la actualización de la base de datos.'}</p><p className="text-slate-600">{estado.accesosPrueba?'Los accesos de prueba están habilitados.':'Los accesos de prueba están desactivados.'}</p></div>}<button type="button" className={BOTON_SECUNDARIO} disabled={cargando} onClick={()=>void consultar()}>{cargando?'Comprobando...':'Verificar estado'}</button></section>
}
