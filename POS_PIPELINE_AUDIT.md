# Rà soát pipeline POS

## Trạng thái đối chiếu ngày 13/11/2026

Đối chiếu source tại commit `ed969a42233dfe191e6aac054a156c73ce8e55fc` (ứng dụng `0.1.0`). Lần cập nhật này chỉ sửa tài liệu. Bản đồ nghiên cứu và trạng thái kiểm chứng chung nằm tại [docs/RESEARCH_APPLICATION_MAP.md](docs/RESEARCH_APPLICATION_MAP.md).

Phần này ghi nhận điều có thể xác định từ repository hiện tại. Các số liệu workbook và kết quả kiểm tra ở phần **Hồ sơ sửa lỗi lịch sử** bên dưới được giữ để tham khảo; chúng không phải kết quả chạy lại trong lần rà soát này. Các tệp `outputs/pos-source-audit/*` và workbook ở thư mục dự án bên ngoài không nằm trong repository được đối chiếu; chưa tái kiểm chứng các số liệu đó. [Memory.md](Memory.md) là báo cáo nghiên cứu đã có trong repository, cũng mô tả 17.124 dòng POS nguồn, 12 dòng xuất lặp và rủi ro fact Excel giữ cả dòng trùng (mục X.3.2). Không dùng nhận định về fact **Excel** đó cho fact **Raw của ứng dụng**.

### Đường xử lý hiện có trong ứng dụng

| Bước                  | Bằng chứng code                                                                                                                    | Hành vi và giới hạn                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đọc nguồn             | [workbookToCSV / workbookToSheets](src/lib/spreadsheet.ts), [registerFiles](src/lib/ReconciliationEngine.ts)                       | POS, WEB, GL và Flash XLSX dùng **sheet đầu tiên**; người dùng chọn dòng tiêu đề, không có bộ chọn sheet bất kỳ cho các nguồn fact. Master/Dim cho chọn sheet theo vai trò và dòng tiêu đề riêng. CSV cũng hỗ trợ chọn dòng tiêu đề.                                                                                                                                          |
| Ánh xạ                | [autoMapColumns / confirmedMappingSnapshot](src/lib/data-mapping.ts), [accountingProjection](src/lib/reconciliation-accounting.ts) | Gợi ý cột theo alias/độ tương đồng; người dùng xác nhận mapping. Tiền POS được hiểu là nguyên tệ theo tên cột local được nhận diện; net được map là USD có sẵn, kể cả bằng 0. Người dùng phải kiểm tra đúng cơ sở tiền tệ.                                                                                                                                                    |
| Master/Dim            | [masterConfigurationIssues / masterReady](src/lib/master-data.ts), [buildMasterJoins](src/lib/master-joins.ts)                     | Một Master workbook, bốn vai trò Store, Calendar, FX Daily, FX Month End. Kiểm tra đầy đủ khóa, đầu ra, unmatched và số dòng trước/sau nối. POS loại khóa tham chiếu trùng khỏi phép join để giữ dòng nguồn kèm trạng thái lỗi; engine vẫn chặn trước khi công bố fact.                                                                                                       |
| Staging               | [ACCOUNTING_POS_STAGING_SQL / POS_STAGING_ISSUES](src/lib/pos-pipeline-sql.ts), [execute](src/lib/ReconciliationEngine.ts)         | Chuẩn hóa khóa, ngày, timestamp, tiền; giữ giá trị gốc và vị trí nguồn. Lỗi staging dừng trước khi phân loại exports. `raw_pos` đã là projection chuẩn hóa, không phải bản sao nguyên trạng mọi cột file; payload `source_values` giữ các cột nguồn.                                                                                                                          |
| Phân loại và cleaning | [ACCOUNTING_POS_CLASSIFICATION_SQL / ACCOUNTING_POS_CLEANING_SQL](src/lib/pos-pipeline-sql.ts)                                     | Khóa `receipt_no + line_no`; giữ bản xuất sớm nhất theo timestamp, sequence nguồn rồi thứ tự file/bản ghi. `q_POS_Dup_Keys` đếm cả nhóm; `q_POS_Dup_Rows` chỉ chứa bản bị loại. Cùng khóa khác nội dung sinh cảnh báo; code vẫn giữ bản sớm nhất, không chờ phê duyệt từng nhóm.                                                                                              |
| Mapping và USD        | [ACCOUNTING_POS_MAPPING_SQL / ACCOUNTING_POS_CONVERSION_SQL](src/lib/pos-pipeline-sql.ts)                                          | Áp dụng lookup sau classification. `net_local = gross_local - discount_local`; USD = local / `usd_to_ccy`. Daily và Month End có cơ sở riêng. Nếu chưa cấu hình Month End thì dùng Daily cho net dẫn xuất; nếu đã cấu hình nhưng thiếu khóa thì không tự thay bằng Daily. Quy đổi local này có triển khai cho **POS**; WEB nhập tiền USD đã chuẩn bị, GL/Flash cũng dùng USD. |
| Fact và kiểm tra      | [execute](src/lib/ReconciliationEngine.ts), [ACCOUNTING_POS_FACT_SQL](src/lib/pos-pipeline-sql.ts)                                 | Engine chỉ tạo `fact_POS_final` sau khi POS và reference qua kiểm tra. Kiểm tra duy nhất receipt/line và bảo toàn số dòng Cleaning = Mapped = USD = Fact; Cleaning + discarded = Raw. Gọi riêng mảng SQL tổng hợp trong unit test không thay thế các cổng kiểm tra của engine.                                                                                                |
| Ghi nhận và đối soát  | [DAILY_SQL / bridgeSQL](src/lib/reconciliation-sql.ts)                                                                             | POS theo posting date đã map/Calendar/fallback business date. WEB giao ghi tăng, trả ghi giảm ở return date, hủy không ghi nhận. Tổng hợp hai vế theo store + posting date trước khi so. Bridge Raw có discount, hủy, timing, trả, duplicate và missing GL; residual FX không được phân loại riêng thành dòng FX đầy đủ.                                                      |

