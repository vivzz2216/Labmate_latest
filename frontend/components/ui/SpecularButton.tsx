'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import './SpecularButton.css';

export interface SpecularButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  idleIntensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  glow?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  href?: string;
}

export default function SpecularButton({
  children,
  size = 'lg',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0.04,
  blur = 0,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor: _baseColor,
  intensity: _intensity,
  idleIntensity: _idleIntensity,
  shineSize: _shineSize,
  shineFade: _shineFade,
  thickness: _thickness,
  glow: _glow,
  speed: _speed,
  followMouse: _followMouse,
  proximity: _proximity,
  autoAnimate: _autoAnimate,
  disabled,
  onClick,
  className = '',
  type = 'button',
  style,
  href,
  ...rest
}: SpecularButtonProps) {
  const router = useRouter();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (!href || event.defaultPrevented) return;
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      router.push(href);
    }
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={`specular-button specular-button--${size}${className ? ` ${className}` : ''}`}
      style={{
        '--sb-radius': `${radius}px`,
        '--sb-tint': tint,
        '--sb-tint-percent': `${Math.max(0, Math.min(100, tintOpacity * 100))}%`,
        '--sb-blur': `${blur}px`,
        '--sb-text-color': textColor,
        '--sb-line-color': lineColor,
        ...style,
      } as React.CSSProperties}
      {...rest}
    >
      <span className="specular-button__label">{children}</span>
    </button>
  );
}
