# Kiểm tra phát hành v1 — 13/11/2026

## Đối chiếu tài liệu ngày 13/11/2026

Lần rà soát tài liệu đối chiếu commit `ed969a42233dfe191e6aac054a156c73ce8e55fc` (`Release 1`, package `0.1.0`). Working tree sạch lúc bắt đầu; lần này chỉ sửa/thêm Markdown, không sửa code ứng dụng, giao diện hay quy tắc nghiệp vụ. Bản tổng hợp mới: [docs/RESEARCH_APPLICATION_MAP.md](docs/RESEARCH_APPLICATION_MAP.md).

Đã chạy lại `npm.cmd test`: **227/227 đạt**, 0 fail, 0 skipped, khoảng 49 giây; `npm.cmd run typecheck`: exit 0 (Node 24.13.1/npm 11.8.0). Các kết quả cài đặt/build/lint/HTTP preview và mô tả sửa code bên dưới là **hồ sơ của lần chuẩn bị phát hành trước commit trên**, không phải thao tác được lặp lại trong đợt tài liệu hóa. Chưa chạy browser hoặc xác minh URL deploy trong đợt này. Kết quả kiểm tra liên kết/định dạng tài liệu được ghi tại bản đồ nghiên cứu.

## Kết luận

**Mức 2 — Có thể đưa lên Vercel với các giới hạn đã nêu.** Không phát hiện lỗi chặn TypeScript, build hoặc kiểm thử tự động sau các sửa chữa bên dưới. Đã phục vụ và kiểm tra asset từ bản production `dist` bằng Vite preview. **Chưa xác minh triển khai Vercel thực tế hoặc thao tác trong trình duyệt production:** chưa có URL deploy, CUA trả inventory trình duyệt rỗng và `Browser is not available: iab` khi thử mở tab. Vì vậy không đánh dấu visual/mobile, Network/Console hay luồng UI production là đạt.

GitHub public cần rà soát **lịch sử commit cũ** chứa audit nguồn trước khi push; dọn index hiện tại không loại dữ liệu khỏi lịch sử. Workbook demo được xác nhận công khai riêng như mô tả bên dưới.

## Khảo sát và thay đổi trong lần chuẩn bị phát hành

- React 19 + TypeScript + Vite 8, Tailwind 4, React Router HashRouter; npm với lockfile v3. Không có hướng dẫn AGENTS.md được tìm thấy trong repo/các thư mục cha đã kiểm tra. Working tree sạch khi bắt đầu; không reset repo.
- Chốt `engines.node: 24.x`, `.nvmrc: 24` để local, CI và Vercel dùng cùng major đã kiểm tra (Node 24.13.1, npm 11.8.0). Không nâng dependencies; lockfile chỉ đổi metadata engine của package gốc.
- **Sửa engine chờ vô hạn khi Worker DuckDB lỗi:** thư viện xóa pending RPC nhưng không reject. `src/lib/duckdb.ts` nay nhận `error`/`messageerror` trong instantiate/open, hủy Worker thất bại, reset singleton và cho retry. Thành công vẫn chia sẻ một engine qua các consumer/điều hướng.
- **Sửa yêu cầu chứng từ trùng và trạng thái bằng chứng cũ:** yêu cầu đang chờ được dùng lại khi bấm thêm, không thêm history/ghi đè ghi chú và bước tiếp theo. Yêu cầu mới xóa `evidenceReviewed`; hồ sơ đã rà soát rồi mở lại vẫn yêu cầu mới được. UI báo đúng số yêu cầu mới hoặc trạng thái đang chờ. Không gửi email/tin nhắn.
- Thêm `typecheck`, `test:production` và script HTTP production nhỏ; CI Ubuntu/Node 24 chạy cài lockfile, lint, tests, build, HTTP production và format. Không thêm framework test mới.
- README được rút gọn thành hướng dẫn vận hành/deploy; nội dung bàn giao kiến trúc được chuyển sang `ARCHITECTURE.md`, sau đó được đối chiếu lại trong lần tài liệu hóa này. Ghi rõ demo công khai trong tài liệu tham chiếu Excel.
- Bổ sung ignore cho env/credentials, Vercel local state, npm cache, audit/tạm, uploads/reports. Hồ sơ phát hành ghi nhận bỏ theo dõi **29 file** trong `outputs/` và `.tmp-vi/` bằng `git rm --cached`, giữ nguyên file trên máy. Đây là thao tác lịch sử đã thuộc bản `Release 1`; không còn là các xóa đang staged khi bắt đầu rà soát tài liệu.

