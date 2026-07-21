// ========== DATA MANAGEMENT ==========
class LoanManagementSystem {
  constructor() {
    this.usuarios = this.cargarDatos("usuarios") || []
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.renderSecciones()
    this.actualizarDashboard()
    // Central number formatting helper (uses app.formatNumber when available)
    this.formatNumber = (num) => (window.app && typeof window.app.formatNumber === 'function') ? window.app.formatNumber(num) : new Intl.NumberFormat('es-CO').format(num)
  }

  cargarDatos(key) {
    const datos = localStorage.getItem(key)
    return datos ? JSON.parse(datos) : null
  }

  guardarDatos(key, data) {
    localStorage.setItem(key, JSON.stringify(data))
  }

  setupEventListeners() {
    // Navegación
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", (e) => this.cambiarSeccion(e.target.closest(".nav-item").dataset.section))
    })

    // Usuarios
    document.getElementById("btn-nuevo-usuario").addEventListener("click", () => this.abrirModal())
    document.getElementById("btn-close-modal").addEventListener("click", () => this.cerrarModal())
    document.getElementById("btn-cancel").addEventListener("click", () => this.cerrarModal())
    document.getElementById("form-usuario").addEventListener("submit", (e) => this.guardarUsuario(e))

    // Filtros de análisis
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.filtrarTablas(e.target.dataset.filter))
    })

    // Exportación
    // Exportar a Excel (usuarios) eliminado: ver sección "Exportar" para opciones disponibles
    document.getElementById("btn-export-pdf").addEventListener("click", () => this.exportarPDF())

    // Pagos y Cuotas
    document.getElementById("btn-pagar-cuota").addEventListener("click", (e) => this.pagarCuota(e))

    // Modal overlay
    document.addEventListener("click", (e) => {
      const modal = document.getElementById("modal-usuario")
      if (e.target === document.querySelector(".modal-overlay")) {
        this.cerrarModal()
      }
    })
  }

  // ========== VALIDACIONES ==========
  validarNombre(nombre) {
    const regex = /^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+$/
    return regex.test(nombre) && nombre.trim().length >= 3
  }

  validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  }

  validarTelefono(telefono) {
    const regex = /^[\d+\s\-()]{7,}$/
    return regex.test(telefono.replace(/\s/g, ""))
  }

  limpiarErrores() {
    document.querySelectorAll(".error-message").forEach((msg) => (msg.textContent = ""))
    document.querySelectorAll("input").forEach((input) => input.classList.remove("error"))
  }

  mostrarError(inputId, mensaje) {
    const input = document.getElementById(inputId)
    const errorDiv = document.getElementById(`error-${inputId}`)
    if (input && errorDiv) {
      input.classList.add("error")
      errorDiv.textContent = mensaje
    }
  }

  validarFormulario() {
    this.limpiarErrores()
    const nombre = document.getElementById("nombre").value.trim()
    const telefono = document.getElementById("telefono").value.trim()
    const email = document.getElementById("email").value.trim()
    const direccion = document.getElementById("direccion").value.trim()
    const monto = Number.parseFloat(document.getElementById("monto-prestamo").value)
    const tasa = Number.parseFloat(document.getElementById("tasa-interes").value)
    const plazo = Number.parseInt(document.getElementById("plazo").value)

    let valido = true

    if (!nombre) {
      this.mostrarError("nombre", "El nombre es obligatorio")
      valido = false
    } else if (!this.validarNombre(nombre)) {
      this.mostrarError("nombre", "Solo se permiten letras y espacios")
      valido = false
    }

    if (!telefono) {
      this.mostrarError("telefono", "El teléfono es obligatorio")
      valido = false
    } else if (!this.validarTelefono(telefono)) {
      this.mostrarError("telefono", "Formato de teléfono inválido")
      valido = false
    }

    if (!email) {
      this.mostrarError("email", "El email es obligatorio")
      valido = false
    } else if (!this.validarEmail(email)) {
      this.mostrarError("email", "Email inválido")
      valido = false
    }

    if (direccion && !/^[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s,#-]+$/.test(direccion)) {
      this.mostrarError("direccion", "Dirección inválida")
      valido = false
    }

    if (!monto || monto <= 0) {
      this.mostrarError("monto-prestamo", "Ingrese un monto válido")
      valido = false
    }

    if (!tasa || tasa < 0 || tasa > 100) {
      this.mostrarError("tasa-interes", "La tasa debe estar entre 0 y 100")
      valido = false
    }

    if (!plazo || plazo < 1 || plazo > 360) {
      this.mostrarError("plazo", "El plazo debe estar entre 1 y 360 meses")
      valido = false
    }

    return valido
  }

  // ========== MODALES Y USUARIOS ==========
  abrirModal(usuario = null) {
    this.limpiarErrores()
    const modal = document.getElementById("modal-usuario")
    const form = document.getElementById("form-usuario")
    const title = document.getElementById("modal-title")

    if (usuario) {
      title.textContent = "Editar Usuario"
      form.dataset.usuarioId = usuario.id
      document.getElementById("nombre").value = usuario.nombre
      document.getElementById("telefono").value = usuario.telefono
      document.getElementById("email").value = usuario.email
      document.getElementById("direccion").value = usuario.direccion || ""
      document.getElementById("monto-prestamo").value = usuario.monto
      document.getElementById("tasa-interes").value = usuario.tasa
      document.getElementById("plazo").value = usuario.plazo
    } else {
      title.textContent = "Nuevo Usuario"
      delete form.dataset.usuarioId
      form.reset()
    }

    modal.classList.remove("hidden")
  }

  cerrarModal() {
    document.getElementById("modal-usuario").classList.add("hidden")
    document.getElementById("form-usuario").reset()
  }

  guardarUsuario(e) {
    e.preventDefault()

    if (!this.validarFormulario()) {
      return
    }

    const usuarioId = document.getElementById("form-usuario").dataset.usuarioId
    const nuevoUsuario = {
      id: usuarioId || Date.now().toString(),
      nombre: document.getElementById("nombre").value.trim(),
      telefono: document.getElementById("telefono").value.trim(),
      email: document.getElementById("email").value.trim(),
      direccion: document.getElementById("direccion").value.trim() || "No especificada",
      monto: Number.parseFloat(document.getElementById("monto-prestamo").value),
      tasa: Number.parseFloat(document.getElementById("tasa-interes").value),
      plazo: Number.parseInt(document.getElementById("plazo").value),
      fechaCreacion: usuarioId ? this.usuarios.find((u) => u.id === usuarioId).fechaCreacion : new Date().toISOString(),
      cuotas: usuarioId
        ? this.usuarios.find((u) => u.id === usuarioId).cuotas
        : this.generarCuotas(
            Number.parseFloat(document.getElementById("monto-prestamo").value),
            Number.parseFloat(document.getElementById("tasa-interes").value),
            Number.parseInt(document.getElementById("plazo").value),
          ),
    }

    if (usuarioId) {
      const index = this.usuarios.findIndex((u) => u.id === usuarioId)
      this.usuarios[index] = nuevoUsuario
      this.mostrarNotificacion("Usuario actualizado correctamente", "success")
    } else {
      this.usuarios.push(nuevoUsuario)
      this.mostrarNotificacion("Usuario creado correctamente", "success")
    }

    this.guardarDatos("usuarios", this.usuarios)
    this.cerrarModal()
    this.renderTablaUsuarios()
    this.actualizarDashboard()
  }

  generarCuotas(monto, tasaAnual, plazoMeses) {
    // Improved amortization: monthly rate, rounding and residual fix
    const cuotas = []
    const tasaMensual = tasaAnual / 100 / 12

    // Handle zero-interest loans
    let cuotaMensual
    if (tasaMensual === 0) {
      cuotaMensual = monto / plazoMeses
    } else {
      cuotaMensual = (monto * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses))) / (Math.pow(1 + tasaMensual, plazoMeses) - 1)
    }

    let saldoPendiente = monto
    const fechaInicio = new Date()

    for (let i = 1; i <= plazoMeses; i++) {
      const interesCuota = saldoPendiente * tasaMensual
      const capitalCuota = cuotaMensual - interesCuota
      saldoPendiente -= capitalCuota

      const fechaCuota = new Date(fechaInicio)
      fechaCuota.setMonth(fechaCuota.getMonth() + i)

      // Calculate simple pendiente: remaining capital + remaining interest
      const capitalPendiente = monto - (capitalCuota * (i - 1))
      const cuotasFaltantes = plazoMeses - (i - 1)
      const interesPendiente = (capitalPendiente * tasaMensual) * cuotasFaltantes

      cuotas.push({
        numero: i,
        fecha: fechaCuota.toISOString().split("T")[0],
        cuota: cuotaMensual,
        capital: capitalCuota,
        interes: interesCuota,
        saldoPendiente: Math.max(0, capitalPendiente + interesPendiente),
        pagado: false,
        montoPagado: 0,
        fechaPago: null,
      })
    }

    // Fix rounding residuals so capitals sum to original monto
    const sumCapital = cuotas.reduce((s, c) => s + c.capital, 0)
    const residual = monto - sumCapital
    if (Math.abs(residual) > 0.0001) {
      const last = cuotas[cuotas.length - 1]
      if (last) {
        last.capital += residual
        last.cuota += residual
        last.saldoPendiente = Math.max(0, last.saldoPendiente - residual)
      }
    }

    // Round values to 2 decimals
    cuotas.forEach((c) => {
      c.cuota = Number(c.cuota.toFixed(2))
      c.capital = Number(c.capital.toFixed(2))
      c.interes = Number(c.interes.toFixed(2))
      c.saldoPendiente = Number(c.saldoPendiente.toFixed(2))
    })

    return cuotas
  }

  editarUsuario(usuarioId) {
    const usuario = this.usuarios.find((u) => u.id === usuarioId)
    if (usuario) {
      this.abrirModal(usuario)
    }
  }

  eliminarUsuario(usuarioId) {
    if (confirm("¿Está seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.")) {
      this.usuarios = this.usuarios.filter((u) => u.id !== usuarioId)
      this.guardarDatos("usuarios", this.usuarios)
      this.renderTablaUsuarios()
      this.actualizarDashboard()
      this.mostrarNotificacion("Usuario eliminado correctamente", "success")
    }
  }

  pagarCuota(e) {
    e.preventDefault()

    const usuarioId = document.getElementById("form-pago").dataset.usuarioId
    const cuotaNumero = Number.parseInt(document.getElementById("cuota-numero").value)

    const usuario = this.usuarios.find((u) => u.id === usuarioId)
    if (usuario) {
      const cuota = usuario.cuotas.find((c) => c.numero === cuotaNumero)
      if (cuota && !cuota.pagado) {
        cuota.pagado = true
        // Record payment amount and date (default to full cuota)
        cuota.montoPagado = cuota.montoPagado || cuota.cuota
        cuota.fechaPago = new Date().toISOString().split("T")[0]
        this.guardarDatos("usuarios", this.usuarios)
        this.renderTablaPagos()
        this.actualizarDashboard()
        this.mostrarNotificacion("Cuota pagada correctamente", "success")
      } else {
        this.mostrarNotificacion("Cuota ya pagada o no encontrada", "error")
      }
    } else {
      this.mostrarNotificacion("Usuario no encontrado", "error")
    }
  }

  // ========== RENDER SECCIONES ==========
  cambiarSeccion(seccion) {
    document.querySelectorAll(".nav-item").forEach((btn) => btn.classList.remove("active"))
    document.querySelectorAll(".section").forEach((sec) => sec.classList.remove("active"))

    document.querySelector(`[data-section="${seccion}"]`).classList.add("active")
    document.getElementById(seccion).classList.add("active")

    const titles = {
      dashboard: "Panel de Control",
      usuarios: "Gestión de Usuarios",
      analisis: "Análisis de Riesgo",
      exportar: "Exportar Datos",
      pagos: "Pagos y Cuotas",
    }

    document.getElementById("section-title").textContent = titles[seccion]

    if (seccion === "analisis") {
      this.renderAnalisis()
    } else if (seccion === "exportar") {
      this.actualizarInfoExportacion()
    } else if (seccion === "pagos") {
      this.renderTablaPagos()
    }
  }

  renderSecciones() {
    this.renderTablaUsuarios()
  }

  renderTablaUsuarios() {
    const tbody = document.getElementById("usuarios-tbody")
    const emptyState = document.getElementById("empty-usuarios")

    if (this.usuarios.length === 0) {
      tbody.innerHTML = ""
      emptyState.style.display = "block"
      return
    }

    emptyState.style.display = "none"
    tbody.innerHTML = this.usuarios
      .map(
        (usuario) => `
            <tr>
                <td>${usuario.nombre}</td>
                <td>${usuario.telefono}</td>
                <td>${usuario.email}</td>
                <td>${usuario.direccion}</td>
                <td>$${this.formatNumber(usuario.monto)}</td>
                <td>${usuario.tasa}%</td>
                <td>${usuario.plazo}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action btn-edit" onclick="app.editarUsuario('${usuario.id}')">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor"/>
                                <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
                            </svg>
                            Editar
                        </button>
                        <button class="btn-action btn-delete" onclick="app.eliminarUsuario('${usuario.id}')">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z" fill="currentColor"/>
                            </svg>
                            Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `,
      )
      .join("")
  }

  renderTablaPagos() {
    const tbody = document.getElementById("pagos-tbody")
    const emptyState = document.getElementById("empty-pagos")

    if (this.usuarios.length === 0) {
      tbody.innerHTML = ""
      emptyState.style.display = "block"
      return
    }

    emptyState.style.display = "none"
    tbody.innerHTML = this.usuarios
      .map((usuario) => {
        return usuario.cuotas
          .map((cuota) => {
            return `
                <tr>
                    <td>${usuario.nombre}</td>
                    <td>${cuota.numero}</td>
                    <td>${cuota.fecha}</td>
                    <td>$${this.formatNumber(cuota.cuota)}</td>
                    <td>$${this.formatNumber(cuota.capital)}</td>
                    <td>$${this.formatNumber(cuota.interes)}</td>
                    <td>$${this.formatNumber(cuota.saldoPendiente)}</td>
                    <td>${cuota.pagado ? "Pagado" : "Pendiente"}</td>
                    <td>
                        ${cuota.pagado ? "" : '<button class="btn-action btn-pay" onclick="app.pagarCuota(event)">Pagar</button>'}
                    </td>
                </tr>
            `
          })
          .join("")
      })
      .join("")
  }

  // ========== DASHBOARD ==========
  actualizarDashboard() {
    const totalUsuarios = this.usuarios.length
    const totalPrestamos = this.usuarios.length
    const capitalDesembolsado = this.usuarios.reduce((sum, u) => sum + u.monto, 0)
    const interesesGenerados = this.usuarios.reduce((sum, u) => {
      return sum + u.cuotas.reduce((s, c) => s + c.interes, 0)
    }, 0)
    // Total pending should be sum of remaining principal (sum of capital portions of unpaid cuotas)
    const totalSaldoPendiente = this.usuarios.reduce((sum, u) => {
      const cuotasPendientes = u.cuotas.filter((c) => !c.pagado)
      return sum + cuotasPendientes.reduce((s, c) => s + (c.capital || 0), 0)
    }, 0)

    document.getElementById("kpi-usuarios").textContent = totalUsuarios
    document.getElementById("kpi-prestamos").textContent = totalPrestamos
  document.getElementById("kpi-capital").textContent = `$${this.formatNumber(capitalDesembolsado)}`
  document.getElementById("kpi-intereses").textContent = `$${this.formatNumber(interesesGenerados)}`
  document.getElementById("total-saldo").textContent = `$${this.formatNumber(totalSaldoPendiente)}`

    const maxSaldo = capitalDesembolsado || 100
    const porcentajeSaldo = (totalSaldoPendiente / maxSaldo) * 100
    document.getElementById("saldo-progress").style.width = Math.min(porcentajeSaldo, 100) + "%"

    this.renderCharts()
  }

  renderCharts() {
    const canvas = document.getElementById("prestamoChart")
    if (!canvas || !canvas.getContext) return

    const ctx = canvas.getContext("2d")
    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    // Datos para el gráfico
    const datos = this.usuarios.slice(0, 5)
    if (datos.length === 0) {
      ctx.fillStyle = "#999999"
      ctx.font = "14px Arial"
      ctx.textAlign = "center"
      ctx.fillText("Sin datos", width / 2, height / 2)
      return
    }

    const barWidth = width / datos.length
    const maxMonto = Math.max(...datos.map((u) => u.monto))
    const barHeight = height * 0.8
    const startY = height * 0.1

    const colors = ["#0066CC", "#6633FF", "#00AA66", "#FF8800", "#FF3333"]

    datos.forEach((usuario, index) => {
      const x = index * barWidth + 10
      const valor = usuario.monto
      const altura = (valor / maxMonto) * barHeight
      const y = startY + barHeight - altura

      // Barra con gradiente
      const gradient = ctx.createLinearGradient(x, y, x, y + altura)
      gradient.addColorStop(0, colors[index])
      gradient.addColorStop(1, colors[index] + "cc")

      ctx.fillStyle = gradient
      ctx.fillRect(x, y, barWidth - 20, altura)

      // Etiqueta
      ctx.fillStyle = "#666666"
      ctx.font = "11px Arial"
      ctx.textAlign = "center"
      ctx.fillText(usuario.nombre.split(" ")[0].substring(0, 8), x + (barWidth - 20) / 2, height - 5)
    })
  }

  // ========== ANÁLISIS ==========
  renderAnalisis() {
    this.actualizarTablaEndeudados()
    this.actualizarTablaCuotasVencidas()
    this.actualizarResumenRiesgos()
  }

  calcularRiesgo(usuario) {
    const cuotasPendientes = usuario.cuotas.filter((c) => !c.pagado)
    if (cuotasPendientes.length === 0) return { nivel: "bajo", porcentaje: 0 }

  // Use sum of capital portions of unpaid cuotas to compute pending percentage
  const saldoPendiente = cuotasPendientes.reduce((sum, c) => sum + (c.capital || 0), 0)
    const porcentajePendiente = (saldoPendiente / usuario.monto) * 100

    if (porcentajePendiente > 70) return { nivel: "alto", porcentaje: porcentajePendiente }
    if (porcentajePendiente > 40) return { nivel: "medio", porcentaje: porcentajePendiente }
    return { nivel: "bajo", porcentaje: porcentajePendiente }
  }

  actualizarTablaEndeudados(filtro = "all") {
    const tbody = document.getElementById("tabla-endeudados")
    const emptyState = document.getElementById("empty-endeudados")

    const usuariosConRiesgo = this.usuarios
      .map((u) => ({
        ...u,
        riesgo: this.calcularRiesgo(u),
      }))
      .sort((a, b) => {
  const saldoA = a.cuotas.filter((c) => !c.pagado).reduce((s, c) => s + (c.capital || 0), 0)
  const saldoB = b.cuotas.filter((c) => !c.pagado).reduce((s, c) => s + (c.capital || 0), 0)
        return saldoB - saldoA
      })

    const usuariosFiltrados = usuariosConRiesgo.filter((u) => filtro === "all" || u.riesgo.nivel === filtro)

    if (usuariosFiltrados.length === 0) {
      tbody.innerHTML = ""
      emptyState.style.display = "block"
      return
    }

    emptyState.style.display = "none"
    tbody.innerHTML = usuariosFiltrados
      .map((usuario) => {
  // Use sum of capital for remaining principal instead of summing saldoPendiente values
  const saldoPendiente = usuario.cuotas.filter((c) => !c.pagado).reduce((sum, c) => sum + (c.capital || 0), 0)

        return `
                <tr>
                    <td>${usuario.nombre}</td>
                    <td>$${this.formatNumber(saldoPendiente)}</td>
                    <td>${usuario.riesgo.porcentaje.toFixed(1)}%</td>
                    <td>
                        <span class="risk-level ${usuario.riesgo.nivel}">
                            ${usuario.riesgo.nivel.toUpperCase()}
                        </span>
                    </td>
                    <td>
                        ${saldoPendiente > 0 ? "Pendiente" : "Al día"}
                    </td>
                </tr>
            `
      })
      .join("")
  }

  actualizarTablaCuotasVencidas(filtro = "all") {
    const tbody = document.getElementById("tabla-vencidas")
    const emptyState = document.getElementById("empty-vencidas")

    const hoy = new Date()
    const cuotasVencidas = []

    this.usuarios.forEach((usuario) => {
      usuario.cuotas.forEach((cuota) => {
        if (!cuota.pagado) {
          const fechaCuota = new Date(cuota.fecha)
          const diasVencido = Math.floor((hoy - fechaCuota) / (1000 * 60 * 60 * 24))

          if (diasVencido > 0) {
            const riesgo = this.calcularRiesgo(usuario)
            if (filtro === "all" || riesgo.nivel === filtro) {
              cuotasVencidas.push({
                nombre: usuario.nombre,
                cuotaMonto: cuota.cuota,
                diasVencido,
                montoAdeudado: cuota.saldoPendiente,
                riesgo: riesgo.nivel,
              })
            }
          }
        }
      })
    })

    if (cuotasVencidas.length === 0) {
      tbody.innerHTML = ""
      emptyState.style.display = "block"
      return
    }

    emptyState.style.display = "none"
    tbody.innerHTML = cuotasVencidas
      .map(
        (cuota) => `
            <tr>
                <td>${cuota.nombre}</td>
                <td>$${this.formatNumber(cuota.cuotaMonto)}</td>
                <td>${cuota.diasVencido} días</td>
                <td>$${this.formatNumber(cuota.montoAdeudado)}</td>
                <td>${cuota.diasVencido > 30 ? '<svg viewBox="0 0 24 24" width="16" height="16" style="display: inline-block; vertical-align: middle; margin-right: 4px;"><path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="#FF3333"/></svg> Contactar inmediatamente' : "Recordatorio"}</td>
            </tr>
        `,
      )
      .join("")
  }

  actualizarResumenRiesgos() {
    const riesgos = {
      alto: 0,
      medio: 0,
      bajo: 0,
    }

    this.usuarios.forEach((usuario) => {
      const riesgo = this.calcularRiesgo(usuario)
      riesgos[riesgo.nivel]++
    })

    document.getElementById("count-alto").textContent = riesgos.alto
    document.getElementById("count-medio").textContent = riesgos.medio
    document.getElementById("count-bajo").textContent = riesgos.bajo
  }

  filtrarTablas(filtro) {
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"))
    document.querySelector(`[data-filter="${filtro}"]`).classList.add("active")

    this.actualizarTablaEndeudados(filtro)
    this.actualizarTablaCuotasVencidas(filtro)
  }

  // ========== EXPORTACIÓN ==========
  actualizarInfoExportacion() {
    const totalPrestamos = this.usuarios.length
    const totalCapital = this.usuarios.reduce((sum, u) => sum + u.monto, 0)
    const totalIntereses = this.usuarios.reduce((sum, u) => {
      return sum + u.cuotas.reduce((s, c) => s + c.interes, 0)
    }, 0)

    if (document.getElementById("export-usuarios")) document.getElementById("export-usuarios").textContent = this.usuarios.length
    if (document.getElementById("export-prestamos")) document.getElementById("export-prestamos").textContent = totalPrestamos
    if (document.getElementById("export-capital")) document.getElementById("export-capital").textContent = `$${this.formatNumber(totalCapital)}`
    if (document.getElementById("export-intereses")) document.getElementById("export-intereses").textContent = `$${this.formatNumber(totalIntereses)}`
  }

  // exportarExcel eliminado: la exportación de usuarios a Excel fue removida del sistema.
  // Si se necesita volver a activar, implementar la funcionalidad en la sección de Exportar con controles de permiso.


  exportarPDF() {
    if (this.usuarios.length === 0) {
      this.mostrarNotificacion("No hay datos para exportar", "error")
      return
    }

    const element = document.createElement("div")
    element.style.padding = "20px"
    element.innerHTML = `
            <h1 style="text-align: center; color: #0066CC; margin-bottom: 20px;">REPORTE DE GESTIÓN DE PRÉSTAMOS</h1>
            <p style="text-align: center; color: #666; margin-bottom: 20px;">Generado el ${new Date().toLocaleString()}</p>
            
            <h2 style="color: #0066CC; margin-top: 20px; margin-bottom: 10px;">RESUMEN GENERAL</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="background-color: #f5f5f5;">
                    <td style="border: 1px solid #ddd; padding: 10px;"><strong>Total Usuarios:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 10px;">${this.usuarios.length}</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #ddd; padding: 10px;"><strong>Capital Desembolsado:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 10px;">$${this.formatNumber(this.usuarios.reduce((sum, u) => sum + u.monto, 0))}</td>
                </tr>
                <tr style="background-color: #f5f5f5;">
                    <td style="border: 1px solid #ddd; padding: 10px;"><strong>Intereses Generados:</strong></td>
                    <td style="border: 1px solid #ddd; padding: 10px;">$${this.formatNumber(this.usuarios.reduce((sum, u) => sum + u.cuotas.reduce((s, c) => s + c.interes, 0), 0))}</td>
                </tr>
            </table>

            <h2 style="color: #0066CC; margin-top: 20px; margin-bottom: 10px;">DETALLE DE USUARIOS</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background-color: #0066CC; color: white;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Nombre</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Teléfono</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Email</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Monto</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Tasa</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.usuarios
                      .map(
                        (u) => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 8px;">${u.nombre}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${u.telefono}</td>
                            <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px;">${u.email}</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${this.formatNumber(u.monto)}</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${u.tasa}%</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>

            <p style="margin-top: 30px; font-size: 11px; color: #999; text-align: center;">
                LoanTrack Pro - Sistema de Gestión de Préstamos | Confidencial
            </p>
        `

    const html2pdf = window.html2pdf
    const opt = {
      margin: 10,
      filename: `LoanTrack_${new Date().toISOString().split("T")[0]}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
    }

    html2pdf().set(opt).from(element).save()
    this.mostrarNotificacion("PDF descargado correctamente", "success")
  }

  // ========== UTILIDADES ==========
  mostrarNotificacion(mensaje, tipo = "success") {
    const notif = document.getElementById("notificacion")
    notif.textContent = mensaje
    notif.className = `notificacion ${tipo}`
    notif.classList.remove("hidden")

    setTimeout(() => {
      notif.classList.add("hidden")
    }, 3000)
  }
}

// ========== INICIALIZACIÓN ==========
const app = new LoanManagementSystem()
