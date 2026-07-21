/**
 * ============================================================================
 * GESTOR DE ANÁLISIS DE RIESGO - CreditoFuturo v2.0
 * ============================================================================
 * 
 * Interfaz de usuario para el sistema de score crediticio.
 * Utiliza CreditScoreEngine para los cálculos.
 * 
 * ============================================================================
 */

class RiskAnalysisManager {
  constructor() {
    this.currentFilter = 'all';
    this.currentSearchTerm = '';
    this.usuariosAnalizados = [];
    this.duplicadosInfo = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    window.addEventListener("datosActualizados", () => this.renderAnalysis());
    
    // Esperar a que el motor de score esté disponible
    if (window.CreditScoreEngine) {
      this.renderAnalysis();
    } else {
      // Reintentar después de cargar scripts
      setTimeout(() => this.renderAnalysis(), 500);
    }
    
    setInterval(() => this.renderAnalysis(), 10000); // Actualizar cada 10 segundos
  }

  setupEventListeners() {
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.filtrarTablas(e.target.dataset.filter));
    });
    
    // Botón para ver duplicados
    const btnDuplicados = document.getElementById('btn-ver-duplicados');
    if (btnDuplicados) {
      btnDuplicados.addEventListener('click', () => this.mostrarModalDuplicados());
    }

    // Buscador por nombre/cedula
    const buscarRiesgoInput = document.getElementById('buscar-riesgo');
    const btnLimpiarBusquedaRiesgo = document.getElementById('btn-limpiar-busqueda-riesgo');

    if (buscarRiesgoInput) {
      buscarRiesgoInput.addEventListener('input', () => {
        this.currentSearchTerm = buscarRiesgoInput.value.trim().toLowerCase();
        this.actualizarTablaEndeudados(this.currentFilter);
        this.actualizarTablaCuotasVencidas(this.currentFilter);
      });
    }

    if (btnLimpiarBusquedaRiesgo) {
      btnLimpiarBusquedaRiesgo.addEventListener('click', () => {
        if (buscarRiesgoInput) buscarRiesgoInput.value = '';
        this.currentSearchTerm = '';
        this.actualizarTablaEndeudados(this.currentFilter);
        this.actualizarTablaCuotasVencidas(this.currentFilter);
      });
    }
  }

  /**
   * Renderiza todo el análisis
   */
  renderAnalysis() {
    if (!window.app || !window.app.usuarios || !window.CreditScoreEngine) {
      console.warn('Esperando carga de datos y motor de score...');
      return;
    }
    
    // Detectar duplicados y obtener usuarios únicos
    this.duplicadosInfo = window.CreditScoreEngine.detectarDuplicados(window.app.usuarios);
    
    // Calcular scores para usuarios únicos
    this.usuariosAnalizados = this.duplicadosInfo.usuariosUnicos.map(usuario => ({
      ...usuario,
      analisis: window.CreditScoreEngine.calcularScore(usuario)
    }));
    
    // Ordenar por score (menor score = mayor riesgo primero)
    this.usuariosAnalizados.sort((a, b) => a.analisis.score - b.analisis.score);
    
    // Actualizar UI
    this.actualizarResumenRiesgos();
    this.actualizarInfoDuplicados();
    this.actualizarTablaEndeudados(this.currentFilter);
    this.actualizarTablaCuotasVencidas(this.currentFilter);
    this.renderHeatmap();
    this.renderScoreDistribution();
  }

  /**
   * Actualiza la información de duplicados en la UI
   */
  actualizarInfoDuplicados() {
    const infoDuplicados = document.getElementById('info-duplicados');
    if (!infoDuplicados || !this.duplicadosInfo) return;
    
    const { totalDuplicados, duplicadosDetectados } = this.duplicadosInfo;
    
    if (totalDuplicados === 0) {
      infoDuplicados.innerHTML = `
        <div class="duplicados-ok">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#22C55E">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span>Sin duplicados detectados</span>
        </div>
      `;
    } else {
      infoDuplicados.innerHTML = `
        <div class="duplicados-warning">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#F59E0B">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <span>${totalDuplicados} usuario(s) duplicado(s) detectado(s)</span>
          <button id="btn-ver-duplicados" class="btn-link">Ver detalles</button>
        </div>
      `;
      
      // Re-agregar listener
      const btn = document.getElementById('btn-ver-duplicados');
      if (btn) {
        btn.addEventListener('click', () => this.mostrarModalDuplicados());
      }
    }
  }

  /**
   * Muestra modal con detalles de duplicados
   */
  mostrarModalDuplicados() {
    if (!this.duplicadosInfo || this.duplicadosInfo.totalDuplicados === 0) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Usuarios Duplicados Detectados</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-info">Se detectaron ${this.duplicadosInfo.totalDuplicados} registros duplicados. 
          El sistema selecciona automáticamente el registro con más historial de pagos.</p>
          
          <table class="table">
            <thead>
              <tr>
                <th>Nombre/Teléfono</th>
                <th>Registros</th>
                <th>Seleccionado</th>
                <th>Excluidos</th>
              </tr>
            </thead>
            <tbody>
              ${this.duplicadosInfo.duplicadosDetectados.map(d => `
                <tr>
                  <td><small>${d.clave.replace('_', '<br>')}</small></td>
                  <td>${d.cantidad}</td>
                  <td>
                    <span class="badge badge-success">ID: ${d.seleccionado.id}</span>
                    <br><small>${(d.seleccionado.cuotas || []).filter(c => c.pagado).length} pagos</small>
                  </td>
                  <td>
                    ${d.excluidos.map(e => `
                      <span class="badge badge-muted">ID: ${e.id}</span>
                    `).join(' ')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary modal-close-btn">Entendido</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cerrar modal
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  /**
   * Actualiza los contadores de resumen de riesgo
   */
  actualizarResumenRiesgos() {
    const conteos = {
      A: 0, // Bajo
      B: 0, // Medio
      C: 0, // Alto
      D: 0  // Crítico
    };
    
    this.usuariosAnalizados.forEach(u => {
      conteos[u.analisis.categoria]++;
    });
    
    // Actualizar cards
    const countAlto = document.getElementById("count-alto");
    const countMedio = document.getElementById("count-medio");
    const countBajo = document.getElementById("count-bajo");
    const countCritico = document.getElementById("count-critico");
    
    if (countAlto) countAlto.textContent = conteos.C;
    if (countMedio) countMedio.textContent = conteos.B;
    if (countBajo) countBajo.textContent = conteos.A;
    if (countCritico) countCritico.textContent = conteos.D;
    
    // Actualizar score promedio
    const scorePromedio = document.getElementById("score-promedio");
    if (scorePromedio && this.usuariosAnalizados.length > 0) {
      const promedio = Math.round(
        this.usuariosAnalizados.reduce((sum, u) => sum + u.analisis.score, 0) / 
        this.usuariosAnalizados.length
      );
      scorePromedio.textContent = promedio;
    }
  }

  /**
   * Actualiza la tabla de usuarios con análisis de riesgo
   */
  actualizarTablaEndeudados(filtro = "all") {
    const tbody = document.getElementById("tabla-endeudados");
    const emptyState = document.getElementById("empty-endeudados");

    if (!tbody) return;

    // Filtrar por categoría
    const filterMap = {
      alto: ['C', 'D'],
      medio: ['B'],
      bajo: ['A']
    };

    let usuariosFiltrados = this.usuariosAnalizados.filter(u => {
      if (filtro === "all") return true;
      const categorias = filterMap[filtro] || [];
      return categorias.includes(u.analisis.categoria);
    });

    // Filtrar por busqueda (nombre o cedula)
    if (this.currentSearchTerm) {
      usuariosFiltrados = usuariosFiltrados.filter(u => {
        const nombre = (u.nombre || "").toLowerCase();
        const cedula = (u.cedula || "").toLowerCase();
        return nombre.includes(this.currentSearchTerm) || cedula.includes(this.currentSearchTerm);
      });
    }

    if (usuariosFiltrados.length === 0) {
      tbody.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    const formatNumber = (num) =>
      window.app && typeof window.app.formatNumber === "function"
        ? window.app.formatNumber(num)
        : new Intl.NumberFormat("es-CO").format(num);

    tbody.innerHTML = usuariosFiltrados
      .map((usuario) => {
        const saldoPendiente = window.PaymentProcessor 
          ? window.PaymentProcessor.obtenerSaldoTotalPendiente(usuario)
          : usuario.outstanding_balance || 0;
        
        const analisis = usuario.analisis;
        
        return `
          <tr class="score-row" data-usuario-id="${usuario.id}">
            <td>
              <div class="usuario-cell">
                <div class="usuario-info">
                  <span class="usuario-nombre">${usuario.nombre}</span>
                  <span class="usuario-cedula" style="color: #6b7280; font-size: 12px;">${usuario.cedula || "Sin Cedula"}</span>
                  <span class="usuario-tipo">${analisis.tipoCliente.label}</span>
                </div>
                <div class="usuario-actions">
                  <button class="btn-action btn-contact btn-gmail" title="Gmail" 
                    onclick="riskAnalysis.abrirGmail('${usuario.email}', '${usuario.nombre}')">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                      <path d="M2 6l10 7 10-7" stroke="currentColor" stroke-width="2" fill="none"/>
                    </svg>
                  </button>
                  <button class="btn-action btn-contact btn-whatsapp" title="WhatsApp" 
                    onclick="riskAnalysis.abrirWhatsApp('${usuario.telefono}', '${usuario.nombre}')">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="currentColor"/>
                    </svg>
                  </button>
                  <button class="btn-action btn-detail" title="Ver detalle" 
                    onclick="riskAnalysis.mostrarDetalleScore('${usuario.id}')">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
              </div>
            </td>
            <td class="text-right">
              <span class="score-badge" style="background: ${analisis.color}20; color: ${analisis.color}; border: 1px solid ${analisis.color}40;">
                ${analisis.score} pts
              </span>
            </td>
            <td>
              <div class="score-bar-container">
                <div class="score-bar" style="width: ${analisis.porcentaje}%; background: ${analisis.color};"></div>
              </div>
              <small class="score-percent">${analisis.porcentaje}%</small>
            </td>
            <td>
              <span class="categoria-badge categoria-${analisis.categoria}">
                ${analisis.categoria} - ${analisis.label}
              </span>
            </td>
            <td class="text-right">$${formatNumber(saldoPendiente)}</td>
            <td>
              ${analisis.recomendaciones.length > 0 
                ? `<span class="recomendacion-badge recomendacion-${analisis.recomendaciones[0].prioridad}">
                    ${analisis.recomendaciones[0].mensaje.substring(0, 30)}...
                   </span>`
                : '<span class="text-muted">Sin alertas</span>'
              }
            </td>
          </tr>
        `;
      })
      .join("");
  }

  /**
   * Muestra el modal de detalle del score
   */
  mostrarDetalleScore(usuarioId) {
    // Usar comparación no estricta para tolerar ids string o number
    const usuario = this.usuariosAnalizados.find(u => u.id == usuarioId);
    if (!usuario) return;
    
    const analisis = usuario.analisis;
    const cuotas = usuario.cuotas || [];
    const hoy = new Date();
    
    // Calcular estadisticas de cuotas
    const cuotasPagadas = cuotas.filter(c => c.pagado);
    const cuotasPendientes = cuotas.filter(c => !c.pagado);
    const cuotasVencidas = cuotasPendientes.filter(c => {
      const fechaCuota = new Date(c.fecha);
      return fechaCuota < hoy;
    });
    
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-detalle-score';
    modal.innerHTML = `
      <div class="modal-content modal-lg" style="max-width: 900px; max-height: 95vh;">
        <div class="modal-header">
          <h3>Analisis Completo - ${usuario.nombre}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body" style="overflow-y: auto; max-height: calc(95vh - 140px);">
          <!-- Tabs de navegacion -->
          <div class="detail-tabs">
            <button class="detail-tab active" data-tab="resumen">Resumen Score</button>
            <button class="detail-tab" data-tab="cuotas">Cuotas (${cuotas.length})</button>
            <button class="detail-tab" data-tab="retrasos">Retrasos (${cuotasVencidas.length})</button>
            <button class="detail-tab" data-tab="notas">Notas y Recomendaciones</button>
          </div>

          <!-- Tab: Resumen Score -->
          <div class="detail-tab-content active" id="tab-resumen">
            <div class="score-detail-header">
              <div class="score-circle" style="border-color: ${analisis.color};">
                <span class="score-value">${analisis.score}</span>
                <span class="score-max">/ 1000</span>
              </div>
              <div class="score-info">
                <h4>${usuario.nombre}</h4>
                <span class="categoria-badge categoria-${analisis.categoria}">
                  Categoria ${analisis.categoria} - ${analisis.label}
                </span>
                <p class="tipo-cliente">${analisis.tipoCliente.label}</p>
                <p class="tipo-descripcion">${analisis.tipoCliente.descripcion}</p>
              </div>
            </div>
            
            <!-- Variables Desglosadas -->
            <div class="score-variables">
              <h5>Por que tiene este Score?</h5>
              
              ${Object.entries(analisis.variables).map(([key, variable]) => `
                <div class="variable-card">
                  <div class="variable-header">
                    <span class="variable-name">${variable.nombre}</span>
                    <span class="variable-peso">(${variable.peso})</span>
                  </div>
                  <div class="variable-score">
                    <div class="variable-bar-bg">
                      <div class="variable-bar" style="width: ${(variable.score / variable.max) * 100}%; 
                        background: ${this.getScoreColor(variable.score, variable.max)};"></div>
                    </div>
                    <span class="variable-value">${variable.score} / ${variable.max}</span>
                  </div>
                  <p class="variable-interpretacion">${variable.detalles.interpretacion}</p>
                  ${this.renderVariableDetalles(key, variable.detalles)}
                </div>
              `).join('')}
            </div>
            
            <!-- Recomendaciones del sistema -->
            ${analisis.recomendaciones.length > 0 ? `
              <div class="score-recomendaciones">
                <h5>Recomendaciones del Sistema</h5>
                ${analisis.recomendaciones.map(r => `
                  <div class="recomendacion-item recomendacion-${r.prioridad}">
                    <span class="recomendacion-prioridad">${r.prioridad.toUpperCase()}</span>
                    <span class="recomendacion-tipo">${r.tipo}</span>
                    <p>${r.mensaje}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <div class="score-meta">
              <small>Calculado: ${new Date(analisis.fechaCalculo).toLocaleString('es-CO')}</small>
              <small>Version del modelo: ${analisis.version}</small>
            </div>
          </div>

          <!-- Tab: Cuotas -->
          <div class="detail-tab-content" id="tab-cuotas">
            <div class="cuotas-resumen-cards">
              <div class="mini-stat-card success">
                <span class="mini-stat-value">${cuotasPagadas.length}</span>
                <span class="mini-stat-label">Pagadas</span>
              </div>
              <div class="mini-stat-card warning">
                <span class="mini-stat-value">${cuotasPendientes.length - cuotasVencidas.length}</span>
                <span class="mini-stat-label">Pendientes</span>
              </div>
              <div class="mini-stat-card danger">
                <span class="mini-stat-value">${cuotasVencidas.length}</span>
                <span class="mini-stat-label">Vencidas</span>
              </div>
            </div>
            
            ${cuotas.length > 0 ? `
              <div class="cuotas-list">
                <table class="table table-compact">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Fecha Pago</th>
                      <th>Dias</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${cuotas.map((c, i) => {
                      const fechaCuota = new Date(c.fecha);
                      const estaVencida = !c.pagado && fechaCuota < hoy;
                      const diasDiferencia = c.pagado && c.fechaPago 
                        ? Math.floor((new Date(c.fechaPago) - fechaCuota) / (1000 * 60 * 60 * 24))
                        : (!c.pagado ? Math.floor((hoy - fechaCuota) / (1000 * 60 * 60 * 24)) : 0);
                      
                      return `
                        <tr class="${c.pagado ? 'row-pagada' : (estaVencida ? 'row-vencida' : 'row-pendiente')}">
                          <td>${c.numero || i + 1}</td>
                          <td>${fechaCuota.toLocaleDateString('es-ES')}</td>
                          <td>$${this.formatNumber(c.cuota || c.monto || 0)}</td>
                          <td>
                            <span class="estado-badge ${c.pagado ? 'pagado' : (estaVencida ? 'vencida' : 'pendiente')}">
                              ${c.pagado ? 'Pagada' : (estaVencida ? 'Vencida' : 'Pendiente')}
                            </span>
                          </td>
                          <td>${c.fechaPago ? new Date(c.fechaPago).toLocaleDateString('es-ES') : '-'}</td>
                          <td>
                            ${diasDiferencia !== 0 ? `
                              <span class="dias-diferencia ${diasDiferencia > 0 ? 'tardio' : 'temprano'}">
                                ${diasDiferencia > 0 ? '+' : ''}${diasDiferencia} dias
                              </span>
                            ` : '-'}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<p class="text-muted">No hay cuotas registradas para este cliente.</p>'}
          </div>

          <!-- Tab: Retrasos -->
          <div class="detail-tab-content" id="tab-retrasos">
            <h5>Historial de Retrasos</h5>
            ${cuotasVencidas.length > 0 || cuotasPagadas.filter(c => {
              const fechaCuota = new Date(c.fecha);
              const fechaPago = c.fechaPago ? new Date(c.fechaPago) : null;
              return fechaPago && fechaPago > fechaCuota;
            }).length > 0 ? `
              <div class="retrasos-list">
                ${cuotasVencidas.map(c => {
                  const fechaCuota = new Date(c.fecha);
                  const diasVencido = Math.floor((hoy - fechaCuota) / (1000 * 60 * 60 * 24));
                  return `
                    <div class="retraso-item urgente">
                      <div class="retraso-header">
                        <span class="retraso-cuota">Cuota #${c.numero || '?'}</span>
                        <span class="retraso-dias">${diasVencido} dias vencida</span>
                      </div>
                      <div class="retraso-info">
                        <span>Fecha limite: ${fechaCuota.toLocaleDateString('es-ES')}</span>
                        <span>Monto: $${this.formatNumber(c.cuota || c.monto || 0)}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
                
                ${cuotasPagadas.filter(c => {
                  const fechaCuota = new Date(c.fecha);
                  const fechaPago = c.fechaPago ? new Date(c.fechaPago) : null;
                  return fechaPago && fechaPago > fechaCuota;
                }).map(c => {
                  const fechaCuota = new Date(c.fecha);
                  const fechaPago = new Date(c.fechaPago);
                  const diasTarde = Math.floor((fechaPago - fechaCuota) / (1000 * 60 * 60 * 24));
                  return `
                    <div class="retraso-item recuperado">
                      <div class="retraso-header">
                        <span class="retraso-cuota">Cuota #${c.numero || '?'}</span>
                        <span class="retraso-dias">Pagada ${diasTarde} dias tarde</span>
                      </div>
                      <div class="retraso-info">
                        <span>Fecha limite: ${fechaCuota.toLocaleDateString('es-ES')}</span>
                        <span>Fecha pago: ${fechaPago.toLocaleDateString('es-ES')}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : '<p class="text-muted">No hay retrasos registrados. Excelente historial de pagos.</p>'}
          </div>

          <!-- Tab: Notas y Recomendaciones Personalizadas -->
          <div class="detail-tab-content" id="tab-notas">
            <!-- Motivos del Score -->
            <div class="motivos-score" style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h5 style="margin-bottom: 16px; color: #1e293b;">Por que tiene este Score de ${analisis.score} puntos?</h5>
              <div class="motivos-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${this.generarMotivosScore(usuario, analisis)}
              </div>
            </div>
            
            <!-- Como subir el Score -->
            <div class="como-subir-score" style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #a7f3d0;">
              <h5 style="margin-bottom: 16px; color: #065f46;">
                <svg viewBox="0 0 24 24" width="18" height="18" style="display: inline; vertical-align: middle; margin-right: 8px;">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#059669"/>
                </svg>
                Como puede subir su Score?
              </h5>
              <div class="acciones-subir" style="display: flex; flex-direction: column; gap: 10px;">
                ${this.generarAccionesSubirScore(usuario, analisis)}
              </div>
            </div>


          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-close-btn">Cerrar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup tabs
    modal.querySelectorAll('.detail-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tab;
        modal.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        modal.querySelector(`#tab-${tabId}`).classList.add('active');
      });
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }


  /**
   * Formatea numeros
   */
  formatNumber(num) {
    return new Intl.NumberFormat('es-CO').format(num);
  }
  
  /**
   * Renderiza detalles específicos de cada variable
   */
  renderVariableDetalles(key, detalles) {
    switch(key) {
      case 'A':
        return `
          <div class="variable-stats">
            <span>Tasa recuperación tardía: ${detalles.tasaRecuperacionTardia}%</span>
            <span>Pagos post-plazo: ${detalles.pagosPostPlazo} de ${detalles.totalPagados}</span>
          </div>
        `;
      case 'B':
        return `
          <div class="variable-stats">
            <span>Pagos post-quincena: ${detalles.porcentajeRiesgo}%</span>
            <span>En ventana de riesgo: ${detalles.pagosEnVentana} de ${detalles.totalPagos}</span>
          </div>
        `;
      case 'C':
        return `
          <div class="variable-stats">
            <span>Ratio capital/pago: ${detalles.ratioCapital}%</span>
            <span>Capital amortizado: ${detalles.porcentajeCapitalAmortizado}%</span>
            <span>Tipo: ${detalles.tipoPagador}</span>
          </div>
        `;
      case 'D':
        return `
          <div class="variable-stats">
            <span>DPD Promedio: ${detalles.dpdPromedio} días</span>
            <span>Tendencia: ${this.formatTendencia(detalles.tendencia)}</span>
          </div>
        `;
      default:
        return '';
    }
  }
  
  formatTendencia(tendencia) {
    const tendencias = {
      'mejorando_significativamente': '↑↑ Mejorando mucho',
      'mejorando': '↑ Mejorando',
      'mejorando_levemente': '↗ Mejorando levemente',
      'neutral': '→ Estable',
      'empeorando_levemente': '↘ Empeorando levemente',
      'empeorando': '↓ Empeorando',
      'empeorando_significativamente': '↓↓ Empeorando mucho'
    };
    return tendencias[tendencia] || tendencia;
  }
  
  getScoreColor(score, max) {
    const porcentaje = (score / max) * 100;
    if (porcentaje >= 80) return '#22C55E';
    if (porcentaje >= 60) return '#84CC16';
    if (porcentaje >= 40) return '#F59E0B';
    if (porcentaje >= 20) return '#EA580C';
    return '#DC2626';
  }

  /**
   * Actualiza la tabla de cuotas vencidas
   */
  actualizarTablaCuotasVencidas(filtro = "all") {
    const tbody = document.getElementById("tabla-vencidas");
    const emptyState = document.getElementById("empty-vencidas");

    if (!tbody) return;

    const hoy = new Date();
    const cuotasVencidas = [];

    const filterMap = {
      alto: ['C', 'D'],
      medio: ['B'],
      bajo: ['A']
    };

    // Filtrar usuarios por busqueda (nombre o cedula)
    let usuariosFiltradosBusqueda = this.usuariosAnalizados;
    if (this.currentSearchTerm) {
      usuariosFiltradosBusqueda = this.usuariosAnalizados.filter(u => {
        const nombre = (u.nombre || "").toLowerCase();
        const cedula = (u.cedula || "").toLowerCase();
        return nombre.includes(this.currentSearchTerm) || cedula.includes(this.currentSearchTerm);
      });
    }

    usuariosFiltradosBusqueda.forEach((usuario) => {
      (usuario.cuotas || []).forEach((cuota) => {
        if (!cuota.pagado) {
          const fechaCuota = new Date(cuota.fecha);
          const diasVencido = Math.floor((hoy - fechaCuota) / (1000 * 60 * 60 * 24));

          if (diasVencido > 0) {
            const categoria = usuario.analisis.categoria;

            if (filtro === "all" || (filterMap[filtro] && filterMap[filtro].includes(categoria))) {
              const montoPagado = cuota.montoPagado || 0;
              const montoAdeudado = Math.max(0, (cuota.cuota || 0) - montoPagado);

              cuotasVencidas.push({
                usuario,
                nombre: usuario.nombre,
                cedula: usuario.cedula,
                cuotaMonto: cuota.cuota,
                diasVencido,
                montoAdeudado,
                categoria,
                score: usuario.analisis.score
              });
            }
          }
        }
      });
    });

    // Ordenar por días vencidos (más urgentes primero)
    cuotasVencidas.sort((a, b) => b.diasVencido - a.diasVencido);

    if (cuotasVencidas.length === 0) {
      tbody.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    const formatNumber = (num) =>
      window.app && typeof window.app.formatNumber === "function"
        ? window.app.formatNumber(num)
        : new Intl.NumberFormat("es-CO").format(num);

    tbody.innerHTML = cuotasVencidas
      .map((cuota) => {
        const urgencia = cuota.diasVencido > 30 ? 'urgente' : cuota.diasVencido > 15 ? 'alerta' : 'aviso';
        
        return `
          <tr>
            <td>
              <div style="display: flex; flex-direction: column;">
                <span>${cuota.nombre}</span>
                <span style="color: #6b7280; font-size: 12px;">${cuota.cedula || "Sin Cedula"}</span>
              </div>
            </td>
            <td>$${formatNumber(cuota.cuotaMonto)}</td>
            <td>
              <span class="dias-badge dias-${urgencia}">
                ${cuota.diasVencido} días
              </span>
            </td>
            <td>$${formatNumber(cuota.montoAdeudado)}</td>
            <td>
              <span class="score-mini" style="background: ${this.getCategoriaColor(cuota.categoria)}20; 
                color: ${this.getCategoriaColor(cuota.categoria)};">
                ${cuota.score} pts
              </span>
            </td>
            <td>
              <span class="urgencia-badge urgencia-${urgencia}">
                ${urgencia === 'urgente' ? 'URGENTE' : urgencia === 'alerta' ? 'Alerta' : 'Aviso'}
              </span>
            </td>
          </tr>
        `;
      })
      .join("");
  }
  
  getCategoriaColor(categoria) {
    const colores = { A: '#22C55E', B: '#F59E0B', C: '#EA580C', D: '#DC2626' };
    return colores[categoria] || '#6B7280';
  }

  /**
   * Renderiza el heatmap de riesgo
   */
  renderHeatmap() {
    const container = document.getElementById("heatmapContainer");
    if (!container) return;

    container.innerHTML = this.usuariosAnalizados
      .map((u) => `
        <div class="heatmap-cell" 
          style="background: ${u.analisis.color}; cursor: pointer;"
          title="${u.nombre}: Score ${u.analisis.score} - ${u.analisis.label}"
          onclick="riskAnalysis.mostrarDetalleScore('${u.id}')">
          <span class="heatmap-name">${u.nombre.split(" ")[0].substring(0, 6)}</span>
          <span class="heatmap-score">${u.analisis.score}</span>
        </div>
      `)
      .join("");
  }

  /**
   * Renderiza la distribución de scores con Chart.js
   */
  renderScoreDistribution() {
    const ctx = document.getElementById("riskChart");
    if (!ctx || typeof window.Chart === "undefined") return;

    const counts = { A: 0, B: 0, C: 0, D: 0 };
    this.usuariosAnalizados.forEach((u) => {
      counts[u.analisis.categoria]++;
    });

    // Destruir instancia anterior
    if (window._riskChartInstance) {
      window._riskChartInstance.destroy();
    }

    window._riskChartInstance = new window.Chart(ctx.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: [
          `A - Bajo (${counts.A})`,
          `B - Medio (${counts.B})`,
          `C - Alto (${counts.C})`,
          `D - Crítico (${counts.D})`
        ],
        datasets: [{
          data: [counts.A, counts.B, counts.C, counts.D],
          backgroundColor: ["#22C55E", "#F59E0B", "#EA580C", "#DC2626"],
          borderColor: ["#ffffff", "#ffffff", "#ffffff", "#ffffff"],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
              padding: 12,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const porcentaje = total > 0 ? Math.round((context.raw / total) * 100) : 0;
                return `${context.label}: ${context.raw} usuarios (${porcentaje}%)`;
              }
            }
          }
        }
      }
    });

    // Renderizar histograma de scores
    this.renderScoreHistogram();
  }

  /**
   * Renderiza un histograma de distribución de scores
   */
  renderScoreHistogram() {
    const ctx = document.getElementById("scoreHistogram");
    if (!ctx || typeof window.Chart === "undefined") return;

    // Agrupar scores en rangos
    const rangos = [
      { min: 0, max: 200, label: '0-200', count: 0 },
      { min: 200, max: 400, label: '200-400', count: 0 },
      { min: 400, max: 600, label: '400-600', count: 0 },
      { min: 600, max: 800, label: '600-800', count: 0 },
      { min: 800, max: 1000, label: '800-1000', count: 0 }
    ];

    this.usuariosAnalizados.forEach(u => {
      const score = u.analisis.score;
      for (const rango of rangos) {
        if (score >= rango.min && score < rango.max) {
          rango.count++;
          break;
        }
        if (score === 1000) {
          rangos[4].count++;
          break;
        }
      }
    });

    if (window._scoreHistogramInstance) {
      window._scoreHistogramInstance.destroy();
    }

    window._scoreHistogramInstance = new window.Chart(ctx.getContext("2d"), {
      type: "bar",
      data: {
        labels: rangos.map(r => r.label),
        datasets: [{
          label: "Usuarios",
          data: rangos.map(r => r.count),
          backgroundColor: ["#DC2626", "#EA580C", "#F59E0B", "#84CC16", "#22C55E"],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        }
      }
    });
  }

  /**
   * Filtra las tablas por nivel de riesgo
   */
  filtrarTablas(filtro) {
    this.currentFilter = filtro;
    
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
    const activeBtn = document.querySelector(`[data-filter="${filtro}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    this.actualizarTablaEndeudados(filtro);
    this.actualizarTablaCuotasVencidas(filtro);
  }

  /**
   * Exporta el análisis de un usuario
   */
  exportarAnalisis(usuarioId) {
    const usuario = this.usuariosAnalizados.find(u => u.id === usuarioId);
    if (!usuario) return;

    const analisis = usuario.analisis;
    const contenido = `
ANÁLISIS DE SCORE CREDITICIO
============================
Fecha: ${new Date().toLocaleString('es-CO')}
Versión del Modelo: ${analisis.version}

DATOS DEL CLIENTE
-----------------
Nombre: ${usuario.nombre}
Email: ${usuario.email}
Teléfono: ${usuario.telefono}

RESULTADO DEL ANÁLISIS
----------------------
Score Total: ${analisis.score} / 1000 puntos
Categoría: ${analisis.categoria} - ${analisis.label}
Descripción: ${analisis.descripcion}
Tipo de Cliente: ${analisis.tipoCliente.label}

DESGLOSE DE VARIABLES
---------------------
A. Cumplimiento Post-Plazo (20%): ${analisis.variables.A.score} / ${analisis.variables.A.max}
   ${analisis.variables.A.detalles.interpretacion}
   
B. Sensibilidad Quincenal (25%): ${analisis.variables.B.score} / ${analisis.variables.B.max}
   ${analisis.variables.B.detalles.interpretacion}
   
C. Capital vs Interés (40%): ${analisis.variables.C.score} / ${analisis.variables.C.max}
   ${analisis.variables.C.detalles.interpretacion}
   Tipo: ${analisis.variables.C.detalles.tipoPagador}
   
D. Persistencia de Mora (15%): ${analisis.variables.D.score} / ${analisis.variables.D.max}
   ${analisis.variables.D.detalles.interpretacion}
   DPD Promedio: ${analisis.variables.D.detalles.dpdPromedio} días

RECOMENDACIONES
---------------
${analisis.recomendaciones.map(r => `[${r.prioridad.toUpperCase()}] ${r.mensaje}`).join('\n')}

============================
Generado por CreditoFuturo v2.0
    `;

    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analisis_${usuario.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================================================
  // FUNCIONES DE CONTACTO
  // ============================================================================

  abrirGmail(email, nombre) {
    const url = this.generarURLGmail(email, nombre);
    window.open(url, "_blank");
  }

  abrirWhatsApp(telefono, nombre) {
    const url = this.generarURLWhatsApp(telefono, nombre);
    window.open(url, "_blank");
  }

  generarURLGmail(email, nombre) {
    const usuario = this.usuariosAnalizados.find((u) => u.email === email);
    let montoCuota = 0;
    let fechaCuota = "";
    let categoria = "";

    if (usuario) {
      categoria = usuario.analisis.categoria;
      const proximaCuota = (usuario.cuotas || []).find((c) => !c.pagado);
      if (proximaCuota) {
        montoCuota = proximaCuota.cuota;
        fechaCuota = proximaCuota.fecha;
      }
    }

    const formattedMonto = window.app?.formatNumber(montoCuota) || montoCuota;
    const asunto = categoria === 'D' ? 'URGENTE: Estado de tu Deuda' : 'Estado de tu Deuda - CreditoFuturo';
    
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(asunto)}&body=Estimado%20${encodeURIComponent(nombre)},%0A%0A${montoCuota > 0 ? `Tu%20pr%C3%B3xima%20cuota%20de%20$${encodeURIComponent(formattedMonto)}%20vence%20el%20${fechaCuota}.%0A%0A` : ""}Por%20favor%20contacta%20con%20nosotros.`;
  }

  generarURLWhatsApp(telefono, nombre) {
    const usuario = this.usuariosAnalizados.find((u) => u.telefono === telefono);
    let montoCuota = 0;
    let fechaCuota = "";

    if (usuario && usuario.cuotas) {
      const proximaCuota = usuario.cuotas.find((c) => !c.pagado);
      if (proximaCuota) {
        montoCuota = proximaCuota.cuota;
        fechaCuota = proximaCuota.fecha;
      }
    }

    const formattedMonto = window.app?.formatNumber(montoCuota) || montoCuota;
    return `https://wa.me/${encodeURIComponent(telefono)}?text=Hola%20${encodeURIComponent(nombre)},%0A%0A${montoCuota > 0 ? `Tu%20cuota%20de%20$${encodeURIComponent(formattedMonto)}%20vence%20el%20${fechaCuota}.%20` : ""}Por%20favor%20contacta%20con%20nosotros.`;
  }

  /**
   * Genera los motivos detallados del porque tiene ese score
   */
  generarMotivosScore(usuario, analisis) {
    const motivos = [];
    const variables = analisis.variables;
    
    // Analizar cada variable y generar motivos
    // Variable A - Cumplimiento Post-Plazo
    const varA = variables.A;
    if (varA.score < varA.max * 0.5) {
      motivos.push({
        tipo: 'negativo',
        icon: '⚠️',
        texto: `Bajo cumplimiento post-plazo: ${varA.detalles.tasaRecuperacionTardia}% de pagos tardios fueron recuperados. Esto afecta ${varA.peso} del score.`
      });
    } else if (varA.score >= varA.max * 0.8) {
      motivos.push({
        tipo: 'positivo',
        icon: '✓',
        texto: `Buen cumplimiento post-plazo: ${varA.detalles.tasaRecuperacionTardia}% de recuperacion. Aporta positivamente al score.`
      });
    }
    
    // Variable B - Sensibilidad Quincenal
    const varB = variables.B;
    if (varB.score < varB.max * 0.5) {
      motivos.push({
        tipo: 'negativo',
        icon: '⚠️',
        texto: `Alta sensibilidad quincenal: ${varB.detalles.porcentajeRiesgo}% de pagos en ventana de riesgo post-quincena. Impacta ${varB.peso} del score.`
      });
    } else if (varB.score >= varB.max * 0.8) {
      motivos.push({
        tipo: 'positivo',
        icon: '✓',
        texto: `Buena gestion quincenal: Solo ${varB.detalles.porcentajeRiesgo}% de pagos en zona de riesgo.`
      });
    }
    
    // Variable C - Capital vs Interes
    const varC = variables.C;
    if (varC.score < varC.max * 0.5) {
      motivos.push({
        tipo: 'negativo',
        icon: '⚠️',
        texto: `Tipo de pagador: "${varC.detalles.tipoPagador}". Solo ${varC.detalles.porcentajeCapitalAmortizado}% del capital amortizado. Esta variable pesa ${varC.peso}.`
      });
    } else if (varC.score >= varC.max * 0.8) {
      motivos.push({
        tipo: 'positivo',
        icon: '✓',
        texto: `Excelente amortizacion de capital: ${varC.detalles.porcentajeCapitalAmortizado}% amortizado. Tipo: "${varC.detalles.tipoPagador}".`
      });
    }
    
    // Variable D - Persistencia de Mora
    const varD = variables.D;
    if (varD.score < varD.max * 0.5) {
      motivos.push({
        tipo: 'negativo',
        icon: '🔴',
        texto: `Alta persistencia de mora: DPD promedio de ${varD.detalles.dpdPromedio} dias. Tendencia: ${this.formatTendencia(varD.detalles.tendencia)}.`
      });
    } else if (varD.score >= varD.max * 0.8) {
      motivos.push({
        tipo: 'positivo',
        icon: '✓',
        texto: `Baja mora: DPD promedio de ${varD.detalles.dpdPromedio} dias. Tendencia: ${this.formatTendencia(varD.detalles.tendencia)}.`
      });
    }
    
    // Cuotas vencidas actuales
    const cuotasVencidas = (usuario.cuotas || []).filter(c => {
      if (c.pagado) return false;
      const fechaCuota = new Date(c.fecha);
      return fechaCuota < new Date();
    });
    
    if (cuotasVencidas.length > 0) {
      const montoVencido = cuotasVencidas.reduce((sum, c) => sum + (c.cuota || 0), 0);
      motivos.push({
        tipo: 'negativo',
        icon: '🔴',
        texto: `Tiene ${cuotasVencidas.length} cuota(s) vencida(s) por un total de $${this.formatNumber(montoVencido)}. Esto impacta directamente el score.`
      });
    }
    
    // Generar HTML
    return motivos.map(m => `
      <div class="motivo-item" style="display: flex; gap: 12px; padding: 12px; background: ${m.tipo === 'positivo' ? '#ecfdf5' : '#fef2f2'}; border-radius: 8px; border-left: 4px solid ${m.tipo === 'positivo' ? '#22c55e' : '#ef4444'};">
        <span style="font-size: 18px;">${m.icon}</span>
        <span style="color: ${m.tipo === 'positivo' ? '#065f46' : '#991b1b'}; font-size: 14px;">${m.texto}</span>
      </div>
    `).join('') || '<p style="color: #6b7280;">No hay motivos especificos identificados.</p>';
  }

  /**
   * Genera acciones concretas para subir el score
   */
  generarAccionesSubirScore(usuario, analisis) {
    const acciones = [];
    const variables = analisis.variables;
    
    // Cuotas vencidas - Prioridad maxima
    const cuotasVencidas = (usuario.cuotas || []).filter(c => {
      if (c.pagado) return false;
      const fechaCuota = new Date(c.fecha);
      return fechaCuota < new Date();
    });
    
    if (cuotasVencidas.length > 0) {
      acciones.push({
        prioridad: 'alta',
        puntos: '+50 a +150 pts',
        texto: `Pagar las ${cuotasVencidas.length} cuota(s) vencida(s). Esto mejoraria inmediatamente el score.`
      });
    }
    
    // Segun variable mas baja
    const varScores = [
      { key: 'A', score: variables.A.score / variables.A.max, nombre: 'Cumplimiento' },
      { key: 'B', score: variables.B.score / variables.B.max, nombre: 'Gestion Quincenal' },
      { key: 'C', score: variables.C.score / variables.C.max, nombre: 'Amortizacion Capital' },
      { key: 'D', score: variables.D.score / variables.D.max, nombre: 'Reduccion Mora' }
    ].sort((a, b) => a.score - b.score);
    
    const peorVar = varScores[0];
    
    if (peorVar.key === 'A' && peorVar.score < 0.7) {
      acciones.push({
        prioridad: 'media',
        puntos: '+30 a +60 pts',
        texto: 'Realizar los pagos antes de la fecha limite para mejorar el cumplimiento post-plazo.'
      });
    }
    
    if (peorVar.key === 'B' && peorVar.score < 0.7) {
      acciones.push({
        prioridad: 'media',
        puntos: '+40 a +80 pts',
        texto: 'Evitar pagar en los dias 16-20 del mes (ventana de riesgo quincenal). Pagar antes del dia 15 es ideal.'
      });
    }
    
    if (peorVar.key === 'C' && peorVar.score < 0.7) {
      acciones.push({
        prioridad: 'media',
        puntos: '+50 a +100 pts',
        texto: 'Realizar abonos adicionales al capital para mejorar la amortizacion. Esto es lo que mas impacta el score (40%).'
      });
    }
    
    if (peorVar.key === 'D' && peorVar.score < 0.7) {
      acciones.push({
        prioridad: 'alta',
        puntos: '+20 a +50 pts',
        texto: 'Reducir los dias de mora promedio pagando a tiempo de forma consistente durante los proximos meses.'
      });
    }
    
    // Accion general
    if (analisis.score < 600) {
      acciones.push({
        prioridad: 'baja',
        puntos: '+10 a +30 pts',
        texto: 'Mantener un historial de pagos puntuales durante 3 meses consecutivos mejorara la tendencia general.'
      });
    }
    
    // Generar HTML
    return acciones.map(a => `
      <div class="accion-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #d1fae5;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="background: ${a.prioridad === 'alta' ? '#fef2f2' : a.prioridad === 'media' ? '#fffbeb' : '#f0fdf4'}; color: ${a.prioridad === 'alta' ? '#dc2626' : a.prioridad === 'media' ? '#d97706' : '#16a34a'}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">${a.prioridad}</span>
          <span style="color: #374151; font-size: 14px;">${a.texto}</span>
        </div>
        <span style="background: #ecfdf5; color: #059669; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; white-space: nowrap;">${a.puntos}</span>
      </div>
    `).join('') || '<p style="color: #6b7280;">Este cliente ya tiene un score excelente. Mantener el buen comportamiento de pago.</p>';
  }
}

// Instanciar el gestor
const riskAnalysis = new RiskAnalysisManager();
window.riskAnalysis = riskAnalysis;
