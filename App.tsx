import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CalculationMode, CalculationResult } from './types';
import ResultsTable from './components/ResultsTable';

const workerScript = `
  const ipToBigInt = (ip) => {
    return ip.split('.').reduce((acc, octet) => (acc << 8n) + BigInt(parseInt(octet, 10)), 0n);
  };
  const bigIntToIp = (ipInt) => {
    return Array.from({ length: 4 }, (_, i) => (ipInt >> BigInt(8 * (3 - i))) & 255n).join('.');
  };
  const getIpClassInfo = (ip) => {
    const firstOctet = parseInt(ip.split('.')[0], 10);
    if (firstOctet >= 1 && firstOctet <= 126) return { class: 'A', defaultMaskBits: 8, networkBits: 8, hostBits: 24 };
    if (firstOctet >= 128 && firstOctet <= 191) return { class: 'B', defaultMaskBits: 16, networkBits: 16, hostBits: 16 };
    if (firstOctet >= 192 && firstOctet <= 223) return { class: 'C', defaultMaskBits: 24, networkBits: 24, hostBits: 8 };
    if (firstOctet >= 224 && firstOctet <= 239) return { class: 'D', defaultMaskBits: 0, networkBits: 0, hostBits: 0 };
    return { class: 'E', defaultMaskBits: 0, networkBits: 0, hostBits: 0 };
  };
  const maskToCidr = (mask) => {
    const maskInt = ipToBigInt(mask);
    const binaryString = maskInt.toString(2).padStart(32, '0');
    if (binaryString.includes('01')) {
      throw new Error(\`Invalid subnet mask: \${mask}. Must have contiguous 1s followed by 0s.\`);
    }
    const cidr = binaryString.indexOf('0');
    return cidr === -1 ? 32 : cidr;
  };
  const parseMask = (maskValue) => {
    let cleanMaskValue = maskValue.trim();
    if (cleanMaskValue.startsWith('/')) {
      cleanMaskValue = cleanMaskValue.substring(1);
    }
    if (!isNaN(parseInt(cleanMaskValue, 10)) && !cleanMaskValue.includes('.')) {
      const cidr = parseInt(cleanMaskValue, 10);
      if (cidr < 0 || cidr > 32) {
        throw new Error(\`Invalid CIDR value: /\${cidr}. Must be between 0 and 32.\`);
      }
      return cidr;
    } else if (cleanMaskValue.includes('.')) {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(cleanMaskValue)) {
        throw new Error(\`Invalid subnet mask format: \${cleanMaskValue}.\`);
      }
      return maskToCidr(cleanMaskValue);
    }
    throw new Error(\`Unrecognized mask format: \${maskValue}.\`);
  };
  const calculateSubnetting = (ipAddress, mode, value) => {
    const classInfo = getIpClassInfo(ipAddress);
    if (classInfo.class === 'D' || classInfo.class === 'E') {
      throw new Error(\`IP address \${ipAddress} is in Class \${classInfo.class} and cannot be subnetted.\`);
    }
    let subnetBits = 0;
    let newCidr = 0;
    if (mode === 'subnets') {
      if (typeof value !== 'number' || value <= 0) throw new Error("Number of subnets must be a positive number.");
      subnetBits = Math.ceil(Math.log2(value));
      newCidr = classInfo.defaultMaskBits + subnetBits;
    } else if (mode === 'hosts') {
      if (typeof value !== 'number' || value <= 0) throw new Error("Number of hosts must be a positive number.");
      const requiredHostBits = Math.ceil(Math.log2(value + 2));
      if (requiredHostBits > classInfo.hostBits) {
        throw new Error(\`Not enough host bits in Class \${classInfo.class} for \${value} hosts.\`);
      }
      subnetBits = classInfo.hostBits - requiredHostBits;
      newCidr = classInfo.defaultMaskBits + subnetBits;
    } else { // 'mask'
      if (typeof value !== 'string') throw new Error("Subnet mask must be a string.");
      newCidr = parseMask(value);
      if (newCidr < classInfo.defaultMaskBits) {
        throw new Error(\`Provided mask /\${newCidr} is smaller than the default mask /\${classInfo.defaultMaskBits} for a Class \${classInfo.class} address.\`);
      }
      subnetBits = newCidr - classInfo.defaultMaskBits;
    }
    if (newCidr > 32) {
      throw new Error('The resulting CIDR mask cannot be larger than /32.');
    }
    if (subnetBits > 16) {
      throw new Error(\`This calculation would generate over 100,000 subnets (\${(2 ** subnetBits).toLocaleString()}), which is too large for this tool.\`);
    }
    const newMaskInt = (0xffffffffn << BigInt(32 - newCidr)) & 0xffffffffn;
    const defaultMaskInt = (0xffffffffn << BigInt(32 - classInfo.defaultMaskBits)) & 0xffffffffn;
    const totalSubnets = 2 ** subnetBits;
    const hostsPerSubnet = (2 ** (32 - newCidr)) - 2;
    const ipInt = ipToBigInt(ipAddress);
    const originalMaskInt = (0xffffffffn << BigInt(32 - classInfo.defaultMaskBits)) & 0xffffffffn;
    const baseNetworkAddressInt = ipInt & originalMaskInt;
    const subnets = [];
    const increment = 1n << BigInt(32 - newCidr);
    for (let i = 0; i < totalSubnets; i++) {
      const currentSubnetInt = baseNetworkAddressInt + (BigInt(i) * increment);
      const broadcastAddressInt = currentSubnetInt + increment - 1n;
      const startHost = currentSubnetInt + 1n;
      const endHost = broadcastAddressInt - 1n;
      subnets.push({
        id: i + 1,
        networkAddress: bigIntToIp(currentSubnetInt),
        usableHostRange: startHost > endHost ? 'N/A' : \`\${bigIntToIp(startHost)} - \${bigIntToIp(endHost)}\`,
        broadcastAddress: bigIntToIp(broadcastAddressInt),
      });
    }
    return {
      ipClass: classInfo.class,
      defaultMask: bigIntToIp(defaultMaskInt),
      subnetMask: bigIntToIp(newMaskInt),
      cidr: newCidr,
      totalSubnets: totalSubnets,
      hostsPerSubnet: hostsPerSubnet < 0 ? 0 : hostsPerSubnet,
      subnets: subnets,
    };
  };

  self.onmessage = (e) => {
    try {
      const { ipAddress, calculationMode, value } = e.data;
      const result = calculateSubnetting(ipAddress, calculationMode, value);
      self.postMessage({ result });
    } catch (err) {
      if (err instanceof Error) {
        self.postMessage({ error: err.message });
      } else {
        self.postMessage({ error: 'An unknown error occurred in the worker.' });
      }
    }
  };
`;

