import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {iniciarAplicacionConAvisos} from '../lib/operacion/aplicacion-avisos.mjs'
function preparar(plataforma='linux') {
 const hijos=[],tiempos=[],avisos=[]
 const ejecutar=(bin,args,opciones)=>{
  const p=new EventEmitter();Object.assign(p,{pid:100+hijos.length,connected:opciones.stdio instanceof Array,enviados:[],senales:[],send(m,cb){this.enviados.push(m);cb?.()},kill(s){this.senales.push(s)}})
  hijos.push({bin,args,opciones,p});return p
 }
 const app=iniciarAplicacionConAvisos('dev',['--port','3001'],{ejecutar,plataforma,avisar:m=>avisos.push(m),programar:(fn,ms)=>{const t={fn,ms,unref(){},cancelado:false};tiempos.push(t);return t},cancelar:t=>{if(t)t.cancelado=true}})
 return {app,hijos,tiempos,avisos}
}
test('arranca Next y el trabajador en la carpeta del proyecto, sin shell ni credenciales en argumentos',async()=>{
 const {app,hijos}=preparar()
 assert.equal(hijos.length,2);assert.ok(hijos[0].args[0].endsWith('notificaciones.mjs'))
 assert.deepEqual(hijos[1].args.slice(1),['dev','--port','3001'])
 assert.equal(hijos[0].opciones.cwd,hijos[1].opciones.cwd);assert.equal(hijos[0].opciones.windowsHide,true)
 assert.equal(hijos[0].opciones.shell,undefined);assert.ok(hijos[0].opciones.stdio.includes('ipc'))
 hijos[1].p.emit('exit',0);assert.deepEqual(hijos[0].p.enviados,[{tipo:'detener-notificaciones'}])
 hijos[0].p.emit('exit',0);assert.equal(await app.terminado,0)
})
test('reinicia el trabajador si falla, y respeta la reserva de otra instancia sin duplicar entregas',async()=>{
 const {app,hijos,tiempos,avisos}=preparar()
 hijos[0].p.emit('exit',1);assert.equal(tiempos[0].ms,30000);assert.equal(avisos.length,1)
 tiempos[0].fn();assert.equal(hijos.length,3)
 hijos[2].p.emit('message',{tipo:'trabajador-existente'});hijos[2].p.emit('exit',0)
 assert.equal(tiempos[1].ms,60000);assert.equal(avisos.length,1)
 hijos[1].p.emit('exit',0);assert.equal(await app.terminado,0);assert.equal(tiempos[1].cancelado,true)
})
test('un fallo de Next detiene su trabajador y conserva el código de error',async()=>{
 const {app,hijos}=preparar();hijos[1].p.emit('error',{code:'EACCES'})
 assert.deepEqual(hijos[0].p.enviados,[{tipo:'detener-notificaciones'}])
 hijos[0].p.emit('exit',0);assert.equal(await app.terminado,1)
})
test('el cierre en Windows termina solo el árbol de Next creado y espera el cierre del trabajador',async()=>{
 const {app,hijos,tiempos}=preparar('win32');app.detener()
 assert.equal(hijos[2].bin,'taskkill');assert.deepEqual(hijos[2].args,['/PID','101','/T','/F']);assert.equal(hijos[2].opciones.windowsHide,true)
 assert.equal(tiempos[0].ms,35000)
 hijos[1].p.emit('exit',1);hijos[0].p.emit('exit',0);assert.equal(await app.terminado,0);assert.equal(tiempos[0].cancelado,true)
})
test('no acepta comandos arbitrarios como modo de arranque',()=>{
 assert.throws(()=>iniciarAplicacionConAvisos('otro'),/dev o start/)
})
