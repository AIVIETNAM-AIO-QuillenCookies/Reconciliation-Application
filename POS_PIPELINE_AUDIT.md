# Kết quả sửa pipeline POS

## Phạm vi bằng chứng

Đã sửa và kiểm tra source bằng DuckDB WASM đang được cài trong dự án; đồng thời đọc toàn bộ **8 workbook** ở các thư mục dự án `Submission 1/Excel` và `Data`, không sửa bản gốc. Tìm thấy POS Raw đầy đủ trong [POS_PowerQuery_QC.xlsx](<D:/edaAIVietNam/Module 1/Project/Submission 1/Excel/POS_PowerQuery_QC.xlsx>), sheet `POS_Sales_Export_2025`, range **A1:K17125**. Chạy lại projection/validator cũ trên toàn bộ dữ liệu đã tái hiện đúng **10.058 dòng lỗi**.

Snapshot mapping/header/period và Master workbook FX của chính phiên ứng dụng trước đó không được lưu trong các nguồn hiện có. Vì vậy phép tái hiện dùng **native projection cũ trên bảng Raw thực tế**, không giả nhận đã khôi phục cấu hình người dùng. Counts thực và fixture được tách riêng bên dưới. Chi tiết máy đọc được: [actual-pos-pipeline.json](outputs/pos-source-audit/actual-pos-pipeline.json); inventory, SHA256 và mã M đã giải nén: [corpus-inventory.json](outputs/pos-source-audit/corpus-inventory.json), [workbook-audit.json](outputs/pos-source-audit/workbook-audit.json).

## Validator cũ và nguyên nhân xác nhận được trong code

Thông báo cũ được khai báo trong `reconciliation-accounting.ts`, hằng `ACCOUNTING_POS_VALIDATION`. `ReconciliationEngine.ts` chạy validator này trên **`pos_clean`**, được tạo từ `raw_pos`; `raw_pos` là projection đã map, không phải toàn bộ cột Raw nguyên gốc.

SQL cũ dùng một `COUNT(*)` với các điều kiện OR: receipt/line/store null, business/posting date null, export timestamp không parse được, net/discount USD null hoặc âm, gross USD nhỏ hơn discount USD. Do đó, nếu lỗi được sinh từ đúng rule này, count là **số dòng thỏa ít nhất một điều kiện**, không phải tổng các count điều kiện và cũng không phải số nhóm khóa. Suffix chung “invalid rows or key groups” làm mờ sự khác biệt này.

Các lỗi triển khai đã xác nhận:

- `accountingProjection` chỉ cho `line_amount` đi vào gross USD khi currency là USD. Với nguyên tệ khác USD và không có supplied net USD, net USD có thể null dù tiền nguyên tệ hợp lệ.
- FX trước đây chỉ được nạp/kiểm tra hoặc trả thuộc tính; không có phép chia nguyên tệ cho tỷ giá trong pipeline kế toán.
- Khi chưa có currency, code cũ còn có nhánh coi `line_amount` là USD. Nhánh giả định này đã được bỏ.
- `explainError` bắt chuỗi có “date/period” trước khi giải thích đầy đủ lỗi POS tổng hợp, dẫn đến hướng dẫn chỉ về ngày.
- Preview Excel giữ định dạng hiển thị trong khi ingestion dùng chuyển đổi riêng; hiện cả hai có chung chuẩn hóa ngày/timestamp, lịch Excel và độ chính xác mili giây.

Trên bảng Raw thực tế vừa tìm thấy, **cả 10.058 dòng lỗi đều có net nguyên tệ hợp lệ nhưng net USD null theo projection cũ**. Không có lỗi khóa nguồn, ngày, timestamp hoặc số tiền nguyên tệ trong phép tái hiện. FX không được dùng để chuyển đổi trong code cũ. Ngoài ra, native adapter cũ bỏ qua `discount_amount` vì không phải cột USD, mặc định discount USD bằng 0; mapping discount đã xác nhận của phiên cũ không còn để đối chiếu. Bản sửa giữ đúng discount nguyên tệ và chuyển đổi theo cơ sở thích hợp.

