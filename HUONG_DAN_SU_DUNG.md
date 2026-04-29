# 📖 Hướng Dẫn Sử Dụng - Quản Lý Việc Nhà

> **Phiên bản:** 2.0 (Multi-Family)  
> **Cập nhật lần cuối:** 29/04/2026

---

## 📑 Mục Lục

1. [Giới thiệu](#-giới-thiệu)
2. [Đăng nhập & Đăng xuất](#-đăng-nhập--đăng-xuất)
3. [Hệ thống vai trò](#-hệ-thống-vai-trò)
4. [Trang chủ](#-trang-chủ---công-việc-hôm-nay)
5. [Báo cáo & Thống kê](#-báo-cáo--thống-kê)
6. [Lịch sử hoạt động](#-lịch-sử-hoạt-động)
7. [Quản trị (Admin/Mod)](#-quản-trị-adminmod)
8. [Quản lý Gia đình (Super Admin)](#-quản-lý-gia-đình-super-admin)
9. [Đổi giao diện (Theme)](#-đổi-giao-diện-theme)
10. [Câu hỏi thường gặp (FAQ)](#-câu-hỏi-thường-gặp-faq)

---

## 🏠 Giới Thiệu

**Quản Lý Việc Nhà** là ứng dụng web giúp các gia đình tổ chức, phân công và theo dõi công việc nhà một cách vui vẻ và công bằng thông qua hệ thống **tích điểm & đổi thưởng**.

### Cách hoạt động cơ bản:

```
Làm việc nhà → Admin duyệt → Nhận điểm thưởng → Tích điểm đổi quà
```

- ✅ Mỗi công việc có **điểm thưởng** khi hoàn thành
- ❌ Công việc bắt buộc chưa xong sẽ bị **trừ điểm** vào cuối ngày
- 🎁 Điểm tích lũy có thể dùng để **đổi phần thưởng** (do Admin thiết lập)

---

## 🔐 Đăng Nhập & Đăng Xuất

### Đăng nhập
1. Mở trang web ứng dụng trên trình duyệt
2. Nhập **Tên đăng nhập** (username) và **Mật khẩu** được Admin cung cấp
3. Bấm nút **Đăng nhập**

> 💡 Hệ thống sẽ nhớ phiên đăng nhập của bạn. Lần sau mở lại trang sẽ tự động vào mà không cần nhập lại.

### Đăng xuất
- Bấm vào **biểu tượng cửa thoát** (🚪) ở góc trên bên phải màn hình

### Đổi ảnh đại diện (Avatar)
1. Bấm vào **hình tròn avatar** ở góc trên bên trái (hiển thị chữ cái đầu hoặc ảnh của bạn)
2. Dán **đường link ảnh** (URL) vào ô nhập liệu
3. Bấm **Xem trước** để kiểm tra → Bấm **Lưu ảnh** để hoàn tất

---

## 👥 Hệ Thống Vai Trò

Ứng dụng có 4 vai trò với quyền hạn khác nhau:

| Vai trò | Ký hiệu | Quyền hạn |
|---------|----------|-----------|
| **User** | 👤 | Xem và thực hiện công việc, đổi phần thưởng, xem lịch sử cá nhân |
| **Moderator** | 🛡️ | Tất cả quyền User + Duyệt/từ chối công việc + Quản lý User |
| **Admin** | ⚙️ | Tất cả quyền Mod + Quản lý công việc, phần thưởng, nghỉ lễ, cộng/trừ điểm, reset điểm |
| **Super Admin** | 👑 | Tất cả quyền Admin + Quản lý đa gia đình, tạo gia đình mới, tạo Admin cho gia đình |

---

## 🏡 Trang Chủ - Công Việc Hôm Nay

Đây là màn hình chính khi bạn đăng nhập. Hiển thị tất cả công việc cần làm **trong ngày hôm nay**.

### Các loại công việc

| Nhóm | Mô tả | Ví dụ |
|------|-------|-------|
| **📋 Việc hàng ngày** | Công việc bắt buộc mỗi ngày, có trừ điểm nếu không hoàn thành | Nấu cơm, Quét nhà |
| **📌 Việc định kỳ** | Công việc theo tuần/tháng, xuất hiện vào ngày cố định | Giặt chăn (Thứ 7), Lau kính (Tuần 1) |
| **🌟 Việc kiếm thêm** | Công việc không bắt buộc, chỉ cộng điểm khi làm | Tưới cây, Dọn kho |

### Cách thực hiện công việc

1. Tìm công việc muốn làm trong danh sách
2. Bấm nút **👆 (biểu tượng tay)** bên phải công việc
3. Trạng thái sẽ chuyển thành **"Chờ"** (màu vàng) ⏳
4. Đợi Admin/Mod **duyệt** → Trạng thái chuyển thành **"Xong"** (màu xanh) ✅
5. Điểm thưởng được cộng tự động vào tài khoản

> ⚠️ Mỗi công việc chỉ có **một người** được nhận trong mỗi chu kỳ. Nếu ai đó đã nhận trước, bạn sẽ thấy thông báo "Việc này đã có người xí rồi!"

### Chế độ Nghỉ lễ 🏖️

Vào các ngày nghỉ lễ (do Admin thiết lập), hệ thống sẽ hiển thị **banner thông báo đặc biệt**. Trong ngày này:
- Công việc **vẫn hiển thị** và bạn **vẫn có thể làm** để nhận thưởng
- Hệ thống **KHÔNG trừ điểm** cho việc chưa hoàn thành

### Đổi Phần Thưởng 🎁

Khu vực **Phần thưởng** nằm ở cuối trang chủ:

1. Xem danh sách phần thưởng và số điểm cần
2. Nếu bạn đủ điểm, nút **"Đổi quà luôn"** sẽ sáng lên
3. Bấm nút → Xác nhận → Điểm được trừ ngay lập tức
4. Trạng thái đổi quà sẽ là **"Chờ trao"** → Admin xác nhận **"Đã trao"** → Bạn xác nhận **"Đã nhận"**

---

## 📊 Báo Cáo & Thống Kê

Bấm tab **Báo cáo** (biểu tượng 📊) ở thanh điều hướng phía dưới.

### Bộ lọc thời gian

| Nút | Phạm vi |
|-----|---------|
| **Tuần này** | Từ thứ Hai đến Chủ Nhật tuần hiện tại |
| **Tuần trước** | Tuần trước đó |
| **Tháng này** | Từ ngày 1 đến cuối tháng hiện tại |
| **Tùy chỉnh** | Chọn khoảng ngày bất kỳ |

### Tab Công việc
- **Bộ lọc thành viên**: Chọn xem báo cáo của mình hoặc tất cả
- **Thống kê tổng quan**: Số việc đã hoàn thành ✅ và số việc bị trừ điểm ❌
- **Danh sách chi tiết**: Liệt kê từng công việc đã hoàn thành hoặc bỏ lỡ

### Tab Bảng Xếp Hạng 🏆
- Xếp hạng tất cả thành viên trong gia đình theo **tổng điểm kiếm được** trong khoảng thời gian đã chọn
- Hiển thị huy chương 🥇🥈🥉 cho top 3

---

## 📜 Lịch Sử Hoạt Động

Bấm tab **Lịch sử** (biểu tượng 🕐) ở thanh điều hướng.

### Tab Biến động điểm
Hiển thị toàn bộ lịch sử cộng/trừ điểm theo thứ tự mới nhất:
- 🟢 **Earn (Cộng điểm)**: Hoàn thành công việc được duyệt
- 🔴 **Penalty (Trừ điểm)**: Bỏ lỡ việc bắt buộc hoặc bị Admin trừ
- 🟡 **Spend (Tiêu điểm)**: Đổi phần thưởng

### Tab Lịch sử đổi quà
Hiển thị tất cả các lần đổi phần thưởng với trạng thái:

| Trạng thái | Ý nghĩa | Ai xử lý |
|-------------|---------|-----------|
| **Chờ trao** 🟡 | Đã đổi điểm, chờ Admin/Mod trao quà | Admin/Mod bấm "Xác nhận đã trao quà" |
| **Đang giao** 🔵 | Admin đã xác nhận trao | Bạn (hoặc Admin/Mod) bấm "Xác nhận đã nhận quà" |
| **Đã nhận** ✅ | Hoàn tất | — |

---

## ⚙️ Quản Trị (Admin/Mod)

> 💡 Chỉ hiển thị cho vai trò **Moderator**, **Admin**, và **Super Admin**.

Bấm tab **Quản trị** (biểu tượng 🛡️) ở thanh điều hướng.

### Tab Duyệt việc ✅

Hiển thị danh sách công việc đang **chờ duyệt** (Pending Approval):

- Bấm **✅ Duyệt** để xác nhận → Điểm thưởng được cộng cho người làm
- Bấm **❌ Từ chối** để hủy → Người làm không nhận được điểm, có thể nhận lại việc

### Tab Trao quà 🎁

Hiển thị danh sách phần thưởng đang chờ trao:

- Bấm **"Xác nhận đã trao quà"** khi đã giao quà cho thành viên

### Tab Thành viên 👥

Quản lý danh sách người dùng trong gia đình:

- **Thêm thành viên**: Bấm nút ➕ → Nhập username, tên, mật khẩu, chọn vai trò → Lưu
- **Sửa thông tin**: Bấm nút ✏️ trên thẻ thành viên
- **Xoá thành viên**: Bấm nút 🗑️ (có xác nhận trước khi xoá)
- **Cộng/Trừ điểm thủ công**: Bấm nút ⚡ → Chọn cộng/trừ, nhập số điểm và lý do → Cập nhật

> 🔒 **Moderator** chỉ xem và quản lý được User. **Admin** và **Super Admin** quản lý được tất cả vai trò.

### Tab Công việc 📋

Quản lý danh sách công việc:

- **Thêm công việc**: Bấm ➕ → Nhập tên, chọn icon, tần suất, điểm thưởng, điểm phạt → Lưu
- **Sửa/Xoá**: Tương tự tab Thành viên

#### Tần suất công việc:

| Tần suất | Mô tả | Lịch trình |
|----------|-------|------------|
| **Hàng ngày** (Daily) | Xuất hiện mỗi ngày | Không cần chọn |
| **Hàng tuần** (Weekly) | Xuất hiện 1 ngày cố định/tuần | Chọn thứ (2-CN) |
| **Hàng tháng** (Monthly) | Xuất hiện 1 tuần cố định/tháng | Chọn tuần (1-5) |
| **Không định kỳ** (Adhoc) | Việc tự do, không bắt buộc | Không cần chọn |

#### Ô "Calc Admin" (Tính cho Admin):
- ✅ **Bật**: Nếu Admin không hoàn thành việc này, Admin cũng bị trừ điểm
- ❌ **Tắt** (mặc định): Admin được miễn trừ điểm phạt cho việc này

### Tab Nghỉ lễ 🏖️

Thiết lập ngày nghỉ lễ:

- **Thêm**: Bấm ➕ → Nhập tên ngày lễ, chọn icon, chọn **ngày bắt đầu** và **ngày kết thúc** → Lưu
- Trong khoảng ngày nghỉ lễ, hệ thống sẽ không trừ điểm cho việc chưa hoàn thành

### Tab Phần thưởng 🎁

Quản lý danh mục phần thưởng:

- **Thêm**: Bấm ➕ → Nhập tên phần thưởng, chọn icon, nhập số điểm cần → Lưu
- **Sửa/Xoá**: Tương tự các tab khác

### Nút Reset Điểm 🔄

> ⚠️ Chỉ hiển thị cho **Admin** và **Super Admin** trong tab Thành viên.

- Bấm nút **"Reset Điểm"** (màu đỏ) → Xác nhận → **Tất cả thành viên** trong gia đình sẽ bị đưa điểm về 0
- Dùng khi bắt đầu chu kỳ mới (ví dụ: đầu tháng, đầu quý)

---

## 👑 Quản Lý Gia Đình (Super Admin)

> 💡 Chỉ hiển thị cho vai trò **Super Admin**.

Tab **Gia đình** (biểu tượng 👑) nằm đầu tiên trong phần Quản trị.

### Xem danh sách gia đình

Mỗi gia đình hiển thị dạng thẻ (card) bao gồm:
- **Tên gia đình**
- **Số lượng thành viên** theo vai trò (Admin / Mod / User)
- Badge **"Của tôi"** cho gia đình của bạn

### Tạo gia đình mới

1. Bấm nút ➕
2. Nhập **Tên gia đình** (VD: "Nguyễn Family")
3. Nhập thông tin **Admin đầu tiên** cho gia đình:
   - Username
   - Tên hiển thị
   - Mật khẩu
4. *(Tùy chọn)* Tick ✅ **"Áp dụng công việc mẫu"** để copy toàn bộ danh sách công việc & phần thưởng từ gia đình của bạn sang gia đình mới
5. Bấm **"Tạo gia đình"**

### Sửa gia đình

- Bấm nút ✏️ trên thẻ gia đình → Sửa tên → Bấm **"Cập nhật"**

### Copy công việc mẫu

- Bấm nút **"Copy công việc mẫu từ gia đình tôi"** trên thẻ gia đình khác
- Tất cả công việc và phần thưởng từ gia đình của bạn sẽ được sao chép sang

### Xoá gia đình

> ⚠️ **CẢNH BÁO**: Hành động này **KHÔNG THỂ hoàn tác**!

- Bấm nút 🗑️ trên thẻ gia đình (không thể xoá gia đình của chính mình)
- Xác nhận **2 lần** trước khi xoá
- Khi xoá: tất cả thành viên, công việc, phần thưởng, lịch sử giao dịch của gia đình đó sẽ bị xoá vĩnh viễn

---

## 🎨 Đổi Giao Diện (Theme)

Ứng dụng hỗ trợ 5 giao diện màu sắc:

| Theme | Phong cách | Màu chủ đạo |
|-------|-----------|-------------|
| 🌙 **Đêm sâu** | Tối, hiện đại | Xanh dương |
| ☀️ **Sáng sủa** | Sáng, nhẹ nhàng | Tím |
| 🌸 **Hoa anh đào** | Hồng pastel, nữ tính | Hồng |
| 🍵 **Trà xanh mộc** | Xanh lá tự nhiên | Xanh lá |
| ⚡ **Neon Cyber** | Tối, phong cách cyberpunk | Vàng neon |

### Cách đổi theme:
1. Bấm vào **biểu tượng bảng màu** (🎨) ở góc trên bên phải
2. Chọn giao diện yêu thích
3. Theme được lưu tự động và giữ nguyên khi mở lại trang

---

## ❓ Câu Hỏi Thường Gặp (FAQ)

### 1. Tại sao tôi bị trừ điểm dù chưa hết ngày?
Hệ thống tự động trừ điểm cho công việc bắt buộc (Daily/Weekly/Monthly có penalty > 0) vào cuối chu kỳ. Nếu bạn thấy bị trừ bất thường, hãy liên hệ Admin.

### 2. Tôi có thể hoàn tác sau khi đổi quà không?
Không. Điểm sẽ bị trừ ngay lập tức khi bạn xác nhận đổi quà. Hãy cân nhắc kỹ trước khi đổi!

### 3. Tại sao tôi không thấy tab Quản trị?
Tab Quản trị chỉ hiển thị cho vai trò **Moderator**, **Admin**, và **Super Admin**. Nếu bạn là **User**, bạn sẽ không thấy tab này.

### 4. Admin có bị trừ điểm không?
- Mặc định: **Không**. Admin được miễn trừ điểm phạt.
- Ngoại lệ: Nếu công việc có ô **"Calc Admin"** được bật, Admin cũng sẽ bị trừ điểm như người dùng thường.

### 5. Tôi quên mật khẩu thì làm sao?
Liên hệ **Admin** hoặc **Super Admin** của gia đình bạn. Họ có thể vào tab **Thành viên** → Sửa tài khoản của bạn → Đặt lại mật khẩu.

### 6. Nhiều gia đình có nhìn thấy dữ liệu của nhau không?
**Không**. Dữ liệu (công việc, thành viên, phần thưởng, lịch sử) được phân tách hoàn toàn theo từng gia đình. Chỉ **Super Admin** mới có thể xem và quản lý tất cả các gia đình.

---

## 📱 Mẹo Sử Dụng

- **Thêm vào màn hình chính** (điện thoại): Mở trang web trên Chrome/Safari → Bấm menu ⋮ → "Thêm vào màn hình chính" → App sẽ hoạt động như một ứng dụng native
- **Bật thông báo**: Giữ trang web mở trên trình duyệt để nhận thông báo realtime khi công việc được duyệt
- **Vuốt ngang**: Các tab trong phần Quản trị có thể vuốt ngang nếu không hiển thị hết trên màn hình nhỏ

---

*Được phát triển bởi Yến - Vũ Family 💙*
