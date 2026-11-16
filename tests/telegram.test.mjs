import {test} from 'node:test'
import assert from 'node:assert/strict'
import {nombreBot,hashVinculo,solicitudVinculo,llamarTelegram,textoTelegram} from '../lib/notificaciones/telegram.mjs'
test('el enlace solo acepta tokens opacos y chats privados del remitente',()=>{
 const token='x'.repeat(43),m={chat:{type:'private',id:123},from:{id:123,first_name:'Nombre'},text:'/start '+token}
 assert.equal(solicitudVinculo({message:m}).hash,hashVinculo(token))
 assert.equal(solicitudVinculo({message:{...m,chat:{type:'group',id:-123}}}),null)
 assert.equal(solicitudVinculo({message:{...m,from:{id:999}}}),null)
 assert.equal(solicitudVinculo({message:{...m,text:'/start 5555555555'}}),null)
})
test('el bot valida su nombre y limita el mensaje sin cortar etiquetas HTML',()=>{
 assert.equal(nombreBot('@ClinicaNova_bot'),'ClinicaNova_bot');assert.equal(nombreBot('https://otro.test'),null)
 assert.ok(textoTelegram('Cita','Tu cita es mañana').includes('/stop'))
 assert.ok(textoTelegram('Cita','x'.repeat(5000)).length<=4000)
})
test('la cita se presenta con campos separados, estado real y horario de Ciudad de México',()=>{
 const cita={id:17,inicio:'2026-11-11T17:00:00Z',fin:'2026-11-11T17:20:00Z',paciente:'Mariana Torres',medico:'Dra. Ana López',clinica:'Clínica Nova',direccion:'Sede central',estado:'pendiente'}
 const mensaje=textoTelegram('Nueva cita','Mensaje anterior',cita)
 assert.ok(mensaje.includes('🏥 Clínica Nova'))
 assert.ok(mensaje.includes('👤 Paciente: Mariana Torres'))
 assert.ok(mensaje.includes('🩺 Médico: Dra. Ana López'))
 assert.ok(mensaje.includes('📅 <b>'))
 assert.ok(mensaje.includes('🕒 <b>'))
 assert.ok(mensaje.includes('⏳ Pendiente de confirmación'))
 assert.ok(mensaje.includes('11 de noviembre de 2026'))
 assert.ok(mensaje.includes('<b>11:00 – 11:20 h</b>'))
 assert.ok(mensaje.includes('Pendiente de confirmación'))
 assert.ok(!mensaje.includes('>Confirmada'))
 assert.ok(mensaje.includes('Cita #17</blockquote>'))
 assert.ok(mensaje.split('\n').length<=20)
 assert.ok(!mensaje.includes('━━━━━━━━'))
})
test('los nombres y textos no pueden inyectar etiquetas o enlaces en Telegram',()=>{
 const mensaje=textoTelegram('<a href="https://otro.test">Falso</a>','<script>& texto')
 assert.ok(!mensaje.includes('<a '));assert.ok(!mensaje.includes('<script>'))
 assert.ok(mensaje.includes('&lt;script&gt;&amp; texto'))
 const cita={id:1,inicio:'2026-11-11T17:00Z',fin:'2026-11-11T17:20Z',paciente:'Ana <b>falso</b> & familia',medico:'Médico',clinica:'Clínica',estado:'pendiente'}
 assert.ok(textoTelegram('Cita','',cita).includes('Ana &lt;b&gt;falso&lt;/b&gt; &amp; familia'))
})
test('los errores de Telegram no exponen token, URL ni cuerpo del proveedor',async()=>{
 await assert.rejects(llamarTelegram('secreto','sendMessage',{},async()=>{throw Error('https://api.telegram.org/botsecreto/sendMessage')}),e=>e.message==='TELEGRAM_RED')
 await assert.rejects(llamarTelegram('secreto','sendMessage',{},async()=>({ok:false,status:429,json:async()=>({ok:false,error_code:429,description:'secreto',parameters:{retry_after:120}})})),e=>e.message==='TELEGRAM_429'&&e.reintentarEn===120)
})
