# Rà soát kế toán GL

Luồng mới chạy trong tab hiện tại, dùng shared store và cùng DuckDB lifecycle với Dashboard, bảng dữ liệu và Nhật ký ngoại lệ. Refresh sẽ xóa nguồn, quyết định, bằng chứng và chỉnh sửa của phiên. Không có thay đổi nào được ghi vào ERP.

## Nguyên nhân lỗi ban đầu

Điều kiện cũ trong `VALIDATION_SQL` là:

```sql
SELECT COUNT(*) FROM vw_gl
WHERE journal_id IS NULL OR store_key IS NULL OR journal_type IS NULL
   OR posting_date IS NULL OR amount_usd IS NULL;
```

Thông báo gộp không xác định field gây lỗi. Với dòng JE20250904892 được mô tả trong yêu cầu, `store_key` trống đủ làm điều kiện này đúng dù ngày 2025-09-30 và signed amount -1250 hợp lệ. Không có căn cứ quy lỗi cho ngày.

Accounting mode hiện phân biệt lỗi định danh/ngày/số tiền với nhu cầu rà soát nghiệp vụ. MANUAL không tự là lỗi. Khoản UNALLOCATED có dữ liệu tính toán hợp lệ được giữ trong GL, với khóa chuỗi `-1` làm nhóm kỹ thuật. Store code và các giá trị nguồn được giữ riêng; nhóm này không phải cửa hàng thực tế.

## Dữ liệu và xử lý

- Projection giữ nguyên toàn bộ giá trị nguồn trong `source_values` và các field `raw_*` để truy vết.
- `gl_normalized` biểu diễn GL đã chuẩn hóa. `gl_clean` áp correction overlay để tạo dữ liệu hiệu lực. `vw_gl`, `vw_gl_manual` và `vw_gl_system` là các view; không tạo bút toán bổ sung.
- Cơ sở tiền đầu vào được xác định bằng mapping `glAmountBasis`: ledger hoặc revenue. `GLRecord.amountCents` và mọi correction amount luôn theo dấu sổ cái; `raw.amount` giữ giá trị đầu vào thực tế. Revenue đã chuẩn hóa không bị đảo thêm lần nữa khi retry.
- Mỗi lần chạy tái tạo effective GL từ nguồn và overlay. Không áp correction trên dữ liệu đã bị correction từ lần chạy trước.
- Review snapshot giữ các journal để tương tác; preview kiểm chứng có giới hạn vẫn được giữ riêng. Diagnostic chặn không cho công bố bridge thiếu dữ liệu.
- Record identity, fingerprint nội dung nguồn và configuration version ràng buộc correction. Khi nguồn/cấu hình khác, correction cũ không được áp và quyết định được yêu cầu rà soát lại.

## Quyết định và chỉnh sửa

Hàng chờ gợi ý nghiệp vụ từ dữ liệu, không tự xác minh. Mã tham chiếu, bằng chứng được cung cấp, bằng chứng đã rà soát và quyết định xác nhận là các trạng thái riêng. Chuyển kênh giữ journal độc lập, kiểm tra hai vế, kỳ, kênh và tổng ròng.

Phân loại, ghi chú, người phụ trách, hạn và bước tiếp theo chỉ cập nhật case. Xác nhận yêu cầu mục đích, quyết định và bằng chứng đã được rà soát. Đã xem hoặc đóng inspector không giải quyết case.

Thay đổi dữ liệu tài chính yêu cầu lý do, preview trước/sau, ảnh hưởng theo kỳ/kênh và thao tác áp dụng riêng. Áp dụng/hoàn tác vô hiệu hóa kết quả cũ rồi tính lại các đầu ra trong cùng snapshot. Preview hoàn chỉnh còn tính ảnh hưởng phân bổ lên nhóm Missing GL; khi đầu vào còn lỗi, giao diện ghi rõ giới hạn preview.

Nhật ký ngoại lệ đọc cùng case state. Các chênh lệch ngày liên quan liên kết đến case kế toán; số tiền case không được cộng lần nữa vào tổng rủi ro. Các kiểm soát chứng từ không chịu bộ lọc ngưỡng tiền của bảng chênh lệch. Yêu cầu chứng từ chỉ tạo công việc trong phiên, không gửi email/tin nhắn.

## Giao diện workspace

