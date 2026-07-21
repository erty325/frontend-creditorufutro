/**
 * Sistema mejorado para procesar pagos personalizados de forma escalable
 * Distribuye de forma inteligente un monto disponible entre todas las cuotas pendientes
 * Manteniendo actualizado el saldo pendiente de cada cuota
 */

class PaymentProcessor {
  /**
   * Procesa un pago personalizado de forma escalable
   * Resta el monto de cada cuota en orden cronológico
   * @param {Object} usuario - El usuario con sus cuotas
   * @param {number} montoDisponible - El monto a distribuir
   * @param {string} tipoPago - Tipo de pago: 'completo', 'capital', 'interes'
   * @returns {Object} Resultado con detalles del procesamiento
   */
  static procesarPagoEscalable(usuario, montoDisponible, tipoPago = 'completo') {
    if (!usuario.cuotas || usuario.cuotas.length === 0) {
      return {
        exito: false,
        mensaje: "No hay cuotas disponibles",
        cuotasAPagar: [],
        montoPagadoTotal: 0,
        montoNoUtilizado: montoDisponible,
      }
    }

    // Obtener solo las cuotas pendientes, ordenadas cronológicamente
    const cuotasPendientes = usuario.cuotas
      .filter((c) => !c.pagado && !c.completada)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

    if (cuotasPendientes.length === 0) {
      return {
        exito: false,
        mensaje: "Todas las cuotas ya están pagadas",
        cuotasAPagar: [],
        montoPagadoTotal: 0,
        montoNoUtilizado: montoDisponible,
      }
    }

    let montoRestante = montoDisponible
    const cuotasAPagar = []
    let montoPagadoTotal = 0

    for (const cuota of cuotasPendientes) {
      if (montoRestante <= 0) break

      // USAR EL BALANCE O SALDO PENDIENTE REAL
      const montoActualCuota = typeof cuota.balance !== 'undefined' ? cuota.balance : (cuota.saldoPendiente || cuota.cuota)
      
      // Calcular capital e interés pendientes reales
      // Si el backend envía capital_pendiente, usarlo. Si no, calcularlo.
      const capitalOriginal = cuota.capital || 0
      const interesOriginal = cuota.interes || 0
      
      const capitalPagado = cuota.capital_paid || 0
      const interesPagado = cuota.interest_paid || 0
      
      const capitalPendiente = typeof cuota.capital_pendiente !== 'undefined' ? cuota.capital_pendiente : Math.max(0, capitalOriginal - capitalPagado)
      const interesPendiente = typeof cuota.interes_pendiente !== 'undefined' ? cuota.interes_pendiente : Math.max(0, interesOriginal - interesPagado)

      
      let montoPagado = 0
      let nuevoMonto = montoActualCuota

      if (tipoPago === 'capital') {
        // Solo pagar capital
        if (montoRestante >= capitalPendiente) {
          montoPagado = capitalPendiente
          nuevoMonto = interesPendiente // Solo queda el interés
          montoRestante -= capitalPendiente
        } else {
          montoPagado = montoRestante
          // Calcular cuánto capital queda y sumar todo el interés
          const capitalRestante = capitalPendiente - montoRestante
          nuevoMonto = capitalRestante + interesPendiente
          montoRestante = 0
        }

        cuotasAPagar.push({
          numero: cuota.numero,
          fecha: cuota.fecha,
          montoPagado: montoPagado,
          nuevoMonto: new Intl.NumberFormat("en-US", {useGrouping: false, maximumFractionDigits: 2}).format(nuevoMonto), // Evitar notación científica
          completada: nuevoMonto <= 0.01,
          esUltimaParcial: nuevoMonto > 0.01 && montoRestante <= 0,
        })

        montoPagadoTotal += montoPagado

} else if (tipoPago === 'mora' || tipoPago === 'interes') {
        // Pago de mora + interés: Prioriza mora, luego intereses base
        // Calcular mora acumulada
        const hoy = new Date()
        hoy.setHours(0, 0, 0, 0)
        const fechaCuota = new Date(cuota.fecha + "T00:00:00")
        let moraAcumulada = 0
        
        if (fechaCuota < hoy && !cuota.pagado) {
          const diasVencidos = Math.floor((hoy - fechaCuota) / (1000 * 60 * 60 * 24))
          const tasaMora = 5 // 5% por defecto para mora
          moraAcumulada = capitalPendiente * (tasaMora / 100) * (diasVencidos / 30)
        }
        
        const totalMoraInteres = moraAcumulada + interesPendiente
        
        if (montoRestante >= totalMoraInteres) {
          montoPagado = totalMoraInteres
          nuevoMonto = capitalPendiente // Solo queda el capital
          montoRestante -= totalMoraInteres
        } else {
          montoPagado = montoRestante
          // Primero se aplica a mora, luego a interés
          let restante = montoRestante
          const moraPagada = Math.min(restante, moraAcumulada)
          restante -= moraPagada
          const interesPagado = Math.min(restante, interesPendiente)
          const moraRestante = moraAcumulada - moraPagada
          const interesRestante = interesPendiente - interesPagado
          nuevoMonto = capitalPendiente + interesRestante + moraRestante
          montoRestante = 0
        }

        cuotasAPagar.push({
          numero: cuota.numero,
          fecha: cuota.fecha,
          montoPagado: montoPagado,
          nuevoMonto: new Intl.NumberFormat("en-US", {useGrouping: false, maximumFractionDigits: 2}).format(nuevoMonto),
          completada: nuevoMonto <= 0.01,
          esUltimaParcial: nuevoMonto > 0.01 && montoRestante <= 0,
          moraAcumulada: moraAcumulada,
        })

        montoPagadoTotal += montoPagado

      } else {
        // Pago completo (como antes)
        if (montoRestante >= montoActualCuota) {
          // La cuota se cubre completamente
          montoPagado = montoActualCuota
          montoRestante -= montoActualCuota
          nuevoMonto = 0

          cuotasAPagar.push({
            numero: cuota.numero,
            fecha: cuota.fecha,
            montoPagado: montoPagado,
            nuevoMonto: 0,
            completada: true,
            esUltimaParcial: false,
          })

          montoPagadoTotal += montoPagado
        } else if (montoRestante > 0) {
          // El monto restante se aplica parcialmente a esta cuota
          montoPagado = montoRestante
          nuevoMonto = montoActualCuota - montoPagado

          cuotasAPagar.push({
            numero: cuota.numero,
            fecha: cuota.fecha,
            montoPagado: montoPagado,
            nuevoMonto: new Intl.NumberFormat("en-US", {useGrouping: false, maximumFractionDigits: 2}).format(nuevoMonto),
            completada: false,
            esUltimaParcial: true,
          })

          montoPagadoTotal += montoPagado
          montoRestante = 0
        }
      }
    }

    return {
      exito: cuotasAPagar.length > 0,
      mensaje: cuotasAPagar.length > 0 ? `${cuotasAPagar.length} cuota(s) procesada(s)` : "El monto no es suficiente",
      cuotasAPagar: cuotasAPagar,
      montoPagadoTotal: montoPagadoTotal,
      montoNoUtilizado: montoRestante,
    }
  }

