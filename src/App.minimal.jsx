import React from 'react';

export default function App() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#1a1a1a',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 24,
      fontWeight: 'bold'
    }}>
      <h1>✅ REACT IS RENDERING!</h1>
      <p style={{ fontSize: 16, opacity: 0.8 }}>Minimal App Component</p>
    </div>
  );
}

