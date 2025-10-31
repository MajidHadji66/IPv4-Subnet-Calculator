import React from 'react';
import { CalculationResult } from '../types';

interface SummaryProps {
    result: CalculationResult;
}

const Summary: React.FC<SummaryProps> = ({ result }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center mb-6">
        <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-sm text-gray-400">IP Class</p>
            <p className="font-mono text-lg">{result.ipClass}</p>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Default Mask</p>
            <p className="font-mono text-lg">{result.defaultMask}</p>
        </div>
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
            <p className="font-mono text-lg">{result.totalSubnets.toLocaleString()}</p>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Usable Hosts</p>
            <p className="font-mono text-lg">{result.hostsPerSubnet.toLocaleString()}</p>
        </div>
    </div>
);

export default Summary;
