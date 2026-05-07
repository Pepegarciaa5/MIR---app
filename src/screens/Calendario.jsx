import React, { useState } from 'react';
import './Calendario.css';
import { tareasPendientesGlobal, planesCalendarioGlobal, planesAdicionales, persistData, todayStr } from '../data/mockData';

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date()); // Hoy por defecto
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [updateTrigger, setUpdateTrigger] = useState(0); // Forzar renderizado al borrar

  const eliminarPendiente = (idx) => {
    if (window.confirm("¿Seguro que quieres eliminar esta tarea pendiente permanentemente?")) {
      tareasPendientesGlobal.splice(idx, 1);
      persistData();
      setUpdateTrigger(prev => prev + 1);
    }
  };

  const getDurationMins = (inicio, fin) => {
    if (!inicio || !fin) return 60;
    const s = inicio.split(':');
    const e = fin.split(':');
    return (parseInt(e[0]) * 60 + parseInt(e[1])) - (parseInt(s[0]) * 60 + parseInt(s[1]));
  };

  const getDurationText = (inicio, fin) => {
    const mins = getDurationMins(inicio, fin);
    const hrs = mins / 60;
    return Number.isInteger(hrs) ? `${hrs}h` : `${hrs.toFixed(1).replace('.', ',')}h`;
  };

  const pedirHoraInicio = (task) => {
    const durMins = getDurationMins(task.inicio, task.fin);
    const start = window.prompt(`Duración calculada: ${getDurationText(task.inicio, task.fin)}\n\n¿A qué hora quieres empezar la tarea? (Formato HH:MM)`, "16:00");
    if (!start) return null;
    
    if (!/^\d{1,2}:\d{2}$/.test(start)) {
      alert("Formato inválido. Usa HH:MM (ejemplo: 08:30 o 16:00)");
      return null;
    }
    
    const [h, m] = start.split(':').map(Number);
    const endMins = h * 60 + m + durMins;
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;
    const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    
    return { inicio: start.padStart(5, '0'), fin: endStr };
  };

  const autoAsignar = (idx) => {
    const task = tareasPendientesGlobal[idx];
    const today = new Date();
    let assignedDate = null;
    
    for (let i = 1; i <= 30; i++) {
      const futureDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const y = futureDate.getFullYear();
      const m = String(futureDate.getMonth() + 1).padStart(2, '0');
      const d = String(futureDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const dayOfWeek = futureDate.getDay();
      
      if (dayOfWeek === 0 || !planesCalendarioGlobal[dateStr]) {
        assignedDate = dateStr;
        break;
      }
    }
    
    if (assignedDate) {
      const isConfirmed = window.confirm(
        `✨ Hueco encontrado: ${assignedDate}\n\n¿Deseas asignar la tarea "${task.titulo}" a este día libre?`
      );
      
      if (isConfirmed) {
        const horas = pedirHoraInicio(task);
        if (!horas) return;

        if (!planesAdicionales[assignedDate]) planesAdicionales[assignedDate] = [];
        planesAdicionales[assignedDate].push({ ...task, inicio: horas.inicio, fin: horas.fin, id: Date.now() });
        tareasPendientesGlobal.splice(idx, 1);
        persistData();
        setUpdateTrigger(prev => prev + 1);
      }
    } else {
      alert("No se ha encontrado un hueco libre en los próximos 30 días.");
    }
  };

  const handleDropTask = (idx, targetDate) => {
    const task = tareasPendientesGlobal[idx];
    if (!task) return;
    
    const horas = pedirHoraInicio(task);
    if (!horas) return;

    if (!planesAdicionales[targetDate]) planesAdicionales[targetDate] = [];
    planesAdicionales[targetDate].push({ ...task, inicio: horas.inicio, fin: horas.fin, id: Date.now() });
    tareasPendientesGlobal.splice(idx, 1);
    persistData();
    setUpdateTrigger(prev => prev + 1);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const toISO = (y, m, d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const getCalendarDays = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1;

    const days = [];
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    for (let i = startDay - 1; i >= 0; i--) {
      const dt = new Date(year, month, -(i));
      days.push(toISO(dt.getFullYear(), dt.getMonth()+1, dt.getDate()));
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(toISO(year, month+1, i));
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const dt = new Date(year, month+1, i);
      days.push(toISO(dt.getFullYear(), dt.getMonth()+1, dt.getDate()));
    }

    return days;
  };

  const getWeekDays = () => {
    const dayOfWeek = currentDate.getDay(); // 0 is Sunday
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // days since Monday
    const monday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - diff);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const dayNum = String(dt.getDate()).padStart(2, '0');
      weekDays.push({
        dateStr: toISO(dt.getFullYear(), dt.getMonth()+1, dt.getDate()),
        label: `${DAYS_OF_WEEK[i]} ${dayNum}`
      });
    }
    return weekDays;
  };

  const days = getCalendarDays();
  const weekDays = getWeekDays();

  const prevRange = () => {
    if (viewMode === 'month') setCurrentDate(new Date(year, month - 1, 1));
    else setCurrentDate(new Date(year, month, currentDate.getDate() - 7));
  };
  const nextRange = () => {
    if (viewMode === 'month') setCurrentDate(new Date(year, month + 1, 1));
    else setCurrentDate(new Date(year, month, currentDate.getDate() + 7));
  };

  return (
    <div className="calendario-container" style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.5px' }}>📚 Calendario de Estudio</h1>
          <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Planificación CTO</p>
        </div>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 4 }}>
            <button
              onClick={() => setViewMode('month')}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                background: viewMode === 'month' ? '#fff' : 'transparent',
                color: viewMode === 'month' ? '#0f172a' : '#64748b',
                boxShadow: viewMode === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: '0.2s'
              }}
            >
              Mes
            </button>
            <button
              onClick={() => setViewMode('week')}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                background: viewMode === 'week' ? '#fff' : 'transparent',
                color: viewMode === 'week' ? '#0f172a' : '#64748b',
                boxShadow: viewMode === 'week' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: '0.2s'
              }}
            >
              Semana
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', padding: '6px 12px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <button onClick={prevRange} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 8px', color: '#64748b' }}>&lt;</button>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', minWidth: 150, textAlign: 'center' }}>
              {viewMode === 'month' ? `${MONTH_NAMES[month]} ${year}` : `Semana del ${weekDays[0].label.split(' ')[1]} ${MONTH_NAMES[parseInt(weekDays[0].dateStr.split('-')[1])-1].substring(0,3)}`}
            </div>
            <button onClick={nextRange} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 8px', color: '#64748b' }}>&gt;</button>
          </div>
        </div>
      </div>

      {tareasPendientesGlobal.length > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 12, padding: '16px', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#c2410c', display: 'flex', alignItems: 'center', gap: 8 }}>
            📥 Tareas Pendientes No Asignadas
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tareasPendientesGlobal.map((t, idx) => (
              <div 
                key={idx} 
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('taskIndex', idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                style={{ background: '#fff', border: '1px solid #fed7aa', padding: '8px 12px', borderRadius: 8, fontSize: 13, color: '#9a3412', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'grab' }}
              >
                <span style={{ marginRight: 4, opacity: 0.5 }}>⠿</span>
                {t.titulo}
                <span style={{ fontSize: 11, fontWeight: 400, color: '#fdba74' }}>({getDurationText(t.inicio, t.fin)})</span>
                <button
                  onClick={() => autoAsignar(idx)}
                  style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#d97706', cursor: 'pointer', marginLeft: 6, padding: '4px 8px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, transition: '0.2s' }}
                  title="Auto-asignar a un hueco libre"
                >
                  ✨ Auto-asignar
                </button>
                <button
                  onClick={() => eliminarPendiente(idx)}
                  style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', marginLeft: 4, padding: '2px 4px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                  title="Eliminar tarea"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'month' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, background: '#f8fafc', padding: 12, borderRadius: 16, overflowX: 'auto' }}>
          {DAYS_OF_WEEK.map(d => (
            <div key={d} style={{ textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: 13, padding: '8px 0' }}>
              {d}
            </div>
          ))}
          {days.map((dateStr, index) => {
            const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
            const isCurrentMonth = dateStr.startsWith(currentMonthStr);
            const isToday = dateStr === todayStr;
            const plan = planesCalendarioGlobal[dateStr] || [];
            const adic = planesAdicionales[dateStr] || [];
            const totalPlan = [...plan, ...adic];

            return (
              <div 
                key={index} 
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskIndex = e.dataTransfer.getData('taskIndex');
                  if (taskIndex !== '') handleDropTask(taskIndex, dateStr);
                }}
                style={{
                  background: isToday ? '#eff6ff' : (isCurrentMonth ? '#fff' : '#f1f5f9'),
                  border: isToday ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: 8,
                  minHeight: 120,
                  padding: 6,
                  opacity: isCurrentMonth || isToday ? 1 : 0.4,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isCurrentMonth ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: isToday ? '#2563eb' : (isCurrentMonth ? '#1e293b' : '#94a3b8'), marginBottom: 6, textAlign: 'right', paddingRight: 4 }}>
                  {isToday ? `Hoy ${dateStr.split('-')[2]}` : dateStr.split('-')[2]}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {totalPlan.map((session, idx) => {
                    let bg = '#e0e7ff', border = '#6366f1', color = '#3730a3';
                    if (session.titulo.includes('Streaming') || session.titulo.includes('Simulacro')) { bg = '#ffedd5'; border = '#f97316'; color = '#9a3412'; }
                    else if (session.titulo.includes('Estudio') || session.titulo.includes('Repaso')) { bg = '#f3e8ff'; border = '#a855f7'; color = '#6b21a8'; }
                    
                    return (
                      <div key={session.id || idx} style={{
                        fontSize: 9,
                        lineHeight: 1.2,
                        background: bg,
                        color: color,
                        padding: '4px 6px',
                        borderRadius: 4,
                        borderLeft: `2px solid ${border}`
                      }}>
                        <strong style={{ display: 'block', marginBottom: 2 }}>{session.inicio}-{session.fin}</strong>
                        {session.titulo}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: '#f8fafc' }} />
          {weekDays.map(w => {
            const isToday = w.dateStr === todayStr;
            return (
            <div key={w.dateStr} style={{ textAlign: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', background: isToday ? '#eff6ff' : '#f8fafc', fontWeight: 700, color: isToday ? '#2563eb' : '#475569', fontSize: 13 }}>
              {w.label}
              {isToday && <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 2 }}>Hoy</div>}
            </div>
            )
          })}
          
          <div style={{ position: 'relative', height: 14 * 60, borderRight: '1px solid #e2e8f0' }}>
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} style={{ height: 60, borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
                <span style={{ position: 'absolute', top: -8, right: 8, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{i + 8}:00</span>
              </div>
            ))}
          </div>

          {weekDays.map((w, colIdx) => {
            const isToday = w.dateStr === todayStr;
            const plan = planesCalendarioGlobal[w.dateStr] || [];
            const adic = planesAdicionales[w.dateStr] || [];
            const totalPlan = [...plan, ...adic];

            return (
              <div 
                key={w.dateStr} 
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskIndex = e.dataTransfer.getData('taskIndex');
                  if (taskIndex !== '') handleDropTask(taskIndex, w.dateStr);
                }}
                style={{ position: 'relative', height: 14 * 60, borderRight: colIdx < 6 ? '1px solid #e2e8f0' : 'none', background: isToday ? '#f8fafc' : 'transparent' }}
              >
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} style={{ height: 60, borderBottom: '1px solid #f1f5f9' }} />
                ))}
                
                {totalPlan.map((session, idx) => {
                  const startParts = session.inicio.split(':');
                  const endParts = session.fin.split(':');
                  const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]) - 8 * 60;
                  const endMins = parseInt(endParts[0]) * 60 + parseInt(endParts[1]) - 8 * 60;
                  
                  const top = startMins;
                  const height = Math.max(endMins - startMins, 20); // Minimum height

                  let bg = '#e0e7ff', border = '#6366f1', color = '#3730a3';
                  if (session.titulo.includes('Streaming') || session.titulo.includes('Simulacro')) { bg = '#ffedd5'; border = '#f97316'; color = '#9a3412'; }
                  else if (session.titulo.includes('Estudio') || session.titulo.includes('Repaso') || session.titulo.includes('Margen')) { bg = '#f3e8ff'; border = '#a855f7'; color = '#6b21a8'; }
                  
                  return (
                    <div key={session.id || idx} style={{
                      position: 'absolute',
                      top,
                      height,
                      left: 4,
                      right: 4,
                      background: bg,
                      color: color,
                      padding: '4px 6px',
                      borderRadius: 6,
                      borderLeft: `3px solid ${border}`,
                      fontSize: 10,
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <strong style={{ marginBottom: 2 }}>{session.inicio}-{session.fin}</strong>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{session.titulo}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
