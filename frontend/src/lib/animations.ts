import gsap from 'gsap';

/**
 * Animation utility following industry best practices
 * Based on Material Design motion principles and Apple HIG
 * 
 * Key principles:
 * 1. GPU-accelerated transforms only (x, y, scale, rotation, opacity)
 * 2. Natural easing curves (no linear animations)
 * 3. Staggered reveals for lists (0.03-0.08s between items)
 * 4. Micro-interactions respond within 100ms
 * 5. Page transitions complete within 300-500ms
 */

// Easing curves based on Material Design
export const easings = {
  // Standard curve for general movement
  standard: 'power2.inOut',
  // Deceleration curve for entering elements (most common for hover)
  decelerate: 'power2.out',
  // Acceleration curve for exiting elements  
  accelerate: 'power2.in',
  // For hover micro-interactions - fast and responsive
  hover: 'power1.out',
  // Emphasized curve for important animations only (modals, hero)
  emphasized: 'power3.out',
  // Smooth for micro-interactions
  smooth: 'power2.out',
  // Subtle spring for special effects only (success checkmarks etc)
  spring: 'back.out(1.1)',
} as const;

// Duration constants (in seconds) - Material Design standards
export const durations = {
  instant: 0.1,      // Button press (100ms)
  hover: 0.15,       // Hover micro-interactions (150ms)
  fast: 0.15,        // Small state changes (150ms)
  normal: 0.2,       // Standard transitions (200ms)
  medium: 0.25,      // Page element reveals (250ms)
  slow: 0.35,        // Complex animations (350ms)
  emphasis: 0.5,     // Hero animations (500ms)
} as const;

// Stagger configurations
export const staggers = {
  tight: 0.03,       // Quick succession (cards)
  normal: 0.05,      // Standard stagger
  relaxed: 0.08,     // More visible stagger
  dramatic: 0.12,    // For emphasis
} as const;

/**
 * Page enter animation - reveal cards/sections
 */
export function animatePageEnter(
  selector: string | Element | Element[] | NodeListOf<Element>,
  options: {
    stagger?: number;
    delay?: number;
    y?: number;
    duration?: number;
  } = {}
) {
  const { 
    stagger = staggers.normal, 
    delay = 0,
    y = 20,
    duration = durations.medium 
  } = options;

  return gsap.from(selector, {
    y,
    autoAlpha: 0,
    duration,
    stagger,
    delay,
    ease: easings.emphasized,
    force3D: true,
    clearProps: 'transform',
  });
}

/**
 * Page exit animation
 */
export function animatePageExit(
  selector: string | Element | Element[] | NodeListOf<Element>,
  options: {
    y?: number;
    duration?: number;
    onComplete?: () => void;
  } = {}
) {
  const { y = -20, duration = durations.normal, onComplete } = options;

  return gsap.to(selector, {
    y,
    autoAlpha: 0,
    duration,
    ease: easings.accelerate,
    force3D: true,
    onComplete,
  });
}

/**
 * Fade in animation
 */
export function animateFadeIn(
  selector: string | Element | Element[],
  options: {
    duration?: number;
    delay?: number;
    scale?: number;
  } = {}
) {
  const { duration = durations.normal, delay = 0, scale = 1 } = options;

  return gsap.from(selector, {
    autoAlpha: 0,
    scale: scale < 1 ? scale : 1,
    duration,
    delay,
    ease: easings.decelerate,
    force3D: true,
  });
}

/**
 * Button press micro-interaction (100ms, scale 0.98)
 */
export function animateButtonPress(element: Element | null) {
  if (!element) return;
  
  gsap.to(element, {
    scale: 0.98,
    duration: durations.instant,
    ease: easings.hover,
    force3D: true,
  });
}

/**
 * Button release micro-interaction (150ms, no bounce)
 */
export function animateButtonRelease(element: Element | null) {
  if (!element) return;
  
  gsap.to(element, {
    scale: 1,
    duration: durations.hover,
    ease: easings.hover,
    force3D: true,
    clearProps: 'transform',
  });
}

/**
 * Shake animation for errors
 */
export function animateShake(element: Element | null) {
  if (!element) return;
  
  const tl = gsap.timeline();
  
  tl.to(element, {
    x: -8,
    duration: 0.05,
    ease: easings.standard,
    force3D: true,
  })
  .to(element, {
    x: 8,
    duration: 0.05,
    ease: easings.standard,
  })
  .to(element, {
    x: -6,
    duration: 0.05,
    ease: easings.standard,
  })
  .to(element, {
    x: 6,
    duration: 0.05,
    ease: easings.standard,
  })
  .to(element, {
    x: -4,
    duration: 0.05,
    ease: easings.standard,
  })
  .to(element, {
    x: 4,
    duration: 0.05,
    ease: easings.standard,
  })
  .to(element, {
    x: 0,
    duration: 0.05,
    ease: easings.standard,
  });
  
  return tl;
}

