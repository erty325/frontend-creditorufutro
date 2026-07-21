// Provide a global `formatNumber` for legacy callers that expect a free function.
// This prevents `ReferenceError: formatNumber is not defined` when older
// modules call `formatNumber()` before `window.app` exists.
if (typeof window.formatNumber !== "function") {
  window.formatNumber = (number) => {
    try {
      const n = Number(number) || 0
      const roundedIfClose = Math.abs(n - Math.round(n)) < 0.01 ? Math.round(n) : Math.round(n * 100) / 100
      if (Number.isInteger(roundedIfClose)) {
        return new Intl.NumberFormat("es-CO").format(roundedIfClose)
      }
      return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        roundedIfClose,
      )
    } catch (e) {
      return String(number)
    }
  }
}

class LoanManagementSystem {
  constructor() {
    this.usuarios = []
    this.currentFilter = "all"

    // Remove legacy refinanciamientos key (cleanup for older installations)
    try {
      localStorage.removeItem("refinanciamientos")
      console.log("Limpiado: 'refinanciamientos' eliminado de localStorage (legacy)")
    } catch (e) {}

    // Load data from backend API
    this.loadFromApi()
    this.inicializarSincronizacion()
  }

  async loadFromApi() {
    const token = sessionStorage.getItem("access_token")
    if (!token) {
      console.warn("No access token found, keeping empty usuarios list")
      try {
        if (typeof this.mostrarNotificacion === "function")
          this.mostrarNotificacion("No autenticado. Inicia sesión para ver los datos.", "warning")
      } catch (e) {}
      this.usuarios = []
      window.dispatchEvent(new CustomEvent("datosActualizados", { detail: { key: "usuarios", data: this.usuarios } }))
      return
    }

    try {
      const res = await fetch(window.API_BASE_URL + "/clients/list", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
        },
      })

      if (!res.ok) {
        console.warn("Failed to load clients from API", res.status)
        try {
          const msg = `Error cargando clientes (${res.status}). Verifica el servidor.`
          if (typeof this.mostrarNotificacion === "function") this.mostrarNotificacion(msg, "error")
        } catch (e) {}
        this.usuarios = []
        window.dispatchEvent(new CustomEvent("datosActualizados", { detail: { key: "usuarios", data: this.usuarios } }))
        return
      }

      const data = await res.json()
      // normalize/convert values if necessary
      const mapPeriod = (p) => {
        if (!p) return "meses"
        const v = String(p).toLowerCase()
        if (v.includes("quin")) return "quincenas"
        if (v.includes("sem")) return "semanas"
        if (v.includes("a") && v.includes("ño")) return "años"
        if (v.includes("mens") || v.includes("mes")) return "meses"
        return "meses"
      }

      this.usuarios = (data || []).map((c) => {
        // 🔥 NEW STRUCTURE: Backend returns credits array with multi-credit support
        const credits = c.credits || []
        
        // For backwards compatibility, use first credit as default for single-credit views
        const firstCredit = credits[0] || {}
        
        // Map installments from the first credit (or empty if no credits)
        const installments = (firstCredit.cuotas || []).map((q) => {
          const amount = Number(q.cuota) || 0
          const balance = Number(q.saldoPendiente || q.balance || 0)
          const status = q.pagado || q.status === "paid" ? "paid" : q.status || (balance === 0 ? "paid" : "pending")
          const pagado = status === "paid"
          const montoPagado = pagado ? amount : Number((amount - balance).toFixed(2))

          return {
            numero: q.numero,
            fecha: q.fecha,
            fecha_pago: q.fecha_pago || null,
            cuota: amount,
            capital: Number(q.capital) || 0,
            interes: Number(q.interes) || 0,
            interes_mora: Number(q.interes_mora) || 0,
            saldoPendiente: balance,
            pagado: pagado,
            montoPagado: montoPagado,
            status: status,
          }
        })

        // Use resumen from first credit if available
        const resumen = firstCredit.resumen || {}
        const creditOutstanding = Number(firstCredit.outstanding_balance || resumen.total_debe || 0)

      return {
        id: c.id,
        nombre: c.nombre,
        cedula: c.cedula || "",
        email: c.email,
        telefono: c.telefono,
        direccion: c.direccion || "",
        
        // Single credit fields (from first credit for backwards compatibility)
        monto: Number(firstCredit.monto) || 0,
        tasa: Number(firstCredit.tasa) || 0,
        interes_mora_diaria: Number(firstCredit.interes_mora_diaria) || 0,
        term_months: firstCredit.plazo,
        plazo: firstCredit.plazo,
        payment_period: firstCredit.payment_period,
        periodo: mapPeriod(firstCredit.payment_period),
        credit_id: firstCredit.credit_id || null,
        cuotas: installments,
        resumen: resumen,

        // Multi-credit support
        resumen_global: c.resumen_global || {
          total_creditos: credits.length,
          total_debe: 0,
          total_mora: 0,
        },
        credits: credits,

        // Outstanding balance
        outstanding_balance: creditOutstanding,
        saldoPendiente: creditOutstanding,

        fechaCreacion: firstCredit.fecha_creacion || null,
        fechaPrimerPago: firstCredit.fecha_primer_pago || null,
        dias_hasta_primer_pago: firstCredit.dias_hasta_primer_pago ?? null,
        interes_mora_inicial: firstCredit.interes_mora_inicial ?? null,
      }
      })

