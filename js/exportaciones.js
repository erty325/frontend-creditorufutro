class ExportManager {
  constructor(app) {
    this.app = app
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.actualizarInfoExportacion()
    this.cargarUsuariosEnSelector()
    window.addEventListener("datosActualizados", () => {
      this.actualizarInfoExportacion()
      this.cargarUsuariosEnSelector()
    })
    this.verificarLibrerias()
  }

  verificarLibrerias() {
    let intentos = 0
    const maxIntentos = 50 // 5 segundos máximo esperando

    const revisar = () => {
      intentos++
      const xlsxCargado = typeof window.XLSX !== "undefined" || window.XLSXLoaded === true
      const html2pdfCargado = typeof window.html2pdf !== "undefined" || window.Html2pdfLoaded === true

      if (xlsxCargado && html2pdfCargado) {
        console.log(" Librerías cargadas correctamente")
        return
      }

      if (intentos < maxIntentos) {
        setTimeout(revisar, 100)
      } else {
        console.error(" Error: Librerías no cargadas después de 5 segundos")
        this.app.mostrarNotificacion(
          "Advertencia: Las librerías de exportación pueden no estar disponibles. Recargue la página.",
          "warning",
        )
      }
    }

    revisar()
  }

  setupEventListeners() {
    const btnPDF = document.getElementById("btn-export-pdf")
    const btnExportUsuarioPDF = document.getElementById("btn-export-usuario-pdf")
    const btnExportCuadreCaja = document.getElementById("btn-export-cuadre-caja")

    // El botón de "Exportar a Excel (usuarios)" fue eliminado de la UI
    if (btnPDF) btnPDF.addEventListener("click", () => this.exportarPDF())
    if (btnExportCuadreCaja) btnExportCuadreCaja.addEventListener("click", () => this.exportarHistorialCuadreCaja())

    if (btnExportUsuarioPDF) {
      btnExportUsuarioPDF.addEventListener("click", () => {
        this.exportarTodosLosUsuariosPDF()
      })
    }

    window.exportarUsuarioPDF = (usuarioId) => this.exportarUsuarioPDF(usuarioId)
  }

  abrirImportador() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".xlsx,.xls"
    input.onchange = (e) => this.importarExcel(e)
    input.click()
  }

  importarExcel(evento) {
    const archivo = evento.target.files[0]
    if (!archivo) return

    const lector = new FileReader()
    lector.onload = (e) => {
      try {
        const XLSX = window.XLSX
        if (typeof XLSX === "undefined") {
          console.error(" XLSX no disponible")
          this.app.mostrarNotificacion("Error: Biblioteca Excel no cargada. Recargue la página.", "error")
          return
        }

        const datosArrayBuffer = e.target.result
        const workbook = XLSX.read(datosArrayBuffer, { type: "array" })

        // Get the "Usuarios" sheet
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const datos = XLSX.utils.sheet_to_json(sheet)

        if (Array.isArray(datos) && datos.length > 0) {
          const usuariosImportados = datos.map((fila) => ({
            id: fila["ID"] || Math.random().toString(36).substr(2, 9),
            nombre: fila["Nombre"] || "",
            telefono: fila["Teléfono"] || "",
            email: fila["Email"] || "",
            direccion: fila["Dirección"] || "N/A",
            monto: Number.parseFloat(fila["Monto Préstamo"]) || 0,
            tasa: Number.parseFloat(fila["Tasa (%)"]) || 0,
            plazo: Number.parseInt(fila["Plazo"]) || 0,
            periodo: fila["Período"] || "meses",
            cuotas: [],
          }))

          this.app.usuarios = usuariosImportados
          this.app.guardarDatos("usuarios", this.app.usuarios)
          this.actualizarInfoExportacion()
          this.app.mostrarNotificacion(`${usuariosImportados.length} usuarios importados correctamente`, "success")
        } else {
          this.app.mostrarNotificacion("No se encontraron datos en el archivo", "error")
        }
      } catch (error) {
        console.error(" Excel import error:", error)
        this.app.mostrarNotificacion(`Error al importar Excel: ${error.message}`, "error")
      }
    }
    lector.readAsArrayBuffer(archivo)
  }

  actualizarInfoExportacion() {
    const totalPrestamos = this.app.usuarios.length
    const totalCapital = this.app.usuarios.reduce((sum, u) => sum + (u.monto || 0), 0)

    const pendientes = this.app.usuarios.reduce((sum, u) => {
      if (!u.cuotas || u.cuotas.length === 0) return sum + (u.monto || 0)

      const cuotasPendientes = u.cuotas.filter((c) => !c.pagado)
      const saldoPendiente = cuotasPendientes.reduce((s, c) => s + (c.monto || 0), 0)
      return sum + saldoPendiente
    }, 0)

    const totalIntereses = this.app.usuarios.reduce((sum, u) => {
      return sum + (u.cuotas || []).reduce((s, c) => s + (c.interes || 0), 0)
    }, 0)

    const cuotasPendientes = this.app.usuarios.reduce((sum, u) => {
      return sum + (u.cuotas || []).filter((c) => !c.pagado).length
    }, 0)

    if (document.getElementById("export-usuarios"))
      document.getElementById("export-usuarios").textContent = this.app.usuarios.length
    if (document.getElementById("export-prestamos"))
      document.getElementById("export-prestamos").textContent = totalPrestamos
    if (document.getElementById("export-capital"))
      document.getElementById("export-capital").textContent =
        `$${totalCapital.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`
    if (document.getElementById("export-intereses"))
      document.getElementById("export-intereses").textContent =
        `$${totalIntereses.toLocaleString("es-ES", { minimumFractionDigits: 2 })}`
    if (document.getElementById("export-cuotas-pendientes"))
      document.getElementById("export-cuotas-pendientes").textContent = cuotasPendientes
    if (document.getElementById("export-ultima-update"))
      document.getElementById("export-ultima-update").textContent = new Date().toLocaleDateString("es-ES")
  }

  exportarExcel() {
    if (this.app.usuarios.length === 0) {
      this.app.mostrarNotificacion("No hay datos para exportar", "error")
      return
    }

    try {
      const XLSX = window.XLSX
      if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.utils.book_new) {
        console.error("XLSX no cargado correctamente", { XLSX, defined: typeof XLSX })
        this.app.mostrarNotificacion(
          "Error: Biblioteca de Excel no cargada correctamente. Por favor, recargue la página e intente nuevamente.",
          "error",
        )
        return
      }

      console.log("Iniciando exportación Excel")
      const wb = XLSX.utils.book_new()

      // HOJA 1: USUARIOS
      const usuariosHeaders = [
        "ID",
        "Nombre",
        "Teléfono",
        "Email",
        "Dirección",
        "Monto Préstamo",
        "Tasa (%)",
        "Plazo",
        "Período",
        "Saldo Pendiente",
        "Dinero Pagado",
        "Valor Cuota",
        "Estado",
      ]

      const usuariosData = this.app.usuarios.map((u) => {
        const cuotas = Array.isArray(u.cuotas) ? u.cuotas : []
        // Helper to pick the numeric value for an installment field and round to 2 decimals.
        const pickInstallmentValue = (c) => {
          const raw = typeof c.saldoPendiente !== 'undefined' ? c.saldoPendiente : (typeof c.monto !== 'undefined' ? c.monto : (typeof c.cuota !== 'undefined' ? c.cuota : 0))
          return Number(Number(raw || 0).toFixed(2))
        }

        const rawSaldo = cuotas.length === 0
          ? (u.monto || 0)
          : cuotas.filter((c) => !c.pagado).reduce((s, c) => s + pickInstallmentValue(c), 0)
        const saldoPendiente = Number(Number(rawSaldo || 0).toFixed(2))
        const valorCuota = Number(Number((cuotas.length > 0 ? (cuotas[0].cuota || 0) : 0) || 0).toFixed(2))
        const estado = cuotas.length === 0 ? 'Sin cuotas' : (cuotas.every((c) => c.pagado) ? 'Pagado' : 'Pendiente')

        // Compute total paid across cuotas including partials
        const dineroPagado = Number(
          (cuotas || [])
            .reduce((s, c) => {
              const mp = Number(c.montoPagado || 0)
              if (mp > 0) return s + mp
              // fallback: if montoPagado absent, infer from cuota - saldoPendiente
              const inferred = Number(c.cuota || 0) - Number(c.saldoPendiente || c.monto || 0)
              return s + (inferred > 0 ? inferred : 0)
            }, 0)
            .toFixed(2),
        )

        return [
          u.id || "",
          u.nombre || "",
          u.telefono || "",
          u.email || "",
          u.direccion || "N/A",
          Number(Number((u.monto || 0)).toFixed(2)),
          Number(Number((u.tasa || 0)).toFixed(2)),
          u.plazo || 0,
          u.periodo || "meses",
          saldoPendiente,
          dineroPagado,
          valorCuota,
          estado,
        ]
      })

      const ws1 = XLSX.utils.aoa_to_sheet([usuariosHeaders, ...usuariosData])
      ws1["!cols"] = [
        { wch: 10 },
        { wch: 18 },
        { wch: 15 },
        { wch: 25 },
        { wch: 25 },
        { wch: 16 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 16 },
      ]

      // Estilos para encabezado
      for (let i = 0; i < usuariosHeaders.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i })
        ws1[cellRef] = {
          v: usuariosHeaders[i],
          s: {
            fill: { fgColor: { rgb: "FF0066CC" } },
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
          },
        }
      }

      // HOJA 2: CUOTAS
      const cuotasHeaders = [
        "Usuario",
        "Cuota #",
        "Fecha",
        "Monto Original",
        "Monto Pendiente",
        "Capital",
        "Interés",
        "Pagado",
        "Fecha Pago",
      ]
      const cuotasData = []

      this.app.usuarios.forEach((u) => {
        if (u.cuotas && Array.isArray(u.cuotas)) {
          u.cuotas.forEach((c) => {
            cuotasData.push([
              u.nombre || "",
              c.numero || 0,
              c.fecha ? new Date(c.fecha).toLocaleDateString("es-ES") : "",
              Number(Number((c.cuota || 0)).toFixed(2)),
              // monto may be stored in different properties; prefer saldoPendiente then monto then cuota
              Number(Number((typeof c.saldoPendiente !== 'undefined' ? c.saldoPendiente : (c.monto || c.cuota || 0))).toFixed(2)),
              Number(Number((c.capital || 0)).toFixed(2)),
              Number(Number((c.interes || 0)).toFixed(2)),
              c.pagado ? "Sí" : "No",
              c.fechaPago ? new Date(c.fechaPago).toLocaleDateString("es-ES") : "",
            ])
          })
        }
      })

      const ws2 = XLSX.utils.aoa_to_sheet([cuotasHeaders, ...cuotasData])
      ws2["!cols"] = [
        { wch: 18 },
        { wch: 10 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 12 },
        { wch: 10 },
        { wch: 14 },
      ]

      for (let i = 0; i < cuotasHeaders.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i })
        ws2[cellRef] = {
          v: cuotasHeaders[i],
          s: {
            fill: { fgColor: { rgb: "FF00AA66" } },
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
          },
        }
      }

      // Style user rows in sheet1 based on overdue/paid
      try {
        const today = new Date()
        for (let r = 0; r < usuariosData.length; r++) {
          const row = usuariosData[r]
          const saldo = row[9]
          const valorCuota = row[10]
          // determine status from original user object
          const userObj = this.app.usuarios[r]
          const cuotas = Array.isArray(userObj.cuotas) ? userObj.cuotas : []
          const hasVencida = cuotas.some((c) => !c.pagado && c.fecha && new Date(c.fecha + 'T00:00:00') < today)
          const allPaid = cuotas.length > 0 && cuotas.every((c) => c.pagado)
          let bg = 'FFFFFF'
          if (hasVencida) bg = 'FFFFCCCC' // light red
          else if (allPaid) bg = 'FFCCFFCC' // light green
          else bg = 'FFFFFFCC' // light yellow

          for (let c = 0; c < usuariosHeaders.length; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: r + 1, c })
            const cellVal = typeof ws1[cellRef] !== 'undefined' ? ws1[cellRef].v : row[c]
            // For numeric columns, ensure Excel sees them as numbers (t: 'n')
            if (c === 6) {
              // Tasa (%) should be exported as a percentage value in Excel (e.g., 10% -> 0.10)
              const raw = Number(cellVal) || 0
              ws1[cellRef] = {
                v: raw / 100,
                t: 'n',
                z: '0%',
                s: { fill: { fgColor: { rgb: bg } } },
              }
            } else if (c === 5 || c === 9 || c === 10 || c === 11) {
              // Numeric currency columns: Monto Préstamo (5), Saldo Pendiente (9), Dinero Pagado (10), Valor Cuota (11)
              const n = Number(cellVal) || 0
              ws1[cellRef] = {
                v: n,
                t: 'n',
                z: '$#,##0.00',
                s: { fill: { fgColor: { rgb: bg } } },
              }
            } else {
              ws1[cellRef] = { v: cellVal, s: { fill: { fgColor: { rgb: bg } } } }
            }
          }
        }
      } catch (e) {
        console.warn('Error styling usuarios sheet rows', e)
      }

      // Style cuotas rows: color paid/unpaid/overdue
      try {
        const today2 = new Date()
        for (let r = 0; r < cuotasData.length; r++) {
          const row = cuotasData[r]
          const pagado = (row[7] === 'Sí')
          const fecha = row[2]
          const dueDate = fecha ? new Date(fecha) : null
          let bg = 'FFFFFF'
          if (pagado) bg = 'FFCCFFCC'
          else if (dueDate && dueDate < today2) bg = 'FFFFCCCC'
          else bg = 'FFFFFFCC'

          for (let c = 0; c < cuotasHeaders.length; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: r + 1, c })
            const cellVal = typeof ws2[cellRef] !== 'undefined' ? ws2[cellRef].v : row[c]
            // Numeric columns: monto, monto pendiente, capital, interes => ensure numeric type and format
            if (c === 3 || c === 4 || c === 5 || c === 6) {
              const n = Number(cellVal) || 0
              ws2[cellRef] = { v: n, t: 'n', z: '$#,##0.00', s: { fill: { fgColor: { rgb: bg } } } }
            } else {
              ws2[cellRef] = { v: cellVal, s: { fill: { fgColor: { rgb: bg } } } }
            }
          }
        }
      } catch (e) {
        console.warn('Error styling cuotas sheet rows', e)
      }

      // HOJA 3: RESUMEN
      const totalCapital = this.app.usuarios.reduce((sum, u) => sum + (u.monto || 0), 0)
      const totalIntereses = this.app.usuarios.reduce((sum, u) => {
        return sum + (u.cuotas || []).reduce((s, c) => s + (c.interes || 0), 0)
      }, 0)
      const totalSaldoPendiente = this.app.usuarios.reduce((sum, u) => {
        if (!u.cuotas || u.cuotas.length === 0) return sum + (u.monto || 0)
        const saldo = u.cuotas.filter((c) => !c.pagado).reduce((s, c) => s + (c.monto || 0), 0)
        return sum + saldo
      }, 0)
      const cuotasPendientes = this.app.usuarios.reduce((sum, u) => {
        return sum + (u.cuotas || []).filter((c) => !c.pagado).length
      }, 0)
      const cuotasPagadas = this.app.usuarios.reduce((sum, u) => {
        return sum + (u.cuotas || []).filter((c) => c.pagado).length
      }, 0)

      const resumenHeaders = ["MÉTRICA", "VALOR"]
      const resumenData = [
        ["Total Usuarios", this.app.usuarios.length],
        ["Total Préstamos Activos", this.app.usuarios.length],
        ["Capital Desembolsado", totalCapital],
        ["Intereses Generados", totalIntereses],
        ["Saldo Pendiente Total", totalSaldoPendiente],
        ["Cuotas Pagadas", cuotasPagadas],
        ["Cuotas Pendientes", cuotasPendientes],
        [
          "Porcentaje Pagado",
          cuotasPagadas + cuotasPendientes > 0
            ? ((cuotasPagadas / (cuotasPagadas + cuotasPendientes)) * 100).toFixed(2) + "%"
            : "0%",
        ],
        ["Fecha Exportación", new Date().toLocaleString("es-ES")],
      ]

      const ws3 = XLSX.utils.aoa_to_sheet([resumenHeaders, ...resumenData])
      ws3["!cols"] = [{ wch: 30 }, { wch: 25 }]

      for (let i = 0; i < resumenHeaders.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i })
        ws3[cellRef] = {
          v: resumenHeaders[i],
          s: {
            fill: { fgColor: { rgb: "FF6633FF" } },
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
          },
        }
      }

      // Aplicar formato de moneda a valores numéricos
      for (let i = 1; i < resumenData.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: i, c: 1 })
        if (typeof resumenData[i][1] === "number" && i <= 5) {
          ws3[cellRef] = {
            v: resumenData[i][1],
            s: { num_fmt: "$#,##0.00" },
          }
        }
      }

      // Agregar hojas al workbook
      XLSX.utils.book_append_sheet(wb, ws1, "Usuarios")
      XLSX.utils.book_append_sheet(wb, ws2, "Cuotas")
      XLSX.utils.book_append_sheet(wb, ws3, "Resumen")

      const filename = `CreditoFuturo_${new Date().toISOString().split("T")[0]}.xlsx`
      XLSX.writeFile(wb, filename)

      console.log(" Exportación Excel completada exitosamente")
      this.app.mostrarNotificacion("Archivo Excel descargado correctamente", "success")
    } catch (error) {
      console.error("Excel export error:", error)
      this.app.mostrarNotificacion(`Error al exportar: ${error.message}`, "error")
    }
  }

  exportarPDF() {
    if (this.app.usuarios.length === 0) {
      this.app.mostrarNotificacion("No hay datos para exportar", "error")
      return
    }

    try {
      const html2pdf = window.html2pdf
      if (typeof html2pdf === "undefined") {
        console.error(" html2pdf no disponible")
        this.app.mostrarNotificacion(
          "Error: Biblioteca de PDF no cargada. Por favor, recargue la página e intente nuevamente.",
          "error",
        )
        return
      }

      console.log(" Iniciando exportación PDF")

      const totalCapital = this.app.usuarios.reduce((sum, u) => sum + (u.monto || 0), 0)
      const totalIntereses = this.app.usuarios.reduce((sum, u) => {
        return sum + (u.cuotas || []).reduce((s, c) => s + (c.interes || 0), 0)
      }, 0)
      // Sum montoPagado across all cuotas (including partials). If montoPagado missing, infer from cuota - saldoPendiente
      const totalPagado = this.app.usuarios.reduce((sum, u) => {
        const s = (u.cuotas || []).reduce((ss, c) => {
          const mp = Number(c.montoPagado || 0)
          if (mp > 0) return ss + mp
          const inferred = Number(c.cuota || 0) - Number(c.saldoPendiente || c.monto || 0)
          return ss + (inferred > 0 ? inferred : 0)
        }, 0)
        return sum + s
      }, 0)
      const totalPendiente = this.app.usuarios.reduce((sum, u) => {
        const saldoUsuario =
          typeof window !== "undefined" && window.app && typeof window.app.obtenerSaldoTotalPendiente === "function"
            ? window.app.obtenerSaldoTotalPendiente(u)
            : (u.cuotas || []).filter((c) => !c.pagado).reduce((s, c) => s + (c.monto || c.cuota || 0), 0)

        return sum + (saldoUsuario || 0)
      }, 0)

      const totalCuotasPagadas = this.app.usuarios.reduce((sum, u) => {
        return sum + (u.cuotas || []).filter((c) => c.pagado).length
      }, 0)

      const totalCuotasPendientes = this.app.usuarios.reduce((sum, u) => {
        return sum + (u.cuotas || []).filter((c) => !c.pagado).length
      }, 0)

      const element = document.createElement("div")
      element.style.padding = "30px"
      element.style.backgroundColor = "white"
      element.style.fontFamily = "Arial, sans-serif"

      element.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px; border-bottom: 3px solid #0066CC; padding-bottom: 15px;">
          <h1 style="color: #0066CC; margin: 0 0 5px 0; font-size: 28px;">CreditoFuturo</h1>
          <p style="color: #666; margin: 0; font-size: 14px;">Reporte Ejecutivo de Gestión de Préstamos</p>
          <p style="color: #999; margin: 5px 0 0 0; font-size: 11px;">Generado: ${new Date().toLocaleString("es-ES")}</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e8f0ff 100%); padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="color: #0066CC; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #0066CC; padding-bottom: 8px;">RESUMEN EJECUTIVO</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #0066CC;">
              <p style="margin: 0; font-size: 11px; color: #666; font-weight: 600;">TOTAL USUARIOS</p>
              <p style="margin: 5px 0 0 0; font-size: 20px; color: #0066CC; font-weight: bold;">${this.app.usuarios.length}</p>
            </div>
            <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #00AA66;">
              <p style="margin: 0; font-size: 11px; color: #666; font-weight: 600;">CAPITAL DESEMBOLSADO</p>
              <p style="margin: 5px 0 0 0; font-size: 20px; color: #00AA66; font-weight: bold;">$${totalCapital.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
            </div>
            <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #FF9933;">
              <p style="margin: 0; font-size: 11px; color: #666; font-weight: 600;">INTERESES GENERADOS</p>
              <p style="margin: 5px 0 0 0; font-size: 20px; color: #FF9933; font-weight: bold;">$${totalIntereses.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
            </div>
            <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #6633FF;">
              <p style="margin: 0; font-size: 11px; color: #666; font-weight: 600;">MONTO PAGADO</p>
              <p style="margin: 5px 0 0 0; font-size: 20px; color: #6633FF; font-weight: bold;">$${totalPagado.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
              <p style="margin: 5px 0 0 0; font-size: 10px; color: #666;">Cuotas Pagadas: ${totalCuotasPagadas}</p>
            </div>
          </div>
          <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #FF3333; margin-top: 15px;">
            <p style="margin: 0; font-size: 11px; color: #666; font-weight: 600;">SALDO PENDIENTE</p>
            <p style="margin: 5px 0 0 0; font-size: 20px; color: #FF3333; font-weight: bold;">$${totalPendiente.toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
            <p style="margin: 5px 0 0 0; font-size: 10px; color: #666;">Cuotas Pendientes: ${totalCuotasPendientes}</p>
          </div>
        </div>

        <h2 style="color: #0066CC; margin: 25px 0 15px 0; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">DETALLE DE USUARIOS</h2>
        
        ${this.app.usuarios
          .map((u) => {
            // Total amount paid by this user (includes partial payments)
            const pagado = (u.cuotas || []).reduce((s, c) => {
              const mp = Number(c.montoPagado || 0)
              if (mp > 0) return s + mp
              const inferred = Number(c.cuota || 0) - Number(c.saldoPendiente || c.monto || 0)
              return s + (inferred > 0 ? inferred : 0)
            }, 0)
            const pendiente =
              typeof window !== "undefined" && window.app && typeof window.app.obtenerSaldoTotalPendiente === "function"
                ? window.app.obtenerSaldoTotalPendiente(u)
                : (u.cuotas || [])
                    .filter((c) => !c.pagado)
                    .reduce((s, c) => s + (c.saldoPendiente || c.monto || c.cuota || 0), 0)

            const cuotasPagadas = (u.cuotas || []).filter((c) => c.pagado).length
            const cuotasPendientes = (u.cuotas || []).filter((c) => !c.pagado).length

            return `
            <div style="margin-bottom: 18px; padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #0066CC;">
              <h3 style="margin: 0 0 10px 0; color: #0066CC; font-size: 14px; font-weight: bold;">${u.nombre || "N/A"}</h3>
              <p style="margin: 3px 0; font-size: 11px; color: #666;"><strong>Teléfono:</strong> ${u.telefono || "N/A"}</p>
              <p style="margin: 3px 0; font-size: 11px; color: #666;"><strong>Email:</strong> ${u.email || "N/A"}</p>
              <p style="margin: 3px 0; font-size: 11px; color: #666;"><strong>Dirección:</strong> ${u.direccion || "No especificada"}</p>
              <p style="margin: 3px 0; font-size: 11px; color: #666;"><strong>Monto Préstamo:</strong> $${(u.monto || 0).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
              <p style="margin: 3px 0; font-size: 11px; color: #666;"><strong>Tasa:</strong> ${u.tasa || 0}% - <strong>Plazo:</strong> ${u.plazo || 0} meses</p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #00AA66; font-weight: bold;">Pagado: $${pagado.toLocaleString("es-ES", { minimumFractionDigits: 2 })} (${cuotasPagadas} cuotas)</p>
              <p style="margin: 3px 0 0 0; font-size: 11px; color: #FF3333; font-weight: bold;">Pendiente: $${pendiente.toLocaleString("es-ES", { minimumFractionDigits: 2 })} (${cuotasPendientes} cuotas)</p>
            </div>
          `
          })
          .join("")}

        <div style="margin-top: 30px; padding: 15px; background: #f5f7fa; border-radius: 8px; border-left: 4px solid #0066CC;">
          <p style="margin: 0; font-size: 10px; color: #666; line-height: 1.6;">
            <strong style="color: #0066CC;">Nota:</strong> Este reporte contiene información confidencial de CreditoFuturo. 
            Los datos reflejan el estado actual de todos los préstamos activos.
          </p>
        </div>

        <div style="margin-top: 25px; padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: center;">
          <p style="margin: 0; font-size: 9px; color: #999;">
            CrediFast Pro &copy; 2025 - Sistema de Gestión de Préstamos | Documento generado automáticamente
          </p>
        </div>
      `

      const opt = {
        margin: 10,
        filename: `CreditoFuturo_${new Date().toISOString().split("T")[0]}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
      }

      html2pdf().set(opt).from(element).save()
      console.log("Exportación PDF completada exitosamente")
      this.app.mostrarNotificacion("Archivo PDF descargado correctamente", "success")
    } catch (error) {
      console.error("[PDF export error:", error)
      this.app.mostrarNotificacion(`Error al exportar PDF: ${error.message}`, "error")
    }
  }

  exportarTodosLosUsuariosPDF() {
    const usuarios = this.app.usuarios
    if (!usuarios || usuarios.length === 0) {
      this.app.mostrarNotificacion("No hay usuarios para exportar", "error")
      return
    }

    try {
      const html2pdf = window.html2pdf
      if (typeof html2pdf === "undefined") {
        console.error(" html2pdf no disponible")
        this.app.mostrarNotificacion(
          "Error: Biblioteca de PDF no cargada. Por favor, recargue la página e intente nuevamente.",
          "error",
        )
        return
      }

      const element = document.createElement("div")
      element.style.backgroundColor = "white"
      element.style.fontFamily = "Arial, sans-serif"

      let htmlContent = `
        <div style="background: linear-gradient(135deg, #0066CC 0%, #0052A3 100%); padding: 25px 30px; margin-bottom: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,102,204,0.3);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">Sistema de Gestión de Préstamos</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 14px; font-weight: 400;">Reporte de Usuarios • ${new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div style="background: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
              <p style="margin: 0; font-size: 11px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Usuarios</p>
              <p style="margin: 4px 0 0 0; font-size: 26px; color: #0066CC; font-weight: 700;">${usuarios.length}</p>
            </div>
          </div>
        </div>
      `

      // Loop through all users - more compact design for 2 per page
      usuarios.forEach((usuario, index) => {
        const cuotasPagadas = (usuario.cuotas || []).filter((c) => c.pagado).length
        const cuotasFaltantes = (usuario.cuotas || []).filter((c) => !c.pagado).length
        const totalCuotas = usuario.cuotas ? usuario.cuotas.length : 0
        const plazoQuincenal = usuario.periodo === "quincenas" ? totalCuotas : usuario.plazo * 2

        htmlContent += `
        ${index > 0 && index % 2 === 0 ? '<div style="page-break-before: always; padding-top: 20px;"></div>' : ""}
        
        <div style="background: linear-gradient(to bottom right, #f8fafc, #f0f4f8); padding: 20px; margin: 0 30px 20px 30px; border-radius: 10px; box-shadow: 0 3px 10px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(90deg, #0066CC 0%, #0052A3 100%); margin: -20px -20px 18px -20px; padding: 14px 20px; border-radius: 10px 10px 0 0; box-shadow: 0 2px 4px rgba(0,102,204,0.2);">
            <h3 style="color: white; margin: 0; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
              <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 4px; margin-right: 10px; font-size: 13px;">#${index + 1}</span>
              ${usuario.nombre}
            </h3>
          </div>
          
          <div style="background: white; padding: 14px 18px; border-radius: 6px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 3px solid #0066CC;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <p style="margin: 5px 0; font-size: 12px; color: #333;"><strong style="color: #666; font-size: 11px;">📱 Teléfono:</strong> ${usuario.telefono || "N/A"}</p>
              <p style="margin: 5px 0; font-size: 12px; color: #333;"><strong style="color: #666; font-size: 11px;">✉️ Email:</strong> ${usuario.email || "No especificado"}</p>
              <p style="margin: 5px 0; font-size: 12px; color: #333; grid-column: span 2;"><strong style="color: #666; font-size: 11px;">📍 Dirección:</strong> ${usuario.direccion || "No especificada"}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 12px;">
            <div style="background: white; padding: 12px 14px; border-radius: 6px; border-left: 4px solid #0066CC; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Capital</p>
              <p style="margin: 6px 0 0 0; font-size: 16px; color: #0066CC; font-weight: 700;">$${(usuario.monto || 0).toLocaleString("es-ES")}</p>
            </div>
            <div style="background: white; padding: 12px 14px; border-radius: 6px; border-left: 4px solid #FF9933; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Meses</p>
              <p style="margin: 6px 0 0 0; font-size: 16px; color: #FF9933; font-weight: 700;">${usuario.plazo || 0}</p>
            </div>
            <div style="background: white; padding: 12px 14px; border-radius: 6px; border-left: 4px solid #6633FF; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Quincenas</p>
              <p style="margin: 6px 0 0 0; font-size: 16px; color: #6633FF; font-weight: 700;">${plazoQuincenal}</p>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="background: white; padding: 12px 14px; border-radius: 6px; border-left: 4px solid #00AA66; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">✅ Pagadas</p>
              <p style="margin: 6px 0 0 0; font-size: 20px; color: #00AA66; font-weight: 700;">${cuotasPagadas}</p>
            </div>
            <div style="background: white; padding: 12px 14px; border-radius: 6px; border-left: 4px solid #FF3333; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 10px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">❌ Faltantes</p>
              <p style="margin: 6px 0 0 0; font-size: 20px; color: #FF3333; font-weight: 700;">${cuotasFaltantes}</p>
            </div>
          </div>
        </div>
        `
      })

      element.innerHTML = htmlContent

      const opt = {
        margin: [10, 0, 10, 0],
        filename: `usuarios-reporte-${new Date().toISOString().split("T")[0]}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      }

      html2pdf().set(opt).from(element).save()

      this.app.mostrarNotificacion("PDF de usuarios exportado exitosamente", "success")
    } catch (error) {
      console.error("Error al exportar PDF de usuarios:", error)
      this.app.mostrarNotificacion("Error al exportar PDF de usuarios", "error")
    }
  }

  exportarUsuarioPDF(usuarioId) {
    const usuario = this.app.usuarios.find((u) => u.id === usuarioId)
    if (!usuario) {
      this.app.mostrarNotificacion("Usuario no encontrado", "error")
      return
    }

    try {
      const html2pdf = window.html2pdf
      if (typeof html2pdf === "undefined") {
        console.error(" html2pdf no disponible")
        this.app.mostrarNotificacion(
          "Error: Biblioteca de PDF no cargada. Por favor, recargue la página e intente nuevamente.",
          "error",
        )
        return
      }

      console.log(" Iniciando exportación de usuario a PDF")

      const cuotasPagadas = (usuario.cuotas || []).filter((c) => c.pagado).length
      const cuotasFaltantes = (usuario.cuotas || []).filter((c) => !c.pagado).length
      const totalCuotas = usuario.cuotas ? usuario.cuotas.length : 0
      const plazoQuincenal = usuario.periodo === "quincenas" ? totalCuotas : usuario.plazo * 2

      const element = document.createElement("div")
      element.style.padding = "30px"
      element.style.backgroundColor = "white"
      element.style.fontFamily = "Arial, sans-serif"

      element.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px; border-bottom: 3px solid #0066CC; padding-bottom: 15px;">
          <h1 style="color: #0066CC; margin: 0 0 5px 0; font-size: 28px;">CreditoFuturo</h1>
          <p style="color: #666; margin: 0; font-size: 14px;">Reporte Individual de Usuario</p>
          <p style="color: #999; margin: 5px 0 0 0; font-size: 11px;">Generado: ${new Date().toLocaleDateString("es-ES")}</p>
        </div>
        
        <div style="background: #f0f4f8; padding: 30px; min-height: 100vh;">
          <h2 style="color: #0066CC; margin: 0 0 20px 0; font-size: 24px; border-bottom: 3px solid #0066CC; padding-bottom: 10px;">USUARIO: ${usuario.nombre}</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <p style="margin: 8px 0; font-size: 14px; color: #333;"><strong style="color: #666;">Nombre:</strong> ${usuario.nombre || "N/A"}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #333;"><strong style="color: #666;">Teléfono:</strong> ${usuario.telefono || "N/A"}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #333;"><strong style="color: #666;">Email:</strong> ${usuario.email || "No especificado"}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #333;"><strong style="color: #666;">Dirección:</strong> ${usuario.direccion || "No especificada"}</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: white; padding: 10px 12px; border-radius: 6px; border-left: 4px solid #0066CC; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Capital</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #0066CC; font-weight: 700;">$${(usuario.monto || 0).toLocaleString("es-ES")}</p>
            </div>
            <div style="background: white; padding: 10px 12px; border-radius: 6px; border-left: 4px solid #FF9933; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Meses</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #FF9933; font-weight: 700;">${usuario.plazo || 0}</p>
            </div>
            <div style="background: white; padding: 10px 12px; border-radius: 6px; border-left: 4px solid #6633FF; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Quincenas</p>
              <p style="margin: 5px 0 0 0; font-size: 14px; color: #6633FF; font-weight: 700;">${plazoQuincenal}</p>
            </div>
            <div style="background: white; padding: 10px 12px; border-radius: 6px; border-left: 4px solid #00AA66; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">✅ Pagadas</p>
              <p style="margin: 5px 0 0 0; font-size: 18px; color: #00AA66; font-weight: 700;">${cuotasPagadas}</p>
            </div>
            <div style="background: white; padding: 10px 12px; border-radius: 6px; border-left: 4px solid #FF3333; box-shadow: 0 2px 4px rgba(0,0,0,0.06);">
              <p style="margin: 0; font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">❌ Faltantes</p>
              <p style="margin: 5px 0 0 0; font-size: 18px; color: #FF3333; font-weight: 700;">${cuotasFaltantes}</p>
            </div>
          </div>
        </div>
        `

      const opt = {
        margin: [10, 0, 10, 0],
        filename: `Usuario_${usuario.nombre.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
      }

      html2pdf().set(opt).from(element).save()
      console.log("Exportación de usuario completada exitosamente")
      this.app.mostrarNotificacion("Archivo PDF del usuario descargado correctamente", "success")
    } catch (error) {
      console.error(" PDF export error:", error)
      this.app.mostrarNotificacion(`Error al exportar PDF: ${error.message}`, "error")
    }
  }

  cargarUsuariosEnSelector() {
    const select = document.getElementById("select-usuario-pdf")
    if (!select) return

    select.innerHTML = '<option value="">-- Seleccionar Usuario --</option>'

    this.app.usuarios.forEach((usuario) => {
      const option = document.createElement("option")
      option.value = usuario.id
      option.textContent = `${usuario.nombre} ${usuario.apellido} - ${usuario.cedula}`
      select.appendChild(option)
    })
  }

  exportarHistorialCuadreCaja() {
    try {
      const XLSX = window.XLSX
      if (typeof XLSX === "undefined" || !XLSX.utils || !XLSX.utils.book_new) {
        console.error("XLSX no cargado correctamente")
        this.app.mostrarNotificacion(
          "Error: Biblioteca de Excel no cargada correctamente. Por favor, recargue la página.",
          "error",
        )
        return
      }

      // Obtener historial de movimientos de caja
      const historialMovimientos = JSON.parse(localStorage.getItem('historial_movimientos') || '[]')
      const cierresHistoricos = JSON.parse(localStorage.getItem('cierres_caja_historicos') || '[]')

      if (historialMovimientos.length === 0 && cierresHistoricos.length === 0) {
        this.app.mostrarNotificacion("No hay datos de cuadre de caja para exportar", "warning")
        return
      }

      console.log("Iniciando exportación de Historial de Cuadre de Caja")
      const wb = XLSX.utils.book_new()

      // HOJA 1: MOVIMIENTOS DE CAJA (Ingresos y Egresos)
      const movimientosHeaders = [
        "Fecha Movimiento",
        "Fecha Registro",
        "Hora",
        "Tipo",
        "Descripcion",
        "Metodo/Categoria",
        "Monto",
      ]

      const movimientosCaja = historialMovimientos.filter(m => m.tipo === 'ingreso' || m.tipo === 'egreso')

      const movimientosData = movimientosCaja.map((m) => {
        // Usar fecha del movimiento estipulada si existe
        const fechaMovimiento = m.fechaMovimiento 
          ? new Date(m.fechaMovimiento + 'T12:00:00').toLocaleDateString('es-ES')
          : new Date(m.fecha || m.fechaCompleta).toLocaleDateString('es-ES')
        
        const fechaRegistro = new Date(m.fecha || m.fechaCompleta).toLocaleDateString('es-ES')
        
        return [
          fechaMovimiento,
          fechaRegistro,
          m.hora || '',
          m.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO',
          m.descripcion || '',
          m.metodo || m.categoria || '',
          m.tipo === 'ingreso' ? Number(m.monto || 0) : -Number(m.monto || 0),
        ]
      })

      const ws1 = XLSX.utils.aoa_to_sheet([movimientosHeaders, ...movimientosData])
      ws1["!cols"] = [
        { wch: 16 },
        { wch: 16 },
        { wch: 10 },
        { wch: 12 },
        { wch: 35 },
        { wch: 18 },
        { wch: 16 },
      ]

      // Estilizar encabezados
      for (let i = 0; i < movimientosHeaders.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i })
        ws1[cellRef] = {
          v: movimientosHeaders[i],
          s: {
            fill: { fgColor: { rgb: "FF6366f1" } },
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
          },
        }
      }

      // Colorear filas segun tipo
      try {
        for (let r = 0; r < movimientosData.length; r++) {
          const tipo = movimientosData[r][3]
          const bg = tipo === 'INGRESO' ? 'FFCCFFCC' : 'FFFFCCCC'
          
          for (let c = 0; c < movimientosHeaders.length; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: r + 1, c })
            const cellVal = typeof ws1[cellRef] !== 'undefined' ? ws1[cellRef].v : movimientosData[r][c]
            
            if (c === 6) {
              // Columna de monto - formato moneda
              ws1[cellRef] = { v: cellVal, t: 'n', z: '$#,##0.00', s: { fill: { fgColor: { rgb: bg } } } }
            } else {
              ws1[cellRef] = { v: cellVal, s: { fill: { fgColor: { rgb: bg } } } }
            }
          }
        }
      } catch (e) {
        console.warn('Error estilizando filas de movimientos', e)
      }

      // HOJA 2: CIERRES DE CAJA
      const cierresHeaders = [
        "Fecha",
        "Base de Caja",
        "Total Ingresos",
        "Total Egresos",
        "Balance Final",
        "Neto del Dia",
        "Cantidad Movimientos",
      ]

      const cierresData = cierresHistoricos.map((c) => [
        c.fecha || '',
        Number(c.baseCaja || 0),
        Number(c.totalIngresos || 0),
        Number(c.totalEgresos || 0),
        Number(c.balanceFinal || 0),
        Number((c.totalIngresos || 0) - (c.totalEgresos || 0)),
        c.cantidadMovimientos || (c.movimientos ? c.movimientos.length : 0),
      ])

      const ws2 = XLSX.utils.aoa_to_sheet([cierresHeaders, ...cierresData])
      ws2["!cols"] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 20 },
      ]

      // Estilizar encabezados de cierres
      for (let i = 0; i < cierresHeaders.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i })
        ws2[cellRef] = {
          v: cierresHeaders[i],
          s: {
            fill: { fgColor: { rgb: "FF8b5cf6" } },
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
          },
        }
      }

      // Formato de moneda para columnas numericas en cierres
      try {
        for (let r = 0; r < cierresData.length; r++) {
          for (let c = 1; c <= 5; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: r + 1, c })
            const val = cierresData[r][c]
            ws2[cellRef] = { v: val, t: 'n', z: '$#,##0.00' }
          }
        }
      } catch (e) {
        console.warn('Error formateando montos en cierres', e)
      }

      // HOJA 3: RESUMEN
      const totalIngresos = movimientosCaja.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto || 0), 0)
      const totalEgresos = movimientosCaja.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + Number(m.monto || 0), 0)
      const netoTotal = totalIngresos - totalEgresos

      const resumenHeaders = ["METRICA", "VALOR"]
      const resumenData = [
        ["Total Movimientos Registrados", movimientosCaja.length],
        ["Total Ingresos", totalIngresos],
        ["Total Egresos", totalEgresos],
        ["Neto Total", netoTotal],
        ["Cierres de Caja Realizados", cierresHistoricos.length],
        ["Fecha de Exportacion", new Date().toLocaleString("es-ES")],
      ]

      const ws3 = XLSX.utils.aoa_to_sheet([resumenHeaders, ...resumenData])
      ws3["!cols"] = [{ wch: 35 }, { wch: 25 }]

      // Estilizar encabezados de resumen
      for (let i = 0; i < resumenHeaders.length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i })
        ws3[cellRef] = {
          v: resumenHeaders[i],
          s: {
            fill: { fgColor: { rgb: "FF4f46e5" } },
            font: { bold: true, color: { rgb: "FFFFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
          },
        }
      }

      // Agregar hojas al workbook
      XLSX.utils.book_append_sheet(wb, ws1, "Movimientos de Caja")
      XLSX.utils.book_append_sheet(wb, ws2, "Cierres de Caja")
      XLSX.utils.book_append_sheet(wb, ws3, "Resumen")

      const filename = `HistorialCuadreCaja_${new Date().toISOString().split("T")[0]}.xlsx`
      XLSX.writeFile(wb, filename)

      console.log("Exportación de Historial de Cuadre de Caja completada exitosamente")
      this.app.mostrarNotificacion("Historial de Cuadre de Caja exportado correctamente", "success")
    } catch (error) {
      console.error("Error al exportar historial de caja:", error)
      this.app.mostrarNotificacion(`Error al exportar: ${error.message}`, "error")
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log(" Exportaciones module loaded")
  console.log("Global app object:", window.app)

  const exportManager = new ExportManager(window.app)
})
