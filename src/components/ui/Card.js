import React from 'react';

const Card = ({ children }) => {
  return (
    <div className="border rounded-lg p-4 shadow-lg">
      {children}
    </div>
  );
};

const CardHeader = ({ children }) => <div className="mb-4">{children}</div>;
const CardTitle = ({ children }) => <h2 className="text-xl font-bold">{children}</h2>;
const CardContent = ({ children }) => <div>{children}</div>;

export { Card, CardHeader, CardTitle, CardContent };