## Lệnh và bằng chứng

Các kết quả sau được lưu từ lần chuẩn bị phát hành trên Windows PowerShell sau khi sửa code. Chỉ những lệnh nêu ở phần đối chiếu đầu file được chạy lại trong đợt tài liệu hóa. Dùng `npm.cmd` để tránh chính sách thực thi wrapper `.ps1`.

| Lệnh/kiểm tra                                                                                | Kết quả                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd ci --no-audit --no-fund --cache .npm-cache --fetch-retries=0 --fetch-timeout=30000` | Đạt: 260 packages trong 36 giây, dùng lockfile, chạy install scripts. Lần thử trong sandbox trước đó gặp EACCES mạng và bị dừng; lần cài thành công chạy sau cấp quyền mạng. Không dùng kết quả lần bị dừng để kết luận đạt. |
| `npm.cmd run typecheck`                                                                      | Đạt, exit 0.                                                                                                                                                                                                                 |
| `npm.cmd run lint`                                                                           | Exit 0, còn 7 warning có từ baseline: 4 Fast Refresh export, 1 setState trong effect của header selector, 2 escape dư trong test. Không tắt rule.                                                                            |
| `npm.cmd test`                                                                               | **227/227 đạt**, 0 fail, 0 skipped, khoảng 39 giây. Baseline trước sửa: 226/226.                                                                                                                                             |
| `npm.cmd run build`                                                                          | Đạt: TypeScript + Vite production, 2.794 modules. Có cảnh báo chunk >500 kB, không thay ngưỡng để che cảnh báo.                                                                                                              |
| `npm.cmd run test:production`                                                                | Đạt: Vite preview của `dist`, root HTTP 200; JS/CSS chunks, 4 Worker, 2 WASM, favicon, workbook tải được và không trả HTML. Script tự đóng preview server.                                                                   |
| `npm.cmd run format:check`                                                                   | Đạt.                                                                                                                                                                                                                         |
| `git diff --check`, `git diff --cached --check`                                              | Không có whitespace error.                                                                                                                                                                                                   |
| Rà import tương đối/alias src theo đúng hoa thường                                           | Không phát hiện import sai hoa thường/không tồn tại. Đây là kiểm tra tĩnh trên Windows; chưa có run CI Linux thực tế.                                                                                                        |
| Rà file text được Git theo dõi theo mẫu private key/GitHub/AWS/OpenAI token                  | Không phát hiện mẫu khớp; không phải chứng nhận không thể có bí mật dưới dạng khác. Không in giá trị credential.                                                                                                             |

Test startup mới dùng `AsyncDuckDB` thực với Worker giả lập lỗi RPC để kiểm tra lỗi instantiate, lỗi open, cleanup, retry và singleton. Log `Worker asset failed to load` trong test này là lỗi chủ động giả lập. Các bài SQL/Raw chạy bằng DuckDB-WASM thực; không đổi accounting mode sang compatible để đạt test.

## Luồng đã kiểm tra và phạm vi chứng minh

| Luồng                                                                                       | Bằng chứng tự động                                                                                                                                                                                 | Trình duyệt production                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Mở lần đầu, trang chưa có dữ liệu, điều hướng workspace                                     | Test DOM workspace: empty state không có số giả, kết quả thật bằng 0 hiển thị 0, trang methodology không có run vẫn đọc được                                                                       | Chưa thử; HTTP root/query và tài nguyên đã qua preview                 |
| CSV/XLSX, dòng tiêu đề, mapping, quay lại/sửa/thay file                                     | Tests data-mapping/header-row/onboarding/workspace, có CSV nhiều dòng, header metadata, XLSX calendar và format ID                                                                                 | Chưa thử file picker/drag/drop native                                  |
| Master/Dim, sheet, khóa đơn/ghép, quan hệ và cardinality                                    | Tests master-data + engine: sheet/cột tùy ý, duplicate/unmatched/FX/date errors, cleanup. Chọn toàn bộ Not used bị chặn; bỏ workbook nếu không dùng                                                | Chưa thử UI thực tế                                                    |
| Xử lý, lỗi theo nguồn/dòng, stale run/callback, retry                                       | Real engine + store/progress/run-failure tests kiểm tra publish nguyên tử, hủy, lỗi WEB/Flash/GL và cấu hình đổi                                                                                   | Chưa thử tiến trình trong production UI                                |
| Xem thử Excel                                                                               | Workbook thực đi kèm: 15 dòng cầu nối, 10 ngoại lệ, 39.062 chi tiết, 58 check; kiểm tra tháng/năm/dấu và chênh lệch thật. Session tests bật/tắt/đọc chồng/hủy/lỗi muộn giữ riêng Raw/mapping/hồ sơ | Workbook tải được qua HTTP production; chưa mở Dashboard trong browser |
| Bốn tab dashboard, filter/KPI/chart/table/insight cùng phạm vi, dấu, thiếu dữ liệu so với 0 | Dashboard model/detail/expansion DOM tests; filter/expand không chạy lại pipeline; Escape, focus và trạng thái bảng được giữ                                                                       | Chưa xác minh hình vẽ/overflow/focus thật                              |
| Hồ sơ, ghi chú, trạng thái, lịch sử, correction và chứng từ                                 | GL real-engine/accounting-review UI tests; link đúng dòng và context, quyết định cần bằng chứng, không tự close/xác nhận; đã bổ sung regression bấm yêu cầu lại                                    | Chưa thử browser                                                       |
| DuckDB/Spreadsheet Worker và WASM                                                           | Build + preview HTTP: đủ 4 Worker `text/javascript`, 2 WASM `application/wasm` và magic bytes `00 61 73 6d`; startup/cleanup/retry có regression riêng                                             | Chưa thực thi Worker browser hay thu Network/Console                   |

Preview không gửi Content-Type cho XLSX, nhưng tải HTTP 200 đúng ZIP bytes; adapter dùng `response.arrayBuffer()` nên không yêu cầu MIME XLSX. MIME JavaScript/WASM đã kiểm tra đúng. Không suy từ HTTP sang kết luận không có CORS/Worker/runtime error trong trình duyệt.

## Tài nguyên và dữ liệu công khai

- `public/` chỉ có favicon và `reference/excel-reference.xlsx`. Bản `dist` chỉ có index, favicon, JS/CSS/Worker/WASM và workbook này; không đóng gói outputs, file upload, PDF/PBIX hay dữ liệu raw ngoài workbook demo.
- **Người dùng xác nhận ngày 13/11/2026 giữ workbook gốc để làm demo công khai.** File 2.992.582 bytes có thể tải ở `/reference/excel-reference.xlsx`; không coi đây là dữ liệu bí mật của phiên khách truy cập.
- Worker/WASM nhập từ package DuckDB đã khóa, qua Vite `?url`, cùng origin. Không dùng CDN hoặc đường dẫn máy cá nhân. `assetsInlineLimit: 0`; cả MVP và EH là single-thread, không thêm COOP/COEP.
- Đã bỏ đường dẫn máy cá nhân trong `DASHBOARD_REVIEW.md`. Audit/tạm cũ còn trên máy, được ignore và bỏ index, không cần cho build/tests.
- **Commit đầu tiên `345147f` vẫn chứa các audit/tạm đã từng track**, gồm đường dẫn máy cá nhân và dữ liệu trích từ nguồn tài chính. Không tự sửa lịch sử. Trước khi công khai GitHub, kiểm tra quyền chia sẻ các dữ liệu trong commit đó; dùng repo private nếu chưa chốt được. Xóa ở commit tiếp theo không xóa khỏi lịch sử cũ.

## Giới hạn v1 và phát triển sau

- Chưa chạy native browser/desktop/mobile QA; jsdom/ResizeObserver giả lập không đo layout thật. Cần kiểm tra 1366×768, 1440×900 và khoảng 390px rộng trên URL deploy.
- Raw accounting được kiểm tra bằng fixture, chưa có đầy đủ các workbook nguồn thực để kết luận toàn bộ dataset thực tế đã đối soát. Workbook tham chiếu là kết quả có sẵn; không thay thế chạy Raw thành công.
- Fact Excel chỉ đọc sheet đầu tiên. Master/Dim hỗ trợ chọn sheet; fact sheet picker để bản sau.
- File/mapping/nguồn/kỳ sửa sẽ vô hiệu hóa kết quả. GL review hiện có thể bị đánh dấu cần rà soát lại khá rộng khi sửa mapping nguồn khác; chưa thu hẹp fingerprint vì cần giữ guard chống correction cũ.
- Phiên chỉ trong bộ nhớ tab. Refresh/đóng tab làm mất file chọn, kết quả và hồ sơ; không có save/restore, backend, tài khoản hoặc ghi ERP.
- MVP/EH WASM khoảng 41,3/35,9 MB chưa nén, chỉ bundle được chọn cần tải khi khởi tạo. Entry JS khoảng 1,46 MB (gzip 430 kB). Không thêm workbook/PDF/PBIX lớn khác vào bundle. Code splitting và parser tham chiếu Excel trong Worker là hướng tối ưu tiếp theo; đọc workbook tham chiếu hiện trên main thread.
- Lint warnings còn lại không chặn build. Không có kiểm tra hiệu năng với toàn bộ file đầu vào thực tế hoặc thiết bị yếu; chưa chứng minh UI không giật với workbook lớn.
- GitHub Actions Ubuntu và CDN/header/caching thực tế của Vercel chưa chạy trong phiên này.

## Cấu hình Vercel

| Mục                   | Nhập                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| Framework Preset      | **Vite**                                                               |
| Root Directory        | **`.`**, hoặc thư mục chứa package.json nếu repo có thư mục cha        |
| Install Command       | **`npm ci`**                                                           |
| Build Command         | **`npm run build`**                                                    |
| Output Directory      | **`dist`**                                                             |
| Node.js Version       | **24.x**                                                               |
| Environment variables | **Không có biến bắt buộc**; không tạo `.env.example` khi chưa dùng env |

HashRouter giữ nguyên. Dùng `https://<domain>/#/processing?sheet=...`; hash/query phía router không cần rewrite. Không thêm `vercel.json`, không rewrite asset về HTML, không đặt dev/preview server làm production. Deploy toàn bộ dist ở domain root. Tham khảo chính thức: [Vite trên Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Việc người triển khai làm tiếp

