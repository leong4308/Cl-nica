'use client'
import { useState } from 'react'
import { abrirSeccionCuenta } from '@/lib/cuenta/menu'
import { BarraSuperior } from '@/components/modulos/barra-superior'
import { BarraLateralEnfermero } from './barra-lateral'
import { PanelEnfermeria } from './panel-enfermeria'
import { BotonCerrarMenu } from '@/app/botones-pagina'
import type { RolUsuario } from '@/lib/supabase/tipos-rol'
import { navItemsEnfermero } from './barra-lateral/navegacion/items-menu'
export function InterfazEnfermero({usuario,paginaInicio,onCerrarSesion,onCambiarVistaRol}:{usuario:{nombre:string;rol:RolUsuario};paginaInicio?:string;onCerrarSesion:()=>void;onCambiarVistaRol?:(rol:RolUsuario)=>void}) {
 const [active,setActive]=useState(paginaInicio&&navItemsEnfermero.some(([s])=>s===paginaInicio)?paginaInicio:'Resumen'),[menu,setMenu]=useState(false)
 return <main className="min-h-screen bg-[#f6f8fc] text-slate-900">{menu&&<BotonCerrarMenu onCerrar={()=>setMenu(false)}/>}<BarraLateralEnfermero activo={active} abierto={menu} onNavegar={s=>{setActive(s);setMenu(false)}} onCerrar={()=>setMenu(false)}/><section className="lg:pl-[260px]"><BarraSuperior usuario={usuario} onAbrirMenu={()=>setMenu(true)} onAbrirModal={abrirSeccionCuenta} onCerrarSesion={onCerrarSesion} onCambiarVistaRol={onCambiarVistaRol}/><div className="mx-auto max-w-7xl px-5 py-7 sm:px-8"><PanelEnfermeria rol="enfermero" seccion={active}/></div></section></main>
}
