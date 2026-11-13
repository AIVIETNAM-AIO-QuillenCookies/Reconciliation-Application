# reconcile.

Ứng dụng đối soát doanh thu React/TypeScript + Vite. DuckDB-WASM và SheetJS xử lý CSV/XLSX ngay trong trình duyệt. Không có backend upload, tài khoản hoặc kết nối ERP.

## Chạy local

Dùng **Node.js 24.x** (xem `.nvmrc`) và npm; giữ `package-lock.json` để cài đúng dependencies. Windows PowerShell có thể dùng `npm.cmd` thay cho `npm`.

```sh
npm ci
npm run dev
```

Nhập POS, WEB, Finance GL và Sales Flash tại **Nguồn dữ liệu**; Master/Dim là tùy chọn. Xác nhận dòng tiêu đề và mapping từng file rồi chạy xử lý. File fact Excel hiện đọc **sheet đầu tiên**; Master/Dim cho phép chọn sheet theo vai trò. Kỳ đối soát Raw cần trọn tháng vì Flash theo tháng.

## Kiểm tra bản production

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:production
npm run format:check
npm run preview -- --host 127.0.0.1
```

Mở URL do preview in ra. `build` bao gồm TypeScript; `test:production` mở Vite **preview của dist**, kiểm tra HTTP/MIME và chữ ký Worker/WASM/workbook rồi đóng server. Kiểm tra này không chạy trình duyệt. Các test khác dùng DuckDB-WASM thực và jsdom, có fixture tổng hợp riêng cho Raw.

CI GitHub Actions chạy npm ci, lint, test, build, kiểm tra HTTP production và format trên Ubuntu/Node 24. CI trên GitHub chỉ được xác minh khi workflow thực sự chạy sau push.

## Deploy Vercel

| Thiết lập             | Giá trị                       |
| --------------------- | ----------------------------- |
| Framework Preset      | Vite                          |
| Root Directory        | `.` (thư mục có package.json) |
| Install Command       | `npm ci`                      |
| Build Command         | `npm run build`               |
| Output Directory      | `dist`                        |
| Node.js Version       | `24.x`                        |
| Environment Variables | Không cần                     |

Nếu repo nằm trong monorepo, chọn chính thư mục ứng dụng làm Root Directory. [Vercel hỗ trợ Node 24.x](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) và có [preset Vite](https://vercel.com/docs/frameworks/frontend/vite).

Ứng dụng dùng **HashRouter**: mở trực tiếp `/#/processing` hoặc `/#/exceptions?category=...` qua URL gốc. Không cần SPA rewrite hoặc `vercel.json`. Vercel phục vụ toàn bộ `dist`, không chạy dev/preview server làm production. Worker và WASM là asset cùng origin, lấy từ cùng package DuckDB đã khóa; hai bundle single-thread MVP/EH không cần COOP/COEP. Deploy ở gốc domain với Vite base mặc định `/`.

## Xem thử theo Excel

Chọn **Tạm xem theo Excel**, chờ đọc workbook rồi **Hiển thị dashboard**. Có thể **Chọn workbook** khác đúng cấu trúc `Cau_noi`, `Nhat_ky_ngoai_le`, `Chi_tiet`. Chọn **Tắt xem thử · Quay lại xử lý Raw** để khôi phục nguồn Raw; file nhập, mapping, correction và hồ sơ rà soát Raw được giữ riêng.

`public/reference/excel-reference.xlsx` là workbook tài chính gốc, **được người dùng xác nhận giữ làm demo công khai ngày 13/11/2026**. Mọi người truy cập site có thể tải file này; đây không phải dữ liệu do khách truy cập upload. USD tham chiếu giữ theo workbook, không quy đổi FX thêm. Chế độ này hiển thị kết quả đã có, không chứng minh pipeline Raw đã chạy thành công. Chi tiết: [EXCEL_REFERENCE_PREVIEW.md](EXCEL_REFERENCE_PREVIEW.md).

## Lưu trữ và giới hạn v1

- File nhập, kết quả, ghi chú, bằng chứng và correction chỉ tồn tại trong bộ nhớ của tab. Refresh/đóng tab sẽ mất phiên; không có cơ chế khôi phục hoặc đồng bộ thiết bị.
- Kiểm tra nghiệp vụ vẫn có thể chặn dữ liệu thiếu/sai. Không tự ép đối soát thành công; thông báo cho biết nguồn, giai đoạn và dòng lỗi khi xác định được.
- Dashboard có bốn tab dùng chung snapshot/bộ lọc; bảng hiển thị theo trang. Một số bảng bằng chứng chỉ giữ mẫu giới hạn và ghi rõ tổng số dòng.
- Raw chưa được kiểm thử với toàn bộ workbook nguồn Finance/POS/WEB/Flash bên ngoài workspace. Bộ fixture kiểm chứng quy tắc không thay thế đối chiếu dữ liệu thực tế.
- Mailto/CSV ERP chỉ tạo bản nháp để rà soát; ứng dụng không gửi email, ghi ERP hay tự xác nhận chứng từ.
- WASM khá lớn; tải engine lần đầu cần mạng ổn định. Đọc workbook tham chiếu lớn còn thực hiện trên main thread; tối ưu sâu dành cho bản sau.

`.gitignore` ngăn file môi trường, credentials và dữ liệu/kết quả cục bộ mới. File đã có trong commit/lịch sử vẫn cần rà soát riêng trước khi công khai GitHub; xem [RELEASE_CHECK.md](RELEASE_CHECK.md).

Kết quả kiểm tra, giới hạn và checklist sau deploy: [RELEASE_CHECK.md](RELEASE_CHECK.md). Tài liệu kiến trúc và quy tắc chi tiết trước đợt phát hành được giữ tại [ARCHITECTURE.md](ARCHITECTURE.md); cấu hình và mã nguồn hiện tại là căn cứ khi snapshot cũ khác với bản phát hành.
