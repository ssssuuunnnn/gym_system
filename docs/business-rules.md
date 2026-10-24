# 業務規則紀錄

記錄已與業主確認的業務規則，作為實作與測試的依據。程式邏輯若要改變這些規則，請先在這裡更新（含日期與原因），再改程式與測試。

每條規則標示：**確認日期**、**實作位置**、**測試**。

---

## 堂數扣抵與退回

### R1. 一筆預約扣 1 堂，與人數無關

- **規則**：每筆預約（一個 60 分鐘時段）若有指定購買紀錄，固定扣抵 1 堂；`people_count`（人數）不影響扣抵量。
- **確認日期**：2026-10-24
- **實作**：`backend/app/services/hours.py` 的 `HOURS_PER_RESERVATION` / `hours_for_reservation()`。若日後改為依人數扣抵，只需修改此函式。
- **測試**：`test_member_booking_deducts_one_hour`、`test_admin_created_booking_also_deducts`

### R2. 送出申請時就先扣堂，被拒絕再退回

- **規則**：
  - 會員送出預約申請（狀態「待確認」）時立即扣堂，保留堂數，避免同一份堂數被重複預約。
  - 管理員建立預約（狀態直接「已確認」）同樣立即扣堂。
  - 管理員「拒絕」時退回；「核准」時不再異動堂數。
  - 只有「待確認」的預約可以審核。
- **確認日期**：2026-10-24
- **實作**：`routers/reservations.py` 的 `create_reservation`、`review_reservation`；`services/hours.py` 的 `deduct_for_reservation`、`refund_reservation`
- **測試**：`test_reject_refunds`、`test_confirm_keeps_deduction`、`test_cannot_review_a_cancelled_reservation`

### R3. 取消一律退堂

- **規則**：會員或管理員取消「待確認」或「已確認」的預約時，一律退回該預約扣掉的堂數，不論距離上課多久。目前**沒有**「開課前 N 小時內取消不退」的規則。
- **確認日期**：2026-10-24
- **實作**：`routers/reservations.py` 的 `cancel_reservation` → `services/hours.py` 的 `refund_reservation`
- **測試**：`test_cancel_refunds_exactly_one_hour`、`test_repeated_booking_and_cancel_never_inflates_hours`
- **備註**：若之後要加入取消期限，預計放在「系統設定」，屆時更新本條。

---

## 堂數帳務的共通原則

以下為實作上的保證，支撐 R1–R3，修改時不可破壞：

- **退回量＝實際扣掉的量**：依該預約在 `hour_ledger` 的淨額退回，重複取消或拒絕後再取消都不會多退。
- **預約與扣堂同一交易**：堂數不足（400「剩餘堂數不足」）時預約不成立，不留下沒扣到堂數的預約。
- **可扣抵的購買紀錄**：必須屬於該會員、不是用品、且與預約的商品相同。
- **可不指定購買紀錄**：預約可以不選購買紀錄（例如體驗課），此時不扣堂。
- **所有堂數變動都留紀錄**：`purchases.remaining_hours` 只能透過 `services/hours.py` 修改，每次都寫一筆 `hour_ledger`；任一筆購買的異動加總恆等於剩餘堂數。
- **手動調整需註明原因**：管理員以 `POST /purchases/{id}/adjust` 補扣堂數，必須填寫原因，調整後不可小於 0。

---

## 尚未定案

- 加購臨時加人（`reservation_addons`）是否扣堂、怎麼扣
- 會員自助購買的付款狀態：目前購買即入帳堂數，尚無「待付款／已付款」
- 方案效期：購買紀錄是否有到期日、過期堂數如何處理
- 未到（no-show）是否扣堂
