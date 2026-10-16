import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Performs the cn operation. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
