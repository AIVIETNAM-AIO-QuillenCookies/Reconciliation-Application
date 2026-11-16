import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { explainError, viMessage, isVietnameseMessage } from '@/lib/i18n'
import {
  isModuleLoadError,
  MODULE_LOAD_MESSAGE,
  RELOAD_DATA_NOTE,
} from '@/lib/module-load-error'

export function LocalizedError({
  message,
}: {
  message: string | null | undefined
}) {
  if (!message) return null
  if (isModuleLoadError(message)) return <ModuleLoadError message={message} />
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

/** A part of the app failed to download: only a reload fixes it, so offer one. */
export function ModuleLoadError({ message }: { message: string }) {
  return (
    <div className="space-y-2">
      <p>{MODULE_LOAD_MESSAGE}</p>
      <p className="text-xs">{RELOAD_DATA_NOTE}</p>
      <ReloadPageButton />
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
    </div>
  )
}

export function ReloadPageButton({
  variant = 'outline',
}: {
  variant?: 'default' | 'outline'
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      onClick={() => window.location.reload()}
    >
      <RotateCw aria-hidden="true" />
      Tải lại trang
    </Button>
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
