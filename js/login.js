document.addEventListener("DOMContentLoaded", () => {
  // Check if user is already logged in
  const isLoggedIn = sessionStorage.getItem("isLoggedIn")
  if (isLoggedIn === "true") {
    window.location.href = "/app/index.html"
    return
  }

  const loginForm = document.getElementById("loginForm")
  const loginBtn = document.getElementById("loginBtn")
  const loginPage = document.querySelector(".login-page")
  const container = document.querySelector(".login-container") || document.body

  // apply initial fade-in
  if (loginPage) {
    loginPage.classList.add("fade-in")
  }

  // Clear browser autofill
  const usernameInput = document.getElementById("username")
  const passwordInput = document.getElementById("password")

  setTimeout(() => {
    if (usernameInput) usernameInput.value = ""
    if (passwordInput) passwordInput.value = ""
  }, 50)

  ;[usernameInput, passwordInput].forEach((inp) => {
    if (!inp) return
    inp.addEventListener("input", (e) => {
      if (e.target.value === "") {
        try {
          e.target.setAttribute("autocomplete", "off")
        } catch {}
      }
    })
  })

  // Helper function to stop loading state
  function stopLoading() {
    if (loginBtn) {
      loginBtn.classList.remove("loading")
      loginBtn.disabled = false
    }
  }

  // Helper function to start loading state
  function startLoading() {
    if (loginBtn) {
      loginBtn.classList.add("loading")
      loginBtn.disabled = true
    }
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault()
    clearErrors()

    const username = usernameInput.value.trim()
    const password = passwordInput.value

    if (!username) {
      showError("username", "Por favor ingrese su usuario")
      return
    }

    if (!password) {
      showError("password", "Por favor ingrese su contraseña")
      return
    }

    // Start loading state
    startLoading()

    // === LOGIN SOLO CON BACKEND ===
    const url = window.API_BASE_URL + "/login"
    const body = new URLSearchParams()
    body.append("username", username)
    body.append("password", password)

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    })
      .then(async (res) => {
        if (!res.ok) {
          stopLoading()
          showNotification("Usuario o contraseña incorrectos", "error")
          showError("username", "Credenciales inválidas")
          showError("password", "Credenciales inválidas")
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (!data) return

        const token = data.access_token
        if (!token) {
          stopLoading()
          showNotification("Respuesta inválida del servidor", "error")
          return
        }

        sessionStorage.setItem("isLoggedIn", "true")
        sessionStorage.setItem("access_token", token)
        sessionStorage.setItem("currentUser", username)

        showNotification("Inicio de sesión exitoso", "success")

        // Animate out and redirect
        setTimeout(() => {
          if (loginPage) {
            loginPage.classList.add("fade-out")
            loginPage.addEventListener(
              "animationend",
              () => {
                window.location.href = "/app/index.html"
              },
              { once: true }
            )
          } else {
            window.location.href = "/app/index.html"
          }
        }, 600)
      })
      .catch((err) => {
        console.error(err)
        stopLoading()
        showNotification(
          "No se pudo conectar al servidor. Intente de nuevo.",
          "error"
        )
      })
  })
})

function showError(fieldId, message) {
  const input = document.getElementById(fieldId)
  const errorSpan = document.getElementById(`error-${fieldId}`)

  if (input) input.classList.add("error")
  if (errorSpan) errorSpan.textContent = message
}

function clearErrors() {
  document.querySelectorAll(".error-message").forEach((el) => {
    el.textContent = ""
  })
  document.querySelectorAll("input").forEach((input) => {
    input.classList.remove("error")
  })
}

function showNotification(message, type) {
  const notification = document.getElementById("notification")
  notification.textContent = message
  notification.className = `notification ${type}`
  notification.classList.remove("hidden")

  setTimeout(() => {
    notification.classList.add("hidden")
  }, 3000)
}
