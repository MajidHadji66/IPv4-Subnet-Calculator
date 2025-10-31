import React, { useState, useEffect } from 'react';
import { CalculationMode, CalculationPayload } from '../types';
import { validateIpFormat, getIpClassInfo, parseMask } from '../utils';

interface StandardCalculatorProps {
  onCalculate: (payload: CalculationPayload) => void;
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
      
      const ipFormatError = validateIpFormat(ipAddress);
      if (ipFormatError) {
        newErrors.ip = ipFormatError;
      } else {
        const firstOctet = parseInt(ipAddress.split('.')[0], 10);
        if (firstOctet === 0) {
            newErrors.ip = "Addresses starting with 0 are reserved and cannot be used.";
        } else if (firstOctet === 127) {
            newErrors.ip = "Loopback addresses (127.x.x.x) are not valid for subnetting.";
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
                    if (e instanceof Error) {
                        newErrors.val = e.message;
                    } else {
                        newErrors.val = "An unknown validation error occurred.";
                    }
                }
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

export default StandardCalculator;