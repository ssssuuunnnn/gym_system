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

## 購買與付款

### R4. 會員自助購買為「待付款」，確認收款後才入帳堂數

- **確認日期**：2026-10-24
- **規則**：會員在「購買商品」送出後建立訂單，狀態「待付款」、剩餘堂數 0，不能拿來預約。管理員在「購買紀錄」確認收款（必填付款方式，可填備註如轉帳末五碼）後改為「已付款」，並一次入帳購買的總堂數。
- **入帳堂數以下單當下為準**：訂單記錄 `total_hours`（下單時的商品堂數 × 數量），之後商品堂數變動不影響已下的訂單。
- **實作**：`routers/purchases.py` 的 `create_self_purchase`、`confirm_payment`；`services/hours.py` 的 `record_purchase`、`deduct_for_reservation`（拒絕未付款的購買紀錄）
- **測試**：`test_self_purchase_starts_unpaid_without_hours`、`test_confirm_payment_credits_hours`、`test_confirm_uses_hours_at_order_time`、`test_unpaid_purchase_cannot_be_used_for_booking`

### R5. 管理員登錄購買視為已收款

- **確認日期**：2026-10-24
- **規則**：管理員在「購買紀錄登錄」建立的購買，代表櫃台已收款，建立即為「已付款」並立即入帳；付款方式必填。
- **實作**：`routers/purchases.py` 的 `create_purchase`；前端 `PurchaseEntry`
- **測試**：`test_admin_entry_is_paid_immediately`

### R6. 用品下單即保留庫存，取消時歸還

- **確認日期**：2026-10-24
- **規則**：用品訂單在下單（含待付款）時就扣庫存，避免超賣；待付款訂單取消時歸還庫存。
- **實作**：`routers/purchases.py` 的 `_build_purchase`、`cancel_purchase`
- **測試**：`test_supply_stock_reserved_on_order_and_returned_on_cancel`、`test_supply_confirm_keeps_stock_deducted`

### R7. 只有「待付款」可取消，已付款暫不處理退款

- **確認日期**：2026-10-24
- **規則**：管理員可取消任一筆、會員可取消自己的待付款訂單。已付款訂單不能取消；退款流程尚未定義。待付款與已取消的訂單不可手動調整堂數。
- **實作**：`routers/purchases.py` 的 `cancel_purchase`、`adjust_purchase_hours`
- **測試**：`test_member_can_cancel_own_unpaid_order`、`test_cannot_cancel_paid_order`、`test_cannot_confirm_cancelled_order`、`test_cannot_adjust_unpaid_purchase`

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
- 已付款訂單的退款流程（退款金額、已使用堂數如何計算）
- 待付款訂單是否逾時自動取消
- 方案效期：購買紀錄是否有到期日、過期堂數如何處理
- 未到（no-show）是否扣堂
