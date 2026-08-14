import { ConfigProvider, App as AntApp, type ThemeConfig } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

const queryClient = new QueryClient();

// 品牌／設計 token 集中定義於此，未來若要換品牌色，只需修改這個物件。
// 目前數值取自 gym-system-design（PulseFit）的設計稿，該稿本身即為 Ant Design 官方預設值，
// 故大多數項目與 antd 預設一致；仍逐一列出是為了讓調色盤明確化、集中化。
const themeToken: ThemeConfig['token'] = {
  // 品牌／語意色（seed token）
  colorPrimary: '#1677ff', // 主色，取自設計稿 --color-primary（blue-6）
  colorInfo: '#1677ff', // 設計稿未定義獨立的資訊色階，沿用主色
  colorSuccess: '#52c41a', // 成功色，取自設計稿 --color-success（green-6）
  colorWarning: '#faad14', // 警示色，取自設計稿 --color-warning（gold-6）
  colorError: '#ff4d4f', // 錯誤色，取自設計稿 --color-error（red-5）
  colorLink: '#1677ff', // 連結色，取自設計稿 --color-link（blue-6）
  colorLinkHover: '#4096ff', // 連結 hover 色，設計稿明確指定為 blue-5（與 antd 依 colorLink 自動推導出的 blue-4 不同，故明確覆寫）

  // 中性色（文字／背景／邊框）
  colorTextBase: '#000000', // 文字色 seed，antd 會由此推導出 colorText/Secondary/Tertiary/Quaternary，數值與設計稿 --text-* 系列相符
  colorBgBase: '#ffffff', // 背景色 seed
  colorBgLayout: '#f5f5f5', // 版面背景色，取自設計稿 --bg-layout（gray-3）
  colorBgContainer: '#ffffff', // 容器背景色，取自設計稿 --bg-container
  colorBgElevated: '#ffffff', // 浮層（Modal/Dropdown 等）背景色，取自設計稿 --bg-elevated
  colorBorder: '#d9d9d9', // 一級邊框色，取自設計稿 --border-color（gray-5）
  colorBorderSecondary: '#f0f0f0', // 二級邊框色（分隔線），取自設計稿 --border-secondary（gray-4）

  // 字體
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, "Noto Sans", sans-serif', // 取自設計稿 --font-family，含繁中字型（PingFang SC / Microsoft YaHei），比 antd 預設更適合本專案的繁體中文介面
  fontFamilyCode:
    '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace', // 取自設計稿 --font-family-mono
  fontSize: 14, // 基礎字級，取自設計稿 --font-size-base
  fontSizeSM: 12, // 取自設計稿 --font-size-sm
  fontSizeLG: 16, // 取自設計稿 --font-size-lg
  fontSizeXL: 20, // 取自設計稿 --font-size-xl
  lineHeight: 1.5714285714285714, // 取自設計稿 --line-height-base
  lineHeightSM: 1.6666666666666667, // 取自設計稿 --line-height-sm
  lineHeightLG: 1.5, // 取自設計稿 --line-height-lg

  // 圓角
  borderRadius: 6, // 取自設計稿 --radius-base
  borderRadiusSM: 4, // 取自設計稿 --radius-sm
  borderRadiusLG: 8, // 取自設計稿 --radius-lg
  borderRadiusXS: 2, // 取自設計稿 --radius-xs

  // 陰影
  boxShadow: '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)', // 取自設計稿 --shadow-2
  boxShadowSecondary: '0 6px 16px 0 rgba(0,0,0,0.08), 0 3px 6px -4px rgba(0,0,0,0.12), 0 9px 28px 8px rgba(0,0,0,0.05)', // 取自設計稿 --shadow-2
  boxShadowTertiary: '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)', // 取自設計稿 --shadow-1

  // 間距（僅列出設計稿有對應數值的級距，中間級距如 paddingMD/marginMD 沿用 antd 預設）
  paddingXXS: 4, // 取自設計稿 --space-xxs
  paddingXS: 8, // 取自設計稿 --space-xs
  paddingSM: 12, // 取自設計稿 --space-sm
  padding: 16, // 取自設計稿 --space-md
  paddingLG: 24, // 取自設計稿 --space-lg
  paddingXL: 32, // 取自設計稿 --space-xl
  marginXXS: 4, // 取自設計稿 --margin-xxs
  marginXS: 8, // 取自設計稿 --margin-xs
  marginSM: 12, // 取自設計稿 --margin-sm
  margin: 16, // 取自設計稿 --margin-md
  marginLG: 24, // 取自設計稿 --margin-lg
  marginXL: 32, // 取自設計稿 --margin-xl
  marginXXL: 48, // 取自設計稿 --margin-xxl
};

// 版型（Layout）專屬 token：對應設計稿 layout-metrics／brand 規範，側邊欄與頂欄採淺色（非 antd 預設深色 Sider）。
const themeComponents: ThemeConfig['components'] = {
  Layout: {
    siderBg: '#ffffff', // 取自設計稿 --sider-bg
    headerBg: '#ffffff', // 取自設計稿 --header-bg
    headerHeight: 64, // 取自設計稿 --layout-header-height
    triggerBg: '#ffffff',
    triggerColor: 'rgba(0, 0, 0, 0.45)',
    lightTriggerBg: '#ffffff',
    lightTriggerColor: 'rgba(0, 0, 0, 0.45)',
  },
};

export default function App() {
  return (
    <ConfigProvider locale={zhTW} theme={{ token: themeToken, components: themeComponents }}>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