| Kiểm tra trên toàn bộ Raw                                     |      Count |
| ------------------------------------------------------------- | ---------: |
| Receipt / line / store key không hợp lệ                       |  0 / 0 / 0 |
| Business / posting date không hợp lệ                          |      0 / 0 |
| Export timestamp không hợp lệ                                 |          0 |
| Tiền nguyên tệ không hợp lệ                                   |          0 |
| Net USD null theo projection cũ                               | **10.058** |
| Net USD âm / discount USD không hợp lệ theo native adapter cũ |      0 / 0 |
| Dòng lỗi duy nhất                                             | **10.058** |
| Nhóm receipt/line bị ảnh hưởng                                | **10.046** |

Store lookup và khóa FX của cấu hình đã xác nhận trước đó **chưa đánh giá được** vì Master/config không có trong các nguồn hiện có; không ghi chúng thành 0 lỗi đã kiểm tra. Phân bố Raw: AUD **1.300**, CAD **2.312**, EUR **5.042**, GBP **1.404**, USD **7.066**. Bốn ngoại tệ cộng đúng **10.058**, toàn bộ các dòng USD qua được validator cũ.

Các sample thực từ cùng worksheet (ngày gốc hiển thị `1/1/25`, chuẩn hóa thành `2025-01-01`; exported_at hiển thị `1/1/25 23:15`, chuẩn hóa thành `2025-01-01 23:15:00`):

| Dòng Excel | Receipt / line | Currency | Gross gốc | Discount gốc | Net local sau chuẩn hóa | Net USD cũ |
| ---------- | -------------- | -------- | --------: | -----------: | ----------------------: | ---------- |
| 2          | R3289009 / 1   | AUD      |     65,37 |         7,85 |                   57,52 | NULL       |
| 5          | R3289019 / 1   | CAD      |    528,04 |        10,56 |                  517,48 | NULL       |
| 12         | R3289016 / 1   | EUR      |  1.292,58 |       129,24 |                1.163,34 | NULL       |
| 31         | R3289005 / 1   | GBP      |    191,10 |        13,35 |                  177,75 | NULL       |

Giá trị gốc đầy đủ, trường sau chuẩn hóa, file, sheet, record ordinal và dòng vật lý nằm trong JSON. Đây là samples dữ liệu thực, không phải fixture.

## Duplicates và nguồn Fact

Code ứng dụng trước sửa không có relation tên `fact_POS_final`; `vw_pos` đã lọc computed keeper rank. Tuy nhiên audit [cleaned_POS_Flagged_Duplicate.xlsx](<D:/edaAIVietNam/Module 1/Project/Submission 1/Excel/cleaned_POS_Flagged_Duplicate.xlsx>) phát hiện hai vấn đề cụ thể trong Power Query nguồn:

- `q_POS_Dup_Rows` dùng INNER JOIN `q_POS_Flagged` với `q_POS_Dup_Keys` theo key, nên chứa **cả 24 thành viên** của 12 nhóm trùng, bao gồm keeper. Nó không phải tập 12 exports thực sự bị loại. Cache đối chiếu ở range `q_POS_Dup_Rows!A1:L25`; `q_POS_Dup_Keys!A1:B13`.
- `q_POS_First_Export` chỉ `Table.Group(key)` và `List.Min(exported_at)`: **17.112 dòng key + timestamp**, chưa phải bảng transaction keeper đầy đủ. Range `q_POS_First_Export!A1:B17113`. Nếu join lại Raw chỉ bằng key mà không ràng buộc bản xuất/rank, cả hai exports có thể quay lại; đây là nguy cơ từ cấu trúc đã xác minh, chưa phải bằng chứng của một bước fact cụ thể.

Dashboard cache có 12 discarded rows, đều CAD, trong `POS_Duplicates`, phân biệt với 24 group members của workbook Cleaning/Flagged. **Không workbook nào trong 8 file có query/sheet `q_POS_Cleaning`, `q_POS_USD`, `fact_POS_final`, hoặc Master Store/Calendar/FX**. Do đó chưa thể xác nhận Source/Merge/Expand của fact bên ngoài hoặc sửa trực tiếp query fact không được cung cấp. GL có tỷ giá trên journal; không tự dùng cột đó làm Master FX cho POS. M đã trích: [cleaned_POS_Flagged_Duplicate_Section1.m](outputs/pos-source-audit/cleaned_POS_Flagged_Duplicate_Section1.m).

Pipeline hiện có các dependency cụ thể và kiểm soát được:

