(function () {
  var KEYS = [
    'emoji', 'weddingOpening', 'kicker', 'introDescription', 'hostNames', 'names',
    'date', 'venue', 'message', 'info', 'etiquette', 'relatedEvent', 'contractPhoto',
    'countdown', 'calendar'
  ];
  var LABELS = {
    emoji: 'Invitation icon',
    weddingOpening: 'Wedding opening',
    kicker: 'Invitation intro',
    introDescription: 'Intro description',
    hostNames: 'Hosts',
    names: 'Names',
    date: 'Date and time',
    venue: 'Venue',
    message: 'Message',
    info: 'Extra details',
    etiquette: 'Guest etiquette',
    relatedEvent: 'Related gathering',
    contractPhoto: 'Photo caption',
    countdown: 'Countdown',
    calendar: 'Calendar link'
  };
  var FONTS = {
    serif: '"Cormorant Garamond", Georgia, serif',
    sans: 'Karla, system-ui, sans-serif',
    cursive: 'cursive',
    system: 'system-ui, sans-serif'
  };
  var TYPOGRAPHY_PRESETS = {
    elegant: 'serif',
    classic: 'system',
    modern: 'sans'
  };
  var SIZES = ['0.85rem', '1rem', '1.2rem', '1.5rem', '2rem', '2.5rem'];
  var ALIGNMENTS = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' }
  ];
  var COLORS = ['accent', 'gold', 'rose', 'emerald', 'white', 'ink'];
  function order(event) {
    var saved = Array.isArray(event.layout) ? event.layout : [];
    var result = saved.filter(function (key, index) {
      return KEYS.includes(key) && saved.indexOf(key) === index;
    });
    KEYS.forEach(function (key) {
      if (!result.includes(key)) result.push(key);
    });
    return result;
  }

  function style(event, key) {
    var saved = event.layoutStyles && event.layoutStyles[key];
    if (!saved || typeof saved !== 'object') return {};
    return {
      font: Object.prototype.hasOwnProperty.call(FONTS, saved.font) ? saved.font : '',
      size: SIZES.includes(saved.size) ? saved.size : '',
      align: ALIGNMENTS.some(function (item) { return item.value === saved.align; }) ? saved.align : '',
      color: COLORS.includes(saved.color) ? saved.color : ''
    };
  }

  function typography(event) {
    var preset = event && Object.prototype.hasOwnProperty.call(TYPOGRAPHY_PRESETS, event.typography)
      ? TYPOGRAPHY_PRESETS[event.typography]
      : null;
    return preset ? FONTS[preset] : '';
  }

  function color(value, accent, ink) {
    return {
      accent: accent,
      gold: '#d8b46a',
      rose: '#d86d8d',
      emerald: '#27815f',
      white: '#ffffff',
      ink: ink
    }[value] || '';
  }

  window.InvitationLayout = Object.freeze({
    keys: Object.freeze(KEYS),
    labels: Object.freeze(LABELS),
    fonts: Object.freeze(FONTS),
    typographyPresets: Object.freeze(TYPOGRAPHY_PRESETS),
    sizes: Object.freeze(SIZES),
    alignments: Object.freeze(ALIGNMENTS),
    colors: Object.freeze(COLORS),
    order: order,
    style: style,
    typography: typography,
    color: color
  });
})();
