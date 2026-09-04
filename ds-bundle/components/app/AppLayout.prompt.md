整個 App 的版型外框：左側依角色顯示選單（`role="admin"` 7 項 / `role="member"` 3 項）、
頂部黏著式頁首。內容捲動時傳入 `scrolled` 讓頁首轉為毛玻璃（`backdrop-filter` + `--shadow-header`）。
側邊欄可收合（內建 state，`defaultCollapsed` 設定初始值）。

受控元件 —— 路由與登入狀態由父層透過 props 提供。正式 App 中 `activeKey` 接
`useLocation().pathname`、`onNavigate` 接 `useNavigate()`、`username`/`role`/`isCoach` 取自 auth store。

```jsx
<AppLayout
  role="admin"
  username="王小明"
  activeKey="/admin/dashboard"
  scrolled={scrolled}
  onNavigate={(key) => navigate(key)}
  onLogout={logout}
>
  <PageContent />
</AppLayout>
```