// Helper functions for validation
const getIpClassInfo = (ip: string) => {
  const firstOctet = parseInt(ip.split('.')[0], 10);
  if (firstOctet >= 1 && firstOctet <= 126) return { class: 'A', defaultMaskBits: 8, hostBits: 24 };
  if (firstOctet >= 128 && firstOctet <= 191) return { class: 'B', defaultMaskBits: 16, hostBits: 16 };
  if (firstOctet >= 192 && firstOctet <= 223) return { class: 'C', defaultMaskBits: 24, hostBits: 8 };
  if (firstOctet >= 224 && firstOctet <= 239) return { class: 'D' };
  return { class: 'E' };
};

const ipToBigInt = (ip: string): bigint => {
    return ip.split('.').reduce((acc, octet) => (acc << 8n) + BigInt(parseInt(octet, 10)), 0n);
};

const maskToCidr = (mask: string): number => {
    const maskInt = ipToBigInt(mask);
    const binaryString = maskInt.toString(2).padStart(32, '0');
    if (binaryString.includes('01')) throw new Error("Invalid subnet mask");
    const cidr = binaryString.indexOf('0');
    return cidr === -1 ? 32 : cidr;
};

const parseMask = (maskValue: string): number => {
    let cleanMaskValue = maskValue.trim();
    if (cleanMaskValue.startsWith('/')) cleanMaskValue = cleanMaskValue.substring(1);
    if (!isNaN(parseInt(cleanMaskValue, 10)) && !cleanMaskValue.includes('.')) {
        const cidr = parseInt(cleanMaskValue, 10);
        if (cidr < 0 || cidr > 32) throw new Error("Invalid CIDR");
        return cidr;
    } else if (cleanMaskValue.includes('.')) {
        return maskToCidr(cleanMaskValue);
    }
    throw new Error("Invalid mask format");
};

interface StandardCalculatorProps {
  onCalculate: (payload: any) => void;
  loading: boolean;
}

