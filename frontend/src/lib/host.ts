/**
 * 依網址判斷目前是哪個系統（見 docs/adr/0001-multi-tenancy.md、0002-platform-console.md）：
 * - platform.<主網域> → 平台管理後台
 * - 其他 → 某家健身房（由後端依子網域判斷是哪一家）
 */
export const PLATFORM_SUBDOMAIN: string = import.meta.env.VITE_PLATFORM_SUBDOMAIN || 'platform';

export function isPlatformHost(hostname = window.location.hostname): boolean {
  return hostname.split('.')[0] === PLATFORM_SUBDOMAIN;
}

/** 平台網址去掉 platform. 之後的主網域（含連接埠），例如 example.com、localhost:5173 */
export function baseDomainWithPort(): string {
  const { hostname, port } = window.location;
  const base = isPlatformHost(hostname) ? hostname.split('.').slice(1).join('.') : hostname;
  return port ? `${base}:${port}` : base;
}

/** 某家健身房的網址，例如 https://alpha.example.com */
export function tenantUrl(subdomain: string): string {
  return `${window.location.protocol}//${subdomain}.${baseDomainWithPort()}`;
}
