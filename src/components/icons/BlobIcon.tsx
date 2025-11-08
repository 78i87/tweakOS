import React from 'react';

interface BlobIconProps {
  size?: number;
  className?: string;
}

export default function BlobIcon({ size = 20, className }: BlobIconProps) {
  // Cloud-shaped icon using SVG path
  // Creates a fluffy cloud shape with rounded bumps
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M19 13C20.1 13 21 12.1 21 11C21 9.9 20.1 9 19 9C18.87 9 18.74 9.01 18.62 9.04C18.24 7.27 16.73 6 15 6C14.11 6 13.26 6.31 12.62 6.86C12.08 5.76 11 5 9.75 5C8.23 5 7 6.23 7 7.75C7 7.88 7.01 8.01 7.03 8.13C5.86 8.53 5 9.66 5 11C5 12.66 6.34 14 8 14H19Z"
        fill="#2F2A22"
      />
    </svg>
  );
}

