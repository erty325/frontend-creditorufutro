// ========== HISTORIAL MANAGER ==========

class HistorialManager {
    constructor() {
        this.movimientos = [];
        this.movimientosFiltrados = [];
        this.paginaActual = 1;
        this.itemsPorPagina = 20;
        this.filtros = {
            tipo: 'todos',
            fechaDesde: null,
            fechaHasta: null,
            busqueda: ''
        };
        this.init();
    }

    init() {
        this.cargarHistorial();
        this.setupEventListeners();
        this.actualizarFecha();
        this.aplicarFiltros();
        this.actualizarEstadisticas();
        setInterval(() => this.actualizarFecha(), 60000);
        
        // Escuchar cambios en datos
        window.addEventListener('datosActualizados', () => {
            this.cargarHistorial();
            this.aplicarFiltros();
            this.actualizarEstadisticas();
        });
    }

    async cargarHistorial() {
        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(window.API_BASE_URL + '/history/all?limit=100', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.movimientos = data;
                // Filtrar client activities si las hubiera, aunque el backend ya trae todo
                // Por ahora asumimos que el backend trae todo lo principal.
                // Si queremos mantener clientes locales, los mezclamos:
                const actividadClientes = this.obtenerActividadClientes();
                
                // Mezclar si es necesario, o solo usar backend
                // Para simplificar y cumplir "todo todo del backend", usaremos la data del backend principalmente
                // Pero como cliente_nuevo aun no esta en backend history, lo mezclamos:
                
                this.movimientos = [...this.movimientos, ...actividadClientes]
                    .sort((a, b) => new Date(b.date || b.fecha || b.fechaCompleta) - new Date(a.date || a.fecha || a.fechaCompleta));

                this.aplicarFiltros();
                this.actualizarEstadisticas();
            } else {
                console.error('Error cargando historial:', await response.text());
                this.mostrarNotificacion('Error cargando historial', 'error');
            }
        } catch (error) {
            console.error('Error de red:', error);
            this.mostrarNotificacion('Error de conexión', 'error');
        }
    }

    obtenerActividadClientes() {
        // Mantener esto para items locales que el backend aun no soporte (como cliente_nuevo si no se migró)
        const actividad = [];
        try {
            const historialClientes = JSON.parse(localStorage.getItem('historial_clientes') || '[]');
            actividad.push(...historialClientes);
        } catch (error) {
            console.error('Error obteniendo actividad de clientes:', error);
        }
        return actividad;
    }

    setupEventListeners() {
        // Filtro de tipo
        const filtroTipo = document.getElementById('filtro-tipo');
        if (filtroTipo) {
            filtroTipo.addEventListener('change', () => this.aplicarFiltros());
        }

        // Filtro de fecha desde
        const filtroFechaDesde = document.getElementById('filtro-fecha-desde');
        if (filtroFechaDesde) {
            filtroFechaDesde.addEventListener('change', () => this.aplicarFiltros());
        }

        // Filtro de fecha hasta
        const filtroFechaHasta = document.getElementById('filtro-fecha-hasta');
        if (filtroFechaHasta) {
            filtroFechaHasta.addEventListener('change', () => this.aplicarFiltros());
        }

        // Busqueda
        const filtroBusqueda = document.getElementById('filtro-busqueda');
        if (filtroBusqueda) {
            filtroBusqueda.addEventListener('input', () => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => this.aplicarFiltros(), 300);
            });
        }
    }

    aplicarFiltros() {
        // Obtener valores de filtros
        this.filtros.tipo = document.getElementById('filtro-tipo')?.value || 'todos';
        this.filtros.fechaDesde = document.getElementById('filtro-fecha-desde')?.value || null;
        this.filtros.fechaHasta = document.getElementById('filtro-fecha-hasta')?.value || null;
        this.filtros.busqueda = document.getElementById('filtro-busqueda')?.value?.toLowerCase() || '';

        // Aplicar filtros
        this.movimientosFiltrados = this.movimientos.filter(mov => {
            const movType = mov.type || mov.tipo; // Handle both just in case
            const movDate = new Date(mov.date || mov.fecha || mov.fechaCompleta || mov.movement_date);
            const movDesc = (mov.description || mov.descripcion || '').toLowerCase();
            const movClient = (mov.client_name || mov.nombre || '').toLowerCase();
            const movCedula = (mov.client_cedula || mov.cedula || '').toLowerCase();

            // Filtro por tipo
            if (this.filtros.tipo !== 'todos' && movType !== this.filtros.tipo) {
                return false;
            }

            // Filtro por fecha desde
            if (this.filtros.fechaDesde) {
                const fechaDesde = new Date(this.filtros.fechaDesde);
                fechaDesde.setHours(0, 0, 0, 0);
                if (movDate < fechaDesde) return false;
            }

            // Filtro por fecha hasta
            if (this.filtros.fechaHasta) {
                const fechaHasta = new Date(this.filtros.fechaHasta);
                fechaHasta.setHours(23, 59, 59, 999);
                if (movDate > fechaHasta) return false;
            }

            // Filtro por busqueda (Descripcion, Nombre Cliente o Cedula)
            if (this.filtros.busqueda) {
                const coincideDescripcion = movDesc.includes(this.filtros.busqueda);
                const coincideNombre = movClient.includes(this.filtros.busqueda);
                const coincideCedula = movCedula.includes(this.filtros.busqueda);
                
                if (!coincideDescripcion && !coincideNombre && !coincideCedula) {
                    return false;
                }
            }

            return true;
        });

        // Reset a primera pagina
        this.paginaActual = 1;

        // Renderizar
        this.renderTimeline();
        this.actualizarPaginacion();
    }

