"use client";

import React from 'react';
import { OilTank } from '@/types/onedelivery';
import { cn } from "@/lib/utils";

interface Tank3DProps {
  tank: OilTank;
}

export function Tank3DVisualization({ tank }: Tank3DProps) {
  // Calculate stats
  const currentLevel = tank.currentLevel || 0;
  const capacity = Math.max(1, tank.capacity || 1);
  const percentage = Math.min(100, Math.max(0, (currentLevel / capacity) * 100));

  // Determine color based on percentage
  let fluidColorClass = "bg-lime-500"; 
  let fluidTopColorClass = "bg-lime-400";
  
  if (percentage < 30) {
    fluidColorClass = "bg-red-500";
    fluidTopColorClass = "bg-red-400";
  } else if (percentage < 60) {
    fluidColorClass = "bg-yellow-500";
    fluidTopColorClass = "bg-yellow-400";
  } else if (percentage >= 90) {
    fluidColorClass = "bg-emerald-700";
    fluidTopColorClass = "bg-emerald-600";
  }

  return (
    <div className="h-[300px] w-full bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 rounded-lg border relative shadow-inner flex flex-col items-center justify-center p-4 select-none">
      
      {/* Floating Label Card */}
      <div className="absolute top-4 z-20 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-md shadow-md border text-xs font-medium text-center min-w-[120px] transition-transform hover:scale-105 cursor-default">
        <div className="text-foreground/90 font-bold mb-0.5">{tank.oilTypeName || 'Oil Tank'}</div>
        <div className={cn("font-bold text-lg", 
            percentage < 30 ? "text-red-500" : 
            percentage < 60 ? "text-yellow-600" : "text-emerald-600"
        )}>
          {percentage.toFixed(1)}%
        </div>
        <div className="text-muted-foreground text-[10px] flex justify-between gap-2 px-1 border-t border-border/50 pt-1 mt-1">
          <span>{currentLevel.toLocaleString()} L</span>
          <span className="opacity-50">/</span>
          <span>{capacity.toLocaleString()} L</span>
        </div>
      </div>

      {/* Tank Container */}
      <div className="relative w-32 h-48 mt-8">
        {/* Tank Body Shell */}
        <div className="absolute inset-0 rounded-[9999px] border-2 border-slate-300 dark:border-slate-600 bg-slate-200/20 backdrop-blur-[2px] overflow-hidden z-10 box-border shadow-xl">
            
            {/* Liquid */}
            <div 
                className={cn("absolute bottom-0 w-full transition-all duration-1000 ease-in-out", fluidColorClass)}
                style={{ height: `${percentage}%` }}
            >
                {/* Liquid Top Surface (Meniscus) */}
                <div className={cn("absolute top-0 left-0 w-full h-5 -mt-2.5 rounded-[50%]", fluidTopColorClass, "opacity-90")} />
            </div>

            {/* Glass Reflections / Highlights */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/40 via-transparent to-black/5 pointer-events-none rounded-[9999px] z-20" />
            <div className="absolute top-4 left-3 w-2 h-36 bg-gradient-to-b from-white/40 to-transparent rounded-full blur-[1px] z-20" />
        </div>

        {/* Tank Cap/Details (Visual Flourish) */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-slate-300 dark:bg-slate-700 rounded-t-lg z-0" />
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-300 dark:bg-slate-700 rounded-b-lg shadow-sm z-0" />
        
        {/* Measurement Lines (Ticks) */}
         <div className="absolute right-[-16px] top-[10%] bottom-[10%] flex flex-col justify-between text-[9px] text-muted-foreground font-mono h-[80%] opacity-60">
            <span className="flex items-center gap-1 before:content-[''] before:w-2 before:h-[1px] before:bg-slate-400">100%</span>
            <span className="flex items-center gap-1 before:content-[''] before:w-1.5 before:h-[1px] before:bg-slate-400">75%</span>
            <span className="flex items-center gap-1 before:content-[''] before:w-2 before:h-[1px] before:bg-slate-400">50%</span>
            <span className="flex items-center gap-1 before:content-[''] before:w-1.5 before:h-[1px] before:bg-slate-400">25%</span>
            <span className="flex items-center gap-1 before:content-[''] before:w-2 before:h-[1px] before:bg-slate-400">0%</span>
         </div>
      </div>

    </div>
  );
}
