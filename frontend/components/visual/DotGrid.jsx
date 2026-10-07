'use client';

import React, { useEffect, useRef } from 'react';
import './DotGrid.css';

export default function DotGrid({
  dotColor = '#ffffff',
  backgroundColor = 'transparent',
  spacing = 22,
  dotSize = 1.6,
  baseOpacity = 0.22,
  isProcessing = false,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const isProcessingRef = useRef(isProcessing);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let startTime = performance.now();

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    // Parse RGB from dotColor
    let r = 255, g = 255, b = 255;
    if (dotColor.startsWith('#')) {
      const hex = dotColor.replace('#', '');
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length >= 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
    }

    const render = (time) => {
      if (width === 0 || height === 0) {
        if (isProcessingRef.current) {
          animFrameRef.current = requestAnimationFrame(render);
        }
        return;
      }

      ctx.clearRect(0, 0, width, height);

      if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      const active = isProcessingRef.current;
      const elapsed = (time - startTime) / 1000;

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      const offsetX = (width % spacing) / 2;
      const offsetY = (height % spacing) / 2;

      const centerX = width / 2;
      const centerY = height / 2;
      const maxDist = Math.max(Math.hypot(centerX, centerY), 1);

      if (!active) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${baseOpacity})`;
        for (let i = 0; i < cols; i++) {
          const x = offsetX + i * spacing;
          for (let j = 0; j < rows; j++) {
            const y = offsetY + j * spacing;
            ctx.moveTo(x + dotSize, y);
            ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          }
        }
        ctx.fill();
        return;
      }

      for (let i = 0; i < cols; i++) {
        const x = offsetX + i * spacing;
        for (let j = 0; j < rows; j++) {
          const y = offsetY + j * spacing;

          const dist = Math.hypot(x - centerX, y - centerY);
          const distRatio = dist / maxDist;
          const wave = Math.sin(elapsed * 2.8 - distRatio * 3.8);
          const pulse = (wave + 1) / 2; // 0 to 1
          const dotAlpha = baseOpacity + pulse * 0.42;
          const currentRadius = dotSize * (1 + pulse * 0.3);

          ctx.beginPath();
          ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(dotAlpha, 0.85)})`;
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    resize();
    render(performance.now());

    const ro = new ResizeObserver(() => {
      resize();
      render(performance.now());
    });
    ro.observe(container);

    if (isProcessing) {
      animFrameRef.current = requestAnimationFrame(render);
    }

    return () => {
      ro.disconnect();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [dotColor, backgroundColor, spacing, dotSize, baseOpacity, isProcessing]);

  return (
    <div
      ref={containerRef}
      className={`dot-grid-container ${className}`}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="dot-grid-canvas" />
    </div>
  );
}
