export type CitaExportar = {
  hora: string
  paciente: string
  medico: string
  motivo: string
  estado: string
  inicio?: string
  fin?: string
}

function formatoHora12(horaStr: string, inicioIso?: string): string {
  if (/am|pm/i.test(horaStr)) return horaStr
  if (inicioIso) {
    try {
      const d = new Date(inicioIso)
      if (!isNaN(d.getTime())) {
        let h = d.getHours()
        const m = d.getMinutes().toString().padStart(2, '0')
        const ampm = h >= 12 ? 'PM' : 'AM'
        h = h % 12
        const h12 = h ? h : 12
        return `${h12}:${m} ${ampm}`
      }
    } catch {
      // fallback
    }
  }
  const partes = horaStr.split(':')
  if (partes.length === 2) {
    let h = parseInt(partes[0], 10)
    const m = partes[1].slice(0, 2)
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM'
      h = h % 12
      const h12 = h ? h : 12
      return `${h12}:${m} ${ampm}`
    }
  }
  return horaStr
}

export type OpcionesExportar = {
  esMedico?: boolean
  nombreMedico?: string
  rol?: string
}

export function exportarCitasPDF(citas: CitaExportar[], opciones: OpcionesExportar = {}): void {
  const { esMedico = false, nombreMedico = '', rol = '' } = opciones

  if (citas.length === 0) {
    alert('No hay citas disponibles para exportar.')
    return
  }

  // Agrupar citas por médico
  const gruposPorMedico = new Map<string, CitaExportar[]>()
  citas.forEach((cita) => {
    const nombre = cita.medico?.trim() || 'Médico no asignado'
    const lista = gruposPorMedico.get(nombre) || []
    lista.push(cita)
    gruposPorMedico.set(nombre, lista)
  })

  // Fecha actual de emisión
  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const horaEmision = new Date().toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const totalCitas = citas.length
  const totalMedicos = gruposPorMedico.size

  // Generar HTML de cada médico
  let htmlMedicos = ''
  gruposPorMedico.forEach((citasMedico, medico) => {
    const filasTabla = citasMedico
      .map((c, i) => {
        const hora12 = formatoHora12(c.hora, c.inicio)
        const estadoNorm = c.estado.toLowerCase()
        let estiloBadge = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;'
        if (estadoNorm.includes('confirm')) {
          estiloBadge = 'background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;'
        } else if (estadoNorm.includes('atend')) {
          estiloBadge = 'background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;'
        } else if (estadoNorm.includes('pend')) {
          estiloBadge = 'background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a;'
        } else if (estadoNorm.includes('cancel')) {
          estiloBadge = 'background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;'
        }

        if (esMedico) {
          // Layout Personal del Médico: Con espacio para notas y observaciones clínicas
          return `
            <tr style="border-bottom: 1px solid #e2e8f0; ${i % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
              <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; white-space: nowrap; font-size: 11px;">
                ${hora12}
              </td>
              <td style="padding: 10px 12px; font-weight: 600; color: #1e293b; font-size: 12px;">
                ${c.paciente}
              </td>
              <td style="padding: 10px 12px; color: #475569; font-size: 11px;">
                ${c.motivo || 'Consulta general'}
              </td>
              <td style="padding: 10px 12px; text-align: center;">
                <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; ${estiloBadge}">
                  ${c.estado}
                </span>
              </td>
              <td style="padding: 10px 12px; border-left: 1px dashed #e2e8f0; width: 140px; color: #cbd5e1; font-size: 10px;">
                &nbsp;
              </td>
            </tr>
          `
        }

        // Layout General del Administrador: 100% digital, espacioso y sin columna de firma
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; ${i % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
            <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; white-space: nowrap; font-size: 11px;">
              ${hora12}
            </td>
            <td style="padding: 10px 12px; font-weight: 600; color: #1e293b; font-size: 12px;">
              ${c.paciente}
            </td>
            <td style="padding: 10px 12px; font-weight: 600; color: #0369a1; font-size: 11px;">
              ${c.medico || 'Médico no asignado'}
            </td>
            <td style="padding: 10px 12px; color: #475569; font-size: 11px;">
              ${c.motivo || 'Consulta general'}
            </td>
            <td style="padding: 10px 12px; text-align: center;">
              <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; ${estiloBadge}">
                ${c.estado}
              </span>
            </td>
          </tr>
        `
      })
      .join('')

    const tituloSeccion = esMedico ? 'Consultas Asignadas' : 'Médico Asignado'
    const nombreMostrado = esMedico ? (nombreMedico || medico) : medico

    htmlMedicos += `
      <section style="margin-bottom: 26px; page-break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff;">
        <div style="background: #f1f5f9; padding: 12px 18px; border-bottom: 2px solid #2563eb; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.8px; color: #2563eb;">${tituloSeccion}</span>
            <h2 style="margin: 2px 0 0 0; font-size: 14px; font-weight: 700; color: #0f172a;">${nombreMostrado}</h2>
          </div>
          <div style="background: #ffffff; border: 1px solid #cbd5e1; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #334155;">
            ${citasMedico.length} ${citasMedico.length === 1 ? 'paciente agendado' : 'pacientes agendados'}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">
              ${
                esMedico
                  ? `
                    <th style="padding: 9px 12px; width: 14%;">Horario</th>
                    <th style="padding: 9px 12px; width: 34%;">Nombre del Paciente</th>
                    <th style="padding: 9px 12px; width: 26%;">Motivo de Consulta</th>
                    <th style="padding: 9px 12px; width: 12%; text-align: center;">Estado</th>
                    <th style="padding: 9px 12px; width: 14%; text-align: center;">Observaciones</th>
                  `
                  : `
                    <th style="padding: 9px 12px; width: 12%;">Horario</th>
                    <th style="padding: 9px 12px; width: 32%;">Nombre del Paciente</th>
                    <th style="padding: 9px 12px; width: 26%;">Médico que atiende</th>
                    <th style="padding: 9px 12px; width: 20%;">Motivo de Consulta</th>
                    <th style="padding: 9px 12px; width: 10%; text-align: center;">Estado</th>
                  `
              }
            </tr>
          </thead>
          <tbody>
            ${filasTabla}
          </tbody>
        </table>
      </section>
    `
  })

  const esRecepcionista = rol === 'recepcionista'
  const tituloDocumento = esMedico
    ? 'Agenda Médica Personal'
    : esRecepcionista
      ? 'Agenda General de Citas - Control de Recepción'
      : 'Reporte General de Citas y Control Clínico'

  const subtituloDocumento = esMedico
    ? `Agenda personal de consultas • Dr(a). ${nombreMedico || citas[0]?.medico || 'Médico'}`
    : esRecepcionista
      ? 'Sistema Integral de Gestión Médica • Control de Agenda y Asignación de Consultas'
      : 'Sistema Integral de Gestión Médica • Control General de Agenda'

  const pieDocumento = esMedico
    ? 'Documento confidencial para uso exclusivo del profesional médico.'
    : esRecepcionista
      ? 'Documento confidencial para uso interno de Recepción - Clínica Nova.'
      : 'Documento confidencial para uso interno de la administración de Clínica Nova.'

  const contenidoCompleto = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${tituloDocumento} - Clínica Nova</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <style>
        @page {
          size: letter portrait;
          margin: 12mm 10mm 12mm 10mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #e2e8f0;
          margin: 0;
          padding: 24px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .barra-herramientas {
          position: sticky;
          top: 12px;
          z-index: 100;
          max-width: 860px;
          margin: 0 auto 20px auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0f172a;
          color: white;
          padding: 12px 20px;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
        }
        .btn-accion {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-imprimir {
          background: #ffffff;
          color: #0f172a;
          border: 1px solid #cbd5e1;
        }
        .btn-imprimir:hover {
          background: #f1f5f9;
        }
        .btn-descargar {
          background: #2563eb;
          color: #ffffff;
          border: none;
        }
        .btn-descargar:hover {
          background: #1d4ed8;
        }
        .hoja-documento {
          max-width: 860px;
          margin: 0 auto;
          background: #ffffff;
          padding: 40px 45px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        @media print {
          .no-print { display: none !important; }
          body {
            background: #ffffff !important;
            padding: 0 !important;
          }
          .hoja-documento {
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
        }
      </style>
    </head>
    <body>
      <!-- Barra superior con los botones Imprimir y Descargar -->
      <div class="no-print barra-herramientas">
        <div>
          <h2 style="margin: 0; font-size: 14px; font-weight: 700; color: #ffffff;">${tituloDocumento}</h2>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8;">${totalCitas} citas ${esMedico ? 'asignadas' : `• ${totalMedicos} ${totalMedicos === 1 ? 'médico' : 'médicos'}`}</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn-accion btn-imprimir" onclick="window.print()">
             Imprimir
          </button>
          <button type="button" id="btnDescargaPdf" class="btn-accion btn-descargar" onclick="descargarDocumentoPDF()">
             Descargar PDF
          </button>
        </div>
      </div>

      <!-- Hoja de reporte médica -->
      <div class="hoja-documento" id="reporteClinica">
        <!-- Membrete de la Clínica -->
        <header style="border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <div style="width: 24px; height: 24px; background: #2563eb; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">+</div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">Clínica Nova</h1>
            </div>
            <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 500;">${subtituloDocumento}</p>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; text-transform: capitalize;">${fechaHoy}</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Hora de emisión: ${horaEmision}</div>
            <div style="font-size: 10px; color: #2563eb; font-weight: 600; margin-top: 3px;">
              ${totalCitas} citas ${esMedico ? 'asignadas' : `en total • ${totalMedicos} ${totalMedicos === 1 ? 'médico' : 'médicos'}`}
            </div>
          </div>
        </header>

        <!-- Bloques agrupados por Médico -->
        <main>
          ${htmlMedicos}
        </main>

        <!-- Pie de página -->
        <footer style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">
          <span>${pieDocumento}</span>
          <span>Clínica Nova</span>
        </footer>
      </div>

      <script>
        function descargarDocumentoPDF() {
          const btn = document.getElementById('btnDescargaPdf');
          if (btn) btn.innerText = '⏳ Generando PDF...';

          const elemento = document.getElementById('reporteClinica');
          const opciones = {
            margin: [10, 10, 10, 10],
            filename: 'agenda_citas_clinica_nova.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
          };

          if (window.html2pdf) {
            window.html2pdf().set(opciones).from(elemento).save().then(() => {
              if (btn) btn.innerText = '📥 Descargar PDF';
            }).catch(() => {
              if (btn) btn.innerText = '📥 Descargar PDF';
              window.print();
            });
          } else {
            if (btn) btn.innerText = '📥 Descargar PDF';
            window.print();
          }
        }
      </script>
    </body>
    </html>
  `

  const ventana = window.open('', '_blank')
  if (ventana) {
    ventana.document.open()
    ventana.document.write(contenidoCompleto)
    ventana.document.close()
  }
}
