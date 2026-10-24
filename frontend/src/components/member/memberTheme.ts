import type { ThemeConfig } from 'antd';

/**
 * 前台（會員／教練）主題：以 ConfigProvider 巢狀套在 MemberLayout，覆寫 App.tsx 的後台主題。
 * 這裡是前台色票的唯一來源；元件一律透過 theme.useToken() 取用，不要在元件裡寫色碼。
 *
 * - 會員：品牌藍深一階 #0958d9（白字對比約 5.9:1，小字也清楚）
 * - 教練：深青綠 #006d75（白字對比約 6:1），讓身份一眼可分
 */
export type FrontMode = 'member' | 'coach';

const FONT_FAMILY =
  '"Noto Sans TC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Microsoft JhengHei", "Helvetica Neue", Arial, sans-serif';

const base: ThemeConfig['token'] = {
  fontFamily: FONT_FAMILY,
  fontSize: 15,
  borderRadius: 12,
  borderRadiusSM: 8,
  borderRadiusLG: 16,
  controlHeight: 44,
  controlHeightLG: 52,
  controlHeightSM: 32,
  colorTextBase: '#141414',
  colorBgContainer: '#ffffff',
  // 狀態色取深一階：前台常把狀態字放在淺色底上（已確認、待付款），antd 預設的綠／金對比不足 4.5:1
  colorSuccess: '#237804',
  colorSuccessText: '#237804',
  colorWarning: '#ad6800',
  colorWarningText: '#874d00',
  colorError: '#cf1322',
  colorErrorText: '#a8071a',
  // 淺底固定為 antd 預設的 1 階，避免由深色狀態色推算出偏灰的底
  colorSuccessBg: '#f6ffed',
  colorWarningBg: '#fffbe6',
  colorErrorBg: '#fff1f0',
};

export const FRONT_THEMES: Record<FrontMode, ThemeConfig> = {
  member: {
    token: { ...base, colorPrimary: '#0958d9', colorLink: '#0958d9', colorBgLayout: '#f3f5f9' },
  },
  coach: {
    token: { ...base, colorPrimary: '#006d75', colorLink: '#006d75', colorBgLayout: '#f1f6f6' },
  },
};

/** 前台內容欄最大寬度：手機為主，桌機置中顯示 */
export const FRONT_MAX_WIDTH = 560;
/** 底部分頁列高度（不含 iOS 安全區） */
export const TAB_BAR_HEIGHT = 68;
