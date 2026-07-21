class DashboardManager {
  constructor() {
    console.log("CrediFast inicializado")
    this.init()
  }

  init() {
    const esperar = (condition, callback, maxWait = 5000) => {
      const inicio = Date.now()
      const intervalo = setInterval(() => {
        if (condition()) {
          clearInterval(intervalo)
          callback()
        } else if (Date.now() - inicio > maxWait) {
          clearInterval(intervalo)
          console.error("Timeout esperando app en dashboard")
        }
      }, 100)
    }

    esperar(
      () => window.app && window.app.usuarios && Array.isArray(window.app.usuarios),
      () => {
        console.log("App listo en dashboard, renderizando")
        this.renderDashboard()
        window.addEventListener("datosActualizados", () => {
          console.log("Dashboard recibió evento datosActualizados")
          this.renderDashboard()
        })
        setInterval(() => this.renderDashboard(), 30000) // Refresh every 30 seconds
      },
    )
  }

  renderDashboard() {
    console.log("Renderizando dashboard con", window.app.usuarios.length, "usuarios")
    this.actualizarKPIs()
    this.renderRiskRankingList()
    this.renderDebtRankingList()
  }

  actualizarKPIs() {
    const usuarios = window.app.usuarios
    const totalUsuarios = usuarios.length
    const totalPrestamos = usuarios.length

    const capitalDesembolsado = usuarios.reduce((sum, u) => sum + (u.monto || 0), 0)

    const interesesGenerados = usuarios.reduce((sum, u) => {
      return sum + (u.cuotas || []).reduce((s, c) => s + (c.interes || 0), 0)
    }, 0)

    const totalSaldoPendiente = usuarios.reduce((sum, u) => {
      return sum + window.PaymentProcessor.obtenerSaldoTotalPendiente(u)
    }, 0)

    const cuotasVencidas = usuarios.reduce((sum, u) => {
      const hoy = new Date()
      const vencidas = (u.cuotas || []).filter((c) => {
        if (c.pagado) return false
        const fechaCuota = new Date(c.fecha)
        return hoy > fechaCuota
      })
      return sum + vencidas.length
    }, 0)

    const tasaPromedio = totalUsuarios > 0 ? usuarios.reduce((sum, u) => sum + (u.tasa || 0), 0) / totalUsuarios : 0

    const kpiUsuarios = document.getElementById("kpi-usuarios")
    const kpiPrestamos = document.getElementById("kpi-prestamos")
    const kpiCapital = document.getElementById("kpi-capital")
    const kpiIntereses = document.getElementById("kpi-intereses")
    const totalSaldo = document.getElementById("total-saldo")
    const promedioTasa = document.getElementById("promedio-tasa")
    const cuotasVencidasEl = document.getElementById("cuotas-vencidas")

  const formatNumber = (num) => (window.app && typeof window.app.formatNumber === 'function') ? window.app.formatNumber(num) : new Intl.NumberFormat("es-CO").format(num)

  if (kpiUsuarios) kpiUsuarios.textContent = formatNumber(totalUsuarios)
  if (kpiPrestamos) kpiPrestamos.textContent = formatNumber(totalPrestamos)
  if (kpiCapital) kpiCapital.textContent = `$${formatNumber(capitalDesembolsado)}`
  if (kpiIntereses) kpiIntereses.textContent = `$${formatNumber(interesesGenerados)}`
  if (totalSaldo) totalSaldo.textContent = `$${formatNumber(totalSaldoPendiente)}`
    if (promedioTasa) promedioTasa.textContent = `${tasaPromedio.toFixed(2)}%`
    if (cuotasVencidasEl) cuotasVencidasEl.textContent = cuotasVencidas

    const maxSaldo = capitalDesembolsado || 100
    const porcentajeSaldo = (totalSaldoPendiente / maxSaldo) * 100
    const saldoProgress = document.getElementById("saldo-progress")
    if (saldoProgress) saldoProgress.style.width = Math.min(porcentajeSaldo, 100) + "%"
  }

  renderRiskRankingList() {
    const container = document.getElementById("riskRankingList")
    if (!container) return

    const usuariosConRiesgo = window.app.usuarios.map((u) => {
      const saldoPendiente = window.PaymentProcessor.obtenerSaldoTotalPendiente(u)

      return {
        ...u,
        riesgo: window.app.calcularRiesgo(u),
        saldoPendiente: saldoPendiente,
        cuotasVencidas: (u.cuotas || []).filter((c) => {
          if (c.pagado) return false
          const hoy = new Date()
          const fechaCuota = new Date(c.fecha)
          return hoy > fechaCuota
        }).length,
      }
    })

    // Sort by risk percentage (highest to lowest)
    usuariosConRiesgo.sort((a, b) => {
      if (b.riesgo.porcentaje !== a.riesgo.porcentaje) {
        return b.riesgo.porcentaje - a.riesgo.porcentaje
      }
      return b.saldoPendiente - a.saldoPendiente
    })

    if (usuariosConRiesgo.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay usuarios registrados</p>'
      return
    }

    const riskColors = {
      alto: "#FF3333",
      medio: "#FF8800",
      bajo: "#00AA66",
    }

    const html = usuariosConRiesgo
      .slice(0, 10)
      .map((usuario, index) => {
        const color = riskColors[usuario.riesgo.nivel] || "#0066CC"
        return `
        <div class="risk-item">
          <div class="risk-rank" style="background: ${color}20; color: ${color};">
            ${index + 1}
          </div>
          <div class="risk-info">
            <div class="risk-name">${usuario.nombre}</div>
            <div class="risk-details">
              <span class="risk-badge" style="background: ${color}; color: white;">
                ${usuario.riesgo.nivel.toUpperCase()}
              </span>
              <span class="risk-percentage">${usuario.riesgo.porcentaje.toFixed(1)}% riesgo</span>
              ${usuario.cuotasVencidas > 0 ? `<span class="risk-overdue">⚠ ${usuario.cuotasVencidas} vencidas</span>` : ""}
            </div>
          </div>
          <div class="risk-amount">
            $${formatNumber(usuario.saldoPendiente)}
          </div>
        </div>
      `
      })
      .join("")

    container.innerHTML = html
  }

  renderDebtRankingList() {
    const container = document.getElementById("debtRankingList")
    if (!container) return

    const usuariosConDeuda = window.app.usuarios.map((u) => {
      const saldoPendiente = window.PaymentProcessor.obtenerSaldoTotalPendiente(u)

      return {
        ...u,
        saldoPendiente: saldoPendiente,
        totalPrestamo: u.monto || 0,
        cuotasPendientes: (u.cuotas || []).filter((c) => !c.pagado).length,
        totalCuotas: (u.cuotas || []).length,
      }
    })

    // Sort by pending balance (highest to lowest)
    usuariosConDeuda.sort((a, b) => b.saldoPendiente - a.saldoPendiente)

    const usuariosConSaldo = usuariosConDeuda.filter((u) => u.saldoPendiente > 0)

    if (usuariosConSaldo.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay saldos pendientes</p>'
      return
    }

    const maxSaldo = usuariosConSaldo[0].saldoPendiente

    const html = usuariosConSaldo
      .slice(0, 10)
      .map((usuario, index) => {
        const porcentajePagado =
          usuario.totalPrestamo > 0
            ? ((usuario.totalPrestamo - usuario.saldoPendiente) / usuario.totalPrestamo) * 100
            : 0
        const widthBar = (usuario.saldoPendiente / maxSaldo) * 100

        return `
        <div class="debt-item">
          <div class="debt-rank">${index + 1}</div>
          <div class="debt-info">
            <div class="debt-name">${usuario.nombre}</div>
            <div class="debt-progress-container">
              <div class="debt-progress-bar">
                <div class="debt-progress-fill" style="width: ${widthBar}%"></div>
              </div>
              <div class="debt-stats">
                <span>${usuario.cuotasPendientes}/${usuario.totalCuotas} cuotas pendientes</span>
                <span>${porcentajePagado.toFixed(0)}% pagado</span>
              </div>
            </div>
          </div>
          <div class="debt-amount">
            <div class="debt-value">$${usuario.saldoPendiente.toFixed(2)}</div>
            <div class="debt-label">pendiente</div>
          </div>
        </div>
      `
      })
      .join("")

    container.innerHTML = html
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM cargado, inicializando dashboard")
  const dashboard = new DashboardManager()
})