```text
File Raw nguyên gốc
  → raw_pos (projection, full source_values và nguồn thứ tự)
  → pos_staging (typing + kiểm tra Raw/nguyên tệ)
  → pos_ranked (receipt_no + line_no; earliest exported_at)
      ├→ q_POS_First_Export → q_POS_Cleaning
      │   → q_POS_Mapped → q_POS_USD → kiểm tra USD → fact_POS_final → vw_pos
      └→ q_POS_Dup_Keys / q_POS_Dup_Rows → q_POS_Dup_Impact
```

Preflight kiểm tra đầy đủ các quan hệ đã xác nhận và chuẩn bị lookup outputs. Giai đoạn mapping áp dụng các kết quả đó sau khi phân loại keeper. Lookup keys trùng không được đưa vào phép join theo cách nhân dòng; source row được giữ với trạng thái lỗi cụ thể và processing bị chặn. Không có `DISTINCT *` chữa cháy ở cuối.

Thứ tự keeper là `exported_at`, source `export_seq`, thứ tự file và bản ghi. Sequence nguồn bằng 1 không tự quyết định keeper. Timestamp có UTC offset được so theo cùng một mốc UTC; business/posting date giữ ngày lịch đã khai báo. Cùng receipt nhưng khác line vẫn được giữ đủ.

Full source values, rank, file/record lineage và lý do discarded được giữ trong audit, kể cả các cột như product_id không được map vào kế toán. Content comparison loại timestamp xuất và sequence khỏi payload so sánh; thay đổi nội dung nguồn vẫn tạo cảnh báo.

Invariant trước đối soát:

- Raw = keeper Cleaning + discarded exports.
- Cleaning = USD = Fact về số dòng trong cùng phạm vi.
- Fact duy nhất theo receipt_no + line_no.
- Không đưa discarded exports vào expected POS revenue.

## Nguyên tệ, USD và bridge

`net_local = line_amount - discount_amount`. Với `usd_to_ccy` là nguyên tệ trên một USD, `amount_usd = amount_local / usd_to_ccy`. Các tỷ giá phải đến từ workbook/sheet/cột và quan hệ FX đã xác nhận. Ngày/tháng và currency được kết hợp theo cấu hình; diagnostic sample giữ các khóa FX thực tế được dùng.

Daily gross, discount và daily net được tách với recognition net theo tỷ giá cuối tháng khi có cấu hình, hoặc theo daily khi không có month-end relationship. Không tự thế daily vào một month-end lookup đã cấu hình nhưng thiếu khóa. Net USD được map là authoritative, gồm giá trị 0; giá trị blank/invalid không được thay bằng gross-minus-discount. Không chia lại net USD hoặc GL USD.

Posting date được map, lấy từ Calendar đã cấu hình hoặc fallback về business date theo contract. `posting_date_source` ghi nguồn thực sự được chọn, kể cả Calendar không khớp và cho phép fallback.

Bridge giữ nguyên dấu: trừ discount của toàn bộ exports, rồi trừ **net** của discarded exports từ nhánh audit, tránh trừ discount hai lần. Duplicate impact dùng daily net; Fact recognition giữ cơ sở USD của nó. Chênh lệch cơ sở FX và các khoản chưa giải thích vẫn nằm ở residual thực, không bị ép về 0.

## Counts thực tế sau khi chạy SQL đã sửa

Đã chạy các stage POS đã sửa trên toàn bộ Raw tìm được, **không tự tạo cấu hình FX/Store/Calendar**. Đây là audit POS riêng, không phải một phiên đối soát hoàn thành:

| Nhánh / chỉ tiêu                          |                      Count đầy đủ bằng SQL |
| ----------------------------------------- | -----------------------------------------: |
| Raw / Staging / Ranked                    |               **17.124 / 17.124 / 17.124** |
| First Export / Cleaning / Mapped          |               **17.112 / 17.112 / 17.112** |
| USD candidate rows                        |                                 **17.112** |
| Nhóm khóa có trùng                        |                                     **12** |
| Tất cả dòng trong nhóm trùng              |                                     **24** |
| Discarded exports                         |                            **12**, đều CAD |
| Duplicate Impact groups                   | **12**, giá trị ngoại tệ chưa quy đổi được |
| Keeper USD hợp lệ                         |                                  **7.066** |
| Keeper có net local hợp lệ nhưng USD null |                                 **10.046** |
| All-export audit rows thiếu FX / USD null |                                 **10.058** |
| Fact                                      |             **Chưa tạo: chặn vì thiếu FX** |

