import { test, expect, type Page } from '@playwright/test'

/**
 * Pruebas de extremo a extremo del panel de citas.
 *
 * Verifican lo que las pruebas de lógica no pueden: que la interfaz pinta bien,
 * que los horarios mostrados coinciden con la agenda real de cada médico y que
 * no hay errores en consola.
 *
 * Variables opcionales: E2E_USUARIO / E2E_CLAVE
 */

const USUARIO = process.env.E2E_USUARIO ?? 'doc@doc.com'
const CLAVE = process.env.E2E_CLAVE ?? '123456'

/** Inicia sesión y espera a que el panel haya cargado los datos. */
async function entrar(page: Page) {
  await page.goto('/')
  const correo = page.locator('input[type="email"]').first()
  await correo.waitFor({ state: 'visible', timeout: 20_000 })
  await correo.fill(USUARIO)
  await page.locator('input[type="password"]').first().fill(CLAVE)
  await page.getByRole('button', { name: /ingresar/i }).first().click()
  await expect(page.getByText('Próximas citas y check-in')).toBeVisible({ timeout: 30_000 })
}

test.describe('panel de check-in', () => {
  test('entra y muestra el panel con las tres pestañas', async ({ page }) => {
    await entrar(page)
    // Las pestañas llevan el contador ("Reagendar (3)"); los botones de fila se
    // llaman solo "Reagendar", así que el paréntesis los distingue.
    await expect(page.getByRole('button', { name: /^Actuales \(/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Pendientes \(/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Reagendar \(/ })).toBeVisible()
    // La vista inicial es "Reagendar".
    await expect(page.getByRole('button', { name: /^Reagendar \(/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('cada bloque de día lleva su encabezado con el total', async ({ page }) => {
    await entrar(page)

    // Revisa las tres pestañas: puede que una esté vacía y otra no, según la
    // hora del día (a medianoche no hay citas pendientes de check-in).
    // El texto se lee ya con `text-transform: uppercase`, así que "Hoy" llega
    // como "HOY": la comparación tiene que ser insensible a mayúsculas.
    const NOMBRES_DIA = /^(Hoy|Mañana|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)/i
    let bloquesVistos = 0

    for (const pestaña of [/^Actuales \(/, /^Pendientes \(/, /^Reagendar \(/]) {
      const boton = page.getByRole('button', { name: pestaña })
      if ((await boton.count()) === 0) continue
      await boton.click()
      await page.waitForTimeout(600)

      const titulos = await page.locator('h4').allInnerTexts()
      for (const titulo of titulos.filter((t) => /cita\(s\)/i.test(t))) {
        expect(titulo, `encabezado con formato inválido: "${titulo}"`).toMatch(NOMBRES_DIA)
        expect(titulo).toMatch(/·\s*\d+\s*cita\(s\)/i)
        bloquesVistos += 1
      }
    }

    // Si no hay ninguna cita agendada, el panel debe decirlo en vez de quedar
    // en blanco (pasa a medianoche, cuando no queda nada por resolver).
    if (bloquesVistos === 0) {
      const vacio = await page.locator('text=/No hay citas|Ninguna cita|ya están resueltas/').count()
      expect(vacio, 'sin citas debe mostrarse el mensaje de estado vacío').toBeGreaterThan(0)
    }
  })

  test('no hay errores en consola ni respuestas 4xx/5xx', async ({ page }) => {
    const errores: string[] = []
    page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
    page.on('pageerror', (e) => errores.push(`PAGEERROR: ${e.message}`))
    page.on('requestfailed', (r) => errores.push(`${r.url()} — ${r.failure()?.errorText}`))
    // El mensaje de consola de un 400 no trae la URL: se registra aquí.
    page.on('response', (r) => {
      if (r.status() >= 400) errores.push(`HTTP ${r.status()} ${r.url()}`)
    })

    await entrar(page)
    await page.waitForTimeout(4000)

    // ERR_ABORTED son peticiones canceladas al desmontar el componente: no
    // son fallos, el componente ya no las necesita.
    const reales = [...new Set(errores)].filter((e) => !/favicon|ERR_ABORTED/.test(e))
    expect(reales, `errores en el navegador:\n${reales.join('\n')}`).toEqual([])
  })
})
test('la barra superior muestra la fecha real, no una fija', async ({ page }) => {
  await entrar(page)

  // Antes la barra tenía 'Martes, 24 de septiembre de 2024' hardcodeado.
  const encabezado = await page.locator('header p').first().innerText()
  const anioActual = new Date().getFullYear()
  expect(encabezado, `la barra superior aún muestra "${encabezado}"`).toContain(String(anioActual))

  // Y el saludo debe concordar con la hora del reloj.
  const greeting = await page.locator('header h1').first().innerText()
  const hora = new Date().getHours()
  const esperado = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  expect(greeting).toContain(esperado)
})

test.describe('agendar cita', () => {
  /**
   * Elige un médico por fragmento de nombre. `selectOption({ label })` solo
   * acepta texto exacto, así que se busca la opción que coincida y se usa su
   * valor.
   */
  async function elegirMedico(page: Page, nombre: RegExp) {
    // El modal carga médicos y disponibilidad desde Supabase: se espera a que
    // exista el desplegable con más de una opción antes de interactuar.
    const selector = page.locator('select').first()
    await expect(selector).toBeAttached({ timeout: 30_000 })
    await expect
      .poll(async () => (await selector.locator('option').count()) > 1, { timeout: 30_000 })
      .toBe(true)

    const opciones = await selector.locator('option').evaluateAll((els) =>
      els.map((e) => ({ valor: (e as HTMLOptionElement).value, texto: e.textContent ?? '' })),
    )
    expect(opciones.length, 'debe listar los médicos activos').toBeGreaterThan(1)

    const elegida = opciones.find((o) => o.valor && nombre.test(o.texto))
    expect(elegida, `no se encontró el médico ${nombre} entre: ${opciones.map((o) => o.texto).join(' | ')}`).toBeTruthy()

    await selector.selectOption(elegida!.valor)
    return selector
  }

  /**
   * Abre el módulo de Citas y el modal de agendar, con el médico ya elegido.
   *
   * Se espera a que el modal esté montado (encabezado + desplegable) antes de
   * interactuar: pulsar "agendar" en cuanto aparece el botón deja la sección de
   * disponibilidad todavía renderizándose y el `<select>` puede tardar.
   */
  async function abrirAgendar(page: Page, medico: RegExp) {
    await entrar(page)
    await page.getByRole('button', { name: /^Citas/ }).first().click()

    const abrir = page.getByRole('button', { name: /agendar|nueva cita/i }).first()
    await expect(abrir).toBeEnabled({ timeout: 20_000 })
    await abrir.click()

    // El modal ya se montó cuando aparece el encabezado de disponibilidad.
    await expect(page.getByText('Fechas y horarios disponibles')).toBeVisible({ timeout: 30_000 })
    return elegirMedico(page, medico)
  }

  /** Lee los horarios en formato 12 h que el modal ofrece. */
  const leerHoras = (page: Page) =>
    page
      .getByRole('button', { name: /^\d{1,2}:\d{2}\s?(AM|PM)$/i })
      .allInnerTexts()
      .then((t) => t.map((h) => h.trim()))

  /**
   * Salta a la última tarjeta de día (una fecha futura).
   *
   * `cargarDisponibilidad` (lib/supabase/datos.ts) descarta de la tarjeta de
   * HOY las horas que ya pasaron, así que a partir de las 13:00 el 1:00 PM ya
   * no aparece y cualquier aserción sobre el horario completo dependería de la
   * hora en que corra la prueba. En un día futuro siempre están las 14 horas.
   */
  const irAFuturo = async (page: Page) => {
    const dias = page
      .getByRole('button')
      .filter({ hasText: /^(Domingo|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado)$/i })
    await dias.last().click()
    await expect(dias.last()).toHaveAttribute('aria-pressed', 'true')
  }

  test('los horarios ofrecidos caen en las ventanas reales del médico', async ({ page }) => {
    await abrirAgendar(page, /Carlos Mendoza/)

    const horas = await leerHoras(page)
    expect(horas.length, 'debe ofrecer al menos un horario').toBeGreaterThan(0)

    // Mendoza atiende la jornada común: 2 ventanas de tarde, de 1:00 PM a
    // 7:40 PM, con la comida fuera (nada entre las 1:50 PM y las 3:30 PM).
    const minutos = (h: string) => {
      const m = h.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      if (!m) return null
      let hh = Number(m[1]) % 12
      if (/pm/i.test(m[3])) hh += 12
      return hh * 60 + Number(m[2])
    }
    const aMin = (s: string) => { const [x, y] = s.split(':').map(Number); return x * 60 + y }
    const ventanas = [['13:00', '14:15'], ['15:30', '20:05']].map(
      ([a, b]) => [aMin(a), aMin(b)] as const,
    )

    const fuera = horas.filter((h) => {
      const min = minutos(h)
      return min === null || !ventanas.some(([a, b]) => min >= a && min < b)
    })
    expect(fuera, `horarios fuera de la agenda de Mendoza: ${fuera.join(', ')}`).toEqual([])
  })

  test('el modal ofrece los 7 días de la semana para todos los médicos', async ({ page }) => {
    await abrirAgendar(page, /Carlos Mendoza/)

    // Cada tarjeta lleva SOLO el nombre del día ("Lunes", "Miércoles"...), sin la
    // fecha corta debajo. Se toman los botones cuyo texto es un nombre de día, lo
    // que deja fuera los botones de hora ("9:00 AM") sin depender del markup.
    const NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const leerDias = () =>
      page
        .getByRole('button')
        .filter({ hasText: /^(Domingo|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado)$/i })
        .allInnerTexts()
        .then((t) => t.map((d) => d.trim()))

    for (const medico of ['Carlos Mendoza', 'Ana López', 'Sofía Herrera']) {
      await elegirMedico(page, new RegExp(medico))
      const dias = await leerDias()

      // `diasVista` es 7: exactamente una semana, sin repetir ni cortar.
      // Antes iba en 10 y se veía lunes, martes, miércoles… y vuelta a empezar.
      // OJO: la tarjeta de HOY se descarta cuando ya no le quedan horas
      // futuras (`datos.ts` filtra lo pasado), así que de noche se ven 6.
      expect(
        dias.length,
        `${medico}: deben verse 6-7 días, se vieron ${dias.length}: ${dias.join(' · ')}`,
      ).toBeGreaterThanOrEqual(6)
      expect(
        dias.length,
        `${medico}: deben verse 6-7 días, se vieron ${dias.length}: ${dias.join(' · ')}`,
      ).toBeLessThanOrEqual(7)

      // Los días visibles son únicos y con el nombre real del calendario
      // (sin "Hoy" ni "Mañana").
      const reales = dias.map((d) => d.toLowerCase())
      expect(new Set(reales).size, `${medico}: hay días repetidos: ${dias.join(', ')}`).toBe(dias.length)
      for (const n of NOMBRES) {
        if (!reales.includes(n.toLowerCase())) {
          // El único día que puede faltar es el de hoy, ya sin horas futuras.
          const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long' }).toLowerCase()
          expect(n.toLowerCase(), `${medico}: falta ${n} (se vio: ${dias.join(', ')})`).toBe(hoy)
        }
      }
    }
  })

  test('todos los médicos ofrecen exactamente la misma jornada', async ({ page }) => {
    await abrirAgendar(page, /Carlos Mendoza/)
    await irAFuturo(page)
    const mendez = await leerHoras(page)

    // La clínica dio un único horario para los 6 médicos: cambiar de médico en
    // el modal no debe mover ni una sola hora. Antes cada médico tenía su
    // franja propia y esta prueba comprobaba lo contrario.
    await elegirMedico(page, /Ana López/)
    await page.waitForTimeout(1500)
    // Cambiar de médico vuelve a la primera tarjeta (la de hoy), así que hay que
    // volver a un día futuro antes de leer.
    await irAFuturo(page)
    const lopez = await leerHoras(page)

    expect(lopez.length, 'ninguna hora disponible para Ana López').toBeGreaterThan(0)
    expect(lopez, 'los médicos deben ofrecer la misma lista de horas').toEqual(mendez)

    // Y esa lista es la tarde de 1:00 PM a 7:40 PM (migración 015), 14 horas:
    // 3 en la ventana corta de 1:00 a 1:50 PM y 11 entre 3:30 y 7:40 PM.
    expect(mendez.join(' ')).toContain('1:00 PM')
    expect(mendez.join(' ')).toContain('7:40 PM')
    expect(
      mendez.length,
      `se esperaban 14 horas y se vieron ${mendez.length}: ${mendez.join(' · ')}`,
    ).toBe(14)
  })
})