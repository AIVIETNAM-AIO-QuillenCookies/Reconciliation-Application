/**
 * Parts of the app (xlsx, the engine, spreadsheet helpers) are fetched on first
 * use. When that fetch fails, because a newer deployment replaced the hashed
 * files, the network dropped or the dev server rebuilt its dependency cache,
 * each browser words the error differently. Only a page reload fetches the
 * current files, and nothing in the tab is persisted across it.
 */
const MODULE_LOAD_FAILURE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

export const isModuleLoadError = (message: string) =>
  MODULE_LOAD_FAILURE.test(message)

export const MODULE_LOAD_MESSAGE =
  'Không tải được một phần của ứng dụng, thường do ứng dụng vừa được cập nhật hoặc kết nối mạng bị gián đoạn. Hãy tải lại trang rồi thử lại.'

export const RELOAD_DATA_NOTE =
  'Dữ liệu đang mở trong tab này không được lưu lại, nên sau khi tải lại bạn cần mở hoặc nhập lại.'
