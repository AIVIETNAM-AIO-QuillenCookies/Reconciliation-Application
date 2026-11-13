/** Common labels and messages emitted by the unchanged processing engine. */
export const COMMON_VI: Record<string, string> = {
  'Mapping ready': 'Ánh xạ đã sẵn sàng',
  'Needs mapping': 'Cần ánh xạ',
  'Sources & joins': 'Nguồn & phép nối',
  'Unified transactions': 'Sự kiện ghi nhận',
  'Presentation mode': 'Chế độ trình bày',
  'Exit presentation': 'Thoát trình bày',
  'Print / Save PDF': 'In / Lưu PDF',
  'Current engine stage': 'Bước xử lý hiện tại',
  'Successful run': 'Lần xử lý thành công',
  'Current selection': 'Lựa chọn hiện tại',
  'Definitions · no processed snapshot': 'Định nghĩa · chưa có kết quả xử lý',
  'Processing failed; no successful evidence':
    'Xử lý lỗi; chưa có bằng chứng thành công',
  'Mappings below belong to the same successful run as the evidence.':
    'Ánh xạ bên dưới thuộc cùng lần xử lý thành công với bằng chứng.',
  'Current files and mapping drafts are shown below. They are not processed results.':
    'Bên dưới là tệp và bản nháp ánh xạ hiện tại, chưa phải kết quả xử lý.',
  'Run configuration': 'Cấu hình đã chạy',
  'Confirmed mapping': 'Ánh xạ đã xác nhận',
  'Draft mapping': 'Bản nháp ánh xạ',
  'Header row': 'Dòng tiêu đề',
  'Mapped net is authoritative': 'Ưu tiên giá trị Net đã ánh xạ',
  'Selected reference sheets': 'Các trang tham chiếu đã chọn',
  'Field mapping': 'Ánh xạ trường',
  'Table dictionary': 'Từ điển bảng',
  'Grain & keys': 'Đơn vị dòng & khóa',
  'Runtime availability': 'Dữ liệu trong lần xử lý',
  'Join safeguards': 'Kiểm soát phép nối',
  'Report reference': 'Tài liệu tham chiếu',
  'Inspect a real record': 'Kiểm tra bản ghi thực tế',
  'Select a retained record': 'Chọn bản ghi trong preview',
  INPUT: 'ĐẦU VÀO',
  'APPLIED LOGIC': 'LOGIC ÁP DỤNG',
  OUTPUT: 'ĐẦU RA',
  EXPLANATION: 'GIẢI THÍCH',
  'Actual configured joins': 'Phép nối thực tế đã cấu hình',
  'No matching relationship was executed in the current successful snapshot. The connection above describes supported behavior.':
    'Chưa có phép nối tương ứng được thực thi trong kết quả hiện tại. Đường nối bên trên mô tả hành vi được hỗ trợ.',
  'No matching records were retained. This does not prove the rule was unused across the full dataset.':
    'Không có bản ghi phù hợp trong preview. Điều này không chứng minh quy tắc chưa được dùng trên toàn bộ dữ liệu.',
  'Input cells for this record are outside the retained preview or unavailable. No values are inferred.':
    'Giá trị đầu vào nằm ngoài preview hoặc không có sẵn. Hệ thống không suy đoán giá trị.',
  'These values were retained from the processing connection. This inspector does not recalculate amounts or recognition events.':
    'Các giá trị được giữ lại từ connection xử lý. Inspector không tính lại tiền hoặc sự kiện ghi nhận.',
  ', complete': ', đã hoàn tất',
  'One retained source record': 'Một bản ghi nguồn được giữ lại',
  Copied: 'Đã sao chép',
  'Unable to copy': 'Không thể sao chép',
  file: 'tệp',
  files: 'tệp',
  'Choose…': 'Chọn…',
  'Not defined for zero Sales Flash': 'Không xác định khi Sales Flash bằng 0',
  'Variance / Sales Flash': 'Chênh lệch / Sales Flash',
  'Receipt lines, discounts and duplicate exports.':
    'Dòng hóa đơn, chiết khấu và bản xuất trùng.',
  'Orders, deliveries, cancellations and returns.':
    'Đơn hàng, giao hàng, hủy đơn và trả hàng.',
  'Signed revenue journals from your finance ledger.':
    'Bút toán doanh thu có dấu từ sổ cái kế toán.',
  'Monthly gross revenue. The bridge starts here.':
    'Doanh thu gộp theo tháng, điểm bắt đầu của cầu nối đối soát.',
  'Store, calendar and FX reference worksheets.':
    'Trang tính tham chiếu cửa hàng, lịch và FX.',
  ' +{0} more': ' +{0} tệp khác',
  'e.g. {0}': 'Ví dụ: {0}',
  ' · {0} columns{1}': ' · {0} cột{1}',
  '{0} discarded POS export {1} for receipt / line {2} at {3}. This is the duplicated net revenue before its removal from the bridge.':
    'Có {0} dòng xuất POS bị loại cho hóa đơn / dòng {2} tại {3}. Đây là doanh thu thuần trùng trước khi được loại khỏi cầu nối đối soát.',
  'Normalized source revenue at {0} on {1} has no GL store-day group. Compare the daily source total with Finance and review whether a catchup is required.':
    'Doanh thu nguồn đã chuẩn hóa tại {0} ngày {1} không có nhóm GL cùng cửa hàng/ngày. Đối chiếu tổng nguồn theo ngày với kế toán và xem xét có cần ghi bổ sung hay không.',
  'Source minus GL variance at {0} on {1}, calculated after store/date aggregation.{2} A journal is identified individually only when it is the sole manual posting on a day with zero expected source revenue.':
    'Chênh lệch nguồn trừ GL tại {0} ngày {1}, tính sau khi tổng hợp theo cửa hàng/ngày.{2} Chỉ xác định riêng bút toán khi đó là bút toán thủ công duy nhất trong ngày có doanh thu nguồn kỳ vọng bằng 0.',
  ' Manual journal references: {0}.': ' Tham chiếu bút toán thủ công: {0}.',
  Definition: 'Định nghĩa',
  Applied: 'Đã áp dụng',
  'Not applicable': 'Không áp dụng',
  'Not evaluated': 'Chưa đánh giá',
  Source: 'Nguồn',
  Sources: 'Nguồn dữ liệu',
  Normalize: 'Chuẩn hóa',
  Recognition: 'Ghi nhận',
  Reconciliation: 'Đối soát',
  Outputs: 'Kết quả',
  Output: 'Kết quả',
  'Event view': 'Bảng sự kiện',
  Aggregate: 'Bảng tổng hợp',
  Transform: 'Biến đổi',
  'Reference table': 'Bảng tham chiếu',
  'Reference rate': 'Tỷ giá tham chiếu',
  input: 'đầu vào',
  normalized: 'đã chuẩn hóa',
  logical: 'logic',
  aggregate: 'tổng hợp',
  dimension: 'tham chiếu',
  text: 'văn bản',
  date: 'ngày',
  period: 'kỳ',
  Discounts: 'Chiết khấu',
  Cancellations: 'Hủy đơn',
  Timing: 'Thời điểm ghi nhận',
  Timing_Differences: 'Thời điểm ghi nhận',
  Returns: 'Trả hàng',
  'Data errors': 'Lỗi dữ liệu',
  Unexplained: 'Chưa giải thích',
  'Unexplained Difference': 'Chênh lệch chưa giải thích',
  'Flash sales': 'Sales Flash',
  'GL finance': 'GL kế toán',
  'Duplicate POS': 'POS trùng',
  'Manual Journal': 'Bút toán thủ công',
  'Daily Variance': 'Chênh lệch theo ngày',
  'Generate IT Ticket (Email)': 'Soạn email cho IT',
  'Export CSV for ERP': 'Xuất CSV để kiểm tra ERP',
  'Send inquiry to Finance': 'Soạn yêu cầu cho kế toán',
  'No execution evidence recorded for this rule.':
    'Chưa có bằng chứng thực thi được ghi nhận cho quy tắc này.',
  'Run reconciliation to inspect actual application evidence.':
    'Chạy đối soát để xem bằng chứng áp dụng thực tế.',
  'POS normalized lines': 'Dòng POS đã chuẩn hóa',
  'POS export ranking': 'Xếp hạng bản xuất POS',
  'WEB orders': 'Đơn hàng WEB',
  'Monthly Sales Flash': 'Sales Flash theo tháng',
  'Expected source revenue': 'Doanh thu nguồn kỳ vọng',
  'Actual ledger revenue': 'Doanh thu sổ cái thực tế',
  'Daily source / GL comparison': 'Đối chiếu nguồn / GL theo ngày',
  '{0} configured projections & lookup outputs':
    'Dữ liệu {0} đã ánh xạ & kết quả tra cứu',
  'One source record after validated left lookups':
    'Một bản ghi nguồn sau các phép tra cứu nối trái đã kiểm tra',
  'One uploaded receipt line, including repeated exports':
    'Một dòng hóa đơn đã nhập, gồm cả các lần xuất lặp',
  'One uploaded receipt line with computed keeper rank':
    'Một dòng hóa đơn đã nhập, có thứ hạng được giữ đã tính',
  'One receipt_no + line_no after deduplication':
    'Một cặp receipt_no + line_no sau loại trùng',
  'One unique web_order_id, including cancelled orders':
    'Một web_order_id duy nhất, gồm cả đơn đã hủy',
  'One journal_id; revenue sign reversed once':
    'Một journal_id; dấu doanh thu được đảo một lần',
  'One uploaded month-end summary row; no assumed channel or market fields':
    'Một dòng tổng hợp cuối tháng đã nhập; không giả định trường kênh hoặc thị trường',
  'One POS sale, WEB delivery or WEB return recognition event':
    'Một sự kiện ghi nhận bán POS, giao WEB hoặc trả WEB',
  'One store_key × posting_date': 'Một cặp store_key × posting_date',
  'One store_key × posting_date from a full outer join':
    'Một cặp store_key × posting_date sau nối ngoài đầy đủ',
  'Confirmed Store Master relationships were executed per source file using the recorded keys, returned fields and unmatched policy.':
    'Đã thực thi quan hệ Danh mục cửa hàng được xác nhận cho từng tệp nguồn, theo khóa, trường trả về và chính sách không khớp đã ghi nhận.',
  'No Store Master relationship used. Source keys are normalized; unmapped WEB store uses 999999.':
    'Không dùng quan hệ Danh mục cửa hàng. Khóa nguồn được chuẩn hóa; WEB chưa ánh xạ cửa hàng dùng 999999.',
  'The confirmed Calendar posting relationship supplied POS recognition dates. No working-day offset is inferred.':
    'Quan hệ ghi sổ Lịch đã xác nhận cung cấp ngày ghi nhận POS. Không tự suy ra độ dịch chuyển ngày làm việc.',
  'At least one POS file omitted posting date; business date was used. No calendar worksheet or working-day offset is inferred.':
    'Ít nhất một tệp POS thiếu ngày ghi sổ nên dùng ngày kinh doanh. Không tự chọn trang lịch hoặc suy ra độ dịch chuyển ngày làm việc.',
  'POS files supplied a posting-date mapping; no business-date fallback was configured.':
    'Tệp POS có ánh xạ ngày ghi sổ; không cấu hình dùng ngày kinh doanh thay thế.',
  '{0} executed row/key validation queries returned zero invalid rows or groups.':
    '{0} truy vấn kiểm tra dòng/khóa đã thực thi trả về 0 dòng hoặc nhóm không hợp lệ.',
  '{0} duplicate reference key groups; lookup would multiply source rows.':
    'Có {0} nhóm khóa tham chiếu trùng; phép tra cứu có thể nhân bản dòng nguồn.',
  '{0} reference rows have blank required keys.':
    'Có {0} dòng tham chiếu bị trống khóa bắt buộc.',
  'Incompatible or blank keys: {0} reference, {1} source rows.':
    'Khóa không tương thích hoặc trống: {0} dòng tham chiếu, {1} dòng nguồn.',
  '{0} source rows have no reference match.':
    'Có {0} dòng nguồn không tìm thấy bản ghi tham chiếu khớp.',
  'Row count changed from {0} to {1}.': 'Số dòng thay đổi từ {0} thành {1}.',
  '{0} invalid {1} values in reference output.':
    'Có {0} giá trị {1} không hợp lệ trong đầu ra tham chiếu.',
  '{0} blank Finance store code outputs.':
    'Có {0} kết quả trả về bị trống mã cửa hàng kế toán.',
  '{0}: selected column no longer exists: {1}':
    '{0}: cột đã chọn không còn tồn tại: {1}',
  '{0}: map {1} in every source file before checking joins.':
    '{0}: ánh xạ trường {1} trong từng tệp nguồn trước khi kiểm tra phép nối.',
  '{0}: map {1}.': '{0}: cần ánh xạ trường {1}.',
  '{0}: column for {1} no longer exists.':
    '{0}: cột cho trường {1} không còn tồn tại.',
  '{0}: choose a valid worksheet and header row.':
    '{0}: chọn trang tính và dòng tiêu đề hợp lệ.',
  '{0}: read the selected sheet preview.':
    '{0}: cần đọc dữ liệu xem trước của trang tính đã chọn.',
  '{0}: select Use or Not used.': '{0}: chọn Sử dụng hoặc Không sử dụng.',
  '{0}: add a relationship.': '{0}: thêm quan hệ nối.',
  '{0}: choose distinct join keys.': '{0}: chọn các khóa nối khác nhau.',
  '{0}: no source files selected.': '{0}: chưa chọn tệp nguồn.',
  '{0}: map source field {1} for this relationship.':
    '{0}: ánh xạ trường nguồn {1} cho quan hệ nối này.',
  '{0} mapped from {1}.': 'Trường {0} được ánh xạ từ {1}.',
  'Choose reference roles and configure their mappings and joins.':
    'Chọn vai trò tham chiếu và cấu hình ánh xạ, phép nối.',
  'Relationship IDs must be unique.': 'Mã quan hệ nối phải duy nhất.',
  'Choose a source table.': 'Chọn bảng nguồn.',
  'Choose a lookup purpose and unmatched policy.':
    'Chọn mục đích tra cứu và chính sách khi không khớp.',
  'Choose valid reference keys and key types.':
    'Chọn khóa tham chiếu và kiểu khóa hợp lệ.',
  'Store mapping must return Finance store code for POS, WEB, or GL.':
    'Ánh xạ cửa hàng phải trả về mã cửa hàng kế toán cho POS, WEB hoặc GL.',
  'Calendar purpose requires Calendar role.': 'Mục đích lịch cần vai trò Lịch.',
  'Date resolution requires a valid source date target and Date output.':
    'Xác định ngày cần trường ngày nguồn đích hợp lệ và đầu ra Ngày.',
  'Calendar posting requires POS and Posting date output.':
    'Ghi sổ từ lịch cần nguồn POS và đầu ra Ngày ghi sổ.',
  'Configure at least one reference role, or remove the workbook to continue without Master / Dim.':
    'Cấu hình ít nhất một vai trò tham chiếu hoặc bỏ tệp để tiếp tục không dùng dữ liệu tham chiếu.',
  'Confirm Master / Dim mappings and joins, or remove the workbook.':
    'Xác nhận ánh xạ và phép nối dữ liệu tham chiếu, hoặc bỏ tệp.',
  'Multiple relationships write {0}.': 'Có nhiều quan hệ nối cùng ghi vào {0}.',
  '{0} requires {1} AND currency keys.': '{0} cần khóa {1} AND currency.',
  '{0}: source field {1} is unavailable.':
    '{0}: trường nguồn {1} không khả dụng.',
  '{0} usage': 'Cách sử dụng {0}',
  '{0} worksheet': 'Trang tính {0}',
  '{0} {1} column': 'Cột {1} của {0}',
  'Date field to resolve': 'Trường ngày cần xác định',
  'Configure at least one reference role':
    'Cấu hình ít nhất một vai trò tham chiếu',
  Use: 'Sử dụng',
  case: 'trường hợp',
  cases: 'trường hợp',
  'No column headers found on row {0}. Choose the row containing column names.':
    'Không tìm thấy tên cột ở dòng {0}. Chọn dòng chứa tên cột.',
  'Duplicate header "{0}". Give each column a unique name.':
    'Tiêu đề "{0}" bị trùng. Mỗi cột cần tên riêng.',
  'The first worksheet is empty. Add a header row and try again.':
    'Trang tính đầu tiên trống. Thêm dòng tiêu đề rồi thử lại.',
  'The master workbook has no non-empty worksheets.':
    'Tệp tham chiếu không có trang tính chứa dữ liệu.',
  'Unable to preview this file.': 'Không thể xem trước tệp này.',
  'Optional currency for configured reference lookups.':
    'Tiền tệ tùy chọn cho các phép tra cứu đã cấu hình.',
  'Store ID → Selected sheet.POS Store ID':
    'Mã cửa hàng → Trang tính đã chọn.Mã cửa hàng POS',
  'Currency used for reference lookups and local-currency conversion. Required for POS local amounts.':
    'Tiền tệ dùng cho tra cứu tham chiếu và quy đổi nguyên tệ. Bắt buộc với số tiền nguyên tệ POS.',
  'POS gross amount: line_amount is local currency; explicitly named USD fields are already converted.':
    'Tiền gộp POS: line_amount là nguyên tệ; các trường được ghi rõ USD đã được quy đổi.',
  'POS discount: discount_amount is local currency; explicitly named USD discounts remain in USD.':
    'Chiết khấu POS: discount_amount là nguyên tệ; chiết khấu được ghi rõ USD giữ cơ sở USD.',
  'A mapped net is authoritative USD, including zero. Leave unmapped to derive local gross minus local discount and convert using confirmed FX.':
    'Net đã map là USD chuẩn, gồm cả 0. Để trống mapping net để tính gộp nguyên tệ trừ chiết khấu nguyên tệ, rồi quy đổi bằng FX đã xác nhận.',
  'Local currency per 1 USD (usd_to_ccy). POS local amounts divide by the confirmed daily rate; supplied USD net remains authoritative.':
    'Số đơn vị nguyên tệ trên 1 USD (usd_to_ccy). Số tiền nguyên tệ POS chia cho tỷ giá ngày đã xác nhận; net USD được cung cấp giữ nguyên.',
  'Local currency per 1 USD (usd_to_ccy). POS derived accounting net divides by the confirmed recognition-period rate; supplied USD net remains authoritative.':
    'Số đơn vị nguyên tệ trên 1 USD (usd_to_ccy). Net kế toán POS được tính từ nguyên tệ chia cho tỷ giá kỳ ghi nhận đã xác nhận; net USD được cung cấp giữ nguyên.',
}
