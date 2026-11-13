import { explainError, viMessage, isVietnameseMessage } from '@/lib/i18n'

export function LocalizedError({
  message,
}: {
  message: string | null | undefined
}) {
  if (!message) return null
  const translated = explainError(message)
  return (
    <div className="space-y-2">
      <p>{translated}</p>
      {translated !== message && (
        <details className="text-xs font-normal">
          <summary className="cursor-pointer">Chẩn đoán kỹ thuật</summary>
          <pre
            data-technical="true"
            lang="en"
            className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-white/60 p-2 text-[11px]"
          >
            {message}
          </pre>
        </details>
      )}
    </div>
  )
}

/** Engine notes are presentation copy; original evidence stays available for diagnosis. */
export function LocalizedNote({ message }: { message: string }) {
  const translated = viMessage(message)
  const known = translated !== message || isVietnameseMessage(message)
  return (
    <div className="space-y-1">
      <p>
        {known
          ? translated
          : 'Xem thông tin xử lý gốc trong phần chẩn đoán bên dưới.'}
      </p>
      {!known && (
        <details className="text-xs">
          <summary className="cursor-pointer">Chẩn đoán kỹ thuật</summary>
          <pre
            data-technical="true"
            lang="en"
            className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words"
          >
            {message}
          </pre>
        </details>
      )}
    </div>
  )
}
