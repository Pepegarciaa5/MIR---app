import React, { useEffect, useState } from 'react';
import conceptosClaveMock from '../data/conceptosClaveMock';

const EstudioConceptosClave = () => {
  const [conceptos, setConceptos] = useState(conceptosClaveMock); // Usar datos mock directamente
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % conceptos.length);
  };

  if (conceptos.length === 0) {
    return <div>Cargando conceptos clave...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
      <h1>Estudio de Conceptos Clave</h1>
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: '8px',
          padding: '20px',
          margin: '20px 0',
          width: '80%',
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <p>{conceptos[currentIndex].afirmacion}</p>
      </div>
      <button onClick={handleNext} style={{ padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>
        Siguiente
      </button>
    </div>
  );
};

export default EstudioConceptosClave;