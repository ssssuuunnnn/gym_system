預約狀態標籤。固定對應 `reservations.status` 的四個值，語意色不需自行指定：
待確認 → `warning`、已確認 → `success`、已拒絕 → `error`、已取消 → `default`。
用於預約審核列表、我的預約、預約明細等畫面的「狀態」欄。

```jsx
<StatusTag status="已確認" />
```