      console.log("Datos cargados desde API:", this.usuarios.length, "usuarios")
      window.dispatchEvent(new CustomEvent("datosActualizados", { detail: { key: "usuarios", data: this.usuarios } }))
    } catch (err) {
      console.error("Error cargando datos desde API", err)
      try {
        if (err && err.name === "TypeError") {
          // likely network error
          if (typeof this.mostrarNotificacion === "function")
            this.mostrarNotificacion(
              "No se pudo conectar al servidor. Revisa que la API esté configurada correctamente.",
              "error",
            )
        } else if (typeof this.mostrarNotificacion === "function") {
          this.mostrarNotificacion("Error interno cargando datos", "error")
        }
      } catch (e) {}
      this.usuarios = []
      window.dispatchEvent(new CustomEvent("datosActualizados", { detail: { key: "usuarios", data: this.usuarios } }))
    }
  }

  cargarDatos(key) {
    try {
      // Deprecated: localStorage not used anymore for persisted app data.
      return null
    } catch (error) {
      console.error("Error cargando datos:", error)
      return null
    }
  }

  guardarDatos(key, data) {
    try {
      // Persist changes in-memory and notify listeners. Persist to backend via API should be implemented per-action.
      if (key === "usuarios") {
        this.usuarios = data
      }
      console.log("Datos actualizados en memoria para", key, Array.isArray(data) ? data.length : "ok")
      window.dispatchEvent(new CustomEvent("datosActualizados", { detail: { key, data } }))
    } catch (error) {
      console.error("Error guardando datos:", error)
    }
  }

  inicializarSincronizacion() {
    // Listen to storage changes from other tabs
    window.addEventListener("storage", (e) => {
      if (e.key === "usuarios") {
        this.usuarios = JSON.parse(e.newValue) || []
        window.dispatchEvent(new CustomEvent("datosActualizados", { detail: { key: "usuarios", data: this.usuarios } }))
      }
    })
  }

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

  formatNumber(number) {
    const n = Number(number) || 0
    // If the value is very close to an integer (floating point artifacts), round to integer
    const roundedIfClose = Math.abs(n - Math.round(n)) < 0.01 ? Math.round(n) : Math.round(n * 100) / 100

    if (Number.isInteger(roundedIfClose)) {
      return new Intl.NumberFormat("es-CO").format(roundedIfClose)
    }

    // Otherwise format with 2 decimal places
    return new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(roundedIfClose)
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

// generarCuotas(monto, tasaAnualBase, plazo, periodo = "meses") {
//   const cuotas = []

//   // Determine number of installments based on payment period
//   let numeroCuotas
//   let diasEntreCuotas = 30 // Default for monthly

//   switch (periodo) {
//     case "semanas":
//       numeroCuotas = plazo // plazo in weeks
//       diasEntreCuotas = 7
//       break
//     case "quincenas":
//       numeroCuotas = plazo * 2 // Quincenal: multiply by 2 (5 months = 10 installments)
//       diasEntreCuotas = 15
//       break
//     case "años":
//       numeroCuotas = plazo * 12 // plazo in years converted to months
//       diasEntreCuotas = 365
//       break
//     case "meses":
//     default:
//       numeroCuotas = plazo // plazo in months
//       diasEntreCuotas = 30
//       break
//   }

//     const interesesTotales = monto * (tasaAnualBase / 100) * plazo
//     const montoTotal = monto + interesesTotales
//     const cuotaRegular = montoTotal / numeroCuotas

//     const fechaInicio = new Date()

//     for (let i = 1; i <= numeroCuotas; i++) {
//       const interesCuota = interesesTotales / numeroCuotas
//       const capitalCuota = monto / numeroCuotas

//       const capitalPendiente = monto - capitalCuota * i
//       const interesPendiente = interesesTotales - interesCuota * i
//       const saldoPendiente = Math.max(0, capitalPendiente + interesPendiente)

//       const fechaCuota = new Date(fechaInicio)

//       if (periodo === "quincenas") {
//         fechaCuota.setDate(fechaCuota.getDate() + i * 15)
//       } else if (periodo === "semanas") {
//         fechaCuota.setDate(fechaCuota.getDate() + i * 7)
//       } else {
//         fechaCuota.setMonth(fechaCuota.getMonth() + i)
//       }

//       cuotas.push({
//         numero: i,
//         fecha: fechaCuota.toISOString().split("T")[0],
//         cuota: Number((capitalCuota + interesCuota).toFixed(2)),
//         capital: Number(capitalCuota.toFixed(2)),
//         interes: Number(interesCuota.toFixed(2)),
//         saldoPendiente: Number(saldoPendiente.toFixed(2)),
//         pagado: false,
//         completada: false,
//         montoPagado: 0,
//         fechaPago: null,
//       })
//     }

//     // Ensure sum of capitals equals original amount
//     const sumCapital = cuotas.reduce((s, c) => s + c.capital, 0)
//     const residual = monto - sumCapital
//     if (Math.abs(residual) > 0.0001) {
//       const last = cuotas[cuotas.length - 1]
//       if (last) {
//         last.capital = Number((last.capital + residual).toFixed(2))
//         last.cuota = Number((last.cuota + residual).toFixed(2))
//         last.saldoPendiente = Number((last.saldoPendiente + residual).toFixed(2))
//       }
//     }

//     return cuotas
//   }

  procesarPagoPersonalizado(usuario, montoPagado) {
    return window.PaymentProcessor.procesarPagoEscalable(usuario, montoPagado)
  }

  // recalcularSaldosPendientes(usuario) {
  //   if (!usuario.cuotas || usuario.cuotas.length === 0) return

  //   window.PaymentProcessor.recalcularSaldoPendiente(usuario)
  // }

  obtenerSaldoTotalPendiente(usuario) {
    if (typeof usuario.outstanding_balance === "number") return usuario.outstanding_balance
  }

  calcularRiesgo(usuario) {
    // New risk scale based on percentage of unpaid installments:
    // 100% - Riesgo Alto (all unpaid)
    // 70% - Riesgo Medio-Alto
    // 50% - Riesgo Medio
    // 30% - Riesgo Medio-Bajo
    // 10% - Riesgo Bajo
    // 0% - Deuda Pagada (all paid)
    try {
      const cuotas = Array.isArray(usuario.cuotas) ? usuario.cuotas : []
      const total = cuotas.length
      if (total === 0) return { nivel: "pagada", porcentaje: 0, label: "Deuda pagada" }

      const pagadas = cuotas.filter((c) => c.pagado).length
      const porcentaje = Math.round((1 - pagadas / total) * 100)

      // Determine risk level and label
      if (porcentaje === 0) {
        return { nivel: "pagada", porcentaje: 0, label: "Deuda pagada" }
      } else if (porcentaje <= 10) {
        return { nivel: "bajo", porcentaje, label: "Riesgo bajo" }
      } else if (porcentaje <= 30) {
        return { nivel: "medio-bajo", porcentaje, label: "Riesgo medio-bajo" }
      } else if (porcentaje <= 50) {
        return { nivel: "medio", porcentaje, label: "Riesgo medio" }
      } else if (porcentaje <= 70) {
        return { nivel: "medio-alto", porcentaje, label: "Riesgo medio-alto" }
      } else {
        return { nivel: "alto", porcentaje, label: "Riesgo alto" }
      }
    } catch (err) {
      console.warn("calcularRiesgo fallback:", err)
      return { nivel: "bajo", porcentaje: 0, label: "Riesgo bajo" }
    }
  }

  mostrarNotificacion(mensaje, tipo = "success") {
    const notif = document.getElementById("notificacion")
    if (!notif) return

    notif.textContent = mensaje
    notif.className = `notificacion ${tipo}`
    notif.classList.remove("hidden")

    setTimeout(() => {
      notif.classList.add("hidden")
    }, 3000)
  }

  actualizarFecha() {
    const hoy = new Date()
    const opciones = { year: "numeric", month: "long", day: "numeric" }
    const fecha = hoy.toLocaleDateString("es-ES", opciones)
    const hora = hoy.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })

    const dateEl = document.getElementById("current-date")
    const hourEl = document.getElementById("current-hour")

    if (dateEl) dateEl.textContent = fecha
    if (hourEl) hourEl.textContent = hora
  }

  registrarPago(usuarioId, cuotaNumero, montoPagado, fechaPago, nota = "") {
    const usuario = this.usuarios.find((u) => u.id === usuarioId)
    if (!usuario || !usuario.cuotas) return false

    const cuota = usuario.cuotas.find((c) => c.numero === cuotaNumero)
    if (!cuota) return false

    cuota.pagado = true
    cuota.completada = true // Marcar como completada cuando se paga completamente
    cuota.montoPagado = montoPagado
    cuota.fechaPago = fechaPago
    cuota.nota = nota
    cuota.cuota = 0 // Reducir el monto a 0

    this.recalcularSaldosPendientes(usuario) // Call recalculate pending balances after payment
    this.guardarDatos("usuarios", this.usuarios)
    return true
  }

  registrarPagoPersonalizado(usuarioId, cuotasAPagar, montoPagadoTotal, fechaPago, nota = "") {
    const usuario = this.usuarios.find((u) => u.id === usuarioId)
    if (!usuario || !usuario.cuotas) return false

    // Aplicar los cambios a las cuotas
    window.PaymentProcessor.aplicarCambiosCuotas(usuario, cuotasAPagar)

    // Registrar la fecha, nota y monto pagado en cada cuota
    cuotasAPagar.forEach((pago) => {
      const cuota = usuario.cuotas.find((c) => c.numero === pago.numero)
      if (cuota) {
        cuota.fechaPago = fechaPago
        cuota.nota = nota
        cuota.montoPagado = pago.montoPagado
      }
    })

    this.recalcularSaldosPendientes(usuario)
    this.guardarDatos("usuarios", this.usuarios)

    window.dispatchEvent(new CustomEvent("datosActualizados", { detail: { tipo: "pagoPersonalizado", usuarioId } }))

    return true
  }
}

