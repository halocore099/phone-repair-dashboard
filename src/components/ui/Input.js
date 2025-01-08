import React from 'react';

const Input = ({ type = "text", value, onChange, placeholder, className = "" }) => {
  const inputClasses = `px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`;

  // Handle number type inputs specifically
  if (type === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={inputClasses}
        step="0.01"
        min="0"
      />
    );
  }

  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={inputClasses}
    />
  );
};

export default Input;
