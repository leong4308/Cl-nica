export type PacienteExportar = {
  hora?: string
  nombre: string
  identificacion: string
  medico?: string
  motivo?: string
  telefono: string
  nacimiento?: string
  estado: string
}

export function exportarPacientesPDF(pacientes: PacienteExportar[], rol?: string): void {
  if (pacientes.length === 0) {
    alert('No hay pacientes disponibles para exportar.')
    return
  }

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

  const totalPacientes = pacientes.length

  const filasTabla = pacientes
    .map((p, i) => {
      const estadoNorm = (p.estado || '').toLowerCase()
      let estiloBadge = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;'
      if (estadoNorm.includes('activ')) {
        estiloBadge = 'background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;'
      } else if (estadoNorm.includes('inactiv') || estadoNorm.includes('baja')) {
        estiloBadge = 'background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;'
      }

      return `
        <tr style="border-bottom: 1px solid #e2e8f0; ${i % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
          <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; white-space: nowrap; font-size: 11px;">
            ${p.hora || '—'}
          </td>
          <td style="padding: 10px 12px; font-weight: 600; color: #1e293b; font-size: 12px;">
            ${p.nombre || 'Sin nombre'}
          </td>
          <td style="padding: 10px 12px; font-weight: 500; color: #64748b; font-size: 11px; white-space: nowrap;">
            ${p.identificacion || '—'}
          </td>
          <td style="padding: 10px 12px; font-weight: 600; color: #0369a1; font-size: 11px;">
            ${p.medico || 'Por asignar'}
          </td>
          <td style="padding: 10px 12px; color: #475569; font-size: 11px;">
            ${p.motivo || 'Consulta general'}
          </td>
          <td style="padding: 10px 12px; color: #475569; font-size: 11px; white-space: nowrap;">
            ${p.telefono || '—'}
          </td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; ${estiloBadge}">
              ${p.estado || 'Activo'}
            </span>
          </td>
        </tr>
      `
    })
    .join('')

  const tituloDocumento = rol === 'recepcionista' ? 'Directorio de Pacientes - Recepción' : 'Padrón General de Pacientes'
  const subtituloDocumento = rol === 'recepcionista'
    ? 'Sistema Integral de Gestión Médica • Control de Expedientes y Recepción'
    : 'Sistema Integral de Gestión Médica • Directorio Central de Pacientes'

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
      <div class="no-print barra-herramientas">
        <div>
          <h2 style="margin: 0; font-size: 14px; font-weight: 700; color: #ffffff;">${tituloDocumento}</h2>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #94a3b8;">${totalPacientes} pacientes registrados</p>
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

      <div class="hoja-documento" id="reportePacientes">
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
              ${totalPacientes} pacientes registrados
            </div>
          </div>
        </header>

        <main>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">
                  <th style="padding: 9px 12px; width: 11%;">Hora</th>
                  <th style="padding: 9px 12px; width: 22%;">Paciente</th>
                  <th style="padding: 9px 12px; width: 13%;">Identificación</th>
                  <th style="padding: 9px 12px; width: 20%;">Médico que atiende</th>
                  <th style="padding: 9px 12px; width: 16%;">Motivo de Consulta</th>
                  <th style="padding: 9px 12px; width: 10%;">Teléfono</th>
                  <th style="padding: 9px 12px; width: 8%; text-align: center;">Estado</th>
                </tr>
              </thead>
              <tbody>
                ${filasTabla}
              </tbody>
            </table>
          </div>
        </main>

        <footer style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">
          <span>Documento confidencial para uso interno de Clínica Nova.</span>
          <span>Clínica Nova</span>
        </footer>
      </div>

      <script>
        function descargarDocumentoPDF() {
          const btn = document.getElementById('btnDescargaPdf');
          if (btn) btn.innerText = '⏳ Generando PDF...';

          const elemento = document.getElementById('reportePacientes');
          const opciones = {
            margin: [10, 10, 10, 10],
            filename: 'directorio_pacientes_clinica_nova.pdf',
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
