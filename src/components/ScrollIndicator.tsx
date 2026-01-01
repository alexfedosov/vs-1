import { useRef, useState, useEffect, useCallback } from 'react';

interface ScrollIndicatorProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollIndicator({ children, className = '' }: ScrollIndicatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartScroll = useRef(0);

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollHeight, clientHeight, scrollTop } = el;
    const scrollable = scrollHeight > clientHeight;
    setIsScrollable(scrollable);

    if (scrollable) {
      const thumbH = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
      const maxScroll = scrollHeight - clientHeight;
      const thumbT = maxScroll > 0 ? (scrollTop / maxScroll) * (clientHeight - thumbH) : 0;
      setThumbHeight(thumbH);
      setThumbTop(thumbT);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateThumb();
    el.addEventListener('scroll', updateThumb);

    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', updateThumb);
      resizeObserver.disconnect();
    };
  }, [updateThumb]);

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScroll.current = scrollRef.current?.scrollTop || 0;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const el = scrollRef.current;
      if (!el) return;

      const { scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      const thumbH = Math.max(30, (clientHeight / scrollHeight) * clientHeight);
      const trackHeight = clientHeight - thumbH;

      const deltaY = e.clientY - dragStartY.current;
      const scrollDelta = (deltaY / trackHeight) * maxScroll;
      el.scrollTop = dragStartScroll.current + scrollDelta;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || e.target !== e.currentTarget) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const { scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;

    el.scrollTop = (clickY / clientHeight) * maxScroll;
  };

  return (
    <div className={`scroll-container ${className}`}>
      <div ref={scrollRef} className="scroll-content">
        {children}
      </div>
      {isScrollable && (
        <div className="scroll-track" onClick={handleTrackClick}>
          <div
            className={`scroll-thumb ${isDragging ? 'dragging' : ''}`}
            style={{ height: thumbHeight, top: thumbTop }}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
      )}
    </div>
  );
}
