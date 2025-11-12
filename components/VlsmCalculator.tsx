import React, { useState, useEffect } from 'react';
import { VlsmCalculationPayload } from '../types';
import { validateIpFormat } from '../utils';

interface VlsmCalculatorProps {
  onCalculate: (payload: VlsmCalculationPayload) => void;
  loading: boolean;
}

const VlsmCalculator: React.FC<VlsmCalculatorProps> = ({ onCalculate, loading }) => {
    const [ipAddress, setIpAddress] = useState('192.168.1.0');
    const [cidr, setCidr] = useState('24');
    const [subnets, setSubnets] = useState<{ id: string, name: string, hosts: string, count: string }[]>([
        { id: `subnet-${Date.now()}`, name: 'LANs', hosts: '50', count: '2' },
        { id: `subnet-${Date.now()+1}`, name: 'Offices', hosts: '25', count: '3' },
        { id: `subnet-${Date.now()+2}`, name: 'WAN Links', hosts: '2', count: '4' },
    ]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const isFormValid = Object.keys(errors).length === 0;

    useEffect(() => {
        const validate = () => {
            const newErrors: Record<string, string> = {};
            const ipError = validateIpFormat(ipAddress);
            if (ipError) newErrors.ip = ipError;
            
            const cidrNum = parseInt(cidr, 10);
            if (isNaN(cidrNum) || cidrNum < 1 || cidrNum > 30) {
                newErrors.cidr = 'CIDR must be between 1 and 30.';
            }

            const names = new Set();
            subnets.forEach((subnet) => {
                if (!subnet.name.trim()) {
                    newErrors[`name-${subnet.id}`] = "Name is required.";
                } else if (names.has(subnet.name.trim())) {
                    newErrors[`name-${subnet.id}`] = "Group names must be unique.";
                }
                names.add(subnet.name.trim());

                const hostsNum = parseInt(subnet.hosts, 10);
                if (isNaN(hostsNum) || hostsNum <= 0) {
                    newErrors[`hosts-${subnet.id}`] = "Must be > 0.";
                }
                 const countNum = parseInt(subnet.count, 10);
                if (isNaN(countNum) || countNum <= 0) {
                    newErrors[`count-${subnet.id}`] = "Must be > 0.";
                }
            });

            if(Object.keys(newErrors).length === 0) {
                const totalRequiredAddresses = subnets.reduce((sum, s) => {
                    const hosts = parseInt(s.hosts, 10) || 0;
                    const count = parseInt(s.count, 10) || 0;
                    if (hosts === 0 || count === 0) return sum;
                    const blockSize = Math.pow(2, Math.ceil(Math.log2(hosts + 2)));
                    return sum + (blockSize * count);
                }, 0);

                const totalAvailableAddresses = Math.pow(2, 32 - cidrNum);
                if(totalRequiredAddresses > totalAvailableAddresses) {
                    newErrors.overall = `Total required addresses (${totalRequiredAddresses.toLocaleString()}) exceed available addresses in the /${cidrNum} block (${totalAvailableAddresses.toLocaleString()}).`;
                }
            }
            setErrors(newErrors);
        };
        validate();
    }, [ipAddress, cidr, subnets]);

    const handleAddSubnet = () => {
        const newSubnet = {
            id: `subnet-${Date.now()}`,
            name: `Group ${subnets.length + 1}`,
            hosts: '10',
            count: '1',
        };
        setSubnets([...subnets, newSubnet]);
    };

    const handleRemoveSubnet = (id: string) => {
        if (subnets.length > 1) {
            setSubnets(subnets.filter(s => s.id !== id));
        }
    };

    const handleSubnetChange = (id: string, field: 'name' | 'hosts' | 'count', value: string) => {
        setSubnets(subnets.map(s => (s.id === id ? { ...s, [field]: value } : s)));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;
        
        const payload: VlsmCalculationPayload = {
            ipAddress,
            cidr: parseInt(cidr, 10),
            subnets: subnets.map(s => ({
                id: s.id,
                name: s.name.trim(),
                hosts: parseInt(s.hosts, 10),
                count: parseInt(s.count, 10),
            })),
        };
        onCalculate(payload);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-200 mb-2">Base Network</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label htmlFor="vlsmIpAddress" className="sr-only">IP Address</label>
                        <input
                            type="text" id="vlsmIpAddress" value={ipAddress}
                            onChange={(e) => setIpAddress(e.target.value)}
                            className={`w-full px-4 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition font-mono ${
                                errors.ip ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                            }`}
                            placeholder="e.g., 10.0.0.0"
                        />
                         {errors.ip && <p className="mt-2 text-sm text-red-400">{errors.ip}</p>}
                    </div>
                    <div>
                        <label htmlFor="vlsmCidr" className="sr-only">CIDR</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">/</div>
                            <input
                                type="number" id="vlsmCidr" value={cidr}
                                onChange={(e) => setCidr(e.target.value)}
                                min="1" max="30"
                                className={`w-full pl-7 pr-4 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition font-mono ${
                                    errors.cidr ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                                }`}
                            />
                        </div>
                         {errors.cidr && <p className="mt-2 text-sm text-red-400">{errors.cidr}</p>}
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-medium text-gray-200 mb-2">Required Subnet Groups</h3>
                <div className="space-y-3">
                    {subnets.map((subnet, index) => (
                        <div key={subnet.id} className="grid grid-cols-12 gap-3 items-start p-3 bg-gray-900/50 rounded-lg">
                           <div className="col-span-12 sm:col-span-2">
                                <label htmlFor={`count-${subnet.id}`} className="block text-xs font-medium text-gray-400 mb-1"># Subnets</label>
                                <input
                                    type="number" id={`count-${subnet.id}`} value={subnet.count}
                                    onChange={(e) => handleSubnetChange(subnet.id, 'count', e.target.value)}
                                    min="1"
                                    className={`w-full px-3 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition text-sm ${
                                        errors[`count-${subnet.id}`] ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                                    }`}
                                />
                                {errors[`count-${subnet.id}`] && <p className="mt-1 text-xs text-red-400">{errors[`count-${subnet.id}`]}</p>}
                           </div>
                           <div className="col-span-12 sm:col-span-5">
                                <label htmlFor={`name-${subnet.id}`} className="block text-xs font-medium text-gray-400 mb-1">Name Prefix</label>
                                <input
                                    type="text" id={`name-${subnet.id}`} value={subnet.name}
                                    onChange={(e) => handleSubnetChange(subnet.id, 'name', e.target.value)}
                                    className={`w-full px-3 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition text-sm ${
                                        errors[`name-${subnet.id}`] ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                                    }`}
                                    placeholder={`e.g. Sales Dept`}
                                />
                                {errors[`name-${subnet.id}`] && <p className="mt-1 text-xs text-red-400">{errors[`name-${subnet.id}`]}</p>}
                           </div>
                           <div className="col-span-12 sm:col-span-4">
                                <label htmlFor={`hosts-${subnet.id}`} className="block text-xs font-medium text-gray-400 mb-1">Hosts per Subnet</label>
                                 <input
                                    type="number" id={`hosts-${subnet.id}`} value={subnet.hosts}
                                    onChange={(e) => handleSubnetChange(subnet.id, 'hosts', e.target.value)}
                                    min="1"
                                    className={`w-full px-3 py-2 bg-gray-700 border rounded-lg focus:ring-2 outline-none transition text-sm ${
                                        errors[`hosts-${subnet.id}`] ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                                    }`}
                                />
                                {errors[`hosts-${subnet.id}`] && <p className="mt-1 text-xs text-red-400">{errors[`hosts-${subnet.id}`]}</p>}
                           </div>
                           <div className="col-span-12 sm:col-span-1 flex items-end">
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSubnet(subnet.id)}
                                    className="w-full h-10 flex items-center justify-center text-gray-400 hover:text-white bg-gray-700 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
                                    aria-label="Remove Subnet Group"
                                    disabled={subnets.length <= 1}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                </button>
                           </div>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={handleAddSubnet} className="mt-4 text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>
                    Add Group
                </button>
            </div>
            {errors.overall && <p className="mt-2 text-sm text-red-400 text-center">{errors.overall}</p>}
            <button type="submit" disabled={!isFormValid || loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 flex items-center justify-center">
                Calculate VLSM Plan
            </button>
        </form>
    );
};

export default VlsmCalculator;
