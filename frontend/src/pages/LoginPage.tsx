import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { KeyRound, Server, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [managementKey, setManagementKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Test the key by making a simple request
      const response = await fetch('/v0/management/config', {
        headers: {
          'Authorization': `Bearer ${managementKey}`,
        },
      });

      if (response.ok) {
        login(managementKey);
      } else if (response.status === 401 || response.status === 403) {
        setError('Invalid management key');
      } else {
        setError('Failed to connect to server');
      }
    } catch {
      setError('Unable to connect to the proxy server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <Server className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">
            CLI Proxy API
          </h2>
          <p className="mt-2 text-gray-400">
            Management Dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <label htmlFor="management-key" className="block text-sm font-medium text-gray-300 mb-2">
              Management Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-500" />
              </div>
              <input
                id="management-key"
                name="key"
                type="password"
                required
                value={managementKey}
                onChange={(e) => setManagementKey(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Enter your management key"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Use the MANAGEMENT_PASSWORD environment variable or secret-key from config
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 px-4 py-3 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !managementKey}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Connect to Dashboard'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600">
          Make sure the CLI Proxy API server is running with management enabled
        </p>
      </div>
    </div>
  );
}
