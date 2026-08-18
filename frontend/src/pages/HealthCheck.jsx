import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

export default function HealthCheck() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((res) => res.json())
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">FlowBoard</h1>
        <p className="mt-1 text-sm text-slate-500">Estado de conexión a las bases de datos</p>

        {error && <p className="mt-4 text-sm text-red-600">Error: {error}</p>}

        {status && (
          <ul className="mt-4 space-y-1 text-sm">
            <li className={status.postgres === 'up' ? 'text-green-600' : 'text-red-600'}>
              PostgreSQL: {status.postgres}
            </li>
            <li className={status.mongo === 'up' ? 'text-green-600' : 'text-red-600'}>
              MongoDB: {status.mongo}
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
