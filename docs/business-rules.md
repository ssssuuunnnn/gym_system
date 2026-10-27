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

## 前台預約

### R15. 預約時由系統自動選定扣抵的方案

- **規則**：
  - 會員在前台「預約課程」不需要自己選購買紀錄，系統自動選定要扣 1 堂的方案：
    - **團體課**：已付款、仍有堂數，且商品綁定這門團體課程的方案。
    - **私人課**：已付款、仍有堂數的「課程」類方案；有多個時可在確認面板切換，並需選擇私人教練。
  - 有多個符合的方案時，**先用最早購買的**。
  - 沒有可用方案時，確認面板改為引導「購買方案」。
  - 前台只列出未開始的課堂；額滿（待確認＋已確認人數達上限）的團體課不能預約。
- **確認日期**：2026-10-24（方案選擇順序與額滿計算方式為實作時訂定）
- **實作**：前台 `pages/member/Book`；後端 `GET /courses/schedule`
- **測試**：`tests/test_schedule.py`

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

## 形象網站與體驗課詢問

設計見 `docs/adr/0003-gym-website.md`；外觀依 2026-10-25 確認的設計稿。

### R16. 網站只顯示公開欄位

- **確認日期**：2026-10-25
- **規則**：教練只顯示授課名稱（沒有時用姓名）、專長、照片與網站自我介紹；電話、LINE、匯款帳號、鐘點費不公開。課程不顯示教練費。教練與方案要在後台勾選才會公開；停售的方案不顯示。場租教練預設不勾選。
- **實作**：`routers/site.py` 的 `_coaches`、`_plans`（只把白名單欄位交給樣板）
- **測試**：`test_only_public_fields_reach_the_page`

### R17. 草稿與發布分開

- **確認日期**：2026-10-25
- **規則**：後台修改先存成草稿，訪客看不到；按「發布到網站」才上線。可以捨棄草稿（回到線上版本）或讓網站下線（首頁回到登入頁）。從未發布的健身房，首頁就是登入頁。
- **實作**：`routers/website.py`
- **測試**：`test_draft_preview_and_discard`、`test_unpublish`、`test_unpublished_site_redirects_to_login`

### R18. 體驗課詢問必須同意個資告知，未成為會員者保存 6 個月

- **確認日期**：2026-10-25
- **規則**：表單必須勾選同意個人資料蒐集告知事項才能送出（記錄同意時間）。沒有成為會員的詢問，送出 6 個月後自動刪除；已建立會員帳號的保留。
- **實作**：`routers/site.py` 的 `submit_inquiry`、`routers/inquiries.py` 的 `purge_expired`
- **測試**：`test_inquiry_validation_and_spam_guards`、`test_retention_purges_old_non_members`

### R19. 課表的剩餘名額預設顯示，可關閉

- **確認日期**：2026-10-25（預設值，待營運回饋）
- **規則**：團體課表顯示「剩 N 位／已額滿」，名額算法同會員預約（待確認＋已確認）。健身房可在「團體課表」段落關閉，只顯示課名、時間與教練。
- **實作**：`services/schedule.py`、`routers/site.py` 的 `_schedule_days`
- **測試**：`test_schedule_and_seats`

---

## LINE 通知店家

### R20. 接收人以一次性綁定碼加入

- **確認日期**：2026-10-25
- **規則**：管理員在「系統設定 › LINE 通知」產生 6 位數綁定碼（10 分鐘內有效、只能使用一次、資料庫只存雜湊），接收人加平台通知帳號為好友後傳送綁定碼即完成綁定，預設接收全部三種通知。同一 LINE 帳號 10 分鐘內輸入錯誤 5 次即暫停 10 分鐘。綁定碼剛好同時對應兩家健身房時不綁定，請對方重新產生。接收人封鎖通知帳號時自動停止通知；後台「移除」也只是停用，可用新綁定碼重新加入。
- **實作**：`routers/line.py`、`routers/line_webhook.py`、migration `0004` 的 `line_consume_bind_code`／`line_deactivate_user`
- **測試**：`test_settings_and_bind_code`、`test_bind_by_code`、`test_expired_and_ambiguous_codes`、`test_bind_attempt_rate_limit`

### R21. 三種事件才通知，管理員自己建立的預約不通知

- **確認日期**：2026-10-25
- **規則**：只在「新的體驗課詢問」「會員自行下單（待付款）」「會員送出預約（待審核）」時通知有勾選該事件的接收人。管理員在後台登錄的購買或預約不通知。
- **實作**：`services/line.py` 的 `notify_*`，呼叫點在 `routers/site.py`、`purchases.py`、`reservations.py`
- **測試**：`test_member_purchase_notifies_subscribers_only`、`test_member_booking_notifies_but_admin_booking_does_not`、`test_nobody_subscribed_creates_nothing`

### R22. 通知內容最少化，不含手機號碼

- **確認日期**：2026-10-25
- **規則**：通知只寫姓氏（王先生／小姐）、想體驗的項目與方便時段、方案與金額、預約項目時間與人數，**不含手機號碼、Email、備註**；完整資料要點連結登入後台查看。訊息送出後，系統清除暫存的收件人與訊息內容，只留事件、則數與結果；平台後台也看不到收件人與內容。
- **實作**：`services/line.py`（`masked_name`、`_finish`）、`platform_line_log`
- **測試**：`test_inquiry_notification_hides_phone`、`test_platform_usage_logs_and_cap`

### R23. 每家健身房每月上限，失敗重試 3 次

