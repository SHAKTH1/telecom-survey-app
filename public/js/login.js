// public/js/login.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const statusDiv = document.getElementById('status');
  

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/js/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(err => {
          console.error('Service Worker registration failed:', err);
        });
    });
  }


    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
  
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const result = await response.json();
  
        if (response.ok && result.success) {
          statusDiv.textContent = 'Login successful!';
          statusDiv.style.color = 'green';
  
          // Store the JWT token and username in localStorage
          localStorage.setItem('token', result.token);
          localStorage.setItem('username', username);
  
          // Redirect to survey page
          window.location.href = '/survey.html';
        } else {
          statusDiv.textContent = result.message || 'Login failed.';
          statusDiv.style.color = 'red';
        }
      } catch (error) {
        console.error('Error:', error);
        statusDiv.textContent = 'Error connecting to server.';
        statusDiv.style.color = 'red';
      }
    });
  });
  