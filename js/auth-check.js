// This script should be included in all protected pages to check authentication
;(async () => {
  const token = sessionStorage.getItem('access_token')

  if (!token) {
    // No token -> redirect to login
    window.location.href = '/login.html'
    return
  }

  // Validate token with backend /me endpoint
  try {
    const controller = new AbortController()
    const signal = controller.signal

    // set a short timeout so a hung request doesn't block too long
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(window.API_BASE_URL + '/me', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
      },
      signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      // Only treat 401/403 as authentication failures that should log the user out.
      if (res.status === 401 || res.status === 403) {
        sessionStorage.removeItem('isLoggedIn')
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('currentUser')
        window.location.href = '/login.html'
        return
      }

      // For other server errors (500, 502, etc.) do not forcibly log out the user;
      // keep the local session alive and let the app try again when the user navigates.
      console.warn('Auth check returned non-auth error', res.status)
      return
    }

    const user = await res.json().catch(() => null)
    if (user && user.email) {
      // ensure currentUser is set for UI
      sessionStorage.setItem('currentUser', user.email)
      sessionStorage.setItem('isLoggedIn', 'true')
    }
  } catch (err) {
    // If the fetch was aborted due to navigation or timeout, do NOT clear the session.
    if (err && err.name === 'AbortError') {
      console.debug('Auth check aborted (navigation or timeout); keeping session')
      return
    }

    // For other network errors, keep the session and let user try again.
    console.error('Auth check failed (network error)', err)
    // Optionally you could show a UI notification here instead of logging out.
    return
  }
})()

// Add logout functionality with animation
function logout() {
  // Create overlay for logout animation
  const overlay = document.createElement('div')
  overlay.id = 'logout-overlay'
  overlay.innerHTML = `
    <div class="logout-content">
      <div class="logout-spinner"></div>
      <p>Cerrando sesion...</p>
    </div>
  `
  
  // Add styles for the overlay
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.3s ease;
  `
  
  const style = document.createElement('style')
  style.textContent = `
    #logout-overlay .logout-content {
      text-align: center;
      color: white;
    }
    #logout-overlay .logout-content p {
      margin-top: 20px;
      font-size: 18px;
      font-weight: 500;
      letter-spacing: 0.5px;
    }
    #logout-overlay .logout-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      margin: 0 auto;
      animation: logout-spin 1s linear infinite;
    }
    @keyframes logout-spin {
      to { transform: rotate(360deg); }
    }
    #logout-overlay.fade-out {
      opacity: 0 !important;
    }
  `
  document.head.appendChild(style)
  document.body.appendChild(overlay)
  
  // Trigger fade in
  requestAnimationFrame(() => {
    overlay.style.opacity = '1'
  })
  
  // Clear session and redirect after animation
  setTimeout(() => {
    sessionStorage.removeItem('isLoggedIn')
    sessionStorage.removeItem('currentUser')
    sessionStorage.removeItem('access_token')
    
    // Redirect to login page inside Mencho folder
    window.location.href = '/login.html'
  }, 800)
}

// Make logout function available globally
window.logout = logout
