import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './views/Dashboard/Dashboard';
import TopologyView from './views/TopologyView/TopologyView';
import TraceList from './views/TraceList/TraceList';
import ExecutionView from './views/ExecutionView/ExecutionView';
const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/topology', label: 'Topology' },
  { to: '/traces', label: 'Traces' },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
        <span className="text-lg font-bold text-blue-400 mr-4">MediatorFlow</span>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `text-sm px-3 py-1 rounded ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/topology" element={<TopologyView />} />
          <Route path="/traces" element={<TraceList />} />
          <Route path="/traces/:correlationId" element={<ExecutionView />} />

        </Routes>
      </main>
    </div>
  );
}
