import { ConfigProvider, App as AntApp } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './router';
import { createPlatformRouter } from './router/platform';
import { isPlatformHost } from './lib/host';
import { TrialGate } from './components/trial/TrialGate';

// platform.<主網域> 是平台管理後台，其他網址都是某家健身房（見 docs/adr/0002-platform-console.md）
// 只建立用得到的那一個 router（建立時就會開始監聽網址）
const onPlatform = isPlatformHost();
const activeRouter = onPlatform ? createPlatformRouter() : createAppRouter();

const queryClient = new QueryClient();

export default function App() {
  return (
    <ConfigProvider
      locale={zhTW}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
          colorLink: '#1677ff',
          colorTextBase: '#000000',
          colorBgLayout: '#f5f5f5',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBorder: '#d9d9d9',
          colorBorderSecondary: '#f0f0f0',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, "Noto Sans", sans-serif',
          fontSize: 14,
          borderRadius: 6,
          borderRadiusSM: 4,
          borderRadiusLG: 8,
        },
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>
          {onPlatform ? (
            <RouterProvider router={activeRouter} />
          ) : (
            // 試用到期的店家整頁換成「請聯絡我們」（docs/adr/0013-trial-signup.md）
            <TrialGate>
              <RouterProvider router={activeRouter} />
            </TrialGate>
          )}
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}