### Giới hạn cần giữ rõ khi đọc báo cáo

- [Memory.md](Memory.md) đề nghị kiểm soát ngày hoạt động/đóng cửa của Store Master; `ReferenceField` hiện không có `open_date` hay `close_date`, và không tìm thấy validator tự động kiểm tra POS tại cửa hàng đã đóng. Lookup đúng khóa chưa chứng minh hợp lệ theo thời gian hoạt động.
- Quy tắc kỳ báo cáo trong [validatePeriod](src/lib/ReconciliationEngine.ts) yêu cầu tháng lịch đầy đủ vì Flash có grain tháng. Không tự suy ra lịch đóng sổ hoặc ngày hạch toán kế tiếp từ ngày nghỉ nếu chưa có Calendar và quan hệ được cấu hình.
- Việc chọn dòng tiêu đề chỉ bỏ phần metadata trước tiêu đề. Chưa thấy bước loại riêng dòng `Total`/subtotal của Flash; người dùng cần cung cấp bảng chi tiết hợp lệ, tránh nạp cả tổng và chi tiết rồi cộng hai lần.
- Dữ liệu nguồn lỗi không được tự sửa theo phỏng đoán. Thiếu FX, lookup không hợp lệ, WEB sai trạng thái/ngày, GL chưa hoàn tất chuẩn hóa hoặc thiếu một trong bốn nguồn có thể chặn kết quả Raw.
- Giữ bản POS sớm nhất và ghi cảnh báo khác nội dung là quy tắc đã có code; quyết định nghiệp vụ xác minh bản nào là đúng vẫn cần người dùng và chưa có hàng chờ phê duyệt riêng cho xung đột POS.

### Kiểm chứng có thể tái lập

Các fixture có thật nằm trong [tests/pos-pipeline.test.mjs](tests/pos-pipeline.test.mjs), [tests/pos-calendar-fx.test.mjs](tests/pos-calendar-fx.test.mjs), [tests/master-data.test.mjs](tests/master-data.test.mjs), [tests/data-mapping.test.mjs](tests/data-mapping.test.mjs) và [tests/header-row.test.mjs](tests/header-row.test.mjs). Chúng kiểm tra export timestamp/tie breaker, dữ liệu local AUD, net USD bằng 0, FX thiếu/trùng/không hợp lệ, Calendar và bảo toàn số dòng. Fixture AUD hai exports 65,37 gross và 7,85 discount với rate Daily 1,5 / Month End 2 là dữ liệu kiểm thử; không phải số liệu thực của lần chạy Raw năm 2025.

