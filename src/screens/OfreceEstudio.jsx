/**
 * Archivo: OfreceEstudio.jsx
 * Descripción: Pantalla pública / landing o sección secundaria para ofrecer material de estudio a terceros (modo promoción).
 * Creado: 2026-08-29
 * Última actualización: 2026-08-29
 */

import { useState, useEffect } from 'react'

const ACCENT = '#F26522'
const AMBER = '#F59E0B'

const DEFAULT_NAMES = [
  'Carmen Garcia',
  'Julia Garcia',
  'Papa',
  'Mama',
  'Mina',
  'Alvaro Sanchis',
  'Pablo Bonet',
  'Reyes Arribas',
  'Fran Girona',
  'Carles Gimeno',
  'Rocio Mataix',
  'María García',
  'Paco Veyrat',
  'Pablo Sorroche',
  'Tato Alonso',
  'Candela Pacheco',
  'María Jaime',
  'Jorge Alfonso',
  'Leopoldo Muñoz',
  'Kai',
  'Héctor Miralles',
  'Alex Pastor',
  'Jaime Zamora',
  'Marcos Botija',
  'Jaime Oviedo',
  'Juanjo',
  'Patri Encías',
  'Irene Bernalte',
  'Pablo de Irene',
  'Eva Faguás',
  'Ana Zafra',
  'Carmen Zafra',
  'Mariola Bravo',
  'Ines O\'Reilly',
  'Andrés Catalán',
  'Francesc Ballester',
  'Marta Aznar',
  'Javi Grau',
  'Jorge Monterde',
  'Carlota Moreno',
  'Javi Montagud',
  'Luli Cruz',
  'Pati Sancho',
  'Juan Sanchis',
  'Belén Ortega',
  'Belén Paya',
  'Belén Fliquete',
  'Borja Criado',
  'Álvaro Martí',
  'Luis Olcina',
  'Berta Cantó',
  'Carmen Urios',
  'Alberto Sáez',
  'Nacho Ibarra',
  'Ferran Valls',
  'Alfonso Moreno',
  'Victor Arnedillo',
  'Jesús Santos',
  'Germán Cerdá',
  'Julio Juan',
  'Jaime Juan',
  'Guillermo García Sáenz',
  'Marta García Sáenz',
  'Irene Sáenz Lónchez',
  'Guillermo García Bou',
  'Yaya',
  'Abuelo Amado',
  'Abuelo Jose Pedro',
  'Abuela Carmina',
  'Charo García Sabater',
  'Santi Gomar',
  'García Mayals',
  'García Hurtado',
  'Tía Cris',
  'Tia Cristina',
  'Tia Carmen',
  'Tia Kana',
  'Tia Mari',
  'Ana Jordá',
  'Verónica Vives',
  'García Fuentes',
  'Mateo',
  'Lluna',
  'Elena Poveda',
  'Ferrer Fenollar',
  'Nacho Ferrer',
  'Mesa 7 (Adri, María, María, Natalia, Marta Cuc)'
]

