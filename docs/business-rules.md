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

### R3. 取消期限外取消會退堂

- **規則**：取消「待確認」的預約，或在取消期限之前取消「已確認」的預約，退回該預約扣掉的堂數。期限內取消見 R8。
- **確認日期**：2026-10-24（原為「一律退堂」，同日因加入取消期限改為本條）
- **實作**：`routers/reservations.py` 的 `cancel_reservation` → `services/hours.py` 的 `refund_reservation`
- **測試**：`test_cancel_refunds_exactly_one_hour`、`test_repeated_booking_and_cancel_never_inflates_hours`、`test_cancel_before_deadline_refunds`、`test_pending_reservation_always_refunds`

### R8. 取消期限：期限內取消可以取消，但不退堂

- **規則**：
  - 已確認的預約在開課前 N 小時內取消，仍可取消，但這堂不退回，預約標記「晚取消」。
  - N 在「系統設定 → 預約規則 → 取消期限」設定，**預設 12 小時**；設為 0 表示不限制。
  - 「待確認」的預約工作室尚未接受，任何時候取消都退堂。
  - 管理員取消期限內的預約時，可例外選擇退堂。
  - 學員在已確認的課程開始後不能自行取消（應由教練／管理員標記未到）。
- **確認日期**：2026-10-24
- **實作**：`services/booking_rules.py` 的 `is_late_cancel`、`has_started`；`routers/reservations.py` 的 `cancel_reservation`；`system_settings.cancel_deadline_hours`
- **測試**：`test_late_cancel_keeps_hours_deducted`、`test_deadline_zero_means_no_limit`、`test_deadline_setting_is_used`、`test_admin_can_override_refund_on_late_cancel`、`test_member_cannot_override_refund`、`test_member_cannot_cancel_after_class_started`

---

## 簽到與出席

### R9. 未到照扣不退

- **規則**：只有「已確認」的預約可標記出席狀態（已出席／未到）。已出席與未到都維持已扣的堂數，不退回。已標記出席狀態的預約不能取消。
- **確認日期**：2026-10-24
- **實作**：`routers/reservations.py` 的 `mark_attendance`、`cancel_reservation`
- **測試**：`test_coach_marks_no_show_and_hours_stay_deducted`、`test_member_self_check_in_within_window`、`test_checked_in_reservation_cannot_be_cancelled`

### R10. 學員可自行簽到，教練與管理員可簽到或標記未到

- **規則**：
  - **學員本人**：開課前 30 分鐘到下課之間，可為自己的預約標記「已出席」；不能標記未到，標記後不能自行更改。下課時間依團體課程的單堂時長，沒有課程則為 60 分鐘。
  - **教練**：可為自己帶的預約（預約指定該教練，或預約的團體課程由該教練授課）標記已出席或未到。
  - **管理員**：可為任何預約標記。
  - 教練與管理員從開課前 30 分鐘起可標記，之後不限時間，方便補登或更正；「未到」需在開課後才能標記。
- **確認日期**：2026-10-24（學員自行簽到的時間窗為實作時訂定）
- **實作**：`services/booking_rules.py` 的 `self_check_in_open`、`staff_check_in_open`；`routers/reservations.py` 的 `mark_attendance`、`list_coaching_reservations`；前端 `MyBookings`、`BookingReviewList`、`CoachAttendance`（教練「學員簽到」頁）
- **測試**：`test_member_self_check_in_outside_window`、`test_member_cannot_mark_no_show_or_change`、`test_member_cannot_check_in_for_others`、`test_course_duration_extends_self_check_in_window`、`test_coach_of_group_course_can_check_in`、`test_other_coach_cannot_check_in`、`test_no_show_only_after_class_started`、`test_staff_cannot_check_in_too_early`、`test_staff_can_correct_later`

---

## 教練鐘點結算

### R14. 教練分三種類型

- **規則**：
  - **私人教練**：隸屬公司，私人課依「私人課每堂鐘點費」計費，費率由公司與教練個別議定，設在教練資料。
  - **團體課程教練**：隸屬公司，團體課依該課程設定的「每堂教練費」計費，設在團體課程上。
  - **場租教練**：不屬於公司，來租借場地。系統不計鐘點，指定場租教練的私人課（場租教練自己的學員）工作室也不付鐘點。
  - 類型可以複選（例如同時是私人教練與團體課程教練），但場租教練不能與另外兩種並存。
  - 團體課程只能指定團體課程教練；既有課程的教練類型若事後變更，課程仍可沿用原教練存檔。
  - 系統導入類型前已建立的教練，預設為私人教練。
