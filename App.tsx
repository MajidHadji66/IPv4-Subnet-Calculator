import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CalculationResult, VlsmCalculationResult, CalculationPayload, VlsmCalculationPayload } from './types';
import ResultsTable from './components/ResultsTable';
import StandardCalculator from './components/StandardCalculator';
import VlsmCalculator from './components/VlsmCalculator';
import Summary from './components/Summary';
import VlsmResults from './components/VlsmResults';
import { workerScript } from './worker';

declare const XLSX: any;

type CalculatorType = 'standard' | 'vlsm';

const App: React.FC = () => {
  const [calculatorType, setCalculatorType] = useState<CalculatorType>('standard');
  const [standardResult, setStandardResult] = useState<CalculationResult | null>(null);
  const [vlsmResult, setVlsmResult] = useState<VlsmCalculationResult | null>(null);
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

  const startWorker = () => {
    if (workerRef.current) {
        workerRef.current.worker.terminate();
        URL.revokeObjectURL(workerRef.current.url);
        workerRef.current = null;
    }
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    workerRef.current = { worker, url: workerUrl };
    return worker;
  }

  const cleanupWorker = () => {
      if (workerRef.current) {
          workerRef.current.worker.terminate();
          URL.revokeObjectURL(workerRef.current.url);
          workerRef.current = null;
      }
  };
  
  const handleCalculate = useCallback((payload: CalculationPayload) => {
    setLoading(true);
    setError(null);
    setStandardResult(null);
    setVlsmResult(null);
    setOriginalIp(payload.ipAddress);

    const worker = startWorker();

    worker.onmessage = (event: MessageEvent<{ result?: CalculationResult; error?: string }>) => {
      const { result, error: workerError } = event.data;
      if (workerError) setError(workerError);
      else if (result) setStandardResult(result);
      setLoading(false);
      cleanupWorker();
    };

    worker.onerror = (event) => {
      setError(`An unexpected error occurred: ${event.message}`);
      setLoading(false);
      cleanupWorker();
    };

    worker.postMessage({ calculator: 'standard', payload });
  }, []);

  const handleVlsmCalculate = useCallback((payload: VlsmCalculationPayload) => {
    setLoading(true);
    setError(null);
    setStandardResult(null);
    setVlsmResult(null);
    
    const worker = startWorker();
    
    worker.onmessage = (event: MessageEvent<{ result?: VlsmCalculationResult; error?: string }>) => {
        const { result, error: workerError } = event.data;
        if (workerError) setError(workerError);
        else if (result) setVlsmResult(result);
        setLoading(false);
        cleanupWorker();
    };

    worker.onerror = (event) => {
        setError(`An unexpected error occurred: ${event.message}`);
        setLoading(false);
        cleanupWorker();
    };

    worker.postMessage({ calculator: 'vlsm', payload });
  }, []);

  const handleExportToExcel = useCallback(() => {
    if (typeof XLSX === 'undefined') return;

    const workbook = XLSX.utils.book_new();
    let filename = 'IPv4_Subnet_Plan.xlsx';

    if (calculatorType === 'standard' && standardResult) {
        const summaryData = [
          ["Calculation Summary", ""],
          ["Original IP Address", originalIp],
          ["IP Class", standardResult.ipClass],
          ["Default Mask", standardResult.defaultMask],
          ["Subnet Mask", standardResult.subnetMask],
          ["CIDR Notation", `/${standardResult.cidr}`],
          ["Total Subnets", standardResult.totalSubnets],
          ["Usable Hosts per Subnet", standardResult.hostsPerSubnet],
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(summaryData);

        const subnetTableData = [['Subnet', 'Network Address', 'Usable Host Range', 'Broadcast Address']];
        standardResult.subnets.forEach(subnet => {
            subnetTableData.push([`Subnet ${subnet.id}`, subnet.networkAddress, subnet.usableHostRange, subnet.broadcastAddress]);
        });

        XLSX.utils.sheet_add_aoa(worksheet, subnetTableData, { origin: 'A10' });
        worksheet['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 35 }, { wch: 20 }];
        worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Subnet Plan');
        filename = `IPv4_Subnet_Plan_${originalIp.replace(/\./g, '_')}_${standardResult.cidr}.xlsx`;

    } else if (calculatorType === 'vlsm' && vlsmResult) {
        const summaryData = [
            ["VLSM Calculation Summary", ""],
            ["Base Network", vlsmResult.baseNetwork],
            ["Total Hosts in Block", vlsmResult.totalHostsInBlock],
            ["Total Required Hosts", vlsmResult.totalRequiredHosts],
            ["Total Allocated Hosts", vlsmResult.totalAllocatedHosts],
            ["Address Utilization Efficiency", `${vlsmResult.efficiency.toFixed(2)}%`],
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(summaryData);

        const subnetTableData = [['Subnet Name', 'Required Hosts', 'Allocated Hosts', 'Network Address', 'Subnet Mask', 'CIDR', 'Usable Host Range', 'Broadcast Address']];
        vlsmResult.allocatedSubnets.forEach(subnet => {
            // Fix: Convert numbers to strings to avoid type errors when pushing to subnetTableData.
            subnetTableData.push([
                subnet.name, String(subnet.requiredHosts), String(subnet.allocatedHosts), subnet.networkAddress,
                subnet.subnetMask, `/${subnet.cidr}`, subnet.usableHostRange, subnet.broadcastAddress
            ]);
        });

        XLSX.utils.sheet_add_aoa(worksheet, [['Allocated Subnets']], { origin: 'A8' });
        XLSX.utils.sheet_add_aoa(worksheet, subnetTableData, { origin: 'A9' });

        worksheet['!cols'] = [
          { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
          { wch: 10 }, { wch: 40 }, { wch: 20 }
        ];
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
            { s: { r: 7, c: 0 }, e: { r: 7, c: 7 } }
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'VLSM Plan');
        filename = `VLSM_Plan_${vlsmResult.baseNetwork.replace(/[./]/g, '_')}.xlsx`;
    }
    
    if (workbook.SheetNames.length > 0) {
      XLSX.writeFile(workbook, filename);
    }
  }, [standardResult, vlsmResult, originalIp, calculatorType]);
  
  const renderResults = () => {
      if(error) {
          return (
              <div className="mt-6 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg text-center animate-pulse">
                  {error}
              </div>
          );
      }
      if (!standardResult && !vlsmResult) return null;

      const canExport = (calculatorType === 'standard' && standardResult) || (calculatorType === 'vlsm' && vlsmResult);

      return (
          <div className="mt-8 pt-6 border-t border-gray-700">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">Calculation Results</h2>
                {canExport && (
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
                )}
              </div>

              {standardResult && calculatorType === 'standard' && (
                  <>
                      <Summary result={standardResult} />
                      <ResultsTable subnets={standardResult.subnets} />
                  </>
              )}
              {vlsmResult && calculatorType === 'vlsm' && (
                  <VlsmResults result={vlsmResult} />
              )}
          </div>
      )
  }
  
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
            <div className="mb-6 border-b border-gray-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                        onClick={() => { setCalculatorType('standard'); setError(null); setVlsmResult(null); setStandardResult(null); }}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            calculatorType === 'standard' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                        }`}
                    >
                        Standard Calculator
                    </button>
                    <button
                        onClick={() => { setCalculatorType('vlsm'); setError(null); setStandardResult(null); setVlsmResult(null); }}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                            calculatorType === 'vlsm' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                        }`}
                    >
                        VLSM Calculator
                    </button>
                </nav>
            </div>

            {calculatorType === 'standard' && <StandardCalculator onCalculate={handleCalculate} loading={loading}/>}
            {calculatorType === 'vlsm' && <VlsmCalculator onCalculate={handleVlsmCalculate} loading={loading} />}
            
            {(loading) ? (
                <div className="mt-8 pt-6 border-t border-gray-700 text-center">
                    <div className="flex justify-center items-center">
                        <svg className="animate-spin mr-3 h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="text-lg text-gray-300">Calculating, please wait...</p>
                    </div>
                </div>
            ) : renderResults()
            }
        </main>
      </div>
      <footer className="w-full max-w-4xl mx-auto text-center py-6 text-gray-500 text-sm border-t border-gray-700">
        <p>&copy; {new Date().getFullYear()} Majid hadji. All Rights Reserved.</p>
      </footer>
    </div>
  );
};

export default App;