export default function OfreceEstudio() {
  const [names, setNames] = useState(() => {
    try {
      const saved = localStorage.getItem('ofrecido_lista_nombres')
      return saved ? JSON.parse(saved) : DEFAULT_NAMES
    } catch {
      return DEFAULT_NAMES
    }
  })

  const [activePerson, setActivePerson] = useState(() => {
    return localStorage.getItem('ofrecido_persona_activa') || ''
  })

  const [isLit, setIsLit] = useState(() => {
    return localStorage.getItem('ofrecido_vela_encendida') === 'true'
  })

  const [cozyMode, setCozyMode] = useState(() => {
    return localStorage.getItem('ofrecido_modo_recogimiento') === 'true'
  })

  const [customName, setCustomName] = useState('')
  const [isShuffling, setIsShuffling] = useState(false)
  const [shuffleIndex, setShuffleIndex] = useState(0)

  // Save states to localStorage
  useEffect(() => {
    localStorage.setItem('ofrecido_lista_nombres', JSON.stringify(names))
  }, [names])

  useEffect(() => {
    if (activePerson) {
      localStorage.setItem('ofrecido_persona_activa', activePerson)
    } else {
      localStorage.removeItem('ofrecido_persona_activa')
    }
    // Sync with a custom window event for TrackerBar to listen to
    window.dispatchEvent(new Event('active_offering_changed'))
  }, [activePerson])

  useEffect(() => {
    localStorage.setItem('ofrecido_vela_encendida', String(isLit))
    window.dispatchEvent(new Event('active_offering_changed'))
  }, [isLit])

  useEffect(() => {
    localStorage.setItem('ofrecido_modo_recogimiento', String(cozyMode))
  }, [cozyMode])

  const handleLightCandle = () => {
    if (!activePerson.trim()) {
      // Pick a default if none is chosen
      const random = names[Math.floor(Math.random() * names.length)]
      setActivePerson(random)
      setIsLit(true)
    } else {
      setIsLit(!isLit)
    }
  }

  const handleSelectPerson = (name) => {
    setActivePerson(name)
    setCustomName('')
  }

  const handleAddCustomPerson = () => {
    const trimmed = customName.trim()
    if (!trimmed) return
    if (!names.includes(trimmed)) {
      setNames(prev => [...prev, trimmed])
    }
    setActivePerson(trimmed)
    setCustomName('')
  }

  const handleRandomPerson = () => {
    if (names.length === 0 || isShuffling) return
    setIsShuffling(true)
    let count = 0
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * names.length)
      setShuffleIndex(idx)
      count++
      if (count > 12) {
        clearInterval(interval)
        setActivePerson(names[idx])
        setIsShuffling(false)
        // Auto light or keep state
        setIsLit(true)
      }
    }, 60)
  }

  const handleRemovePerson = (nameToRemove) => {
    if (DEFAULT_NAMES.includes(nameToRemove)) {
      alert('Los nombres predeterminados no se pueden eliminar, pero puedes elegir otro.')
      return
    }
    const filtered = names.filter(n => n !== nameToRemove)
    setNames(filtered)
    if (activePerson === nameToRemove) {
      setActivePerson(filtered[0] || '')
      setIsLit(false)
    }
  }

  // Animation CSS
  const animationStyles = `
    @keyframes flameFlicker {
      0%, 100% { transform: scale(1) rotate(-0.5deg) translate(0px, 0px); }
      15% { transform: scale(0.92, 1.08) rotate(1.5deg) translate(0.5px, -1px); }
      30% { transform: scale(1.08, 0.92) rotate(-1.5deg) translate(-0.5px, 0px); }
      45% { transform: scale(0.95, 1.05) rotate(0.8deg) translate(0.2px, -0.5px); }
      60% { transform: scale(1.03, 0.97) rotate(-0.8deg) translate(-0.2px, 0.2px); }
      75% { transform: scale(0.97, 1.03) rotate(1.2deg) translate(0.4px, -0.8px); }
      90% { transform: scale(1.04, 0.96) rotate(-1.2deg) translate(-0.4px, 0px); }
    }

    @keyframes innerFlicker {
      0%, 100% { transform: scale(1) translate(0px, 0px); }
      20% { transform: scale(0.9, 1.1) translate(0.2px, -0.5px); }
      50% { transform: scale(1.1, 0.9) translate(-0.2px, 0.2px); }
      80% { transform: scale(0.95, 1.05) translate(0.1px, -0.2px); }
    }

    @keyframes auraGlow {
      0%, 100% { filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.55)) drop-shadow(0 0 35px rgba(245, 158, 11, 0.3)); }
      50% { filter: drop-shadow(0 0 26px rgba(245, 158, 11, 0.8)) drop-shadow(0 0 50px rgba(245, 158, 11, 0.45)); }
    }

    @keyframes sparkFloat {
      0% { transform: translate(0, 0) scale(1); opacity: 0.8; }
      50% { transform: translate(4px, -15px) scale(0.8); opacity: 0.4; }
      100% { transform: translate(8px, -30px) scale(0.5); opacity: 0; }
    }

    .glow-active {
      animation: auraGlow 2.5s infinite ease-in-out;
    }
  `

  const isCustom = activePerson && !DEFAULT_NAMES.includes(activePerson)

  return (
    <div style={{
      padding: '10px 0',
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: cozyMode ? 'radial-gradient(circle at center, #261208 0%, #0d0603 100%)' : '#fafafa',
      borderRadius: '20px',
      transition: 'all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
      position: 'relative',
      overflow: 'hidden',
      color: cozyMode ? '#f5ebe6' : '#1a1a1a',
      boxShadow: cozyMode ? 'inset 0 0 80px rgba(0,0,0,0.8)' : 'none',
    }}>
      <style>{animationStyles}</style>

      {/* Background stars / dust in Cozy Mode */}
      {cozyMode && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 150px 80px, #f59e0b, rgba(0,0,0,0)), radial-gradient(1px 1px at 300px 240px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 80px 380px, #f59e0b, rgba(0,0,0,0))',
          backgroundRepeat: 'repeat',
          opacity: 0.25,
          pointerEvents: 'none',
        }} />
      )}

      {/* Header controls */}
      <div style={{
        width: '100%',
        maxWidth: '560px',
        padding: '0 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        zIndex: 10,
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.5px',
            color: cozyMode ? '#fef3c7' : '#0f172a',
            transition: 'color 0.4s',
          }}>
            🕯️ Ofrece tu estudio
          </h2>
          <p style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: cozyMode ? '#a78bfa' : '#64748b',
            transition: 'color 0.4s',
          }}>
            Dedica tu esfuerzo MIR a quien te inspire hoy
          </p>
        </div>

        {/* Cozy mode toggle button */}
        <button
          onClick={() => setCozyMode(!cozyMode)}
          title="Alternar Modo Recogimiento"
          style={{
            background: cozyMode ? 'rgba(251, 146, 60, 0.15)' : '#e2e8f0',
            border: cozyMode ? '1px solid rgba(251, 146, 60, 0.4)' : '1px solid #cbd5e1',
            borderRadius: '24px',
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            color: cozyMode ? '#fbd9ad' : '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: cozyMode ? '0 0 15px rgba(251, 146, 60, 0.15)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
        >
          {cozyMode ? '✨ Modo Luz' : '🌌 Modo Recogimiento'}
        </button>
      </div>

      {/* Main Altar: The Candle */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '15px 0 25px',
        position: 'relative',
        height: '280px',
        width: '100%',
        maxWidth: '300px',
        zIndex: 5,
      }}>
        {/* Glow behind the candle in Cozy Mode */}
        {isLit && (
          <div style={{
            position: 'absolute',
            top: '40px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: cozyMode
              ? 'radial-gradient(circle, rgba(245, 158, 11, 0.28) 0%, rgba(242, 101, 34, 0.05) 50%, rgba(0,0,0,0) 80%)'
              : 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none',
            transition: 'all 0.5s',
            zIndex: 1,
          }} />
        )}

        {/* Interactive Candle SVG */}
        <svg
          onClick={handleLightCandle}
          className={isLit ? 'glow-active' : ''}
          width="160"
          height="240"
          viewBox="0 0 160 240"
          style={{
            cursor: 'pointer',
            transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            zIndex: 2,
            overflow: 'visible',
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {/* Flame - Only visible if lit */}
          {isLit && (
            <g style={{ transformOrigin: '80px 70px', animation: 'flameFlicker 1.2s infinite ease-in-out' }}>
              {/* Outer Golden Glow Flame */}
              <path
                d="M80,20 C87,35 94,48 94,59 C94,70 87,74 80,74 C73,74 66,70 66,59 C66,48 73,35 80,20 Z"
                fill={AMBER}
                opacity="0.5"
              />
              {/* Mid Vivid Orange Flame */}
              <path
                d="M80,26 C85,38 90,49 90,58 C90,67 85,71 80,71 C75,71 70,67 70,58 C70,49 75,38 80,26 Z"
                fill={ACCENT}
                opacity="0.8"
                style={{ transformOrigin: '80px 70px', animation: 'innerFlicker 1.8s infinite ease-in-out' }}
              />
              {/* Inner Bright Yellow Core */}
              <path
                d="M80,35 C83,43 86,51 86,57 C86,63 83,66 80,66 C77,66 74,63 74,57 C74,51 77,43 80,35 Z"
                fill="#FEF3C7"
                opacity="0.95"
              />
              {/* Blueish Flame Base */}
              <path
                d="M80,60 C83,60 85,63 85,67 C85,71 82,72 80,72 C78,72 75,71 75,67 C75,63 77,60 80,60 Z"
                fill="#2563EB"
                opacity="0.6"
              />
            </g>
          )}

          {/* Sparks floating upwards (decorations when lit) */}
          {isLit && cozyMode && (
            <g>
              <circle cx="82" cy="20" r="1.5" fill="#fbd9ad" style={{ animation: 'sparkFloat 1.8s infinite ease-in-out' }} />
              <circle cx="76" cy="25" r="1" fill="#fbd9ad" style={{ animation: 'sparkFloat 2.2s infinite ease-in-out 0.4s' }} />
            </g>
          )}

          {/* Unlit Wick (Mecha) - Slightly smoking if just extinguished */}
          <path
            d="M80,70 L80,82"
            stroke={isLit ? '#333' : '#555'}
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Candle Body (Wax) */}
          {/* Main Body */}
          <rect
            x="52"
            y="80"
            width="56"
            height="130"
            rx="12"
            fill={cozyMode ? 'url(#waxGradientDark)' : 'url(#waxGradientLight)'}
            style={{ transition: 'fill 0.4s' }}
          />

          {/* Wax Drips (highly detailed, realistic look) */}
          <path
            d="M52,90 C56,92 59,88 62,88 C65,88 67,96 67,104 C67,112 64,115 64,115 M108,94 C104,95 101,98 98,103 C95,108 96,122 96,122 M76,82 C78,85 81,87 81,95 C81,105 78,114 78,124 C78,130 81,132 81,132"
            fill="none"
            stroke={cozyMode ? '#f0965a' : '#fbd7b5'}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.75"
          />

          {/* Top Wax Melt Indentation */}
          <ellipse
            cx="80"
            cy="82"
            rx="28"
            ry="6"
            fill={cozyMode ? '#a1582c' : '#fbcda1'}
          />

          {/* Liquid Pool of Wax */}
          {isLit && (
            <ellipse
              cx="80"
              cy="83"
              rx="20"
              ry="4"
              fill={AMBER}
              opacity="0.7"
            />
          )}

          {/* Definitions for Gradients */}
          <defs>
            {/* Candle wax gradient in Light Mode */}
            <linearGradient id="waxGradientLight" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.8" />
              <stop offset="10%" stopColor="#fed7aa" />
              <stop offset="35%" stopColor="#ffedd5" />
              <stop offset="70%" stopColor="#fed7aa" />
              <stop offset="100%" stopColor="#f39c12" stopOpacity="0.85" />
            </linearGradient>

            {/* Candle wax gradient in Cozy Dark Mode (warmer glow translucent wax) */}
            <linearGradient id="waxGradientDark" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b45309" stopOpacity="0.95" />
              <stop offset="15%" stopColor="#ea580c" />
              <stop offset="40%" stopColor="#f97316" />
              <stop offset="70%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#9a3412" stopOpacity="0.95" />
            </linearGradient>
          </defs>
        </svg>

        {/* Dedication Badge beneath the candle */}
        {isLit && activePerson && (
          <div style={{
            marginTop: 15,
            background: cozyMode ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
            border: cozyMode ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #fde68a',
            borderRadius: '16px',
            padding: '6px 16px',
            fontSize: 14,
            fontWeight: 700,
            color: cozyMode ? '#fef3c7' : '#d97706',
            boxShadow: cozyMode ? '0 4px 15px rgba(245,158,11,0.1)' : '0 2px 8px rgba(217,119,6,0.06)',
            textAlign: 'center',
            animation: 'auraGlow 2.5s infinite ease-in-out',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>🕯️</span>
            <span>Ofreciendo mi estudio por: <strong>{activePerson}</strong></span>
          </div>
        )}
      </div>

      {/* Main Altar Controls Card */}
      <div style={{
        width: '90%',
        maxWidth: '480px',
        background: cozyMode ? 'rgba(30, 16, 10, 0.65)' : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        border: cozyMode ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid #eaeaea',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: cozyMode ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.05)',
        transition: 'all 0.5s',
        zIndex: 10,
        boxSizing: 'border-box',
      }}>
        {/* Active Person Display & Primary Action */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <button
            onClick={handleLightCandle}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              background: isLit ? '#ef4444' : `linear-gradient(135deg, ${AMBER} 0%, ${ACCENT} 100%)`,
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: isLit
                ? '0 4px 12px rgba(239, 68, 68, 0.2)'
                : '0 4px 15px rgba(242, 101, 34, 0.35)',
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            }}
          >
            {isLit ? '🚫 Apagar vela y pausar ofrenda' : '🔥 Encender vela y ofrecer estudio'}
          </button>
        </div>

        {/* Shuffling (Random Selection) Display */}
        {isShuffling && (
          <div style={{
            background: cozyMode ? 'rgba(251, 146, 60, 0.1)' : '#fffbeb',
            border: cozyMode ? '1px solid rgba(251, 146, 60, 0.3)' : '1px solid #ffe8cc',
            borderRadius: '12px',
            padding: '12px',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: cozyMode ? '#fbd9ad' : '#f26522',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}>
            <span style={{ display: 'inline-block', animation: 'flameFlicker 0.6s infinite linear' }}>🎲</span>
            <span>Buscando inspiración: <strong>{names[shuffleIndex]}</strong></span>
          </div>
        )}

        {/* Selection Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Predefined select list */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: cozyMode ? '#fbd9ad' : '#475569',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Selecciona una persona de tu lista
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={activePerson}
                onChange={(e) => handleSelectPerson(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: cozyMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #cbd5e1',
                  background: cozyMode ? '#221109' : '#fff',
                  color: cozyMode ? '#f5ebe6' : '#1e293b',
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="" disabled>— Seleccionar persona —</option>
                {names.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              {/* Random choice button */}
              <button
                onClick={handleRandomPerson}
                disabled={isShuffling}
                title="Elegir alguien al azar"
                style={{
                  padding: '0 14px',
                  borderRadius: '10px',
                  border: cozyMode ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #cbd5e1',
                  background: cozyMode ? 'rgba(245, 158, 11, 0.15)' : '#f8fafc',
                  color: cozyMode ? '#fbd9ad' : '#1e293b',
                  cursor: 'pointer',
                  fontSize: 16,
                  transition: 'background 0.2s',
                }}
              >
                🎲
              </button>
            </div>
          </div>

          {/* Horizontal divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            color: cozyMode ? '#78350f' : '#cbd5e1',
            margin: '4px 0',
          }}>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid currentColor' }} />
            <span style={{ padding: '0 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>O</span>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid currentColor' }} />
          </div>

          {/* Add custom name input */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 700,
              color: cozyMode ? '#fbd9ad' : '#475569',
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Escribe un nombre nuevo
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="E.g. Tía Isabel, Por los enfermos..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomPerson()}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: cozyMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #cbd5e1',
                  background: cozyMode ? '#221109' : '#fff',
                  color: cozyMode ? '#f5ebe6' : '#1e293b',
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleAddCustomPerson}
                disabled={!customName.trim()}
                style={{
                  padding: '0 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: customName.trim() ? ACCENT : (cozyMode ? '#3c2415' : '#e2e8f0'),
                  color: customName.trim() ? '#fff' : (cozyMode ? '#7c4b2d' : '#94a3b8'),
                  fontWeight: 700,
                  cursor: customName.trim() ? 'pointer' : 'default',
                  fontSize: 13,
                  transition: 'all 0.2s',
                }}
              >
                ✨ Añadir
              </button>
            </div>
          </div>
        </div>

        {/* Delete custom name option (only visible if a custom name is selected) */}
        {isCustom && (
          <div style={{
            marginTop: 16,
            textAlign: 'right',
          }}>
            <button
              onClick={() => handleRemovePerson(activePerson)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              🗑️ Quitar "{activePerson}" de mi lista
            </button>
          </div>
        )}
      </div>

      {/* Mini spiritual motivation quote box */}
      <div style={{
        marginTop: 20,
        maxWidth: '480px',
        width: '90%',
        textAlign: 'center',
        padding: '0 20px',
      }}>
        <p style={{
          margin: 0,
          fontStyle: 'italic',
          fontSize: 12,
          lineHeight: 1.5,
          color: cozyMode ? '#d97706' : '#94a3b8',
          transition: 'color 0.4s',
        }}>
          "El estudio no es solo adquirir conocimientos; ofrecido con cariño por alguien, se convierte en un acto de entrega y generosidad."
        </p>
      </div>
    </div>
  )
}