Rà soát kế toán và Nhật ký ngoại lệ dùng chiều cao còn lại dưới navigation chung. Bảng bút toán có bảy nhóm cột cố định; doanh thu và số tiền GL gốc theo dấu sổ cái được ghi nhãn riêng trong cùng ô. Diễn giải đầy đủ, dữ liệu nguồn và mã kỹ thuật nằm trong inspector.

Layout chỉ đặt inspector rộng 360px cạnh bảng khi vùng nội dung thực tế đạt 1240px. Bên dưới ngưỡng này, bảng dùng toàn bộ chiều rộng và chọn dòng mở drawer. Inspector giữ header, tabs và action lưu/xem trước/áp dụng cố định; chỉ body cuộn. Đổi bút toán đưa chi tiết về đầu; lưu cùng hồ sơ giữ input, focus và vị trí cuộn. Thay đổi chưa lưu được kiểm tra khi chuyển hồ sơ, đóng drawer hoặc chuyển trang. Tab Điều chỉnh được giữ qua lượt tính lại.

Summary phân biệt số bút toán, tổng hồ sơ và hồ sơ còn mở. Bộ lọc bổ sung và lịch sử tự chuẩn hóa mở theo yêu cầu; bulk action chỉ xuất hiện khi có selection. Nhật ký tách hồ sơ kế toán và chênh lệch đối soát thành hai tab, hiển thị phụ trách/bước tiếp theo từ cùng shared state. Liên kết từ chênh lệch giữ tab, tìm kiếm, bộ lọc, sắp xếp và phân trang khi quay lại.

## Nguyên nhân banner ngày/kỳ

Lỗi xác nhận được trong mã là fallback `/date|period/i` của `explainError()`. Thông báo validation tổng hợp WEB có “dates” và thông báo Flash có `month_end_date`, nên lỗi về trạng thái hoặc số tiền cũng bị dịch thành yêu cầu sửa ngày/kỳ. Khoảng 2025-01-01 → 2025-12-31 vượt qua `validatePeriod()`; không có bằng chứng khoảng đang chọn sai.

Đã bỏ cách gom lỗi này, giữ nguyên validator tài chính và bổ sung `runFailure`: nguồn, bước, reason code, field, thông báo gốc, run, cấu hình, kỳ và mẫu bản ghi nguồn có giới hạn. WEB/Flash phân biệt lỗi ngày, khóa, trạng thái và số tiền. Banner đỏ phản ánh lần chạy hiện tại và có action mở tiến trình, sửa nguồn, chạy lại hoặc xem dòng lỗi. GL hợp lệ chỉ chứng minh trạng thái GL trong cùng run; không chứng minh đối soát toàn bộ đã thành công. Retry, chỉnh cấu hình và ngắt processor xóa metadata lỗi; callback cũ không thể phục hồi lỗi đã hết hiệu lực.

Không có workbook và trạng thái runtime gốc để kết luận nguồn hoặc dòng nào gây banner trước khi sửa. Các kiểm thử tái hiện riêng lỗi WEB Pending và Flash doanh thu âm để xác nhận cơ chế ánh xạ sai và chẩn đoán mới.

## Kiểm chứng

`tests/gl-review.test.mjs` sử dụng DuckDB-WASM thực và fixture kiểm chứng từ quy tắc đã mô tả. Các journal ID, 12 khoản phí vận chuyển tổng 94.766,95 USD, cặp chuyển kênh ±3.480 USD và ADJ-0925 1.250 USD chỉ là dữ liệu kiểm thử; không hardcode vào production.

Workbook Finance gốc không có trong workspace hoặc attachments khi triển khai. Vì vậy không thể tuyên bố đã đối chiếu toàn bộ workbook thực; các số tham chiếu được kiểm tra bằng fixture và tài liệu `Memory.md`.

Chạy kiểm tra bằng `npm.cmd test`, `npm.cmd run build`, `npm.cmd run lint` và `npm.cmd run format:check` trên Windows PowerShell.

Đợt chỉnh giao diện bổ sung kiểm thử tương tác cho search/reset, selection, drawer, guard thay đổi chưa lưu, giữ focus/cuộn, đồng bộ yêu cầu chứng từ, link quay lại và banner đúng nguồn/run. Các chiều rộng vùng nội dung tương ứng desktop 1366, 1440, màn hình rộng và mobile được kiểm tra logic qua ResizeObserver giả lập. Công cụ CUA không có browser khả dụng trong phiên triển khai; chưa thể chụp ảnh hoặc xác nhận trực quan kích thước/overflow thực tế bằng trình duyệt.
