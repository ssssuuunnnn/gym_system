整個 App 的版型外框：左側依角色顯示選單（`role="admin"` 8 項，含「系統設定」/
`role="member"` 3 項）、頂部黏著式頁首。內容捲動時傳入 `scrolled` 讓頁首轉為毛玻璃
（`backdrop-filter` + `--shadow-header`）。側邊欄可收合（內建 state，`defaultCollapsed`
設定初始值）。

側欄品牌區塊（LOGO + 名稱）由 `brandName`/`brandLogoUrl` 控制：提供 `brandLogoUrl` 時顯示
28×28 圖片徽章，否則以 `brandName` 首字作為文字徽章；兩者皆為選填，預設品牌名稱為
「健身工作室管理系統」。正式 App 中這兩個值取自「系統設定」頁維護的公司名稱／顯示簡稱／LOGO。

受控元件 —— 路由與登入狀態由父層透過 props 提供。正式 App 中 `activeKey` 接
`useLocation().pathname`、`onNavigate` 接 `useNavigate()`、`username`/`role`/`isCoach` 取自 auth store。

```jsx
<AppLayout
  role="admin"
  username="王小明"
  activeKey="/admin/dashboard"
  scrolled={scrolled}
  brandName="極限健身"
  brandLogoUrl="/media/system/logo.png"
  onNavigate={(key) => navigate(key)}
  onLogout={logout}
>
  <PageContent />
</AppLayout>
```
