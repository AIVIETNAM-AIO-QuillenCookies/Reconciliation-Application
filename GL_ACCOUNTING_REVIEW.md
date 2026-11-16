# Rà soát kế toán GL

Rà soát ngày **13/11/2026** theo commit `ed969a42233dfe191e6aac054a156c73ce8e55fc` (phiên bản ứng dụng trong `package.json`: `0.1.0`). Luồng hiện tại chạy trong tab, dùng shared store và cùng DuckDB lifecycle với Dashboard, bảng dữ liệu và Nhật ký ngoại lệ. Refresh sẽ xóa nguồn, quyết định, nội dung bằng chứng và chỉnh sửa của phiên. Không có thay đổi nào được ghi vào ERP.

Tài liệu này mô tả phần GL. Xem [bản đồ ứng dụng nghiên cứu](docs/RESEARCH_APPLICATION_MAP.md) để đối chiếu toàn bộ chương trình và tách luồng Raw với chế độ tham chiếu Excel. Nguồn nghiên cứu đang có là [Memory.md, mục X.3.4–3.5 và Bảng 39](Memory.md#bang-39); Bảng 41 còn ô `[Điền]`, chưa có căn cứ gọi đó là kế hoạch triển khai đã được phê duyệt.

## Chức năng hiện có và giới hạn đối chiếu nghiên cứu

| Nội dung                                | Triển khai thực tế và đường sử dụng                                                                                                                                                                                               | Giới hạn                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Giữ GL hợp lệ, kể cả khoản chưa phân bổ | [`ACCOUNTING_GL_SQL`, `prepareGLReview`](src/lib/gl-pipeline.ts) tạo `gl_normalized`, `gl_clean`, `vw_gl`, `vw_gl_manual`, `vw_gl_system`; [Rà soát kế toán](src/pages/AccountingReview.tsx) cho xem nguồn, chẩn đoán và biến đổi | `glReview.complete` nói về chẩn đoán dữ liệu GL; không chứng minh toàn bộ đối soát, chứng từ hay phê duyệt đã hoàn tất                           |
| Gợi ý mục đích bút toán                 | [`suggestGLClassification`](src/lib/gl-review.ts) dùng từ khóa trong diễn giải/mã tham chiếu; [`synchronizeReviewCases`](src/lib/accounting-review.ts) tạo hồ sơ, ghép chuyển kênh theo `source_ref`                              | Gợi ý không phải kết luận nghiệp vụ; `source_ref` không chứng minh chứng từ tồn tại hoặc đã được rà soát                                         |
| Kiểm tra chuyển kênh                    | [`transferIssue`](src/lib/accounting-review.ts) yêu cầu đúng hai journal, hai kênh xác định khác nhau, cùng kỳ và tổng doanh thu bằng 0                                                                                           | Không tự xác nhận mục đích hay đối chiếu chứng từ gốc; cặp thiếu vế vẫn cần người dùng xử lý                                                     |
| Ghi bằng chứng và quyết định            | [`editReviewCase`](src/lib/accounting-review.ts) tách `evidence`, `evidenceReviewed`, `purpose`, `decision`, `status`; UI có tab bằng chứng và lịch sử                                                                            | Bằng chứng là nội dung văn bản do người dùng nhập; chưa có kho tệp chứng từ, xác thực người duyệt, phân quyền hoặc phê duyệt độc lập nhiều người |
| Chỉnh dữ liệu hiệu lực của phiên        | [`previewCorrection`, `completeCorrectionPreview`](src/lib/accounting-review.ts), [`applyGLCorrection`, `undoGLCorrection`](src/lib/store.ts) kiểm tra lý do, xem trước tác động rồi chạy lại                                     | Không sửa file gốc/ERP; trạng thái và lịch sử chỉ tồn tại trong phiên, chưa chuyển tiếp hồ sơ sang kỳ sau một cách bền vững                      |
| Liên kết ngoại lệ                       | [`linkReviewExceptions`](src/lib/accounting-review.ts), [Nhật ký ngoại lệ](src/pages/ExceptionLog.tsx) liên kết hồ sơ theo cửa hàng/ngày                                                                                          | Liên kết theo nhóm ngày không phải chứng minh từng giao dịch nguồn tương ứng một journal                                                         |

### Cầu nối số học và kết luận nghiệp vụ

Luồng Raw dùng [`DAILY_SQL`, `bridgeSQL`, `exceptionSQL`](src/lib/reconciliation-sql.ts). Hai bên được tổng hợp ở cấp `store_key × posting_date` trước khi so sánh; không nối từng dòng POS/WEB trực tiếp với từng journal. Dấu chênh lệch ngày là **GL − nguồn**; dấu trong Nhật ký ngoại lệ là **nguồn − GL**; chênh lệch Flash/GL trên dashboard là **GL − Flash**.

[`ReconciliationEngine`](src/lib/ReconciliationEngine.ts) tính phần dư bằng **GL − (Flash + các điều chỉnh đã tính)**. Các nhóm Raw hiện có là chiết khấu, hủy, lệch thời điểm, trả hàng và lỗi dữ liệu (POS trùng + nhóm ngày thiếu GL). [`BRIDGE_KEYS`, `buildWaterfall`](src/lib/reconciliation-types.ts) không có dòng riêng cho phí vận chuyển, chuyển kênh, tỷ giá hoặc làm tròn như cầu nối trong nghiên cứu. Việc người dùng đổi phân loại một hồ sơ thành `shipping` không tự chuyển số tiền khỏi `Unexplained`; annotation hồ sơ không phải điều chỉnh tài chính.

Vì vậy cần phân biệt năm kết luận:

1. **Khớp số học:** tổng Flash và các bước, kể cả phần dư, đi tới GL.
2. **Hợp lệ cấu trúc:** các phép kiểm tra dữ liệu đã chạy không phát hiện lỗi chặn.
3. **Đã giải thích nguyên nhân:** cần căn cứ nghiệp vụ, không suy ra từ phần dư bằng 0 hay từ từ khóa gợi ý.
4. **Bằng chứng đã rà soát:** người dùng cung cấp nội dung bằng chứng và đánh dấu đã kiểm tra; chương trình không kiểm định chứng từ đó.
5. **Quyết định hoàn tất:** hồ sơ `confirmed` thỏa điều kiện kiểm soát trong phiên; không thay thế phê duyệt phát hành báo cáo ngoài ứng dụng.

Ngưỡng hiển thị ngoại lệ ngày mặc định là **|nguồn − GL| > 200 USD**, không có điều kiện 1% trong [`filterExceptions`](src/lib/exceptions.ts). Dashboard dùng [`storeMonthBreaches`](src/lib/dashboard-model.ts) với đồng thời **|GL − nguồn| > 200 USD và > 1% của |GL|** cho cửa hàng/tháng, giữ riêng trường hợp GL bằng 0. Hai màn hình khác cấp tổng hợp và mục đích, không nên coi là cùng một phép kiểm tra.

Trong chế độ tham chiếu Excel, [Nhật ký ngoại lệ](src/pages/ExceptionLog.tsx) chuyển sang `ReferenceExceptions`, đọc kết quả workbook. Dữ liệu Excel hiển thị được không chứng minh các phép tính Raw hoặc quy trình GL trong phiên đã chạy thành công.

## Nguyên nhân lỗi ban đầu

Phần này lưu bối cảnh sửa lỗi đã được tài liệu trước ghi nhận; điều kiện dưới đây là mã cũ, không phải quy tắc loại bỏ GL của chế độ accounting hiện tại.

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

Workbook Finance Raw gốc không có trong các tệp nguồn được khảo sát lần này. Repository có [workbook tham chiếu Excel](public/reference/excel-reference.xlsx), nhưng đó là một đầu vào tham chiếu riêng. Không thể dùng việc đọc workbook này để tuyên bố toàn bộ luồng Raw đã tái tạo kết quả nghiên cứu; các số GL nêu trên có kiểm thử bằng fixture và nguồn mô tả trong [Memory.md](Memory.md#bang-39).

Chạy kiểm tra bằng `npm.cmd test`, `npm.cmd run build`, `npm.cmd run lint` và `npm.cmd run format:check` trên Windows PowerShell.

Đợt chỉnh giao diện bổ sung kiểm thử tương tác cho search/reset, selection, drawer, guard thay đổi chưa lưu, giữ focus/cuộn, đồng bộ yêu cầu chứng từ, link quay lại và banner đúng nguồn/run. Các chiều rộng vùng nội dung tương ứng desktop 1366, 1440, màn hình rộng và mobile được kiểm tra logic qua ResizeObserver giả lập. Công cụ CUA không có browser khả dụng trong phiên triển khai; chưa thể chụp ảnh hoặc xác nhận trực quan kích thước/overflow thực tế bằng trình duyệt.

### Bằng chứng kiểm chứng có thể chạy lại

| Tình huống                | Bằng chứng có sẵn                                                                                                                                                 | Cách hiểu kết quả                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADJ chưa phân bổ          | [`tests/gl-review.test.mjs`](tests/gl-review.test.mjs), test `valid unallocated manual adjustment stays in company GL and remains unexplained`                    | Fixture có ADJ 1.250 USD: giữ `storeKey = '-1'`, kênh `UNALLOCATED`, GL tổng 1.360 USD và phần dư 1.250 USD; không phải xác minh chứng từ Finance gốc                                             |
| Chuyển kênh               | Cùng file, test `paired channel transfer preserves both journal identities and signed channel impacts`                                                            | Giữ hai journal và tác động doanh thu −3.480/+3.480 USD; tổng toàn công ty bằng 0                                                                                                                 |
| Phí vận chuyển trong Raw  | Cùng file, test `constructed reference fixture reconciles 12 shipping entries, paired transfer and unexplained adjustment`                                        | Fixture dựng theo tổng nghiên cứu: 12 khoản phí vận chuyển 94.766,95 USD và ADJ 1.250 USD vẫn nằm trong phần dư Raw tổng 96.016,95 USD; không được diễn giải là Raw đã tách đủ cầu nối nghiên cứu |
| Đã xem khác đã xác nhận   | Cùng file, test `review state requires real evidence and a decision; merely viewed is unresolved`                                                                 | Chặn xác nhận thiếu mục đích/quyết định/bằng chứng đã đánh dấu rà soát; `reviewed` vẫn chưa hoàn tất                                                                                              |
| Sửa, chạy lại và hoàn tác | Cùng file, test `real-engine shared store keeps review decisions and exceptions in one snapshot across apply, retry and undo`                                     | Preview không đổi số; apply vô hiệu hóa kết quả rồi tính lại; retry không áp số tiền hai lần; undo khôi phục nguồn hiệu lực                                                                       |
| Có GL nhưng khác số       | [`tests/reconciliation.test.mjs`](tests/reconciliation.test.mjs), test `accounting distinguishes genuine absent store-days from present but mismatched GL totals` | Phân biệt ngày thật sự thiếu GL với nhóm GL đã tồn tại nhưng lệch số; nhóm thứ hai để lại phần dư                                                                                                 |
| Truy vết có giới hạn      | [`tests/evidence.test.mjs`](tests/evidence.test.mjs), [`captureRunEvidence`](src/lib/reconciliation-evidence.ts)                                                  | Preview tối đa 50 dòng mỗi bảng, không phải hồ sơ kiểm toán đầy đủ. GL review giữ tập journal riêng và có kiểm thử tọa độ dòng nguồn trong `gl-review.test.mjs`                                   |

Các kiểm thử dùng dữ liệu dựng/fixture và DuckDB-WASM trong Node; chúng không chứng minh đã kiểm thử trình duyệt thực, triển khai production hoặc hiệu quả nghiên cứu trước–sau. Kết quả lần chạy ngày 13/11/2026 được ghi trong [bản đồ ứng dụng nghiên cứu](docs/RESEARCH_APPLICATION_MAP.md).

## Phần chưa triển khai và công việc tiếp theo

Các khoảng trống so với mục X.3.4–3.5 của nghiên cứu gồm kho chứng từ có liên kết đáng tin cậy, danh tính và quyền người duyệt, duyệt độc lập trước phát hành, lưu hồ sơ/lịch sử lâu dài và tiếp tục theo dõi qua kỳ. Cầu nối Raw còn thiếu các thành phần giải thích riêng đã nêu ở trên. Chưa có dữ liệu đo thời gian xử lý hay sai sót trước–sau để kết luận ứng dụng đã cải thiện hiệu quả.

Đây là các **đề xuất từ lần rà soát**, chưa phải kế hoạch triển khai được xác nhận. Khi phát triển sau cần xác định phạm vi từng thành phần, chủ sở hữu nghiệp vụ và tiêu chí chấp nhận; giữ nguyên nguồn và lịch sử quyết định để kiểm chứng lại.