/**
 * Pulse animation for attention
 */
export function animatePulse(element: Element | null, color: string = 'rgba(34, 211, 238, 0.5)') {
  if (!element) return;

  return gsap.fromTo(element,
    { boxShadow: `0 0 0 0 ${color}` },
    {
      boxShadow: `0 0 0 10px transparent`,
      duration: durations.slow,
      ease: easings.decelerate,
      repeat: 2,
    }
  );
}

/**
 * Counter animation for numbers
 */
export function animateCounter(
  element: Element | null,
  endValue: number,
  options: {
    duration?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    startValue?: number; // Allow custom start value
  } = {}
) {
  if (!element) return;

  const { duration = 1.5, prefix = '', suffix = '', decimals = 0, startValue } = options;
  
  // Get current value from element if startValue not provided
  let currentValue = startValue ?? 0;
  if (startValue === undefined) {
    const currentText = element.textContent || '0';
    const numMatch = currentText.match(/[\d.,]+/);
    if (numMatch) {
      currentValue = parseFloat(numMatch[0].replace(/,/g, ''));
    }
  }
  
  const obj = { value: currentValue };

  return gsap.to(obj, {
    value: endValue,
    duration,
    ease: easings.decelerate,
    onUpdate: () => {
      element.textContent = `${prefix}${obj.value.toFixed(decimals)}${suffix}`;
    },
    onComplete: () => {
      // Ensure final value is set and clear any GSAP-added inline styles
      element.textContent = `${prefix}${endValue.toFixed(decimals)}${suffix}`;
      gsap.set(element, { clearProps: 'all' });
    },
  });
}

/**
 * Hover effect (use with onMouseEnter/onMouseLeave)
 * Industry standard: 150ms, minimal movement, no bounce
 */
export function animateHoverIn(element: Element | null) {
  if (!element) return;
  
  gsap.to(element, {
    y: -2,
    duration: durations.hover,
    ease: easings.hover,
    force3D: true,
  });
}

export function animateHoverOut(element: Element | null) {
  if (!element) return;
  
  gsap.to(element, {
    y: 0,
    duration: durations.hover,
    ease: easings.hover,
    force3D: true,
  });
}

/**
 * Staggered list animation
 */
export function animateList(
  items: string | Element[] | NodeListOf<Element>,
  options: {
    from?: 'start' | 'end' | 'center' | 'edges' | 'random';
    stagger?: number;
    delay?: number;
  } = {}
) {
  const { from = 'start', stagger = staggers.normal, delay = 0 } = options;

  return gsap.from(items, {
    y: 15,
    autoAlpha: 0,
    duration: durations.normal,
    delay,
    stagger: {
      each: stagger,
      from,
    },
    ease: easings.decelerate,
    force3D: true,
  });
}

/**
 * Smooth scroll to element
 */
export function smoothScrollTo(target: Element | string, offset: number = 0) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!element) return;

  const y = element.getBoundingClientRect().top + window.scrollY + offset;
  
  gsap.to(window, {
    scrollTo: { y, autoKill: false },
    duration: durations.slow,
    ease: easings.standard,
  });
}

/**
 * Magnetic hover effect for buttons
 */
export function createMagneticEffect(
  element: Element | null,
  strength: number = 0.3
) {
  if (!element) return { onMove: () => {}, onLeave: () => {} };

  const onMove = (e: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    gsap.to(element, {
      x: x * strength,
      y: y * strength,
      duration: durations.hover,
      ease: easings.hover,
      force3D: true,
    });
  };

  const onLeave = () => {
    gsap.to(element, {
      x: 0,
      y: 0,
      duration: durations.hover,
      ease: easings.hover,
      force3D: true,
    });
  };

  return { onMove, onLeave };
}

/**
 * Loading spinner animation
 */
export function animateSpinner(element: Element | null) {
  if (!element) return;

  return gsap.to(element, {
    rotation: 360,
    duration: 1,
    ease: 'none',
    repeat: -1,
    force3D: true,
  });
}

/**
 * Success checkmark animation
 */
export function animateSuccess(element: Element | null) {
  if (!element) return;

  const tl = gsap.timeline();
  
  tl.from(element, {
    scale: 0,
    duration: durations.normal,
    ease: easings.spring,
    force3D: true,
  }).to(element, {
    scale: 1.1,
    duration: durations.instant,
    ease: easings.standard,
  }).to(element, {
    scale: 1,
    duration: durations.fast,
    ease: easings.spring,
  });

  return tl;
}
