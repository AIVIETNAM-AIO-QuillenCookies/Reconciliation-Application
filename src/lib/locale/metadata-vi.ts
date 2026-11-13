/** Localized descriptions; processing metadata and expressions remain unchanged. */
export const METADATA_VI: Record<string, string> = {
  'Transaction ID': 'Mã giao dịch',
  'The receipt, order, or journal reference.':
    'Mã tham chiếu hóa đơn, đơn hàng hoặc bút toán.',
  'The transaction or reporting date.': 'Ngày giao dịch hoặc ngày báo cáo.',
  'Gross Amount': 'Số tiền gộp',
  'Revenue before discounts and adjustments.':
    'Doanh thu trước chiết khấu và điều chỉnh.',
  Discount: 'Chiết khấu',
  'The supplied discount amount.': 'Số tiền chiết khấu được cung cấp.',
  'Net Amount': 'Số tiền thuần',
  'Use the supplied net amount, or leave unmapped to calculate Gross Amount minus Discount.':
    'Dùng số tiền thuần được cung cấp, hoặc để chưa ánh xạ để tính Số tiền gộp trừ Chiết khấu.',
  'Store ID': 'Mã cửa hàng',
  'Store key or code; master data can resolve aliases.':
    'Khóa hoặc mã cửa hàng; dữ liệu tham chiếu có thể xác định các mã tương đương.',
  'Line Number': 'Số dòng',
  'Identifies a receipt line for duplicate detection.':
    'Xác định dòng hóa đơn để phát hiện trùng.',
  'Posting Date': 'Ngày ghi sổ',
  'Optional finance recognition date.': 'Ngày ghi nhận kế toán tùy chọn.',
  'Exported At': 'Thời điểm xuất',
  'Timestamp used to keep the earliest receipt export.':
    'Thời điểm dùng để giữ bản xuất hóa đơn sớm nhất.',
  Currency: 'Tiền tệ',
  'Optional currency for configured reference lookups.':
    'Tiền tệ tùy chọn cho các phép tra cứu đã cấu hình.',
  'Order Status': 'Trạng thái đơn hàng',
  'Delivered, cancelled, or returned.': 'Đã giao, đã hủy hoặc đã trả hàng.',
  'Delivery Date': 'Ngày giao hàng',
  'Required on delivered and returned order rows.':
    'Bắt buộc đối với dòng đơn đã giao và đã trả hàng.',
  'Return Date': 'Ngày trả hàng',
  'Required on returned order rows.': 'Bắt buộc đối với dòng đơn đã trả hàng.',
  'The supplied net revenue or signed ledger amount.':
    'Doanh thu thuần hoặc số tiền sổ cái có dấu được cung cấp.',
  'Journal Type': 'Loại bút toán',
  'Identifies normal and manual ledger entries.':
    'Phân biệt bút toán thông thường và thủ công.',
  'POS store ID': 'Mã cửa hàng POS',
  'Source store identifier; text preserves leading zeros.':
    'Mã cửa hàng nguồn; dùng văn bản để giữ số 0 ở đầu.',
  'Finance store code': 'Mã cửa hàng kế toán',
  'Ledger store code returned by store mapping.':
    'Mã cửa hàng sổ cái trả về từ ánh xạ cửa hàng.',
  Country: 'Quốc gia',
  'Optional store attribute.': 'Thuộc tính cửa hàng tùy chọn.',
  'Optional store currency.': 'Tiền tệ cửa hàng tùy chọn.',
  'Calendar key': 'Khóa lịch',
  'Optional surrogate key, separate from the actual calendar date.':
    'Khóa thay thế tùy chọn, tách biệt với ngày lịch thực tế.',
  'Calendar date or date key, as selected in the relationship.':
    'Ngày lịch hoặc khóa ngày theo lựa chọn trong quan hệ nối.',
  Period: 'Kỳ',
  'Reporting period returned by lookup.': 'Kỳ báo cáo trả về sau tra cứu.',
  'Posting date': 'Ngày ghi sổ',
  'Explicit recognition date; no working-day offset is inferred.':
    'Ngày ghi nhận được chỉ định rõ; không tự suy ra số ngày làm việc dịch chuyển.',
  'Working-day flag': 'Cờ ngày làm việc',
  'Optional attribute; required only if selected as an output.':
    'Thuộc tính tùy chọn; chỉ bắt buộc khi được chọn làm đầu ra.',
  'Rate date': 'Ngày tỷ giá',
  'Daily FX rate date.': 'Ngày áp dụng FX hằng ngày.',
  'Rate currency; part of the composite key.':
    'Tiền tệ của tỷ giá; là một phần khóa ghép.',
  'Exchange-rate value': 'Giá trị tỷ giá',
  'Lookup / validation only. Supplied USD amounts remain authoritative.':
    'Chỉ tra cứu / kiểm tra. Số tiền USD được cung cấp vẫn là giá trị chuẩn.',
  'Rate period': 'Kỳ tỷ giá',
  'YYYY-MM, YYYYMM, or a date within the rate month.':
    'YYYY-MM, YYYYMM hoặc một ngày trong tháng tỷ giá.',
  'Lookup / validation only; no automatic currency conversion.':
    'Chỉ tra cứu / kiểm tra; không tự động quy đổi tiền tệ.',
  'Store Master': 'Danh mục cửa hàng',
  Calendar: 'Lịch',
  'FX Daily': 'FX hằng ngày',
  'FX Month End': 'FX cuối tháng',
  'Resolve Finance store code': 'Xác định mã cửa hàng kế toán',
  'Resolve source date': 'Xác định ngày nguồn',
  'Set POS posting date from calendar': 'Lấy ngày ghi sổ POS từ lịch',
  'Return attributes (left lookup)': 'Lấy thuộc tính (tra cứu nối trái)',
  'Validate reference coverage only': 'Chỉ kiểm tra phạm vi tham chiếu',
  POS: 'POS',
  'POS sales data': 'dữ liệu bán hàng POS',
  'Start with your in-store sales. We’ll match the columns, then check a few rows.':
    'Bắt đầu với doanh số tại cửa hàng. Ứng dụng sẽ gợi ý ánh xạ cột, sau đó kiểm tra một số dòng.',
  WEB: 'WEB',
  'web sales data': 'dữ liệu bán hàng WEB',
  'Add online orders, including delivery, cancellation, and return details.':
    'Thêm đơn trực tuyến, gồm thông tin giao hàng, hủy và trả hàng.',
  'Finance GL': 'GL kế toán',
  'finance GL data': 'dữ liệu GL kế toán',
  'Connect your signed ledger amounts and store references.':
    'Kết nối số tiền sổ cái có dấu và mã tham chiếu cửa hàng.',
  'Sales Flash': 'Sales Flash',
  'sales flash data': 'dữ liệu Sales Flash',
  'Add the monthly revenue summary used as the starting point for your bridge.':
    'Thêm tổng doanh thu tháng dùng làm điểm bắt đầu của cầu nối đối soát.',
  'Master / Dim': 'Dữ liệu tham chiếu (Master / Dim)',
  'master data': 'dữ liệu tham chiếu',
  'Optionally add your store, calendar, and FX lookup workbook.':
    'Có thể thêm tệp tham chiếu cửa hàng, lịch và FX.',
  'POS source projection': 'Dữ liệu POS',
  'Combines selected POS files after applying each file’s confirmed column mapping.':
    'Tập hợp các tệp POS đã chọn sau khi áp dụng ánh xạ cột được xác nhận riêng cho từng tệp.',
  'One uploaded receipt-line export; duplicates still present.':
    'Một dòng hóa đơn từ bản xuất đã nhập; vẫn còn các bản trùng.',
  'raw_pos is already a mapped projection. It is not an untouched copy of the spreadsheet.':
    'raw_pos đã là dữ liệu được ánh xạ, không phải bản sao nguyên trạng của trang tính.',
  'The selected header row is applied before registration.':
    'Dòng tiêu đề đã chọn được áp dụng trước khi nạp dữ liệu.',
  'Mapped headers are SQL-quoted; columns are projected into canonical names.':
    'Tên cột được trích dẫn đúng trong SQL và chiếu sang tên trường chuẩn.',
  'File and row order provide stable duplicate-order tie breakers.':
    'Thứ tự tệp và dòng tạo tiêu chí ổn định để phân định các bản trùng.',
  'Receipt identity.': 'Định danh hóa đơn.',
  'Line identity within a receipt.': 'Định danh dòng trong hóa đơn.',
  'Normalized ledger store key.': 'Khóa cửa hàng sổ cái đã chuẩn hóa.',
  'Date of the in-store sale.': 'Ngày bán hàng tại cửa hàng.',
  'Finance recognition date.': 'Ngày ghi nhận kế toán.',
  'Authoritative supplied net, or selected gross minus selected discount.':
    'Giá trị thuần được cung cấp có ưu tiên, hoặc số gộp đã chọn trừ chiết khấu đã chọn.',
  'USD discount retained for the gross-to-net bridge.':
    'Chiết khấu USD được giữ lại cho cầu nối từ doanh thu gộp sang thuần.',
  'Ranked POS exports': 'Xếp hạng bản xuất POS',
  'Types and validates receipt lines, then identifies the earliest export for each receipt and line.':
    'Định kiểu, kiểm tra dòng hóa đơn và xác định bản xuất sớm nhất cho mỗi hóa đơn và dòng.',
  'One POS export row, with computed export_seq and keep_rank.':
    'Một dòng bản xuất POS, có export_seq và keep_rank được tính toán.',
  'Order by exported_at ascending, source_export_seq, then stable file and row order.':
    'Sắp theo exported_at tăng dần, source_export_seq, rồi thứ tự tệp và dòng ổn định.',
  'Both computed ranks partition by receipt_no + line_no.':
    'Cả hai thứ hạng được tính theo từng receipt_no + line_no.',
  'Discarded net remains available for the duplicate adjustment.':
    'Giá trị thuần của dòng bị loại vẫn được giữ để tính điều chỉnh trùng.',
  'Parsed source export timestamp when mapped.':
    'Thời điểm xuất nguồn đã phân tích nếu được ánh xạ.',
  'Original source sequence, used after timestamp ordering.':
    'Thứ tự nguồn gốc, dùng sau khi sắp theo thời điểm xuất.',
  'Computed rank, not the uploaded sequence.':
    'Thứ hạng được tính, không phải thứ tự tải lên.',
  'Computed duplicate order retained for bridge traceability.':
    'Thứ tự trùng được tính và giữ lại để truy vết cầu nối.',
  'POS keeper lines': 'Dòng POS được giữ lại',
  'Keeps the authoritative export row for each receipt line.':
    'Giữ bản xuất có ưu tiên cho từng dòng hóa đơn.',
  'One retained receipt line.': 'Một dòng hóa đơn được giữ lại.',
  'A repeated receipt or line number in another store is not an additional partition key in the current deduplication rule.':
    'Hóa đơn hoặc số dòng lặp ở cửa hàng khác không tạo thêm khóa phân nhóm trong quy tắc loại trùng hiện tại.',
  'Keep computed export_seq = 1.': 'Giữ dòng có export_seq được tính bằng 1.',
  'Posting date is mapped when available; otherwise explicit calendar posting mapping, then business date.':
    'Dùng ngày ghi sổ đã ánh xạ nếu có; nếu không, dùng ánh xạ lịch ghi sổ được chỉ định rõ, rồi đến ngày kinh doanh.',
  'A keeper line creates one positive net recognition event.':
    'Một dòng được giữ tạo một sự kiện ghi nhận doanh thu thuần dương.',
  'WEB source projection': 'Dữ liệu WEB',
  'Maps online exports into one canonical order relation.':
    'Ánh xạ bản xuất trực tuyến thành bảng đơn hàng chuẩn.',
  'One uploaded order row before validation.':
    'Một dòng đơn hàng đã nhập trước khi kiểm tra.',
  'Per-file mappings choose the columns used.':
    'Ánh xạ riêng từng tệp quyết định các cột được dùng.',
  'Canceled is normalized to cancelled.':
    'Canceled được chuẩn hóa thành cancelled; cả hai đều hiển thị là Đã hủy.',
  'An explicitly unmapped store uses online ledger store 999999.':
    'Khi không ánh xạ cửa hàng, dùng mã cửa hàng sổ cái trực tuyến 999999.',
  'Unique order identity across selected files.':
    'Định danh đơn hàng duy nhất trên các tệp đã chọn.',
  'Mapped ledger store, or documented online store 999999 when unmapped.':
    'Mã cửa hàng sổ cái đã ánh xạ; dùng cửa hàng trực tuyến 999999 khi chưa ánh xạ.',
  'Customer order date.': 'Ngày khách đặt hàng.',
  'Positive recognition date for non-cancelled orders.':
    'Ngày ghi nhận doanh thu dương cho đơn không bị hủy.',
  'Full net reversal date for returned orders.':
    'Ngày đảo toàn bộ doanh thu thuần của đơn trả hàng.',
  'delivered, cancelled or returned.': 'Đã giao, đã hủy hoặc đã trả hàng.',
  'Gross USD amount.': 'Số tiền gộp USD.',
  'Supplied net or gross USD minus USD discount.':
    'Giá trị thuần được cung cấp hoặc gộp USD trừ chiết khấu USD.',
  'USD discount, including cancelled orders.':
    'Chiết khấu USD, gồm cả đơn đã hủy.',
  'Validated WEB orders': 'Đơn WEB hợp lệ',
  'Validates order identity, dates and status, with explicit cancellation and return flags.':
    'Kiểm tra định danh, ngày và trạng thái đơn, với cờ hủy/trả hàng được xác định rõ.',
  'One unique online order.': 'Một đơn hàng trực tuyến duy nhất.',
  'Partial returns are not modeled. A returned order reverses its full net.':
    'Chưa mô hình hóa trả hàng một phần. Đơn trả hàng đảo toàn bộ giá trị thuần.',
  'Non-cancelled orders require a delivery date on or after order date.':
    'Đơn không bị hủy phải có ngày giao từ ngày đặt hàng trở đi.',
  'Returned orders require a return date on or after delivery.':
    'Đơn trả hàng phải có ngày trả từ ngày giao trở đi.',
  'Cancelled orders cannot have delivery or return dates; non-returned orders cannot have return dates.':
    'Đơn đã hủy không được có ngày giao hoặc trả; đơn chưa trả hàng không được có ngày trả.',
  'Controls omission from recognition events.':
    'Quyết định việc loại khỏi các sự kiện ghi nhận.',
  'Controls the additional negative return event.':
    'Quyết định sự kiện trả hàng âm bổ sung.',
  'Finance source projection': 'Dữ liệu GL',
  'Maps signed revenue journals without joining them to receipts or orders.':
    'Ánh xạ bút toán doanh thu có dấu mà không nối trực tiếp với hóa đơn hoặc đơn hàng.',
  'One uploaded journal row before validation.':
    'Một dòng bút toán đã nhập trước khi kiểm tra.',
  'The GL Net Amount mapping is required.':
    'Ánh xạ Số tiền thuần của GL là bắt buộc.',
  'Store aliases can resolve through the same validated store lookup.':
    'Mã cửa hàng tương đương có thể được xác định qua cùng phép tra cứu cửa hàng đã kiểm tra.',
  'All included journal types contribute to the finance total.':
    'Mọi loại bút toán được nạp đều góp vào tổng kế toán.',
  'Unique journal identifier.': 'Định danh bút toán duy nhất.',
  'Finance posting date.': 'Ngày ghi sổ kế toán.',
  'Supplied journal classification.': 'Phân loại bút toán được cung cấp.',
  'Original signed ledger amount.': 'Số tiền sổ cái có dấu ban đầu.',
  'Finance revenue journals': 'Bút toán doanh thu GL',
  'Produces the authoritative financial revenue after one accounting sign reversal.':
    'Tạo doanh thu kế toán chuẩn sau một lần đảo dấu kế toán.',
  'One unique journal.': 'Một bút toán duy nhất.',
  'A MANUAL label alone does not create a bridge adjustment.':
    'Nhãn MANUAL tự nó không tạo điều chỉnh cầu nối.',
  'Validate nonblank keys, posting date, journal type and signed amount.':
    'Kiểm tra khóa không trống, ngày ghi sổ, loại bút toán và số tiền có dấu.',
  'Reject duplicate journal IDs across files.':
    'Từ chối mã bút toán trùng giữa các tệp.',
  'Keep GL separate until both sides are aggregated.':
    'Giữ GL riêng đến khi cả hai phía đã được tổng hợp.',
  'Unique across all selected GL files.':
    'Duy nhất trên toàn bộ tệp GL đã chọn.',
  'Ledger store key.': 'Khóa cửa hàng sổ cái.',
  'Financial recognition date.': 'Ngày ghi nhận tài chính.',
  'Trimmed, uppercase journal type.':
    'Loại bút toán được bỏ khoảng trắng và chuyển thành chữ hoa.',
  'Signed uploaded ledger amount.': 'Số tiền sổ cái có dấu được nhập.',
  'Revenue = −amount_usd, reversed exactly once.':
    'Revenue = −amount_usd; chỉ đảo dấu đúng một lần.',
  'Sales Flash baseline': 'Cơ sở Sales Flash',
  'Provides the monthly gross starting total of the revenue bridge.':
    'Cung cấp tổng doanh thu gộp tháng làm điểm bắt đầu của cầu nối doanh thu.',
  'One uploaded monthly summary row. Channel and market are not modeled by current SQL.':
    'Một dòng tổng hợp tháng đã nhập. SQL hiện tại không mô hình hóa kênh và thị trường.',
  'The report describes Month × channel × market. Current engine projects month_end_date + revenue_usd and sums supplied rows; it does not validate channel/market uniqueness.':
    'Báo cáo mô tả mức Tháng × kênh × thị trường. Engine hiện chiếu month_end_date + revenue_usd và cộng các dòng được cung cấp; không kiểm tra tính duy nhất theo kênh/thị trường.',
  'Sum only month-end rows within the selected complete-month reporting period.':
    'Chỉ cộng dòng cuối tháng nằm trong kỳ báo cáo gồm các tháng trọn vẹn đã chọn.',
  'The selected header row controls metadata exclusion; Row 5 is not hardcoded.':
    'Dòng tiêu đề đã chọn quyết định phần mô tả bị bỏ qua; dòng 5 không được cố định trong mã.',
  'Do not join monthly Flash rows to daily orders or calendar rows.':
    'Không nối dòng Sales Flash theo tháng với đơn theo ngày hoặc các dòng lịch.',
  'Must be a real calendar month end.':
    'Phải là ngày cuối tháng dương lịch thực tế.',
  'Non-negative supplied monthly gross USD.':
    'Doanh thu gộp tháng USD được cung cấp, không âm.',
  'month_end_date (reporting period filter)': 'month_end_date (lọc kỳ báo cáo)',
  'Uses the selected sheet, column mappings, source fields and join pairs to resolve ledger store codes or return attributes.':
    'Dùng trang tính, ánh xạ cột, trường nguồn và các cặp khóa đã chọn để xác định mã cửa hàng sổ cái hoặc trả về thuộc tính.',
  'One unique selected reference key or composite key.':
    'Một khóa tham chiếu đơn hoặc ghép được chọn, có tính duy nhất.',
  'Many POS store IDs may share one Finance store code. Uniqueness is checked on the selected reference join keys, not on returned Finance codes.':
    'Nhiều mã cửa hàng POS có thể cùng một mã cửa hàng kế toán. Kiểm tra tính duy nhất trên khóa tham chiếu đã chọn, không kiểm tra trên mã kế toán được trả về.',
  'Trim and uppercase aliases; numeric Excel keys ending in .0 normalize without stripping text leading zeros.':
    'Bỏ khoảng trắng, viết hoa mã tương đương; chuẩn hóa hậu tố .0 của khóa số Excel mà không bỏ số 0 đầu của khóa văn bản.',
  'Check full reference key uniqueness without deleting duplicate rows.':
    'Kiểm tra tính duy nhất trên toàn bộ khóa tham chiếu, không xóa dòng trùng.',
  'Preserve all source rows through a left lookup; unmatched policy is explicit.':
    'Dùng tra cứu nối trái để giữ mọi dòng nguồn; chính sách không khớp được chọn rõ ràng.',
  'Finance store code is required when store resolution is selected.':
    'Mã cửa hàng kế toán là bắt buộc khi chọn chức năng xác định cửa hàng.',
  'Actual column names are selected explicitly and may be arbitrary.':
    'Tên cột thực tế được chọn rõ ràng và có thể đặt tùy ý.',
  'User-selected source/reference pairs, combined with AND':
    'Các cặp khóa nguồn/tham chiếu do người dùng chọn, kết hợp bằng AND',
  'Resolves calendar keys and supplies an explicit optional POS posting-date mapping.':
    'Xác định khóa lịch và cung cấp ánh xạ ngày ghi sổ POS tùy chọn, được cấu hình rõ ràng.',
  'One unambiguous calendar key maps to one date/posting-date pair.':
    'Mỗi khóa lịch không nhập nhằng ánh xạ đến một cặp ngày/ngày ghi sổ.',
  'working_day is a reference flag. The current engine does not calculate a working-day posting offset.':
    'working_day là cờ tham chiếu. Engine hiện không tính độ dịch chuyển ngày ghi sổ theo ngày làm việc.',
  'Use only the explicitly assigned Calendar worksheet and its selected header.':
    'Chỉ dùng trang Lịch được gán rõ ràng và dòng tiêu đề đã chọn của trang đó.',
  'Resolve the selected date field or POS posting date only when that purpose is configured.':
    'Chỉ xác định trường ngày đã chọn hoặc ngày ghi sổ POS khi mục đích này được cấu hình.',
  'Check the configured single/composite reference key before lookup.':
    'Kiểm tra khóa tham chiếu đơn/ghép đã cấu hình trước khi tra cứu.',
  'Optional source calendar key.': 'Khóa lịch nguồn tùy chọn.',
  'Recognized date column, or parsed calendar key.':
    'Cột ngày được nhận diện hoặc khóa lịch đã phân tích.',
  'Optional explicit posting mapping.': 'Ánh xạ ghi sổ rõ ràng, tùy chọn.',
  'date_key → calendar_date, posting_date':
    'date_key → calendar_date, posting_date',
  'Checks daily date AND currency coverage, or returns mapped rate attributes; supplied USD values are preserved.':
    'Kiểm tra phạm vi theo ngày AND tiền tệ, hoặc trả về thuộc tính tỷ giá đã ánh xạ; giữ nguyên số tiền USD được cung cấp.',
  'Report reference: day × currency.': 'Tham chiếu báo cáo: ngày × tiền tệ.',
  'An explicit local-currency FX conversion model is not implemented. Inspect actual uploaded worksheet schema rather than assuming these column names.':
    'Chưa triển khai mô hình quy đổi ngoại tệ FX rõ ràng. Hãy xem cấu trúc trang tính thực tế thay vì giả định tên cột.',
  'Only the confirmed sheet is loaded; date and currency form a composite key.':
    'Chỉ nạp trang tính đã xác nhận; ngày và tiền tệ tạo thành khóa ghép.',
  'Full validation checks key types, uniqueness, rate values, unmatched keys and row preservation.':
    'Kiểm tra toàn bộ kiểu khóa, tính duy nhất, tỷ giá, khóa không khớp và việc bảo toàn số dòng.',
  'Reference FX date; actual uploaded column names are preserved.':
    'Ngày FX tham chiếu; giữ nguyên tên cột thực tế được nhập.',
  'Reference local currency.': 'Đồng tiền địa phương tham chiếu.',
  'Report: local-currency units per USD.':
    'Báo cáo: số đơn vị tiền địa phương trên mỗi USD.',
  'date + currency (reference composite key)':
    'date + currency (khóa ghép tham chiếu)',
  'Looks up the configured recognition period AND currency without reconverting supplied USD.':
    'Tra cứu kỳ ghi nhận AND tiền tệ đã cấu hình mà không quy đổi lại số USD được cung cấp.',
  'Report reference: month × currency.': 'Tham chiếu báo cáo: tháng × tiền tệ.',
  'Only actual executed lookup evidence is marked Applied. No rule classifies daily versus month-end rate effects as explained rounding.':
    'Chỉ phép tra cứu thực sự thực thi được ghi Đã áp dụng. Không quy tắc nào tự giải thích ảnh hưởng FX hằng ngày so với cuối tháng là làm tròn.',
  'Supplied net_usd_month_end remains authoritative.':
    'net_usd_month_end được cung cấp vẫn là giá trị chuẩn.',
  'Do not apply a second conversion to a supplied USD amount.':
    'Không quy đổi lần thứ hai đối với số tiền USD được cung cấp.',
  'Reference month-end period.': 'Kỳ cuối tháng tham chiếu.',
  'Report formula: USD = local amount / usd_to_ccy.':
    'Công thức báo cáo: USD = local amount / usd_to_ccy.',
  'month + currency (reference composite key)':
    'month + currency (khóa ghép tham chiếu)',
  'Recognition events': 'Sự kiện ghi nhận',
  'Unifies POS and WEB revenue recognition while retaining source traceability in the run preview.':
    'Hợp nhất ghi nhận doanh thu POS và WEB, đồng thời giữ khả năng truy vết nguồn trong bằng chứng của lần chạy.',
  'One revenue recognition event; one returned order contributes two events.':
    'Một sự kiện ghi nhận doanh thu; một đơn trả hàng tạo hai sự kiện.',
  'There is no persistent table named unified_transactions. This connection-scoped view is captured only as a bounded same-run preview; GL, Flash and dimensions remain separate.':
    'Không có bảng lưu cố định tên unified_transactions. Bảng logic theo kết nối này chỉ được giữ dưới dạng xem trước giới hạn của cùng lần chạy; GL, Sales Flash và bảng tham chiếu vẫn tách riêng.',
  'UNION ALL keeper POS net on posting date.':
    'UNION ALL doanh thu thuần POS được giữ lại vào ngày ghi sổ.',
  'UNION ALL non-cancelled WEB net on delivery date.':
    'UNION ALL doanh thu thuần WEB không bị hủy vào ngày giao.',
  'UNION ALL returned WEB negative net on return date.':
    'UNION ALL doanh thu thuần WEB trả hàng với dấu âm vào ngày trả.',
  'Cancelled WEB orders create no normal recognition event, but stay in source and cancellation classification.':
    'Đơn WEB đã hủy không tạo sự kiện ghi nhận thông thường, nhưng vẫn nằm trong nguồn và nhóm hủy đơn.',
  'Shared normalized ledger store key.':
    'Khóa cửa hàng sổ cái chuẩn hóa dùng chung.',
  'Recognition date: POS posting, WEB delivery or WEB return.':
    'Ngày ghi nhận: ngày ghi sổ POS, ngày giao WEB hoặc ngày trả WEB.',
  'Positive keeper/delivery net or negative full return net.':
    'Thuần dương của dòng được giữ/giao hàng hoặc thuần âm toàn bộ của trả hàng.',
  'store_key + posting_date are aggregation keys, not a unique event identity':
    'store_key + posting_date là khóa tổng hợp, không phải định danh sự kiện duy nhất',
  'Expected daily revenue': 'Doanh thu kỳ vọng theo ngày',
  'Sums source recognition events at the same grain as financial comparison.':
    'Cộng các sự kiện ghi nhận nguồn ở cùng mức chi tiết với đối chiếu kế toán.',
  'One store_key × posting_date.': 'Một cặp store_key × posting_date.',
  'Aggregate all source events by store and posting date.':
    'Tổng hợp mọi sự kiện nguồn theo cửa hàng và ngày ghi sổ.',
  'Keep adjacent-period input rows until timing and recognition are evaluated.':
    'Giữ dòng đầu vào giáp kỳ đến khi đã đánh giá thời điểm và ghi nhận.',
  'Shared store key.': 'Khóa cửa hàng dùng chung.',
  'Recognition day.': 'Ngày ghi nhận.',
  'SUM(revenue_usd) from recognition events.':
    'SUM(revenue_usd) từ các sự kiện ghi nhận.',
  'Actual daily ledger': 'Sổ cái thực tế theo ngày',
  'Aggregates journals to a compatible daily store grain.':
    'Tổng hợp bút toán về cùng mức cửa hàng–ngày để đối chiếu.',
  'SUM revenue and COUNT journals before comparison.':
    'SUM doanh thu và COUNT bút toán trước khi đối chiếu.',
  'A zero-valued journal still means the GL group exists.':
    'Bút toán có giá trị 0 vẫn có nghĩa nhóm GL tồn tại.',
  'Posting day.': 'Ngày ghi sổ.',
  'SUM once-reversed journal revenue.':
    'SUM doanh thu bút toán sau đúng một lần đảo dấu.',
  'Journal count; distinguishes absent groups from a present zero journal.':
    'Số bút toán; phân biệt nhóm không có với nhóm có bút toán bằng 0.',
  'Store-day reconciliation': 'Đối soát cửa hàng–ngày',
  'Compares complete expected and actual daily aggregates, including source-only and GL-only days.':
    'So sánh toàn bộ tổng nguồn kỳ vọng và GL thực tế theo ngày, gồm cả ngày chỉ có một phía.',
  'One store_key × posting_date from either side.':
    'Một cặp store_key × posting_date từ một trong hai phía.',
  'FULL OUTER JOIN expected_daily and gl_daily on store_key + posting_date.':
    'FULL OUTER JOIN expected_daily và gl_daily theo store_key + posting_date.',
  'A present GL group with a wrong amount is a variance, not missing GL.':
    'Nhóm GL có mặt nhưng sai số tiền là chênh lệch, không phải thiếu GL.',
  'Source-minus-GL exception deltas reverse the daily SQL variance sign.':
    'Chênh lệch ngoại lệ nguồn trừ GL đảo dấu so với chênh lệch SQL theo ngày.',
  'Coalesced key from both sides.': 'Khóa được lấy từ phía có dữ liệu.',
  'Coalesced posting date.': 'Ngày ghi sổ được lấy từ phía có dữ liệu.',
  'Source aggregate; absent side contributes zero at comparison grain.':
    'Tổng nguồn; phía không có đóng góp 0 tại mức đối chiếu tổng hợp.',
  'Ledger aggregate; absent side contributes zero at comparison grain.':
    'Tổng sổ cái; phía không có đóng góp 0 tại mức đối chiếu tổng hợp.',
  'GL − expected source.': 'GL − nguồn kỳ vọng.',
  'No GL group, and nonzero expected revenue.':
    'Không có nhóm GL và doanh thu kỳ vọng khác 0.',
  'Revenue bridge': 'Cầu nối doanh thu',
  'Explains the difference from monthly gross Flash to financial ledger revenue.':
    'Giải thích chênh lệch từ doanh thu gộp Sales Flash theo tháng đến doanh thu sổ cái.',
  'One selected complete-month reporting period.':
    'Một kỳ báo cáo gồm các tháng trọn vẹn đã chọn.',
  'Apply each bridge bucket using its own date and source grain.':
    'Tính từng nhóm cầu nối theo ngày và mức chi tiết riêng của nguồn.',
  'Preserve an explicit residual; do not invent rounding, shipping, FX or channel adjustments.':
    'Giữ phần dư rõ ràng; không tự tạo điều chỉnh làm tròn, vận chuyển, FX hoặc kênh.',
  'Convert decimal strings into safe integer cents and reject unsafe totals.':
    'Chuyển chuỗi số thập phân sang số nguyên cent an toàn và từ chối tổng vượt giới hạn.',
  'Monthly gross baseline.': 'Cơ sở doanh thu gộp theo tháng.',
  'Negative raw discounts.': 'Chiết khấu nguồn với dấu âm.',
  'Negative cancelled WEB gross less discount.':
    'Âm số gộp WEB đã hủy trừ chiết khấu.',
  'Recognition-date net less transaction-date net within the period.':
    'Thuần theo ngày ghi nhận trừ thuần theo ngày giao dịch trong kỳ.',
  'Negative returned WEB net on return date.':
    'Âm doanh thu thuần WEB trả hàng tại ngày trả.',
  'Discarded POS net plus genuine missing-GL store-day adjustments.':
    'Thuần POS bị loại cộng điều chỉnh cửa hàng–ngày thực sự thiếu GL.',
  'GL minus baseline and classified adjustments.':
    'GL trừ cơ sở và các điều chỉnh đã phân loại.',
  'Once-sign-reversed finance revenue.':
    'Doanh thu kế toán sau đúng một lần đảo dấu.',
  'Dashboard & Exception Log': 'Tổng quan & Nhật ký ngoại lệ',
  'Publishes exact-cent totals, complete exceptions and bounded model previews from one successful run.':
    'Công bố tổng chính xác đến cent, toàn bộ ngoại lệ và bằng chứng mô hình giới hạn từ cùng lần chạy thành công.',
  'One run/configuration snapshot, plus traceable exception cases.':
    'Một kết quả của lần chạy/cấu hình, kèm các trường hợp ngoại lệ truy vết được.',
  'Dashboard and exceptions publish together after success.':
    'Tổng quan và ngoại lệ được công bố cùng lúc sau khi thành công.',
  'Changes to files, mapping, header or period invalidate the result and its evidence.':
    'Thay tệp, ánh xạ, dòng tiêu đề hoặc kỳ sẽ làm mất hiệu lực kết quả và bằng chứng.',
  'Local exports create review drafts; no financial data is uploaded or posted to an ERP.':
    'Tệp xuất cục bộ tạo bản nháp để kiểm tra; không tải dữ liệu tài chính lên hoặc ghi vào ERP.',
  'Authoritative bridge money values.': 'Số tiền chuẩn của cầu nối.',
  'Duplicate receipt/line exports and nonzero daily differences.':
    'Bản xuất hóa đơn/dòng trùng và chênh lệch theo ngày khác 0.',
  'At most 200 largest nonzero store-day differences.':
    'Tối đa 200 chênh lệch cửa hàng–ngày khác 0 lớn nhất.',
  'Captured before SQL connection cleanup; unavailable until a successful supported run.':
    'Được ghi nhận trước khi đóng kết nối SQL; chỉ có sau lần chạy thành công được hỗ trợ.',
  'run identity': 'định danh lần chạy',
  'reporting period': 'kỳ báo cáo',
  'confirmed file configuration': 'cấu hình tệp đã xác nhận',
  'Type & rank exports': 'Định kiểu & xếp hạng bản xuất',
  'Projection + window ranking': 'Chiếu dữ liệu + xếp hạng cửa sổ',
  '1 input row → 1 ranked row': '1 dòng đầu vào → 1 dòng được xếp hạng',
  'Typed POS rows pass full accounting validation.':
    'Dòng POS đã định kiểu vượt qua toàn bộ kiểm tra kế toán.',
  'ROW_NUMBER orders by exported_at, source_export_seq, file order and row order. Original source export_seq is not blindly filtered.':
    'ROW_NUMBER sắp theo exported_at, source_export_seq, thứ tự tệp và dòng. Không lọc trực tiếp theo export_seq nguồn một cách mặc định.',
  'PARTITION BY receipt_no, line_no': 'PARTITION BY receipt_no, line_no',
  'Keep earliest export': 'Giữ bản xuất sớm nhất',
  Filter: 'Lọc',
  'Many exports → one keeper per receipt line':
    'Nhiều bản xuất → một dòng được giữ cho mỗi dòng hóa đơn',
  'Use computed rank, not the uploaded sequence.':
    'Dùng thứ hạng được tính, không dùng thứ tự tải lên.',
  'Discarded rows stay in pos_ranked for duplicate-net bridge and exception evidence.':
    'Dòng bị loại vẫn ở pos_ranked để tính cầu nối phần thuần trùng và bằng chứng ngoại lệ.',
  'Computed export_seq = 1': 'export_seq được tính = 1',
  'Validate order lifecycle': 'Kiểm tra vòng đời đơn hàng',
  'Projection + validation': 'Chiếu dữ liệu + kiểm tra',
  '1 order → 1 normalized order': '1 đơn → 1 đơn được chuẩn hóa',
  'Valid status, unique ID, valid dates and non-negative net/discount.':
    'Trạng thái hợp lệ, mã duy nhất, ngày hợp lệ và thuần/chiết khấu không âm.',
  'Cancelled and returned flags control subsequent recognition. Invalid supplied dates are not silently invented.':
    'Cờ hủy và trả hàng quyết định bước ghi nhận tiếp theo. Không tự tạo ngày khi giá trị cung cấp không hợp lệ.',
  'web_order_id must be unique': 'web_order_id phải duy nhất',
  'Normalize ledger sign': 'Chuẩn hóa dấu sổ cái',
  '1 journal → 1 revenue journal': '1 bút toán → 1 bút toán doanh thu',
  'Signed amount, posting date, store and journal type are required.':
    'Bắt buộc số tiền có dấu, ngày ghi sổ, cửa hàng và loại bút toán.',
  'revenue_usd = −amount_usd, applied once.':
    'revenue_usd = −amount_usd; chỉ áp dụng một lần.',
  'journal_id must be unique': 'journal_id phải duy nhất',
  'Resolve POS store alias': 'Xác định mã cửa hàng POS',
  'Configured left lookup in accounting projection':
    'Tra cứu nối trái đã cấu hình trong bước chiếu kế toán',
  'Many fact rows → at most one lookup target':
    'Nhiều dòng nguồn → tối đa một kết quả tra cứu',
  'A confirmed Store Master relationship selects this source and its reference keys.':
    'Quan hệ Danh mục cửa hàng đã xác nhận chọn nguồn này và các khóa tham chiếu.',
  'The engine performs the configured left lookup. Duplicate reference keys fail; unmatched rows either block processing or preserve the source key according to the selected policy.':
    'Engine dùng phép tra cứu nối trái đã cấu hình. Khóa tham chiếu trùng gây lỗi; dòng không khớp sẽ chặn xử lý hoặc giữ khóa nguồn theo chính sách đã chọn.',
  'Configured source/reference pairs combined with AND':
    'Cặp khóa nguồn/tham chiếu đã cấu hình, kết hợp bằng AND',
  'Resolve WEB store alias': 'Xác định mã cửa hàng WEB',
  'Many fact rows → at most one target':
    'Nhiều dòng nguồn → tối đa một kết quả',
  'WEB store is mapped; otherwise online ledger store 999999 is explicit.':
    'Cửa hàng WEB đã ánh xạ; nếu không, dùng mã cửa hàng trực tuyến 999999 được quy định rõ.',
  'Repeated finance target codes are compatible with many aliases; one alias cannot map to multiple stores.':
    'Nhiều mã tương đương có thể trả về cùng mã kế toán; một mã không được ánh xạ tới nhiều cửa hàng.',
  'Resolve GL store alias': 'Xác định mã cửa hàng GL',
  'Many journals → at most one target': 'Nhiều bút toán → tối đa một kết quả',
  'A confirmed Store Master relationship selects GL.':
    'Quan hệ Danh mục cửa hàng đã xác nhận chọn GL.',
  'The same normalized ledger key is used before source and GL aggregation. There is no many-to-many revenue join.':
    'Dùng cùng khóa sổ cái chuẩn hóa trước khi tổng hợp nguồn và GL. Không nối doanh thu nhiều–nhiều.',
  'Resolve dates & posting map': 'Xác định ngày & ánh xạ ghi sổ',
  'Configured left lookup + explicit purpose':
    'Tra cứu nối trái đã cấu hình + mục đích rõ ràng',
  'Many source rows → at most one date mapping':
    'Nhiều dòng nguồn → tối đa một ánh xạ ngày',
  'A confirmed Calendar relationship explicitly resolves a date or supplies POS posting date.':
    'Quan hệ Lịch đã xác nhận xác định rõ ngày nguồn hoặc cung cấp ngày ghi sổ POS.',
  'If no explicit posting mapping exists, use business_date. working_day is not used to calculate an offset.':
    'Nếu không có ánh xạ ghi sổ rõ ràng, dùng business_date. Không dùng working_day để tính số ngày dịch chuyển.',
  'Selected date or posting-date output':
    'Đầu ra ngày hoặc ngày ghi sổ đã chọn',
  'Resolve WEB calendar keys': 'Xác định khóa lịch WEB',
  'Configured date-resolution left lookup':
    'Tra cứu nối trái để xác định ngày đã cấu hình',
  'Many orders → at most one date mapping per date role':
    'Nhiều đơn → tối đa một ánh xạ cho từng vai trò ngày',
  'A confirmed Calendar date-resolution relationship selects the source date field.':
    'Quan hệ xác định ngày của Lịch đã xác nhận chọn trường ngày nguồn.',
  'Each date role stays separate. Delivery and return sequence is validated after normalization.':
    'Mỗi vai trò ngày được giữ riêng. Kiểm tra thứ tự giao và trả hàng sau khi chuẩn hóa.',
  'Selected source/reference date key pairs':
    'Cặp khóa ngày nguồn/tham chiếu đã chọn',
  'Resolve posting calendar key': 'Xác định khóa lịch ghi sổ',
  'Many journals → at most one date mapping':
    'Nhiều bút toán → tối đa một ánh xạ ngày',
  'A confirmed Calendar relationship selects GL posting date.':
    'Quan hệ Lịch đã xác nhận chọn ngày ghi sổ GL.',
  'This resolves an explicit date key; it does not infer Finance recognition timing.':
    'Xác định khóa ngày được chỉ định rõ; không tự suy ra thời điểm ghi nhận kế toán.',
  'Selected source/reference key pairs': 'Cặp khóa nguồn/tham chiếu đã chọn',
  'POS recognition': 'Ghi nhận POS',
  'UNION ALL branch': 'Nhánh UNION ALL',
  '1 keeper line → 1 event': '1 dòng được giữ → 1 sự kiện',
  'Keeper POS row has passed validation.':
    'Dòng POS được giữ đã vượt qua kiểm tra.',
  'Recognize net_usd_month_end on posting_date. This is event construction, not a receipt-to-journal join.':
    'Ghi nhận net_usd_month_end vào posting_date. Đây là tạo sự kiện, không nối hóa đơn với bút toán.',
  'Delivery & return events': 'Sự kiện giao & trả hàng',
  'Two UNION ALL branches': 'Hai nhánh UNION ALL',
  'Cancelled: 0 events; delivered: 1; returned: 2':
    'Đã hủy: 0 sự kiện; đã giao: 1; đã trả: 2',
  'Non-cancelled orders recognize positive net on delivery; returned orders additionally reverse full net on return.':
    'Đơn không bị hủy ghi nhận thuần dương khi giao; đơn trả hàng đảo thêm toàn bộ thuần khi trả.',
  'The original order is retained in vw_web so both events can be traced. No partial return is inferred.':
    'Đơn gốc được giữ trong vw_web để truy vết cả hai sự kiện. Không tự suy ra trả hàng một phần.',
  'delivery_date / return_date': 'delivery_date / return_date',
  'Aggregate source revenue': 'Tổng hợp doanh thu nguồn',
  'GROUP BY store_key, posting_date': 'GROUP BY store_key, posting_date',
  'Many recognition events → 1 store-day':
    'Nhiều sự kiện ghi nhận → 1 cặp cửa hàng–ngày',
  'Retain all selected input dates until period-sensitive recognition has been calculated.':
    'Giữ mọi ngày đầu vào đã chọn đến khi đã tính ghi nhận phụ thuộc kỳ báo cáo.',
  'A common grain prevents multiple receipts from being multiplied by multiple journals.':
    'Cùng mức chi tiết giúp tránh nhân nhiều hóa đơn với nhiều bút toán.',
  'Aggregate finance revenue': 'Tổng hợp doanh thu kế toán',
  'Many journals → 1 store-day': 'Nhiều bút toán → 1 cặp cửa hàng–ngày',
  'All included revenue journal types contribute.':
    'Mọi loại bút toán doanh thu được nạp đều đóng góp.',
  'SUM revenue_usd and COUNT journals. A present zero journal is a real group.':
    'SUM revenue_usd và COUNT bút toán. Bút toán bằng 0 có mặt vẫn tạo một nhóm thực.',
  'Compare compatible aggregates': 'Đối chiếu tổng hợp cùng mức',
  'FULL OUTER JOIN gl_daily USING (store_key, posting_date)':
    'FULL OUTER JOIN gl_daily USING (store_key, posting_date)',
  'One store-day ↔ one store-day, including unmatched sides':
    'Một cửa hàng–ngày ↔ một cửa hàng–ngày, gồm cả phía không khớp',
  'Each side has already been grouped to the same keys.':
    'Mỗi phía đã được tổng hợp theo cùng các khóa.',
  'Missing sides become zero at aggregate comparison grain. Daily variance = GL − source. No receipt/order-to-journal join occurs.':
    'Phía không có dữ liệu đóng góp 0 khi đối chiếu tổng hợp. Chênh lệch ngày = GL − nguồn. Không nối hóa đơn/đơn hàng trực tiếp với bút toán.',
  'Retain ledger-only days': 'Giữ ngày chỉ có sổ cái',
  'FULL OUTER JOIN expected_daily USING (store_key, posting_date)':
    'FULL OUTER JOIN expected_daily USING (store_key, posting_date)',
  'GL aggregate exists with its journal count.':
    'Tổng GL tồn tại cùng số bút toán của nhóm.',
  'Extra ledger days remain visible variances. They are not automatically treated as missing GL or invented data errors.':
    'Ngày chỉ có sổ cái vẫn là chênh lệch hiển thị. Không tự coi là thiếu GL hoặc tạo lỗi dữ liệu.',
  'Monthly gross baseline': 'Cơ sở doanh thu gộp tháng',
  'Reporting-period filter + SUM; scalar bridge composition':
    'Lọc kỳ báo cáo + SUM; tổng hợp cầu nối',
  'Many monthly rows → 1 reporting-period total':
    'Nhiều dòng tháng → 1 tổng kỳ báo cáo',
  'Complete calendar months; Flash dates are actual month ends.':
    'Kỳ gồm trọn tháng dương lịch; ngày Sales Flash là ngày cuối tháng thực tế.',
  'There is no Flash-to-daily-Calendar join. Joining a monthly amount to every day and then summing would multiply revenue.':
    'Không nối Sales Flash với Lịch theo ngày. Nối một số tiền tháng vào mỗi ngày rồi cộng sẽ nhân doanh thu.',
  'month_end_date BETWEEN period.start AND period.end':
    'month_end_date BETWEEN period.start AND period.end',
  'POS bridge adjustments': 'Điều chỉnh cầu nối POS',
  'Separate aggregate calculations': 'Các phép tổng hợp riêng',
  'Many POS exports → reporting-period bucket totals':
    'Nhiều bản xuất POS → tổng các nhóm trong kỳ báo cáo',
  'Raw discounts first; discarded duplicate net second; keeper timing at period boundaries.':
    'Chiết khấu gốc trước; thuần trùng bị loại sau; thời điểm của dòng được giữ ở ranh giới kỳ.',
  'Duplicate net is removed without deducting its discount a second time. The bridge assumes Flash includes raw POS exports.':
    'Loại thuần trùng mà không trừ chiết khấu lần hai. Cầu nối giả định Sales Flash có gồm các bản xuất POS gốc.',
  'WEB bridge adjustments': 'Điều chỉnh cầu nối WEB',
  'Separate date-aware aggregate calculations':
    'Các phép tổng hợp riêng theo vai trò ngày',
  'Many orders → reporting-period bucket totals':
    'Nhiều đơn → tổng các nhóm trong kỳ báo cáo',
  'Discounts include cancelled orders; cancellations remove cancelled gross minus discount; returned net reverses on return date.':
    'Chiết khấu gồm đơn đã hủy; nhóm hủy loại số gộp trừ chiết khấu; thuần trả hàng được đảo tại ngày trả.',
  'Cross-period delivery creates incoming or outgoing timing. A return may relate to an order in a previous period.':
    'Giao hàng khác kỳ tạo chênh lệch thời điểm vào hoặc ra. Hàng trả có thể thuộc đơn kỳ trước.',
  'Genuine missing-GL adjustment': 'Điều chỉnh GL thực sự thiếu',
  'Filter missing_gl + period SUM': 'Lọc missing_gl + SUM trong kỳ',
  'Many missing store-days → 1 Data Errors component':
    'Nhiều cửa hàng–ngày thiếu GL → 1 thành phần Lỗi dữ liệu',
  'No GL journals and nonzero expected revenue.':
    'Không có bút toán GL và doanh thu kỳ vọng khác 0.',
  'Adjustment = 0 − expected revenue. A missing refund day therefore contributes a positive adjustment. Present-but-wrong GL amounts stay residual.':
    'Điều chỉnh = 0 − doanh thu kỳ vọng. Vì vậy, thiếu ngày hoàn tiền tạo điều chỉnh dương. GL có mặt nhưng sai số tiền vẫn nằm trong phần dư.',
  'Finance endpoint': 'Điểm cuối kế toán',
  'Posting-period filter + SUM': 'Lọc kỳ ghi sổ + SUM',
  'Many journals → 1 finance total': 'Nhiều bút toán → 1 tổng kế toán',
  'Signed revenue journals only; normalized revenue sign has already been applied.':
    'Chỉ bút toán doanh thu có dấu; việc chuẩn hóa dấu doanh thu đã được áp dụng.',
  'The actual GL total is the endpoint; unexplained = GL − classified bridge total.':
    'Tổng GL thực tế là điểm cuối; phần chưa giải thích = GL − tổng cầu nối đã phân loại.',
  'posting_date BETWEEN period.start AND period.end':
    'posting_date BETWEEN period.start AND period.end',
  'Publish one result snapshot': 'Công bố một kết quả đồng bộ',
  'Atomic store publication': 'Công bố state đồng thời',
  '1 successful run → 1 current snapshot':
    '1 lần chạy thành công → 1 kết quả hiện tại',
  'Run is still current and not aborted; all required sources and mappings are confirmed.':
    'Lần chạy vẫn hiện hành, chưa bị hủy; mọi nguồn và ánh xạ bắt buộc đã được xác nhận.',
  'Bounded evidence, bridge and exception results belong to the same run. Edits invalidate them together.':
    'Bằng chứng giới hạn, cầu nối và ngoại lệ thuộc cùng lần chạy. Mọi chỉnh sửa làm mất hiệu lực đồng thời.',
  'generation token': 'mã thế hệ xử lý',
  'confirmed configuration': 'cấu hình đã xác nhận',
  'Trace daily differences': 'Truy vết chênh lệch ngày',
  'Nonzero period filter + exception projection':
    'Lọc chênh lệch khác 0 trong kỳ + chiếu ngoại lệ',
  '1 nonzero store-day → 1 daily exception case':
    '1 cửa hàng–ngày chênh lệch khác 0 → 1 ngoại lệ ngày',
  'Exception output is complete; Dashboard daily preview is capped at 200.':
    'Đầu ra ngoại lệ là đầy đủ; Tổng quan chỉ xem trước tối đa 200 nhóm ngày.',
  'Exception delta = source − GL. The default UI filter is strict |delta| > $200; exports include all filtered cases before pagination.':
    'Chênh lệch ngoại lệ = nguồn − GL. Bộ lọc mặc định là |delta| > $200; xuất mọi trường hợp đã lọc trước khi phân trang.',
  'Read the selected header row': 'Đọc dòng tiêu đề đã chọn',
  Parsing: 'Đọc dữ liệu',
  'Exclude export metadata without changing which source rows mean data.':
    'Bỏ thông tin mô tả của bản xuất mà không thay đổi các dòng dữ liệu nguồn thực tế.',
  'Each selected CSV/XLSX file; one-based header row defaults to 1.':
    'Mỗi tệp CSV/XLSX đã chọn; dòng tiêu đề đánh số từ 1, mặc định là 1.',
  'Use the same selected header for bounded preview and full ingestion. Fact exports use the first worksheet; each selected Master sheet has its own header shared by all roles using that sheet.':
    'Dùng cùng dòng tiêu đề cho xem trước giới hạn và nạp toàn bộ dữ liệu. Nguồn giao dịch dùng trang tính đầu tiên; mỗi trang tham chiếu có dòng tiêu đề riêng, dùng chung cho các vai trò sử dụng trang đó.',
  'Mapped headers and source rows after the selected header.':
    'Tên cột đã ánh xạ và các dòng sau dòng tiêu đề được chọn.',
  'Missing or duplicate headers produce a recoverable warning. Corrupt files and invalid cached formula/error cells fail visibly. No unconditional Flash row skip.':
    'Tiêu đề thiếu hoặc trùng tạo cảnh báo có thể khắc phục. Tệp hỏng hoặc ô lỗi/công thức chưa có kết quả lưu sẽ gây lỗi rõ ràng. Không tự bỏ dòng đầu Sales Flash.',
  'Normalize each date role': 'Chuẩn hóa từng vai trò ngày',
  Normalization: 'Chuẩn hóa',
  'Make sales, delivery, return and posting dates comparable without inventing dates.':
    'Làm cho ngày bán, giao, trả hàng và ghi sổ có thể đối chiếu mà không tạo ngày giả định.',
  'A date field is mapped or is required by a row’s lifecycle.':
    'Trường ngày được ánh xạ hoặc bắt buộc theo vòng đời của dòng.',
  'Parse supported timestamps, ISO dates and calendar keys. Slash dates try US month-first before day-first. If direct parsing does not resolve a value, use a validated calendar lookup where available.':
    'Phân tích thời điểm, ngày ISO và khóa lịch được hỗ trợ. Ngày gạch chéo thử tháng trước theo kiểu Mỹ, sau đó ngày trước. Khi không phân tích trực tiếp được, dùng tra cứu lịch đã kiểm tra nếu có.',
  'Typed DATE/TIMESTAMP values in normalized source relations.':
    'Giá trị DATE/TIMESTAMP có kiểu trong các bảng nguồn chuẩn hóa.',
  'Unresolved required dates fail row validation; invalid mapped dates do not become a fabricated reporting date.':
    'Ngày bắt buộc không xác định được sẽ gây lỗi kiểm tra dòng; ngày ánh xạ không hợp lệ không được thay bằng ngày báo cáo tự tạo.',
  'selected date columns': 'cột ngày đã chọn',
  'confirmed Calendar relationships': 'quan hệ Lịch đã xác nhận',
  'Keep the earliest POS export': 'Giữ bản xuất POS sớm nhất',
  'Source integrity': 'Toàn vẹn nguồn',
  'Count each receipt line once while retaining discarded export evidence.':
    'Tính mỗi dòng hóa đơn một lần, đồng thời giữ bằng chứng các bản xuất bị loại.',
  'All selected POS export rows, including duplicates across files.':
    'Mọi dòng bản xuất POS đã chọn, gồm cả bản trùng giữa các tệp.',
  'Partition by receipt_no + line_no. Rank by earliest exported_at, then source sequence, stable file order and row order. Keep computed export_seq = 1.':
    'Phân nhóm theo receipt_no + line_no. Xếp theo exported_at sớm nhất, rồi thứ tự nguồn, thứ tự tệp và dòng ổn định. Giữ export_seq được tính bằng 1.',
  'vw_pos keeper lines; discarded net contributes a negative duplicate bridge adjustment by business date.':
    'Các dòng được giữ trong vw_pos; thuần bị loại đóng góp điều chỉnh trùng âm theo ngày kinh doanh.',
  'Required identities and amounts fail when invalid. Missing export timestamps use the documented sequence/file-order fallback; malformed supplied timestamps fail.':
    'Định danh và số tiền bắt buộc không hợp lệ sẽ gây lỗi. Thiếu thời điểm xuất thì dùng thứ tự nguồn/tệp đã quy định; thời điểm được cung cấp nhưng sai định dạng sẽ gây lỗi.',
  'file/row order': 'thứ tự tệp/dòng',
  'Honor mapped net amounts': 'Ưu tiên số tiền thuần đã ánh xạ',
  Amounts: 'Số tiền',
  'Preserve supplied net and avoid deducting a discount twice.':
    'Giữ nguyên giá trị thuần được cung cấp và tránh trừ chiết khấu hai lần.',
  'Decision is made per file’s confirmed mapping, before SQL is generated.':
    'Quyết định theo ánh xạ đã xác nhận của từng tệp, trước khi sinh SQL.',
  'If net is mapped, use that selected value, including zero. If unmapped, calculate selected gross USD minus selected USD discount and ignore unselected native net columns.':
    'Nếu đã ánh xạ thuần, dùng giá trị được chọn, kể cả 0. Nếu chưa ánh xạ, tính gộp USD đã chọn trừ chiết khấu USD đã chọn và bỏ qua các cột thuần gốc không được chọn.',
  'net_usd_month_end as DECIMAL(18,2).':
    'net_usd_month_end theo DECIMAL(18,2).',
  'Mapped blank/invalid net fails row validation; there is no per-cell fallback. POS non-USD line_amount cannot be combined with USD discount to derive USD net.':
    'Thuần đã ánh xạ nhưng trống/sai sẽ gây lỗi kiểm tra dòng; không thay thế theo từng ô. Không kết hợp line_amount POS không phải USD với chiết khấu USD để suy ra thuần USD.',
  'selected net_amount': 'net_amount đã chọn',
  'selected gross_amount': 'gross_amount đã chọn',
  'selected discount': 'discount đã chọn',
  'Recognize delivery and reverse returns': 'Ghi nhận giao và đảo trả hàng',
  Recognition: 'Ghi nhận',
  'Separate order activity from earned revenue.':
    'Tách hoạt động đặt hàng khỏi doanh thu đã ghi nhận.',
  'Delivered, Cancelled/Canceled and Returned statuses only, normalized case-insensitively.':
    'Chỉ nhận trạng thái Delivered, Cancelled/Canceled và Returned, được chuẩn hóa không phân biệt chữ hoa/thường; hiển thị tương ứng Đã giao, Đã hủy, Đã trả hàng.',
  'Delivered: positive net on delivery. Returned: positive net on delivery and full negative net on return. Cancelled: no recognition event; retain source row for cancellation bridge.':
    'Đã giao: thuần dương tại ngày giao. Đã trả: thuần dương tại ngày giao và âm toàn bộ thuần tại ngày trả. Đã hủy: không có sự kiện ghi nhận; giữ dòng nguồn để tính nhóm hủy đơn.',
  'Zero, one or two recognition events per order.':
    'Không, một hoặc hai sự kiện ghi nhận cho mỗi đơn.',
  'Dates must follow the actual order lifecycle. Missing delivery/return dates fail where required. Cancelled orders cannot carry delivery/return dates. Partial refunds are not modeled.':
    'Ngày phải tuân theo vòng đời đơn thực tế. Thiếu ngày giao/trả khi bắt buộc sẽ gây lỗi. Đơn đã hủy không được có ngày giao/trả. Chưa mô hình hóa hoàn tiền một phần.',
  'Normalize the finance sign once': 'Chuẩn hóa dấu kế toán một lần',
  'Express signed ledger credits as revenue consistently.':
    'Thể hiện nhất quán khoản ghi Có sổ cái có dấu thành doanh thu.',
  'Every validated included revenue journal.':
    'Mọi bút toán doanh thu hợp lệ được nạp.',
  'revenue_usd = −amount_usd. All included journal types affect Finance revenue; MANUAL does not itself explain the bridge.':
    'revenue_usd = −amount_usd. Mọi loại bút toán được nạp đều ảnh hưởng doanh thu kế toán; riêng MANUAL không tự giải thích cầu nối.',
  'Once-reversed journal revenue in vw_gl.':
    'Doanh thu bút toán sau một lần đảo dấu trong vw_gl.',
  'GL Net Amount remains required. Invalid signed amounts, missing identity/date/store/type or duplicate journal IDs fail.':
    'Số tiền thuần GL vẫn bắt buộc. Số tiền có dấu không hợp lệ, thiếu định danh/ngày/cửa hàng/loại hoặc mã bút toán trùng đều gây lỗi.',
  'selected signed amount_usd / Net Amount':
    'amount_usd có dấu / Số tiền thuần đã chọn',
  'Resolve stores without fanout': 'Xác định cửa hàng, tránh nhân dòng',
  Dimensions: 'Bảng tham chiếu',
  'Compare equivalent stores while preventing duplicated revenue through ambiguous joins.':
    'Đối chiếu cửa hàng tương đương, đồng thời tránh nhân doanh thu do phép nối nhập nhằng.',
  'A confirmed Store Master relationship chooses the source, worksheet, mappings, join pairs and returned Finance code.':
    'Quan hệ Danh mục cửa hàng đã xác nhận chọn nguồn, trang tính, ánh xạ, cặp khóa nối và mã kế toán trả về.',
  'Trim and uppercase text keys while preserving leading zeros. Check uniqueness on the exact chosen single/composite reference key; duplicates block the run. Execute a left lookup with the configured unmatched policy.':
    'Bỏ khoảng trắng và viết hoa khóa văn bản, giữ số 0 đầu. Kiểm tra tính duy nhất trên đúng khóa tham chiếu đơn/ghép đã chọn; khóa trùng chặn lần chạy. Dùng tra cứu nối trái theo chính sách không khớp đã cấu hình.',
  'One normalized store_key per fact row.':
    'Một store_key chuẩn hóa cho mỗi dòng nguồn.',
  'Conflicting alias targets fail. An unmapped WEB store alone uses documented online store 999999. No arbitrary store assignment is synthesized.':
    'Mã tương đương có nhiều kết quả mâu thuẫn sẽ gây lỗi. Chỉ WEB chưa ánh xạ cửa hàng được dùng mã trực tuyến 999999 đã quy định. Không tự gán cửa hàng bất kỳ.',
  'selected store column': 'cột cửa hàng đã chọn',
  'mapped Finance store code': 'mã cửa hàng kế toán đã ánh xạ',
  'selected reference join-key columns': 'cột khóa nối tham chiếu đã chọn',
  'Use explicit POS posting dates': 'Dùng ngày ghi sổ POS rõ ràng',
  'Keep recognition timing tied to supplied accounting information.':
    'Gắn thời điểm ghi nhận với thông tin kế toán được cung cấp.',
  'Each POS file; fallback applies only when posting date is unmapped.':
    'Từng tệp POS; chỉ dùng ngày thay thế khi chưa ánh xạ ngày ghi sổ.',
  'An explicitly configured Calendar posting relationship supplies recognition dates. Otherwise mapped posting date takes precedence, then business date.':
    'Quan hệ ghi sổ Lịch được cấu hình rõ ràng cung cấp ngày ghi nhận. Nếu không, ưu tiên ngày ghi sổ đã ánh xạ, rồi đến ngày kinh doanh.',
  'POS recognition posting_date.': 'posting_date ghi nhận POS.',
  'An invalid mapped posting date fails. No working-day offset is inferred from a working_day flag.':
    'Ngày ghi sổ đã ánh xạ nhưng không hợp lệ sẽ gây lỗi. Không suy ra dịch chuyển ngày làm việc từ cờ working_day.',
  'mapped posting_date': 'posting_date đã ánh xạ',
  'confirmed Calendar posting-date output':
    'đầu ra ngày ghi sổ của Lịch đã xác nhận',
  'Aggregate before comparing': 'Tổng hợp trước khi đối chiếu',
  Reconciliation: 'Đối soát',
  'Avoid multiplying receipts, orders and journals that have different grains.':
    'Tránh nhân hóa đơn, đơn hàng và bút toán có mức chi tiết khác nhau.',
  'Validated recognition events and ledger journals are available.':
    'Đã có sự kiện ghi nhận và bút toán sổ cái được kiểm tra.',
  'Sum source recognition by store × posting date; independently sum GL and count its journals at the same grain. Full-outer join these aggregates using both keys.':
    'Cộng ghi nhận nguồn theo cửa hàng × ngày ghi sổ; độc lập cộng GL và đếm bút toán ở cùng mức chi tiết. Nối ngoài đầy đủ hai kết quả tổng hợp theo cả hai khóa.',
  'One daily_comparison row per store-day from either side.':
    'Một dòng daily_comparison cho mỗi cửa hàng–ngày từ một trong hai phía.',
  'Missing aggregate sides contribute zero at this comparison boundary. This never authorizes filling missing source cells or IDs with zero.':
    'Phía tổng hợp không có dữ liệu đóng góp 0 tại ranh giới đối chiếu này. Điều đó không cho phép điền 0 vào ô dữ liệu nguồn hoặc định danh bị thiếu.',
  'Show the formula in each context': 'Hiển thị công thức đúng ngữ cảnh',
  Metrics: 'Chỉ số',
  'Make differently oriented differences understandable without reversing existing semantics.':
    'Làm rõ các hướng tính chênh lệch mà không đảo ngữ nghĩa hiện có.',
  'A successful current result snapshot is available.':
    'Đã có kết quả hiện hành của lần chạy thành công.',
  'Dashboard headline = GL − Flash. Daily SQL = GL − expected source. Exception delta = source − GL. Headline variance % = (GL − Flash) / Flash.':
    'Chỉ số Tổng quan = GL − Flash. SQL theo ngày = GL − nguồn kỳ vọng. Chênh lệch ngoại lệ = nguồn − GL. Tỷ lệ chênh lệch chính = (GL − Flash) / Flash.',
  'Exact-cent differences with clearly labeled sign conventions.':
    'Chênh lệch chính xác đến cent, với quy ước dấu được ghi rõ.',
  'A zero Flash denominator has no defined headline percentage and displays an em dash. The app does not infer a report ratio when GL = 0.':
    'Mẫu số Sales Flash bằng 0 thì tỷ lệ chênh lệch không xác định và hiển thị dấu gạch dài. Ứng dụng không tự suy ra tỷ lệ báo cáo khi GL = 0.',
  'Filter review cases by absolute delta': 'Lọc theo trị tuyệt đối chênh lệch',
  'Review controls': 'Điều khiển kiểm tra',
  'Focus the current Exception Log without changing underlying reconciliation.':
    'Tập trung Nhật ký ngoại lệ hiện tại mà không thay đổi kết quả đối soát bên dưới.',
  'UI review filter; default threshold is 20,000 cents.':
    'Bộ lọc kiểm tra trên giao diện; ngưỡng mặc định là 20.000 cent.',
  'Include cases only when |source − GL delta| > $200 by default; equality is excluded for either sign. Apply search/category and sorting before pagination; export all filtered rows.':
    'Mặc định chỉ giữ trường hợp |nguồn − GL| > $200; bằng ngưỡng bị loại ở cả hai dấu. Tìm kiếm/lọc loại và sắp xếp trước khi phân trang; xuất mọi dòng đã lọc.',
  'A filtered view of complete duplicate and store-day exception candidates.':
    'Cách xem đã lọc của toàn bộ bản trùng và ngoại lệ cửa hàng–ngày.',
  'No 1% condition is added. Different exception categories can overlap economically; summed absolute case deltas are not a new bridge total.':
    'Không thêm điều kiện 1%. Các loại ngoại lệ có thể chồng lặp về kinh tế; tổng trị tuyệt đối chênh lệch không phải tổng cầu nối mới.',
  'selected category/search/threshold': 'loại/tìm kiếm/ngưỡng đã chọn',
  'Keep unexplained revenue explicit': 'Giữ rõ phần chưa giải thích',
  'Reconcile transparently without fabricating an adjustment to force agreement.':
    'Đối soát minh bạch, không tạo điều chỉnh giả để ép khớp.',
  'A complete-month reporting period and all validated required sources.':
    'Kỳ báo cáo trọn tháng và mọi nguồn bắt buộc đã kiểm tra.',
  'Explained = Flash + Discounts + Cancellations + Timing + Returns + Data Errors. Unexplained = GL − Explained. Add a visible residual bucket whenever nonzero.':
    'Explained = Flash + Discounts + Cancellations + Timing + Returns + Data Errors. Unexplained = GL − Explained. Hiển thị nhóm phần dư khi khác 0; các tên trong công thức là định danh của mô hình gốc.',
  'Explained + Unexplained = GL, with each money value captured as exact cents.':
    'Explained + Unexplained = GL; mỗi số tiền được ghi nhận chính xác theo cent.',
  'No unsupported shipping, FX, rounding or channel reclassification is invented. A zero residual does not prove zero source anomalies or daily differences.':
    'Không tự tạo phân loại lại vận chuyển, FX, làm tròn hoặc kênh chưa được hỗ trợ. Phần dư 0 không chứng minh nguồn không có bất thường hoặc chênh lệch ngày.',
  'Validate source rows before publishing': 'Kiểm tra dòng trước khi công bố',
  Quality: 'Chất lượng',
  'Stop malformed finance data from becoming a plausible-looking result.':
    'Chặn dữ liệu tài chính sai định dạng trước khi tạo kết quả có vẻ hợp lý.',
  'Production schemaMode = accounting. Compatibility mode is an explicit legacy path only.':
    'Chế độ chính thức là schemaMode = accounting. Chế độ tương thích chỉ là luồng cũ được chọn rõ ràng.',
  'Run source-specific row and uniqueness checks. Validate WEB lifecycle, signed GL fields and unique journal IDs, and non-negative calendar-month-end Flash values.':
    'Chạy kiểm tra dòng và tính duy nhất riêng theo nguồn. Kiểm tra vòng đời WEB, trường GL có dấu và mã bút toán duy nhất, cùng số tiền Sales Flash không âm tại ngày cuối tháng thực tế.',
  'A successful result only after all executed accounting checks return zero invalid rows/groups.':
    'Chỉ có kết quả thành công khi mọi kiểm tra kế toán đã thực thi trả về 0 dòng/nhóm sai.',
  'Any failed check aborts publication and clears both result views. Only actual run validation evidence may be labeled passed; existence of a rule is not proof it ran.':
    'Kiểm tra thất bại sẽ hủy công bố và xóa cả hai cách xem kết quả. Chỉ bằng chứng kiểm tra thực tế được ghi Đạt; có định nghĩa quy tắc không có nghĩa là quy tắc đã chạy.',
  'required keys': 'khóa bắt buộc',
  'date roles': 'vai trò ngày',
  'WEB status': 'trạng thái WEB',
  'Flash month ends': 'ngày cuối tháng Sales Flash',
  'Separate absent GL from an amount variance':
    'Phân biệt thiếu GL và sai số tiền',
  'Classify genuine ledger coverage gaps without hiding ordinary mismatches.':
    'Phân loại khoảng thiếu sổ cái thực sự mà không che các sai lệch thông thường.',
  'Daily store/date aggregates have been compared.':
    'Đã đối chiếu tổng hợp theo cửa hàng/ngày.',
  'Missing GL means the ledger group is absent and expected source revenue is nonzero. Its bridge effect is 0 − expected revenue. Present journals, including a zero journal, create amount variance instead.':
    'Thiếu GL nghĩa là không có nhóm sổ cái và doanh thu nguồn kỳ vọng khác 0. Tác động cầu nối là 0 − doanh thu kỳ vọng. Bút toán có mặt, kể cả bút toán bằng 0, tạo chênh lệch số tiền thay vì thiếu GL.',
  'Missing GL cases and signed Data Errors adjustments; other daily variances remain unexplained.':
    'Trường hợp thiếu GL và điều chỉnh Lỗi dữ liệu có dấu; chênh lệch ngày khác vẫn chưa giải thích.',
  'A missing negative refund day contributes a positive bridge adjustment. A manual journal is attributed individually only when it is the sole manual journal on a zero-expected day.':
    'Thiếu ngày hoàn tiền âm tạo điều chỉnh cầu nối dương. Chỉ quy cho bút toán thủ công riêng lẻ khi đó là bút toán thủ công duy nhất trong ngày có doanh thu kỳ vọng bằng 0.',
  'Validate the monthly baseline': 'Kiểm tra cơ sở tháng',
  'Use a monthly baseline without duplicating it across daily rows.':
    'Dùng cơ sở theo tháng mà không nhân vào các dòng theo ngày.',
  'Reporting range consists of complete calendar months.':
    'Khoảng báo cáo gồm các tháng dương lịch trọn vẹn.',
  'Require actual month-end dates and non-negative supplied USD. Sum only in-period Flash rows. If no rows match the period, disclose the zero baseline and coverage note.':
    'Yêu cầu ngày cuối tháng thực tế và số USD được cung cấp không âm. Chỉ cộng Sales Flash trong kỳ. Nếu không có dòng khớp kỳ, công bố cơ sở bằng 0 và ghi chú thiếu phạm vi.',
  'Flash_Sales and an explicit missing-coverage note when applicable.':
    'Flash_Sales và ghi chú rõ về phần thiếu dữ liệu nếu có.',
  'Partial-month periods fail. No Flash-to-Calendar period join is used. Empty coverage is not silently described as complete.':
    'Kỳ không trọn tháng sẽ gây lỗi. Không nối Sales Flash với Lịch theo kỳ. Không âm thầm mô tả phạm vi trống là đầy đủ.',
  'Store-month materiality policy': 'Chính sách trọng yếu cửa hàng–tháng',
  'Report reference': 'Tham khảo báo cáo',
  'Describe the report’s combined absolute and relative materiality proposal separately from the live log.':
    'Mô tả đề xuất trọng yếu kết hợp tuyệt đối và tương đối của báo cáo, tách biệt với nhật ký hiện hành.',
  'Report reference, not the current store-day Exception Log filter.':
    'Chỉ tham khảo báo cáo, không phải bộ lọc Nhật ký ngoại lệ theo cửa hàng–ngày hiện tại.',
  '|difference| > 200 USD AND |difference / GL| > 1%.':
    '|difference| > 200 USD AND |difference / GL| > 1%.',
  'Reference policy only; not an applied app filter.':
    'Chính sách tham khảo, chưa được áp dụng làm bộ lọc trong ứng dụng.',
  'GL = 0 needs a separately agreed policy. No percentage or pass/fail is invented, and this condition is not added to the current log.':
    'GL = 0 cần chính sách được thống nhất riêng. Không tự tạo tỷ lệ hoặc kết luận đạt/không đạt; điều kiện này không được thêm vào nhật ký hiện tại.',
  'store × month difference': 'chênh lệch cửa hàng × tháng',
  'store × month GL': 'GL theo cửa hàng × tháng',
  'Working-day posting calendar': 'Lịch ghi sổ theo ngày làm việc',
  'Show the difference between a report recommendation and actual posting-date behavior.':
    'Phân biệt đề xuất trong báo cáo với cách dùng ngày ghi sổ thực tế.',
  'Reference model only; an inferred workday offset is not supported.':
    'Chỉ là mô hình tham khảo; chưa hỗ trợ suy ra độ dịch chuyển ngày làm việc.',
  'The report discusses a working-day calendar. Current production uses mapped posting date, explicit calendar posting mapping, then business-date fallback.':
    'Báo cáo đề cập lịch ngày làm việc. Luồng chính thức hiện dùng ngày ghi sổ đã ánh xạ, ánh xạ lịch ghi sổ rõ ràng, rồi đến ngày kinh doanh.',
  'No inferred posting date; see the implemented calendar-posting rule.':
    'Không tự suy ra ngày ghi sổ; xem quy tắc calendar-posting đã triển khai.',
  'A working_day flag alone is not enough to infer recognition timing.':
    'Chỉ cờ working_day không đủ để tự suy ra thời điểm ghi nhận.',
  'report posting policy': 'chính sách ghi sổ trong báo cáo',
  'Explicit FX conversion model': 'Mô hình quy đổi FX rõ ràng',
  'Document daily versus month-end rate concepts without reconverting supplied USD.':
    'Giải thích tỷ giá hằng ngày và cuối tháng mà không quy đổi lại số USD được cung cấp.',
  'Currency conversion remains unsupported. Configured FX lookups and full-data rate validation are implemented.':
    'Chưa hỗ trợ quy đổi tiền tệ. Đã triển khai phép tra cứu FX được cấu hình và kiểm tra tỷ giá trên toàn bộ dữ liệu.',
  'Daily lookup requires date AND currency; month-end lookup requires recognition period AND currency. Configured relationships validate or return mapped rate attributes. Supplied USD values are never converted again.':
    'Tra cứu ngày cần ngày AND tiền tệ; tra cứu cuối tháng cần kỳ ghi nhận AND tiền tệ. Quan hệ được cấu hình sẽ kiểm tra hoặc trả về thuộc tính tỷ giá đã ánh xạ. Không quy đổi lại số USD được cung cấp.',
  'Reference explanation only. Supplied net USD retains its source basis; any unclassified FX effect remains residual.':
    'Chỉ giải thích tham khảo. Thuần USD được cung cấp giữ cơ sở nguồn; ảnh hưởng FX chưa phân loại vẫn là phần dư.',
  'No missing rate fallback, second FX conversion or FX QC pass is inferred. Non-USD POS gross cannot derive USD net without a valid supplied USD amount or future explicit FX model.':
    'Không tự suy ra tỷ giá thay thế, quy đổi FX lần hai hoặc kết quả kiểm tra FX đạt. Gộp POS không phải USD không thể suy ra thuần USD nếu không có số USD được cung cấp hợp lệ hoặc mô hình FX rõ ràng trong tương lai.',
  'local amount': 'số tiền nội tệ',
  'date/month + currency': 'ngày/tháng + tiền tệ',
  'receipt_no, line_no, business_date, store_key, line_amount or gross USD, discount_usd_daily; net_usd_month_end optional (unmapped net = gross USD minus USD discount); posting_date and exported_at optional, export_seq used for fallback ordering':
    'receipt_no, line_no, business_date, store_key, line_amount hoặc số gộp USD, discount_usd_daily; net_usd_month_end tùy chọn (chưa ánh xạ thuần thì lấy gộp USD trừ chiết khấu USD); posting_date và exported_at tùy chọn; export_seq dùng để sắp xếp thay thế',
  'web_order_id, order_date, order_status, gross_usd_daily, discount_usd_daily; net_amount / net_usd_month_end optional (unmapped net = gross minus discount); delivery_date required for recognized orders, return_date for returned orders; online store 999999 when no store column is supplied':
    'web_order_id, order_date, order_status, gross_usd_daily, discount_usd_daily; net_amount / net_usd_month_end tùy chọn (chưa ánh xạ thuần thì lấy gộp trừ chiết khấu); bắt buộc delivery_date cho đơn được ghi nhận và return_date cho đơn trả hàng; dùng cửa hàng trực tuyến 999999 khi không có cột cửa hàng',
  'journal_id, posting_date, store_key or store_code, journal_type, amount_usd':
    'journal_id, posting_date, store_key hoặc store_code, journal_type, amount_usd',
  'month_end_date, revenue_usd or gross_usd; select Header Row 5 for exports with four metadata rows (the global default remains Row 1)':
    'month_end_date, revenue_usd hoặc gross_usd; chọn Dòng tiêu đề 5 nếu bản xuất có bốn dòng mô tả (mặc định chung vẫn là dòng 1)',
  'One imported source record, before accounting projection':
    'Một bản ghi nguồn đã nhập, trước bước chiếu kế toán',
  'One uploaded dimension record; keys depend on worksheet schema':
    'Một bản ghi tham chiếu đã nhập; khóa tùy theo cấu trúc trang tính',
  'The selected header row was used by the same parser and file registration as this run.':
    'Dòng tiêu đề đã chọn được dùng trong cùng bộ đọc và quá trình nạp tệp của lần chạy này.',
  'Production date projections and row validation completed for all selected fact sources.':
    'Đã hoàn tất chiếu ngày và kiểm tra dòng theo luồng chính thức cho mọi nguồn đã chọn.',
  'Computed earliest-export ranking selects rank 1; discarded lines remain in pos_ranked.':
    'Xếp hạng theo bản xuất sớm nhất chọn hạng 1; dòng bị loại vẫn ở pos_ranked.',
  'Each POS/WEB file used its recorded supplied-net or gross-minus-discount configuration. Invalid selected cells are never replaced.':
    'Mỗi tệp POS/WEB dùng cấu hình thuần được cung cấp hoặc gộp trừ chiết khấu đã ghi nhận. Ô được chọn nhưng không hợp lệ không được thay thế.',
  'The actual expected_events view includes non-cancelled deliveries and negative full-net returns.':
    'Bảng expected_events thực tế gồm giao hàng không bị hủy và trả hàng âm toàn bộ thuần.',
  'vw_gl computes revenue_usd = -amount_usd exactly once.':
    'vw_gl tính revenue_usd = -amount_usd đúng một lần.',
  'Both sides were summed at store_key × posting_date before full outer comparison.':
    'Cả hai phía đã được cộng theo store_key × posting_date trước khi nối ngoài đầy đủ để đối chiếu.',
  'Daily SQL uses GL − source; exceptions use source − GL. Dashboard headline uses GL − Flash.':
    'SQL theo ngày dùng GL − nguồn; ngoại lệ dùng nguồn − GL. Chỉ số Tổng quan dùng GL − Flash.',
  'The engine publishes all traceable nonzero cases. The Exception Log applies its own strict default |delta| > $200 display filter; no 1% test is applied.':
    'Engine công bố mọi trường hợp khác 0 truy vết được. Nhật ký ngoại lệ áp dụng bộ lọc hiển thị mặc định |delta| > $200; không áp dụng kiểm tra 1%.',
  'Unexplained is computed as GL less Flash and classified adjustments, without forcing the residual to zero.':
    'Phần chưa giải thích được tính bằng GL trừ Sales Flash và các điều chỉnh đã phân loại, không ép phần dư về 0.',
  'Previews contain at most 50 rows per relation from all selected files, including adjacent periods used for recognition timing. Search and filters operate only on these preview rows.':
    'Mỗi bảng xem trước giữ tối đa 50 dòng từ các tệp đã chọn, gồm cả dữ liệu giáp kỳ để xác định thời điểm ghi nhận. Tìm kiếm và bộ lọc chỉ áp dụng cho những dòng xem trước này.',
  'source_record is the one-based imported data-record ordinal, excluding the selected header. source_row is unavailable: conversion removes blank worksheet rows and quoted CSV records may span physical lines. Input values are the actual registered text after spreadsheet date/formatted-cell conversion, not original binary cells.':
    'source_record là thứ tự bản ghi được nhập, bắt đầu từ 1 và không gồm dòng tiêu đề. source_row không có: chuyển đổi loại dòng trang tính trống và bản ghi CSV có thể trải qua nhiều dòng vật lý. Giá trị đầu vào là văn bản thực tế đã nạp sau chuyển đổi ngày/định dạng ô, không phải ô nhị phân gốc.',
  'No USD discount field supplied; no discount is deducted.':
    'Không cung cấp trường chiết khấu USD; không trừ thêm chiết khấu.',
  'WEB has no store field; using the online ledger store 999999.':
    'WEB không có trường cửa hàng; dùng mã sổ cái trực tuyến 999999.',
  'POS line_amount is the source gross field; supplied net_usd_month_end is preserved for accounting, including its FX basis.':
    'line_amount của POS là trường số gộp nguồn; net_usd_month_end được cung cấp giữ nguyên cho kế toán, gồm cả cơ sở FX.',
  'No POS currency column: line_amount is treated as USD if net USD must be derived. Provide precomputed net_usd_month_end for month-end FX.':
    'Không có cột tiền tệ POS: line_amount được coi là USD nếu cần suy ra thuần USD. Hãy cung cấp net_usd_month_end đã tính sẵn cho FX cuối tháng.',
  'Net USD calculated as gross USD minus USD discount; no additional FX conversion applied.':
    'Thuần USD được tính bằng gộp USD trừ chiết khấu USD; không quy đổi FX thêm.',
  'POS posting date falls back to business_date unless a confirmed Calendar relationship supplies it.':
    'Ngày ghi sổ POS dùng business_date khi thiếu, trừ khi quan hệ Lịch đã xác nhận cung cấp ngày này.',
  'exported_at absent: deduplication orders by supplied export_seq, then stable file/row position.':
    'Thiếu exported_at: loại trùng sắp theo export_seq được cung cấp, rồi đến thứ tự tệp/dòng ổn định.',
}
