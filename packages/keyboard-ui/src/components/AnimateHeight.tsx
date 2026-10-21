import { Component, createRef, type CSSProperties, type HTMLAttributes } from 'react';

type Height = NonNullable<CSSProperties['height']>;
export interface AnimateHeightProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onAnimationStart' | 'onAnimationEnd'
> {
  animateOpacity?: boolean;
  applyInlineTransitions?: boolean;
  contentClassName?: string;
  delay?: number;
  duration?: number;
  easing?: string;
  height?: Height;
  onAnimationStart?: (event: { newHeight: Height }) => void;
  onAnimationEnd?: (event: { newHeight: Height }) => void;
}
interface HeightState {
  height: Height;
  overflow: CSSProperties['overflow'] | null;
  shouldUseTransitions: boolean;
}
export const isNumber = (value: Height | undefined) =>
  value !== undefined && !isNaN(parseFloat(String(value))) && isFinite(Number(value));
export const isPercentage = (value: Height | undefined) =>
  typeof value === 'string' &&
  value.search('%') === value.length - 1 &&
  isNumber(value.slice(0, -1));

/** Measured auto/numeric/percentage transitions retain the original two-frame auto-height start. */
export class AnimateHeight extends Component<AnimateHeightProps, HeightState> {
  private contentElement = createRef<HTMLDivElement>();
  private animationTimer?: ReturnType<typeof setTimeout>;
  private transitionTimer?: ReturnType<typeof setTimeout>;
  private frames: number[] = [];
  constructor(props: AnimateHeightProps) {
    super(props);
    const numeric = isNumber(props.height),
      percentage = isPercentage(props.height);
    this.state = {
      height: numeric
        ? Number(props.height) < 0
          ? 0
          : props.height!
        : percentage
          ? props.height!
          : 'auto',
      overflow: numeric || percentage ? 'hidden' : 'visible',
      shouldUseTransitions: false,
    };
  }
  componentDidMount() {
    this.hideContent(this.state.height);
  }
  componentDidUpdate(previous: AnimateHeightProps, previousState: HeightState) {
    const { delay = 0, duration = 250, height, onAnimationEnd, onAnimationStart } = this.props;
    const content = this.contentElement.current;
    if (!content || height === previous.height) return;
    this.showContent(previousState.height);
    content.style.overflow = 'hidden';
    const contentHeight = content.offsetHeight;
    content.style.overflow = '';
    let next: Height = 0;
    const finish: HeightState = { height: 0, overflow: 'hidden', shouldUseTransitions: false };
    const wasAuto = previousState.height === 'auto';
    if (isNumber(height)) finish.height = next = Number(height) < 0 ? 0 : height!;
    else if (isPercentage(height)) finish.height = next = height!;
    else {
      next = contentHeight;
      finish.height = 'auto';
      finish.overflow = null;
    }
    if (wasAuto) {
      finish.height = next;
      next = contentHeight;
    }
    this.setState({ height: next, overflow: 'hidden', shouldUseTransitions: !wasAuto });
    this.clearAnimation();
    if (wasAuto) {
      finish.shouldUseTransitions = true;
      this.frames.push(
        requestAnimationFrame(() =>
          this.frames.push(
            requestAnimationFrame(() => {
              this.setState(finish);
              onAnimationStart?.({ newHeight: finish.height });
            }),
          ),
        ),
      );
      this.animationTimer = setTimeout(() => {
        this.setState({ shouldUseTransitions: false });
        this.hideContent(finish.height);
        onAnimationEnd?.({ newHeight: finish.height });
      }, duration + delay);
    } else {
      onAnimationStart?.({ newHeight: next });
      this.transitionTimer = setTimeout(() => {
        finish.shouldUseTransitions = false;
        this.setState(finish);
        if (height !== 'auto') this.hideContent(next);
        onAnimationEnd?.({ newHeight: next });
      }, duration + delay);
    }
  }
  private clearAnimation() {
    clearTimeout(this.transitionTimer);
    clearTimeout(this.animationTimer);
    for (const frame of this.frames) cancelAnimationFrame(frame);
    this.frames = [];
  }
  componentWillUnmount() {
    this.clearAnimation();
  }
  private showContent(height: Height) {
    if (height === 0 && this.contentElement.current) this.contentElement.current.style.display = '';
  }
  private hideContent(height: Height) {
    if (height === 0 && this.contentElement.current)
      this.contentElement.current.style.display = 'none';
  }
  render() {
    const {
      animateOpacity = false,
      applyInlineTransitions = true,
      children,
      contentClassName,
      duration = 250,
      easing = 'ease',
      delay = 0,
      style = {},
      height: _height,
      onAnimationEnd: _end,
      onAnimationStart: _start,
      ...rest
    } = this.props;
    const { height, overflow, shouldUseTransitions } = this.state;
    const componentStyle: CSSProperties = {
      ...style,
      height,
      overflow: overflow || style.overflow,
    };
    if (shouldUseTransitions && applyInlineTransitions)
      componentStyle.transition = [style.transition, `height ${duration}ms ${easing} ${delay}ms`]
        .filter(Boolean)
        .join(', ');
    const contentStyle: CSSProperties = animateOpacity
      ? {
          transition: `opacity ${duration}ms ${easing} ${delay}ms`,
          ...(height === 0 && { opacity: 0 }),
        }
      : {};
    return (
      <div {...rest} aria-hidden={height === 0} style={componentStyle}>
        <div className={contentClassName} style={contentStyle} ref={this.contentElement}>
          {children}
        </div>
      </div>
    );
  }
}