- **確認日期**：2026-10-24（「場租教練不能與其他類型並存」、「既有課程沿用原教練」為實作時訂定）
- **實作**：`coaches.is_private_coach／is_group_coach／is_rental_coach`、`courses.coach_fee`；`schemas/coach.py` 的 `_validate_types`；`routers/courses.py` 的 `_check_group_coach`；前端 `CoachForm`、`CourseForm`
- **測試**：`test_coach_types_validation`、`test_default_coach_type_is_private`、`test_course_requires_group_coach`、`test_existing_course_keeps_coach_after_type_change`、`test_rental_coach_not_paid_and_not_listed`、`test_group_only_coach_gets_no_private_fee`

### R11. 已出席＋未到計入鐘點，晚取消不算

- **規則**：只計「已確認」且出席狀態為「已出席」或「未到」的預約（學員未到，教練仍有到場）。晚取消、未簽到、待確認、已拒絕都不算。場租教練以會員身份為自己預約的場地（預約人是教練本人）不算鐘點。
- **教練歸屬**：有團體課程的預約歸該課程的授課教練；其餘（私人課）歸預約指定的教練，且該教練須為私人教練（R14）。
- **確認日期**：2026-10-24（排除教練自己租場地為實作時訂定）
- **實作**：`services/payouts.py` 的 `billable_units`
- **測試**：`test_counts_attended_and_no_show_only`、`test_group_course_goes_to_course_coach_not_reservation_coach`、`test_coach_own_rental_not_counted`、`test_month_boundaries`

### R12. 私人課依教練費率、團體課依課程教練費，團體課一堂算一次

- **規則**：
  - **私人課**：一筆預約算一堂，每堂費用＝教練的「私人課每堂鐘點費」（教練資料設定，預設 0）。
  - **團體課**：同一課程、同日、同時段不論幾位學員算一堂，每堂費用＝該課程的「每堂教練費」（課程設定，預設 0）。
  - 鐘點費＝各堂費用加總；月份依預約日期。費用為 0 的堂數會在總表提示「費用未設定」。
- **確認日期**：2026-10-24（原為「每位教練一個費率」，同日依教練類型改為本條）
- **實作**：`coaches.session_rate`、`courses.coach_fee`；`services/payouts.py`
- **測試**：`test_group_course_counts_once_per_session`、`test_group_fee_comes_from_course`、`test_settle_snapshots_rate_and_items`、`test_zero_fee_flag`

### R13. 月結鎖定，可標記已撥款

- **規則**：
  - 月份結束後才能結算（依工作室當地日期）；同一教練同月只能有一筆結算，沒有計費堂數的月份不能結算。
  - 結算時把堂數、每堂費用、金額與明細存成快照；之後修改出席紀錄、教練費率或課程教練費都不影響已結算金額。總表會在即時計算與快照不一致時標示「有異動」。
  - 已結算尚未撥款時可取消結算後重算；標記已撥款（可填備註）後就不能再取消。
  - 教練可在「我的鐘點」看到自己已結算的紀錄與明細，看不到其他教練的。
- **確認日期**：2026-10-24（「只能結算已結束的月份」為實作時訂定）
- **實作**：`routers/coach_payouts.py`；前端 `CoachPayouts`（管理員「教練鐘點」）、`MyPayouts`（教練「我的鐘點」）
- **測試**：`test_attendance_change_after_settlement_is_flagged`、`test_cannot_settle_current_month`、`test_cannot_settle_twice`、`test_cannot_settle_empty_month`、`test_mark_paid_then_cannot_void`、`test_void_and_resettle`、`test_coach_sees_only_own_payouts`

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

以下為實作上的保證，支撐 R1–R3 與 R8，修改時不可破壞：

- **時間以工作室當地時間判斷**：預約的日期＋時段是工作室當地時間（`STUDIO_TIMEZONE`，預設 Asia/Taipei）。

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
