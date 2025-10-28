import React, { useState, useCallback } from 'react';
import { CalculationMode, CalculationResult } from './types';
import { calculateSubnetting } from './services/subnetCalculator';
import ResultsTable from './components/ResultsTable';

const App: React.FC = () => {
  const [ipAddress, setIpAddress] = useState<string>('192.168.1.0');
  const [calculationMode, setCalculationMode] = useState<CalculationMode>(CalculationMode.SUBNETS);
  const [value, setValue] = useState<string>('4');
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFormValid = () => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ipAddress)) return false;

    if (calculationMode === CalculationMode.MASK) {
      // Basic validation for mask/CIDR. More thorough validation is in the service.
      const cidrRegex = /^\/?(\d{1,2})$/;
      const maskRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      return cidrRegex.test(value) || maskRegex.test(value);
    } else {
      const numValue = parseInt(value, 10);
      return !isNaN(numValue) && numValue > 0;
    }
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) {
      setError("Please enter a valid IP address and a valid value for the selected mode.");
      setResult(null);
      return;
    }
    try {
      setError(null);
      const calcValue = calculationMode === CalculationMode.MASK ? value : parseInt(value, 10);
      const calcResult = calculateSubnetting(ipAddress, calculationMode, calcValue);
      setResult(calcResult);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }
      setResult(null);
    }
  }, [ipAddress, calculationMode, value]);

  const ModeSelector: React.FC = () => (
    <div className="flex bg-gray-700 rounded-lg p-1">
      <button
        onClick={() => { setCalculationMode(CalculationMode.SUBNETS); setValue('4'); }}
        className={`w-1/3 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
          calculationMode === CalculationMode.SUBNETS ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
        }`}
      >
        Subnets
      </button>
      <button
        onClick={() => { setCalculationMode(CalculationMode.HOSTS); setValue('14'); }}
        className={`w-1/3 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
          calculationMode === CalculationMode.HOSTS ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
        }`}
      >
        Hosts
      </button>
      <button
        onClick={() => { setCalculationMode(CalculationMode.MASK); setValue('/26'); }}
        className={`w-1/3 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 ${
          calculationMode === CalculationMode.MASK ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
        }`}
      >
        Subnet Mask
      </button>
    </div>
  );
  
  const getLabel = () => {
    switch (calculationMode) {
      case CalculationMode.SUBNETS:
        return 'Required Subnets';
      case CalculationMode.HOSTS:
        return 'Required Hosts per Subnet';
      case CalculationMode.MASK:
        return 'Subnet Mask / CIDR';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-4xl mx-auto flex-grow">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
            IPv4 Subnet Calculator
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Calculate subnets based on the number of hosts, networks, or a custom mask.
          </p>
        </header>

        <main className="bg-gray-800 shadow-2xl rounded-xl p-6 sm:p-8 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="ipAddress" className="block text-sm font-medium text-gray-300 mb-2">
                  IP Address
                </label>
                <input
                  type="text"
                  id="ipAddress"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="e.g., 192.168.1.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Calculate By
                </label>
                <ModeSelector />
              </div>
            </div>
            
            <div>
              <label htmlFor="value" className="block text-sm font-medium text-gray-300 mb-2">
                {getLabel()}
              </label>
              <input
                type={calculationMode === CalculationMode.MASK ? 'text' : 'number'}
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                min={calculationMode !== CalculationMode.MASK ? "1" : undefined}
                placeholder={calculationMode === CalculationMode.MASK ? "e.g., 255.255.255.192 or /26" : ""}
              />
            </div>
            
            <button
              type="submit"
              disabled={!isFormValid()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
            >
              Calculate
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg text-center">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-8 pt-6 border-t border-gray-700">
              <h2 className="text-2xl font-semibold text-center mb-6">Calculation Results</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Subnet Mask</p>
                  <p className="font-mono text-lg">{result.subnetMask}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">CIDR Notation</p>
                  <p className="font-mono text-lg">/{result.cidr}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Total Subnets</p>
                  <p className="font-mono text-lg">{result.totalSubnets}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-400">Usable Hosts</p>
                  <p className="font-mono text-lg">{result.hostsPerSubnet}</p>
                </div>
              </div>
              <ResultsTable subnets={result.subnets} />
            </div>
          )}
        </main>
      </div>
      <footer className="w-full max-w-4xl mx-auto text-center py-6 text-gray-500 text-sm border-t border-gray-700">
        <p>&copy; {new Date().getFullYear()} Majid hadji. All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default App;
