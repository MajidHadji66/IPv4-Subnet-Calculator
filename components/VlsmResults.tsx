import React from 'react';
import { VlsmCalculationResult } from '../types';

interface VlsmResultsProps {
  result: VlsmCalculationResult;
}

const VlsmResults: React.FC<VlsmResultsProps> = ({ result }) => {
  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
        <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Base Network</p>
            <p className="font-mono text-lg">{result.baseNetwork}</p>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Total Addresses</p>
            <p className="font-mono text-lg">{result.totalHostsInBlock.toLocaleString()}</p>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Required Hosts</p>
            <p className="font-mono text-lg">{result.totalRequiredHosts.toLocaleString()}</p>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg">
            <p className="text-sm text-gray-400">Allocated Hosts</p>
            <p className="font-mono text-lg">{result.totalAllocatedHosts.toLocaleString()}</p>
        </div>
        <div className="bg-gray-700 p-4 rounded-lg col-span-2 sm:col-span-1">
            <p className="text-sm text-gray-400">Efficiency</p>
            <p className="font-mono text-lg text-teal-300">{result.efficiency.toFixed(2)}%</p>
        </div>
      </div>

      {/* Allocated Subnets Table */}
      <div>
        <h3 className="text-xl font-semibold mb-3">Allocated Subnets</h3>
        <div className="w-full overflow-hidden rounded-lg border border-gray-700">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700/50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Name</th>
                  <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Required</th>
                  <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Allocated</th>
                  <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Network Address</th>
                  <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Mask / CIDR</th>
                  <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Usable Range</th>
                  <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">Broadcast</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-900/50">
                {result.allocatedSubnets.map((subnet) => (
                  <tr key={subnet.id} className="hover:bg-gray-800/60 transition-colors">
                    <td className="whitespace-nowrap py-4 px-4 text-sm font-medium text-gray-200">{subnet.name}</td>
                    <td className="whitespace-nowrap py-4 px-4 text-sm text-gray-300">{subnet.requiredHosts}</td>
                    <td className="whitespace-nowrap py-4 px-4 text-sm text-gray-300">{subnet.allocatedHosts}</td>
                    <td className="whitespace-nowrap py-4 px-4 text-sm font-mono text-gray-300">{subnet.networkAddress}</td>
                    <td className="whitespace-nowrap py-4 px-4 text-sm font-mono text-gray-300">{subnet.subnetMask} /{subnet.cidr}</td>
                    <td className="whitespace-nowrap py-4 px-4 text-sm font-mono text-gray-300">{subnet.usableHostRange}</td>
                    <td className="whitespace-nowrap py-4 px-4 text-sm font-mono text-gray-300">{subnet.broadcastAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Unallocated Ranges */}
      {result.unallocatedRanges.length > 0 && (
        <div>
            <h3 className="text-xl font-semibold mb-3">Unallocated Address Space</h3>
            <div className="bg-gray-700/50 rounded-lg p-4 font-mono text-gray-300 space-y-2">
                {result.unallocatedRanges.map((range, index) => (
                    <div key={index}>
                        <p><strong>Range:</strong> {range.usableHostRange}</p>
                        <p><strong>Total Addresses:</strong> {range.size}</p>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default VlsmResults;