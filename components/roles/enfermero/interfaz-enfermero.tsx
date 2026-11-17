'use client'
import { useEffect, useState } from 'react'
import { abrirSeccionCuenta } from '@/lib/cuenta/menu'
import { BarraSuperior } from '@/components/modulos/barra-superior'
import { ModalMarco } from '@/components/modulos/compartidos/modal-marco'
import { PanelEquipo, type NuevoMensajeEquipo } from '@/components/modulos/equipo/panel-equipo'
import { BarraLateralEnfermero } from './barra-lateral'
import { PanelEnfermeria } from './panel-enfermeria'
import { BotonCerrarMenu } from '@/app/botones-pagina'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'
import { navItemsEnfermero } from './barra-lateral/navegacion/items-menu'
export function InterfazEnfermero({usuario,paginaInicio,onCerrarSesion,onCambiarVistaRol}:{usuario:{nombre:string;rol:RolUsuario};paginaInicio?:string;onCerrarSesion:()=>void;onCambiarVistaRol?:(rol:RolUsuario)=>void}) {
 const [active,setActive]=useState(paginaInicio&&navItemsEnfermero.some(([s])=>s===paginaInicio)?paginaInicio:'Resumen'),[menu,setMenu]=useState(false)
 const [solicitud,setSolicitud]=useState<NuevoMensajeEquipo | undefined>(),[comunicando,setComunicando]=useState(false)
 const comunicar=(inicial?:NuevoMensajeEquipo)=>{setSolicitud(inicial);setComunicando(true);setMenu(false)}
 useEffect(()=>{const abrir=()=>{setSolicitud(undefined);setComunicando(true);setMenu(false)};window.addEventListener('abrir-equipo',abrir);return()=>window.removeEventListener('abrir-equipo',abrir)},[])
 return <main className="min-h-screen bg-[#f6f8fc] text-slate-900">{menu&&<BotonCerrarMenu onCerrar={()=>setMenu(false)}/>}<BarraLateralEnfermero activo={active} abierto={menu} onNavegar={s=>{setActive(s);setMenu(false)}} onCerrar={()=>setMenu(false)}/><section className="lg:pl-[260px]"><BarraSuperior usuario={usuario} onAbrirMenu={()=>setMenu(true)} onAbrirModal={abrirSeccionCuenta} onCerrarSesion={onCerrarSesion} onCambiarVistaRol={onCambiarVistaRol}/><div className="mx-auto max-w-7xl px-5 py-7 sm:px-8"><PanelEnfermeria rol="enfermero" seccion={active} nombreUsuario={usuario.nombre} onNavegar={s=>{if(s==='Equipo')comunicar();else if(navItemsEnfermero.some(([nombre])=>nombre===s)){setActive(s);setMenu(false)}}} onMensaje={comunicar}/></div></section>{comunicando&&<ModalMarco title="Comunicación con el equipo" ancho="max-w-6xl" contenidoFijo onClose={()=>setComunicando(false)}><PanelEquipo key={JSON.stringify(solicitud)} rol="enfermero" inicial={solicitud}/></ModalMarco>}</main>
}
