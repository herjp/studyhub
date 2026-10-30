import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGrade(grade: number | null | undefined): string {
  if (grade === null || grade === undefined || isNaN(grade)) return "—";
  return grade.toFixed(1);
}

export function formatEcts(ects: number | null | undefined): string {
  if (ects === null || ects === undefined || isNaN(ects)) return "0";
  return Number.isInteger(ects) ? ects.toString() : ects.toFixed(1);
}