- **確認日期**：2026-10-25（預設值，待營運回饋）
- **規則**：一則通知發給幾個人就算幾則。每家健身房每月上限預設 300 則（平台可調整，會寫入操作紀錄），以健身房當地時間的每月 1 日起算；送出會超過上限的通知不發送，記為「超過上限」。LINE 暫時無回應時於 1、5、30 分鐘後重試，仍失敗或 LINE 拒絕則記為「失敗」。平台未設定 LINE 帳號時不發送，記為「未設定 LINE」。
- **實作**：`services/line.py` 的 `_process`、`tenants.line_monthly_cap`
- **測試**：`test_monthly_cap`、`test_retry_then_success_and_permanent_failure`、`test_retries_give_up_after_three`、`test_not_configured_skips`

---

## LINE 官方帳號（會員入口）

### R24. 只有「檢查連線」通過才啟用，金鑰加密且不回傳

- **確認日期**：2026-10-25
- **規則**：健身房填入 Channel secret、access token、登入 Channel ID、LIFF ID 後，必須「檢查連線」通過（access token 有效、LIFF ID 屬於該登入 channel）才啟用；Webhook 與底部選單失敗只提示。改任何設定都會先停用、要重新檢查。金鑰加密保存，畫面只顯示末四碼。
- **實作**：`routers/line_oa.py`、`services/line_oa.py` 的 `run_checks`、`core/crypto.py`
- **測試**：`test_settings_validation_and_encryption`、`test_verify_enables_and_installs_menu`、`test_verify_failures`

### R25. LINE 登入只認自己這家的登入 channel

- **確認日期**：2026-10-25
- **規則**：LIFF 的 ID token 一律向 LINE 驗證，且 client_id 必須是這家健身房的登入 Channel ID；未綁定時發 15 分鐘的 link_token，只能用來加入或綁定、不能呼叫其他 API，也不能拿到別家使用。黑名單會員不能登入。
- **實作**：`routers/line_auth.py`、`core/security.create_line_link_token`
- **測試**：`test_wrong_audience_and_bad_token`、`test_link_token_is_per_gym`、`test_blacklisted_cannot_login`、`test_tenant_isolation`

### R26. 在 LINE 加入會員：姓名＋手機＋同意個資告知，沒有密碼

- **確認日期**：2026-10-25（預設值，待營運回饋）
- **規則**：加入會員只填姓名與手機，必須勾選個人資料告知；帳號自動產生、沒有密碼，只能從 LINE 登入。管理員在會員詳情設定密碼後也能用網頁登入。同一家健身房裡一個 LINE 只能對應一個會員。
- **實作**：`routers/line_auth.py` 的 `line_join`、`models/user.UNUSABLE_PASSWORD`
- **測試**：`test_join_then_login`、`test_admin_member_fields`

### R27. 綁定既有帳號要密碼；沒有密碼的會員不能自己解除綁定

- **確認日期**：2026-10-25
- **規則**：「我已經是會員」必須輸入正確的帳號密碼；管理員帳號不能綁定；已綁定其他 LINE 的帳號要先由櫃台解除。管理員可隨時解除會員的 LINE 綁定；會員自己只有在有密碼時才能解除。
- **實作**：`routers/line_auth.py` 的 `line_link`／`line_unlink`、`routers/users.py` 的 `unlink_line`
- **測試**：`test_link_existing_account`、`test_unlink`

### R28. 會員通知只在「別人替會員做了事」時發

- **確認日期**：2026-10-25（預設值，待營運回饋）
- **規則**：從健身房官方帳號推播給會員的只有：預約審核結果、櫃台代為預約、櫃台取消（寫明是否退堂）、確認收款（寫明入帳堂數）、前一天的上課提醒。會員自己送出、取消、下單不發。只發給已綁定 LINE 且沒關閉通知的會員；健身房可逐項關閉。
- **實作**：`services/line_member.py`，呼叫點在 `routers/reservations.py`（create／review／cancel）、`routers/purchases.py`（confirm-payment）
- **測試**：`test_review_results`、`test_admin_booking_and_cancel`、`test_cancel_shows_refund`、`test_payment_confirmed`、`test_switches_optout_and_unlinked`

### R29. 上課提醒：前一天設定時段內一則，同一天合併

- **確認日期**：2026-10-25（預設值，待營運回饋）
- **規則**：健身房設定前一天幾點提醒（預設 20:00，可選 06–22 點），系統只在該整點起 2 小時內產生；同一位會員明天的所有已確認課程合成一則，每人每天最多一則。
- **實作**：`services/line_member.enqueue_reminders`（`REMINDER_WINDOW_HOURS`）
- **測試**：`test_class_reminders`、`test_reminder_hour_setting`

### R30. 會員通知的上限與失敗

- **確認日期**：2026-10-25
- **規則**：健身房可設每月上限（留空＝不限制），達到後當月不再推播（記為超過上限）。LINE 暫時無回應時 1、5、30 分鐘後重試；LINE 方案額度用完直接記為失敗。發送前若會員已解除綁定或關閉通知則不發。訊息送完清除內容，後台紀錄只有時間、會員、事件與結果。
- **實作**：`services/line_member._process`、`routers/line_oa.py` 的 `/messages`
- **測試**：`test_monthly_cap`、`test_retry_and_quota_exhausted`、`test_unlinked_after_enqueue_is_skipped`、`test_settings_validation_log_and_quota`

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
- 形象網站：多種版型、自訂網域、收到體驗課詢問時的 Email 通知
- LINE 通知：超過平台方案額度的費用分攤
- 線上付款（信用卡、LINE Pay）
