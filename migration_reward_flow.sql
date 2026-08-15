-- ============================================================
-- MIGRATION: Quy trình đổi/trao phần thưởng v2
-- Chạy TOÀN BỘ file này trong Supabase SQL Editor TRƯỚC KHI deploy app.js mới.
--
-- Thay đổi chính:
--   1. Trạng thái đơn quà chuyển từ tiền tố trong description sang bảng riêng
--      reward_redemptions (có cột status thật + mốc thời gian từng bước).
--   2. Thêm tồn kho / giới hạn mỗi tuần / bật-tắt cho rewards.
--   3. Thêm 3 hàm RPC atomic cho các thao tác có dịch chuyển điểm.
--
-- Bảng transactions GIỮ NGUYÊN vai trò sổ điểm. Bảng mới chỉ giữ trạng thái đơn.
-- ============================================================

-- ------------------------------------------------------------
-- PHẦN 1: Cột mới cho rewards
-- ------------------------------------------------------------
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS stock INTEGER;             -- NULL = không giới hạn
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS max_per_week INTEGER;      -- NULL = không giới hạn
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

-- ------------------------------------------------------------
-- PHẦN 2: Bảng trạng thái đơn
-- ------------------------------------------------------------
-- kind = 'spend' : user đổi quà bằng điểm
--        pending_delivery -> delivered -> completed
--        pending_delivery | delivered -> cancelled (hoàn điểm)
-- kind = 'grant' : admin tặng điểm thưởng
--        pending_claim -> claimed
--        pending_claim -> revoked (thu hồi, chưa cộng điểm nên không cần hoàn)
CREATE TABLE IF NOT EXISTS reward_redemptions (
    id            BIGSERIAL PRIMARY KEY,
    family_id     UUID,
    username      TEXT NOT NULL,
    reward_id     UUID,
    reward_name   TEXT NOT NULL,
    cost          INTEGER NOT NULL DEFAULT 0,
    kind          TEXT NOT NULL DEFAULT 'spend',
    status        TEXT NOT NULL DEFAULT 'pending_delivery',
    user_note     TEXT,
    admin_note    TEXT,
    created_by    TEXT,
    handled_by    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    delivered_at  TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    cancelled_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_redemptions_family_status ON reward_redemptions (family_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_user          ON reward_redemptions (username, created_at DESC);

-- ------------------------------------------------------------
-- PHẦN 3: Chuyển dữ liệu cũ sang bảng mới
-- Đọc ngược từ tiền tố trong transactions.description.
-- Chạy lại nhiều lần cũng an toàn nhờ NOT EXISTS.
-- ------------------------------------------------------------

-- 3a. Đơn đổi quà đang chờ trao
INSERT INTO reward_redemptions (family_id, username, reward_name, cost, kind, status, created_by, created_at)
SELECT u.family_id, t.username,
       trim(replace(t.description, '[Chờ trao] Đổi quà: ', '')),
       t.amount, 'spend', 'pending_delivery', t.username, t.created_at
FROM transactions t LEFT JOIN users u ON u.username = t.username
WHERE t.type = 'Spend' AND t.description LIKE '[Chờ trao] Đổi quà: %'
  AND NOT EXISTS (SELECT 1 FROM reward_redemptions r
                  WHERE r.username = t.username AND r.created_at = t.created_at AND r.kind = 'spend');

-- 3b. Đơn đã trao, chờ người nhận xác nhận
INSERT INTO reward_redemptions (family_id, username, reward_name, cost, kind, status, created_by, created_at, delivered_at)
SELECT u.family_id, t.username,
       trim(replace(t.description, '[Đã trao] Đổi quà: ', '')),
       t.amount, 'spend', 'delivered', t.username, t.created_at, t.created_at
FROM transactions t LEFT JOIN users u ON u.username = t.username
WHERE t.type = 'Spend' AND t.description LIKE '[Đã trao] Đổi quà: %'
  AND NOT EXISTS (SELECT 1 FROM reward_redemptions r
                  WHERE r.username = t.username AND r.created_at = t.created_at AND r.kind = 'spend');

-- 3c. Đơn đã hoàn tất (mô tả không còn tiền tố)
INSERT INTO reward_redemptions (family_id, username, reward_name, cost, kind, status, created_by, created_at, delivered_at, completed_at)
SELECT u.family_id, t.username,
       trim(replace(t.description, 'Đổi quà: ', '')),
       t.amount, 'spend', 'completed', t.username, t.created_at, t.created_at, t.created_at
FROM transactions t LEFT JOIN users u ON u.username = t.username
WHERE t.type = 'Spend' AND t.description LIKE 'Đổi quà: %'
  AND NOT EXISTS (SELECT 1 FROM reward_redemptions r
                  WHERE r.username = t.username AND r.created_at = t.created_at AND r.kind = 'spend');

-- 3d. Đơn đã huỷ (nếu đã chạy bản vá trước đó)
INSERT INTO reward_redemptions (family_id, username, reward_name, cost, kind, status, created_by, created_at, cancelled_at)
SELECT u.family_id, t.username,
       trim(replace(t.description, '[Đã huỷ] Đổi quà: ', '')),
       t.amount, 'spend', 'cancelled', t.username, t.created_at, t.created_at
FROM transactions t LEFT JOIN users u ON u.username = t.username
WHERE t.type = 'Cancelled'
  AND NOT EXISTS (SELECT 1 FROM reward_redemptions r
                  WHERE r.username = t.username AND r.created_at = t.created_at AND r.kind = 'spend');

-- 3e. Điểm thưởng đã trao, người nhận chưa bấm nhận
INSERT INTO reward_redemptions (family_id, username, reward_name, cost, kind, status, created_at)
SELECT u.family_id, t.username,
       trim(replace(t.description, '[Chờ nhận] Thưởng điểm: ', '')),
       t.amount, 'grant', 'pending_claim', t.created_at
FROM transactions t LEFT JOIN users u ON u.username = t.username
WHERE t.type = 'Bonus_Pending'
  AND NOT EXISTS (SELECT 1 FROM reward_redemptions r
                  WHERE r.username = t.username AND r.created_at = t.created_at AND r.kind = 'grant');

-- 3f. Điểm thưởng đã nhận
INSERT INTO reward_redemptions (family_id, username, reward_name, cost, kind, status, created_at, completed_at)
SELECT u.family_id, t.username,
       trim(replace(t.description, 'Thưởng điểm: ', '')),
       t.amount, 'grant', 'claimed', t.created_at, t.created_at
FROM transactions t LEFT JOIN users u ON u.username = t.username
WHERE t.type = 'Earn' AND t.description LIKE 'Thưởng điểm: %'
  AND NOT EXISTS (SELECT 1 FROM reward_redemptions r
                  WHERE r.username = t.username AND r.created_at = t.created_at AND r.kind = 'grant');

-- 3g. DỌN DẸP - đọc kỹ trước khi chạy.
-- Các dòng Bonus_Pending KHÔNG phải giao dịch điểm thật (chưa cộng điểm cho ai),
-- chúng chỉ là cờ đánh dấu "đang chờ nhận" của hệ thống cũ. Thông tin đã được
-- chép sang reward_redemptions ở bước 3e. Nếu không xoá, mỗi khoản chờ nhận sẽ
-- hiện 2 lần trong app.
-- Muốn kiểm tra trước thì chạy dòng SELECT, thấy khớp với 3e rồi hãy chạy DELETE.
-- SELECT * FROM transactions WHERE type = 'Bonus_Pending';
DELETE FROM transactions WHERE type = 'Bonus_Pending';

-- ------------------------------------------------------------
-- PHẦN 4: Hàm RPC atomic
-- Điểm và trạng thái đơn đổi trong cùng một transaction DB, nên không còn
-- cảnh trừ được điểm nhưng không ghi được đơn (hoặc ngược lại).
-- LƯU Ý: app không dùng Supabase Auth nên các hàm này nhận p_username từ client.
-- Chúng đảm bảo TÍNH TOÀN VẸN (không double-credit, không âm điểm, không vượt
-- tồn kho) chứ KHÔNG đảm bảo danh tính. Muốn chống gian lận thật thì phải bật
-- Supabase Auth + RLS.
-- ------------------------------------------------------------

-- 4a. Đổi quà
CREATE OR REPLACE FUNCTION redeem_reward(p_username TEXT, p_reward_id UUID, p_note TEXT DEFAULT NULL)
RETURNS TABLE (redemption_id BIGINT, new_points INTEGER) AS $$
DECLARE
    v_reward rewards%ROWTYPE;
    v_points INTEGER;
    v_cost   INTEGER;
    v_used   INTEGER;
    v_id     BIGINT;
BEGIN
    SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_NOT_FOUND'; END IF;
    IF COALESCE(v_reward.is_point_reward, FALSE) THEN RAISE EXCEPTION 'NOT_REDEEMABLE'; END IF;
    IF COALESCE(v_reward.active, TRUE) = FALSE THEN RAISE EXCEPTION 'REWARD_INACTIVE'; END IF;

    v_cost := COALESCE(v_reward.cost, 0)::INTEGER;
    IF v_cost <= 0 THEN RAISE EXCEPTION 'INVALID_COST'; END IF;

    -- Khoá dòng user để 2 thiết bị không cùng tiêu một số điểm.
    SELECT COALESCE(points, 0) INTO v_points FROM users WHERE username = p_username FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
    IF v_points < v_cost THEN RAISE EXCEPTION 'NOT_ENOUGH_POINTS:%', v_cost - v_points; END IF;

    IF v_reward.max_per_week IS NOT NULL THEN
        SELECT COUNT(*) INTO v_used FROM reward_redemptions
         WHERE username = p_username AND reward_id = p_reward_id AND kind = 'spend'
           AND status <> 'cancelled' AND created_at >= date_trunc('week', NOW());
        IF v_used >= v_reward.max_per_week THEN
            RAISE EXCEPTION 'WEEKLY_LIMIT:%', v_reward.max_per_week;
        END IF;
    END IF;

    IF v_reward.stock IS NOT NULL THEN
        IF v_reward.stock <= 0 THEN RAISE EXCEPTION 'OUT_OF_STOCK'; END IF;
        UPDATE rewards SET stock = stock - 1 WHERE id = p_reward_id;
    END IF;

    UPDATE users SET points = points - v_cost WHERE username = p_username RETURNING points INTO v_points;

    INSERT INTO reward_redemptions (family_id, username, reward_id, reward_name, cost, kind, status, user_note, created_by)
    VALUES (v_reward.family_id, p_username, p_reward_id, v_reward.reward_name, v_cost, 'spend', 'pending_delivery', NULLIF(trim(COALESCE(p_note, '')), ''), p_username)
    RETURNING id INTO v_id;

    INSERT INTO transactions (username, type, amount, description)
    VALUES (p_username, 'Spend', v_cost, 'Đổi quà: ' || v_reward.reward_name);

    RETURN QUERY SELECT v_id, v_points;
END;
$$ LANGUAGE plpgsql;

-- 4b. Huỷ đơn & hoàn điểm
CREATE OR REPLACE FUNCTION cancel_redemption(p_id BIGINT, p_actor TEXT, p_reason TEXT DEFAULT NULL)
RETURNS TABLE (refunded INTEGER, new_points INTEGER) AS $$
DECLARE
    r reward_redemptions%ROWTYPE;
    v_points INTEGER;
BEGIN
    SELECT * INTO r FROM reward_redemptions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF r.kind <> 'spend' THEN RAISE EXCEPTION 'WRONG_KIND'; END IF;
    IF r.status NOT IN ('pending_delivery', 'delivered') THEN RAISE EXCEPTION 'ALREADY_CLOSED'; END IF;

    UPDATE reward_redemptions
       SET status = 'cancelled', cancelled_at = NOW(), handled_by = p_actor,
           admin_note = COALESCE(NULLIF(trim(COALESCE(p_reason, '')), ''), admin_note)
     WHERE id = p_id;

    UPDATE users SET points = COALESCE(points, 0) + r.cost WHERE username = r.username RETURNING points INTO v_points;

    INSERT INTO transactions (username, type, amount, description)
    VALUES (r.username, 'Refund', r.cost, 'Hoàn điểm: ' || r.reward_name);

    -- Trả lại tồn kho nếu món đó có quản lý số lượng.
    IF r.reward_id IS NOT NULL THEN
        UPDATE rewards SET stock = stock + 1 WHERE id = r.reward_id AND stock IS NOT NULL;
    END IF;

    RETURN QUERY SELECT r.cost, v_points;
END;
$$ LANGUAGE plpgsql;

-- 4c. Nhận điểm thưởng
CREATE OR REPLACE FUNCTION claim_point_grant(p_id BIGINT, p_username TEXT)
RETURNS TABLE (granted INTEGER, new_points INTEGER) AS $$
DECLARE
    r reward_redemptions%ROWTYPE;
    v_points INTEGER;
BEGIN
    SELECT * INTO r FROM reward_redemptions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF r.kind <> 'grant' THEN RAISE EXCEPTION 'WRONG_KIND'; END IF;
    IF r.username <> p_username THEN RAISE EXCEPTION 'NOT_YOURS'; END IF;
    IF r.status <> 'pending_claim' THEN RAISE EXCEPTION 'ALREADY_CLAIMED'; END IF;

    UPDATE reward_redemptions SET status = 'claimed', completed_at = NOW() WHERE id = p_id;
    UPDATE users SET points = COALESCE(points, 0) + r.cost WHERE username = r.username RETURNING points INTO v_points;

    INSERT INTO transactions (username, type, amount, description)
    VALUES (r.username, 'Earn', r.cost, 'Thưởng điểm: ' || r.reward_name);

    RETURN QUERY SELECT r.cost, v_points;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- XONG. Kiểm tra nhanh:
--   SELECT kind, status, COUNT(*) FROM reward_redemptions GROUP BY 1,2 ORDER BY 1,2;
--   SELECT routine_name FROM information_schema.routines
--    WHERE routine_name IN ('redeem_reward','cancel_redemption','claim_point_grant');
-- ============================================================