const StandardCalculator: React.FC<StandardCalculatorProps> = ({ onCalculate, loading }) => {
  const [ipAddress, setIpAddress] = useState<string>('192.168.1.0');
  const [calculationMode, setCalculationMode] = useState<CalculationMode>(CalculationMode.SUBNETS);
  const [value, setValue] = useState<string>('4');
  const [validationErrors, setValidationErrors] = useState<{ ip?: string, val?: string }>({});

  useEffect(() => {
    const validate = () => {
      const newErrors: { ip?: string, val?: string } = {};
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      
      if (!ipRegex.test(ipAddress)) {
        newErrors.ip = "Invalid IPv4 address format.";
      } else {
        const classInfo = getIpClassInfo(ipAddress);
        if (classInfo.class === 'D' || classInfo.class === 'E') {
          newErrors.ip = `Class ${classInfo.class} addresses are reserved and cannot be subnetted.`;
        } else {
            try {
                let subnetBits = 0;
                const numValue = parseInt(value, 10);

                if (calculationMode === CalculationMode.SUBNETS) {
                    if (isNaN(numValue) || numValue <= 0) newErrors.val = "Must be a positive number.";
                    else subnetBits = Math.ceil(Math.log2(numValue));
                } else if (calculationMode === CalculationMode.HOSTS) {
                    if (isNaN(numValue) || numValue <= 0) newErrors.val = "Must be a positive number.";
                    else {
                        const requiredHostBits = Math.ceil(Math.log2(numValue + 2));
                        if (requiredHostBits > classInfo.hostBits!) {
                            newErrors.val = `Not enough host bits in Class ${classInfo.class} for ${value} hosts.`;
                        }
                        subnetBits = classInfo.hostBits! - requiredHostBits;
                    }
                } else { // MASK
                    const newCidr = parseMask(value);
                    if (newCidr < classInfo.defaultMaskBits!) {
                        newErrors.val = `Mask is smaller than default for Class ${classInfo.class}.`;
                    }
                    subnetBits = newCidr - classInfo.defaultMaskBits!;
                }

                if (subnetBits > 16) {
                    newErrors.val = "This generates over 100,000 subnets. Please select a smaller value.";
                }
            } catch (e) {
                newErrors.val = "Invalid mask format. Use CIDR (e.g., /24) or dotted decimal.";
            }
        }
      }
      setValidationErrors(newErrors);
    };
    validate();
  }, [ipAddress, calculationMode, value]);

  const isFormValid = !validationErrors.ip && !validationErrors.val;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    const calcValue = calculationMode === CalculationMode.MASK ? value : parseInt(value, 10);
    onCalculate({ calculationMode, ipAddress, value: calcValue });
  };
  
  const ModeSelector: React.FC = () => (
    <div className="flex bg-gray-700 rounded-lg p-1">
      {(Object.values(CalculationMode) as Array<CalculationMode>).map(mode => (
         <button
            key={mode}
            type="button"
            onClick={() => { 
                setCalculationMode(mode); 
                if(mode === CalculationMode.SUBNETS) setValue('4');
                if(mode === CalculationMode.HOSTS) setValue('14');
                if(mode === CalculationMode.MASK) setValue('/26');
            }}
            className={`w-1/3 py-2 px-4 text-sm font-medium rounded-md transition-colors duration-200 capitalize ${
            calculationMode === mode ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
        >
            {mode === 'mask' ? 'Subnet Mask' : mode}
        </button>
      ))}
    </div>
  );

  const getLabel = () => {
    switch (calculationMode) {
      case CalculationMode.SUBNETS: return 'Required Subnets';
      case CalculationMode.HOSTS: return 'Required Hosts per Subnet';
      case CalculationMode.MASK: return 'Subnet Mask / CIDR';
      default: return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="ipAddress" className="block text-sm font-medium text-gray-300 mb-2">IP Address</label>
          <input
            type="text"
            id="ipAddress"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            className={`w-full px-4 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition ${
              validationErrors.ip ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            }`}
            placeholder="e.g., 192.168.1.0"
          />
          {validationErrors.ip && <p className="mt-2 text-sm text-red-400">{validationErrors.ip}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Calculate By</label>
          <ModeSelector />
        </div>
      </div>
      <div>
        <label htmlFor="value" className="block text-sm font-medium text-gray-300 mb-2">{getLabel()}</label>
        <input
          type={calculationMode === CalculationMode.MASK ? 'text' : 'number'}
          id="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`w-full px-4 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition ${
              validationErrors.val ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
            }`}
          min={calculationMode !== CalculationMode.MASK ? "1" : undefined}
          placeholder={calculationMode === CalculationMode.MASK ? "e.g., 255.255.255.192 or /26" : ""}
        />
        {validationErrors.val && <p className="mt-2 text-sm text-red-400">{validationErrors.val}</p>}
      </div>
      <button type="submit" disabled={!isFormValid || loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 flex items-center justify-center">
        {loading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
        {loading ? 'Calculating...' : 'Calculate'}
      </button>
    </form>
  )
}

const App: React.FC = () => {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const workerRef = useRef<{ worker: Worker; url: string } | null>(null);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.worker.terminate();
        URL.revokeObjectURL(workerRef.current.url);
      }
    };
  }, []);
  
  const handleCalculate = useCallback((payload: any) => {
    setLoading(true);
    setError(null);
    setResult(null);

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
              <h2 className="text-2xl font-semibold text-center mb-6">Calculation Results</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center mb-6">
                <div className="bg-gray-700 p-4 rounded-lg"><p className="text-sm text-gray-400">IP Class</p><p className="font-mono text-lg">{result.ipClass}</p></div>
                <div className="bg-gray-700 p-4 rounded-lg"><p className="text-sm text-gray-400">Default Mask</p><p className="font-mono text-lg">{result.defaultMask}</p></div>
                <div className="bg-gray-700 p-4 rounded-lg"><p className="text-sm text-gray-400">Subnet Mask</p><p className="font-mono text-lg">{result.subnetMask}</p></div>
                <div className="bg-gray-700 p-4 rounded-lg"><p className="text-sm text-gray-400">CIDR Notation</p><p className="font-mono text-lg">/{result.cidr}</p></div>
                <div className="bg-gray-700 p-4 rounded-lg"><p className="text-sm text-gray-400">Total Subnets</p><p className="font-mono text-lg">{result.totalSubnets.toLocaleString()}</p></div>
                <div className="bg-gray-700 p-4 rounded-lg"><p className="text-sm text-gray-400">Usable Hosts</p><p className="font-mono text-lg">{result.hostsPerSubnet.toLocaleString()}</p></div>
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
