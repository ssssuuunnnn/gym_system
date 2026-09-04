/* @ds-bundle: {"format":4,"namespace":"PulseFitDesignSystem_325e30","components":[{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/data-display/Badge.jsx"},{"name":"Card","sourcePath":"components/data-display/Card.jsx"},{"name":"Progress","sourcePath":"components/data-display/Progress.jsx"},{"name":"Statistic","sourcePath":"components/data-display/Statistic.jsx"},{"name":"Table","sourcePath":"components/data-display/Table.jsx"},{"name":"Tag","sourcePath":"components/data-display/Tag.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"Modal","sourcePath":"components/feedback/Modal.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Button","sourcePath":"components/general/Button.jsx"},{"name":"Breadcrumb","sourcePath":"components/navigation/Breadcrumb.jsx"},{"name":"Menu","sourcePath":"components/navigation/Menu.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"StatusTag","sourcePath":"components/app/StatusTag.jsx"},{"name":"SlotPicker","sourcePath":"components/app/SlotPicker.jsx"},{"name":"AppLayout","sourcePath":"components/app/AppLayout.jsx"}],"sourceHashes":{"components/app/StatusTag.jsx":"e5f5bce0ecc2","components/app/SlotPicker.jsx":"a1ab085cec2a","components/app/AppLayout.jsx":"b9785b538a60","components/data-display/Avatar.jsx":"65c58e7cb491","components/data-display/Badge.jsx":"8d6aff68be87","components/data-display/Card.jsx":"cf25fe554148","components/data-display/Progress.jsx":"3f9b8444971b","components/data-display/Statistic.jsx":"1d1c76465a71","components/data-display/Table.jsx":"f59843d515e1","components/data-display/Tag.jsx":"a8e989914d93","components/feedback/Alert.jsx":"2efeeaf36200","components/feedback/Modal.jsx":"9d6f8e7e6a74","components/feedback/Tooltip.jsx":"bedeb461c0f1","components/forms/Checkbox.jsx":"7070d4dd9965","components/forms/Input.jsx":"6c0b6cce219b","components/forms/Radio.jsx":"87639e59caa1","components/forms/Select.jsx":"45b82ad6c292","components/forms/Switch.jsx":"caa793241782","components/general/Button.jsx":"75b94f30af2f","components/navigation/Breadcrumb.jsx":"9dee5f0d8fb4","components/navigation/Menu.jsx":"a13d451ff683","components/navigation/Tabs.jsx":"2316a2ba3877","ui_kits/dashboard/DashboardContent.jsx":"62719566a698","ui_kits/dashboard/DashboardLayout.jsx":"8d6adb7a2cd5","ui_kits/dashboard/doc-page.js":"371bab66f42d","ui_kits/dashboard/tweaks-panel.jsx":"d259e3a86f73"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PulseFitDesignSystem_325e30 = window.PulseFitDesignSystem_325e30 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data-display/Avatar.jsx
try { (() => {
function Avatar(props) {
  const {
    src,
    children,
    size = 32,
    shape = 'circle'
  } = props;
  const style = {
    width: size,
    height: size,
    borderRadius: shape === 'circle' ? '50%' : 'var(--radius-sm)',
    background: 'var(--color-primary)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.4,
    fontFamily: 'var(--font-family)',
    overflow: 'hidden',
    flexShrink: 0
  };
  if (src) return React.createElement('img', {
    src,
    style
  });
  return React.createElement('span', {
    style
  }, children);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Badge.jsx
try { (() => {
function Badge(props) {
  const {
    count,
    dot = false,
    color = 'var(--color-error)',
    children
  } = props;
  if (!children) {
    return React.createElement('span', {
      style: {
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color
      }
    });
  }
  return React.createElement('span', {
    style: {
      position: 'relative',
      display: 'inline-flex'
    }
  }, children, (count > 0 || dot) && React.createElement('span', {
    style: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: dot ? 8 : 16,
      height: dot ? 8 : 16,
      borderRadius: 8,
      background: color,
      color: '#fff',
      fontSize: 11,
      lineHeight: dot ? '8px' : '16px',
      textAlign: 'center',
      padding: dot ? 0 : '0 4px',
      fontFamily: 'var(--font-family)',
      boxShadow: '0 0 0 1px #fff'
    }
  }, dot ? null : count));
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Card.jsx
try { (() => {
function Card(props) {
  const {
    title,
    extra,
    children,
    hoverable = false,
    style,
    bodyStyle
  } = props;
  const [hover, setHover] = React.useState(false);
  return React.createElement('div', {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: 'var(--bg-container)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-secondary)',
      boxShadow: hoverable && hover ? 'var(--shadow-card-hover)' : 'none',
      transition: 'box-shadow .2s',
      overflow: 'hidden',
      fontFamily: 'var(--font-family)',
      ...style
    }
  }, title && React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      height: 48,
      borderBottom: '1px solid var(--border-secondary)'
    }
  }, React.createElement('span', {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, title), extra && React.createElement('span', {
    style: {
      fontSize: 14,
      color: 'var(--text-secondary)'
    }
  }, extra)), React.createElement('div', {
    style: {
      padding: 20,
      ...bodyStyle
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Card.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Progress.jsx
try { (() => {
function Progress(props) {
  const {
    percent = 0,
    strokeColor = 'var(--color-primary)',
    size = 'default',
    showInfo = true
  } = props;
  const h = size === 'small' ? 6 : 8;
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-family)'
    }
  }, React.createElement('div', {
    style: {
      flex: 1,
      height: h,
      borderRadius: h,
      background: 'var(--fill-secondary)',
      overflow: 'hidden'
    }
  }, React.createElement('div', {
    style: {
      width: percent + '%',
      height: '100%',
      borderRadius: h,
      background: strokeColor,
      transition: 'width .3s'
    }
  })), showInfo && React.createElement('span', {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)',
      minWidth: 36,
      textAlign: 'right'
    }
  }, percent + '%'));
}
Object.assign(__ds_scope, { Progress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Progress.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Statistic.jsx
try { (() => {
function Statistic(props) {
  const {
    title,
    value,
    prefix,
    suffix,
    valueColor,
    trend
  } = props;
  return React.createElement('div', {
    style: {
      fontFamily: 'var(--font-family)'
    }
  }, React.createElement('div', {
    style: {
      fontSize: 14,
      color: 'var(--text-secondary)',
      marginBottom: 4
    }
  }, title), React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, React.createElement('span', {
    style: {
      fontSize: 24,
      fontWeight: 600,
      color: valueColor || 'var(--text-primary)'
    }
  }, prefix, value, suffix), trend && React.createElement('span', {
    style: {
      fontSize: 12,
      color: trend > 0 ? 'var(--color-success)' : 'var(--color-error)',
      display: 'flex',
      alignItems: 'center'
    }
  }, React.createElement('i', {
    className: trend > 0 ? 'ri-arrow-up-line' : 'ri-arrow-down-line'
  }), Math.abs(trend) + '%')));
}
Object.assign(__ds_scope, { Statistic });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Statistic.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Table.jsx
try { (() => {
function Table(props) {
  const {
    columns = [],
    data = []
  } = props;
  return React.createElement('table', {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-family)',
      fontSize: 14
    }
  }, React.createElement('thead', null, React.createElement('tr', null, columns.map(c => React.createElement('th', {
    key: c.key,
    style: {
      textAlign: c.align || 'left',
      padding: '12px 16px',
      background: 'var(--gray-2)',
      color: 'var(--text-secondary)',
      fontWeight: 600,
      fontSize: 13,
      borderBottom: '1px solid var(--border-secondary)'
    }
  }, c.title)))), React.createElement('tbody', null, data.map((row, i) => React.createElement('tr', {
    key: i,
    style: {
      borderBottom: '1px solid var(--border-secondary)'
    }
  }, columns.map(c => React.createElement('td', {
    key: c.key,
    style: {
      padding: '12px 16px',
      textAlign: c.align || 'left',
      color: 'var(--text-primary)'
    }
  }, c.render ? c.render(row[c.key], row) : row[c.key]))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Table.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Tag.jsx
try { (() => {
const COLORS = {
  default: ['var(--fill-secondary)', 'var(--text-secondary)', 'var(--border-color)'],
  success: ['var(--color-success-bg)', 'var(--color-success)', 'var(--color-success-border)'],
  warning: ['var(--color-warning-bg)', 'var(--color-warning)', 'var(--color-warning-border)'],
  error: ['var(--color-error-bg)', 'var(--color-error)', 'var(--color-error-border)'],
  processing: ['var(--color-primary-bg)', 'var(--color-primary)', 'var(--color-primary-border)']
};
function Tag(props) {
  const {
    color = 'default',
    children,
    closable = false,
    onClose
  } = props;
  const [bg, fg, bd] = COLORS[color] || COLORS.default;
  return React.createElement('span', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      height: 22,
      padding: '0 7px',
      fontSize: 12,
      borderRadius: 'var(--radius-sm)',
      background: bg,
      color: fg,
      border: `1px solid ${bd}`,
      fontFamily: 'var(--font-family)',
      lineHeight: '20px'
    }
  }, children, closable && React.createElement('i', {
    className: 'ri-close-line',
    onClick: onClose,
    style: {
      cursor: 'pointer',
      fontSize: 10
    }
  }));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
const MAP = {
  info: ['var(--color-primary-bg)', 'var(--color-primary-border)', 'var(--color-primary)', 'ri-information-line'],
  success: ['var(--color-success-bg)', 'var(--color-success-border)', 'var(--color-success)', 'ri-checkbox-circle-line'],
  warning: ['var(--color-warning-bg)', 'var(--color-warning-border)', 'var(--color-warning)', 'ri-alert-line'],
  error: ['var(--color-error-bg)', 'var(--color-error-border)', 'var(--color-error)', 'ri-close-circle-line']
};
function Alert(props) {
  const {
    type = 'info',
    message,
    description,
    closable = false,
    onClose
  } = props;
  const [bg, bd, fg, icon] = MAP[type] || MAP.info;
  return React.createElement('div', {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: description ? 'flex-start' : 'center',
      padding: '10px 14px',
      borderRadius: 'var(--radius-base)',
      background: bg,
      border: `1px solid ${bd}`,
      fontFamily: 'var(--font-family)'
    }
  }, React.createElement('i', {
    className: icon,
    style: {
      color: fg,
      fontSize: 16,
      marginTop: description ? 2 : 0
    }
  }), React.createElement('div', {
    style: {
      flex: 1
    }
  }, React.createElement('div', {
    style: {
      fontSize: 14,
      color: 'var(--text-primary)',
      fontWeight: description ? 600 : 400
    }
  }, message), description && React.createElement('div', {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)',
      marginTop: 4
    }
  }, description)), closable && React.createElement('i', {
    className: 'ri-close-line',
    onClick: onClose,
    style: {
      cursor: 'pointer',
      color: 'var(--text-tertiary)'
    }
  }));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Modal.jsx
try { (() => {
function Modal(props) {
  const {
    open,
    title,
    children,
    onClose,
    footer
  } = props;
  if (!open) return null;
  return React.createElement('div', {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-mask)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      fontFamily: 'var(--font-family)'
    },
    onClick: onClose
  }, React.createElement('div', {
    onClick: e => e.stopPropagation(),
    style: {
      width: 420,
      background: '#fff',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-2)',
      overflow: 'hidden'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: '1px solid var(--border-secondary)'
    }
  }, React.createElement('span', {
    style: {
      fontSize: 16,
      fontWeight: 600
    }
  }, title), React.createElement('i', {
    className: 'ri-close-line',
    onClick: onClose,
    style: {
      cursor: 'pointer',
      color: 'var(--text-tertiary)'
    }
  })), React.createElement('div', {
    style: {
      padding: 24,
      fontSize: 14,
      color: 'var(--text-secondary)'
    }
  }, children), footer && React.createElement('div', {
    style: {
      padding: '12px 24px',
      borderTop: '1px solid var(--border-secondary)',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8
    }
  }, footer)));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Modal.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip(props) {
  const {
    content,
    children
  } = props;
  const [show, setShow] = React.useState(false);
  return React.createElement('span', {
    style: {
      position: 'relative',
      display: 'inline-flex'
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && React.createElement('span', {
    style: {
      position: 'absolute',
      bottom: 'calc(100% + 6px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--bg-spotlight)',
      color: '#fff',
      fontSize: 12,
      padding: '6px 10px',
      borderRadius: 'var(--radius-sm)',
      whiteSpace: 'nowrap',
      fontFamily: 'var(--font-family)',
      zIndex: 100
    }
  }, content));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox(props) {
  const {
    checked = false,
    onChange,
    disabled = false,
    children
  } = props;
  return React.createElement('label', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-family)',
      fontSize: 14,
      color: disabled ? 'var(--text-quaternary)' : 'var(--text-primary)'
    }
  }, React.createElement('span', {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 16,
      height: 16,
      borderRadius: 4,
      border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--border-color)'}`,
      background: checked ? 'var(--color-primary)' : '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'all .2s'
    }
  }, checked && React.createElement('i', {
    className: 'ri-check-line',
    style: {
      color: '#fff',
      fontSize: 12
    }
  })), children);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input(props) {
  const {
    placeholder = '',
    value,
    onChange,
    size = 'middle',
    disabled = false,
    status,
    prefix,
    suffix,
    type = 'text'
  } = props;
  const [focus, setFocus] = React.useState(false);
  const h = size === 'large' ? 40 : size === 'small' ? 24 : 32;
  let border = 'var(--border-color)';
  if (status === 'error') border = 'var(--color-error)';else if (status === 'warning') border = 'var(--color-warning)';
  if (focus) border = status === 'error' ? 'var(--color-error)' : 'var(--color-primary)';
  return React.createElement('div', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      height: h,
      padding: '0 11px',
      borderRadius: 'var(--radius-base)',
      border: `1px solid ${border}`,
      background: disabled ? 'var(--fill-tertiary)' : 'var(--bg-container)',
      boxShadow: focus ? '0 0 0 2px var(--color-primary-bg)' : 'none',
      transition: 'all .2s',
      fontFamily: 'var(--font-family)',
      width: props.style?.width || 220
    }
  }, prefix && React.createElement('span', {
    style: {
      color: 'var(--text-tertiary)',
      display: 'flex'
    }
  }, prefix), React.createElement('input', {
    type,
    placeholder,
    value,
    onChange,
    disabled,
    style: {
      border: 'none',
      outline: 'none',
      flex: 1,
      fontSize: 14,
      color: 'var(--text-primary)',
      background: 'transparent',
      fontFamily: 'var(--font-family)'
    },
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false)
  }), suffix && React.createElement('span', {
    style: {
      color: 'var(--text-tertiary)',
      display: 'flex'
    }
  }, suffix));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function Radio(props) {
  const {
    checked = false,
    onChange,
    disabled = false,
    children
  } = props;
  return React.createElement('label', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'var(--font-family)',
      fontSize: 14,
      color: disabled ? 'var(--text-quaternary)' : 'var(--text-primary)'
    }
  }, React.createElement('span', {
    onClick: () => !disabled && onChange && onChange(),
    style: {
      width: 16,
      height: 16,
      borderRadius: '50%',
      border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--border-color)'}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, checked && React.createElement('span', {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--color-primary)'
    }
  })), children);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select(props) {
  const {
    options = [],
    value,
    placeholder = '請選擇',
    onChange,
    size = 'middle',
    disabled = false,
    style
  } = props;
  const [open, setOpen] = React.useState(false);
  const h = size === 'large' ? 40 : size === 'small' ? 24 : 32;
  const selected = options.find(o => o.value === value);
  return React.createElement('div', {
    style: {
      position: 'relative',
      width: style?.width || 180,
      fontFamily: 'var(--font-family)'
    }
  }, React.createElement('div', {
    onClick: () => !disabled && setOpen(!open),
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: h,
      padding: '0 11px',
      borderRadius: 'var(--radius-base)',
      border: `1px solid ${open ? 'var(--color-primary)' : 'var(--border-color)'}`,
      background: disabled ? 'var(--fill-tertiary)' : 'var(--bg-container)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: open ? '0 0 0 2px var(--color-primary-bg)' : 'none',
      fontSize: 14
    }
  }, React.createElement('span', {
    style: {
      color: selected ? 'var(--text-primary)' : 'var(--text-quaternary)'
    }
  }, selected ? selected.label : placeholder), React.createElement('i', {
    className: 'ri-arrow-down-s-line',
    style: {
      color: 'var(--text-tertiary)',
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform .2s'
    }
  })), open && React.createElement('div', {
    style: {
      position: 'absolute',
      top: h + 4,
      left: 0,
      right: 0,
      background: '#fff',
      borderRadius: 'var(--radius-base)',
      boxShadow: 'var(--shadow-2)',
      zIndex: 10,
      padding: 4
    }
  }, options.map(o => React.createElement('div', {
    key: o.value,
    onClick: () => {
      onChange && onChange(o.value);
      setOpen(false);
    },
    style: {
      padding: '5px 12px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 14,
      cursor: 'pointer',
      background: o.value === value ? 'var(--color-primary-bg)' : 'transparent',
      color: o.value === value ? 'var(--color-primary)' : 'var(--text-primary)'
    }
  }, o.label))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch(props) {
  const {
    checked = false,
    onChange,
    disabled = false,
    size = 'default'
  } = props;
  const w = size === 'small' ? 28 : 44,
    h = size === 'small' ? 16 : 22;
  return React.createElement('span', {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: w,
      height: h,
      borderRadius: h,
      background: disabled ? 'var(--fill-tertiary)' : checked ? 'var(--color-primary)' : 'rgba(0,0,0,0.25)',
      position: 'relative',
      display: 'inline-block',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background .2s'
    }
  }, React.createElement('span', {
    style: {
      width: h - 4,
      height: h - 4,
      borderRadius: '50%',
      background: '#fff',
      position: 'absolute',
      top: 2,
      left: checked ? w - h + 2 : 2,
      transition: 'left .2s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/general/Button.jsx
try { (() => {
const SIZE = {
  large: {
    h: 40,
    fs: 16,
    px: 15
  },
  middle: {
    h: 32,
    fs: 14,
    px: 15
  },
  small: {
    h: 24,
    fs: 14,
    px: 7
  }
};
function Button(props) {
  const {
    type = 'default',
    size = 'middle',
    danger = false,
    disabled = false,
    loading = false,
    icon = null,
    block = false,
    children,
    onClick,
    style
  } = props;
  const s = SIZE[size] || SIZE.middle;
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  let bg = 'var(--bg-container)',
    color = 'var(--text-primary)',
    border = '1px solid var(--border-color)';
  if (type === 'primary') {
    bg = danger ? 'var(--color-error)' : 'var(--color-primary)';
    color = '#fff';
    border = '1px solid transparent';
  } else if (type === 'dashed') {
    border = '1px dashed var(--border-color)';
  } else if (type === 'text') {
    border = '1px solid transparent';
    bg = 'transparent';
  } else if (type === 'link') {
    border = '1px solid transparent';
    bg = 'transparent';
    color = danger ? 'var(--color-error)' : 'var(--color-primary)';
  }
  if (danger && type !== 'primary') {
    color = 'var(--color-error)';
    border = type === 'default' || type === 'dashed' ? '1px solid var(--color-error-border)' : border;
  }
  if (hover && !disabled) {
    if (type === 'primary') {
      bg = danger ? 'var(--color-error-hover)' : 'var(--color-primary-hover)';
    } else if (type === 'default' || type === 'dashed') {
      color = danger ? 'var(--color-error-hover)' : 'var(--color-primary-hover)';
      border = `1px ${type === 'dashed' ? 'dashed' : 'solid'} ${danger ? 'var(--color-error-hover)' : 'var(--color-primary-border)'}`;
    } else if (type === 'text') {
      bg = 'var(--fill-tertiary)';
    } else if (type === 'link') {
      color = 'var(--color-primary-hover)';
    }
  }
  if (active && !disabled && type === 'primary') {
    bg = danger ? 'var(--red-6)' : 'var(--color-primary-active)';
  }
  if (disabled) {
    bg = type === 'primary' ? 'var(--fill-primary)' : 'var(--bg-container)';
    color = 'var(--text-quaternary)';
    border = '1px solid var(--border-secondary)';
  }
  return React.createElement('button', {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    disabled: disabled || loading,
    onClick,
    style: {
      display: block ? 'flex' : 'inline-flex',
      width: block ? '100%' : undefined,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: s.h,
      fontSize: s.fs,
      padding: `0 ${s.px}px`,
      borderRadius: 'var(--radius-base)',
      background: bg,
      color,
      border,
      fontFamily: 'var(--font-family)',
      fontWeight: 400,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all .2s',
      boxShadow: type === 'primary' && !disabled && !danger ? '0 2px 0 rgba(5,145,255,0.1)' : undefined,
      textDecoration: type === 'link' && hover ? 'underline' : 'none',
      ...style
    }
  }, loading ? React.createElement('span', {
    style: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      border: '2px solid currentColor',
      borderTopColor: 'transparent',
      display: 'inline-block',
      animation: 'spin .8s linear infinite'
    }
  }) : icon, children && React.createElement('span', null, children));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/general/Button.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumb.jsx
try { (() => {
function Breadcrumb(props) {
  const {
    items = []
  } = props;
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      fontFamily: 'var(--font-family)'
    }
  }, items.map((it, i) => React.createElement(React.Fragment, {
    key: i
  }, i > 0 && React.createElement('span', {
    style: {
      color: 'var(--text-quaternary)'
    }
  }, '/'), React.createElement('span', {
    style: {
      color: i === items.length - 1 ? 'var(--text-primary)' : 'var(--text-tertiary)'
    }
  }, it))));
}
Object.assign(__ds_scope, { Breadcrumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Menu.jsx
try { (() => {
function Menu(props) {
  const {
    items = [],
    activeKey,
    onChange,
    collapsed = false
  } = props;
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      fontFamily: 'var(--font-family)',
      padding: 8
    }
  }, items.map(it => React.createElement('div', {
    key: it.key,
    onClick: () => onChange && onChange(it.key),
    title: collapsed ? it.label : undefined,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: collapsed ? 'center' : 'flex-start',
      gap: 10,
      height: 40,
      padding: collapsed ? 0 : '0 16px',
      borderRadius: 'var(--radius-base)',
      cursor: 'pointer',
      fontSize: 14,
      background: it.key === activeKey ? 'var(--color-primary-bg)' : 'transparent',
      color: it.key === activeKey ? 'var(--color-primary)' : 'var(--text-primary)',
      fontWeight: it.key === activeKey ? 500 : 400
    }
  }, it.icon && React.createElement('i', {
    className: it.icon,
    style: {
      fontSize: 16
    }
  }), !collapsed && it.label)));
}
Object.assign(__ds_scope, { Menu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Menu.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs(props) {
  const {
    items = [],
    activeKey,
    onChange
  } = props;
  return React.createElement('div', {
    style: {
      borderBottom: '1px solid var(--border-secondary)',
      display: 'flex',
      gap: 32,
      fontFamily: 'var(--font-family)'
    }
  }, items.map(it => React.createElement('div', {
    key: it.key,
    onClick: () => onChange && onChange(it.key),
    style: {
      padding: '12px 0',
      fontSize: 14,
      cursor: 'pointer',
      color: it.key === activeKey ? 'var(--color-primary)' : 'var(--text-primary)',
      fontWeight: it.key === activeKey ? 600 : 400,
      borderBottom: it.key === activeKey ? '2px solid var(--color-primary)' : '2px solid transparent',
      marginBottom: -1
    }
  }, it.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/app/StatusTag.jsx
try { (() => {
const STATUS_COLOR = { '待確認': 'warning', '已確認': 'success', '已拒絕': 'error', '已取消': 'default' };
function StatusTag(props) {
  const { status } = props;
  const ns = (typeof window !== 'undefined' && window.PulseFitDesignSystem_325e30) || {};
  const Tag = ns.Tag;
  const color = STATUS_COLOR[status] || 'default';
  if (!Tag) return React.createElement('span', { style: { fontFamily: 'var(--font-family)', fontSize: 12 } }, status);
  return React.createElement(Tag, { color: color }, status);
}
Object.assign(__ds_scope, { StatusTag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/StatusTag.jsx", error: String((e && e.message) || e) }); }

// components/app/SlotPicker.jsx
try { (() => {
const STATE_STYLE = {
  empty: { background: 'var(--gray-3)' },
  booked: { background: 'var(--gray-6)', color: '#fff' },
  group: { background: 'var(--gray-7)', color: '#fff' },
  buyout: { background: 'var(--gray-10)', color: '#fff' },
  closed: { background: 'var(--color-warning)', color: '#fff' }
};
const DAYS = ['一', '二', '三', '四', '五', '六'];
const HOURS = Array.from({ length: 12 }, (_, i) => 10 + i);
function SlotPicker(props) {
  const { cellState, onCellClick } = props;
  return React.createElement('div', { style: { overflowX: 'auto', fontFamily: 'var(--font-family)' } },
    React.createElement('table', { style: { borderCollapse: 'collapse', width: '100%', minWidth: 480 } },
      React.createElement('thead', null,
        React.createElement('tr', null,
          React.createElement('th', { style: { width: 60 } }),
          DAYS.map((d) => React.createElement('th', {
            key: d, style: { padding: 4, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }
          }, '週' + d))
        )
      ),
      React.createElement('tbody', null,
        HOURS.map((hour) => React.createElement('tr', { key: hour },
          React.createElement('td', {
            style: { fontSize: 12, textAlign: 'right', paddingRight: 8, color: 'var(--text-tertiary)' }
          }, hour + ':00'),
          DAYS.map((_, dayIdx) => {
            const dayOfWeek = dayIdx + 1;
            const state = (cellState && cellState(dayOfWeek, hour)) || 'empty';
            return React.createElement('td', {
              key: dayOfWeek,
              onClick: () => onCellClick && onCellClick(dayOfWeek, hour),
              style: Object.assign({}, STATE_STYLE[state] || STATE_STYLE.empty, {
                height: 32, border: '2px solid var(--bg-container)', borderRadius: 'var(--radius-sm)',
                cursor: onCellClick ? 'pointer' : 'default', textAlign: 'center', fontSize: 11
              })
            });
          })
        ))
      )
    )
  );
}
Object.assign(__ds_scope, { SlotPicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/SlotPicker.jsx", error: String((e && e.message) || e) }); }

// components/app/AppLayout.jsx
try { (() => {
const HEADER_HEIGHT = 64;
const SIDER_WIDTH = 208;
const SIDER_COLLAPSED_WIDTH = 56;
const CONTENT_PADDING = 24;
const ADMIN_MENU = [
  { key: '/admin/dashboard', label: '儀表板', icon: 'ri-dashboard-line' },
  { key: '/admin/reservations', label: '預約審核', icon: 'ri-file-list-3-line' },
  { key: '/admin/coaches', label: '教練管理', icon: 'ri-user-star-line' },
  { key: '/admin/products', label: '商品管理', icon: 'ri-shopping-bag-3-line' },
  { key: '/admin/courses', label: '課程管理', icon: 'ri-calendar-line' },
  { key: '/admin/members', label: '會員管理', icon: 'ri-team-line' },
  { key: '/admin/slot-settings', label: '時段設定', icon: 'ri-time-line' }
];
const MEMBER_MENU = [
  { key: '/member/dashboard', label: '儀表板', icon: 'ri-dashboard-line' },
  { key: '/member/products', label: '我的商品', icon: 'ri-shopping-bag-3-line' },
  { key: '/member/bookings', label: '我的預約', icon: 'ri-calendar-line' }
];
function AppLayout(props) {
  const {
    role = 'admin', username = '', isCoach = false, activeKey,
    scrolled = false, defaultCollapsed = false, onNavigate, onLogout, children
  } = props;
  const ns = (typeof window !== 'undefined' && window.PulseFitDesignSystem_325e30) || {};
  const Menu = ns.Menu;
  const Button = ns.Button;
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const items = role === 'admin' ? ADMIN_MENU : MEMBER_MENU;
  const roleLabel = role === 'admin' ? '管理員' : (isCoach ? '場租教練' : '學員');
  return React.createElement('div', {
    style: { display: 'flex', minHeight: '100%', fontFamily: 'var(--font-family)', background: 'var(--bg-layout)' }
  },
    React.createElement('div', {
      style: {
        width: collapsed ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH, flexShrink: 0,
        background: 'var(--sider-bg)', borderRight: '1px solid var(--sider-border)',
        display: 'flex', flexDirection: 'column', transition: 'width .2s'
      }
    },
      React.createElement('div', {
        style: {
          height: HEADER_HEIGHT, display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? 0 : '0 20px',
          fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden'
        }
      }, collapsed ? '健' : '健身工作室管理系統'),
      Menu && React.createElement(Menu, {
        items: items, activeKey: activeKey, collapsed: collapsed,
        onChange: (key) => onNavigate && onNavigate(key)
      }),
      React.createElement('div', {
        onClick: () => setCollapsed((c) => !c),
        style: {
          marginTop: 'auto', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-secondary)'
        }
      }, React.createElement('i', {
        className: collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line', style: { fontSize: 16 }
      }))
    ),
    React.createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 } },
      React.createElement('div', {
        style: {
          position: 'sticky', top: 0, zIndex: 10, height: HEADER_HEIGHT, display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
          background: scrolled ? 'rgba(255,255,255,0.45)' : 'var(--header-bg)',
          backdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
          boxShadow: scrolled ? 'var(--shadow-header)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
          transition: 'background .25s, box-shadow .25s'
        }
      },
        React.createElement('span', { style: { color: 'var(--text-secondary)', fontSize: 14 } },
          username + '（' + roleLabel + '）'),
        Button && React.createElement(Button, { onClick: () => onLogout && onLogout() }, '登出')
      ),
      React.createElement('div', { style: { margin: CONTENT_PADDING, flex: 1 } }, children)
    )
  );
}
Object.assign(__ds_scope, { AppLayout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/app/AppLayout.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/DashboardContent.jsx
try { (() => {
const DATA = {
  today: {
    label: '今日',
    revLabel: '今日營收',
    rev: '32,480',
    revTrend: 5.2,
    memberLabel: '今日新增會員',
    member: '6',
    memberTrend: 20,
    chart: {
      labels: ['06', '08', '10', '12', '14', '16', '18', '20', '22'],
      values: [4, 9, 14, 22, 18, 26, 34, 30, 12]
    }
  },
  week: {
    label: '本週',
    revLabel: '本週營收',
    rev: '168,900',
    revTrend: 8.3,
    memberLabel: '本週新增會員',
    member: '18',
    memberTrend: 12,
    chart: {
      labels: ['一', '二', '三', '四', '五', '六', '日'],
      values: [22, 26, 24, 30, 28, 36, 32]
    }
  },
  month: {
    label: '本月',
    revLabel: '本月營收',
    rev: '386,240',
    revTrend: 12.4,
    memberLabel: '本月新增會員',
    member: '42',
    memberTrend: 8.1,
    chart: {
      labels: ['第1週', '第2週', '第3週', '第4週'],
      values: [82, 95, 88, 121]
    }
  },
  year: {
    label: '本年',
    revLabel: '本年營收',
    rev: '4,280,600',
    revTrend: 15.6,
    memberLabel: '本年新增會員',
    member: '386',
    memberTrend: 9.4,
    chart: {
      labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      values: [38, 42, 35, 50, 46, 58, 54, 62, 59, 68, 64, 72]
    }
  }
};
const classShare = [{
  label: '場地租借',
  pct: 35,
  color: 'var(--chart-1)'
}, {
  label: '私人教練課',
  pct: 25,
  color: 'var(--chart-2)'
}, {
  label: '場地包場',
  pct: 20,
  color: 'var(--chart-3)'
}, {
  label: '團體課程',
  pct: 20,
  color: 'var(--chart-4)'
}];
const LIVE = {
  '2F': [{
    type: '團體課程',
    name: '活力瑜伽',
    room: 'Bella',
    time: '10:00–11:00',
    status: '進行中'
  }, {
    type: '私人教練課',
    name: 'Helen教練 × 林同學',
    room: '一對二',
    time: '11:00–12:00',
    status: '進行中'
  }, {
    type: '場地租借',
    name: 'Darren',
    room: '一對多',
    time: '13:00–14:00',
    status: '已預約'
  }, {
    type: '場地包場',
    name: 'Zero',
    room: '',
    time: '15:00–17:00',
    status: '已預約'
  }],
  '1F': [{
    type: '私人教練課',
    name: '林教練 × 王同學',
    room: '一對一',
    time: '10:30–11:30',
    status: '進行中'
  }, {
    type: '場地租借',
    name: 'Helen',
    room: '一對一',
    time: '14:00–15:00',
    status: '已預約'
  }]
};
const STATUS_TAG = {
  '進行中': 'success',
  '已預約': 'processing'
};
const PENDING_RENTALS = [{
  who: '張先生',
  venue: '場地租借',
  date: '8/17 (日) 09:00–10:00',
  submitted: '今日 13:20'
}, {
  who: '林先生',
  venue: '場地租借',
  date: '8/14 (今日) 18:00–19:00',
  submitted: '今日 11:02'
}, {
  who: '陳小姐',
  venue: '場地包場',
  date: '8/20 (三) 全天',
  submitted: '今日 10:35'
}, {
  who: '王先生',
  venue: '場地租借',
  date: '8/16 (六) 14:00–15:00',
  submitted: '今日 09:12'
}];
const E = React.createElement;
function DashboardContent({
  range
}) {
  const {
    Card,
    Statistic,
    Tag
  } = window.PulseFitDesignSystem_325e30;
  const d = DATA[range] || DATA.today;
  const max = Math.max(...d.chart.values);
  let acc = 0;
  const conic = classShare.map(s => {
    const start = acc;
    acc += s.pct;
    return `${s.color} ${start}% ${acc}%`;
  }).join(',');
  const statRow = E('div', {
    style: {
      display: 'flex',
      gap: 16
    }
  }, E(Card, {
    style: {
      flex: 1
    }
  }, E(Statistic, {
    title: d.revLabel,
    value: d.rev,
    prefix: 'NT$ ',
    trend: d.revTrend
  })), E(Card, {
    style: {
      flex: 1
    }
  }, E(Statistic, {
    title: d.memberLabel,
    value: d.member,
    suffix: ' 人',
    trend: d.memberTrend
  })));
  const bars = E('div', {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      height: 160,
      marginTop: 12
    }
  }, d.chart.values.map((v, i) => E('div', {
    key: i,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6
    }
  }, E('div', {
    style: {
      width: '100%',
      height: v / max * 130 + 'px',
      background: i === d.chart.values.length - 1 ? 'var(--color-primary)' : 'var(--color-primary-bg)',
      borderRadius: '4px 4px 0 0'
    }
  }), E('span', {
    style: {
      fontSize: 11,
      color: 'var(--text-tertiary)'
    }
  }, d.chart.labels[i]))));
  const revenueCard = E(Card, {
    style: {
      flex: 2
    },
    title: '營收趨勢',
    extra: E('span', {
      style: {
        fontSize: 13,
        color: 'var(--text-tertiary)'
      }
    }, d.label)
  }, bars);
  const legend = E('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: '100%'
    }
  }, classShare.map(s => E('div', {
    key: s.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13
    }
  }, E('span', {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: s.color
    }
  }), E('span', {
    style: {
      flex: 1,
      color: 'var(--text-secondary)'
    }
  }, s.label), E('span', {
    style: {
      color: 'var(--text-primary)',
      fontWeight: 500
    }
  }, s.pct + '%'))));
  const donut = E('div', {
    style: {
      width: 120,
      height: 120,
      borderRadius: '50%',
      background: `conic-gradient(${conic})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, E('div', {
    style: {
      width: 70,
      height: 70,
      borderRadius: '50%',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
      color: 'var(--text-secondary)',
      flexDirection: 'column'
    }
  }, E('span', {
    style: {
      fontSize: 18,
      fontWeight: 600,
      color: 'var(--text-primary)'
    }
  }, '312'), E('span', null, '總課程數')));
  const shareCard = E(Card, {
    style: {
      flex: 1
    },
    title: '課程類型佔比'
  }, E('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16
    }
  }, donut, legend));
  const chartRow = E('div', {
    style: {
      display: 'flex',
      gap: 16,
      alignItems: 'stretch'
    }
  }, revenueCard, shareCard);
  function floorList(items) {
    return E('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, items.map((it, i) => E('div', {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: i < items.length - 1 ? '1px solid var(--border-secondary)' : 'none'
      }
    }, E(Tag, {
      color: 'default'
    }, it.type), E('div', {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, E('div', {
      style: {
        fontSize: 14,
        color: 'var(--text-primary)',
        fontWeight: 500
      }
    }, it.name), E('div', {
      style: {
        fontSize: 12,
        color: 'var(--text-tertiary)'
      }
    }, (it.room ? it.room + ' · ' : '') + it.time)), E(Tag, {
      color: STATUS_TAG[it.status]
    }, it.status))));
  }
  const liveCard = E(Card, {
    style: {
      flex: 2
    },
    title: '即時課程',
    extra: E('a', {
      href: '#'
    }, '查看場地時段表')
  }, E('div', {
    style: {
      display: 'flex',
      gap: 24
    }
  }, E('div', {
    style: {
      flex: 3,
      minWidth: 0
    }
  }, E('div', {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-secondary)',
      marginBottom: 8
    }
  }, '二樓'), floorList(LIVE['2F'])), E('div', {
    style: {
      width: 1,
      background: 'var(--border-secondary)'
    }
  }), E('div', {
    style: {
      flex: 2,
      minWidth: 0
    }
  }, E('div', {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--text-secondary)',
      marginBottom: 8
    }
  }, '一樓'), floorList(LIVE['1F']))));
  const todoList = E('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, PENDING_RENTALS.map((it, i) => E('div', {
    key: i,
    style: {
      paddingBottom: 12,
      borderBottom: '1px solid var(--border-secondary)'
    }
  }, E('div', {
    style: {
      fontSize: 14,
      color: 'var(--text-primary)',
      fontWeight: 500,
      marginBottom: 4
    }
  }, it.who + ' · ' + it.venue), E('div', {
    style: {
      fontSize: 12,
      color: 'var(--text-tertiary)'
    }
  }, '租借時段 ' + it.date + ' · 提交於 ' + it.submitted))), E('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 4
    }
  }, E('span', {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)'
    }
  }, '待審核共 ' + PENDING_RENTALS.length + ' 筆'), E('a', {
    href: '#'
  }, '查看預約審核列表')));
  const todoCard = E(Card, {
    style: {
      flex: 1
    },
    title: '今日待辦事項'
  }, todoList);
  const bottomRow = E('div', {
    style: {
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start'
    }
  }, E('div', {
    id: 'live-courses-card',
    style: {
      flex: 2
    }
  }, liveCard), E('div', {
    id: 'today-todo-card',
    style: {
      flex: 1
    }
  }, todoCard));
  return E('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, statRow, bottomRow, chartRow);
}
window.PulseFitUIKit = Object.assign(window.PulseFitUIKit || {}, {
  DashboardContent
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/DashboardContent.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/DashboardLayout.jsx
try { (() => {
function DashboardLayout({
  active,
  onNav,
  children
}) {
  const {
    Menu,
    Avatar,
    Input,
    Badge
  } = window.PulseFitDesignSystem_325e30;
  const [scrolled, setScrolled] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const items = [{
    key: 'dash',
    label: '儀表板',
    icon: 'ri-dashboard-line'
  }, {
    key: 'member',
    label: '會員管理',
    icon: 'ri-team-line'
  }, {
    key: 'class',
    label: '課程排程',
    icon: 'ri-calendar-line'
  }, {
    key: 'coach',
    label: '教練管理',
    icon: 'ri-user-star-line'
  }, {
    key: 'finance',
    label: '財務報表',
    icon: 'ri-bar-chart-2-line'
  }, {
    key: 'settings',
    label: '系統設定',
    icon: 'ri-settings-3-line'
  }];
  const siderW = collapsed ? 'var(--layout-sider-collapsed-width)' : 'var(--layout-sider-width)';
  const headerH = 64;
  return React.createElement('div', {
    style: {
      display: 'flex',
      height: '100vh',
      background: 'var(--bg-layout)',
      fontFamily: 'var(--font-family)',
      overflow: 'hidden'
    }
  }, React.createElement('div', {
    style: {
      width: siderW,
      height: '100vh',
      background: 'var(--sider-bg)',
      borderRight: '1px solid var(--sider-border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'width .2s'
    }
  }, React.createElement('div', {
    style: {
      height: 'var(--layout-header-height)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: collapsed ? '0' : '0 20px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      flexShrink: 0
    }
  }, React.createElement('div', {
    style: {
      width: 28,
      height: 28,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--color-primary)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 14,
      flexShrink: 0
    }
  }, 'P'), !collapsed && React.createElement('span', {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: 'var(--text-primary)',
      whiteSpace: 'nowrap'
    }
  }, 'PulseFit')), React.createElement('div', {
    style: {
      flex: 1,
      overflow: 'hidden'
    }
  }, React.createElement(Menu, {
    items,
    activeKey: active,
    onChange: onNav,
    collapsed
  })), React.createElement('div', {
    onClick: () => setCollapsed(!collapsed),
    style: {
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderTop: '1px solid var(--border-secondary)',
      cursor: 'pointer',
      color: 'var(--text-tertiary)',
      flexShrink: 0
    }
  }, React.createElement('i', {
    className: collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line',
    style: {
      fontSize: 16
    }
  }))), React.createElement('div', {
    style: {
      flex: 1,
      position: 'relative',
      minWidth: 0,
      height: '100vh'
    }
  }, React.createElement('div', {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: headerH,
      background: scrolled ? 'rgba(255,255,255,0.45)' : 'var(--header-bg)',
      backdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(180%)' : 'none',
      boxShadow: scrolled ? 'var(--shadow-header)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      zIndex: 10,
      transition: 'background .25s, box-shadow .25s'
    }
  }, React.createElement(Input, {
    placeholder: '搜尋會員姓名或電話',
    prefix: React.createElement('i', {
      className: 'ri-search-line'
    }),
    style: {
      width: 280
    }
  }), React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20
    }
  }, React.createElement(Badge, {
    count: 3
  }, React.createElement('i', {
    className: 'ri-notification-line',
    style: {
      fontSize: 18,
      color: 'var(--text-secondary)'
    }
  })), React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer'
    }
  }, React.createElement(Avatar, {
    size: 28
  }, '王'), React.createElement('span', {
    style: {
      fontSize: 14,
      color: 'var(--text-primary)'
    }
  }, '王教練'), React.createElement('i', {
    className: 'ri-arrow-down-s-line',
    style: {
      color: 'var(--text-tertiary)'
    }
  })))), React.createElement('div', {
    onScroll: e => setScrolled(e.target.scrollTop > 4),
    style: {
      position: 'absolute',
      inset: 0,
      overflowY: 'auto',
      padding: `calc(${headerH}px + var(--layout-content-padding)) var(--layout-content-padding) var(--layout-content-padding)`
    }
  }, children)));
}
window.PulseFitUIKit = Object.assign(window.PulseFitUIKit || {}, {
  DashboardLayout
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/DashboardLayout.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/doc-page.js
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
// Copied omelette starter. Re-running copy_starter_component with this kind overwrites this file with the latest version (page content is unaffected).
/* BEGIN USAGE */
/**
 * <doc-page> — paged-document shell for printable HTML.
 *
 * FIRST, decide how the document paginates — up front, before building:
 *
 * - FLOWING document (the default): write the whole document as one
 *   normal HTML flow inside <doc-page>; the browser's print engine
 *   splits it onto pages at export. Use for long-form documents with a
 *   single text flow: reports, memos, letters, essays.
 * - EXPLICIT pagination: a fixed set of pre-paginated pages, one
 *   <section class="page"> child per page. Use when the user asks for a
 *   specific page count, or the design implies one: a one-page resume, a
 *   two-sided flier, a poster, a certificate, a brochure — any richly
 *   laid-out document without a single text flow.
 * - If in doubt, ask the user as part of the build.
 *
 * PAGE SIZING — paper differs by country (letter vs A4), so the printed
 * sheet is not one fixed truth:
 * - FLOWING documents pin NO paper size: the print engine paginates
 *   onto the user's real paper, and the content reflows to it.
 * - EXPLICITLY PAGINATED documents print each page at a FIXED page box
 *   with overflow hidden — letter by default, size="a4" for a clearly
 *   metric user, the user's chosen paper when they export. Design each
 *   page to FILL that box, fitting letter and A4 alike without overlap.
 * - width/height pin an explicit fixed size, ONLY when the user gives
 *   one.
 * Never write your own @page rule or hard-code paper dimensions in the
 * content.
 *
 * Sizing modes (attributes):
 *   (none)                      — portrait: flowing docs use the user's
 *           paper; explicitly paginated pages use the named size box
 *           (letter unless size="a4")
 *   orientation="landscape"     — the same, landscape
 *   width / height              — explicit fixed size, ONLY when the user
 *           gives one (e.g. width="22in" height="30in" for a 22×30
 *           poster): the page IS the design's size, printed at true
 *           dimensions (or scaled onto the user's paper at print time).
 *           Any absolute CSS length: px/in/mm/cm/pt/pc.
 * The component announces the chosen mode to the host app at runtime (a
 * meta tag it injects), so the print path can inject the user's true
 * paper size.
 *
 * On screen the document renders on a desk background: a flowing
 * document as one tall scrolling sheet (Google Docs' pageless view);
 * explicitly paginated documents as one card per page.
 *
 * EXPLICIT pagination usage:
 *   <style>doc-page:not(:defined){visibility:hidden}</style>
 *   <doc-page>
 *     <section class="page" id="p1">…one page's design…</section>
 *     <section class="page" id="p2">…</section>
 *   </doc-page>
 *   <script src="doc-page.js"></script>
 * How the page box works, concretely: each .page prints as ONE full-bleed
 * sheet at a FIXED physical size — letter by default (set size="a4" for
 * a clearly metric user), the user's chosen paper when they export —
 * with overflow hidden. Nothing scrolls and nothing reflows onto a next
 * sheet: content that misses the box is CLIPPED. Design each page to
 * FILL that page box, and to fit it — letter and A4 alike — without
 * overlap. Each page is a size container; don't size anything in
 * viewport units (they track the window, not the page), and never set
 * width or height on the .page section itself (the component sizes the
 * page box; an authored height like 100% is meaningless at print and is
 * overridden). The component owns the page box, the screen card chrome,
 * and the page breaks (never add your own break-before/after). Don't mix
 * .page sections with flowing content or header/footer slots in the same
 * document.
 *
 * FLOWING usage:
 *   <style>doc-page:not(:defined){visibility:hidden}</style>
 *   <doc-page margin="0.75in">
 *     <h1>Title</h1>
 *     <p>…body…</p>
 *   </doc-page>
 *   <script src="doc-page.js"></script>
 * There is no manual page-splitting — the browser's print engine
 * paginates at export. Standard break-hygiene rules (`break-inside:
 * avoid` on figures, code blocks, images and table rows; `orphans/
 * widows: 3`) are applied so paragraphs and groups split cleanly. On
 * screen and at print, headings default to `text-wrap: balance` and
 * body text to `text-wrap: pretty`; the defaults have zero specificity,
 * so any text-wrap you declare wins.
 *
 * Other attributes:
 *   size    — letter | a4 | legal (default letter). Flowing documents:
 *           preview proportion only — it does NOT pin their printed
 *           paper (the print dialog's paper governs); leave it alone
 *           there. Explicitly paginated documents: it sets the page box
 *           the cards and the pinned @page share (the export dialog's
 *           choice overrides both at print) — set size="a4" for a
 *           clearly metric user. Scaled-fit: names the sheet the fit is
 *           computed against, same a4-for-metric-users advice.
 *   content-width / content-height — the design's own fixed dimensions
 *           (CSS lengths), for scaling a fixed-size design ONTO the
 *           named sheet: content lays out at exactly this size, and the
 *           component scales it to fit that sheet's printable area
 *           (centered horizontally, top-aligned; the export dialog
 *           re-fits to the user's actual paper choice where available).
 *           Both must be set; they do not change the page box. For pages
 *           WITHOUT running header/footer slots.
 *   margin  — printable inset on every page of a FLOWING document
 *           (default 0.75in); margin="0" makes pages full-bleed.
 *           Explicitly paginated pages are always full-bleed.
 *
 * Running header/footer (flowing documents only): give an element
 * `slot="header"` or `slot="footer"` and it repeats on every printed
 * page via `position: fixed`. To keep body text from sliding under it,
 * the component prints inside a single-cell table whose <thead>/<tfoot>
 * are spacers sized to the header/footer height — browsers repeat
 * thead/tfoot on every page, so each sheet's content starts below the
 * header and ends above the footer. On screen the header/footer render
 * once at the top/bottom of the sheet.
 *
 * At print the component injects `@page { margin: 0 }` (which leaves
 * Chrome no margin box to draw its date/URL/page-count header in) and
 * moves the visual margin onto the sheet's own padding. It also marks
 * the document as owning its print CSS (a
 * `meta[name="omelette-owns-print"]` it injects at runtime), so the
 * PDF export never injects page-geometry CSS of its own on top.
 *
 * Print best practices for the content you author:
 * - Multi-column text: use CSS columns (`column-count` +
 *   `column-gap`), never side-by-side flex/grid columns — only real
 *   CSS columns flow and break across pages. `column-span: all` lets
 *   a heading span the columns; `hyphens: auto` (needs `lang` on
 *   the html element) keeps narrow columns readable.
 * - Page breaks in flowing documents: `break-before: page` on an
 *   element that must start a new page (a chapter, an appendix). Add
 *   your own kept-together blocks (callouts, stat tiles, cards) to a
 *   `break-inside: avoid` rule, and keep each one shorter than a page.
 * - Extend `orphans: 3; widows: 3` to any custom text blocks you add
 *   (p and li are covered by default).
 * - Give long tables a <thead> — browsers repeat it on every printed
 *   page.
 * - No `position: fixed`/`sticky` and no viewport units in content:
 *   fixed elements stamp every printed page (running headers/footers go
 *   in the component's slots) and `100vh` mis-sizes at print.
 *
 * Author content as static HTML so the user can click-to-edit any text
 * directly. Do not set width/padding/background on the document body —
 * the component owns the sheet box.
 */
