// src/App.js
import React from 'react';
import { ThemeProvider } from 'next-themes';
import RepairDashboard from './RepairDashboard';

const App = () => {
  return (
    <ThemeProvider attribute="class">
      <div className="min-h-screen transition-colors duration-200 dark:bg-gray-900">
        <RepairDashboard />
      </div>
    </ThemeProvider>
  );
};

export default App;