  /**
   * Aplica los cambios de las cuotas al objeto del usuario
   * Actualiza los montos de las cuotas y marca las completadas
   */
  static aplicarCambiosCuotas(usuario, cuotasAPagar) {
    cuotasAPagar.forEach((pagoInfo) => {
      const cuota = usuario.cuotas.find((c) => c.numero === pagoInfo.numero)
      if (cuota) {
        if (pagoInfo.completada) {
          cuota.completada = true
          cuota.pagado = true
          cuota.cuota = 0 // Reducir el monto a 0 cuando está completamente pagada
        } else if (pagoInfo.esUltimaParcial) {
          cuota.cuota = pagoInfo.nuevoMonto
          cuota.completada = false
          cuota.pagado = false
        }
      }
    })
  }

  /**
   * Recalcula los saldos pendientes de un usuario después de un pago
   */
  static recalcularSaldoPendiente(usuario) {
    if (!usuario.cuotas || usuario.cuotas.length === 0) return

    let saldoAcumulado = 0

    usuario.cuotas.forEach((cuota) => {
      if (!cuota.pagado && !cuota.completada) {
        const montoActual = cuota.cuota
        saldoAcumulado += montoActual
        cuota.saldoPendiente = Math.max(0, saldoAcumulado)
      } else if (cuota.pagado || cuota.completada) {
        cuota.saldoPendiente = 0
      }
    })
  }

  /**
   * Obtiene el saldo total pendiente de un usuario
   * Centralizado - usado por Dashboard, Usuarios, y Análisis de Riesgo
   * Ahora usa solo 'cuota.cuota' como fuente única de verdad
   */
  static obtenerSaldoTotalPendiente(usuario) {
    // Delegar al módulo central (`app`) si está disponible
    if (typeof window !== "undefined" && window.app && typeof window.app.obtenerSaldoTotalPendiente === "function") {
      return window.app.obtenerSaldoTotalPendiente(usuario)
    }

    // Fallback local: devolver el monto si no hay cuotas, o sumar el monto/cantidad de las cuotas pendientes
    if (!usuario.cuotas || usuario.cuotas.length === 0) return usuario.monto || 0

    return usuario.cuotas
      .filter((c) => !c.pagado && !c.completada)
      .reduce((sum, c) => sum + (typeof c.monto !== "undefined" ? c.monto : c.cuota || 0), 0)
  }

  /**
   * Formatea un número al estándar colombiano
   */
  static formatNumber(num) {
    return new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }
}

// Exportar para uso global
if (typeof window !== "undefined") {
  window.PaymentProcessor = PaymentProcessor
}
