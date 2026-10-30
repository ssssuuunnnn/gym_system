import { useEffect } from 'react';
import { useTerms } from './terms';

/** 設定瀏覽器分頁標題；title 還沒準備好（undefined）時不動 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}

/**
 * 健身房（店家）網址上的分頁標題：用這家店的名稱（系統設定的簡稱或公司名稱），
 * 可加上區域，例如「小美美體館｜管理後台」。登入前就讀得到（GET /tenant/profile 不需登入）。
 */
export function useShopTitle(section?: string) {
  const { shopName } = useTerms();
  usePageTitle(shopName ? (section ? `${shopName}｜${section}` : shopName) : undefined);
}
