/**
 * Archivo: main.jsx
 * Descripción: Punto de entrada de la aplicación React. Renderiza el componente App en el DOM.
 * Creado: 2026-05-07
 * Última actualización: 2026-05-07
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