Phạm vi đọc code ở phần này: **Đã đối chiếu code; chưa kiểm chứng bằng chạy thử riêng**. Kết quả chạy bộ test trong lần rà soát được ghi tập trung ở [bản đồ nghiên cứu](docs/RESEARCH_APPLICATION_MAP.md); không lấy con số `170/170` lịch sử bên dưới làm số test hiện hành.

## Hồ sơ sửa lỗi lịch sử (giữ để truy nguyên)

Các đoạn dưới đây là nội dung audit đã có trước lần cập nhật tài liệu 13/11/2026. Các từ “đã chạy”, “đã kiểm tra” và số lượng workbook/test trong phần này mô tả hồ sơ cũ; chưa tái xác nhận độc lập workbook gốc, artifact JSON/M hoặc phiên cấu hình trong lần rà soát này.

### Phạm vi bằng chứng lịch sử

Hồ sơ cũ ghi đã sửa và kiểm tra source bằng DuckDB WASM; đồng thời đọc toàn bộ **8 workbook** ở các thư mục dự án `Submission 1/Excel` và `Data`, không sửa bản gốc. Nguồn ghi trong hồ sơ là `../Submission 1/Excel/POS_PowerQuery_QC.xlsx`, sheet `POS_Sales_Export_2025`, range **A1:K17125**. Hồ sơ ghi chạy lại projection/validator cũ trên toàn bộ dữ liệu đã tái hiện **10.058 dòng lỗi**; lần rà soát này chưa chạy lại nguồn bên ngoài đó.

Snapshot mapping/header/period và Master workbook FX của chính phiên ứng dụng trước đó không được lưu trong các nguồn hiện có. Vì vậy phép tái hiện dùng **native projection cũ trên bảng Raw thực tế**, không giả nhận đã khôi phục cấu hình người dùng. Counts thực và fixture được tách riêng bên dưới. Hồ sơ dẫn các artifact `outputs/pos-source-audit/actual-pos-pipeline.json`, `corpus-inventory.json`, `workbook-audit.json`; các artifact này chưa có trong repository hiện tại để kiểm tra lại.

### Validator cũ và nguyên nhân ghi nhận trong hồ sơ

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

### Duplicates và nguồn Fact

Code ứng dụng trước sửa không có relation tên `fact_POS_final`; `vw_pos` đã lọc computed keeper rank. Tuy nhiên hồ sơ audit workbook ngoài repository `../Submission 1/Excel/cleaned_POS_Flagged_Duplicate.xlsx` ghi hai vấn đề cụ thể trong Power Query nguồn:

- `q_POS_Dup_Rows` dùng INNER JOIN `q_POS_Flagged` với `q_POS_Dup_Keys` theo key, nên chứa **cả 24 thành viên** của 12 nhóm trùng, bao gồm keeper. Nó không phải tập 12 exports thực sự bị loại. Cache đối chiếu ở range `q_POS_Dup_Rows!A1:L25`; `q_POS_Dup_Keys!A1:B13`.
- `q_POS_First_Export` chỉ `Table.Group(key)` và `List.Min(exported_at)`: **17.112 dòng key + timestamp**, chưa phải bảng transaction keeper đầy đủ. Range `q_POS_First_Export!A1:B17113`. Nếu join lại Raw chỉ bằng key mà không ràng buộc bản xuất/rank, cả hai exports có thể quay lại; đây là nguy cơ từ cấu trúc đã xác minh, chưa phải bằng chứng của một bước fact cụ thể.

Dashboard cache có 12 discarded rows, đều CAD, trong `POS_Duplicates`, phân biệt với 24 group members của workbook Cleaning/Flagged. **Không workbook nào trong 8 file của hồ sơ cũ có query/sheet `q_POS_Cleaning`, `q_POS_USD`, `fact_POS_final`, hoặc Master Store/Calendar/FX**. Do đó hồ sơ chưa thể xác nhận Source/Merge/Expand của fact bên ngoài hoặc sửa trực tiếp query fact không được cung cấp. GL có tỷ giá trên journal; không tự dùng cột đó làm Master FX cho POS. Artifact M được ghi nhận là `outputs/pos-source-audit/cleaned_POS_Flagged_Duplicate_Section1.m` (chưa có trong repository hiện tại).

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