limpiarFiltros() {
        document.getElementById('filtro-tipo').value = 'todos';
        document.getElementById('filtro-fecha-desde').value = '';
        document.getElementById('filtro-fecha-hasta').value = '';
        document.getElementById('filtro-busqueda').value = '';
        
        this.filtros = {
            tipo: 'todos',
            fechaDesde: null,
            fechaHasta: null,
            busqueda: ''
        };
        
        // Reset botones de filtro rapido
        document.querySelectorAll('.historial-tipo-filtros .filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tipoFilter === 'todos') btn.classList.add('active');
        });
        
        this.aplicarFiltros();
    }

    /**
     * Filtro rapido por tipo (Pagos/Cuotas o Cuadre de Caja)
     */
    filtrarPorTipoRapido(tipo) {
        // Actualizar botones activos
        document.querySelectorAll('.historial-tipo-filtros .filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tipoFilter === tipo) btn.classList.add('active');
        });

        // Filtrar segun el tipo
        if (tipo === 'pagos') {
            // Mostrar solo pagos
            this.movimientosFiltrados = this.movimientos.filter(mov => mov.type === 'pago');
        } else if (tipo === 'caja') {
            // Mostrar solo cuadre de caja (ingresos, egresos, cierres)
            this.movimientosFiltrados = this.movimientos.filter(mov => 
                mov.type === 'ingreso' || mov.type === 'egreso' || mov.type === 'cierre_caja'
            );
        } else {
            // Mostrar todos
            this.movimientosFiltrados = [...this.movimientos];
        }

        // Reset a primera pagina
        this.paginaActual = 1;
        this.renderTimeline();
        this.actualizarPaginacion();
    }

    renderTimeline() {
        const timeline = document.getElementById('historial-timeline');
        const emptyState = document.getElementById('empty-historial');
        const timelineCount = document.getElementById('timeline-count');

        if (!timeline) return;

        // Obtener items de la pagina actual
        const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
        const fin = inicio + this.itemsPorPagina;
        const itemsPagina = this.movimientosFiltrados.slice(inicio, fin);

        // Actualizar contador
        if (timelineCount) {
            timelineCount.textContent = `${this.movimientosFiltrados.length} movimientos`;
        }

        if (itemsPagina.length === 0) {
            timeline.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        timeline.innerHTML = itemsPagina.map(mov => this.renderTimelineItem(mov)).join('');
    }

    renderTimelineItem(mov) {
        // Normalizar fecha
        const fechaRaw = mov.date || mov.fecha || mov.fechaCompleta || mov.movement_date;
        const fechaObj = new Date(fechaRaw);
        
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
        const horaFormateada = fechaObj.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const tipoConfig = this.getTipoConfig(mov.type);
        const montoClass = this.getMontoClass(mov.type, mov.amount !== undefined ? mov.amount : mov.monto);
        const montoMostrar = mov.amount !== undefined ? mov.amount : mov.monto;

// Determine specific badge for payments
        let badgeText = tipoConfig.badge;
        let badgeClass = mov.type;

        if (mov.type === 'pago' && mov.payment_subtype) {
            if (mov.payment_subtype === 'capital') {
                badgeText = 'Abono Capital';
                badgeClass = 'pago-capital';
            } else if (mov.payment_subtype === 'interes') {
                badgeText = 'Pago Interés';
                badgeClass = 'pago-interes';
            } else if (mov.payment_subtype === 'completo') {
                badgeText = 'Pago Cuota';
                badgeClass = 'pago-completo';
            }
        }

        return `
            <div class="timeline-item" onclick="historial.verDetalle('${mov.id}')">
                <div class="timeline-icon ${mov.type}">
                    ${tipoConfig.icon}
                </div>
                <div class="timeline-content">
<div class="timeline-title">
                        ${mov.type === 'pago' && mov.client_name ? `Pago de crédito - ${mov.client_name}` : (mov.description || tipoConfig.titulo)}
                        <span class="timeline-badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <p class="timeline-description">${this.getDescripcionDetallada(mov)}</p>
                    <div class="timeline-meta">
                        <span class="timeline-meta-item">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                                <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                                <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            ${fechaFormateada}
                        </span>
                        <span class="timeline-meta-item">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" fill="none"/>
                            </svg>
                            ${horaFormateada}
                        </span>
                        ${mov.payment_method ? `
                            <span class="timeline-meta-item">
                                <svg viewBox="0 0 24 24" width="14" height="14">
                                    <rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                                </svg>
                                ${this.getMetodoLabel(mov.payment_method)}
                            </span>
                        ` : ''}
${mov.client_name ? `
                            <span class="timeline-meta-item">
                                <svg viewBox="0 0 24 24" width="14" height="14">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="2"/>
                                    <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
                                </svg>
                                Cliente: ${mov.client_cedula || 'Sin cedula'}
                            </span>
                        ` : ''}
                    </div>
                </div>
                ${montoMostrar !== undefined ? `
                    <div class="timeline-amount ${montoClass}">
                        ${this.formatMonto(mov.type, montoMostrar)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    getTipoConfig(tipo) {
        const configs = {
            'pago': {
                icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
                titulo: 'Pago Registrado',
                badge: 'Pago'
            },
            'ingreso': {
                icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 2v20M17 7l-5-5-5 5" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
                titulo: 'Ingreso de Caja',
                badge: 'Ingreso'
            },
            'egreso': {
                icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 22V2M7 17l5 5 5-5" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
                titulo: 'Egreso de Caja',
                badge: 'Egreso'
            },
            'cliente_nuevo': {
                icon: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M6 20c0-3 6-5 6-5s6 2 6 5" fill="currentColor"/><path d="M19 8v6M22 11h-6" stroke="currentColor" stroke-width="2"/></svg>',
                titulo: 'Cliente Nuevo',
                badge: 'Nuevo'
            },
            'cliente_editado': {
                icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
                titulo: 'Cliente Editado',
                badge: 'Editado'
            },
            'cliente_eliminado': {
                icon: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M6 20c0-3 6-5 6-5s6 2 6 5" fill="currentColor"/><path d="M17 8l6 6M23 8l-6 6" stroke="currentColor" stroke-width="2"/></svg>',
                titulo: 'Cliente Eliminado',
                badge: 'Eliminado'
            },
            'cierre_caja': {
                icon: '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 10h20" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
                titulo: 'Cierre de Caja',
                badge: 'Cierre'
            }
        };

        return configs[tipo] || {
            icon: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
            titulo: 'Movimiento',
            badge: 'Otro'
        };
    }

getDescripcionDetallada(mov) {
        switch (mov.type) {
            case 'pago':
                // Show client name as main identifier, and cedula below
                const clienteName = mov.client_name || 'N/A';
                const clienteCedula = mov.client_cedula || 'Sin cedula';
                return `${clienteName} - Cliente: ${clienteCedula}`;
            case 'cierre_caja':
                if (mov.details) {
                    return `Ingresos: $${this.formatNumber(mov.details.totalIngresos)} | Egresos: $${this.formatNumber(mov.details.totalEgresos)}`;
                }
                return mov.descripcion;
            default:
                return mov.descripcion || 'Sin descripcion';
        }
    }

    getMontoClass(tipo, monto) {
        if (['ingreso', 'pago'].includes(tipo)) return 'positivo';
        if (['egreso'].includes(tipo)) return 'negativo';
        if (tipo === 'cierre_caja' && monto >= 0) return 'positivo';
        if (tipo === 'cierre_caja' && monto < 0) return 'negativo';
        return 'neutro';
    }

    formatMonto(tipo, monto) {
        const valor = this.formatNumber(Math.abs(monto));
        if (['ingreso', 'pago'].includes(tipo)) return `+$${valor}`;
        if (tipo === 'egreso') return `-$${valor}`;
        if (tipo === 'cierre_caja') return monto >= 0 ? `+$${valor}` : `-$${valor}`;
        return `$${valor}`;
    }

    getMetodoLabel(metodo) {
        const metodos = {
            'efectivo': 'Efectivo',
            'tarjeta': 'Tarjeta',
            'transferencia': 'Transferencia'
        };
        return metodos[metodo] || metodo;
    }

    actualizarPaginacion() {
        const totalPaginas = Math.ceil(this.movimientosFiltrados.length / this.itemsPorPagina);
        const paginacionInfo = document.getElementById('paginacion-info');
        const btnAnterior = document.getElementById('btn-anterior');
        const btnSiguiente = document.getElementById('btn-siguiente');

        if (paginacionInfo) {
            paginacionInfo.textContent = `Pagina ${this.paginaActual} de ${Math.max(1, totalPaginas)}`;
        }

        if (btnAnterior) {
            btnAnterior.disabled = this.paginaActual <= 1;
        }

        if (btnSiguiente) {
            btnSiguiente.disabled = this.paginaActual >= totalPaginas;
        }
    }

    paginaAnterior() {
        if (this.paginaActual > 1) {
            this.paginaActual--;
            this.renderTimeline();
            this.actualizarPaginacion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    paginaSiguiente() {
        const totalPaginas = Math.ceil(this.movimientosFiltrados.length / this.itemsPorPagina);
        if (this.paginaActual < totalPaginas) {
            this.paginaActual++;
            this.renderTimeline();
            this.actualizarPaginacion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    actualizarEstadisticas() {
        const stats = {
            totalMovimientos: this.movimientos.length,
            pagosRealizados: this.movimientos.filter(m => m.type === 'pago').length,
            clientesNuevos: this.movimientos.filter(m => m.type === 'cliente_nuevo').length,
            cierresCaja: this.movimientos.filter(m => m.type === 'cierre_caja').length
        };

        const elTotal = document.getElementById('stat-total-movimientos');
        const elPagos = document.getElementById('stat-pagos-realizados');
        const elClientes = document.getElementById('stat-clientes-nuevos');
        const elCierres = document.getElementById('stat-cierres-caja');

        if(elTotal) elTotal.textContent = stats.totalMovimientos;
        if(elPagos) elPagos.textContent = stats.pagosRealizados;
        if(elClientes) elClientes.textContent = stats.clientesNuevos;
        if(elCierres) elCierres.textContent = stats.cierresCaja;
    }

    verDetalle(id) {
        // ID puede ser string o number en backend (UUID vs int)
        const mov = this.movimientos.find(m => String(m.id) === String(id));
        if (!mov) return;

        const modal = document.getElementById('modal-detalle');
        const contenido = document.getElementById('detalle-contenido');

        if (!modal || !contenido) return;

        const tipoConfig = this.getTipoConfig(mov.type);
        const fecha = new Date(mov.date || mov.fecha || mov.movement_date);
        const montoMostrar = mov.amount !== undefined ? mov.amount : mov.monto;
        const montoClass = this.getMontoClass(mov.type, montoMostrar);

        contenido.innerHTML = `
            <div class="detalle-header">
                <div class="detalle-icon timeline-icon ${mov.type}">
                    ${tipoConfig.icon}
                </div>
                <div class="detalle-titulo">
                    <h4>${tipoConfig.titulo}</h4>
                    <span>${fecha.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
            </div>
            <div class="detalle-info">
                <div class="detalle-row">
                    <span>Descripcion</span>
                    <span>${this.getDescripcionDetallada(mov)}</span>
                </div>
                <div class="detalle-row">
                    <span>Hora</span>
                    <span>${fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                ${mov.payment_method ? `
                    <div class="detalle-row">
                        <span>Metodo de Pago</span>
                        <span>${this.getMetodoLabel(mov.payment_method)}</span>
                    </div>
                ` : ''}
                ${mov.category ? `
                    <div class="detalle-row">
                        <span>Categoria</span>
                        <span>${mov.category}</span>
                    </div>
                ` : ''}
                ${mov.client_name ? `
                    <div class="detalle-row">
                        <span>Cliente</span>
                        <span>${mov.client_name} ${mov.client_cedula ? `(${mov.client_cedula})` : ''}</span>
                    </div>
                ` : ''}
                ${mov.credit_id ? `
                    <div class="detalle-row">
                        <span>Credito ID</span>
                        <span>${mov.credit_id}</span>
                    </div>
                ` : ''}
                ${mov.details ? `
                    <div class="detalle-row">
                        <span>Detalles Cierre</span>
                        <div style="text-align: right; font-size: 0.9em;">
                           <div>Base: $${this.formatNumber(mov.details.base_amount)}</div>
                           <div>Ingresos: $${this.formatNumber(mov.details.totalIngresos)}</div>
                           <div>Egresos: $${this.formatNumber(mov.details.totalEgresos)}</div>
                           <div><b>Final: $${this.formatNumber(mov.details.final_balance)}</b></div>
                        </div>
                    </div>
                ` : ''}
            </div>
            ${montoMostrar !== undefined ? `
                <div class="detalle-monto">
                    <p class="detalle-monto-label">Monto</p>
                    <p class="detalle-monto-valor ${montoClass}">${this.formatMonto(mov.type, montoMostrar)}</p>
                </div>
            ` : ''}
        `;

        modal.classList.remove('hidden');
    }

    cerrarModalDetalle() {
        const modal = document.getElementById('modal-detalle');
        if (modal) modal.classList.add('hidden');
    }

    // exportarHistorial eliminado: La exportación del historial ahora se maneja desde la sección de "Exportar" (Exportaciones).


    formatNumber(number) {
        const n = Number(number) || 0;
        return new Intl.NumberFormat('es-CO').format(Math.round(n * 100) / 100);
    }

    actualizarFecha() {
        const hoy = new Date();
        const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
        const fecha = hoy.toLocaleDateString('es-ES', opciones);
        const hora = hoy.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const dateEl = document.getElementById('current-date');
        const hourEl = document.getElementById('current-hour');

        if (dateEl) dateEl.textContent = fecha;
        if (hourEl) hourEl.textContent = hora;
    }

    mostrarNotificacion(mensaje, tipo = 'success') {
        const notif = document.getElementById('notificacion');
        if (!notif) return;

        notif.textContent = mensaje;
        notif.className = `notificacion ${tipo}`;
        notif.classList.remove('hidden');

        setTimeout(() => {
            notif.classList.add('hidden');
        }, 3000);
    }
}

// Funcion global para registrar actividad de clientes
window.registrarActividadCliente = function(tipo, datos) {
    try {
        const historialClientes = JSON.parse(localStorage.getItem('historial_clientes') || '[]');
        historialClientes.unshift({
            id: Date.now(),
            tipo: tipo,
            ...datos,
            fecha: new Date().toISOString(),
            hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        });
        
        // Mantener solo los ultimos 500 registros
        if (historialClientes.length > 500) {
            historialClientes.splice(500);
        }
        
        localStorage.setItem('historial_clientes', JSON.stringify(historialClientes));
    } catch (error) {
        console.error('Error registrando actividad de cliente:', error);
    }
};

// Inicializar
const historial = new HistorialManager();
window.historial = historial;
