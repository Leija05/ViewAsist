import React from 'react';
import logo from '../assets/viewasist-logo.svg';

const AppLogo = ({ className = '', animated = false, alt = 'Logo ViewAsist' }) => {
  const animationClass = animated ? 'app-logo-float app-logo-glow' : '';
  return (
    <img
      src={logo}
      alt={alt}
      className={`app-logo ${animationClass} ${className}`.trim()}
    />
  );
};

export default AppLogo;
