import React from 'react';
import { Subnet } from '../types';

interface ResultsTableProps {
  subnets: Subnet[];
}

const ResultsTable: React.FC<ResultsTableProps> = ({ subnets }) => {
  return (
    <div className="w-full mt-4 overflow-hidden rounded-lg border border-gray-700">
      <div className="max-h-[50vh] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-700/50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">
                Subnet #
              </th>
              <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">
                Network Address
              </th>
              <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">
                Usable Host Range
              </th>
              <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-gray-300">
                Broadcast Address
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-900/50">
            {subnets.map((subnet) => (
              <tr key={subnet.id} className="hover:bg-gray-800/60 transition-colors">
                <td className="whitespace-nowrap py-4 px-4 text-sm font-medium text-gray-200">
                  {subnet.id}
                </td>
                <td className="whitespace-nowrap py-4 px-4 text-sm text-gray-300 font-mono">
                  {subnet.networkAddress}
                </td>
                <td className="whitespace-nowrap py-4 px-4 text-sm text-gray-300 font-mono">
                  {subnet.usableHostRange}
                </td>
                <td className="whitespace-nowrap py-4 px-4 text-sm text-gray-300 font-mono">
                  {subnet.broadcastAddress}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
