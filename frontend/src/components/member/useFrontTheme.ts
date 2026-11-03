import { useQuery } from '@tanstack/react-query';
import type { ThemeConfig } from 'antd';
import { getTenantProfile } from '../../api/tenant';
import { frontTheme, type FrontMode } from './memberTheme';

/**
 * 前台主題（會員模式跟著形象網站的品牌色）。品牌色來自公開的 GET /tenant/profile，
 * 與 useTerms 共用 ['tenant-profile'] 快取；形象網站發布後重新整理即套用。
 */
export function useFrontTheme(mode: FrontMode): ThemeConfig {
  const { data } = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile, staleTime: 5 * 60_000 });
  return frontTheme(mode, data?.brand_color);
}
