/**
 * Shared by both downloads of the bundled sample workbook (Excel preview and
 * the guided practice). Per the Fetch standard, a request or body read that
 * fails at the network level (offline, dropped connection, server not
 * answering) rejects with a TypeError worded by each browser: "Failed to
 * fetch", "NetworkError when attempting to fetch resource.", "Load failed".
 * HTTP statuses resolve normally and aborts reject with an AbortError, so both
 * keep their own handling.
 */
export const SAMPLE_OFFLINE_MESSAGE =
  'Không tải được workbook mẫu, có thể do mất kết nối mạng hoặc máy chủ chưa phản hồi.'

export async function downloadSample<T>(
  download: () => Promise<T>,
  advice: string,
): Promise<T> {
  try {
    return await download()
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(`${SAMPLE_OFFLINE_MESSAGE} ${advice}`, { cause: error })
    throw error
  }
}