### Nguyên tệ, USD và bridge

`net_local = line_amount - discount_amount`. Với `usd_to_ccy` là nguyên tệ trên một USD, `amount_usd = amount_local / usd_to_ccy`. Các tỷ giá phải đến từ workbook/sheet/cột và quan hệ FX đã xác nhận. Ngày/tháng và currency được kết hợp theo cấu hình; diagnostic sample giữ các khóa FX thực tế được dùng.

Daily gross, discount và daily net được tách với recognition net theo tỷ giá cuối tháng khi có cấu hình, hoặc theo daily khi không có month-end relationship. Không tự thế daily vào một month-end lookup đã cấu hình nhưng thiếu khóa. Net USD được map là authoritative, gồm giá trị 0; giá trị blank/invalid không được thay bằng gross-minus-discount. Không chia lại net USD hoặc GL USD.

Posting date được map, lấy từ Calendar đã cấu hình hoặc fallback về business date theo contract. `posting_date_source` ghi nguồn thực sự được chọn, kể cả Calendar không khớp và cho phép fallback.

Bridge giữ nguyên dấu: trừ discount của toàn bộ exports, rồi trừ **net** của discarded exports từ nhánh audit, tránh trừ discount hai lần. Duplicate impact dùng daily net; Fact recognition giữ cơ sở USD của nó. Chênh lệch cơ sở FX và các khoản chưa giải thích vẫn nằm ở residual thực, không bị ép về 0.

### Counts thực tế được ghi nhận trong hồ sơ cũ

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

### Fixture kiểm thử phép quy đổi đầy đủ

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

### Giao diện và kiểm chứng lịch sử

Progress hiển thị các bước phân loại, Cleaning, mapping, quy đổi và kiểm tra đầu ra theo SQL thực sự chạy. Workspace mở riêng Raw, Cleaning, Duplicates, Duplicate Impact, USD, Fact và diagnostic cùng run ID. Báo cáo lỗi giữ counts, samples gốc/chuẩn hóa, tên file, record ordinal và dòng vật lý khi xác định được chính xác. Nếu không xác định được tọa độ, UI ghi rõ thay vì lấy ordinal cộng offset.

Dashboard, Exception Log và Rules & Data Model cùng đọc một kết quả engine. Các liên kết phiên cũ không được hiển thị dữ liệu của phiên khác. Preview vẫn giới hạn 50 bản ghi/relation; counts và uniqueness checks chạy trên toàn bảng.

Regression tests chạy bằng DuckDB WASM thực: dedup nhiều line/tie-breakers/offset timestamps, full audit content, cardinality lookup, local FX ngày/cuối kỳ, missing/duplicate/invalid FX, supplied USD zero/invalid, Calendar surrogate và fallback, bridge impact/residual, counts chồng lặp, nguồn bản ghi, stale-run UI. Kiểm tra trình duyệt thực chưa thực hiện được vì công cụ báo không có browser surface; DOM UI tests không thay thế được kiểm tra bố cục trong trình duyệt.

Kết quả kiểm tra cuối: **170/170 tests đạt**, `npm run build` đạt, `npm run format:check` đạt; lint không có lỗi, còn 7 warnings sẵn có. Build còn cảnh báo bundle lớn của Vite. Script `scripts/audit-pos-source.mjs` tái hiện audit read-only trên workbook nguồn; không hardcode counts và không thay đổi workbook.

Đã tái hiện và giải thích count 10.058 trên POS Raw thực tế, kiểm chứng phân loại đầy đủ 17.124 dòng và giữ bằng chứng Power Query nguồn. Để xác nhận doanh thu USD/Fact cuối cùng và dependency fact của model bên ngoài, còn cần **Master FX/Store/Calendar đã xác nhận, cấu hình phiên, và query/file chứa `fact_POS_final`**. Bộ nguồn đang có không chứa các thành phần này. Bản sửa chặn đúng chỗ khi thiếu chúng; không đặt tỷ giá hoặc doanh thu giả.
