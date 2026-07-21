/**
 * ============================================================================
 * SISTEMA DE SCORE CREDITICIO - CreditoFuturo v2.0
 * ============================================================================
 * 
 * Modelo de score crediticio que evalúa la Probabilidad de Default (PD)
 * basándose en cuatro dimensiones críticas de comportamiento de pago.
 * 
 * ESCALA: 0 - 1,000 puntos (todos empiezan en 0)
 * MAYOR PUNTAJE = MENOR RIESGO
 * 
 * PONDERACIÓN (Weight of Evidence - WoE):
 * - Variable A (Cumplimiento post-plazo):      20% (max 200 pts)
 * - Variable B (Sensibilidad quincenal):       25% (max 250 pts)
 * - Variable C (Capital vs Interés):           40% (max 400 pts)
 * - Variable D (Persistencia de mora):         15% (max 150 pts)
 * 
 * CATEGORÍAS DE RIESGO:
 * - A (800-1000): Riesgo Bajo - Cliente Premium
 * - B (600-799):  Riesgo Medio - Cliente Estándar
 * - C (400-599):  Riesgo Alto - Requiere Monitoreo
 * - D (0-399):    Riesgo Crítico - Atención Inmediata
 * 
 * ============================================================================
 */

class CreditScoreEngine {
  constructor() {
    this.VERSION = '2.0';
    this.MAX_SCORE = 1000;
    
    // Pesos de cada variable
    this.WEIGHTS = {
      A: { max: 200, peso: 0.20, nombre: 'Cumplimiento Post-Plazo' },
      B: { max: 250, peso: 0.25, nombre: 'Sensibilidad Quincenal' },
      C: { max: 400, peso: 0.40, nombre: 'Capital vs Interés' },
      D: { max: 150, peso: 0.15, nombre: 'Persistencia de Mora' }
    };
    
    // Categorías de riesgo
    this.CATEGORIAS = {
      A: { min: 800, max: 1000, nivel: 'bajo', label: 'Riesgo Bajo', descripcion: 'Cliente Premium', color: '#22C55E' },
      B: { min: 600, max: 799, nivel: 'medio', label: 'Riesgo Medio', descripcion: 'Cliente Estándar', color: '#F59E0B' },
      C: { min: 400, max: 599, nivel: 'alto', label: 'Riesgo Alto', descripcion: 'Requiere Monitoreo', color: '#EA580C' },
      D: { min: 0, max: 399, nivel: 'critico', label: 'Riesgo Crítico', descripcion: 'Atención Inmediata', color: '#DC2626' }
    };
  }

  // ============================================================================
  // DETECCIÓN DE DUPLICADOS
  // ============================================================================
  
