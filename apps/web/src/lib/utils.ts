import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function constructUrl(key: string): string {
  return `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
}

export function getCustomDomain(subdomain: string): string {
  const url = new URL(process.env.NEXT_PUBLIC_DOMAIN || "");

  return `${url.protocol}//${subdomain}.${url.host}`;
}
