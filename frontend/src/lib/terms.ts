import { useQuery } from '@tanstack/react-query';
import { getTenantProfile, type BusinessType } from '../api/tenant';
import type { ProductCategory } from '../api/products';

/**
 * 行業用詞（ADR 0011、R48）：同一套系統給健身房與美體店用，畫面上的名詞依店家的行業類型切換。
 * 後端的同一份對照表在 backend/app/services/terms.py，兩邊要一起改。
 *
 * 只換「顯示的文字」：API 的值（商品分類「團體課程／課程／用品」、教練類型等）不變，
 * 程式判斷一律用 API 的值，顯示時才用下面的 label 函式轉換。
 */
export interface Terms {
  /** 店家：健身房／店家 */
  business: string;
  systemName: string;
  /** 服務人員：教練／美容師 */
  staff: string;
  /** 服務項目：課程／療程 */
  service: string;
  /** 一對一：私人課／個人療程 */
  private: string;
  /** 多人：團體課 */
  group: string;
  /** 單位：堂／次 */
  unit: string;
  /** 堂數／次數 */
  hours: string;
  /** 上課／到店 */
  attend: string;
  /** 授課／服務（授課分店、授課名稱） */
  teach: string;
  /** 學員／顧客 */
  customer: string;
  /** 簽到／報到 */
  checkIn: string;
  /** 體驗課／體驗療程 */
  trial: string;
  /** 預約課程／預約療程 */
  book: string;
  schedule: string;
  /** 教練鐘點／美容師服務費 */
  staffPay: string;
  /** 商品分類「課程」「用品」的顯示文字 */
  productCourse: string;
  productSupply: string;
  /** 教練類型的顯示文字 */
  privateStaff: string;
  groupStaff: string;
  rentalStaff: string;
}

export const TERMS: Record<BusinessType, Terms> = {
  健身: {
    business: '健身房',
    systemName: '健身工作室管理系統',
    staff: '教練',
    service: '課程',
    private: '私人課',
    group: '團體課',
    unit: '堂',
    hours: '堂數',
    attend: '上課',
    teach: '授課',
    customer: '學員',
    checkIn: '簽到',
    trial: '體驗課',
    book: '預約課程',
    schedule: '課表',
    staffPay: '教練鐘點',
    productCourse: '課程',
    productSupply: '用品',
    privateStaff: '私人教練',
    groupStaff: '團體課程教練',
    rentalStaff: '場租教練',
  },
  美體: {
    business: '店家',
    systemName: '美體工作室管理系統',
    staff: '美容師',
    service: '療程',
    private: '個人療程',
    group: '團體課',
    unit: '次',
    hours: '次數',
    attend: '到店',
    teach: '服務',
    customer: '顧客',
    checkIn: '報到',
    trial: '體驗療程',
    book: '預約療程',
    schedule: '課表',
    staffPay: '美容師服務費',
    productCourse: '療程',
    productSupply: '商品',
    privateStaff: '美容師',
    groupStaff: '團體課程老師',
    rentalStaff: '場地租用',
  },
};

/** 商品分類的顯示文字（API 值不變） */
export function productCategoryLabel(category: ProductCategory, t: Terms): string {
  if (category === '課程') return t.productCourse;
  if (category === '用品') return t.productSupply;
  return category;
}

/** 教練類型的顯示文字（API 值不變） */
export function coachTypeLabel(type: string, t: Terms): string {
  if (type === '私人教練') return t.privateStaff;
  if (type === '團體課程教練') return t.groupStaff;
  if (type === '場租教練') return t.rentalStaff;
  return type;
}

/**
 * 這家店的用詞與功能開關。還沒讀到時先用健身的用詞（舊資料都是健身房）。
 * 和 `['tenant-profile']` 快取共用，系統設定改了團體課程開關時要 invalidate。
 */
export function useTerms() {
  const { data } = useQuery({ queryKey: ['tenant-profile'], queryFn: getTenantProfile, staleTime: 5 * 60_000 });
  const businessType: BusinessType = data?.business_type ?? '健身';
  return {
    t: TERMS[businessType],
    businessType,
    isBeauty: businessType === '美體',
    groupClassesEnabled: data?.group_classes_enabled ?? true,
    /** 店家名稱；還沒讀到時為 undefined */
    shopName: data?.name,
    loaded: data !== undefined,
  };
}
