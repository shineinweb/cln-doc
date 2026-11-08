export function Switch({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  describedBy,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  describedBy?: string
}) {
  return (
    <span className="switch-wrap">
      <button
        id={id}
        type="button"
        role="switch"
        className="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" aria-hidden="true" />
      </button>
      <span className="switch-state" aria-hidden="true">{checked ? 'On' : 'Off'}</span>
    </span>
  )
}