  /**
   * Normaliza un nombre para comparación (elimina acentos, espacios extra, etc.)
   */
  normalizarNombre(nombre) {
    if (!nombre) return '';
    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/[^a-z0-9\s]/g, '') // Solo letras, números y espacios
      .replace(/\s+/g, ' ') // Espacios múltiples a uno
      .trim();
  }
  
  /**
   * Normaliza un teléfono (solo últimos 10 dígitos)
   */
  normalizarTelefono(telefono) {
    if (!telefono) return '';
    const soloDigitos = String(telefono).replace(/\D/g, '');
    return soloDigitos.slice(-10);
  }
  
  /**
   * Detecta y filtra usuarios duplicados
   * Solo toma el registro con más historial de pagos
   */
  detectarDuplicados(usuarios) {
    const grupos = new Map();
    
    usuarios.forEach(usuario => {
      const nombreNorm = this.normalizarNombre(usuario.nombre);
      const telefonoNorm = this.normalizarTelefono(usuario.telefono);
      const clave = `${nombreNorm}_${telefonoNorm}`;
      
      if (!grupos.has(clave)) {
        grupos.set(clave, []);
      }
      grupos.get(clave).push(usuario);
    });
    
    const usuariosUnicos = [];
    const duplicadosDetectados = [];
    const usuariosExcluidos = [];
    
    grupos.forEach((grupo, clave) => {
      if (grupo.length === 1) {
        usuariosUnicos.push(grupo[0]);
      } else {
        // Ordenar por número de cuotas pagadas (descendente)
        const grupoOrdenado = grupo.sort((a, b) => {
          const pagadasA = (a.cuotas || []).filter(c => c.pagado).length;
          const pagadasB = (b.cuotas || []).filter(c => c.pagado).length;
          if (pagadasB !== pagadasA) return pagadasB - pagadasA;
          // Si empatan, tomar el de mayor ID (más reciente)
          return (b.id || 0) - (a.id || 0);
        });
        
        const mejor = grupoOrdenado[0];
        const excluidos = grupoOrdenado.slice(1);
        
        usuariosUnicos.push(mejor);
        duplicadosDetectados.push({
          clave,
          cantidad: grupo.length,
          seleccionado: mejor,
          excluidos: excluidos
        });
        usuariosExcluidos.push(...excluidos);
      }
    });
    
    return {
      usuariosUnicos,
      duplicadosDetectados,
      usuariosExcluidos,
      totalOriginal: usuarios.length,
      totalUnicos: usuariosUnicos.length,
      totalDuplicados: usuariosExcluidos.length
    };
  }

  // ============================================================================
  // VARIABLE A: PAGOS POST-PLAZO INICIAL (20% - Max 200 pts)
  // ============================================================================
  
  /**
   * Analiza la frecuencia y severidad de pagos realizados después de que
   * el contrato original ha expirado.
   * 
   * @param {Object} usuario - Datos del usuario con cuotas
   * @returns {Object} { score, detalles }
   */
  calcularVariableA(usuario) {
    const cuotas = usuario.cuotas || [];
    
    if (cuotas.length === 0) {
      return {
        score: 100, // Score neutral sin historial
        tasaRecuperacionTardia: 0,
        pagosPostPlazo: 0,
        totalPagados: 0,
        interpretacion: 'Sin historial de pagos'
      };
    }
    
    // Calcular fecha fin de contrato original (última cuota programada)
    const fechasCuotas = cuotas.map(c => new Date(c.fecha)).sort((a, b) => b - a);
    const fechaFinContrato = fechasCuotas[0];
    
    let pagosPostPlazo = 0;
    let totalPagados = 0;
    
    cuotas.forEach(cuota => {
      if (cuota.pagado) {
        totalPagados++;
        const fechaPago = cuota.fechaPago ? new Date(cuota.fechaPago) : new Date(cuota.fecha);
        if (fechaPago > fechaFinContrato) {
          pagosPostPlazo++;
        }
      }
    });
    
    // Calcular tasa de recuperación tardía
    const tasaRecuperacionTardia = totalPagados > 0 ? pagosPostPlazo / totalPagados : 0;
    
    // Calcular score
    let score, interpretacion;
    
    if (tasaRecuperacionTardia === 0) {
      score = 200;
      interpretacion = 'Excelente: Sin pagos post-plazo';
    } else if (tasaRecuperacionTardia <= 0.1) {
      score = 180;
      interpretacion = 'Muy Bueno: Pagos ocasionales post-plazo';
    } else if (tasaRecuperacionTardia <= 0.25) {
      score = 140;
      interpretacion = 'Bueno: Algunos pagos post-plazo';
    } else if (tasaRecuperacionTardia <= 0.5) {
      score = 100;
      interpretacion = 'Regular: Pagos frecuentes post-plazo';
    } else if (tasaRecuperacionTardia <= 0.75) {
      score = 50;
      interpretacion = 'Deficiente: Mayoría de pagos post-plazo';
    } else {
      score = 0;
      interpretacion = 'Crítico: Todos los pagos fueron post-plazo';
    }
    
    return {
      score,
      tasaRecuperacionTardia: Math.round(tasaRecuperacionTardia * 100),
      pagosPostPlazo,
      totalPagados,
      interpretacion
    };
  }

  // ============================================================================
  // VARIABLE B: SENSIBILIDAD QUINCENAL (25% - Max 250 pts)
  // ============================================================================
  
  /**
   * Mide la correlación entre la fecha de pago y el ciclo de nómina.
   * Ventanas de riesgo: días 16-20 (post día 15) y días 1-5 (post día 30/31)
   * 
   * @param {Object} usuario - Datos del usuario con cuotas
   * @returns {Object} { score, detalles }
   */
  calcularVariableB(usuario) {
    const cuotas = usuario.cuotas || [];
    
    if (cuotas.length === 0) {
      return {
        score: 125, // Score neutral sin historial
        porcentajeRiesgo: 0,
        pagosEnVentana: 0,
        totalPagos: 0,
        interpretacion: 'Sin historial de pagos'
      };
    }
    
    let pagosEnVentanaRiesgo = 0;
    let totalPagos = 0;
    
    cuotas.forEach(cuota => {
      if (cuota.pagado && cuota.fechaPago) {
        totalPagos++;
        const fechaPago = new Date(cuota.fechaPago);
        const diaPago = fechaPago.getDate();
        
        // Ventanas de riesgo post-quincena
        // Días 16-20 (después del 15)
        // Días 1-5 (después del 30/31)
        if ((diaPago >= 16 && diaPago <= 20) || (diaPago >= 1 && diaPago <= 5)) {
          pagosEnVentanaRiesgo++;
        }
      }
    });
    
    if (totalPagos === 0) {
      return {
        score: 125,
        porcentajeRiesgo: 0,
        pagosEnVentana: 0,
        totalPagos: 0,
        interpretacion: 'Sin pagos registrados con fecha'
      };
    }
    
    const porcentajeRiesgo = pagosEnVentanaRiesgo / totalPagos;
    
    let score, interpretacion;
    
    if (porcentajeRiesgo === 0) {
      score = 250;
      interpretacion = 'Excelente: Flujo de caja sólido';
    } else if (porcentajeRiesgo <= 0.1) {
      score = 225;
      interpretacion = 'Muy Bueno: Ocasionalmente ajustado';
    } else if (porcentajeRiesgo <= 0.25) {
      score = 187;
      interpretacion = 'Bueno: Flujo moderadamente ajustado';
    } else if (porcentajeRiesgo <= 0.5) {
      score = 125;
      interpretacion = 'Regular: Depende de la nómina';
    } else if (porcentajeRiesgo <= 0.75) {
      score = 62;
      interpretacion = 'Deficiente: Alta dependencia de nómina';
    } else {
      score = 0;
      interpretacion = 'Crítico: Sin capacidad de ahorro';
    }
    
    return {
      score,
      porcentajeRiesgo: Math.round(porcentajeRiesgo * 100),
      pagosEnVentana: pagosEnVentanaRiesgo,
      totalPagos,
      interpretacion
    };
  }

  // ============================================================================
  // VARIABLE C: COMPORTAMIENTO CAPITAL VS INTERÉS (40% - Max 400 pts)
  // ============================================================================
  
  /**
   * Evalúa la estructura del pago. Diferencia entre clientes que solo cubren
   * el pago mínimo (intereses) vs los que abonan al capital.
   * 
   * Identifica:
   * - "Pagador de Capital": Reduce activamente el saldo
   * - "Pagador Mínimo": Solo cubre intereses
   * - "Deudor en Erosión": Acumula intereses, no reduce capital
   * 
   * @param {Object} usuario - Datos del usuario con cuotas
   * @returns {Object} { score, detalles }
   */
  calcularVariableC(usuario) {
    const cuotas = usuario.cuotas || [];
    const montoOriginal = usuario.monto || 0;
    
    if (cuotas.length === 0 || montoOriginal === 0) {
      return {
        score: 200, // Score neutral sin historial
        ratioCapital: 0,
        porcentajeCapitalAmortizado: 0,
        totalCapitalPagado: 0,
        totalInteresPagado: 0,
        tipoPagador: 'Sin historial',
        interpretacion: 'Sin historial de pagos'
      };
    }
    
    let totalCapitalPagado = 0;
    let totalInteresPagado = 0;
    let totalPagado = 0;
    
    cuotas.forEach(cuota => {
      if (cuota.pagado) {
        const capital = cuota.capital || 0;
        const interes = cuota.interes || 0;
        const montoPagado = cuota.montoPagado || cuota.cuota || 0;
        
        totalCapitalPagado += capital;
        totalInteresPagado += interes;
        totalPagado += montoPagado;
      }
    });
    
    if (totalPagado === 0) {
      return {
        score: 0,
        ratioCapital: 0,
        porcentajeCapitalAmortizado: 0,
        totalCapitalPagado: 0,
        totalInteresPagado: 0,
        tipoPagador: 'Sin pagos',
        interpretacion: 'Sin pagos realizados - Máximo riesgo'
      };
    }
    
    const ratioCapital = totalCapitalPagado / totalPagado;
    const porcentajeCapitalAmortizado = totalCapitalPagado / montoOriginal;
    
    let baseScore, tipoPagador, interpretacion;
    
    if (ratioCapital >= 0.7) {
      baseScore = 400;
      tipoPagador = 'Excelente Reductor de Capital';
      interpretacion = 'Prioriza la reducción del saldo principal';
    } else if (ratioCapital >= 0.6) {
      baseScore = 350;
      tipoPagador = 'Muy Buen Reductor';
      interpretacion = 'Buenos abonos a capital';
    } else if (ratioCapital >= 0.5) {
      baseScore = 280;
      tipoPagador = 'Buen Reductor';
      interpretacion = 'Balance adecuado capital/interés';
    } else if (ratioCapital >= 0.4) {
      baseScore = 200;
      tipoPagador = 'Pagador Equilibrado';
      interpretacion = 'Pagos balanceados';
    } else if (ratioCapital >= 0.3) {
      baseScore = 120;
      tipoPagador = 'Pagador Mínimo';
      interpretacion = 'Pagos mayormente a intereses';
    } else if (ratioCapital >= 0.2) {
      baseScore = 60;
      tipoPagador = 'Deudor en Erosión Leve';
      interpretacion = 'Poco abono a capital';
    } else {
      baseScore = 0;
      tipoPagador = 'Deudor en Erosión Crítica';
      interpretacion = 'Solo paga intereses - No reduce deuda';
    }
    
    // Bonus por porcentaje de capital ya amortizado
    const bonus = Math.min(porcentajeCapitalAmortizado * 100, 50);
    const score = Math.min(baseScore + bonus, 400);
    
    return {
      score: Math.round(score),
      ratioCapital: Math.round(ratioCapital * 100),
      porcentajeCapitalAmortizado: Math.round(porcentajeCapitalAmortizado * 100),
      totalCapitalPagado,
      totalInteresPagado,
      tipoPagador,
      interpretacion
    };
  }

  // ============================================================================
  // VARIABLE D: PERSISTENCIA DE MORA (15% - Max 150 pts)
  // ============================================================================
  
  /**
   * Analiza el histórico de días de atraso (DPD - Days Past Due) promedio
   * y su tendencia (mejorando o empeorando).
   * 
   * @param {Object} usuario - Datos del usuario con cuotas
   * @returns {Object} { score, detalles }
   */
  calcularVariableD(usuario) {
    const cuotas = usuario.cuotas || [];
    const hoy = new Date();
    
    if (cuotas.length === 0) {
      return {
        score: 75, // Score neutral
        dpdPromedio: 0,
        tendencia: 'neutral',
        tendenciaValor: 0,
        diasAtraso: [],
        interpretacion: 'Sin historial'
      };
    }
    
    const diasAtraso = [];
    
    cuotas.forEach(cuota => {
      const fechaVencimiento = new Date(cuota.fecha);
      let dpd;
      
      if (cuota.pagado && cuota.fechaPago) {
        const fechaPago = new Date(cuota.fechaPago);
        dpd = Math.max(0, Math.floor((fechaPago - fechaVencimiento) / (1000 * 60 * 60 * 24)));
      } else if (!cuota.pagado) {
        dpd = Math.max(0, Math.floor((hoy - fechaVencimiento) / (1000 * 60 * 60 * 24)));
      } else {
        dpd = 0;
      }
      
      diasAtraso.push(dpd);
    });
    
    if (diasAtraso.length === 0) {
      return {
        score: 75,
        dpdPromedio: 0,
        tendencia: 'neutral',
        tendenciaValor: 0,
        diasAtraso: [],
        interpretacion: 'Sin datos de atraso'
      };
    }
    
    // Calcular DPD promedio
    const dpdPromedio = diasAtraso.reduce((sum, d) => sum + d, 0) / diasAtraso.length;
    
    // Calcular tendencia (primeras 3 vs últimas 3)
    let tendenciaValor = 0;
    let tendencia = 'neutral';
    
    if (diasAtraso.length >= 6) {
      const primeras = diasAtraso.slice(0, 3).reduce((sum, d) => sum + d, 0) / 3;
      const ultimas = diasAtraso.slice(-3).reduce((sum, d) => sum + d, 0) / 3;
      tendenciaValor = primeras - ultimas; // Positivo = mejorando
      
      if (tendenciaValor > 10) {
        tendencia = 'mejorando_significativamente';
      } else if (tendenciaValor > 5) {
        tendencia = 'mejorando';
      } else if (tendenciaValor > 0) {
        tendencia = 'mejorando_levemente';
      } else if (tendenciaValor < -10) {
        tendencia = 'empeorando_significativamente';
      } else if (tendenciaValor < -5) {
        tendencia = 'empeorando';
      } else if (tendenciaValor < 0) {
        tendencia = 'empeorando_levemente';
      }
    }
    
    // Score base por DPD promedio
    let baseScore, interpretacion;
    
    if (dpdPromedio === 0) {
      baseScore = 150;
      interpretacion = 'Excelente: Siempre puntual';
    } else if (dpdPromedio <= 5) {
      baseScore = 135;
      interpretacion = 'Muy Bueno: Atrasos mínimos';
    } else if (dpdPromedio <= 15) {
      baseScore = 112;
      interpretacion = 'Bueno: Atrasos leves';
    } else if (dpdPromedio <= 30) {
      baseScore = 75;
      interpretacion = 'Regular: Atrasos moderados';
    } else if (dpdPromedio <= 60) {
      baseScore = 37;
      interpretacion = 'Deficiente: Atrasos significativos';
    } else if (dpdPromedio <= 90) {
      baseScore = 15;
      interpretacion = 'Crítico: Mora severa';
    } else {
      baseScore = 0;
      interpretacion = 'Default: Mora extrema';
    }
    
    // Ajuste por tendencia
    let tendenciaBonus = 0;
    if (tendenciaValor > 10) tendenciaBonus = 20;
    else if (tendenciaValor > 5) tendenciaBonus = 10;
    else if (tendenciaValor > 0) tendenciaBonus = 5;
    else if (tendenciaValor < -10) tendenciaBonus = -20;
    else if (tendenciaValor < -5) tendenciaBonus = -10;
    
    const score = Math.max(0, Math.min(baseScore + tendenciaBonus, 150));
    
    return {
      score: Math.round(score),
      dpdPromedio: Math.round(dpdPromedio),
      tendencia,
      tendenciaValor: Math.round(tendenciaValor),
      diasAtraso,
      interpretacion
    };
  }

  // ============================================================================
  // CÁLCULO DEL SCORE TOTAL
  // ============================================================================
  
  /**
   * Calcula el score crediticio total del usuario.
   * 
   * @param {Object} usuario - Datos del usuario
   * @returns {Object} Análisis completo con score, categoría y detalles
   */
  calcularScore(usuario) {
    // Calcular cada variable
    const varA = this.calcularVariableA(usuario);
    const varB = this.calcularVariableB(usuario);
    const varC = this.calcularVariableC(usuario);
    const varD = this.calcularVariableD(usuario);
    
    // Score total
    const scoreTotal = varA.score + varB.score + varC.score + varD.score;
    
    // Determinar categoría
    let categoria, nivel, label, descripcion, color;
    
    if (scoreTotal >= 800) {
      categoria = 'A';
      nivel = 'bajo';
      label = 'Riesgo Bajo';
      descripcion = 'Cliente Premium';
      color = '#22C55E';
    } else if (scoreTotal >= 600) {
      categoria = 'B';
      nivel = 'medio';
      label = 'Riesgo Medio';
      descripcion = 'Cliente Estándar';
      color = '#F59E0B';
    } else if (scoreTotal >= 400) {
      categoria = 'C';
      nivel = 'alto';
      label = 'Riesgo Alto';
      descripcion = 'Requiere Monitoreo';
      color = '#EA580C';
    } else {
      categoria = 'D';
      nivel = 'critico';
      label = 'Riesgo Crítico';
      descripcion = 'Atención Inmediata';
      color = '#DC2626';
    }
    
    // Generar recomendaciones
    const recomendaciones = this.generarRecomendaciones(scoreTotal, varA, varB, varC, varD);
    
    // Identificar tipo de cliente
    const tipoCliente = this.identificarTipoCliente(varB, varC);
    
    return {
      score: Math.round(scoreTotal),
      maxScore: this.MAX_SCORE,
      porcentaje: Math.round((scoreTotal / this.MAX_SCORE) * 100),
      categoria,
      nivel,
      label,
      descripcion,
      color,
      tipoCliente,
      variables: {
        A: {
          nombre: this.WEIGHTS.A.nombre,
          score: varA.score,
          max: this.WEIGHTS.A.max,
          peso: '20%',
          detalles: varA
        },
        B: {
          nombre: this.WEIGHTS.B.nombre,
          score: varB.score,
          max: this.WEIGHTS.B.max,
          peso: '25%',
          detalles: varB
        },
        C: {
          nombre: this.WEIGHTS.C.nombre,
          score: varC.score,
          max: this.WEIGHTS.C.max,
          peso: '40%',
          detalles: varC
        },
        D: {
          nombre: this.WEIGHTS.D.nombre,
          score: varD.score,
          max: this.WEIGHTS.D.max,
          peso: '15%',
          detalles: varD
        }
      },
      recomendaciones,
      fechaCalculo: new Date().toISOString(),
      version: this.VERSION
    };
  }
  
  /**
   * Identifica el tipo de cliente basado en su comportamiento
   */
  identificarTipoCliente(varB, varC) {
    // Pagador lento pero seguro: Paga tarde pero reduce capital
    if (varB.score < 150 && varC.score >= 280) {
      return {
        tipo: 'pagador_lento_seguro',
        label: 'Pagador Lento pero Seguro',
        descripcion: 'Paga después de quincena pero siempre reduce su deuda'
      };
    }
    
    // Deudor en erosión: Solo paga intereses
    if (varC.score < 100) {
      return {
        tipo: 'deudor_erosion',
        label: 'Deudor en Erosión Financiera',
        descripcion: 'Solo paga intereses para evitar bloqueo, no reduce deuda'
      };
    }
    
    // Cliente premium: Buenos scores en todo
    if (varB.score >= 200 && varC.score >= 300) {
      return {
        tipo: 'cliente_premium',
        label: 'Cliente Premium',
        descripcion: 'Excelente comportamiento de pago'
      };
    }
    
    // Cliente estándar
    return {
      tipo: 'cliente_estandar',
      label: 'Cliente Estándar',
      descripcion: 'Comportamiento de pago regular'
    };
  }
  
  /**
   * Genera recomendaciones basadas en el análisis
   */
  generarRecomendaciones(scoreTotal, varA, varB, varC, varD) {
    const recomendaciones = [];
    
    // Recomendaciones por Variable B (Sensibilidad Quincenal)
    if (varB.score < 125) {
      recomendaciones.push({
        tipo: 'cobranza',
        prioridad: 'alta',
        mensaje: 'Implementar débito automático el día de nómina',
        accion: 'debito_automatico'
      });
      recomendaciones.push({
        tipo: 'cobranza',
        prioridad: 'media',
        mensaje: 'Enviar recordatorio 3 días antes de quincena',
        accion: 'recordatorio_pre_quincena'
      });
    }
    
    // Recomendaciones por Variable C (Capital vs Interés)
    if (varC.score < 100) {
      recomendaciones.push({
        tipo: 'restructuracion',
        prioridad: 'urgente',
        mensaje: 'Ofrecer plan de reestructuración con pagos fijos a capital',
        accion: 'reestructuracion'
      });
      recomendaciones.push({
        tipo: 'alerta',
        prioridad: 'alta',
        mensaje: 'ALERTA: Patrón de erosión financiera detectado',
        accion: 'alerta_erosion'
      });
    } else if (varC.score < 200) {
      recomendaciones.push({
        tipo: 'educacion',
        prioridad: 'media',
        mensaje: 'Educar sobre beneficios de abonar a capital',
        accion: 'educacion_financiera'
      });
    }
    
    // Recomendaciones por Variable D (Mora)
    if (varD.score < 50) {
      recomendaciones.push({
        tipo: 'cobranza',
        prioridad: 'urgente',
        mensaje: 'Contacto inmediato de cobranza - Mora severa',
        accion: 'cobranza_urgente'
      });
    } else if (varD.score < 100 && varD.tendencia.includes('empeorando')) {
      recomendaciones.push({
        tipo: 'cobranza',
        prioridad: 'alta',
        mensaje: 'Tendencia negativa detectada - Contacto preventivo',
        accion: 'cobranza_preventiva'
      });
    }
    
    // Recomendación general por score total
    if (scoreTotal >= 800) {
      recomendaciones.push({
        tipo: 'comercial',
        prioridad: 'baja',
        mensaje: 'Cliente elegible para mejores condiciones/aumento de límite',
        accion: 'oferta_comercial'
      });
    } else if (scoreTotal < 400) {
      recomendaciones.push({
        tipo: 'riesgo',
        prioridad: 'urgente',
        mensaje: 'No aprobar nuevos créditos sin garantía adicional',
        accion: 'bloqueo_credito'
      });
    }
    
    return recomendaciones.sort((a, b) => {
      const prioridadOrden = { urgente: 0, alta: 1, media: 2, baja: 3 };
      return prioridadOrden[a.prioridad] - prioridadOrden[b.prioridad];
    });
  }

  // ============================================================================
  // LÓGICA DE APROBACIÓN (CUT-OFF)
  // ============================================================================
  
  /**
   * Evalúa si un usuario puede ser aprobado para un nuevo crédito
   */
  evaluarAprobacion(usuario, montoSolicitado) {
    const analisis = this.calcularScore(usuario);
    const score = analisis.score;
    const varB = analisis.variables.B.score;
    const varC = analisis.variables.C.score;
    
    // Reglas de rechazo automático
    if (score < 300) {
      return {
        aprobado: false,
        montoMaximo: 0,
        tasaSugerida: null,
        motivo: 'Score muy bajo - Alto riesgo de default',
        categoria: analisis.categoria,
        condiciones: []
      };
    }
    
    // Deudor en erosión financiera
    if (varC < 60 && score < 500) {
      return {
        aprobado: false,
        montoMaximo: 0,
        tasaSugerida: null,
        motivo: 'Patrón de erosión financiera detectado',
        categoria: analisis.categoria,
        condiciones: []
      };
    }
    
    // Flujo de caja crítico
    if (varB < 50 && score < 500) {
      return {
        aprobado: false,
        montoMaximo: 0,
        tasaSugerida: null,
        motivo: 'Flujo de caja insuficiente',
        categoria: analisis.categoria,
        condiciones: []
      };
    }
    
    // Combinación peligrosa
    if (varC < 100 && varB < 100) {
      return {
        aprobado: false,
        montoMaximo: 0,
        tasaSugerida: null,
        motivo: 'Combinación de riesgo: erosión + flujo ajustado',
        categoria: analisis.categoria,
        condiciones: []
      };
    }
    
    // Aprobación con condiciones
    let factorMonto, tasaBase;
    
    if (score >= 800) {
      factorMonto = 1.2;
      tasaBase = 0.08; // 8%
    } else if (score >= 600) {
      factorMonto = 1.0;
      tasaBase = 0.12; // 12%
    } else if (score >= 400) {
      factorMonto = 0.7;
      tasaBase = 0.18; // 18%
    } else {
      factorMonto = 0.5;
      tasaBase = 0.24; // 24%
    }
    
    const montoMaximo = montoSolicitado * factorMonto;
    const condiciones = [];
    
    if (score < 600) {
      condiciones.push('Requiere aval o garantía adicional');
    }
    if (varB < 150) {
      condiciones.push('Se recomienda débito automático');
    }
    if (varC < 200) {
      condiciones.push('Establecer pagos mínimos a capital obligatorios');
    }
    
    return {
      aprobado: true,
      montoMaximo: Math.round(montoMaximo),
      tasaSugerida: tasaBase * 100, // En porcentaje
      motivo: `Aprobado - Categoría ${analisis.categoria}`,
      categoria: analisis.categoria,
      condiciones
    };
  }
}

// Exportar instancia global
window.CreditScoreEngine = new CreditScoreEngine();
