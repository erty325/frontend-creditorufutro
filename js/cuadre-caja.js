// ========== CUADRE DE CAJA MANAGER ==========

class CuadreCajaManager {
    constructor() {
        this.API_BASE_URL = window.API_BASE_URL;
        this.baseCaja = 0;
        this.movimientos = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.actualizarFecha();
        this.setFechaHoyEnFormularios();
        this.cargarDatos(); // Ahora carga desde API
        setInterval(() => this.actualizarFecha(), 60000);
    }

    setFechaHoyEnFormularios() {
        const hoy = this.obtenerFechaHoy();
        const ingresoFecha = document.getElementById('ingreso-fecha');
        const egresoFecha = document.getElementById('egreso-fecha');
        if (ingresoFecha) ingresoFecha.value = hoy;
        if (egresoFecha) egresoFecha.value = hoy;
    }

    obtenerFechaHoy() {
        const hoy = new Date();
        return hoy.toISOString().split('T')[0];
    }

    async cargarDatos() {
        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${this.API_BASE_URL}/cash-register/current`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.baseCaja = data.base_amount || 0;
                this.movimientos = data.movements || [];
                this.renderMovimientos();
                this.actualizarResumen();
            } else {
                console.error("Error cargando caja:", await response.text());
                // Si es 401, redirigir a login podría ser buena idea, pero lo maneja auth-check.js
            }
        } catch (error) {
            console.error("Error de red cargando datos:", error);
        }
    }

    setupEventListeners() {
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.cambiarTab(e.target.dataset.tab));
        });

        // Formulario de ingreso
        const formIngreso = document.getElementById('form-ingreso');
        if (formIngreso) {
            formIngreso.addEventListener('submit', (e) => this.registrarIngreso(e));
        }

        // Formulario de egreso
        const formEgreso = document.getElementById('form-egreso');
        if (formEgreso) {
            formEgreso.addEventListener('submit', (e) => this.registrarEgreso(e));
        }

        // Formulario de base de caja
        const formBase = document.getElementById('form-base-caja');
        if (formBase) {
            formBase.addEventListener('submit', (e) => this.guardarBaseCaja(e));
        }

        // Filtros de movimientos
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => this.filtrarMovimientos(e.target.dataset.filter));
        });

        // Formulario de edicion de movimiento
        const formEditar = document.getElementById('form-editar-movimiento');
        if (formEditar) {
            formEditar.addEventListener('submit', (e) => this.guardarEdicionMovimiento(e));
        }
    }

    cambiarTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tab}`);
        });
    }

    async registrarIngreso(e) {
        e.preventDefault();

        const monto = parseFloat(document.getElementById('ingreso-monto').value);
        const metodo = document.getElementById('ingreso-metodo').value;
        const descripcion = document.getElementById('ingreso-descripcion').value.trim();
        const fechaSeleccionada = document.getElementById('ingreso-fecha').value;

        if (!this.validarInput(monto, descripcion, fechaSeleccionada)) return;

        const movimiento = {
            type: 'ingreso',
            amount: monto,
            description: descripcion,
            payment_method: metodo,
            movement_date: new Date(fechaSeleccionada + 'T12:00:00').toISOString()
        };

        if (await this.enviarMovimientoAPI(movimiento)) {
            document.getElementById('form-ingreso').reset();
            this.setFechaHoyEnFormularios();
            this.mostrarNotificacion('Ingreso registrado correctamente', 'success');
        }
    }

    async registrarEgreso(e) {
        e.preventDefault();

        const monto = parseFloat(document.getElementById('egreso-monto').value);
        const categoria = document.getElementById('egreso-categoria').value;
        const descripcion = document.getElementById('egreso-descripcion').value.trim();
        const fechaSeleccionada = document.getElementById('egreso-fecha').value;

        if (!this.validarInput(monto, descripcion, fechaSeleccionada)) return;

        const movimiento = {
            type: 'egreso',
            amount: monto,
            description: descripcion,
            category: categoria,
            movement_date: new Date(fechaSeleccionada + 'T12:00:00').toISOString()
        };

        if (await this.enviarMovimientoAPI(movimiento)) {
            document.getElementById('form-egreso').reset();
            this.setFechaHoyEnFormularios();
            this.mostrarNotificacion('Egreso registrado correctamente', 'success');
        }
    }

    validarInput(monto, descripcion, fecha) {
        if (!monto || monto <= 0) {
            this.mostrarNotificacion('El monto debe ser mayor a 0', 'error');
            return false;
        }
        if (!descripcion) {
            this.mostrarNotificacion('La descripción es requerida', 'error');
            return false;
        }
        if (!fecha) {
            this.mostrarNotificacion('La fecha es requerida', 'error');
            return false;
        }
        return true;
    }

    async enviarMovimientoAPI(movimiento) {
        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${this.API_BASE_URL}/cash-register/movement`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(movimiento)
            });

            if (response.ok) {
                await this.cargarDatos(); // Recargar datos para actualizar lista y resumen
                return true;
            } else {
                const err = await response.json();
                this.mostrarNotificacion(err.detail || 'Error registrando movimiento', 'error');
                return false;
            }
        } catch (error) {
            console.error("Error enviando movimiento:", error);
            this.mostrarNotificacion('Error de conexión', 'error');
            return false;
        }
    }

    renderMovimientos(filtro = 'todos') {
        const tbody = document.getElementById('tabla-movimientos');
        const emptyState = document.getElementById('empty-movimientos');

        if (!tbody) return;

        let movimientosFiltrados = [...this.movimientos];

        if (filtro !== 'todos') {
            movimientosFiltrados = movimientosFiltrados.filter(m => 
                filtro === 'ingresos' ? m.type === 'ingreso' : m.type === 'egreso'
            );
        }

        // Ordenar por fecha mas reciente
        movimientosFiltrados.sort((a, b) => new Date(b.movement_date || b.created_at) - new Date(a.movement_date || a.created_at));

        if (movimientosFiltrados.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        tbody.innerHTML = movimientosFiltrados.map(mov => {
            const fechaObj = new Date(mov.movement_date || mov.created_at);
            const fechaDisplay = fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            const horaDisplay = fechaObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            const metodoOCategoria = mov.type === 'ingreso' 
                ? this.getMetodoLabel(mov.payment_method) 
                : this.getCategoriaLabel(mov.category);
            
            return `
            <tr>
                <td><span class="fecha-movimiento">${fechaDisplay}</span></td>
                <td>${horaDisplay}</td>
                <td>
                    <span class="tipo-badge ${mov.type}">
                        ${mov.type === 'ingreso' ? 
                            '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 2v20M17 7l-5-5-5 5" stroke="currentColor" stroke-width="2" fill="none"/></svg>' :
                            '<svg viewBox="0 0 24 24" width="12" height="12"><path d="M12 22V2M7 17l5 5 5-5" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
                        }
                        ${mov.type === 'ingreso' ? 'Ingreso' : 'Egreso'}
                    </span>
                </td>
                <td>${mov.description}</td>
                <td>${metodoOCategoria || '-'}</td>
                <td class="${mov.type === 'ingreso' ? 'monto-positivo' : 'monto-negativo'}">
                    ${mov.type === 'ingreso' ? '+' : '-'}$${this.formatNumber(mov.amount)}
                </td>
                <td>
                    <div class="btn-actions-group">
                        <button class="btn-action btn-edit" onclick="cuadreCaja.editarMovimiento(${mov.id})" title="Editar">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" fill="none"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" fill="none"/>
                            </svg>
                        </button>
                        <button class="btn-action btn-delete" onclick="cuadreCaja.eliminarMovimiento(${mov.id})" title="Eliminar">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="2" fill="none"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');
    }

    getMetodoLabel(metodo) {
        const metodos = { 'efectivo': 'Efectivo', 'tarjeta': 'Tarjeta', 'transferencia': 'Transferencia' };
        return metodos[metodo] || metodo;
    }

    getCategoriaLabel(categoria) {
        const categorias = { 'proveedor': 'Proveedor', 'servicios': 'Servicios', 'nomina': 'Nomina', 'otros': 'Otros' };
        return categorias[categoria] || categoria;
    }

    filtrarMovimientos(filtro) {
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.filter === filtro);
        });
        this.renderMovimientos(filtro);
    }

    actualizarResumen() {
        // Calcular totales usando los datos cargados del backend
        const ingresos = this.movimientos.filter(m => m.type === 'ingreso');
        const egresos = this.movimientos.filter(m => m.type === 'egreso');

        const totalIngresos = ingresos.reduce((sum, m) => sum + m.amount, 0);
        const totalEgresos = egresos.reduce((sum, m) => sum + m.amount, 0);

        // Desglose
        const efectivo = ingresos.filter(m => m.payment_method === 'efectivo').reduce((sum, m) => sum + m.amount, 0);
        const tarjetas = ingresos.filter(m => m.payment_method === 'tarjeta').reduce((sum, m) => sum + m.amount, 0);
        const transferencias = ingresos.filter(m => m.payment_method === 'transferencia').reduce((sum, m) => sum + m.amount, 0);

        const balanceFinal = this.baseCaja + totalIngresos - totalEgresos;

        document.getElementById('base-caja-valor').textContent = `$${this.formatNumber(this.baseCaja)}`;
        document.getElementById('ventas-total').textContent = `$${this.formatNumber(totalIngresos)}`;
        document.getElementById('ventas-efectivo').textContent = `$${this.formatNumber(efectivo)}`;
        document.getElementById('ventas-tarjetas').textContent = `$${this.formatNumber(tarjetas)}`;
        document.getElementById('ventas-transferencias').textContent = `$${this.formatNumber(transferencias)}`;
        document.getElementById('egresos-total').textContent = `$${this.formatNumber(totalEgresos)}`;
        document.getElementById('balance-final').textContent = `$${this.formatNumber(balanceFinal)}`;
    }

    async eliminarMovimiento(id) {
        if (!confirm('¿Estás seguro de eliminar este movimiento?')) return;

        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${this.API_BASE_URL}/cash-register/movement/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                await this.cargarDatos();
                this.mostrarNotificacion('Movimiento eliminado', 'success');
            } else {
                this.mostrarNotificacion('Error al eliminar movimiento', 'error');
            }
        } catch (error) {
            console.error("Error eliminando:", error);
        }
    }

    editarMovimiento(id) {
        const movimiento = this.movimientos.find(m => m.id === id);
        if (!movimiento) return;

        const modal = document.getElementById('modal-editar-movimiento');
        const inputFecha = document.getElementById('editar-mov-fecha');
        const inputDescripcion = document.getElementById('editar-mov-descripcion');
        
        if (modal && inputFecha && inputDescripcion) {
            // Convert ISO string to YYYY-MM-DD for input date
            const fecha = new Date(movimiento.movement_date || movimiento.created_at).toISOString().split('T')[0];
            inputFecha.value = fecha;
            inputDescripcion.value = movimiento.description || '';
            modal.dataset.movimientoId = id;
            modal.classList.remove('hidden');
        }
    }

    cerrarModalEditar() {
        const modal = document.getElementById('modal-editar-movimiento');
        if (modal) modal.classList.add('hidden');
    }

    async guardarEdicionMovimiento(e) {
        e.preventDefault();
        
        const modal = document.getElementById('modal-editar-movimiento');
        const id = parseInt(modal.dataset.movimientoId);
        const nuevaFecha = document.getElementById('editar-mov-fecha').value;
        const nuevaDescripcion = document.getElementById('editar-mov-descripcion').value.trim();
        
        const movimientoOriginal = this.movimientos.find(m => m.id === id);
        if (!movimientoOriginal) return;

        // Construir objeto actualizado. Mantenemos el tipo y otros datos del original, solo cambiamos fecha/desc
        const updateData = {
            type: movimientoOriginal.type,
            amount: movimientoOriginal.amount,
            description: nuevaDescripcion,
            payment_method: movimientoOriginal.payment_method,
            category: movimientoOriginal.category,
            movement_date: new Date(nuevaFecha + 'T12:00:00').toISOString()
        };

        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${this.API_BASE_URL}/cash-register/movement/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });

            if (response.ok) {
                await this.cargarDatos();
                this.cerrarModalEditar();
                this.mostrarNotificacion('Movimiento actualizado correctamente', 'success');
            } else {
                this.mostrarNotificacion('Error al actualizar movimiento', 'error');
            }
        } catch (error) {
            console.error("Error actualizando:", error);
        }
    }

    editarBaseCaja() {
        const modal = document.getElementById('modal-base-caja');
        const input = document.getElementById('nueva-base-caja');
        if (modal && input) {
            input.value = this.baseCaja;
            modal.classList.remove('hidden');
        }
    }

    cerrarModalBase() {
        const modal = document.getElementById('modal-base-caja');
        if (modal) modal.classList.add('hidden');
    }

    async guardarBaseCaja(e) {
        e.preventDefault();
        const nuevaBase = parseFloat(document.getElementById('nueva-base-caja').value);
        if (isNaN(nuevaBase) || nuevaBase < 0) {
            this.mostrarNotificacion('Monto inválido', 'error');
            return;
        }

        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${this.API_BASE_URL}/cash-register/base?amount=${nuevaBase}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                await this.cargarDatos();
                this.cerrarModalBase();
                this.mostrarNotificacion('Base actualizada', 'success');
            } else {
                this.mostrarNotificacion('Error al actualizar base', 'error');
            }
        } catch (error) {
            console.error("Error actualizando base:", error);
        }
    }

    cerrarCaja() {
        const modal = document.getElementById('modal-cierre-caja');
        if (modal) {
             // Re-calcular totales para mostrar en el modal
             const ingresos = this.movimientos.filter(m => m.type === 'ingreso');
             const egresos = this.movimientos.filter(m => m.type === 'egreso');
             const totalIngresos = ingresos.reduce((sum, m) => sum + m.amount, 0);
             const totalEgresos = egresos.reduce((sum, m) => sum + m.amount, 0);
             const balanceFinal = this.baseCaja + totalIngresos - totalEgresos;
             const neto = totalIngresos - totalEgresos;

             document.getElementById('cierre-base').textContent = `$${this.formatNumber(this.baseCaja)}`;
             document.getElementById('cierre-ingresos').textContent = `$${this.formatNumber(totalIngresos)}`;
             document.getElementById('cierre-egresos').textContent = `$${this.formatNumber(totalEgresos)}`;
             document.getElementById('cierre-balance').textContent = `$${this.formatNumber(balanceFinal)}`;
             document.getElementById('cierre-neto').textContent = `$${this.formatNumber(neto)}`;

             modal.classList.remove('hidden');
        }
    }

    cerrarModalCierre() {
        const modal = document.getElementById('modal-cierre-caja');
        if (modal) modal.classList.add('hidden');
    }

    async confirmarCierre() {
        if (!confirm("¿Está seguro de cerrar la caja por hoy?")) return;

        try {
            const token = sessionStorage.getItem('access_token');
            const response = await fetch(`${this.API_BASE_URL}/cash-register/close`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

             if (response.ok) {
                this.cerrarModalCierre();
                this.mostrarNotificacion('Caja cerrada correctamente', 'success');
                // Opcional: Deshabilitar acciones o recargar
                await this.cargarDatos();
            } else {
                this.mostrarNotificacion('Error al cerrar caja', 'error');
            }
        } catch (error) {
             console.error("Error cerrando caja:", error);
        }
    }

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
        setTimeout(() => { notif.classList.add('hidden'); }, 3000);
    }
}

// Inicializar
const cuadreCaja = new CuadreCajaManager();
window.cuadreCaja = cuadreCaja;
