import { useState, type CSSProperties } from 'react'
import { Maximize2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import type { IntroBox, IntroShot } from '@/lib/product-intro'
import workbookProgress from '@/assets/intro/workbook-progress.webp'
import workbookTables from '@/assets/intro/workbook-tables.webp'
import review from '@/assets/intro/review.webp'
import exceptions from '@/assets/intro/exceptions.webp'
import rulesDocument from '@/assets/intro/rules-document.webp'
import rulesTiming from '@/assets/intro/rules-timing.webp'
import dashboardOverview from '@/assets/intro/dashboard-overview.webp'
import dashboardBridge from '@/assets/intro/dashboard-bridge.webp'
import dashboardDetail from '@/assets/intro/dashboard-detail.webp'
import dashboardQuality from '@/assets/intro/dashboard-quality.webp'

/** Screenshots of the real app (scripts/capture-intro-shots.mjs). */
const IMAGES: Record<string, string> = {
  'workbook-progress': workbookProgress,
  'workbook-tables': workbookTables,
  review,
  exceptions,
  'rules-document': rulesDocument,
  'rules-timing': rulesTiming,
  'dashboard-overview': dashboardOverview,
  'dashboard-bridge': dashboardBridge,
  'dashboard-detail': dashboardDetail,
  'dashboard-quality': dashboardQuality,
}

const ratio = (shot: IntroShot) =>
  ({ '--pi-shot-ratio': shot.width / shot.height }) as CSSProperties
const boxStyle = ([left, top, width, height]: IntroBox): CSSProperties => ({
  left: `${left}%`,
  top: `${top}%`,
  width: `${width}%`,
  height: `${height}%`,
})
/** Codes such as EX-06 or MJ-ADJ-2509 never break at their hyphen. */
const CODE = /([A-Z]{2,}(?:-[A-Z0-9]+)+)/
const keepCodes = (text: string) =>
  text.split(CODE).map((part, index) =>
    index % 2 ? (
      <span key={index} className="pi-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  )

/**
 * A screenshot step: the image with numbered pins, and the explanation of each
 * pin. Pointing at a pin or a note spotlights that part of the screen; a click
 * keeps it highlighted.
 */
export function IntroShots({ shots }: { shots: IntroShot[] }) {
  const [shotIndex, setShotIndex] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const shot = shots[shotIndex]
  const active = hovered ?? pinned
  const toggle = (index: number) =>
    setPinned((current) => (current === index ? null : index))
  const figure = (large = false) => (
    <ShotFigure
      shot={shot}
      active={active}
      large={large}
      onHover={setHovered}
      onToggle={toggle}
      onZoom={large ? undefined : () => setZoomed(true)}
    />
  )
  return (
    // The wrapper is a size container: the image and the notes are fitted to
    // the space left in the dialog, so a step never needs scrolling.
    <div className="pi-shots-fit">
      <div
        className="pi-shots"
        style={ratio(shot)}
        data-tour="intro-shots"
        data-shot={shot.id}
      >
        <div className="pi-shot-stage">{figure()}</div>
        <aside className="pi-shot-notes" aria-label="Giải thích ảnh màn hình">
          {shots.length > 1 && (
            <div
              className="pi-shot-switch"
              role="group"
              aria-label="Chọn màn hình"
            >
              {shots.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={index === shotIndex}
                  aria-label={item.label}
                  title={item.label}
                  data-tour={`intro-shot-${item.id}`}
                  onClick={() => {
                    setShotIndex(index)
                    setHovered(null)
                    setPinned(null)
                  }}
                >
                  {item.tab ?? item.label}
                </button>
              ))}
            </div>
          )}
          <ShotNotes
            shot={shot}
            active={active}
            pinned={pinned}
            onHover={setHovered}
            onToggle={toggle}
          />
          <div className="pi-shot-tools">
            <button
              type="button"
              className="pi-link"
              onClick={() => setZoomed(true)}
              data-tour="intro-shot-zoom"
            >
              <Maximize2 size={13} aria-hidden="true" />
              Phóng to ảnh
            </button>
            <span>Trỏ vào từng mục để xem trên ảnh</span>
          </div>
        </aside>
        <Dialog open={zoomed} onOpenChange={setZoomed}>
          <DialogContent
            className="pi-zoom"
            style={ratio(shot)}
            closeLabel="Đóng ảnh phóng to"
            data-tour="intro-shot-zoomed"
          >
            <DialogTitle className="sr-only">{shot.label}</DialogTitle>
            <DialogDescription className="sr-only">
              {shot.alt}
            </DialogDescription>
            {figure(true)}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function ShotNotes({
  shot,
  active,
  pinned,
  onHover,
  onToggle,
}: {
  shot: IntroShot
  active: number | null
  pinned: number | null
  onHover: (index: number | null) => void
  onToggle: (index: number) => void
}) {
  return (
    <ol className="pi-callouts" data-tour="intro-callouts">
      {shot.callouts.map((callout, index) => (
        <li key={callout.title}>
          <button
            type="button"
            aria-pressed={pinned === index}
            data-active={active === index || undefined}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(index)}
            onBlur={() => onHover(null)}
            onClick={() => onToggle(index)}
          >
            <span className="pi-callout-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="pi-callout-copy">
              <strong>{callout.title}</strong>
              <span>{keepCodes(callout.text)}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

function ShotFigure({
  shot,
  active,
  large,
  onHover,
  onToggle,
  onZoom,
}: {
  shot: IntroShot
  active: number | null
  large: boolean
  onHover: (index: number | null) => void
  onToggle: (index: number) => void
  onZoom?: () => void
}) {
  return (
    <figure className="pi-shot" data-large={large || undefined}>
      <div className="pi-shot-frame">
        <img
          src={IMAGES[shot.id]}
          alt={shot.alt}
          width={shot.width}
          height={shot.height}
          decoding="async"
          draggable={false}
          onClick={onZoom}
          data-zoomable={onZoom ? '' : undefined}
        />
        {active !== null && (
          <span
            className="pi-shot-spot"
            style={boxStyle(shot.callouts[active].box)}
            aria-hidden="true"
            data-tour="intro-shot-spot"
          />
        )}
        {shot.callouts.map((callout, index) => (
          <button
            key={callout.title}
            type="button"
            className="pi-pin"
            data-active={active === index || undefined}
            // Kept inside the frame so a pin is never clipped at the edge.
            style={{
              left: `${Math.max(callout.box[0], 1.6)}%`,
              top: `${Math.max(callout.box[1], 2)}%`,
            }}
            aria-label={`${index + 1}. ${callout.title}`}
            title={callout.title}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(index)}
            onBlur={() => onHover(null)}
            onClick={() => onToggle(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </figure>
  )
}
