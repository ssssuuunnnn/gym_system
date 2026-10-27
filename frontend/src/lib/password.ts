/** 產生一組隨機密碼（排除 0/O、1/l/I 等易混淆字元），用於開通健身房、重設管理員密碼。 */
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join('');
}

/** 與後端 services/tenants.py MIN_PASSWORD_LENGTH 一致 */
export const MIN_PASSWORD_LENGTH = 8;
