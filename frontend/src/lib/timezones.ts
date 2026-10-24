/** 健身房時區選項：常用的放前面，其餘依瀏覽器支援的 IANA 時區列表。 */
const COMMON_TIMEZONES = [
  'Asia/Taipei',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Kuala_Lumpur',
  'America/Los_Angeles',
  'America/Vancouver',
  'America/New_York',
  'Europe/London',
  'Australia/Sydney',
];

function allTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

export const TIMEZONE_OPTIONS = [
  ...COMMON_TIMEZONES,
  ...allTimezones().filter((tz) => !COMMON_TIMEZONES.includes(tz)),
].map((tz) => ({ value: tz, label: tz }));