Count thiếu FX và USD null cùng tác động lên một tập dòng; không cộng chúng. Tập USD candidate có đủ keeper về grain nhưng chưa đủ điều kiện tiền tệ để publish vào Fact. Không trình bày “Fact = 0” hoặc “FX đã kiểm tra hợp lệ” khi chưa có nguồn FX. Dữ liệu gốc được giữ nguyên.

## Fixture kiểm thử phép quy đổi đầy đủ

Fixture integration dùng **hai bản xuất của một receipt/line**, mỗi bản có gross 65,37 AUD, discount 7,85 AUD; Daily rate 1,5 và Month End rate 2. Đây là dữ liệu kiểm thử, không phải dữ liệu production của lỗi 10.058.

| Nhánh / chỉ tiêu                 | Count đầy đủ bằng SQL |
| -------------------------------- | --------------------: |
| Raw / Staging / Ranked           |             2 / 2 / 2 |
| First Export / Cleaning / Mapped |             1 / 1 / 1 |
| USD / Fact                       |                 1 / 1 |
| Nhóm khóa có trùng               |                     1 |
| Tất cả dòng trong nhóm trùng     |                     2 |
| Bản xuất thực sự bị loại         |                     1 |
| Duplicate Impact groups          |                     1 |

Keeper có net local **57,52 AUD**, daily net **38,35 USD**, recognition net **28,76 USD**. Tổng discount của hai exports là **−10,46 USD**; duplicate adjustment là **−38,35 USD**. Residual FX **−9,59 USD** được giữ nguyên.

Fixture chẩn đoán thiếu FX: hai dòng AUD cùng khóa có net local hợp lệ nhưng USD null. Kết quả là **2 dòng lỗi duy nhất**, **1 nhóm receipt/line bị ảnh hưởng**, **2 dòng AUD lỗi**, **1 keeper**, **1 discarded**; Fact chưa được tạo. Các count lý do chồng lặp không được cộng thành số dòng duy nhất.

Fixture lỗi Staging có một dòng đồng thời sai receipt, line, store, business date, posting date và timestamp: báo **1 dòng lỗi**, dừng trước classification, không trình bày USD chưa chạy như một lỗi quy đổi đã kiểm tra.

## Giao diện và kiểm chứng

Progress hiển thị các bước phân loại, Cleaning, mapping, quy đổi và kiểm tra đầu ra theo SQL thực sự chạy. Workspace mở riêng Raw, Cleaning, Duplicates, Duplicate Impact, USD, Fact và diagnostic cùng run ID. Báo cáo lỗi giữ counts, samples gốc/chuẩn hóa, tên file, record ordinal và dòng vật lý khi xác định được chính xác. Nếu không xác định được tọa độ, UI ghi rõ thay vì lấy ordinal cộng offset.

Dashboard, Exception Log và Rules & Data Model cùng đọc một kết quả engine. Các liên kết phiên cũ không được hiển thị dữ liệu của phiên khác. Preview vẫn giới hạn 50 bản ghi/relation; counts và uniqueness checks chạy trên toàn bảng.

Regression tests chạy bằng DuckDB WASM thực: dedup nhiều line/tie-breakers/offset timestamps, full audit content, cardinality lookup, local FX ngày/cuối kỳ, missing/duplicate/invalid FX, supplied USD zero/invalid, Calendar surrogate và fallback, bridge impact/residual, counts chồng lặp, nguồn bản ghi, stale-run UI. Kiểm tra trình duyệt thực chưa thực hiện được vì công cụ báo không có browser surface; DOM UI tests không thay thế được kiểm tra bố cục trong trình duyệt.

Kết quả kiểm tra cuối: **170/170 tests đạt**, `npm run build` đạt, `npm run format:check` đạt; lint không có lỗi, còn 7 warnings sẵn có. Build còn cảnh báo bundle lớn của Vite. Script `scripts/audit-pos-source.mjs` tái hiện audit read-only trên workbook nguồn; không hardcode counts và không thay đổi workbook.

Đã tái hiện và giải thích count 10.058 trên POS Raw thực tế, kiểm chứng phân loại đầy đủ 17.124 dòng và giữ bằng chứng Power Query nguồn. Để xác nhận doanh thu USD/Fact cuối cùng và dependency fact của model bên ngoài, còn cần **Master FX/Store/Calendar đã xác nhận, cấu hình phiên, và query/file chứa `fact_POS_final`**. Bộ nguồn đang có không chứa các thành phần này. Bản sửa chặn đúng chỗ khi thiếu chúng; không đặt tỷ giá hoặc doanh thu giả.
