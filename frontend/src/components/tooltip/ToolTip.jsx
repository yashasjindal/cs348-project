import React, { useRef, useState, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

function Tooltip({ text, children, className = '', as: Tag = 'span' }) {
    const textRef = useRef(null);
    const tooltipId = useId();
    const [isTruncated, setIsTruncated] = useState(false);
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({
        top: 0,
        left: 0
    });

    const hasOverflow = (element) => {
        if (!element) return false;

        return (
            element.scrollWidth > element.clientWidth ||
            Array.from(element.querySelectorAll('.truncate'))
                .some(child => child.scrollWidth > child.clientWidth)
        );
    };

    useEffect(() => {
        const element = textRef.current;

        if (!element) return;

        const checkTruncation = () => {
            const truncated = hasOverflow(element);

            setIsTruncated(truncated);

            if (!truncated) setVisible(false);
        };

        checkTruncation();

        const observer = new ResizeObserver(checkTruncation);
        observer.observe(element);

        document.fonts?.ready.then(checkTruncation);

        return () => observer.disconnect();
    }, [text]);

    const showTooltip = () => {
        const element = textRef.current;

        if (!hasOverflow(element)) return;

        const rect = element.getBoundingClientRect();

        setPosition({
            top: rect.top - 10,
            left: rect.left + rect.width / 2
        });

        setVisible(true);
    };

    const hideTooltip = () => {
        setVisible(false);
    };

    useEffect(() => {
        if (!visible) return;

        const handleOutsideClick = (event) => {
            if (!textRef.current?.contains(event.target)) {
                hideTooltip();
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                hideTooltip();
            }
        };

        window.addEventListener('scroll', hideTooltip, true);
        window.addEventListener('resize', hideTooltip);
        document.addEventListener('pointerdown', handleOutsideClick);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('scroll', hideTooltip, true);
            window.removeEventListener('resize', hideTooltip);
            document.removeEventListener('pointerdown', handleOutsideClick);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [visible]);

    return (
        <>
            <Tag
                ref={textRef}
                className={`tooltip-text ${className}`}
                tabIndex={isTruncated ? 0 : undefined}
                aria-describedby={visible ? tooltipId : undefined}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                onClick={showTooltip}
            >
                {children ?? text}
            </Tag>

            {visible && createPortal(
                <div
                    id={tooltipId}
                    role="tooltip"
                    className="tooltip-popup"
                    style={{
                        top: position.top,
                        left: `clamp(
                            min(160px, 50vw),
                            ${position.left}px,
                            max(calc(100vw - 160px), 50vw)
                        )`
                    }}
                >
                    {text}
                </div>,
                document.body
            )}
        </>
    );
}

export default Tooltip;