document.addEventListener("DOMContentLoaded", () => {
  try {
    const btnNuevo = document.getElementById("btn-nuevo-usuario");
    const modal = document.getElementById("modal-usuario");
    const btnClose = document.getElementById("btn-close-modal");
    const btnCancel = document.getElementById("btn-cancel");
    const form = document.getElementById("form-usuario");
    const modalOverlay = document.querySelector(".modal-overlay");
    const modalConfirmDelete = document.getElementById("modal-confirm-delete");
    const btnConfirmDelete = document.getElementById("btn-confirm-delete");
    const btnCancelDelete = document.getElementById("btn-cancel-delete");
    const btnCloseConfirmDelete = document.getElementById(
      "btn-close-confirm-delete",
    );
    const tbodyUsuarios = document.getElementById("usuarios-tbody");
    const emptyState = document.getElementById("empty-usuarios");
    const buscarInput = document.getElementById("buscar-cliente");
    const filterBtns = document.querySelectorAll(".usuarios-filter-btn");

    let eliminarUsuarioId = null;

    const inputs = {
      nombre: document.getElementById("nombre"),
      cedula: document.getElementById("cedula"),
      telefono: document.getElementById("telefono"),
      email: document.getElementById("email"),
      direccion: document.getElementById("direccion"),
      monto: document.getElementById("monto-prestamo"),
      tasa: document.getElementById("tasa-interes"),
      plazo: document.getElementById("plazo"),
      periodo: document.getElementById("periodo-pago"),
      fechaCreacion: document.getElementById("fecha-creacion"),
      fechaPrimerPago: document.getElementById("fecha-primer-pago"),
    };

    let editingUserId = null;
    let currentFilter = "todos";
    let searchTerm = "";

    console.log("Usuarios module loaded");

    // Inicializar fechas por defecto en zona horaria de Colombia
    function initDefaultDates() {
      // Obtener fecha actual en Colombia (UTC-5)
      const now = new Date();
      const colombiaOffset = -5 * 60; // Colombia es UTC-5 (en minutos)
      const localOffset = now.getTimezoneOffset();
      const colombiaTime = new Date(
        now.getTime() + (localOffset + colombiaOffset) * 60000,
      );
      const hoy = colombiaTime.toISOString().split("T")[0];
      if (inputs.fechaCreacion) inputs.fechaCreacion.value = hoy;

      // Fecha de primer pago: 15 dias despues por defecto
      const primerPago = new Date(colombiaTime);
      primerPago.setDate(primerPago.getDate() + 15);
      if (inputs.fechaPrimerPago)
        inputs.fechaPrimerPago.value = primerPago.toISOString().split("T")[0];
    }

    // Detectar plazo decimal y cambiar automaticamente a quincenal
    if (inputs.plazo) {
      inputs.plazo.addEventListener("input", () => {
        const plazoValue = parseFloat(inputs.plazo.value);
        const indicator = document.getElementById("plazo-auto-indicator");

        if (plazoValue && !Number.isInteger(plazoValue)) {
          // Plazo decimal detectado
          if (inputs.periodo) {
            inputs.periodo.value = "quincenas";
            inputs.periodo.disabled = true;
          }
          if (indicator) indicator.style.display = "flex";
        } else {
          if (inputs.periodo) inputs.periodo.disabled = false;
          if (indicator) indicator.style.display = "none";
        }

        actualizarPreview();
      });
    }

    // Actualizar preview cuando cambian los valores
    function actualizarPreview() {
      const preview = document.getElementById("cliente-preview");
      if (!preview) return;

      const monto = parseFloat(inputs.monto?.value) || 0;
      const tasa = parseFloat(inputs.tasa?.value) || 0;
      const plazo = parseFloat(inputs.plazo?.value) || 0;
      const periodo = inputs.periodo?.value || "meses";
      const fechaPrimerPago = inputs.fechaPrimerPago?.value;

      if (monto > 0 && plazo > 0) {
        preview.style.display = "block";

        // Calcular numero de cuotas segun periodo
        let numeroCuotas = plazo;
        let diasEntreCuotas = 30;

        if (periodo === "quincenas") {
          numeroCuotas = Math.ceil(plazo * 2);
          diasEntreCuotas = 15;
        } else if (periodo === "semanas") {
          numeroCuotas = plazo;
          diasEntreCuotas = 7;
        }

        const interesesTotales = monto * (tasa / 100) * plazo;
        const montoTotal = monto + interesesTotales;
        const valorCuota = montoTotal / numeroCuotas;

        // Calcular fechas
        let fechaInicio = fechaPrimerPago
          ? new Date(fechaPrimerPago + "T00:00:00")
          : new Date();
        if (!fechaPrimerPago) {
          fechaInicio.setDate(fechaInicio.getDate() + diasEntreCuotas);
        }

        const fechaUltima = new Date(fechaInicio);
        if (periodo === "quincenas") {
          fechaUltima.setDate(fechaUltima.getDate() + (numeroCuotas - 1) * 15);
        } else if (periodo === "semanas") {
          fechaUltima.setDate(fechaUltima.getDate() + (numeroCuotas - 1) * 7);
        } else {
          fechaUltima.setMonth(fechaUltima.getMonth() + (numeroCuotas - 1));
        }

        const formatNumber = (num) =>
          new Intl.NumberFormat("es-CO").format(Math.round(num * 100) / 100);
        const formatDate = (date) =>
          date.toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

        document.getElementById("preview-monto-total").textContent =
          `$${formatNumber(montoTotal)}`;
        document.getElementById("preview-intereses").textContent =
          `$${formatNumber(interesesTotales)}`;
        document.getElementById("preview-cuotas").textContent = numeroCuotas;
        document.getElementById("preview-valor-cuota").textContent =
          `$${formatNumber(valorCuota)}`;
        document.getElementById("preview-primera-cuota").textContent =
          formatDate(fechaInicio);
        document.getElementById("preview-ultima-cuota").textContent =
          formatDate(fechaUltima);
      } else {
        preview.style.display = "none";
      }
    }

    // Event listeners para preview
    if (inputs.monto) inputs.monto.addEventListener("input", actualizarPreview);
    if (inputs.tasa) inputs.tasa.addEventListener("input", actualizarPreview);
    if (inputs.periodo)
      inputs.periodo.addEventListener("change", actualizarPreview);
    if (inputs.fechaPrimerPago)
      inputs.fechaPrimerPago.addEventListener("change", actualizarPreview);

    function validarNombre(nombre) {
      return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre.trim());
    }

    function validarEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    }

    function validarTelefono(telefono) {
      return (
        /^[\d\s+\-()]+$/.test(telefono.trim()) &&
        telefono.trim().replace(/\D/g, "").length >= 7
      );
    }

    function mostrarError(campo, mensaje) {
      const errorEl = document.getElementById(`error-${campo}`);
      if (errorEl) {
        errorEl.textContent = mensaje;
        inputs[campo]?.classList.add("error");
      }
    }

    function limpiarErrores() {
      Object.keys(inputs).forEach((key) => {
        const errorEl = document.getElementById(`error-${key}`);
        if (errorEl) {
          errorEl.textContent = "";
          inputs[key]?.classList.remove("error");
        }
      });
    }

    function mostrarNotificacion(mensaje, tipo = "success") {
      const notif = document.getElementById("notificacion");
      if (!notif) return;
      notif.textContent = mensaje;
      notif.className = `notificacion ${tipo}`;
      notif.classList.remove("hidden");
      setTimeout(() => notif.classList.add("hidden"), 3000);
    }

    function calcularEstadoPagos(usuario) {
      const credit = usuario.credits?.[0];

      if (!credit || !credit.cuotas) {
        return {
          montoVencido: 0,
          cuotasVencidas: 0,
          montoPagado: 0,
          saldoPendiente: 0,
          interesPendiente: 0,
        };
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      let montoVencido = 0;
      let cuotasVencidas = 0;
      let montoPagado = 0;

      credit.cuotas.forEach((cuota) => {
        const fechaCuota = cuota.fecha
          ? new Date(cuota.fecha + "T00:00:00")
          : null;

        if (cuota.status === "paid") {
          montoPagado += Number(cuota.cuota || 0);
        }

        if (cuota.status !== "paid" && fechaCuota && fechaCuota < hoy) {
          montoVencido += Number(cuota.saldoPendiente || 0);
          cuotasVencidas += 1;
        }
      });

      return {
        montoVencido,
        cuotasVencidas,
        montoPagado,

        // 🔥 SOLO BACKEND
        saldoPendiente: Number(credit.outstanding_balance || 0),

        // 🔥 ESTA ES LA CLAVE
        interesPendiente: Number(credit.resumen?.total_mora || 0),
      };
    }

    function abrirModal() {
      limpiarErrores();
      editingUserId = null;
      form.reset();
      initDefaultDates();
      document.getElementById("modal-title").textContent = "Nuevo Cliente";
      document.getElementById("cliente-preview").style.display = "none";
      document.getElementById("plazo-auto-indicator").style.display = "none";
      if (inputs.periodo) inputs.periodo.disabled = false;
      modal.classList.remove("hidden");
    }

    function cerrarModal() {
      modal.classList.add("hidden");
      form.reset();
      limpiarErrores();
      editingUserId = null;
    }

    // ========== ELIMINACION CON CONFIRM MODAL ==========
    function abrirModalEliminar(id) {
      const usuario = window.app.usuarios.find((u) => u.id === id);
      if (!usuario) return;
      eliminarUsuarioId = id;
      const nombreEl = document.getElementById("delete-nombre");
      if (nombreEl) nombreEl.textContent = usuario.nombre || "-";
      if (modalConfirmDelete) modalConfirmDelete.classList.remove("hidden");
    }

    function cerrarModalEliminar() {
      if (modalConfirmDelete) modalConfirmDelete.classList.add("hidden");
      eliminarUsuarioId = null;
    }

    function confirmarEliminar() {
      if (!eliminarUsuarioId) return;
      // Llamar al borrado real
      eliminarUsuario(eliminarUsuarioId);
      cerrarModalEliminar();
    }

    function guardarUsuario(e) {
      e.preventDefault();
      console.log("Form enviado");
      limpiarErrores();

      let esValido = true;

      if (!inputs.nombre.value.trim()) {
        mostrarError("nombre", "El nombre es requerido");
        esValido = false;
      } else if (!validarNombre(inputs.nombre.value)) {
        mostrarError("nombre", "El nombre solo puede contener letras");
        esValido = false;
      }

      if (!inputs.cedula.value.trim()) {
        mostrarError("cedula", "La cedula es requerida");
        esValido = false;
      }

      if (!inputs.telefono.value.trim()) {
        mostrarError("telefono", "El telefono es requerido");
        esValido = false;
      } else if (!validarTelefono(inputs.telefono.value)) {
        mostrarError(
          "telefono",
          "Formato de telefono invalido (minimo 7 digitos)",
        );
        esValido = false;
      }

      if (!inputs.direccion.value.trim()) {
        mostrarError("direccion", "La direccion es requerida");
        esValido = false;
      }

      if (!inputs.monto.value || parseFloat(inputs.monto.value) <= 0) {
        mostrarError("monto", "El monto debe ser mayor a 0");
        esValido = false;
      }

      if (!inputs.tasa.value || parseFloat(inputs.tasa.value) < 0) {
        mostrarError("tasa", "La tasa no puede ser negativa");
        esValido = false;
      }

      if (!inputs.plazo.value || parseFloat(inputs.plazo.value) <= 0) {
        mostrarError("plazo", "El plazo debe ser mayor a 0");
        esValido = false;
      }

      if (!inputs.periodo.value) {
        mostrarError("periodo", "El periodo de pago es requerido");
        esValido = false;
      }

      if (!esValido) {
        console.log("Validacion fallida");
        return;
      }

      const monto = parseFloat(inputs.monto.value);
      const tasa = parseFloat(inputs.tasa.value);
      const plazo = parseFloat(inputs.plazo.value);
      const periodo = inputs.periodo.value;
      const fechaCreacion =
        inputs.fechaCreacion?.value || new Date().toISOString().split("T")[0];
      const fechaPrimerPago = inputs.fechaPrimerPago?.value || null;

      console.log("Generando cuotas", {
        monto,
        tasa,
        plazo,
        periodo,
        fechaCreacion,
        fechaPrimerPago,
      });

      const token = sessionStorage.getItem("access_token");
      if (!token) {
        mostrarNotificacion("No autenticado. Inicia sesion de nuevo.", "error");
        return;
      }

      const mapPeriodoToApi = (p) => {
        const v = (p || "").toString().toLowerCase();
        if (v === "meses" || v === "mensual" || v === "mens") return "mensual";
        if (v === "quincenas" || v === "quincenal" || v.includes("quin"))
          return "quincenal";
        if (v === "semanas" || v === "semanal") return "semanal";
        return "mensual";
      };

      const clientPayload = {
        name: inputs.nombre.value.trim(),
        cedula: inputs.cedula.value.trim(),
        phone: inputs.telefono.value.trim(),
        email: inputs.email.value.trim() || "",
        direction: inputs.direccion.value.trim(),
      };

      const creditPayload = {
        monto: Number(monto),
        interest_rate: Number(tasa),
        term_months: Number(plazo),
        payment_period: mapPeriodoToApi(periodo),
        fecha_creacion: fechaCreacion,
        fecha_primer_pago: fechaPrimerPago,
      };

      const headers = {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      };

      if (editingUserId) {
        const user = window.app.usuarios.find((u) => u.id === editingUserId);
        if (!user) {
          mostrarNotificacion("Usuario no encontrado en memoria", "error");
          return;
        }

        const clientChanges = {};
        if ((clientPayload.name || "") !== (user.nombre || ""))
          clientChanges.name = clientPayload.name;
        if ((clientPayload.cedula || "") !== (user.cedula || ""))
          clientChanges.cedula = clientPayload.cedula;
        if ((clientPayload.phone || "") !== (user.telefono || ""))
          clientChanges.phone = clientPayload.phone;
        if ((clientPayload.email || "") !== (user.email || ""))
          clientChanges.email = clientPayload.email;
        if ((clientPayload.direction || "") !== (user.direccion || ""))
          clientChanges.direction = clientPayload.direction;

        const mappedPeriod = creditPayload.payment_period;
        const creditChanges = {};
        if (user.monto !== Number(creditPayload.monto))
          creditChanges.monto = creditPayload.monto;
        if (user.tasa !== Number(creditPayload.interest_rate))
          creditChanges.interest_rate = creditPayload.interest_rate;
        if (
          (user.term_months || user.plazo || 0) !==
          Number(creditPayload.term_months)
        )
          creditChanges.term_months = creditPayload.term_months;
        if ((user.payment_period || "") !== (mappedPeriod || ""))
          creditChanges.payment_period = mappedPeriod;

        const promises = [];

        if (Object.keys(clientChanges).length > 0) {
          promises.push(
            fetch(
              `window.API_BASE_URL/clients/update_client/${editingUserId}`,
              {
                method: "PUT",
                headers,
                body: JSON.stringify(clientChanges),
              },
            ).then((res) => {
              if (!res.ok) throw new Error("Failed updating client");
              return res.json().catch(() => null);
            }),
          );
        }

        if (Object.keys(creditChanges).length > 0 && user.credit_id) {
          promises.push(
            fetch(
              `window.API_BASE_URL/credits/update_credit/${user.credit_id}`,
              {
                method: "PUT",
                headers,
                body: JSON.stringify(creditChanges),
              },
            ).then((res) => {
              if (!res.ok) throw new Error("Failed updating credit");
              return res.json().catch(() => null);
            }),
          );
        }

        if (promises.length === 0) {
          cerrarModal();
          mostrarNotificacion("No hubo cambios para guardar", "info");
          return;
        }

        Promise.all(promises)
          .then(() => {
            cerrarModal();
            window.app.loadFromApi();
            mostrarNotificacion("Actualizacion completada", "success");
          })
          .catch((err) => {
            console.error(err);
            mostrarNotificacion("Error actualizando", "error");
          });
      } else {
        const body = {
          ...clientPayload,
          monto: creditPayload.monto,
          interest_rate: creditPayload.interest_rate,
          term_months: creditPayload.term_months,
          payment_period: creditPayload.payment_period,
          fecha_creacion: creditPayload.fecha_creacion,
          fecha_primer_pago: creditPayload.fecha_primer_pago,
        };

        fetch("window.API_BASE_URL/clients/add_client", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        })
          .then(async (res) => {
            if (!res.ok) {
              const txt = await res.text().catch(() => "");
              throw new Error("Server error: " + res.status + " " + txt);
            }
            return res.json();
          })
          .then((data) => {
            cerrarModal();
            window.app.loadFromApi();
            mostrarNotificacion("Cliente creado correctamente", "success");
          })
          .catch((err) => {
            console.error(err);
            mostrarNotificacion("Error creando cliente", "error");
          });
      }
    }

    function editarUsuario(id) {
      const usuario = window.app.usuarios.find((u) => u.id === id);
      if (!usuario) return;

      editingUserId = id;
      inputs.nombre.value = usuario.nombre || "";
      inputs.cedula.value = usuario.cedula || "";
      inputs.telefono.value = usuario.telefono || "";
      inputs.email.value = usuario.email || "";
      inputs.direccion.value = usuario.direccion || "";
      inputs.monto.value = usuario.monto || "";
      inputs.tasa.value = usuario.tasa || "";
      inputs.plazo.value = usuario.plazo || "";
      inputs.periodo.value = usuario.periodo || "meses";

      if (inputs.fechaCreacion) {
        inputs.fechaCreacion.value =
          usuario.fechaCreacion || new Date().toISOString().split("T")[0];
      }
      if (inputs.fechaPrimerPago && usuario.fechaPrimerPago) {
        inputs.fechaPrimerPago.value = usuario.fechaPrimerPago;
      }

      document.getElementById("modal-title").textContent = "Editar Cliente";
      modal.classList.remove("hidden");
      actualizarPreview();
    }

    function eliminarUsuario(id) {
      const token = sessionStorage.getItem("access_token");
      if (!token) {
        mostrarNotificacion("No autenticado. Inicia sesion de nuevo.", "error");
        return;
      }

      fetch(
        `window.API_BASE_URL/clients/delete_client/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: "Bearer " + token },
        },
      )
        .then((res) => {
          if (!res.ok) throw new Error("Failed to delete");
          mostrarNotificacion("Cliente eliminado correctamente", "success");
          window.app.loadFromApi();
        })
        .catch((err) => {
          console.error(err);
          mostrarNotificacion("Error eliminando cliente", "error");
        });
    }

    function filtrarUsuarios(usuarios) {
      let filtered = usuarios;

      // Filtrar por busqueda (nombre, telefono, email o cedula)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (u) =>
            (u.nombre || "").toLowerCase().includes(term) ||
            (u.telefono || "").toLowerCase().includes(term) ||
            (u.email || "").toLowerCase().includes(term) ||
            (u.cedula || "").toLowerCase().includes(term),
        );
      }

      // Filtrar por estado
      if (currentFilter !== "todos") {
        filtered = filtered.filter((u) => {
          const estado = calcularEstadoPagos(u);
          switch (currentFilter) {
            case "al-dia":
              return estado.cuotasVencidas === 0 && estado.saldoPendiente > 0;
            case "vencidos":
              return estado.cuotasVencidas > 0;
            case "pagados":
              return estado.saldoPendiente === 0;
            default:
              return true;
          }
        });
      }

      return filtered;
    }

    function renderTabla() {
      console.log("Renderizando con", window.app.usuarios.length, "usuarios");

      const usuariosFiltrados = filtrarUsuarios(window.app.usuarios);

      if (usuariosFiltrados.length === 0) {
        tbodyUsuarios.innerHTML = "";
        emptyState.style.display = "block";
        return;
      }

      emptyState.style.display = "none";

      const formatNumber = (num) =>
        window.app && typeof window.app.formatNumber === "function"
          ? window.app.formatNumber(num)
          : new Intl.NumberFormat("es-CO").format(num);

      const formatDate = (dateStr) => {
        if (!dateStr || dateStr === "-") return "-";
        // Handle input that is already ISO or full date vs YYYY-MM-DD
        const safeDateStr = dateStr.includes("T") ? dateStr : dateStr + "T00:00:00";
        const date = new Date(safeDateStr);
        if (isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "short",
        });
      };

      tbodyUsuarios.innerHTML = usuariosFiltrados
        .map((usuario) => {
          const estado = calcularEstadoPagos(usuario);
          const estadoClase =
            estado.cuotasVencidas > 0 ? "estado-vencido" : "estado-normal";
          const interesMoraTotal = estado.interesPendiente;

          const periodoTexto =
            usuario.periodo === "semanas"
              ? "Semanal"
              : usuario.periodo === "quincenas"
                ? "Quincenal"
                : "Mensual";

          const periodoBadgeClass =
            usuario.periodo === "semanas"
              ? "semanal"
              : usuario.periodo === "quincenas"
                ? "quincenal"
                : "mensual";

          // Obtener inicial del nombre para avatar
          const inicial = (usuario.nombre || "?")[0].toUpperCase();

          // Fechas
          const fechaCreacion =
            usuario.fechaCreacion || usuario.fecha_creacion || "-";

          const fechaPrimerPago =
            usuario.fechaPrimerPago || usuario.cuotas?.[0]?.fecha || "-";

          return `
            <tr class="${estadoClase}">
              <td>
                <div class="usuario-nombre-cell">
                  <div class="usuario-avatar">${inicial}</div>
                  <div class="usuario-nombre-info">
                    <span class="nombre">${usuario.nombre}</span>
                    <span class="cedula-info" style="color: #6b7280; font-size: 12px;">${usuario.cedula || "Sin Cedula"}</span>
                  </div>
                </div>
              </td>
              <td>${usuario.telefono}</td>
              <td>
                <div class="usuario-fechas-cell">
                  <div class="fecha-item">
                    <span class="fecha-label">Creado:</span>
                    <span class="fecha-valor">${formatDate(fechaCreacion)}</span>
                  </div>
                  <div class="fecha-item fecha-pago">
                    <span class="fecha-label">1ra cuota:</span>
                    <span class="fecha-valor">${formatDate(fechaPrimerPago)}</span>
                  </div>
                </div>
              </td>
              <td>$${formatNumber(usuario.monto)}</td>
              <td>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-weight: 600; color: #dc2626;">
                    $${formatNumber(interesMoraTotal)}
                  </span>
                  <span style="font-size: 11px; color: #6b7280;">
                    mora acumulada
                  </span>
                </div>
              </td>
              <td>${usuario.tasa}%</td>
              <td>${usuario.plazo}</td>
              <td><span class="periodo-badge ${periodoBadgeClass}">${periodoTexto}</span></td>
              <td>${usuario.dias_hasta_primer_pago != null ? usuario.dias_hasta_primer_pago : 'N/A'}</td>
              <td>${usuario.interes_mora_diaria != null ? '$' + formatNumber(usuario.interes_mora_diaria) : 'N/A'}</td>
              <td>
                <div class="estado-pagos-cell">
                  <div class="estado-pagos-item">
                    <span class="label">Pagado:</span>
                    <span class="valor">$${formatNumber(estado.montoPagado)}</span>
                  </div>
                  <div class="estado-pagos-item">
                    <span class="label">Pendiente:</span>
                    <span class="valor">$${formatNumber(estado.saldoPendiente)}</span>
                  </div>
                  ${
                    estado.cuotasVencidas > 0
                      ? `
                    <div class="estado-pagos-item vencido">
                      <span class="label">Vencido:</span>
                      <span class="valor">$${formatNumber(estado.montoVencido)} (${estado.cuotasVencidas})</span>
                    </div>
                  `
                      : ""
                  }
                </div>
              </td>
              <td>
                <div class="usuarios-actions">
                  <button class="btn-action btn-contact" title="WhatsApp" onclick="abrirWhatsApp('${usuario.telefono}', '${usuario.nombre}')">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor"/>
                    </svg>
                  </button>
                  <button class="btn-action btn-edit" title="Editar" onclick="editarUsuarioGlobal('${usuario.id}')">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
                    </svg>
                  </button>
                  <button class="btn-action btn-delete" title="Eliminar" onclick="eliminarUsuarioGlobal('${usuario.id}')">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    // Funciones globales
    window.abrirWhatsApp = (telefono, nombre) => {
      const usuario = window.app.usuarios.find((u) => u.telefono === telefono);
      let montoCuota = 0;
      let fechaCuota = "";

      if (usuario && usuario.cuotas) {
        const proximaCuota = usuario.cuotas.find((c) => !c.pagado);
        if (proximaCuota) {
          montoCuota = proximaCuota.cuota;
          fechaCuota = proximaCuota.fecha;
        }
      }

      const formatNumber = (num) => new Intl.NumberFormat("es-CO").format(num);
      const mensaje = `Hola ${nombre}, le escribimos para informarle que tiene cuotas pendientes.${montoCuota > 0 ? ` Su proxima cuota es de $${formatNumber(montoCuota)} con vencimiento el ${fechaCuota}.` : ""} Por favor, regularice su situacion.`;
      const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");
    };

    window.editarUsuarioGlobal = (id) => editarUsuario(id);
    window.eliminarUsuarioGlobal = (id) => abrirModalEliminar(id);

    // Event listeners de filtros
    if (buscarInput) {
      buscarInput.addEventListener("input", (e) => {
        searchTerm = e.target.value;
        renderTabla();
      });
    }

    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.getAttribute("data-filter");
        renderTabla();
      });
    });

    // Event listeners del modal
    if (btnNuevo) {
      btnNuevo.addEventListener("click", abrirModal);
      console.log("Boton nuevo usuario configurado");
    }

    if (btnClose) btnClose.addEventListener("click", cerrarModal);
    if (btnCancel) btnCancel.addEventListener("click", cerrarModal);
    if (form) {
      form.addEventListener("submit", guardarUsuario);
      console.log("Form configurado correctamente");
    }
    if (modalOverlay) {
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) cerrarModal();
      });
    }

    // Confirm delete modal listeners
    if (btnCloseConfirmDelete)
      btnCloseConfirmDelete.addEventListener("click", cerrarModalEliminar);
    if (btnCancelDelete)
      btnCancelDelete.addEventListener("click", cerrarModalEliminar);
    if (btnConfirmDelete)
      btnConfirmDelete.addEventListener("click", confirmarEliminar);
    if (modalConfirmDelete) {
      const confirmOverlay = modalConfirmDelete.querySelector(".modal-overlay");
      if (confirmOverlay) {
        confirmOverlay.addEventListener("click", (e) => {
          if (e.target === confirmOverlay) cerrarModalEliminar();
        });
      }
    }

    window.addEventListener("datosActualizados", () => {
      console.log("Datos actualizados event recibido en usuarios.js");
      renderTabla();
    });

    renderTabla();
  } catch (err) {
    console.error("usuarios.js init error", err);
    try {
      if (window.app && typeof window.app.mostrarNotificacion === "function") {
        window.app.mostrarNotificacion(
          "Error modulo Usuarios: " + (err.message || err),
          "error",
        );
      } else {
        alert("Error modulo Usuarios: " + (err.message || err));
      }
    } catch (e) {
      console.error("notify fallback failed", e);
    }
  }
});
