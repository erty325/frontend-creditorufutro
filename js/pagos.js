document.addEventListener("DOMContentLoaded", () => {
  const filterBtns = document.querySelectorAll(".filter-btn")
  const usuariosTbody = document.getElementById("usuarios-tbody")
  const emptyState = document.getElementById("empty-usuarios")
  const modalSeleccionar = document.getElementById("modal-seleccionar-cuota")
  const modalPago = document.getElementById("modal-pago")
  const formPago = document.getElementById("form-pago")
  const btnCloseSeleccionar = document.getElementById("btn-close-seleccionar")
  const btnClosePago = document.getElementById("btn-close-pago")
  const btnCancelPago = document.getElementById("btn-cancel-pago")
  const cuotasUsuarioTbody = document.getElementById("cuotas-usuario-tbody")
  const modalUsuarioNombre = document.getElementById("modal-usuario-nombre")
  const modalPagoPersonalizado = document.getElementById("modal-pago-personalizado")
  const btnClosePagoPersonalizado = document.getElementById("btn-close-pago-personalizado")
  const btnCancelPagoPersonalizado = document.getElementById("btn-cancel-pago-personalizado")
  const btnConfirmarPagoPersonalizado = document.getElementById("btn-confirmar-pago-personalizado")
  const montoPagoPersonalizado = document.getElementById("monto-pago-personalizado")
  const fechaPagoPersonalizado = document.getElementById("fecha-pago-personalizado")
  const notaPagoPersonalizado = document.getElementById("nota-pago-personalizado")
  const resumenPago = document.getElementById("resumen-pago-personalizado")
  const cuotasAPagarList = document.getElementById("cuotas-a-pagar-list")
  const cuotasPreviewTbody = document.getElementById("cuotas-preview-tbody")
  const filtroDiaPago = document.getElementById("filtro-dia-pago")
  const btnLimpiarFiltro = document.getElementById("btn-limpiar-filtro")
  const toggleInfoGeneral = document.getElementById("toggle-info-general")
  const infoGeneralContent = document.getElementById("info-general-content")
  const tipoPagoBtns = document.querySelectorAll(".tipo-pago-btn")
  
  // Modal editar pago
  const modalEditarPago = document.getElementById("modal-editar-pago")
  const formEditarPago = document.getElementById("form-editar-pago")
  const btnCloseEditar = document.getElementById("btn-close-editar")
  const btnCancelEditar = document.getElementById("btn-cancel-editar")

  let currentFilter = "todos"
  let currentDiaFilter = null
  let currentSearchTerm = ""
  let pagoCuotaActual = null
  let pagoPersonalizadoActual = null
  let editandoPago = null
  let tipoPagoActual = "completo" // completo, capital, mora

  // Function to format numbers
  const formatNumber = (num) => (window.app && typeof window.app.formatNumber === "function") ? window.app.formatNumber(num) : new Intl.NumberFormat("es-CO").format(num)

  // Mora calculation removed: now handled by backend
  // The frontend displays mora values from the API response

  // Buscador por nombre/cedula
  const buscarPagosInput = document.getElementById("buscar-pagos")
  const btnLimpiarBusqueda = document.getElementById("btn-limpiar-busqueda")
  const btnRetrocederPago = document.getElementById("btn-retroceder-pago")

  if (buscarPagosInput) {
    buscarPagosInput.addEventListener("input", () => {
      currentSearchTerm = buscarPagosInput.value.trim().toLowerCase()
      renderUsuarios()
    })
  }

  if (btnLimpiarBusqueda) {
    btnLimpiarBusqueda.addEventListener("click", () => {
      if (buscarPagosInput) buscarPagosInput.value = ""
      currentSearchTerm = ""
      renderUsuarios()
    })
  }

  // Boton retroceder pago
  if (btnRetrocederPago) {
    btnRetrocederPago.addEventListener("click", () => {
      if (!editandoPago) return

      if (!confirm("¿Esta seguro de retroceder este pago? La cuota volvera a estado pendiente.")) {
        return
      }

      const token = sessionStorage.getItem("access_token")
      const creditId = editandoPago.usuario.credit_id || editandoPago.usuario.id

      fetch(`window.API_BASE_URL/credits/retroceder_pago/${creditId}/${editandoPago.numeroCuota}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token,
        },
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Error" }))
            throw new Error(err.detail || "Error retrocediendo pago")
          }
          return res.json()
        })
        .then(() => {
          window.app.loadFromApi()
          window.app.mostrarNotificacion("Pago retrocedido correctamente. La cuota volvio a estado pendiente.", "success")
          cerrarModalEditar()
          setTimeout(() => {
            renderUsuarios()
            actualizarEstadisticas()
          }, 200)
        })
        .catch((err) => {
          console.error("Error retrocediendo pago:", err)
          window.app.mostrarNotificacion(`Error: ${err.message}`, "error")
        })
    })
  }

  // Toggle informacion general
  if (toggleInfoGeneral && infoGeneralContent) {
    toggleInfoGeneral.addEventListener("click", () => {
      toggleInfoGeneral.classList.toggle("active")
      infoGeneralContent.classList.toggle("show")
    })
  }

  // Filtro por dia de pago
  if (filtroDiaPago) {
    filtroDiaPago.addEventListener("input", () => {
      const dia = parseInt(filtroDiaPago.value)
      currentDiaFilter = dia >= 1 && dia <= 31 ? dia : null
      renderUsuarios()
    })
  }

  if (btnLimpiarFiltro) {
    btnLimpiarFiltro.addEventListener("click", () => {
      filtroDiaPago.value = ""
      currentDiaFilter = null
      renderUsuarios()
    })
  }

  // Tipo de pago buttons
  tipoPagoBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tipoPagoBtns.forEach(b => b.classList.remove("active"))
      btn.classList.add("active")
      tipoPagoActual = btn.dataset.tipo
      
      const infoText = document.getElementById("info-tipo-pago")
      if (infoText) {
        switch(tipoPagoActual) {
          case "capital":
            infoText.textContent = "El monto se aplicara directamente al capital, reduciendo el saldo de la deuda principal."
            break
          case "mora":
            infoText.textContent = "El monto se aplicara primero a la mora acumulada, luego a los intereses pendientes."
            break
          default:
            infoText.textContent = "El monto se distribuira entre capital e intereses de las cuotas pendientes."
        }
      }
      
      // Recalcular preview si hay monto
      if (montoPagoPersonalizado.value) {
        montoPagoPersonalizado.dispatchEvent(new Event("input"))
      }
    })
  })

  function esperar(condition, callback, maxWait = 5000) {
    const inicio = Date.now()
    const intervalo = setInterval(() => {
      if (condition()) {
        clearInterval(intervalo)
        callback()
      } else if (Date.now() - inicio > maxWait) {
        clearInterval(intervalo)
        console.error("Timeout esperando shared-data")
      }
    }, 100)
  }

  function actualizarEstadisticas() {
    // Obtener fecha actual en Colombia (UTC-5)
    const now = new Date()
    const colombiaOffset = -5 * 60 // Colombia es UTC-5 (en minutos)
    const localOffset = now.getTimezoneOffset()
    const hoy = new Date(now.getTime() + (localOffset + colombiaOffset) * 60000)
    hoy.setHours(0, 0, 0, 0)

    let pendientes = 0
    let pendientesMonto = 0
    let vencidas = 0
    let vencidasMonto = 0
    let pagadas = 0
    let pagadasMonto = 0

    window.app.usuarios.forEach((usuario) => {
      ;(usuario.cuotas || []).forEach((cuota) => {
        const fechaCuota = new Date(cuota.fecha + "T00:00:00")

        if (cuota.pagado) {
          pagadas++
          pagadasMonto += cuota.cuota
        } else if (fechaCuota < hoy) {
          vencidas++
          vencidasMonto += cuota.cuota
        } else {
          pendientes++
          pendientesMonto += cuota.cuota
        }
      })
    })

    const totalCobrar = pendientesMonto + vencidasMonto

    const pendientesCountEl = document.getElementById("cuotas-pendientes-count")
    const pendientesMontoEl = document.getElementById("cuotas-pendientes-monto")
    const vencidasCountEl = document.getElementById("cuotas-vencidas-count")
    const vencidasMontoEl = document.getElementById("cuotas-vencidas-monto")
    const pagadasCountEl = document.getElementById("cuotas-pagadas-count")
    const pagadasMontoEl = document.getElementById("cuotas-pagadas-monto")
    const totalCobroEl = document.getElementById("total-cobrar")

    if (pendientesCountEl) pendientesCountEl.textContent = formatNumber(pendientes)
    if (pendientesMontoEl) pendientesMontoEl.textContent = `$${formatNumber(pendientesMonto)}`
    if (vencidasCountEl) vencidasCountEl.textContent = formatNumber(vencidas)
    if (vencidasMontoEl) vencidasMontoEl.textContent = `$${formatNumber(vencidasMonto)}`
    if (pagadasCountEl) pagadasCountEl.textContent = formatNumber(pagadas)
    if (pagadasMontoEl) pagadasMontoEl.textContent = `$${formatNumber(pagadasMonto)}`
    if (totalCobroEl) totalCobroEl.textContent = `$${formatNumber(totalCobrar)}`
  }

  function calcularEstadisticasUsuario(usuario) {
    // Obtener fecha actual en Colombia (UTC-5)
    const now = new Date()
    const colombiaOffset = -5 * 60
    const localOffset = now.getTimezoneOffset()
    const hoy = new Date(now.getTime() + (localOffset + colombiaOffset) * 60000)
    hoy.setHours(0, 0, 0, 0)

    let pendientes = 0
    let vencidas = 0
    let pagadas = 0
    let totalPagado = 0

    const saldoPendiente = (typeof usuario.outstanding_balance === "number")
      ? usuario.outstanding_balance
      : (usuario.cuotas || []).filter((c) => !c.pagado).reduce((sum, c) => sum + c.cuota, 0)
    
    ;(usuario.cuotas || []).forEach((cuota) => {
      const fechaCuota = new Date(cuota.fecha + "T00:00:00")
      const montoCuota = Number(cuota.cuota || 0)
      const montoPagado = Number(cuota.montoPagado || 0)
      totalPagado += montoPagado

      if (cuota.pagado || montoPagado >= montoCuota) {
        pagadas++
      } else {
        if (fechaCuota < hoy) {
          vencidas++
        } else {
          pendientes++
        }
      }
    })

    return { pendientes, vencidas, pagadas, saldoPendiente, totalPagado }
  }

  function filtrarUsuarios(usuarios, filtro) {
    let filtered = usuarios

    // Filtrar por busqueda (nombre, cedula o telefono)
    if (currentSearchTerm) {
      filtered = filtered.filter((usuario) => {
        const nombre = (usuario.nombre || "").toLowerCase()
        const cedula = (usuario.cedula || "").toLowerCase()
        const telefono = (usuario.telefono || "").toLowerCase()
        return nombre.includes(currentSearchTerm) || cedula.includes(currentSearchTerm) || telefono.includes(currentSearchTerm)
      })
    }

    // Filtrar por estado
    if (filtro !== "todos") {
      filtered = filtered.filter((usuario) => {
        const stats = calcularEstadisticasUsuario(usuario)
        switch (filtro) {
          case "pendientes":
            return stats.pendientes > 0
          case "vencidas":
            return stats.vencidas > 0
          case "pagadas":
            return stats.pendientes === 0 && stats.vencidas === 0 && stats.pagadas > 0
          default:
            return true
        }
      })
    }

    // Filtrar por dia de pago
    if (currentDiaFilter) {
      filtered = filtered.filter((usuario) => {
        return (usuario.cuotas || []).some((cuota) => {
          const fecha = new Date(cuota.fecha + "T00:00:00")
          return fecha.getDate() === currentDiaFilter
        })
      })
    }

    return filtered
  }

  function renderUsuarios() {
    let usuariosFiltrados = filtrarUsuarios(window.app.usuarios, currentFilter)
    
    // Ordenar usuarios: primero los que tienen cuotas pendientes, luego los que ya pagaron todo
    usuariosFiltrados = usuariosFiltrados.sort((a, b) => {
      const statsA = calcularEstadisticasUsuario(a)
      const statsB = calcularEstadisticasUsuario(b)
      
      // Calcular cuotas pendientes (pendientes + vencidas)
      const cuotasPendientesA = statsA.pendientes + statsA.vencidas
      const cuotasPendientesB = statsB.pendientes + statsB.vencidas
      
      // Si uno tiene pendientes y el otro no, el que tiene pendientes va primero
      if (cuotasPendientesA > 0 && cuotasPendientesB === 0) {
        return -1
      }
      if (cuotasPendientesA === 0 && cuotasPendientesB > 0) {
        return 1
      }
      
      // Si ambos tienen pendientes o ambos están pagos, ordenar por cantidad de pendientes (mayor primero)
      return cuotasPendientesB - cuotasPendientesA
    })

    usuariosTbody.innerHTML = ""
    if (usuariosFiltrados.length === 0) {
      emptyState.style.display = "block"
      return
    }

    emptyState.style.display = "none"

    const formatDate = (dateStr) => {
      if (!dateStr) return "-"
      const date = new Date(dateStr + "T00:00:00")
      return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    }

    usuariosTbody.innerHTML = usuariosFiltrados
      .map((usuario) => {
        const stats = calcularEstadisticasUsuario(usuario)
        const estadoClase = stats.vencidas > 0 ? "vencida" : stats.pendientes > 0 ? "pendiente" : "pagada"
        const inicial = (usuario.nombre || "?")[0].toUpperCase()
        const totalCuotas = (usuario.cuotas || []).length
        
        // Late interest is now calculated and provided by the backend
        // Calculate daily rate for display purposes only (not used in calculations)
        const tasaMora = usuario.tasa || 5
        const capitalTotal = usuario.monto || 0

        // calcular mora si es es mensual entonces se divide entre 30 y si es quincenal entonces entre 15
        let interesMoraDiario = 0
        if (usuario.tipo_prestamo === "mensual") {
          interesMoraDiario = (capitalTotal * (tasaMora / 100)) / 30
        } else {
          interesMoraDiario = (capitalTotal * (tasaMora / 100)) / 15
        }
        
        return `
      <tr class="estado-${estadoClase}">
        <td>
          <div class="pagos-usuario-card">
            <div class="pagos-usuario-avatar">${inicial}</div>
            <div class="pagos-usuario-info">
              <span class="nombre">${usuario.nombre}</span>
              <span class="cedula-info" style="color: #6b7280; font-size: 12px;">${usuario.cedula || "Sin Cedula"}</span>
            </div>
          </div>
        </td>
        <td>${usuario.telefono}</td>
        <td>$${formatNumber(usuario.monto)}</td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 600; color: #dc2626;">$${formatNumber(interesMoraDiario)}</span>
            <span style="font-size: 11px; color: #6b7280;">por día</span>
          </div>
        </td>
        <td><span class="cuotas-badge pagadas">${stats.pagadas}/${totalCuotas}</span></td>
        <td><span class="cuotas-badge faltantes">${stats.pendientes + stats.vencidas}</span></td>
        <td><strong>$${formatNumber(stats.saldoPendiente)}</strong></td>
        <td>
          <button class="btn-action btn-edit" onclick="abrirModalSeleccionarCuota('${usuario.id}')">
            Registrar Pago
          </button>
          <button class="btn-action btn-edit" style="background: var(--accent-warning);" onclick="abrirModalPagoPersonalizado('${usuario.id}')">
            Pago Personalizado
          </button>
        </td>
      </tr>
    `
      })
      .join("")
  }

  window.abrirModalSeleccionarCuota = (usuarioId) => {
    const usuario = window.app.usuarios.find((u) => u.id === usuarioId)
    if (!usuario) return

    modalUsuarioNombre.textContent = usuario.nombre

    // Obtener fecha actual en Colombia (UTC-5)
    const now = new Date()
    const colombiaOffset = -5 * 60
    const localOffset = now.getTimezoneOffset()
    const hoy = new Date(now.getTime() + (localOffset + colombiaOffset) * 60000)
    hoy.setHours(0, 0, 0, 0)
    const cuotasSorted = (usuario.cuotas || []).slice().sort((a, b) => {
      // Primero: Prioridad a cuotas no pagadas (no pagadas primero, pagadas al fondo)
      const aPagada = a.pagado === true ? 1 : 0
      const bPagada = b.pagado === true ? 1 : 0
      
      if (aPagada !== bPagada) {
        return aPagada - bPagada // Las no pagadas (0) van antes que las pagadas (1)
      }
      
      // Segundo: Si ambas están en el mismo estado de pago, ordenar por número de cuota
      return Number(a.numero || 0) - Number(b.numero || 0)
    })
    const formatDate = (dateStr) => {
      if (!dateStr) return "-"
      const date = new Date(dateStr + "T00:00:00")
      return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    }

    cuotasUsuarioTbody.innerHTML = cuotasSorted
      .map((cuota) => {
        const fechaCuota = new Date(cuota.fecha + "T00:00:00")
        const montoCuota = Number(cuota.cuota || 0)
        const montoPagado = Number(cuota.montoPagado || 0)
        
        // Calcular saldo pendiente con múltiples opciones de fallback
        let saldoPendiente = montoCuota;
        
        if (typeof cuota.balance !== 'undefined' && cuota.balance !== null) {
          saldoPendiente = Number(cuota.balance);
        } else if (cuota.saldoPendiente !== null && typeof cuota.saldoPendiente !== 'undefined') {
          saldoPendiente = Number(cuota.saldoPendiente);
        } else if (montoPagado > 0) {
          // Si se pagó algo, el saldo es monto cuota - lo pagado
          saldoPendiente = Math.max(0, montoCuota - montoPagado);
        } else if (cuota.pagado) {
          saldoPendiente = 0;
        } else {
          // Por defecto, si nada pagado es el monto de la cuota
          saldoPendiente = montoCuota;
        }

        let estado = "Pendiente"
        let estadoClase = "pendiente"

        if (cuota.pagado || montoPagado >= montoCuota) {
          estado = "Pagada"
          estadoClase = "pagada"
        } else if (montoPagado > 0 && montoPagado < montoCuota) {
          estado = "Abono"
          estadoClase = "abono"
        } else if (fechaCuota < hoy) {
          estado = "Vencida"
          estadoClase = "vencida"
        }

        const fechaPagoRealizada = cuota.fechaPago || cuota.fecha_pago || null
        
        // Use late interest value from backend (already calculated and persisted)
        const interesMora = cuota.interes_mora || 0

        // Fecha de pago sugerida (hoy si no esta pagada)
        const fechaPagoSugerida = fechaPagoRealizada || (!cuota.pagado ? formatDate(new Date().toISOString().split("T")[0]) : null)

        return `
        <tr class="estado-${estadoClase}">
          <td><strong>#${cuota.numero}</strong></td>
          <td>
            <div class="fecha-pago-cell">
              ${fechaPagoRealizada 
                ? `<span class="fecha-realizada">${formatDate(fechaPagoRealizada)}</span>` 
                : '<span style="color: var(--text-light);">-</span>'}
            </div>
          </td>
          <td>${formatDate(cuota.fecha)}</td>
          <td><strong>$${formatNumber(montoCuota)}</strong></td>
          <td>$${formatNumber(cuota.capital)}</td>
          <td>$${formatNumber(cuota.interes)}</td>
          <td>
            ${interesMora > 0 
              ? `<span style="color: #dc2626; font-weight: 600;">$${formatNumber(interesMora)}</span>` 
              : '<span style="color: var(--text-light);">-</span>'}
          </td>
          <td>$${formatNumber(saldoPendiente)}</td>
          <td>
            <div class="estado-con-fecha">
              <span class="badge risk-level ${estadoClase}">${estado}</span>
              ${fechaPagoRealizada && estadoClase === "pagada" ? `<span class="fecha-pago-realizado">Pagado ${formatDate(fechaPagoRealizada)}</span>` : ""}
            </div>
          </td>
          <td>
            <div class="cuota-acciones">
              ${!(cuota.pagado || montoPagado >= montoCuota)
                ? `<button class="btn-action btn-edit" onclick="abrirModalPago('${usuarioId}', ${cuota.numero})">Pagar</button>`
                : `<button class="btn-action" style="background: var(--accent-info);" onclick="abrirModalEditarPago('${usuarioId}', ${cuota.numero})">Editar</button>`
              }
            </div>
          </td>
        </tr>
      `
      })
      .join("")

    modalSeleccionar.classList.remove("hidden")
  }

  function cerrarModalSeleccionar() {
    modalSeleccionar.classList.add("hidden")
  }

  window.abrirModalPago = (usuarioId, numeroCuota) => {
    const usuario = window.app.usuarios.find((u) => u.id === usuarioId)
    const cuota = (usuario?.cuotas || []).find((c) => c.numero == numeroCuota)

    if (!usuario || !cuota) return

    pagoCuotaActual = { usuarioId, numeroCuota, cuota, usuario }

    document.getElementById("pago-usuario").textContent = usuario.nombre
    document.getElementById("pago-numero").textContent = `#${cuota.numero}`
    document.getElementById("pago-fecha").textContent = new Date(cuota.fecha).toLocaleDateString("es-ES")
    
    const pendiente = (typeof cuota.saldoPendiente !== "undefined" && cuota.saldoPendiente !== null)
      ? Number.parseFloat(cuota.saldoPendiente)
      : Number.parseFloat(cuota.cuota || 0)

    document.getElementById("pago-monto").textContent = `$${pendiente.toFixed(2)}`
    document.getElementById("fecha-pago").value = new Date().toISOString().split("T")[0]
    document.getElementById("monto-pagado").value = pendiente.toFixed(2)
    document.getElementById("nota-pago").value = ""

    cerrarModalSeleccionar()
    modalPago.classList.remove("hidden")
  }

  function cerrarModalPago() {
    modalPago.classList.add("hidden")
    formPago.reset()
    pagoCuotaActual = null
  }

  // Abrir modal editar pago
  window.abrirModalEditarPago = (usuarioId, numeroCuota) => {
    const usuario = window.app.usuarios.find((u) => u.id === usuarioId)
    const cuota = (usuario?.cuotas || []).find((c) => c.numero == numeroCuota)

    if (!usuario || !cuota) return

    editandoPago = { usuarioId, numeroCuota, cuota, usuario }

    document.getElementById("editar-cuota-numero").textContent = cuota.numero
    document.getElementById("editar-cliente-nombre").textContent = usuario.nombre
    document.getElementById("editar-cuota-info").textContent = `Cuota #${cuota.numero} - Vencimiento: ${new Date(cuota.fecha).toLocaleDateString("es-ES")}`
    
    document.getElementById("editar-fecha-pago").value = cuota.fechaPago || cuota.fecha_pago || new Date().toISOString().split("T")[0]
    document.getElementById("editar-monto-pagado").value = cuota.montoPagado || cuota.cuota
    document.getElementById("editar-capital").value = cuota.capital || 0
    document.getElementById("editar-interes").value = cuota.interes || 0
    document.getElementById("editar-nota").value = cuota.nota || ""

    cerrarModalSeleccionar()
    modalEditarPago.classList.remove("hidden")
  }

  function cerrarModalEditar() {
    modalEditarPago.classList.add("hidden")
    formEditarPago.reset()
    editandoPago = null
  }

  // Submit editar pago
  if (formEditarPago) {
    formEditarPago.addEventListener("submit", (e) => {
      e.preventDefault()
      if (!editandoPago) return

      const fechaPago = document.getElementById("editar-fecha-pago").value
      const montoPagado = parseFloat(document.getElementById("editar-monto-pagado").value)
      const capital = parseFloat(document.getElementById("editar-capital").value) || 0
      const interes = parseFloat(document.getElementById("editar-interes").value) || 0
      const nota = document.getElementById("editar-nota").value

      if (!fechaPago || !montoPagado) {
        window.app.mostrarNotificacion("Complete los campos requeridos", "error")
        return
      }

      const token = sessionStorage.getItem("access_token")
      const creditId = editandoPago.usuario.credit_id || editandoPago.usuario.id

      fetch(`window.API_BASE_URL/credits/editar_pago/${creditId}/${editandoPago.numeroCuota}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token,
        },
        body: JSON.stringify({ 
          fecha_pago: fechaPago, 
          monto_pagado: montoPagado,
          capital: capital,
          interes: interes,
          nota: nota 
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Error" }))
            throw new Error(err.detail || "Error editando pago")
          }
          return res.json()
        })
        .then(() => {
          window.app.loadFromApi()
          window.app.mostrarNotificacion("Pago actualizado correctamente", "success")
          cerrarModalEditar()
          setTimeout(() => {
            renderUsuarios()
            actualizarEstadisticas()
            window.dispatchEvent(new CustomEvent("pagoActualizado"))
          }, 200)
        })
        .catch((err) => {
          console.error("Error editando pago:", err)
          window.app.mostrarNotificacion(`Error: ${err.message}`, "error")
        })
    })
  }

  formPago.addEventListener("submit", (e) => {
    e.preventDefault()

    if (!pagoCuotaActual) return

    const montoPagado = Number.parseFloat(document.getElementById("monto-pagado").value)
    const fechaPago = document.getElementById("fecha-pago").value

    if (!montoPagado || montoPagado <= 0) {
      window.app.mostrarNotificacion("Ingrese un monto valido", "error")
      return
    }

    if (!fechaPago) {
      window.app.mostrarNotificacion("Ingrese la fecha del pago", "error")
      return
    }

    const usuario = window.app.usuarios.find((u) => u.id === pagoCuotaActual.usuarioId)
    const cuota = (usuario?.cuotas || []).find((c) => c.numero == pagoCuotaActual.numeroCuota)

    if (!(usuario && cuota)) {
      window.app.mostrarNotificacion("Usuario o cuota no encontrada", "error")
      return
    }

    const token = sessionStorage.getItem("access_token")
    const creditId = usuario.credit_id || usuario.id
    const note = document.getElementById("nota-pago").value || ""

    fetch(`window.API_BASE_URL/credits/pago_cuota/${creditId}/${cuota.numero}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
      body: JSON.stringify({ amount: montoPagado, date: fechaPago, note }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Error" }))
          throw new Error(err.detail || "Error registering payment")
        }
        return res.json()
      })
      .then((data) => {
        window.app.loadFromApi()
        window.app.mostrarNotificacion(`Pago de $${montoPagado.toFixed(2)} registrado correctamente`, "success")
        cerrarModalPago()
        setTimeout(() => {
          renderUsuarios()
          actualizarEstadisticas()
        }, 200)
      })
      .catch((err) => {
        console.error("Error registrando pago:", err)
        window.app.mostrarNotificacion(`Error: ${err.message}`, "error")
      })
  })

  window.abrirModalPagoPersonalizado = async (usuarioId) => {
    const usuario = window.app.usuarios.find((u) => u.id === usuarioId)
    if (!usuario) return

    // Obtener datos detallados de cuotas desde el backend para tener capital/interés actualizado
    try {
      const response = await fetch(`window.API_BASE_URL/credits/installments/${usuario.credit_id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.installments) {
          // Actualizar cuotas del usuario con la información detallada
          usuario.cuotas = data.installments.map(inst => ({
            numero: inst.numero,
            fecha: inst.due_date,
            monto: inst.amount,
            cuota: inst.amount,
            capital: inst.capital,
            interest: inst.interest,
            interes: inst.interest, // Alias para compatibilidad
            balance: inst.balance,
            saldoPendiente: inst.balance,
            status: inst.status,
            fechaPago: inst.paid_date,
            pagado: inst.status === 'paid',
            completada: inst.status === 'paid',
            capital_paid: inst.capital_paid,
            interest_paid: inst.interest_paid,
            capital_pendiente: inst.capital_pendiente,
            interes_pendiente: inst.interes_pendiente
          }))
        }
      }
    } catch (error) {
      console.error("Error al obtener cuotas detalladas:", error)
    }

    pagoPersonalizadoActual = { usuarioId, usuario, cuotasAPagar: [], tipoPago: tipoPagoActual }

    document.getElementById("modal-pago-usuario-nombre").textContent = usuario.nombre
    document.getElementById("monto-pago-personalizado").value = ""
    document.getElementById("fecha-pago-personalizado").value = new Date().toISOString().split("T")[0]
    document.getElementById("nota-pago-personalizado").value = ""
    resumenPago.style.display = "none"
    cuotasPreviewTbody.innerHTML = ""

    // Reset tipo de pago
    tipoPagoBtns.forEach(btn => {
      btn.classList.remove("active")
      if (btn.dataset.tipo === "completo") btn.classList.add("active")
    })
    tipoPagoActual = "completo"

    cerrarModalSeleccionar()
    modalPagoPersonalizado.classList.remove("hidden")
  }

  montoPagoPersonalizado.addEventListener("input", () => {
    if (!pagoPersonalizadoActual) return

    const monto = Number.parseFloat(montoPagoPersonalizado.value) || 0
    if (monto <= 0) {
      resumenPago.style.display = "none"
      cuotasPreviewTbody.innerHTML = ""
      return
    }

    pagoPersonalizadoActual.tipoPago = tipoPagoActual
    const usuario = pagoPersonalizadoActual.usuario
    const resultado = window.PaymentProcessor.procesarPagoEscalable(usuario, monto, tipoPagoActual)

    if (resultado.exito && resultado.montoNoUtilizado < 1) {
      pagoPersonalizadoActual.cuotasAPagar = resultado.cuotasAPagar
      pagoPersonalizadoActual.montoPagadoTotal = resultado.montoPagadoTotal
      pagoPersonalizadoActual.montoNoUtilizado = resultado.montoNoUtilizado

      let html = ""
      resultado.cuotasAPagar.forEach((pago) => {
        const cuota = usuario.cuotas.find((c) => c.numero === pago.numero)
        if (cuota) {
          const montoOriginal = cuota.cuota || cuota.monto
          // Priorizar balance/saldoPendiente
          const saldoPendiente = typeof cuota.balance !== 'undefined' ? cuota.balance : (cuota.saldoPendiente || montoOriginal)

          if (pago.completada) {
            html += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 8px 0;">
              <span>Cuota #${pago.numero} <strong style="color: #0e9f6e;">(Pagada)</strong></span>
              <strong>$${window.PaymentProcessor.formatNumber(pago.montoPagado)}</strong>
            </div>`
          } else if (pago.esUltimaParcial) {
            html += `<div style="display: flex; justify-content: space-between; border-bottom: 1px solid #ddd; padding: 8px 0; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between;">
                <span>Cuota #${pago.numero} <strong style="color: #ff9800;">(Parcial)</strong></span>
                <strong>$${window.PaymentProcessor.formatNumber(pago.montoPagado)}</strong>
              </div>
              <div style="font-size: 12px; color: #666;">
                Saldo anterior: $${window.PaymentProcessor.formatNumber(saldoPendiente)}
              </div>
              <div style="font-size: 12px; color: #0066cc;">
                <strong>Nuevo saldo: $${window.PaymentProcessor.formatNumber(pago.nuevoMonto)}</strong>
              </div>
            </div>`
          }
        }
      })

      if (resultado.montoNoUtilizado > 0) {
        html += `<div style="color: #666; font-size: 12px; margin-top: 8px; padding-top: 8px; border-top: 2px solid #ddd;">
          Monto no utilizado: $${window.PaymentProcessor.formatNumber(resultado.montoNoUtilizado)}
        </div>`
      }

      // Agregar desglose por tipo de pago
      if (tipoPagoActual !== "completo") {
        const tipoLabel = tipoPagoActual === "capital" ? "Abono a Capital" : "Pago Mora + Interes"
        html += `<div class="desglose-pago" style="margin-top: 12px;">
          <h4>Tipo de pago: ${tipoLabel}</h4>
        </div>`
      }

      cuotasAPagarList.innerHTML = html
      resumenPago.style.display = "block"

      let previewHtml = ""
      resultado.cuotasAPagar.forEach((pago) => {
        const cuota = usuario.cuotas.find((c) => c.numero === pago.numero)
        if (cuota) {
          const montoOriginal = cuota.cuota || cuota.monto
          const saldoPendiente = typeof cuota.balance !== 'undefined' ? cuota.balance : (cuota.saldoPendiente || montoOriginal)
          
          const estado = pago.completada ? "Pagada" : pago.esUltimaParcial ? "Parcial" : "Pendiente"
          const estadoClase = pago.completada ? "pagada" : pago.esUltimaParcial ? "pendiente" : "pendiente"

          previewHtml += `
            <tr class="estado-${estadoClase}">
              <td><strong>#${pago.numero}</strong></td>
              <td>${new Date(cuota.fecha).toLocaleDateString("es-ES")}</td>
              <td>$${window.PaymentProcessor.formatNumber(montoOriginal)}</td>
              <td style="color: #d97706; font-weight: 500;">$${window.PaymentProcessor.formatNumber(saldoPendiente)}</td>
              <td><strong style="color: ${pago.completada ? "#0e9f6e" : "#ff9800"};">$${window.PaymentProcessor.formatNumber(pago.nuevoMonto)}</strong></td>
              <td>$${window.PaymentProcessor.formatNumber(typeof cuota.capital_pendiente !== 'undefined' ? cuota.capital_pendiente : cuota.capital)}</td>
              <td>$${window.PaymentProcessor.formatNumber(typeof cuota.interes_pendiente !== 'undefined' ? cuota.interes_pendiente : cuota.interes)}</td>
              <td><span class="risk-level ${estadoClase}">${estado}</span></td>
            </tr>
          `
        }
      })
      cuotasPreviewTbody.innerHTML = previewHtml
    } else {
      let mensajeError = resultado.mensaje
      if (resultado.exito && resultado.montoNoUtilizado >= 1) {
        mensajeError = `Monto valido. Se aplicara la resta escalable a las cuotas.`
      }
      cuotasAPagarList.innerHTML = `<p style="color: #333; font-size: 13px;">${mensajeError}</p>`
      resumenPago.style.display = "block"
    }
  })

  btnConfirmarPagoPersonalizado.addEventListener("click", () => {
    if (!pagoPersonalizadoActual || pagoPersonalizadoActual.cuotasAPagar.length === 0) {
      window.app.mostrarNotificacion("No hay cuotas para pagar con este monto", "error")
      return
    }

    const fechaPago = document.getElementById("fecha-pago-personalizado").value
    if (!fechaPago) {
      window.app.mostrarNotificacion("Ingrese la fecha del pago", "error")
      return
    }

    const usuario = pagoPersonalizadoActual.usuario
    const nota = document.getElementById("nota-pago-personalizado").value || ""
    const token = sessionStorage.getItem("access_token")
    const creditId = usuario.credit_id || usuario.id

    fetch(`window.API_BASE_URL/credits/pago_parcial/${creditId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
      body: JSON.stringify({ 
        amount: pagoPersonalizadoActual.montoPagadoTotal,
        tipo_pago: tipoPagoActual,
        fecha_pago: fechaPago,
        nota: nota
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Error" }))
          throw new Error(err.detail || "Error applying partial payment")
        }
        return res.json()
      })
      .then((data) => {
        window.app.loadFromApi()
        window.app.mostrarNotificacion(
          `Pago de $${window.PaymentProcessor.formatNumber(pagoPersonalizadoActual.montoPagadoTotal)} registrado en ${pagoPersonalizadoActual.cuotasAPagar.length} cuota(s)`,
          "success",
        )
        cerrarModalPagoPersonalizado()
        setTimeout(() => {
          renderUsuarios()
          actualizarEstadisticas()
          window.dispatchEvent(new CustomEvent("pagoActualizado"))
        }, 200)
      })
      .catch((err) => {
        console.error("Error aplicando pago parcial:", err)
        window.app.mostrarNotificacion(`Error: ${err.message}`, "error")
      })
  })

  function cerrarModalPagoPersonalizado() {
    modalPagoPersonalizado.classList.add("hidden")
    pagoPersonalizadoActual = null
    montoPagoPersonalizado.value = ""
    resumenPago.style.display = "none"
    cuotasPreviewTbody.innerHTML = ""
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")
      currentFilter = btn.getAttribute("data-filter")
      renderUsuarios()
    })
  })

  if (btnCloseSeleccionar) btnCloseSeleccionar.addEventListener("click", cerrarModalSeleccionar)
  if (btnClosePago) btnClosePago.addEventListener("click", cerrarModalPago)
  if (btnCancelPago) btnCancelPago.addEventListener("click", cerrarModalPago)
  if (btnClosePagoPersonalizado) btnClosePagoPersonalizado.addEventListener("click", cerrarModalPagoPersonalizado)
  if (btnCancelPagoPersonalizado) btnCancelPagoPersonalizado.addEventListener("click", cerrarModalPagoPersonalizado)
  if (btnCloseEditar) btnCloseEditar.addEventListener("click", cerrarModalEditar)
  if (btnCancelEditar) btnCancelEditar.addEventListener("click", cerrarModalEditar)

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cerrarModalSeleccionar()
        cerrarModalPago()
        cerrarModalPagoPersonalizado()
        cerrarModalEditar()
      }
    })
  })

  window.addEventListener("datosActualizados", () => {
    renderUsuarios()
    actualizarEstadisticas()
  })

  esperar(
    () => {
      const ready = window.app && window.app.usuarios && Array.isArray(window.app.usuarios)
      return ready
    },
    () => {
      renderUsuarios()
      actualizarEstadisticas()
    },
  )
})
