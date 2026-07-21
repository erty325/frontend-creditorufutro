document.addEventListener("DOMContentLoaded", () => {
  // Create sidebar links: Usuarios and Ajustes
  const nav = document.querySelector(".nav-menu")
  if (!nav) return

  // Utility: show notification using app if available, fallback to alert
  function notify(msg, type = "success") {
    try {
      if (window.app && typeof window.app.mostrarNotificacion === "function") {
        window.app.mostrarNotificacion(msg, type)
        return
      }
    } catch (e) {
      console.warn("notify fallback error", e)
    }
    alert(msg)
  }

  // Dynamically create modals if not present
  function openCreateUserModal() {
    let modal = document.getElementById("modal-create-user")
    if (!modal) {
      modal = document.createElement("div")
      modal.id = "modal-create-user"
      modal.className = "modal hidden"
      modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
          <div class="modal-header"><h3>Crear Usuario del Sistema</h3><button class="btn-close" id="btn-close-create">×</button></div>
          <div style="padding:20px;">
            <form id="form-create-system-user">
              <div class="form-row">
                <div class="form-group"><label for="sys-email">Email</label><input id="sys-email" type="email" required /></div>
                <div class="form-group"><label for="sys-password">Contraseña</label><input id="sys-password" type="password" required /></div>
                <div class="form-group"><label for="sys-confirm">Confirmar</label><input id="sys-confirm" type="password" required /></div>
              </div>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <button type="submit" class="btn btn-primary">Crear Usuario</button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-create">Cancelar</button>
              </div>
            </form>
          </div>
        </div>`
      document.body.appendChild(modal)

      // wire close buttons
      modal.querySelector("#btn-close-create").addEventListener("click", () => modal.classList.add("hidden"))
      modal.querySelector("#btn-cancel-create").addEventListener("click", () => modal.classList.add("hidden"))

      // wire form
      modal.querySelector("#form-create-system-user").addEventListener("submit", async (e) => {
        e.preventDefault()
        const email = document.getElementById("sys-email").value.trim()
        const password = document.getElementById("sys-password").value
        const confirm = document.getElementById("sys-confirm").value
        if (!email || !password) return alert("Email y contraseña requeridos")
        if (password !== confirm) return alert("Las contraseñas no coinciden")
        const token = sessionStorage.getItem("access_token")
        if (!token) return alert("No autenticado")
        try {
          const res = await fetch(window.API_BASE_URL + "/register", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ email, password, confirm_password: confirm }),
          })
          if (!res.ok) {
            const txt = await res.text().catch(() => null)
            const errMsg = txt || `Error creando usuario (${res.status})`
            throw new Error(errMsg)
          }
          notify("Usuario creado", "success")
          modal.classList.add("hidden")
        } catch (err) {
          console.error(err)
          alert(err.message || err)
        }
      })
    }
    modal.classList.remove("hidden")
  }

  function openAjustesModal() {
    let modal = document.getElementById("modal-ajustes")
    if (!modal) {
      modal = document.createElement("div")
      modal.id = "modal-ajustes"
      modal.className = "modal hidden"
      modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
          <div class="modal-header"><h3>Ajustes de Cuenta</h3><button class="btn-close" id="btn-close-ajustes">×</button></div>
          <div style="padding:20px;">
            <form id="form-ajustes">
              <div class="form-row">
                <div class="form-group"><label for="me-email">Nuevo Email</label><input id="me-email" type="email" /></div>
                <div class="form-group"><label for="old-pass">Contraseña Actual</label><input id="old-pass" type="password" /></div>
                <div class="form-group"><label for="new-pass">Nueva Contraseña</label><input id="new-pass" type="password" /></div>
                <div class="form-group"><label for="new-pass-confirm">Confirmar Nueva</label><input id="new-pass-confirm" type="password" /></div>
              </div>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-ajustes">Cancelar</button>
              </div>
            </form>
          </div>
        </div>`
      document.body.appendChild(modal)

      modal.querySelector("#btn-close-ajustes").addEventListener("click", () => modal.classList.add("hidden"))
      modal.querySelector("#btn-cancel-ajustes").addEventListener("click", () => modal.classList.add("hidden"))

      modal.querySelector("#form-ajustes").addEventListener("submit", async (e) => {
        e.preventDefault()
        const newEmail = document.getElementById("me-email").value.trim()
        const oldPass = document.getElementById("old-pass").value
        const newPass = document.getElementById("new-pass").value
        const confirm = document.getElementById("new-pass-confirm").value
        const token = sessionStorage.getItem("access_token")
        if (!token) {
          notify("No autenticado", "error")
          return
        }
        try {
          if (newEmail) {
            const r1 = await fetch(window.API_BASE_URL + "/users/update_user/", {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
              body: JSON.stringify({ email: newEmail }),
            })
            if (!r1.ok) {
              const t = await r1.text().catch(() => null)
              throw new Error(t || "Error actualizando email")
            }
          }
          if (oldPass && newPass) {
            if (newPass !== confirm) throw new Error("Las nuevas contraseñas no coinciden")
            const r2 = await fetch(window.API_BASE_URL + "/users/update_password", {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
              body: JSON.stringify({ old_password: oldPass, new_password: newPass }),
            })
            if (!r2.ok) {
              const t = await r2.text().catch(() => null)
              throw new Error(t || "Error actualizando contraseña")
            }
          }
          notify("Ajustes guardados", "success")
          modal.classList.add("hidden")
        } catch (err) {
          console.error(err)
          notify(err.message || String(err), "error")
        }
      })
    }
    modal.classList.remove("hidden")
  }
})