1. Rà `git diff` và `git diff --cached` của thay đổi tài liệu hiện tại. Việc bỏ theo dõi audit/tạm đã thuộc commit phát hành; không lặp lại thao tác đó. Các bước push/công khai repo/deploy tiếp theo cần được người triển khai thực hiện và ghi nhận kết quả; đợt tài liệu hóa không thực hiện các bước này.
2. Kiểm tra workflow CI xanh trên GitHub. Import repo vào Vercel với cấu hình trên và deploy.
3. Trên URL HTTPS mới, mở root và trực tiếp `/#/processing`, `/#/exceptions?...`, refresh từng trang khi chưa có dữ liệu. Xác nhận empty state và engine chỉ báo sẵn sàng khi khởi tạo xong.
4. Mở DevTools Network/Console: xác nhận Worker/JS/WASM HTTP 200 đúng MIME, không HTML/404/CORS, không uncaught exception; WASM/Worker cùng origin. Giả lập chặn Worker để thử banner và retry, sau đó bỏ chặn.
5. Bật workbook demo, mở đủ 4 tab, đổi tháng/filter; xem chi tiết, mở rộng bảng/chart, Escape và focus; tắt xem thử rồi bật lại, xác nhận Raw/hồ sơ không bị trộn.
6. Dùng file Raw hợp lệ thực tế: CSV + XLSX, header/mapping/Master join, sửa/thay file/quay lại, xử lý và xem bảng/kết quả. Thử file thiếu trường để kiểm tra thông báo đúng nguyên nhân. Không coi workbook tham chiếu là bằng chứng luồng Raw đã đạt.
7. Mở hồ sơ từ dashboard/nhật ký, lưu note/status, kiểm tra history; bấm yêu cầu chứng từ hai lần chỉ có một yêu cầu đang chờ. Không tự chuyển thành đã xác nhận khi chưa có bằng chứng.
8. Kiểm tra desktop và mobile: điều hướng, wizard/dialog/table trong viewport, không kéo ngang toàn trang; refresh cuối cùng và xác nhận phiên bị xóa đúng thông báo. Lưu kết quả/screenshot của đợt smoke test URL trước khi mở rộng người dùng.
