interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  activeColor?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  activeColor = '#e8941a',
}: ToggleProps) {
  const sizes = {
    sm: { width: 36, height: 20, ball: 14, offset: 3 },
    md: { width: 44, height: 24, ball: 18, offset: 3 },
  };
  const s = sizes[size];

  return (
    <button
      type="button"
      dir="ltr"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: `${s.width}px`,
        height: `${s.height}px`,
        borderRadius: '9999px',
        backgroundColor: checked ? activeColor : '#d1d5db',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        border: 'none',
        padding: 0,
        transition: 'background-color 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: `${s.offset}px`,
          left: checked ? `${s.width - s.ball - s.offset}px` : `${s.offset}px`,
          width: `${s.ball}px`,
          height: `${s.ball}px`,
          borderRadius: '9999px',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}