const app = new LoanManagementSystem()
window.app = app

// Ensure global `formatNumber` forwards to the instance method when available.
// This keeps legacy callers working and ensures consistent formatting.
if (window.app && typeof window.app.formatNumber === "function") {
  window.formatNumber = (number) => {
    try {
      return window.app.formatNumber(number)
    } catch (e) {
      return new Intl.NumberFormat("es-CO").format(number)
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  try {
    const path = window.location.pathname.split("/").pop() || "index.html"
    document.querySelectorAll(".nav-menu .nav-item").forEach((el) => {
      el.classList.remove("active")
      const href = el.getAttribute("href")
      if (href && href.split("/").pop() === path) {
        el.classList.add("active")
      }
    })
  } catch (err) {
    console.warn("Nav highlight init failed:", err)
  }
})

function verificarCuotasVencidas() {
  const usuarios = app.usuarios
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  usuarios.forEach((usuario) => {
    if (!usuario.cuotas) return

    const cuotasVencidas = usuario.cuotas.filter((c) => {
      const fechaCuota = new Date(c.fecha + "T00:00:00")
      return !c.pagado && !c.completada && fechaCuota < hoy
    })

    if (cuotasVencidas.length > 0) {
      const totalVencido = cuotasVencidas.reduce((sum, c) => sum + c.cuota, 0)
      const localStorageKey = `notificacion-${usuario.id}`
      const ultimaNotificacion = localStorage.getItem(localStorageKey)
      const hoyString = hoy.toISOString().split("T")[0]

      if (ultimaNotificacion !== hoyString) {
        app.mostrarNotificacion(
          `${usuario.nombre} tiene ${cuotasVencidas.length} cuota(s) vencida(s) por $${totalVencido.toFixed(2)}`,
          "warning",
        )
        localStorage.setItem(localStorageKey, hoyString)
      }
    }
  })
}

window.addEventListener("DOMContentLoaded", () => {
  app.actualizarFecha()
  verificarCuotasVencidas()
  setInterval(() => app.actualizarFecha(), 60000)
  setInterval(() => verificarCuotasVencidas(), 3600000)
})

window.addEventListener("datosActualizados", () => {
  verificarCuotasVencidas()
})