/* END USAGE */

(() => {
  const PAPER = {
    letter: ['8.5in', '11in'],
    a4: ['210mm', '297mm'],
    legal: ['8.5in', '14in']
  };
  const CSS_LENGTH = /^\d+(\.\d+)?(px|in|mm|cm|pt|pc)$/;
  // Unitless "0" is a valid CSS length and the natural way to write
  // margin="0"; normalise it to 0px so max()/calc() (which reject a bare
  // number) keep working.
  const safeLen = (v, fb) => {
    v = (v || '').trim();
    return v === '0' ? '0px' : CSS_LENGTH.test(v) ? v : fb;
  };
  // WebKit (Safari and every iOS browser shell) never repeats a table's
  // thead/tfoot on printed pages (WebKit bug 17205), so the spacer-borne
  // vertical margins of a FLOWING document reach only the first page
  // there. Engine check, not browser check: vendor is 'Apple Computer,
  // Inc.' exactly for WebKit and 'Google Inc.' for Blink.
  const WK_PRINT = /apple/i.test(navigator.vendor || '');
  // CSS length → px number (CSS absolute units are exact: 1in = 96px).
  // Returns NaN for anything safeLen would reject — callers gate on it.
  const PX_PER = {
    px: 1,
    in: 96,
    mm: 96 / 25.4,
    cm: 96 / 2.54,
    pt: 96 / 72,
    pc: 16
  };
  const toPx = v => {
    const m = /^(\d+(?:\.\d+)?)(px|in|mm|cm|pt|pc)$/.exec((v || '').trim());
    return m ? parseFloat(m[1]) * PX_PER[m[2]] : NaN;
  };
  const stylesheet = `
    :host {
      position: relative;
      display: block;
      /* When the viewport is narrower than the page, grow to wrap the
       * sheet (plus this padding) instead of staying viewport-width, so
       * the desk background and right margin reach the sheet's far edge
       * in the horizontal scroll. */
      min-width: max-content;
      min-height: 100vh;
      background: #f5f5f4;
      padding: 48px 24px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      --doc-page-w: 8.5in;
      --doc-page-h: 11in;
      --doc-page-margin: 0.75in;
      --doc-hdr-h: 0px;
      --doc-ftr-h: 0px;
      --doc-hdr-pad: 0px;
      --doc-ftr-pad: 0px;
    }
    .sheet {
      width: var(--doc-page-w);
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 2px 10px rgba(20, 20, 19, 0.12);
      border-radius: 7px;
      box-sizing: border-box;
      padding: var(--doc-page-margin);
    }
    .frame { width: 100%; border-collapse: collapse; }
    /* Scaled-fit mode (content-width/content-height): the inner .fit box
     * lays the content out at its authored fixed size and scales it onto
     * the printable area; .fit-box reserves the scaled footprint in flow
     * (transforms don't affect layout) and centers it. Without the mode,
     * both divs are unstyled block pass-throughs. */
    /* Explicit pagination: direct .page children are the pages. The sheet
     * becomes a transparent stack and each page carries the card look on
     * screen; at print each page is exactly one full-bleed sheet. The
     * ::slotted defaults are deliberately weak (document CSS wins), so
     * authored page styling can override any of this. */
    .sheet.paginated {
      background: transparent;
      box-shadow: none;
      border-radius: 0;
      padding: 0;
    }
    .paginated ::slotted(.page) {
      position: relative;
      display: block;
      width: 100%;
      aspect-ratio: var(--doc-page-ar);
      container-type: size;
      overflow: hidden;
      box-sizing: border-box;
      background: #fff;
      border-radius: 7px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
      break-inside: avoid;
    }
    .paginated ::slotted(.page:not(:first-child)) { margin-top: 1rem; }
    @media print {
      .sheet.paginated { padding: 0; }
      /* The flowing-document vertical inset lives on the repeating
       * thead/tfoot spacers, not the sheet padding — they must go too,
       * or each full-sheet .page is pushed ~margin down and spills onto
       * a second sheet. Paginated pages are full-bleed by definition
       * (content owns its insets). */
      .sheet.paginated .hdr-space,
      .sheet.paginated .ftr-space { height: 0; }
      .paginated ::slotted(.page) {
        border-radius: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
        /* Physical page-box sizing, no viewport units: Safari resolves
         * 100vh against the window, not the page box, so a vh-sized card
         * paginates wrong there. --doc-page-w/h are the named size by
         * default and are overridden to the user's chosen paper by the
         * export path, so every card is exactly one sheet either way.
         * Width + height (same source values as @page size) rather than
         * width + aspect-ratio: the ratio is a 6-decimal rounding of the
         * same division, and a few millionths of overflow would spill a
         * blank sheet after every page. The screen-only aspect-ratio
         * (preview proportions) must not leak into print. cqh typography
         * tracks the same box.
         *
         * Every declaration is !important: per CSS Scoping, unimportant
         * shadow ::slotted rules LOSE to the document context, so a page
         * section's authored inline style would silently beat this print
         * geometry. A model-authored height:100% did exactly that — the
         * percentage resolves as auto in the all-auto print ancestry, the
         * base rule's size containment turns auto into ZERO, and
         * overflow:hidden then paints nothing: a blank PDF with perfect
         * page boxes. At print the component's geometry is the design's
         * whole contract, so it must win over any authored sizing. */
        aspect-ratio: auto !important;
        width: var(--doc-page-w) !important;
        height: var(--doc-page-h) !important;
        overflow: hidden !important;
      }
      .paginated ::slotted(.page:not(:first-child)) {
        break-before: page !important;
        margin-top: 0 !important;
      }
    }
    .fit-mode .fit-box {
      width: calc(var(--doc-fit-w) * var(--doc-fit-scale));
      height: calc(var(--doc-fit-h) * var(--doc-fit-scale));
      margin: 0 auto;
      break-inside: avoid;
    }
    .fit-mode .fit {
      width: var(--doc-fit-w);
      height: var(--doc-fit-h);
      transform: scale(var(--doc-fit-scale));
      transform-origin: top left;
    }
    .frame td, .frame th { padding: 0; text-align: left; font-weight: inherit; }
    .hdr-space { height: var(--doc-hdr-h); }
    .ftr-space { height: var(--doc-ftr-h); }
    ::slotted([slot="header"]),
    ::slotted([slot="footer"]) { display: block; box-sizing: border-box; }
    @media print {
      :host { background: none; padding: 0; min-width: 0; min-height: 0; }
      .sheet {
        width: auto; margin: 0; box-shadow: none; border-radius: 0;
        padding: 0 var(--doc-page-margin);
      }
      /* The thead/tfoot spacers repeat on every page, so they carry the
       * vertical page margin (which the sheet's own padding cannot, since
       * that padding is consumed once on the first/last page). The running
       * header/footer are fixed inside that band. */
      /* The 0.35in is breathing room between a running header/footer and
       * the body; without one the spacer is exactly the page margin, so a
       * margin="0" full-bleed document gets truly full-bleed pages. */
      .hdr-space { height: max(var(--doc-page-margin), calc(var(--doc-hdr-h) + var(--doc-hdr-pad))); }
      .ftr-space { height: max(var(--doc-page-margin), calc(var(--doc-ftr-h) + var(--doc-ftr-pad))); }
      /* WebKit flowing documents: @page carries the vertical margin (see
       * _syncPrintPageRule), so the spacers keep only whatever a running
       * header/footer needs BEYOND it — page 1 would otherwise double its
       * top inset. Paginated sheets already zero their spacers above. */
      .sheet.wk-print:not(.paginated) .hdr-space { height: max(0px, calc(max(var(--doc-page-margin), calc(var(--doc-hdr-h) + var(--doc-hdr-pad))) - var(--doc-page-margin))); }
      .sheet.wk-print:not(.paginated) .ftr-space { height: max(0px, calc(max(var(--doc-page-margin), calc(var(--doc-ftr-h) + var(--doc-ftr-pad))) - var(--doc-page-margin))); }
      ::slotted([slot="header"]) {
        position: fixed; top: 0; left: 0; right: 0; margin: 0;
        padding: calc(var(--doc-page-margin) * 0.45) var(--doc-page-margin) 0;
      }
      ::slotted([slot="footer"]) {
        position: fixed; bottom: 0; left: 0; right: 0; margin: 0;
        padding: 0 var(--doc-page-margin) calc(var(--doc-page-margin) * 0.45);
      }
    }
  `;
  class DocPage extends HTMLElement {
    static get observedAttributes() {
      return ['size', 'width', 'height', 'margin', 'orientation', 'content-width', 'content-height'];
    }
    constructor() {
      super();
      this._root = this.attachShadow({
        mode: 'open'
      });
      this._mo = typeof MutationObserver === 'function' ? new MutationObserver(() => this._scheduleMeasure()) : null;
    }

    /** The named paper's [w, h], swapped when orientation="landscape".
     *  Only the named size swaps — explicit width/height are exact values
     *  the author already oriented. */
    _paperSize() {
      const named = PAPER[(this.getAttribute('size') || '').toLowerCase()] || PAPER.letter;
      const landscape = (this.getAttribute('orientation') || '').trim().toLowerCase() === 'landscape';
      return landscape ? [named[1], named[0]] : named;
    }
    get pageWidth() {
      return safeLen(this.getAttribute('width'), this._paperSize()[0]);
    }
    get pageHeight() {
      return safeLen(this.getAttribute('height'), this._paperSize()[1]);
    }
    get pageMargin() {
      return safeLen(this.getAttribute('margin'), '0.75in');
    }

    /** Scaled-fit mode's content box [w, h] as CSS lengths, or null when
     *  the mode is off (either attribute missing/invalid/zero — a partial
     *  declaration falls back to normal flow rather than guessing). */
    _contentFit() {
      const w = safeLen(this.getAttribute('content-width'), null);
      const h = safeLen(this.getAttribute('content-height'), null);
      if (!w || !h) return null;
      const wPx = toPx(w),
        hPx = toPx(h);
      return wPx > 0 && hPx > 0 ? [w, h, wPx, hPx] : null;
    }
    connectedCallback() {
      if (!this._sheet) this._render();
      this._syncSize();
      this._syncPrintPageRule();
      this._ensureTextWrapDefaults();
      this._ensureOwnsPrintMeta();
      this._syncFixedSizeMeta();
      this._syncPrintSizingMeta();
      if (this._mo) this._mo.observe(this, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
      });
      this._onResize = () => this._scheduleMeasure();
      window.addEventListener('resize', this._onResize);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this._scheduleMeasure());
      }
      this._scheduleMeasure();
    }
    disconnectedCallback() {
      window.removeEventListener('resize', this._onResize);
      if (this._mo) this._mo.disconnect();
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = null;
      }
      // Drop the head rules when the last doc-page leaves, so a deleted
      // document's @page geometry and text-wrap defaults can't apply to
      // whatever replaces it.
      const survivor = document.querySelector('doc-page');
      if (!survivor) {
        ['doc-page-print', 'doc-page-text-wrap', 'doc-page-owns-print', 'doc-page-fixed-size', 'doc-page-print-sizing'].forEach(id => {
          const tag = document.getElementById(id);
          if (tag) tag.remove();
        });
        // A live deck-stage deferred its own print-sizing meta to ours —
        // hand the page-global meta over so the deck isn't left unmarked.
        const deck = document.querySelector('deck-stage');
        if (deck && typeof deck._ensurePrintSizingMeta === 'function') {
          deck._ensurePrintSizingMeta();
        }
      } else {
        // A departed owner hands each page-global meta to whatever
        // doc-page remains (or it's removed).
        if (typeof survivor._syncFixedSizeMeta === 'function') {
          survivor._syncFixedSizeMeta();
        }
        if (typeof survivor._syncPrintSizingMeta === 'function') {
          survivor._syncPrintSizingMeta();
        }
      }
    }
    attributeChangedCallback() {
      if (!this._sheet) return;
      this._syncSize();
      this._syncPrintPageRule();
      this._syncFixedSizeMeta();
      this._syncPrintSizingMeta();
      this._scheduleMeasure();
    }
    _render() {
      this._root.innerHTML = `
        <style>${stylesheet}</style>
        <style id="vars"></style>
        <div class="sheet" data-screen-label="Document">
          <table class="frame" role="presentation">
            <thead><tr><th><div class="hdr-space"><slot name="header"></slot></div></th></tr></thead>
            <tbody><tr><td class="body"><div class="fit-box"><div class="fit"><slot></slot></div></div></td></tr></tbody>
            <tfoot><tr><td><div class="ftr-space"><slot name="footer"></slot></div></td></tr></tfoot>
          </table>
        </div>`;
      this._sheet = this._root.querySelector('.sheet');
      this._vars = this._root.getElementById('vars');
    }

    /** Runtime sizing lives in a shadow <style> :host rule, never on the
     *  light-DOM host element, so serialize-persist can't write it back. */
    _syncSize(hdrH, ftrH) {
      // Scaled-fit mode: content at its authored size, scaled onto the
      // printable area (page minus margins on both axes). The factor is a
      // plain number var so calc(length * number) stays valid; 4 decimals
      // keeps the shadow style stable across re-measures. Upscaling is
      // allowed — print transforms are vector, so text and CSS stay crisp
      // (raster images soften, which the catalog bullet warns about).
      const fit = this._contentFit();
      let fitVars = '';
      if (fit) {
        const marginPx = toPx(this.pageMargin) || 0;
        const availW = toPx(this.pageWidth) - 2 * marginPx;
        const availH = toPx(this.pageHeight) - 2 * marginPx;
        const scale = Math.min(availW / fit[2], availH / fit[3]);
        if (scale > 0 && Number.isFinite(scale)) {
          fitVars = '--doc-fit-w:' + fit[0] + ';' + '--doc-fit-h:' + fit[1] + ';' + '--doc-fit-scale:' + scale.toFixed(4) + ';';
        }
      }
      this._sheet.classList.toggle('fit-mode', !!fitVars);
      // Numeric w/h ratio for the paginated page cards' aspect-ratio —
      // aspect-ratio takes a number, not a length ratio, so compute it
      // here (CSS length division isn't portable). 6 decimals keeps the
      // shadow style stable across re-syncs.
      const arW = toPx(this.pageWidth);
      const arH = toPx(this.pageHeight);
      const ar = arW > 0 && arH > 0 ? (arW / arH).toFixed(6) : '0.772727';
      this._vars.textContent = ':host{' + fitVars + '--doc-page-ar:' + ar + ';' + '--doc-page-w:' + this.pageWidth + ';' + '--doc-page-h:' + this.pageHeight + ';' + '--doc-page-margin:' + this.pageMargin + ';' + '--doc-hdr-h:' + (hdrH || 0) + 'px;' + '--doc-ftr-h:' + (ftrH || 0) + 'px;' + '--doc-hdr-pad:' + (hdrH ? '0.35in' : '0px') + ';' + '--doc-ftr-pad:' + (ftrH ? '0.35in' : '0px') + '}';
    }

    /** @page is a no-op inside shadow DOM, so the rule lives in <head>.
     *  Re-appended on every sync so it stays last in source order — the
     *  @page cascade is source-order per descriptor, so this rule wins
     *  over any other @page rule in the document.
     *
     *  The @page SIZE is pinned where the page box IS part of the design:
     *  explicit-fixed-size mode (width + height authored), scaled-fit
     *  mode (the named sheet the fit targets), and explicit pagination
     *  (the named size the cards share — so card and sheet agree on
     *  every print path, and the export path's chosen paper overrides
     *  BOTH with one later rule). For FLOWING documents no paper size is
     *  emitted at all — the true size comes from the user's preference,
     *  injected by the export path or chosen in the print dialog — so a
     *  flowing document never fights the paper it lands on.
     *  margin: 0 is emitted in every mode: it leaves Chrome no margin box
     *  to draw its date/URL/page-count header in, and the visual margin
     *  lives on the sheet's own padding. */
    _syncPrintPageRule() {
      const id = 'doc-page-print';
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
      }
      document.head.appendChild(tag);
      // Three print-geometry regimes:
      // - true-size: the page IS the design — pin its exact size.
      // - scaled-fit (content-width/height): the fit factor is computed
      //   against the NAMED paper's printable area, so that paper must
      //   stay pinned or the scaled content overflows a smaller sheet
      //   (the export path re-fits and re-pins at print time on top).
      // - default modes: no paper size — but landscape still needs the
      //   paper-agnostic 'size: landscape' keyword, because the size
      //   descriptor is what carries orientation; without it a landscape
      //   document prints portrait whenever nothing injects a size.
      const landscape = (this.getAttribute('orientation') || '').trim().toLowerCase() === 'landscape';
      // Explicit pagination pins the page box to the SAME values that
      // size the cards (the named size by default, the export path's
      // chosen paper when its later rule overrides both) — card and
      // sheet agree on every print path, and a mismatched real paper
      // shrinks-to-fit in the dialog instead of clipping a Letter card
      // on A4. Declared before the paginated read below so both derive
      // from one check.
      const paginatedNow = this.querySelector(':scope > .page') !== null;
      const sizeDescriptor = this._trueSizePx() ? 'size: ' + this.pageWidth + ' ' + this.pageHeight + '; ' : this._contentFit() ? 'size: ' + this.pageWidth + ' ' + this.pageHeight + '; ' : paginatedNow ? 'size: ' + this.pageWidth + ' ' + this.pageHeight + '; ' : landscape ? 'size: landscape; ' : '';
      // WebKit never repeats the thead/tfoot spacers that carry a flowing
      // document's vertical page margins (see WK_PRINT above), so pages
      // after the first print edge-to-edge there. Carry the VERTICAL
      // margins on @page for WebKit instead, and the shadow print CSS
      // trims the first-page spacers by the same amount (.sheet.wk-print
      // rules). Horizontal inset stays on the sheet's own padding in
      // every engine. Blink keeps margin: 0 (a nonzero margin there
      // re-opens the box Chrome draws its header furniture in). One cost,
      // learned in testing: Safari's own date/URL headers are a USER
      // dialog setting ("Print headers and footers") that renders in the
      // margin area when room exists — margin: 0 only suppressed it by
      // leaving no room, and no CSS controls it. The export dialog's
      // Safari guide teaches turning the setting off for flowing
      // documents. Explicitly paginated and fixed-size documents keep
      // margin: 0 everywhere: their pages ARE the sheet.
      const wkFlowing = WK_PRINT && !paginatedNow && !this._trueSizePx() && !this._contentFit();
      const marginDescriptor = wkFlowing ? 'margin: ' + this.pageMargin + ' 0; ' : 'margin: 0; ';
      // Shadow-internal marker (never serialized), kept in lockstep with
      // the @page decision above: the print CSS trims the first-page
      // spacers ONLY while @page actually carries the margins — a
      // true-size or scaled-fit sheet keeps margin: 0 and must keep its
      // spacers too. Re-synced here so attribute changes and pagination
      // flips move both together.
      if (this._sheet) this._sheet.classList.toggle('wk-print', wkFlowing);
      tag.textContent = '@page { ' + sizeDescriptor + marginDescriptor + '} ' + '@media print { html, body { margin: 0 !important; padding: 0 !important; background: none !important; height: auto !important; overflow: visible !important; } ' + 'h1,h2,h3,h4,h5,h6 { break-after: avoid; } ' + 'figure,pre,blockquote,img,svg,tr { break-inside: avoid; } ' + 'p,li { orphans: 3; widows: 3; } ' + '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; ' + 'backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } ' + '*, *::before, *::after { animation-delay: -99s !important; animation-duration: .001s !important; ' + 'animation-iteration-count: 1 !important; animation-fill-mode: both !important; ' + 'animation-play-state: running !important; transition-duration: 0s !important; } }';
    }

    /** Typographic defaults for document text: balance headings, avoid
     *  widowed/orphaned words in body copy (browsers without text-wrap
     *  support drop the declarations). Zero-specificity via :where() so
     *  any text-wrap authored on those elements wins; document-level so the
     *  rules reach the slotted (light DOM) content — shadow styles can't.
     *  data-omelette-injected marks the tag for the host editor to strip
     *  at serialize, so it is never written back as authored source. */
    _ensureTextWrapDefaults() {
      if (document.getElementById('doc-page-text-wrap')) return;
      const tag = document.createElement('style');
      tag.id = 'doc-page-text-wrap';
      tag.setAttribute('data-omelette-injected', '');
      tag.textContent = ':where(h1,h2,h3,h4,h5,h6){text-wrap:balance}' + ':where(p,li,blockquote,figcaption){text-wrap:pretty}';
      document.head.appendChild(tag);
    }

    /** Declares that this document owns its print CSS. The instant-PDF
     *  export checks for the meta by NAME PRESENCE alone (content is
     *  ignored) and skips its automatic print-CSS injections, so the
     *  component's @page geometry is never overridden by a heuristic.
     *  data-omelette-injected keeps it out of serialized source. */
    _ensureOwnsPrintMeta() {
      if (document.getElementById('doc-page-owns-print')) return;
      const tag = document.createElement('meta');
      tag.id = 'doc-page-owns-print';
      tag.name = 'omelette-owns-print';
      tag.content = 'true';
      tag.setAttribute('data-omelette-injected', '');
      document.head.appendChild(tag);
    }

    /** This page's valid true-size page box (explicit width AND height)
     *  as [w, h] px ints, or null when the mode is off. */
    _trueSizePx() {
      if (!safeLen(this.getAttribute('width'), null) || !safeLen(this.getAttribute('height'), null)) return null;
      const w = Math.round(toPx(this.pageWidth));
      const h = Math.round(toPx(this.pageHeight));
      return w > 0 && h > 0 ? [w, h] : null;
    }

    /** True-size pages (explicit width AND height) also declare the page
     *  box as the preview size: the in-app preview reads
     *  meta[name="omelette-fixed-size"] (content "W,H" in px ints) and
     *  scales the sheet into view — without it an 18in poster previews at
     *  true size with scrollbars. Never overrides an author-set meta
     *  (only the component's own id is managed). The meta is page-global
     *  while doc-page instances are not, so every sync recomputes the
     *  page-wide owner — the first connected true-size doc-page — and a
     *  non-true-size sibling's sync can never delete the owner's meta.
     *  Removed when no true-size page remains (the owner's disconnect
     *  re-syncs via any survivor) or when an author-set meta exists. */
    _syncFixedSizeMeta() {
      const id = 'doc-page-fixed-size';
      const own = document.getElementById(id);
      const authored = document.querySelector('meta[name="omelette-fixed-size"]:not([data-omelette-injected])');
      // The page-wide owner, not this instance: an upgraded true-size page
      // anywhere in the document keeps the meta alive and sized.
      let box = null;
      for (const el of document.querySelectorAll('doc-page')) {
        box = typeof el._trueSizePx === 'function' ? el._trueSizePx() : null;
        if (box) break;
      }
      if (!box || authored) {
        if (own) own.remove();
        return;
      }
      const tag = own || document.createElement('meta');
      tag.id = id;
      tag.name = 'omelette-fixed-size';
      tag.content = box[0] + ',' + box[1];
      tag.setAttribute('data-omelette-injected', '');
      if (!own) document.head.appendChild(tag);
    }

    /** This page's print-sizing mode: 'fixed' when an explicit width AND
     *  height are authored (the page is the design's own size), else the
     *  default paper in the authored orientation. */
    _printSizingMode() {
      if (this._trueSizePx()) return 'fixed';
      const landscape = (this.getAttribute('orientation') || '').trim().toLowerCase() === 'landscape';
      return landscape ? 'default-landscape' : 'default-portrait';
    }

    /** Announces the print-sizing mode to the host app:
     *  meta[name="omelette-print-sizing"] with content 'default-portrait',
     *  'default-landscape', or 'fixed' (fixed pages also carry the
     *  omelette-fixed-size meta with the page box in px). The export path
     *  probes it to decide what true paper size to inject at print time —
     *  in the default modes the component emits no paper size of its own.
     *  Same page-global ownership rules as the fixed-size meta above:
     *  first connected doc-page owns it, an authored meta is never
     *  overridden, removed when no doc-page remains. */
    _syncPrintSizingMeta() {
      const id = 'doc-page-print-sizing';
      const own = document.getElementById(id);
      const authored = document.querySelector('meta[name="omelette-print-sizing"]:not([data-omelette-injected])');
      // A fixed page wins outright (mirroring the fixed-size loop above,
      // so the two metas can never contradict each other in a mixed
      // multi-page document); otherwise the first page's mode holds.
      let mode = null;
      for (const el of document.querySelectorAll('doc-page')) {
        if (typeof el._printSizingMode !== 'function') continue;
        const m = el._printSizingMode();
        if (m === 'fixed') {
          mode = m;
          break;
        }
        if (mode === null) mode = m;
      }
      if (!mode || authored) {
        if (own) own.remove();
        return;
      }
      // A deck-stage that connected first injected its own meta and
      // defers to any existing one — take it over, or the document ends
      // up with two conflicting injected metas (a doc-page page is the
      // document; the deck re-ensures its meta if every doc-page leaves).
      const deckMeta = document.getElementById('deck-stage-print-sizing');
      if (deckMeta) deckMeta.remove();
      const tag = own || document.createElement('meta');
      tag.id = id;
      tag.name = 'omelette-print-sizing';
      tag.content = mode;
      tag.setAttribute('data-omelette-injected', '');
      if (!own) document.head.appendChild(tag);
    }
    _scheduleMeasure() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = null;
        this._measure();
      });
    }

    /** Slot heights feed the print spacers (--doc-hdr-h / --doc-ftr-h), so
     *  they re-measure on content mutation, resize, and font load. The
     *  same pass detects explicit pagination (direct .page children) and
     *  toggles the sheet between the flowing-document card and the
     *  page-per-card stack — content edits can add or remove pages at any
     *  time, so this tracks the same mutations the measurement does. */
    _measure() {
      const hdr = this.querySelector(':scope > [slot="header"]');
      const ftr = this.querySelector(':scope > [slot="footer"]');
      const wasPaginated = this._sheet.classList.contains('paginated');
      this._sheet.classList.toggle('paginated', this.querySelector(':scope > .page') !== null);
      // The WebKit @page margin is flowing-only, so a pagination flip
      // must re-emit the rule (content edits can add or remove .page
      // sections at any time).
      if (this._sheet.classList.contains('paginated') !== wasPaginated) {
        this._syncPrintPageRule();
      }
      this._syncSize(hdr ? hdr.offsetHeight : 0, ftr ? ftr.offsetHeight : 0);
    }
  }
  if (!customElements.get('doc-page')) {
    customElements.define('doc-page', DocPage);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/doc-page.js", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/tweaks-panel.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
// Copied omelette starter. Re-running copy_starter_component with this kind overwrites this file with the latest version (page content is unaffected).

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // data-om-starter: inert presence marker — Claude Design's starter-usage
  // probe reads it. The closed panel renders nothing, so the marker rides
  // the <html> element as an attribute instead of a rendered node — zero
  // elements added, so page CSS (even structural selectors like
  // :nth-child) can never observe it. It records that the page WIRES a
  // tweaks panel, whether or not the panel is open. Keep this effect.
  React.useEffect(() => {
    document.documentElement.setAttribute('data-om-starter', 'tweaks-panel');
    return () => document.documentElement.removeAttribute('data-om-starter');
  }, []);
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/tweaks-panel.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Progress = __ds_scope.Progress;

__ds_ns.Statistic = __ds_scope.Statistic;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Breadcrumb = __ds_scope.Breadcrumb;

__ds_ns.Menu = __ds_scope.Menu;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.StatusTag = __ds_scope.StatusTag;

__ds_ns.SlotPicker = __ds_scope.SlotPicker;

__ds_ns.AppLayout = __ds_scope.AppLayout;

})();
