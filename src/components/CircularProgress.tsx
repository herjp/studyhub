import React from "react";

interface CircularProgressProps {
  value: number; // current value
  max: number; // max / goal value
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
}

export function CircularProgress({
  value,
  max,
  size = 76,
  strokeWidth = 7,
  label,
  sublabel,
}: CircularProgressProps) {
  const safeMax = Math.max(1, max);
  const percentage = Math.min(100, Math.round((value / safeMax) * 100));

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90 transform" viewBox={`0 0 ${size} ${size}`}>
          {/* Track background */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-indigo-600 dark:stroke-indigo-400 transition-all duration-700 ease-out"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {value}/{max}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">Fragen</span>
        </div>
      </div>

      {(label || sublabel) && (
        <div className="min-w-0">
          {label && (
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {label}
            </p>
          )}
          {sublabel && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
