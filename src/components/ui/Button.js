import React from 'react';

const Button = ({ children, onClick, variant = 'default', size = 'md', className = '' }) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const sizeClasses = {
    sm: 'h-8 px-3 text-sm rounded-md',
    md: 'h-10 px-4 py-2 rounded-md',
    lg: 'h-12 px-6 rounded-md'
  };

  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    ghost: 'bg-transparent hover:bg-blue-100 text-blue-600 hover:text-blue-700',
    outline: 'border-2 border-blue-600 bg-transparent text-blue-600 hover:bg-blue-50'
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
