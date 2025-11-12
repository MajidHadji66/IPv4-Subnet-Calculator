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
  
  const [requiredSubnets, setRequiredSubnets] = useState('4');
  const [requiredHosts, setRequiredHosts] = useState('14');
  const [maskValue, setMaskValue] = useState('/26');

  const [validationErrors, setValidationErrors] = useState<{ ip?: string, subnets?: string, hosts?: string, mask?: string }>({});

  useEffect(() => {
    const validate = () => {
      const newErrors: { ip?: string, subnets?: string, hosts?: string, mask?: string } = {};
      
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
            } else if (calculationMode === CalculationMode.SUBNETS) {
                const subnetsNum = parseInt(requiredSubnets, 10);
                if (isNaN(subnetsNum) || subnetsNum <= 0) {
                    newErrors.subnets = "Must be a positive number.";
                } else {
                    const subnetBits = Math.ceil(Math.log2(subnetsNum));
                    const newCidr = classInfo.defaultMaskBits! + subnetBits;
                    if (32 - newCidr < 2) {
                        newErrors.subnets = `Not enough host bits in a Class ${classInfo.class} network for this many subnets.`;
                    }
                }
            } else if (calculationMode === CalculationMode.HOSTS) {
                const hostsNum = parseInt(requiredHosts, 10);
                if (isNaN(hostsNum) || hostsNum <= 0) {
                    newErrors.hosts = "Must be a positive number.";
                } else {
                    const neededHostBits = Math.ceil(Math.log2(hostsNum + 2));
                    if (neededHostBits > classInfo.hostBits!) {
                        newErrors.hosts = `A Class ${classInfo.class} network cannot provide this many hosts per subnet.`;
                    }
                }
            } else { // MASK
                try {
                    const newCidr = parseMask(maskValue);
                    if (newCidr < classInfo.defaultMaskBits!) {
                        newErrors.mask = `Mask is smaller than default for Class ${classInfo.class}.`;
                    }
                    const subnetBits = newCidr - classInfo.defaultMaskBits!;
                    if (subnetBits > 16) {
                        newErrors.mask = "This generates over 100,000 subnets. Please select a smaller value.";
                    }
                } catch (e) {
                    if (e instanceof Error) newErrors.mask = e.message;
                    else newErrors.mask = "An unknown validation error occurred.";
                }
            }
        }
      }
      setValidationErrors(newErrors);
    };
    validate();
  }, [ipAddress, calculationMode, requiredSubnets, requiredHosts, maskValue]);

  const isFormValid = Object.keys(validationErrors).length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    let payload: Partial<CalculationPayload> = {
        calculationMode,
        ipAddress,
    };

    if (calculationMode === CalculationMode.SUBNETS) {
      payload.requiredSubnets = parseInt(requiredSubnets, 10);
    } else if (calculationMode === CalculationMode.HOSTS) {
      payload.requiredHosts = parseInt(requiredHosts, 10);
    } else { // MASK
      payload.mask = maskValue;
    }
    onCalculate(payload as CalculationPayload);
  };
  
  const ModeSelector: React.FC = () => (
    <div className="flex bg-gray-700 rounded-lg p-1">
        <button
            type="button"
            onClick={() => setCalculationMode(CalculationMode.SUBNETS)}
            className={`w-1/3 py-2 px-3 text-sm font-medium rounded-md transition-colors duration-200 capitalize ${
            calculationMode === CalculationMode.SUBNETS ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
        >
            # of Subnets
        </button>
        <button
            type="button"
            onClick={() => setCalculationMode(CalculationMode.HOSTS)}
            className={`w-1/3 py-2 px-3 text-sm font-medium rounded-md transition-colors duration-200 capitalize ${
            calculationMode === CalculationMode.HOSTS ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
        >
            # of Hosts
        </button>
        <button
            type="button"
            onClick={() => setCalculationMode(CalculationMode.MASK)}
            className={`w-1/3 py-2 px-3 text-sm font-medium rounded-md transition-colors duration-200 capitalize ${
            calculationMode === CalculationMode.MASK ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
            }`}
        >
            Mask / CIDR
        </button>
    </div>
  );
  
  const renderInputMode = () => {
      switch (calculationMode) {
          case CalculationMode.SUBNETS:
              return (
                  <div>
                      <label htmlFor="requiredSubnets" className="block text-sm font-medium text-gray-300 mb-2">Required Subnets</label>
                      <input
                          type='number'
                          id="requiredSubnets"
                          value={requiredSubnets}
                          onChange={(e) => setRequiredSubnets(e.target.value)}
                          className={`w-full px-4 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition ${
                          validationErrors.subnets ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                          }`}
                          min="1"
                      />
                      {validationErrors.subnets && <p className="mt-2 text-sm text-red-400">{validationErrors.subnets}</p>}
                  </div>
              );
          case CalculationMode.HOSTS:
              return (
                  <div>
                      <label htmlFor="requiredHosts" className="block text-sm font-medium text-gray-300 mb-2">Min. Hosts per Subnet</label>
                      <input
                          type='number'
                          id="requiredHosts"
                          value={requiredHosts}
                          onChange={(e) => setRequiredHosts(e.target.value)}
                          className={`w-full px-4 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition ${
                          validationErrors.hosts ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                          }`}
                          min="1"
                      />
                      {validationErrors.hosts && <p className="mt-2 text-sm text-red-400">{validationErrors.hosts}</p>}
                  </div>
              );
          case CalculationMode.MASK:
            return (
                <div>
                    <label htmlFor="maskValue" className="block text-sm font-medium text-gray-300 mb-2">Subnet Mask / CIDR</label>
                    <input
                        type='text'
                        id="maskValue"
                        value={maskValue}
                        onChange={(e) => setMaskValue(e.target.value)}
                        className={`w-full px-4 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition ${
                            validationErrors.mask ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                        placeholder="e.g., 255.255.255.192 or /26"
                    />
                    {validationErrors.mask && <p className="mt-2 text-sm text-red-400">{validationErrors.mask}</p>}
                </div>
            );
          default:
              return null;
      }
  }

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
      
      {renderInputMode()}

      <button type="submit" disabled={!isFormValid || loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 flex items-center justify-center">
        {loading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
        {loading ? 'Calculating...' : 'Calculate'}
      </button>
    </form>
  )
}

export default StandardCalculator;