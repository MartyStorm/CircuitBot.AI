import React, { useState, useEffect } from 'react';

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/visitor-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading stats...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stats) return <div>No stats available</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>📊 Visitor Analytics</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '5px' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Total Visits</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.totalVisits}</div>
        </div>
        
        <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '5px' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Unique Visitors</div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.uniqueVisitors}</div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Daily Breakdown</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Visits</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.dailyBreakdown)
              .sort()
              .reverse()
              .map(([date, count]) => (
                <tr key={date} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px' }}>{date}</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3>Top Pages</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #333' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Page</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Visits</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.topPages)
              .sort((a, b) => b[1] - a[1])
              .map(([page, count]) => (
                <tr key={page} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '8px' }}>{page || '/'}</td>
                  <td style={{ textAlign: 'right', padding: '8px' }}>{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
}
