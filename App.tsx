import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CalculationResult, CalculationPayload } from './types';
import ResultsTable from './components/ResultsTable';
import StandardCalculator from './components/StandardCalculator';
import Summary from './components/Summary';
import { workerScript } from './worker';

declare const XLSX: any;

const App: React.FC = () => {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [originalIp, setOriginalIp] = useState<string>('');
  const workerRef = useRef<{ worker: Worker; url: string } | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.worker.terminate();
        URL.revokeObjectURL(workerRef.current.url);
      }
    };
  }, []);
  
  const handleCalculate = useCallback((payload: CalculationPayload) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setOriginalIp(payload.ipAddress);

    if (workerRef.current) {
      workerRef.current.worker.terminate();
      URL.revokeObjectURL(workerRef.current.url);
      workerRef.current = null;
    }
    
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    workerRef.current = { worker, url: workerUrl };

    const cleanupWorker = () => {
        if (workerRef.current) {
            workerRef.current.worker.terminate();
            URL.revokeObjectURL(workerRef.current.url);
            workerRef.current = null;
        }
    };

    worker.onmessage = (event: MessageEvent<{ result?: CalculationResult; error?: string }>) => {
      const { result: workerResult, error: workerError } = event.data;
      if (workerError) {
        setError(workerError);
      } else if (workerResult) {
        setResult(workerResult);
      }
      setLoading(false);
      cleanupWorker();
    };

    worker.onerror = (event) => {
      setError(`An unexpected error occurred in the calculation worker: ${event.message}`);
      setLoading(false);
      cleanupWorker();
    };

    worker.postMessage(payload);
  }, []);

  const handleExportToExcel = useCallback(() => {
    if (!result || !result.subnets || typeof XLSX === 'undefined' || !originalIp) return;

    const summaryData = [
      ["Calculation Summary", ""],
      ["Original IP Address", originalIp],
      ["IP Class", result.ipClass],
      ["Default Mask", result.defaultMask],
      ["Subnet Mask", result.subnetMask],
      ["CIDR Notation", `/${result.cidr}`],
      ["Total Subnets", result.totalSubnets],
      ["Usable Hosts per Subnet", result.hostsPerSubnet],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(summaryData);

    const subnetTableData = [
        ['Subnet', 'Network Address', 'Usable Host Range', 'Broadcast Address']
    ];

    result.subnets.forEach(subnet => {
        subnetTableData.push([
            `Subnet ${subnet.id}`,
            subnet.networkAddress,
            subnet.usableHostRange,
            subnet.broadcastAddress
        ]);
    });

    XLSX.utils.sheet_add_aoa(worksheet, subnetTableData, {
      origin: 'A10',
    });

    const columnWidths = [
      { wch: 25 }, 
      { wch: 25 }, 
      { wch: 35 }, 
      { wch: 20 }, 
    ];
    worksheet['!cols'] = columnWidths;

    if (worksheet['!merges']) {
        worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });
    } else {
        worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    }
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Subnet Plan');
    
    const filename = `IPv4_Subnet_Plan_${originalIp.replace(/\./g, '_')}_${result.cidr}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }, [result, originalIp]);
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="w-full max-w-4xl mx-auto flex-grow">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
            IPv4 Subnet Calculator
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            A simple and elegant tool for all your IPv4 subnetting needs.
          </p>
        </header>

        <main className="bg-gray-800 shadow-2xl rounded-xl p-6 sm:p-8 mb-8">
          <StandardCalculator onCalculate={handleCalculate} loading={loading}/>

          {error && (
            <div className="mt-6 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg text-center">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-8 pt-6 border-t border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Calculation Results</h2>
                <button
                  onClick={handleExportToExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 flex items-center gap-2 text-sm"
                  aria-label="Export results to Excel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L11 12.586V3a1 1 0 112 0v9.586l3.293-3.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Export to Excel
                </button>
              </div>

              <Summary result={result} />
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