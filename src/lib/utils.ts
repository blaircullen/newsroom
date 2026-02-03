type ClassValue = string | undefined | null | false | ClassValue[];

/**
 * Utility function to conditionally join class names
 * Similar to clsx but without external dependency
 */
export function cn(...inputs: ClassValue[]): string {
  return inputs
    .flat()
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .join(' ');
}
